
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const TOTAL_LAPS = 3;

// Event Configuration
const RACE_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'evt_start', lap: 1, type: 'start_qte', description: "Race Start! Get ready for the lights!", qteDurationMs: 3000, actionText: "React!", successMessage: "Great Start!", failureMessage: "Slow Start!" },
  { id: 'evt_lap1_overtake', lap: 1, type: 'overtake_qte', description: "Opportunity to Overtake!", qteDurationMs: 2000, actionText: "Overtake!", successMessage: "Nice Move!", failureMessage: "Missed Chance!" },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', description: "Pit Stop Window! Your tires are wearing.", options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" }, // Success/Failure messages not really applicable here, handled by choice
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', description: "DRS Zone! Activate for a speed boost!", qteDurationMs: 1500, actionText: "Activate DRS!", successMessage: "DRS Boost!", failureMessage: "DRS Missed!" },
  { id: 'evt_lap3_defend', lap: 3, type: 'defend_qte', description: "Rival attacking! Defend your position!", qteDurationMs: 1800, actionText: "Defend!", successMessage: "Position Kept!", failureMessage: "Overtaken!" },
];

const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 2,
  tireWear: 0, // 0 = fresh, 100 = worn
  playerTimeMs: 0,
  rivalTimeMs: 0,
  lastEventMessage: null,
};

// Time penalties/bonuses in milliseconds
const TIME_START_GOOD = -1000; // Time bonus for good start
const TIME_START_BAD = 1500;   // Time penalty for bad start
const TIME_OVERTAKE_SUCCESS = -2000;
const TIME_OVERTAKE_FAIL = 1000;
const TIME_DEFEND_SUCCESS = -1500; // Effectively, rival loses this time
const TIME_DEFEND_FAIL = 2000;    // Player loses this time
const TIME_PIT_STOP_COST = 7000;  // Time lost for pitting
const TIRE_WEAR_PER_LAP = 25;
const TIRE_WEAR_PIT_RESET = 0;
const DRS_BONUS_GOOD_TIRES = -1800;
const DRS_BONUS_WORN_TIRES = -800;
const DRS_FAIL_PENALTY = 500;
const RIVAL_BASE_LAP_TIME_MS = 25000; // Rival's ideal lap time


