
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1_v3_quali"; // Updated key for new structure
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5; // For the main race

// Difficulty and Realism Tuning for RACE
const PLAYER_BASE_LAP_TIME_MS = 20500; // Harder base time
const TIRE_WEAR_PER_LAP = 25;
const TIRE_WEAR_PIT_RESET = 10;
const TIRE_WEAR_TIME_PENALTY_FACTOR = 75; // More punishing

const TIME_START_GOOD = -1500;
const TIME_START_BAD = 3000;
const TIME_OVERTAKE_SUCCESS = -1800;
const TIME_OVERTAKE_FAIL = 2200;
const TIME_DEFEND_SUCCESS = -700;
const TIME_DEFEND_FAIL = 3000;
const TIME_PIT_STOP_COST = 9000; // More costly pit
const DRS_BONUS_GOOD_TIRES = -1500;
const DRS_BONUS_WORN_TIRES = -750;
const DRS_FAIL_PENALTY = 1200;

const WEATHER_QTE_SUCCESS = -700;
const WEATHER_QTE_FAIL = 1800;
const MECHANICAL_SCARE_SUCCESS = -400;
const MECHANICAL_SCARE_FAIL = 2500;
const SAFETY_CAR_SUCCESS = -300;
const SAFETY_CAR_FAIL = 1500;
const YELLOW_FLAG_SUCCESS = -150;
const YELLOW_FLAG_FAIL = 2800; // Very punishing
const COMPONENT_WARNING_SUCCESS = -250;
const COMPONENT_WARNING_FAIL = 2300;
const BLUE_FLAG_SUCCESS = -50;
const BLUE_FLAG_FAIL = 1500;

// Qualifying Specific Tuning
const QUALIFYING_BASE_TIME_MS = 60000; // Target for a good qualifying lap
const QTE_QUALIFYING_BONUS = -1500; // Time reduction for successful quali QTE
const QTE_QUALIFYING_PENALTY = 2500; // Time addition for failed quali QTE

const QUALIFYING_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'q_evt1', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 1: Nail the braking point!", actionText: "Brake Perfectly!", qteDurationMs: 1200, successMessage: "Great braking, time gained!", failureMessage: "Locked up, lost time!" },
  { id: 'q_evt2', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 2: Hit every apex!", actionText: "Apex Master!", qteDurationMs: 1100, successMessage: "Smooth through the corners!", failureMessage: "Ran wide, scrubbed speed!" },
  { id: 'q_evt3', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 3: Maximize traction on exit!", actionText: "Power Out!", qteDurationMs: 1000, successMessage: "Excellent exit, carried speed!", failureMessage: "Wheelspin, lost momentum!" },
  { id: 'q_evt4', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Final Corner: Perfect line to the finish!", actionText: "Commit!", qteDurationMs: 900, successMessage: "Flawless final corner!", failureMessage: "Messy exit, time lost!" },
];

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  // Dynamic text generation will adapt these based on starting position
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 1500, successMessage: "", failureMessage: "" }, // Messages set dynamically
  { id: 'evt_lap1_drs_early', lap: 1, type: 'drs_qte', qteDurationMs: 800, successMessage: "DRS effective, good gain!", failureMessage: "DRS activation missed!" },
  { id: 'evt_lap1_corners_tight', lap: 1, type: 'defend_qte', qteDurationMs: 1300, successMessage: "", failureMessage: "" },
  { id: 'evt_lap1_yellow', lap: 1, type: 'qte_generic', event_subtype: 'yellow_flag', qteDurationMs: 1100, successMessage: "Good reaction to yellows.", failureMessage: "Penalty risk! Too fast for yellows." },
  // Lap 2
  { id: 'evt_lap2_overtake_mid', lap: 2, type: 'overtake_qte', qteDurationMs: 1100, successMessage: "", failureMessage: "" },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', options: ["Pit for Fresh Tires", "Stay Out"], successMessage: "", failureMessage: "" }, // Outcome depends on choice
  { id: 'evt_lap2_component', lap: 2, type: 'qte_generic', event_subtype: 'component_warning', qteDurationMs: 1400, successMessage: "Careful management, component holding!", failureMessage: "Component issue worsened, time lost." },
  { id: 'evt_lap2_backmarkers', lap: 2, type: 'qte_generic', event_subtype: 'blue_flags', qteDurationMs: 1200, successMessage: "Efficiently cleared backmarkers!", failureMessage: "Held up by traffic!" },
  // Lap 3
  { id: 'evt_lap3_defend_hard', lap: 3, type: 'defend_qte', qteDurationMs: 1200, successMessage: "", failureMessage: "" },
  { id: 'evt_lap3_weather', lap: 3, type: 'qte_generic', event_subtype: 'weather_drizzle', qteDurationMs: 1500, successMessage: "Adapted well to the drizzle!", failureMessage: "Struggled in the slippery conditions." },
  { id: 'evt_lap3_drs_option', lap: 3, type: 'drs_qte', qteDurationMs: 750, successMessage: "DRS boost gained crucial time!", failureMessage: "DRS opportunity wasted." },
  // Lap 4
  { id: 'evt_lap4_mechanical', lap: 4, type: 'qte_generic', event_subtype: 'mechanical_scare', qteDurationMs: 1200, successMessage: "Systems reset! Crisis averted.", failureMessage: "Mechanical gremlin cost valuable time." },
  { id: 'evt_lap4_pit_late', lap: 4, type: 'pit_decision', options: ["Late Pit Gamble", "Risk it on Old Tires"], successMessage: "", failureMessage: "" },
  { id: 'evt_lap4_overtake_late', lap: 4, type: 'overtake_qte', qteDurationMs: 1000, successMessage: "", failureMessage: "" },
  // Lap 5
  { id: 'evt_lap5_safety_car', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', qteDurationMs: 1300, successMessage: "", failureMessage: "" },
  { id: 'evt_lap5_drs_final', lap: 5, type: 'drs_qte', qteDurationMs: 700, successMessage: "Final DRS push, maximum attack!", failureMessage: "Couldn't get DRS advantage." },
  { id: 'evt_lap5_final_push_overtake', lap: 5, type: 'overtake_qte', qteDurationMs: 900, successMessage: "", failureMessage: "" },
  { id: 'evt_lap5_defend_finish', lap: 5, type: 'defend_qte', qteDurationMs: 1100, successMessage: "", failureMessage: "" },
];


const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 0, // Will be set by qualifying
  tireWear: 0,
  playerTimeMs: 0, // Used for qualifying lap time, then reset for main race time
  lastEventMessage: null,
  qualifyingTimeMs: null,
  startingPosition: null,
};

