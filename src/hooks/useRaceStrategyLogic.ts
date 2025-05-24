
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5; // Increased to 5 laps

// Adjusted time & tire constants for a 5-lap race
const PLAYER_BASE_LAP_TIME_MS = 22000; // Target for a good lap, slightly harder
const TIRE_WEAR_PER_LAP = 18; // Wear per completed lap
const TIRE_WEAR_PIT_RESET = 5; // Slight remaining wear after pit
const TIRE_WEAR_TIME_PENALTY_FACTOR = 35; // ms penalty per % of tire wear per lap

// Time adjustments in milliseconds for events
const TIME_START_GOOD = -1500;
const TIME_START_BAD = 2000;
const TIME_OVERTAKE_SUCCESS = -2000;
const TIME_OVERTAKE_FAIL = 1500;
const TIME_DEFEND_SUCCESS = -500;
const TIME_DEFEND_FAIL = 2200;
const TIME_PIT_STOP_COST = 7500; // Pit stops are more costly
const DRS_BONUS_GOOD_TIRES = -1800;
const DRS_BONUS_WORN_TIRES = -900;
const DRS_FAIL_PENALTY = 800;
const WEATHER_QTE_SUCCESS = -700;
const WEATHER_QTE_FAIL = 1200;
const MECHANICAL_SCARE_SUCCESS = -400;
const MECHANICAL_SCARE_FAIL = 1800;
const SAFETY_CAR_SUCCESS = -300;
const SAFETY_CAR_FAIL = 1000;


const RACE_EVENTS_CONFIG: RaceEvent[] = [
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', description: "Race Start! Nail the launch!", qteDurationMs: 2300, actionText: "Launch!", successMessage: "P1 Launch! Great start!", failureMessage: "Slow Start, dropped to P2." },
  { id: 'evt_lap1_drs_early', lap: 1, type: 'drs_qte', description: "Early DRS Zone! Maximize it!", qteDurationMs: 1200, actionText: "Activate DRS", successMessage: "DRS Boost! Gaining time.", failureMessage: "DRS Missed! Lost opportunity." },
  { id: 'evt_lap1_corners', lap: 1, type: 'defend_qte', description: "Tight Corner Sequence! Maintain control!", qteDurationMs: 1700, actionText: "Hold the Line!", successMessage: "Kept it smooth through the corners!", failureMessage: "Lost time in the chicane." },
  // Lap 2
  { id: 'evt_lap2_traffic', lap: 2, type: 'overtake_qte', description: "Backmarker traffic! Navigate cleanly.", qteDurationMs: 1600, actionText: "Pass Backmarker", successMessage: "Cleared traffic efficiently!", failureMessage: "Stuck behind backmarkers, lost time." },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', description: "Pit Window Open. Consider tire wear.", options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" },
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', description: "DRS Zone! Crucial for lap time.", qteDurationMs: 1100, actionText: "Activate DRS!", successMessage: "DRS Effective! Good pace.", failureMessage: "DRS Window Closed. Time lost." },
  // Lap 3
  { id: 'evt_lap3_defend', lap: 3, type: 'defend_qte', description: "Under pressure from the pack! Defend P1!", qteDurationMs: 1600, actionText: "Defend P1!", successMessage: "Position Maintained! Solid defense.", failureMessage: "Overtaken! Dropped a position." },
  { id: 'evt_lap3_weather', lap: 3, type: 'qte_generic', event_subtype: 'weather_drizzle', description: "Light Drizzle! Adapt your line!", qteDurationMs: 1800, actionText: "Adapt to Drizzle", successMessage: "Handled the drizzle well!", failureMessage: "Struggled in the light rain, lost time." },
  { id: 'evt_lap3_overtake', lap: 3, type: 'overtake_qte', description: "Opportunity to gain on P2! Attack!", qteDurationMs: 1400, actionText: "Attack P2!", successMessage: "Aggressive move! Pulled further ahead.", failureMessage: "Couldn't make the move stick." },
  // Lap 4
  { id: 'evt_lap4_mechanical', lap: 4, type: 'qte_generic', event_subtype: 'mechanical_scare', description: "Mechanical Scare! Quick System Reset!", qteDurationMs: 1500, actionText: "Reset Systems!", successMessage: "Systems Reset! Crisis averted.", failureMessage: "Minor issue cost some time." },
  { id: 'evt_lap4_drs', lap: 4, type: 'drs_qte', description: "Late race DRS, every bit counts!", qteDurationMs: 1000, actionText: "Activate DRS!", successMessage: "DRS used effectively!", failureMessage: "Late DRS chance missed." },
  { id: 'evt_lap4_tire_check', lap: 4, type: 'message_only', description: "Tires are significantly worn. Pit next lap or risk it?", successMessage: "Tires noted. Strategy is key.", failureMessage:""}, // Message only, no QTE
  // Lap 5
  { id: 'evt_lap5_safety_car', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', description: "Safety Car In! Perfect Restart Needed!", qteDurationMs: 1700, actionText: "Nail Restart!", successMessage: "Great restart, held P1!", failureMessage: "Slow restart, lost ground." },
  { id: 'evt_lap5_drs_final', lap: 5, type: 'drs_qte', description: "Final DRS Zone of the race!", qteDurationMs: 900, actionText: "Final DRS Push!", successMessage: "Final DRS optimal!", failureMessage: "Final DRS not maximized." },
  { id: 'evt_lap5_final_push', lap: 5, type: 'overtake_qte', description: "Final Lap Push! Every millisecond counts!", qteDurationMs: 1300, actionText: "Final Attack!", successMessage: "Maximum attack! Gained crucial tenths.", failureMessage: "Couldn't find extra pace in final sector." },
];


const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 1,
  tireWear: 0, // Starts fresh
  playerTimeMs: 0,
  lastEventMessage: null,
};


