
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 3;

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'evt_start', lap: 1, type: 'start_qte', description: "Race Start! Nail the launch!", qteDurationMs: 2500, actionText: "Launch!", successMessage: "P1 Launch! Great start!", failureMessage: "Slow Start, dropped to P2." },
  { id: 'evt_lap1_drs', lap: 1, type: 'drs_qte', description: "Early DRS Zone! Maximize it!", qteDurationMs: 1300, actionText: "Activate DRS", successMessage: "DRS Boost! Gaining time.", failureMessage: "DRS Missed! Lost opportunity." },
  { id: 'evt_lap1_corner_seq', lap: 1, type: 'defend_qte', description: "Tight Corner Sequence! Maintain control!", qteDurationMs: 1800, actionText: "Hold the Line!", successMessage: "Kept it smooth through the corners!", failureMessage: "Lost time in the chicane." },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', description: "Pit Window Open. Consider tire wear.", options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" },
  { id: 'evt_lap2_traffic', lap: 2, type: 'overtake_qte', description: "Backmarker traffic! Navigate cleanly.", qteDurationMs: 1700, actionText: "Pass Backmarker", successMessage: "Cleared traffic efficiently!", failureMessage: "Stuck behind backmarkers, lost time." },
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', description: "DRS Zone! Crucial for lap time.", qteDurationMs: 1200, actionText: "Activate DRS!", successMessage: "DRS Effective! Good pace.", failureMessage: "DRS Window Closed. Time lost." },
  { id: 'evt_lap3_defend', lap: 3, type: 'defend_qte', description: "Under pressure! Defend your position!", qteDurationMs: 1700, actionText: "Defend P1!", successMessage: "Position Maintained! Solid defense.", failureMessage: "Overtaken! Dropped a position." },
  { id: 'evt_lap3_rain', lap: 3, type: 'overtake_qte', description: "Sudden rain shower! Quick reaction needed!", qteDurationMs: 1600, actionText: "Adapt to Rain!", successMessage: "Handled the wet conditions well!", failureMessage: "Struggled in the rain, lost grip and time." },
  { id: 'evt_lap3_overtake_final', lap: 3, type: 'overtake_qte', description: "Final Lap Push! Every millisecond counts!", qteDurationMs: 1500, actionText: "Final Attack!", successMessage: "Aggressive move! Gained crucial time.", failureMessage: "Couldn't improve, final sector slow." },
];

const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 1,
  tireWear: 0,
  playerTimeMs: 0,
  lastEventMessage: null,
};

// Time adjustments in milliseconds
const TIME_START_GOOD = -1200;
const TIME_START_BAD = 1500;
const TIME_OVERTAKE_SUCCESS = -1800;
const TIME_OVERTAKE_FAIL = 1000;
const TIME_DEFEND_SUCCESS = -400;
const TIME_DEFEND_FAIL = 1800;
const TIME_PIT_STOP_COST = 6000;
const TIRE_WEAR_PER_LAP = 25;
const TIRE_WEAR_PIT_RESET = 0;
const DRS_BONUS_GOOD_TIRES = -2000;
const DRS_BONUS_WORN_TIRES = -1000;
const DRS_FAIL_PENALTY = 700;
const PLAYER_BASE_LAP_TIME_MS = 21500; // Target lap time for P1 pace
const TIRE_WEAR_TIME_PENALTY_FACTOR = 30; // ms penalty per % of tire wear per lap segment

