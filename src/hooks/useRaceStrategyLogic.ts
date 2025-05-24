
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 3; // Kept export for page display

// Event Configuration - Enhanced
const RACE_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'evt_start', lap: 1, type: 'start_qte', description: "Race Start! Get ready for the lights!", qteDurationMs: 2800, actionText: "React!", successMessage: "Great Start!", failureMessage: "Slow Start!" },
  { id: 'evt_lap1_overtake', lap: 1, type: 'overtake_qte', description: "Opportunity to Overtake!", qteDurationMs: 1800, actionText: "Overtake!", successMessage: "Nice Move!", failureMessage: "Missed Chance!" },
  { id: 'evt_lap1_drs', lap: 1, type: 'drs_qte', description: "Early DRS Zone!", qteDurationMs: 1500, actionText: "Activate DRS", successMessage: "DRS Effective!", failureMessage: "DRS Window Missed!" },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', description: "Pit Stop Window! Your tires are wearing.", options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" },
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', description: "DRS Zone! Activate for a speed boost!", qteDurationMs: 1400, actionText: "Activate DRS!", successMessage: "DRS Boost!", failureMessage: "DRS Missed!" },
  { id: 'evt_lap3_overtake_final', lap: 3, type: 'overtake_qte', description: "Final Lap Push! Chance to pass!", qteDurationMs: 1700, actionText: "Go For It!", successMessage: "Brilliant Overtake!", failureMessage: "Couldn't Make it Stick!" },
  { id: 'evt_lap3_defend', lap: 3, type: 'defend_qte', description: "Rival attacking! Defend your position!", qteDurationMs: 1900, actionText: "Defend!", successMessage: "Position Kept!", failureMessage: "Overtaken!" },
];

const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 2,
  tireWear: 0, 
  playerTimeMs: 0,
  rivalTimeMs: 0,
  lastEventMessage: null,
};

// Time penalties/bonuses in milliseconds - Adjusted for winnability
const TIME_START_GOOD = -1200; 
const TIME_START_BAD = 1000;   
const TIME_OVERTAKE_SUCCESS = -2200;
const TIME_OVERTAKE_FAIL = 800;
const TIME_DEFEND_SUCCESS = -1800; 
const TIME_DEFEND_FAIL = 1800;    
const TIME_PIT_STOP_COST = 6000;  
const TIRE_WEAR_PER_LAP = 22; // Slightly less wear
const TIRE_WEAR_PIT_RESET = 0;
const DRS_BONUS_GOOD_TIRES = -2000; // More effective DRS
const DRS_BONUS_WORN_TIRES = -1100;
const DRS_FAIL_PENALTY = 400;
const RIVAL_BASE_LAP_TIME_MS = 24000; // Rival slightly slower base
const RIVAL_TIRE_WEAR_PENALTY_FACTOR = 3500; // How much rival is affected by their "assumed" similar wear.

