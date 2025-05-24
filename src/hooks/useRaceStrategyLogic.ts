
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 3;

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'evt_start', lap: 1, type: 'start_qte', description: "Race Start! Nail the launch!", qteDurationMs: 2800, actionText: "Launch!", successMessage: "P1 Launch!", failureMessage: "Slow Start, lost a position." },
  { id: 'evt_lap1_drs', lap: 1, type: 'drs_qte', description: "Early DRS Zone! Maximize it!", qteDurationMs: 1500, actionText: "Activate DRS", successMessage: "DRS Boost! Gaining time.", failureMessage: "DRS Missed! Lost time." },
  { id: 'evt_lap1_overtake', lap: 1, type: 'overtake_qte', description: "Chance to gain on the clock!", qteDurationMs: 1800, actionText: "Make a Move!", successMessage: "Excellent maneuver! Time gained.", failureMessage: "Opportunity missed." },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', description: "Pit Window Open. Consider tire wear.", options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" }, // Success/Failure message handled in logic
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', description: "DRS Zone! Crucial for lap time.", qteDurationMs: 1400, actionText: "Activate DRS!", successMessage: "DRS Effective! Good pace.", failureMessage: "DRS Window Closed. Time lost." },
  { id: 'evt_lap3_defend', lap: 3, type: 'defend_qte', description: "Under pressure! Defend your pace!", qteDurationMs: 1900, actionText: "Hold Position!", successMessage: "Pace Maintained!", failureMessage: "Pace Dropped. Lost time." },
  { id: 'evt_lap3_overtake_final', lap: 3, type: 'overtake_qte', description: "Final Lap Push! Every millisecond counts!", qteDurationMs: 1700, actionText: "Attack!", successMessage: "Aggressive move! Faster sector.", failureMessage: "Couldn't improve sector time." },
];

const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 1, // Start in P1 conceptually
  tireWear: 0,
  playerTimeMs: 0,
  lastEventMessage: null,
};