export function useRaceStrategyLogic() {
  const [gameState, setGameState] = useState<RaceStrategyGameState>("idle");
  const gameStateRef = useRef(gameState);
  const [playerState, setPlayerState] = useState<PlayerRaceState>(INITIAL_PLAYER_STATE);
  const playerStateRef = useRef(playerState); // Ref for playerState

  const [currentEvent, setCurrentEvent] = useState<RaceEvent | null>(null);
  const [eventTimer, setEventTimer] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const eventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qteStartRef = useRef<number>(0);
  const currentEventIndexRef = useRef(0);
  const completedLapRef = useRef(0); // To track completed laps for time addition

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

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

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
          try {
            if (synth && !(synth as any).disposed) synth.dispose();
          } catch (e) { /* console.error("Error disposing synth:", e); */ }
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
        const note = type === 'event' ? "C4" : type === 'success' ? "G5" : "A3";
        const duration = type === 'pit' ? "1n" : "8n";
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
    
    const finalPlayerState = playerStateRef.current; // Use the ref for the most up-to-date state

    const finalMessage = finalPlayerState.position === 1 
      ? `P1 Finish! Your Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s`
      : `Race Complete! Final Position: P${finalPlayerState.position}. Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s.`;

    setPlayerState(prev => ({ 
        ...prev, // Spread previous state to maintain other fields if any
        playerTimeMs: finalPlayerState.playerTimeMs, // Ensure this is the absolute final time
        position: finalPlayerState.position, // Ensure this is the final position
        lap: TOTAL_LAPS, // Explicitly set lap to total laps
        lastEventMessage: finalMessage 
    }));

    if (finalPlayerState.position === 1) {
        const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || finalPlayerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
        if (isTopScore) {
            setShowNicknameModal(true);
        }
    }
  }, [leaderboard, clearTimers, playSound]); // Removed playerState from deps, using ref

  const processNextEvent = useCallback(() => {
    clearTimers();
    if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;

    setGameState("lap_transition");
    
    let newPlayerTime = playerStateRef.current.playerTimeMs;
    let newTireWear = playerStateRef.current.tireWear;
    let newPosition = playerStateRef.current.position;
    let currentLapForPlayer = playerStateRef.current.lap;
    let lastEventMsg = playerStateRef.current.lastEventMessage;

    const eventToProcess = RACE_EVENTS_CONFIG[currentEventIndexRef.current];

    // Check if a lap has been completed
    if (eventToProcess && eventToProcess.lap > completedLapRef.current) {
      if (completedLapRef.current > 0) { // Don't add base time before lap 1
        newPlayerTime += PLAYER_BASE_LAP_TIME_MS;
        newPlayerTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
        newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
      }
      completedLapRef.current = eventToProcess.lap;
      currentLapForPlayer = eventToProcess.lap; // Update current lap for display
    }
    
    setPlayerState(prev => ({ // Update time, wear, lap before event display
      ...prev,
      playerTimeMs: newPlayerTime,
      tireWear: newTireWear,
      position: newPosition,
      lap: currentLapForPlayer,
      lastEventMessage: lastEventMsg // Carry over message from QTE handling
    }));

    if (currentEventIndexRef.current >= RACE_EVENTS_CONFIG.length) {
      // All events are done, means the final lap's events are processed.
      // Now, add the base time and tire penalty for completing the *final lap itself*.
      let finalLapCompletionTime = PLAYER_BASE_LAP_TIME_MS;
      finalLapCompletionTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR; // Use current wear for this final segment
      
      setPlayerState(prev => ({
        ...prev,
        playerTimeMs: prev.playerTimeMs + finalLapCompletionTime,
        tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP) // Wear for the final lap
      }));
      
      setGameState("calculating_results");
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }

    setCurrentEvent(eventToProcess);
    // lastEventMessage will be updated by handleEventAction

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      
      if (eventToProcess.type === 'message_only') {
        // For message_only events, just show the message and proceed
        setPlayerState(prev => ({...prev, lastEventMessage: eventToProcess.successMessage}));
        eventTimeoutRef.current = setTimeout(processNextEvent, 2000); // Show message for 2s
      } else {
        setGameState("event_active");
        playSound('event');
        qteStartRef.current = performance.now();
        setEventTimer(0);

        if (eventToProcess.qteDurationMs) {
          qteIntervalRef.current = setInterval(() => {
            if (gameStateRef.current !== 'event_active') {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              return;
            }
            const elapsed = performance.now() - qteStartRef.current;
            setEventTimer(Math.min(100, (elapsed / eventToProcess.qteDurationMs!) * 100));
            if (elapsed >= eventToProcess.qteDurationMs!) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              if(gameStateRef.current === 'event_active') {
                handleEventAction(undefined, true); 
              }
            }
          }, 50);
        }
      }
    }, 1000); // Delay before event becomes active or message shows

    currentEventIndexRef.current++;

  }, [endRace, playSound, clearTimers]); // processNextEvent does not depend on playerState directly now


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    if (gameStateRef.current !== "event_active" || !currentEvent) return;
    clearTimers();

    let timeDeltaPlayer = 0;
    let newTireWear = playerStateRef.current.tireWear; // Use ref for current value
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
      else if (currentEvent.type === 'qte_generic') {
        if (currentEvent.event_subtype === 'weather_drizzle') timeDeltaPlayer += WEATHER_QTE_FAIL;
        if (currentEvent.event_subtype === 'mechanical_scare') timeDeltaPlayer += MECHANICAL_SCARE_FAIL;
        if (currentEvent.event_subtype === 'safety_car_restart') { timeDeltaPlayer += SAFETY_CAR_FAIL; positionChange = 1;}
      }
    } else { 
      playSound('success');
      eventResultMessage = currentEvent.successMessage || "Good job!";
      switch (currentEvent.type) {
        case 'start_qte': timeDeltaPlayer += TIME_START_GOOD; break;
        case 'overtake_qte': timeDeltaPlayer += TIME_OVERTAKE_SUCCESS; break;
        case 'defend_qte': timeDeltaPlayer += TIME_DEFEND_SUCCESS; break;
        case 'drs_qte':
          timeDeltaPlayer += (playerStateRef.current.tireWear < 55) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
          break;
        case 'pit_decision':
          playSound('pit');
          if (choice === currentEvent.options![0]) { 
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = "Pit stop complete! Fresher tires, but time lost in pits.";
          } else { 
            eventResultMessage = "Staying out. Tires will degrade further.";
          }
          break;
        case 'qte_generic':
          if (currentEvent.event_subtype === 'weather_drizzle') timeDeltaPlayer += WEATHER_QTE_SUCCESS;
          if (currentEvent.event_subtype === 'mechanical_scare') timeDeltaPlayer += MECHANICAL_SCARE_SUCCESS;
          if (currentEvent.event_subtype === 'safety_car_restart') timeDeltaPlayer += SAFETY_CAR_SUCCESS;
          break;
      }
    }
    
    const newPosition = Math.max(1, playerStateRef.current.position + positionChange);

    setPlayerState(prev => ({ // Update player state based on event outcome
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDeltaPlayer,
      tireWear: newTireWear,
      position: newPosition,
      lastEventMessage: eventResultMessage,
    }));
    
    processNextEvent();

  }, [currentEvent, processNextEvent, playSound, clearTimers]); // handleEventAction does not depend on playerState directly


  const startGame = useCallback(() => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE); // Reset to initial
    playerStateRef.current = INITIAL_PLAYER_STATE; // Sync ref immediately
    completedLapRef.current = 0; // Reset completed lap counter
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
    const finalPlayerState = playerStateRef.current; // Use ref for final values
    if (!finalPlayerState.playerTimeMs || finalPlayerState.position !== 1) return;
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: Math.round(finalPlayerState.playerTimeMs),
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time) 
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(RACE_STRATEGY_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "P1 Time Saved!", description: `Fantastic race, ${nickname}!` });
  }, [leaderboard, toast]); // saveRaceScore does not depend on playerState directly

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