export function useRaceStrategyLogic() {
  const [gameState, setGameState] = useState<RaceStrategyGameState>("idle");
  const [playerState, setPlayerState] = useState<PlayerRaceState>(INITIAL_PLAYER_STATE);
  const [currentEvent, setCurrentEvent] = useState<RaceEvent | null>(null);
  const [eventTimer, setEventTimer] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const eventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qteStartRef = useRef<number>(0);
  const currentEventIndexRef = useRef(0);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const synthsRef = useRef<{
    eventTrigger?: Tone.Synth;
    qteSuccess?: Tone.Synth;
    qteFail?: Tone.NoiseSynth;
    pitStop?: Tone.Synth;
    raceFinish?: Tone.PolySynth;
  } | null>(null);

  const clearTimers = useCallback(() => {
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    if (qteIntervalRef.current) clearInterval(qteIntervalRef.current);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        eventTrigger: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.1 } }).toDestination(),
        qteSuccess: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
        qteFail: new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 } }).toDestination(),
        pitStop: new Tone.Synth({ oscillator: { type: "square" }, volume: -10, envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.2 } }).toDestination(),
        raceFinish: new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 } }).toDestination(),
      };
    }
    const storedLeaderboard = localStorage.getItem(RACE_STRATEGY_LEADERBOARD_KEY);
    if (storedLeaderboard) setLeaderboard(JSON.parse(storedLeaderboard));
    
    return () => {
      clearTimers();
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => {
          if (synth && !(synth as any).disposed) {
            try {
              synth.dispose();
            } catch (e) {
              console.error("Error disposing synth:", e);
            }
          }
        });
        synthsRef.current = null; 
      }
    };
  }, [clearTimers]);

  const playSound = useCallback((type: 'event' | 'success' | 'fail' | 'pit' | 'finish') => {
    if (Tone.context.state !== 'running') Tone.start().catch(e => console.warn("Tone.start failed:", e));
    
    if (!synthsRef.current) {
        console.warn("Synths not initialized in playSound");
        return;
    }

    const synth = type === 'event' ? synthsRef.current?.eventTrigger :
                  type === 'success' ? synthsRef.current?.qteSuccess :
                  type === 'fail' ? synthsRef.current?.qteFail :
                  type === 'pit' ? synthsRef.current?.pitStop :
                  synthsRef.current?.raceFinish;
    
    if (!synth || (synth as any).disposed) {
        console.warn(`Synth for type '${type}' is not available or disposed.`);
        return;
    }

    const now = Tone.now();
    if (type === 'event' && synth instanceof Tone.Synth) synth.triggerAttackRelease("C4", "8n", now + 0.02);
    if (type === 'success' && synth instanceof Tone.Synth) synth.triggerAttackRelease("G5", "16n", now + 0.02);
    if (type === 'fail' && synth instanceof Tone.NoiseSynth) {
        synth.triggerRelease(now); // Attempt to stop current sound
        synth.triggerAttackRelease("8n", now + 0.05); // Schedule new sound slightly later
    }
    if (type === 'pit' && synth instanceof Tone.Synth) synth.triggerAttackRelease("A3", "2n", now + 0.02);
    if (type === 'finish' && synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "2n", now + 0.02);
  }, []);
  
  const endRace = useCallback(() => {
    clearTimers();
    // Final lap time calculation - ensure it's added if race ends mid-lap or after last event.
    // This logic needs to be careful not to double-add.
    // The current processNextEvent handles adding time after last event.
    
    setGameState("finished");
    playSound('finish'); // This call should now be safer
    
    const playerWins = playerState.playerTimeMs <= playerState.rivalTimeMs;
    setPlayerState(prev => ({ 
        ...prev, 
        lap: TOTAL_LAPS, // Ensure lap is set to max at finish
        lastEventMessage: playerWins ? `You Won! Final Time: ${(prev.playerTimeMs / 1000).toFixed(3)}s` : `You Lost! Rival was faster. Player: ${(prev.playerTimeMs / 1000).toFixed(3)}s, Rival: ${(prev.rivalTimeMs / 1000).toFixed(3)}s` 
    }));

    if (playerWins) {
      const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || playerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [playerState.playerTimeMs, playerState.rivalTimeMs, leaderboard, clearTimers, playSound, toast]);


  const processNextEvent = useCallback(() => {
    clearTimers();
    if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;

    setGameState("lap_transition");
    
    let newPlayerTime = playerState.playerTimeMs;
    let newRivalTime = playerState.rivalTimeMs;
    let newTireWear = playerState.tireWear;
    let currentLapForCalc = playerState.lap;


    // Check if a lap was completed *before* this current event.
    // The previous event's lap is playerState.lap (as it was before current event).
    // The current event's lap is RACE_EVENTS_CONFIG[currentEventIndexRef.current].lap (if it exists).
    const prevEvent = currentEventIndexRef.current > 0 ? RACE_EVENTS_CONFIG[currentEventIndexRef.current - 1] : null;
    const nextEventConfig = RACE_EVENTS_CONFIG[currentEventIndexRef.current]; // Potential next event

    if (prevEvent) { // If not the very first event
      // If the previous event was on a lap that is now 'completed' by moving to a new event on a new lap
      // OR if this is the first event of the game (currentEventIndexRef.current will be 0 for the first event being set up).
      // This logic is tricky. Let's simplify: Add base lap time when currentEvent.lap > playerState.lap
      
      // Base time for lap completion, *if* current event is for a new lap *or* we are moving past the last event
      if (nextEventConfig && nextEventConfig.lap > currentLapForCalc && currentLapForCalc > 0) {
          newPlayerTime += RIVAL_BASE_LAP_TIME_MS + (newTireWear / 100 * RIVAL_TIRE_WEAR_PENALTY_FACTOR);
          newRivalTime += RIVAL_BASE_LAP_TIME_MS; // Rival also completes lap
          newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
          currentLapForCalc = nextEventConfig.lap; // Update the lap for this calculation cycle
      } else if (!nextEventConfig && currentLapForCalc < TOTAL_LAPS) { 
          // If there's no next event, means we are at the end. Add time for the final lap.
          // This assumes the last event was on TOTAL_LAPS. If not, this needs adjustment.
          // For simplicity, we assume the last event completes a lap if it's on TOTAL_LAPS.
          // This case is better handled by endRace.
      }
    }

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: newPlayerTime,
      rivalTimeMs: newRivalTime,
      tireWear: newTireWear,
      lap: currentLapForCalc // This lap is now the one the player is *entering* or *on* for the next event
    }));

    if (currentEventIndexRef.current >= RACE_EVENTS_CONFIG.length) {
      // All configured events are done.
      setGameState("calculating_results");
      // Add final segment time. Assume last event doesn't add a full lap time.
      // Any lap time for the lap of the *last* event should have been added when transitioning *to* it.
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }

    const eventToProcess = RACE_EVENTS_CONFIG[currentEventIndexRef.current];
    setCurrentEvent(eventToProcess);
    // Update playerState.lap to the lap of the event they are about to encounter
    setPlayerState(prev => ({...prev, lap: eventToProcess.lap})); 

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      setGameState("event_active");
      playSound('event');
      qteStartRef.current = performance.now();
      setEventTimer(0);

      if (eventToProcess.qteDurationMs) {
        qteIntervalRef.current = setInterval(() => {
          if (gameStateRef.current !== 'event_active') { // Stop if state changed
            if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
            return;
          }
          const elapsed = performance.now() - qteStartRef.current;
          setEventTimer(Math.min(100, (elapsed / eventToProcess.qteDurationMs!) * 100));
          if (elapsed >= eventToProcess.qteDurationMs!) {
            if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
            if(gameStateRef.current === 'event_active') { // Check again to prevent race condition
              handleEventAction(undefined, true); 
            }
          }
        }, 50);
      }
    }, 1000); 

    currentEventIndexRef.current++;

  }, [playerState, endRace, playSound, clearTimers]);


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    if (gameStateRef.current !== "event_active" || !currentEvent) return;
    clearTimers();

    let timeDeltaPlayer = 0;
    let timeDeltaRival = 0; // For events affecting rival's time relative to player
    let newTireWear = playerState.tireWear;
    let eventResultMessage = "";

    const reactionTime = performance.now() - qteStartRef.current;

    if (timedOut) { 
      playSound('fail');
      eventResultMessage = currentEvent.failureMessage || "Timed Out!";
      if (currentEvent.type === 'start_qte') timeDeltaPlayer += TIME_START_BAD;
      else if (currentEvent.type === 'overtake_qte') timeDeltaPlayer += TIME_OVERTAKE_FAIL;
      else if (currentEvent.type === 'defend_qte') timeDeltaPlayer += TIME_DEFEND_FAIL; // Player loses time, rival gains relatively
      else if (currentEvent.type === 'drs_qte') timeDeltaPlayer += DRS_FAIL_PENALTY;
    } else {
      switch (currentEvent.type) {
        case 'start_qte':
          if (reactionTime < currentEvent.qteDurationMs! * 0.4) { // Adjusted threshold
            timeDeltaPlayer += TIME_START_GOOD;
            eventResultMessage = currentEvent.successMessage;
            playSound('success');
          } else {
            timeDeltaPlayer += TIME_START_BAD;
            eventResultMessage = currentEvent.failureMessage;
            playSound('fail');
          }
          break;
        case 'overtake_qte':
        case 'defend_qte':
        case 'drs_qte':
          playSound('success');
          eventResultMessage = currentEvent.successMessage;
          if (currentEvent.type === 'overtake_qte') timeDeltaPlayer += TIME_OVERTAKE_SUCCESS;
          if (currentEvent.type === 'defend_qte') timeDeltaRival += TIME_DEFEND_SUCCESS; 
          if (currentEvent.type === 'drs_qte') {
            timeDeltaPlayer += (playerState.tireWear < 60) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES; // Adjusted wear threshold
          }
          break;
        case 'pit_decision':
          playSound('pit');
          if (choice === currentEvent.options![0]) { 
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = "Pit stop complete! Fresh tires!";
          } else { 
            eventResultMessage = "Staying out on old tires.";
          }
          break;
      }
    }
    
    // Update player's cumulative time, tire wear, and position relative to rival
    const updatedPlayerTime = playerState.playerTimeMs + timeDeltaPlayer;
    const updatedRivalTime = playerState.rivalTimeMs + timeDeltaRival; // Rival's time adjustment

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: updatedPlayerTime,
      rivalTimeMs: updatedRivalTime,
      tireWear: newTireWear,
      lastEventMessage: eventResultMessage,
      position: (updatedPlayerTime <= updatedRivalTime) ? 1 : 2,
    }));
    
    processNextEvent();

  }, [currentEvent, playerState, processNextEvent, playSound, clearTimers]);


  const startGame = useCallback(() => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE);
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    setGameState("countdown");

    let countdown = 3;
    setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
    playSound('event'); // Countdown beep
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
        playSound('event'); // Countdown beep
      } else if (countdown === 0){
        setPlayerState(prev => ({...prev, lastEventMessage: `GO!`}));
        playSound('success'); // Go sound
      } else {
        clearInterval(countdownInterval);
        if (gameStateRef.current === 'countdown') { // Ensure not already advanced
          processNextEvent(); 
        }
      }
    }, 1000);
  }, [clearTimers, processNextEvent, playSound]);

  const saveRaceScore = useCallback((nickname: string) => {
    if (!playerState.playerTimeMs) return;
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: playerState.playerTimeMs,
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time) 
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(RACE_STRATEGY_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Race Time Saved!", description: `Fantastic race, ${nickname}!` });
  }, [playerState.playerTimeMs, leaderboard, toast]);

  return {
    gameState,
    playerState,
    currentEvent,
    eventTimer, 
    leaderboard,
    showNicknameModal,
    startGame,
    handleEventAction,
    saveRaceScore,
    setShowNicknameModal,
    TOTAL_LAPS
  };
}

    