export function useRaceStrategyLogic() {
  const [gameState, setGameState] = useState<RaceStrategyGameState>("idle");
  const gameStateRef = useRef(gameState);
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

  const synthsRef = useRef<{
    eventTrigger?: Tone.Synth;
    qteSuccess?: Tone.Synth;
    qteFail?: Tone.NoiseSynth;
    pitStop?: Tone.Synth;
    raceFinish?: Tone.PolySynth;
  } | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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
    try {
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
      if (type === 'fail' && synth instanceof Tone.NoiseSynth) {
          synth.triggerRelease(now); 
          synth.triggerAttackRelease("8n", now + 0.05); 
      } else if (synth instanceof Tone.Synth) {
        const note = type === 'event' ? "C4" : type === 'success' ? "G5" : "A3"; // A3 for pit
        const duration = type === 'pit' ? "1n" : "8n"; // Longer for pit
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
      : `Race Complete! Final Position: P${playerState.position}. Time: ${(playerState.playerTimeMs / 1000).toFixed(3)}s.`;

    setPlayerState(prev => ({ 
        ...prev, 
        lap: TOTAL_LAPS,
        lastEventMessage: finalMessage
    }));

    if (playerState.position === 1) {
        const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || playerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
        if (isTopScore) {
            setShowNicknameModal(true);
        }
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
    
    // Add base time for the segment *before* this new event, if it's the start of a new lap or the very first event.
    // This logic aims to add segment time when a lap boundary is crossed or at the very start.
    if (currentEventIndexRef.current === 0 || (nextEventToProcess && nextEventToProcess.lap > (prevEventConfig?.lap || 0))) {
        // Only add time if we are past lap 0 (i.e., not the absolute start of the race before any lap begins)
        // And if currentLapForPlayer has been initialized to > 0
        if (currentLapForPlayer > 0 && currentLapForPlayer <= TOTAL_LAPS) {
             newPlayerTime += PLAYER_BASE_LAP_TIME_MS + (newTireWear * TIRE_WEAR_TIME_PENALTY_FACTOR);
             newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
        }
    }
    
    currentLapForPlayer = nextEventToProcess ? nextEventToProcess.lap : currentLapForPlayer;

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: newPlayerTime,
      tireWear: newTireWear,
      lap: currentLapForPlayer // Update lap to the lap of the event we are about to process
    }));


    if (currentEventIndexRef.current >= RACE_EVENTS_CONFIG.length) {
      setGameState("calculating_results");
      // Add time for the final segment of the last lap
      let finalSegmentTime = PLAYER_BASE_LAP_TIME_MS + (playerState.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR); // Use current tire wear for this segment
       setPlayerState(prev => ({
        ...prev,
        playerTimeMs: prev.playerTimeMs + finalSegmentTime,
        lap: TOTAL_LAPS,
        tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP) 
      }));
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }

    const eventToDisplay = RACE_EVENTS_CONFIG[currentEventIndexRef.current];
    setCurrentEvent(eventToDisplay);
    setPlayerState(prev => ({...prev, lap: eventToDisplay.lap})); 

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
            if(gameStateRef.current === 'event_active') { // Ensure still in event_active to avoid double processing
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
    let positionChange = 0;

    const reactionTime = performance.now() - qteStartRef.current;
    const qteSuccess = !timedOut && (currentEvent.qteDurationMs ? reactionTime <= currentEvent.qteDurationMs : true);

    if (timedOut || !qteSuccess) { 
      playSound('fail');
      eventResultMessage = currentEvent.failureMessage || "Timed Out! Lost pace.";
      if (currentEvent.type === 'start_qte') { timeDeltaPlayer += TIME_START_BAD; positionChange = 1; }
      else if (currentEvent.type === 'overtake_qte') { timeDeltaPlayer += TIME_OVERTAKE_FAIL; }
      else if (currentEvent.type === 'defend_qte') { timeDeltaPlayer += TIME_DEFEND_FAIL; positionChange = 1; }
      else if (currentEvent.type === 'drs_qte') { timeDeltaPlayer += DRS_FAIL_PENALTY; }
    } else { // QTE Success or non-QTE decision
      playSound('success');
      eventResultMessage = currentEvent.successMessage;
      switch (currentEvent.type) {
        case 'start_qte':
            timeDeltaPlayer += TIME_START_GOOD;
            // No position change for good start, already P1
          break;
        case 'overtake_qte':
           timeDeltaPlayer += TIME_OVERTAKE_SUCCESS;
          break;
        case 'defend_qte':
           timeDeltaPlayer += TIME_DEFEND_SUCCESS;
          break;
        case 'drs_qte':
          timeDeltaPlayer += (playerState.tireWear < 55) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
          break;
        case 'pit_decision':
          playSound('pit'); // Override success sound with specific pit sound
          if (choice === currentEvent.options![0]) { 
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = "Pit stop complete! Fresh tires, but time lost in pits.";
          } else { 
            eventResultMessage = "Staying out. Tires will degrade further.";
          }
          break;
      }
    }
    
    const newPosition = Math.max(1, playerState.position + positionChange);

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
        playSound('success'); // GO sound
      } else {
        clearInterval(countdownInterval);
        if (gameStateRef.current === 'countdown') { // Ensure still in countdown
          processNextEvent(); 
        }
      }
    }, 1000);
  }, [clearTimers, processNextEvent, playSound]);

  const saveRaceScore = useCallback((nickname: string) => {
    if (!playerState.playerTimeMs || playerState.position !== 1) return; // Only save P1 times
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
    toast({ title: "P1 Time Saved!", description: `Fantastic race, ${nickname}!` });
  }, [playerState.playerTimeMs, playerState.position, leaderboard, toast]);

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