export function useRaceStrategyLogic() {
  const [gameState, setGameState] = useState<RaceStrategyGameState>("idle");
  const gameStateRef = useRef(gameState);
  const [playerState, setPlayerState] = useState<PlayerRaceState>(INITIAL_PLAYER_STATE);
  const playerStateRef = useRef(playerState);

  const [currentEvent, setCurrentEvent] = useState<RaceEvent | null>(null);
  const [eventTimer, setEventTimer] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const eventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qteStartRef = useRef<number>(0);
  const currentEventIndexRef = useRef(0);
  const completedLapRef = useRef(0); // For main race lap timing

  const synthsRef = useRef<{
    eventTrigger?: Tone.Synth;
    qteSuccess?: Tone.Synth;
    qteFail?: Tone.NoiseSynth;
    pitStop?: Tone.Synth;
    raceFinish?: Tone.PolySynth;
  } | null>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  const clearTimers = useCallback(() => {
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    if (qteIntervalRef.current) clearInterval(qteIntervalRef.current);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !synthsRef.current) {
      try {
        synthsRef.current = {
          eventTrigger: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.1 } }).toDestination(),
          qteSuccess: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
          qteFail: new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 } }).toDestination(),
          pitStop: new Tone.Synth({ oscillator: { type: "square" }, volume: -10, envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.2 } }).toDestination(),
          raceFinish: new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 } }).toDestination(),
        };
      } catch (e) { console.error("Error initializing Tone.js synths:", e); synthsRef.current = null; }
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
      
      if (!synth || (synth as any).disposed) {
        // console.warn(`Synth for type ${type} is null or disposed.`);
        return;
      }

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
       console.error(`Error playing sound type ${type}:`, e);
    }
  }, []);
  
  const generateDynamicEventTexts = useCallback((baseEvent: RaceEvent, currentPosition: number): Partial<RaceEvent> => {
    let dynamicTexts: Partial<RaceEvent> = {
        successMessage: baseEvent.successMessage, // Default success/failure
        failureMessage: baseEvent.failureMessage,
    };
    const posP = `P${currentPosition}`;
    const targetPosP = currentPosition > 1 ? `P${currentPosition - 1}` : 'the lead';
    const rivalPosP = `P${currentPosition + 1}`;

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = "Lights Out! Nail the start!";
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "Great launch! Held position or gained!";
            dynamicTexts.failureMessage = "Slow start! Lost ground.";
            break;
        case 'overtake_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = "Clear track! Push to extend your P1 lead!";
                dynamicTexts.actionText = "Extend Lead!";
                dynamicTexts.successMessage = "Excellent pace! P1 lead increased.";
                dynamicTexts.failureMessage = "Pace stagnated, field might be closing.";
            } else {
                dynamicTexts.description = `Opportunity! Attack ${targetPosP}!`;
                dynamicTexts.actionText = `Attack for ${targetPosP}!`;
                dynamicTexts.successMessage = `Overtake Complete! Up to ${targetPosP}!`;
                dynamicTexts.failureMessage = `Attack repelled! Couldn't make the move on ${targetPosP}.`;
            }
            break;
        case 'defend_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = `Pressure from ${rivalPosP}! Defend P1 vigorously!`;
                dynamicTexts.actionText = "Defend P1!";
                dynamicTexts.successMessage = `Solid defense! P1 maintained against ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Overtaken! Dropped from P1 by ${rivalPosP}.`;
            } else {
                dynamicTexts.description = `Under pressure from ${rivalPosP}! Defend ${posP}!`;
                dynamicTexts.actionText = `Hold ${posP}!`;
                dynamicTexts.successMessage = `Position Held! Kept ${posP} from ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Lost ${posP}! Dropped to ${rivalPosP}.`;
            }
            break;
        // Other event types like drs_qte, qte_generic, pit_decision use their predefined messages mostly
        // but could be expanded similarly if needed.
        default:
            dynamicTexts.description = baseEvent.description;
            dynamicTexts.actionText = baseEvent.actionText;
    }
    return dynamicTexts;
  }, []);

  const determineQualifyingPosition = (qualifyingTimeMs: number): number => {
    // More challenging brackets for starting position
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 3000) return 1; // Pole
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 1000) return 2; // P2
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 1500) return 3; // P3
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 3500) return 4; // P4
    return 5; // P5 or lower
  };
  
  const calculateQualifyingResults = useCallback(() => {
    const qTime = playerStateRef.current.playerTimeMs;
    const startPos = determineQualifyingPosition(qTime);
    
    setPlayerState(prev => ({
        ...prev,
        qualifyingTimeMs: qTime,
        startingPosition: startPos,
        lastEventMessage: `Qualifying Complete! Time: ${(qTime / 1000).toFixed(3)}s. Starting P${startPos}.`
    }));
    setGameState("qualifying_result");

    // Transition to race countdown after a delay
    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'qualifying_result') return;

        // Reset for the main race
        setPlayerState(prev => ({
            ...prev,
            lap: 0, // Start from lap 0, first transition will make it 1
            position: prev.startingPosition || 3, // Use determined start position
            tireWear: 0,
            playerTimeMs: 0, // Reset race time
            lastEventMessage: `Race starting from P${prev.startingPosition || 3}...`
        }));
        currentEventIndexRef.current = 0; // Reset for RACE_EVENTS_CONFIG
        completedLapRef.current = 0;
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

    }, 4000); // Show qualifying results for 4 seconds
  }, [playSound]);


  const endRace = useCallback(() => {
    clearTimers();
    setGameState("finished");
    playSound('finish');
    
    const finalPlayerState = playerStateRef.current;

    const finalMessage = finalPlayerState.position === 1 
      ? `P1 Finish! Your Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s`
      : `Race Complete! Final Position: P${finalPlayerState.position}. Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s.`;

    setPlayerState(prev => ({ 
        ...prev,
        // playerTimeMs is already final from the last lap calculation
        position: finalPlayerState.position,
        lap: TOTAL_LAPS,
        lastEventMessage: finalMessage 
    }));

    if (finalPlayerState.position === 1) { // Only P1 winning times are eligible for this leaderboard
        const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || finalPlayerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
        if (isTopScore) {
            setShowNicknameModal(true);
        }
    }
  }, [leaderboard, clearTimers, playSound]);

  const processNextEvent = useCallback(() => {
    clearTimers();
    const currentPhase = gameStateRef.current;

    if (currentPhase === 'finished' || currentPhase === 'calculating_results') return;

    const isQualifying = currentPhase === 'qualifying_lap';
    const eventsConfig = isQualifying ? QUALIFYING_EVENTS_CONFIG : RACE_EVENTS_CONFIG;

    if (currentEventIndexRef.current >= eventsConfig.length) {
        if (isQualifying) {
            calculateQualifyingResults();
        } else { // End of Race events
            let finalLapCompletionTime = PLAYER_BASE_LAP_TIME_MS;
            finalLapCompletionTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
            
            setPlayerState(prev => ({
                ...prev,
                playerTimeMs: prev.playerTimeMs + finalLapCompletionTime,
                tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP),
                lap: TOTAL_LAPS // Explicitly set to final lap
            }));
            setGameState("calculating_results");
            eventTimeoutRef.current = setTimeout(endRace, 1500);
        }
        return;
    }
    
    // For race phase, handle lap transitions and base time/wear
    if (!isQualifying) {
        setGameState("lap_transition");
        const baseEventConfigForLapCheck = eventsConfig[currentEventIndexRef.current];
        let newPlayerTime = playerStateRef.current.playerTimeMs;
        let newTireWear = playerStateRef.current.tireWear;
        let currentLapForPlayer = playerStateRef.current.lap;

        if (baseEventConfigForLapCheck.lap > completedLapRef.current) {
            if (completedLapRef.current > 0) { // Add time for the lap just completed
                newPlayerTime += PLAYER_BASE_LAP_TIME_MS;
                newPlayerTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
                newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
            }
            completedLapRef.current = baseEventConfigForLapCheck.lap;
            currentLapForPlayer = baseEventConfigForLapCheck.lap;
            setPlayerState(prev => ({ ...prev, lastEventMessage: `Starting Lap ${currentLapForPlayer}...`}));
        }
        setPlayerState(prev => ({
            ...prev,
            playerTimeMs: newPlayerTime,
            tireWear: newTireWear,
            lap: currentLapForPlayer,
        }));
    }


    const baseEventConfig = eventsConfig[currentEventIndexRef.current];
    const dynamicTexts = generateDynamicEventTexts(baseEventConfig, playerStateRef.current.position);
    const fullEvent: RaceEvent = {
        ...baseEventConfig,
        description: dynamicTexts.description || baseEventConfig.description,
        actionText: dynamicTexts.actionText || baseEventConfig.actionText,
        successMessage: dynamicTexts.successMessage || baseEventConfig.successMessage,
        failureMessage: dynamicTexts.failureMessage || baseEventConfig.failureMessage,
    };
    setCurrentEvent(fullEvent);

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      
      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage}));
        eventTimeoutRef.current = setTimeout(processNextEvent, 2000);
      } else {
        setGameState(isQualifying ? "qualifying_lap" : "event_active"); // Stay in qualifying_lap or move to event_active
        playSound('event');
        qteStartRef.current = performance.now();
        setEventTimer(0);

        if (fullEvent.qteDurationMs) {
          qteIntervalRef.current = setInterval(() => {
            const currentPhaseCheck = gameStateRef.current;
            if (currentPhaseCheck !== (isQualifying ? "qualifying_lap" : "event_active")) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              return;
            }
            const elapsed = performance.now() - qteStartRef.current;
            setEventTimer(Math.min(100, (elapsed / fullEvent.qteDurationMs!) * 100));
            if (elapsed >= fullEvent.qteDurationMs!) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              if(gameStateRef.current === (isQualifying ? "qualifying_lap" : "event_active")) {
                handleEventAction(undefined, true); 
              }
            }
          }, 50);
        }
      }
    }, isQualifying ? 800 : 1200); // Shorter delay for quali events

    currentEventIndexRef.current++;

  }, [endRace, playSound, clearTimers, generateDynamicEventTexts, calculateQualifyingResults]);


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    const currentPhase = gameStateRef.current;
    if ((currentPhase !== "event_active" && currentPhase !== "qualifying_lap") || !currentEvent) return;
    clearTimers();

    let timeDelta = 0; // For both qualifying and race, playerTimeMs is used as the accumulator for the current phase
    let newTireWear = playerStateRef.current.tireWear;
    let eventResultMessage = "";
    let positionChange = 0; 

    const reactionTime = performance.now() - qteStartRef.current;
    const qteSuccess = !timedOut && (currentEvent.qteDurationMs ? reactionTime <= currentEvent.qteDurationMs : true);

    if (currentPhase === "qualifying_lap") {
        if (qteSuccess) {
            timeDelta += QTE_QUALIFYING_BONUS;
            eventResultMessage = currentEvent.successMessage;
            playSound('success');
        } else {
            timeDelta += QTE_QUALIFYING_PENALTY;
            eventResultMessage = currentEvent.failureMessage;
            playSound('fail');
        }
    } else { // Race Logic
        if (timedOut || !qteSuccess) { 
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage;
            if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.6 ? 2 : 1; } // Lose 1 or 2
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
            else if (currentEvent.type === 'qte_generic') {
                if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_FAIL;
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.4 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else { 
            playSound('success');
            eventResultMessage = currentEvent.successMessage;
            switch (currentEvent.type) {
                case 'start_qte': timeDelta += TIME_START_GOOD; if (playerStateRef.current.position > 1 && Math.random() < 0.3) positionChange = -1; break; // Chance to gain if not P1
                case 'overtake_qte': 
                    timeDelta += TIME_OVERTAKE_SUCCESS; 
                    if(playerStateRef.current.position > 1) positionChange = -1;
                    break;
                case 'defend_qte': timeDelta += TIME_DEFEND_SUCCESS; break;
                case 'drs_qte':
                    timeDelta += (playerStateRef.current.tireWear < 60) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
                    break;
                case 'pit_decision':
                    playSound('pit');
                    if (choice === currentEvent.options![0]) { 
                        timeDelta += TIME_PIT_STOP_COST;
                        newTireWear = TIRE_WEAR_PIT_RESET;
                        eventResultMessage = `Pit stop! Fresh tires. Cost: ${TIME_PIT_STOP_COST/1000}s. New wear: ${newTireWear}%.`;
                        // Position loss due to pit stop
                        if (playerStateRef.current.position <=3 && TOTAL_LAPS - playerStateRef.current.lap <= 2) positionChange = Math.random() < 0.8 ? 2 : 1; // High chance to lose 1 or 2 positions if pitting late from front
                        else if (playerStateRef.current.position < 5 ) positionChange = Math.random() < 0.5 ? 1 : 0; 
                    } else { 
                        eventResultMessage = `Staying out! Tires at ${playerStateRef.current.tireWear}%. Gambling on track position.`;
                    }
                    break;
                case 'qte_generic':
                    if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_SUCCESS;
                    if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_SUCCESS;
                    if (currentEvent.event_subtype === 'safety_car_restart') timeDelta += SAFETY_CAR_SUCCESS;
                    if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_SUCCESS;
                    if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_SUCCESS;
                    if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_SUCCESS;
                    break;
            }
        }
    }
    
    const newCalculatedPosition = currentPhase === "qualifying_lap" ? playerStateRef.current.position : Math.max(1, playerStateRef.current.position + positionChange);

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDelta, // This is quali lap time or race time depending on phase
      tireWear: newTireWear, // Only relevant for race
      position: newCalculatedPosition, // Only relevant for race, quali sets it at the end
      lastEventMessage: eventResultMessage,
    }));
    
    processNextEvent();

  }, [currentEvent, processNextEvent, playSound, clearTimers]);


  const startGame = useCallback(() => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE); // Resets all player state including times and positions
    playerStateRef.current = INITIAL_PLAYER_STATE;
    completedLapRef.current = 0;
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    
    setGameState("qualifying_lap"); // Start with qualifying
    setPlayerState(prev => ({
        ...prev, 
        playerTimeMs: QUALIFYING_BASE_TIME_MS, // Start quali timer from a base
        lastEventMessage: "Qualifying Lap: Get Ready!"
    }));
    playSound('event');
    // Initial call to processNextEvent will pick up the first qualifying QTE
    eventTimeoutRef.current = setTimeout(processNextEvent, 1500); 

  }, [clearTimers, processNextEvent, playSound]);

  const saveRaceScore = useCallback((nickname: string) => {
    const finalPlayerState = playerStateRef.current;
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
    toast({ title: "P1 Time Saved!", description: `Masterclass drive, ${nickname}!` });
  }, [leaderboard, toast]);

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