export function useRaceStrategyLogic() {
  const [gameState, setGameState] = useState<RaceStrategyGameState>("idle");
  const [playerState, setPlayerState] = useState<PlayerRaceState>(INITIAL_PLAYER_STATE);
  const [currentEvent, setCurrentEvent] = useState<RaceEvent | null>(null);
  const [eventTimer, setEventTimer] = useState(0); // For QTE progress
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
      if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
      if (qteIntervalRef.current) clearInterval(qteIntervalRef.current);
      if (synthsRef.current) Object.values(synthsRef.current).forEach(synth => synth?.dispose());
    };
  }, []);

  const playSound = useCallback((type: 'event' | 'success' | 'fail' | 'pit' | 'finish') => {
    if (Tone.context.state !== 'running') Tone.start().catch(e => console.warn("Tone.start failed:", e));
    const synth = type === 'event' ? synthsRef.current?.eventTrigger :
                  type === 'success' ? synthsRef.current?.qteSuccess :
                  type === 'fail' ? synthsRef.current?.qteFail :
                  type === 'pit' ? synthsRef.current?.pitStop :
                  synthsRef.current?.raceFinish;
    if (!synth) return;
    const now = Tone.now();
    if (type === 'event' && synth instanceof Tone.Synth) synth.triggerAttackRelease("C4", "8n", now + 0.02);
    if (type === 'success' && synth instanceof Tone.Synth) synth.triggerAttackRelease("G5", "16n", now + 0.02);
    if (type === 'fail' && synth instanceof Tone.NoiseSynth) { synth.triggerRelease(now); synth.triggerAttackRelease("8n", now + 0.05); }
    if (type === 'pit' && synth instanceof Tone.Synth) synth.triggerAttackRelease("A3", "2n", now + 0.02);
    if (type === 'finish' && synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "2n", now + 0.02);
  }, []);

  const clearTimers = useCallback(() => {
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    if (qteIntervalRef.current) clearInterval(qteIntervalRef.current);
  }, []);
  
  const endRace = useCallback(() => {
    clearTimers();
    setGameState("finished");
    playSound('finish');
    const playerWins = playerState.playerTimeMs <= playerState.rivalTimeMs;
    setPlayerState(prev => ({ ...prev, lastEventMessage: playerWins ? `You Won! Final Time: ${(prev.playerTimeMs / 1000).toFixed(3)}s` : `You Lost! Rival was faster.` }));

    if (playerWins) {
      const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || playerState.playerTimeMs < leaderboard[leaderboard.length - 1]?.time;
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [playerState.playerTimeMs, playerState.rivalTimeMs, leaderboard, clearTimers, playSound, toast]);


  const processNextEvent = useCallback(() => {
    clearTimers();
    if (gameStateRef.current === 'finished') return;

    setGameState("lap_transition");
    
    // Update lap and tire wear before fetching next event
    let currentLap = playerState.lap;
    let currentTireWear = playerState.tireWear;
    let playerTimeToUpdate = playerState.playerTimeMs;
    let rivalTimeToUpdate = playerState.rivalTimeMs;

    const eventJustProcessed = RACE_EVENTS_CONFIG[currentEventIndexRef.current -1];
     // Add base lap times if a lap boundary was crossed by the *previous* event
    if (eventJustProcessed && (currentEventIndexRef.current === 0 || RACE_EVENTS_CONFIG[currentEventIndexRef.current]?.lap > eventJustProcessed.lap)) {
        currentLap = eventJustProcessed.lap; // Ensure lap is set to the one just completed for time addition
        if (currentLap > 0 && currentLap <= TOTAL_LAPS) { // Only add lap times for completed laps
            playerTimeToUpdate += RIVAL_BASE_LAP_TIME_MS + (currentTireWear / 100 * 5000); // Penalty for tire wear
            rivalTimeToUpdate += RIVAL_BASE_LAP_TIME_MS;
            currentTireWear = Math.min(100, currentTireWear + TIRE_WEAR_PER_LAP);
        }
    }
    
    setPlayerState(prev => ({
      ...prev,
      lap: currentLap, // This will be updated to the *new* event's lap below
      tireWear: currentTireWear,
      playerTimeMs: playerTimeToUpdate,
      rivalTimeMs: rivalTimeToUpdate,
    }));


    if (currentEventIndexRef.current >= RACE_EVENTS_CONFIG.length) {
      // If all events done, add final (potentially partial) lap time and end race
      setPlayerState(prev => ({
        ...prev,
        lap: TOTAL_LAPS, // Ensure final lap is marked
        playerTimeMs: prev.playerTimeMs + (RIVAL_BASE_LAP_TIME_MS + (prev.tireWear / 100 * 5000)) /2, // Pro-rate final segment? Or just fixed.
        rivalTimeMs: prev.rivalTimeMs + RIVAL_BASE_LAP_TIME_MS / 2,
      }));
      setGameState("calculating_results");
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }

    const nextEvent = RACE_EVENTS_CONFIG[currentEventIndexRef.current];
    setCurrentEvent(nextEvent);
    setPlayerState(prev => ({...prev, lap: nextEvent.lap})); // Update to current event's lap

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished') return;
      setGameState("event_active");
      playSound('event');
      qteStartRef.current = performance.now();
      setEventTimer(0);

      if (nextEvent.qteDurationMs) {
        qteIntervalRef.current = setInterval(() => {
          const elapsed = performance.now() - qteStartRef.current;
          setEventTimer(Math.min(100, (elapsed / nextEvent.qteDurationMs!) * 100));
          if (elapsed >= nextEvent.qteDurationMs!) {
            clearInterval(qteIntervalRef.current!);
            // QTE timed out - treat as failure
            handleEventAction(null, true); // Pass true for timedOut
          }
        }, 50);
      }
    }, 1000); // Brief delay for lap transition message

    currentEventIndexRef.current++;

  }, [playerState, endRace, playSound, clearTimers]);


  const handleEventAction = useCallback((choice?: string | number, timedOut: boolean = false) => {
    if (gameStateRef.current !== "event_active" || !currentEvent) return;
    clearTimers();

    let timeDeltaPlayer = 0;
    let timeDeltaRival = 0;
    let newTireWear = playerState.tireWear;
    let eventResultMessage = "";

    const reactionTime = performance.now() - qteStartRef.current;

    if (timedOut) { // Handle QTE timeout as failure
      playSound('fail');
      eventResultMessage = currentEvent.failureMessage;
      if (currentEvent.type === 'start_qte') timeDeltaPlayer += TIME_START_BAD;
      else if (currentEvent.type === 'overtake_qte') timeDeltaPlayer += TIME_OVERTAKE_FAIL;
      else if (currentEvent.type === 'defend_qte') timeDeltaPlayer += TIME_DEFEND_FAIL;
      else if (currentEvent.type === 'drs_qte') timeDeltaPlayer += DRS_FAIL_PENALTY;
    } else {
      // Handle successful action or decision
      switch (currentEvent.type) {
        case 'start_qte':
          // For start, lower reaction time is better. Max QTE duration is a fail.
          // Let's simplify: if clicked within 1/3 of QTE time, it's good.
          if (reactionTime < currentEvent.qteDurationMs! / 3) {
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
          // For these, just clicking in time is success.
          playSound('success');
          eventResultMessage = currentEvent.successMessage;
          if (currentEvent.type === 'overtake_qte') timeDeltaPlayer += TIME_OVERTAKE_SUCCESS;
          if (currentEvent.type === 'defend_qte') timeDeltaRival += TIME_DEFEND_SUCCESS; // Rival loses time (player effectively gains)
          if (currentEvent.type === 'drs_qte') {
            timeDeltaPlayer += (playerState.tireWear < 50) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
          }
          break;
        case 'pit_decision':
          playSound('pit');
          if (choice === currentEvent.options![0]) { // "Pit for Fresh Tires"
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = "Pit stop complete! Fresh tires!";
          } else { // "Stay Out"
            eventResultMessage = "Staying out on old tires.";
            // No immediate time change, but tire wear continues
          }
          break;
      }
    }
    
    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDeltaPlayer,
      rivalTimeMs: prev.rivalTimeMs + timeDeltaRival,
      tireWear: newTireWear,
      lastEventMessage: eventResultMessage,
      position: (prev.playerTimeMs + timeDeltaPlayer <= prev.rivalTimeMs + timeDeltaRival) ? 1 : 2,
    }));
    
    processNextEvent();

  }, [currentEvent, playerState, processNextEvent, playSound]);


  const startGame = useCallback(() => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE);
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    setGameState("countdown");

    // Simulate a 3, 2, 1, GO sequence
    let countdown = 3;
    setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
      } else if (countdown === 0){
        setPlayerState(prev => ({...prev, lastEventMessage: `GO!`}));
      } else {
        clearInterval(countdownInterval);
        processNextEvent(); // Start the first actual race event
      }
    }, 1000);
  }, [clearTimers, processNextEvent]);

  const saveRaceScore = useCallback((nickname: string) => {
    if (!playerState.playerTimeMs) return;
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: playerState.playerTimeMs,
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time) // Lower time is better
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
    eventTimer, // QTE progress
    leaderboard,
    showNicknameModal,
    startGame,
    handleEventAction,
    saveRaceScore,
    setShowNicknameModal,
    TOTAL_LAPS
  };
}