// Time adjustments in milliseconds
const TIME_START_GOOD = -1500; // Bonus for good start
const TIME_START_BAD = 1200;   // Penalty for bad start
const TIME_OVERTAKE_SUCCESS = -2000; // Time gained
const TIME_OVERTAKE_FAIL = 700;     // Time lost
const TIME_DEFEND_SUCCESS = -500;  // Small bonus for holding pace
const TIME_DEFEND_FAIL = 1500;      // Penalty for losing pace
const TIME_PIT_STOP_COST = 5500;   // Reduced pit stop cost
const TIRE_WEAR_PER_LAP = 20;      // Reduced tire wear
const TIRE_WEAR_PIT_RESET = 0;
const DRS_BONUS_GOOD_TIRES = -2200; // Increased DRS bonus
const DRS_BONUS_WORN_TIRES = -1200;
const DRS_FAIL_PENALTY = 500;
const PLAYER_BASE_LAP_TIME_MS = 22000; // Target lap time for P1 pace
const TIRE_WEAR_TIME_PENALTY_FACTOR = 25; // ms penalty per % of tire wear per lap segment

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
              // console.error("Error disposing synth:", e);
            }
          }
        });
        synthsRef.current = null; 
      }
    };
  }, [clearTimers]);

  const playSound = useCallback((type: 'event' | 'success' | 'fail' | 'pit' | 'finish') => {
    if (Tone.context.state !== 'running') Tone.start().catch(e => console.warn("Tone.start failed:", e));
    
    if (!synthsRef.current) return;

    const synthMap = {
      event: synthsRef.current?.eventTrigger,
      success: synthsRef.current?.qteSuccess,
      fail: synthsRef.current?.qteFail,
      pit: synthsRef.current?.pitStop,
      finish: synthsRef.current?.raceFinish,
    };
    const synth = synthMap[type];
    
    if (!synth || (synth as any).disposed) return;

    const now = Tone.now();
    try {
      if (type === 'fail' && synth instanceof Tone.NoiseSynth) {
        synth.triggerRelease(now); 
        synth.triggerAttackRelease("8n", now + 0.05); 
      } else if (synth instanceof Tone.Synth) {
        const note = type === 'event' ? "C4" : type === 'success' ? "G5" : "A3";
        const duration = type === 'pit' ? "2n" : "8n";
        synth.triggerAttackRelease(note, duration, now + 0.02);
      } else if (type === 'finish' && synth instanceof Tone.PolySynth) {
        synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "2n", now + 0.02);
      }
    } catch (e) {
      // console.error(`Error playing sound type ${type}:`, e);
    }
  }, []);
  
  const endRace = useCallback(() => {
    clearTimers();
    setGameState("finished");
    playSound('finish');
    
    const finalMessage = playerState.position === 1 
      ? `P1 Finish! Your Time: ${(playerState.playerTimeMs / 1000).toFixed(3)}s`
      : `Race Complete! Time: ${(playerState.playerTimeMs / 1000).toFixed(3)}s. Ended P${playerState.position}.`;

    setPlayerState(prev => ({ 
        ...prev, 
        lap: TOTAL_LAPS,
        lastEventMessage: finalMessage
    }));

    const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || playerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
    if (isTopScore) {
      setShowNicknameModal(true);
    }
  }, [playerState.playerTimeMs, playerState.position, leaderboard, clearTimers, playSound]);


  const processNextEvent = useCallback(() => {
    clearTimers();
    if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;

    setGameState("lap_transition");
    
    let newPlayerTime = playerState.playerTimeMs;
    let newTireWear = playerState.tireWear;
    let currentLapForPlayer = playerState.lap;

    const prevEventConfig = currentEventIndexRef.current > 0 ? RACE_EVENTS_CONFIG[currentEventIndexRef.current - 1] : null;
    const nextEventToProcess = RACE_EVENTS_CONFIG[currentEventIndexRef.current];

    // Add base time for the segment *before* this new event
    // This happens if we are starting a new lap, or if it's the first event of the game.
    if (currentEventIndexRef.current === 0 || (nextEventToProcess && nextEventToProcess.lap > (prevEventConfig?.lap || 0) && currentLapForPlayer > 0) ) {
        // If it's not the very first event of the game (where lap is 0)
        if (currentLapForPlayer > 0) {
            newPlayerTime += PLAYER_BASE_LAP_TIME_MS + (newTireWear * TIRE_WEAR_TIME_PENALTY_FACTOR);
            newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
        }
    }
    
    currentLapForPlayer = nextEventToProcess ? nextEventToProcess.lap : TOTAL_LAPS + 1; // Update current lap to next event's lap or end

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: newPlayerTime,
      tireWear: newTireWear,
      lap: currentLapForPlayer <= TOTAL_LAPS ? currentLapForPlayer : TOTAL_LAPS // Ensure lap doesn't exceed total
    }));


    if (currentEventIndexRef.current >= RACE_EVENTS_CONFIG.length) {
      setGameState("calculating_results");
      // Add time for the final lap/segment *after* the last event if race not finished on exact event.
      // This ensures the last part of the last lap is timed.
      let finalSegmentTime = PLAYER_BASE_LAP_TIME_MS + (newTireWear * TIRE_WEAR_TIME_PENALTY_FACTOR);
       setPlayerState(prev => ({
        ...prev,
        playerTimeMs: prev.playerTimeMs + finalSegmentTime,
        lap: TOTAL_LAPS, // Explicitly set to final lap
        tireWear: Math.min(100, newTireWear + TIRE_WEAR_PER_LAP) // Wear for final segment
      }));
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }

    const eventToDisplay = RACE_EVENTS_CONFIG[currentEventIndexRef.current];
    setCurrentEvent(eventToDisplay);
     setPlayerState(prev => ({...prev, lap: eventToDisplay.lap})); // Update current lap display

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      setGameState("event_active");
      playSound('event');
      qteStartRef.current = performance.now();
      setEventTimer(0);

      if (eventToDisplay.qteDurationMs) {
        qteIntervalRef.current = setInterval(() => {
          if (gameStateRef.current !== 'event_active') {
            if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
            return;
          }
          const elapsed = performance.now() - qteStartRef.current;
          setEventTimer(Math.min(100, (elapsed / eventToDisplay.qteDurationMs!) * 100));
          if (elapsed >= eventToDisplay.qteDurationMs!) {
            if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
            if(gameStateRef.current === 'event_active') {
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
    let newTireWear = playerState.tireWear;
    let eventResultMessage = "";
    let positionChange = 0; // -1 for gain, +1 for loss

    const reactionTime = performance.now() - qteStartRef.current;

    if (timedOut) { 
      playSound('fail');
      eventResultMessage = currentEvent.failureMessage || "Timed Out! Lost pace.";
      if (currentEvent.type === 'start_qte') { timeDeltaPlayer += TIME_START_BAD; positionChange = 1; }
      else if (currentEvent.type === 'overtake_qte') { timeDeltaPlayer += TIME_OVERTAKE_FAIL; }
      else if (currentEvent.type === 'defend_qte') { timeDeltaPlayer += TIME_DEFEND_FAIL; positionChange = 1; }
      else if (currentEvent.type === 'drs_qte') { timeDeltaPlayer += DRS_FAIL_PENALTY; }
    } else {
      switch (currentEvent.type) {
        case 'start_qte':
          if (reactionTime < currentEvent.qteDurationMs! * 0.35) { // Slightly harder for P1 launch
            timeDeltaPlayer += TIME_START_GOOD;
            eventResultMessage = currentEvent.successMessage;
            playSound('success');
          } else {
            timeDeltaPlayer += TIME_START_BAD;
            eventResultMessage = currentEvent.failureMessage;
            positionChange = 1;
            playSound('fail');
          }
          break;
        case 'overtake_qte':
           timeDeltaPlayer += TIME_OVERTAKE_SUCCESS;
           eventResultMessage = currentEvent.successMessage;
           playSound('success');
          break;
        case 'defend_qte':
           timeDeltaPlayer += TIME_DEFEND_SUCCESS;
           eventResultMessage = currentEvent.successMessage;
           playSound('success');
          break;
        case 'drs_qte':
          timeDeltaPlayer += (playerState.tireWear < 55) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
          eventResultMessage = currentEvent.successMessage;
          playSound('success');
          break;
        case 'pit_decision':
          playSound('pit');
          if (choice === currentEvent.options![0]) { 
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = "Pit stop complete! Fresh tires, time lost in pits.";
          } else { 
            eventResultMessage = "Staying out. Tires will degrade further.";
          }
          break;
      }
    }
    
    const newPosition = Math.max(1, playerState.position + positionChange); // Position can't be better than 1

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDeltaPlayer,
      tireWear: newTireWear,
      position: newPosition,
      lastEventMessage: eventResultMessage,
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
    playSound('event');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
        playSound('event');
      } else if (countdown === 0){
        setPlayerState(prev => ({...prev, lastEventMessage: `GO!`}));
        playSound('success');
      } else {
        clearInterval(countdownInterval);
        if (gameStateRef.current === 'countdown') {
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
      time: Math.round(playerState.playerTimeMs),
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time) 
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(RACE_STRATEGY_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Race Time Saved!", description: `Great driving, ${nickname}!` });
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
