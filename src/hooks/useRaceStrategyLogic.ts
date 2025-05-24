
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext"; // Added import

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1_v3_quali";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5;

const PLAYER_BASE_LAP_TIME_MS = 19500; 
const TIRE_WEAR_PER_LAP = 22; 
const TIRE_WEAR_PIT_RESET = 5; 
const TIRE_WEAR_TIME_PENALTY_FACTOR = 60; 

const TIME_START_GOOD = -2000;
const TIME_START_BAD = 3500; 
const TIME_OVERTAKE_SUCCESS = -2200; 
const TIME_OVERTAKE_FAIL = 2800; 
const TIME_DEFEND_SUCCESS = -1000; 
const TIME_DEFEND_FAIL = 3500; 
const TIME_PIT_STOP_COST = 8000; 
const DRS_BONUS_GOOD_TIRES = -1800; 
const DRS_BONUS_WORN_TIRES = -900; 
const DRS_FAIL_PENALTY = 1500; 

const WEATHER_QTE_SUCCESS = -800;
const WEATHER_QTE_FAIL = 2000;
const MECHANICAL_SCARE_SUCCESS = -500;
const MECHANICAL_SCARE_FAIL = 2800;
const SAFETY_CAR_SUCCESS = -400;
const SAFETY_CAR_FAIL = 1800;
const YELLOW_FLAG_SUCCESS = -200;
const YELLOW_FLAG_FAIL = 3000; 
const COMPONENT_WARNING_SUCCESS = -300;
const COMPONENT_WARNING_FAIL = 2500;
const BLUE_FLAG_SUCCESS = -100;
const BLUE_FLAG_FAIL = 1800;

const QUALIFYING_BASE_TIME_MS = 58000; 
const QTE_QUALIFYING_BONUS = -1800; 
const QTE_QUALIFYING_PENALTY = 2800; 

const QUALIFYING_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'q_evt1', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 1: Maximize entry speed!", actionText: "Full Commit!", qteDurationMs: 1100, successMessage: "Perfect entry, time gained!", failureMessage: "Overshot braking, lost precious tenths!" },
  { id: 'q_evt2', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 2: Smooth through the chicane!", actionText: "Thread the Needle!", qteDurationMs: 1000, successMessage: "Flawless chicane!", failureMessage: "Hit the kerb hard, unsettled car!" },
  { id: 'q_evt3', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 3: Perfect power application on exit!", actionText: "Launch Out!", qteDurationMs: 900, successMessage: "Monster exit, carried speed!", failureMessage: "Wheelspin on exit, lost momentum!" },
  { id: 'q_evt4', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Final Corner: DRS wide open, stick to the line!", actionText: "Pin It!", qteDurationMs: 800, successMessage: "Textbook final corner!", failureMessage: "Ran wide, scrubbed off speed!" },
];

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 1300 },
  { id: 'evt_lap1_drs_early', lap: 1, type: 'drs_qte', qteDurationMs: 700 },
  { id: 'evt_lap1_corners_tight', lap: 1, type: 'defend_qte', qteDurationMs: 1100 },
  { id: 'evt_lap1_yellow', lap: 1, type: 'qte_generic', event_subtype: 'yellow_flag', qteDurationMs: 1000, successMessage: "Good reaction to yellow flags.", failureMessage: "Penalty risk! Too fast under yellows." },
  // Lap 2
  { id: 'evt_lap2_overtake_mid', lap: 2, type: 'overtake_qte', qteDurationMs: 1000 },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', options: ["Pit for Fresh Tires", "Stay Out"] },
  { id: 'evt_lap2_component', lap: 2, type: 'qte_generic', event_subtype: 'component_warning', qteDurationMs: 1200, successMessage: "Careful management, component holding!", failureMessage: "Component issue worsened, significant time lost." },
  { id: 'evt_lap2_blueflags', lap: 2, type: 'qte_generic', event_subtype: 'blue_flags', qteDurationMs: 1100, successMessage: "Efficiently cleared backmarkers!", failureMessage: "Held up by slow traffic!" },
  // Lap 3
  { id: 'evt_lap3_defend_hard', lap: 3, type: 'defend_qte', qteDurationMs: 1000 },
  { id: 'evt_lap3_weather', lap: 3, type: 'qte_generic', event_subtype: 'weather_drizzle', qteDurationMs: 1300, successMessage: "Adapted well to the light drizzle!", failureMessage: "Struggled in the slippery conditions, lost pace." },
  { id: 'evt_lap3_drs_option', lap: 3, type: 'drs_qte', qteDurationMs: 650 },
  // Lap 4
  { id: 'evt_lap4_mechanical', lap: 4, type: 'qte_generic', event_subtype: 'mechanical_scare', qteDurationMs: 1100, successMessage: "Systems reset! Crisis averted, minimal time loss.", failureMessage: "Mechanical gremlin cost valuable seconds." },
  { id: 'evt_lap4_pit_late', lap: 4, type: 'pit_decision', options: ["Late Pit Gamble (Aggressive)", "Risk it on Old Tires (Conservative)"] },
  { id: 'evt_lap4_overtake_late', lap: 4, type: 'overtake_qte', qteDurationMs: 900 },
  // Lap 5
  { id: 'evt_lap5_safety_car', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', qteDurationMs: 1200 },
  { id: 'evt_lap5_drs_final', lap: 5, type: 'drs_qte', qteDurationMs: 600 },
  { id: 'evt_lap5_final_push_overtake', lap: 5, type: 'overtake_qte', qteDurationMs: 800 },
  { id: 'evt_lap5_defend_finish', lap: 5, type: 'defend_qte', qteDurationMs: 900 },
];


const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 0,
  tireWear: 0,
  playerTimeMs: 0,
  lastEventMessage: null,
  qualifyingTimeMs: null,
  startingPosition: null,
};

export function useRaceStrategyLogic() {
  const { isMuted } = useSound(); // Added
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
  const completedLapRef = useRef(0);

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
          } catch (e) { /* console.warn("Error disposing synth:", e); */ }
        });
        synthsRef.current = null; 
      }
    };
  }, [clearTimers]);

  const playSound = useCallback((type: 'event' | 'success' | 'fail' | 'pit' | 'finish') => {
    if (isMuted || !synthsRef.current) return; // Added isMuted check
    try {
      if (Tone.context.state !== 'running') Tone.start().catch(e => console.warn("Tone.start failed:", e));
      
      const synth = synthsRef.current?.[type];
      if (!synth || (synth as any).disposed) return;

      const now = Tone.now();
      const scheduleTime = now + 0.02;

      if (type === 'fail' && synth instanceof Tone.NoiseSynth) {
          synth.triggerRelease(now); 
          synth.triggerAttackRelease("8n", now + 0.05); 
      } else if (type === 'finish' && synth instanceof Tone.PolySynth) {
        synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "2n", scheduleTime);
      } else if (synth instanceof Tone.Synth) {
        const note = type === 'event' ? "C4" : type === 'success' ? "G5" : "A3"; // A3 for pit or other non-success/event
        const duration = type === 'pit' ? "1n" : "8n";
        synth.triggerAttackRelease(note, duration, scheduleTime);
      }
    } catch (e) {
       console.error(`Error playing sound type ${type}:`, e);
    }
  }, [isMuted]);
  
  const generateDynamicEventTexts = useCallback((baseEvent: RaceEvent, currentPosition: number): Partial<RaceEvent> => {
    let dynamicTexts: Partial<RaceEvent> = {
        description: baseEvent.description, // Default to base if not overridden
        actionText: baseEvent.actionText,
        successMessage: baseEvent.successMessage,
        failureMessage: baseEvent.failureMessage,
    };
    const posP = `P${currentPosition}`;
    const targetPosP = currentPosition > 1 ? `P${currentPosition - 1}` : 'the lead';
    const rivalPosP = `P${currentPosition + 1}`;

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = `Lights Out! Nail the start from ${playerStateRef.current.startingPosition ? 'P'+playerStateRef.current.startingPosition : 'your grid slot'}!`;
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "Great launch! Held position or gained!";
            dynamicTexts.failureMessage = "Slow start! Lost vital ground.";
            break;
        case 'overtake_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = "Clear track! Push to extend your P1 lead!";
                dynamicTexts.actionText = "Extend P1 Lead!";
                dynamicTexts.successMessage = "Excellent pace! P1 lead increased.";
                dynamicTexts.failureMessage = "Pace stagnated, rivals might be closing in.";
            } else {
                dynamicTexts.description = `Attack opportunity on ${targetPosP}!`;
                dynamicTexts.actionText = `Go for ${targetPosP}!`;
                dynamicTexts.successMessage = `Move Made! Up to ${targetPosP}!`;
                dynamicTexts.failureMessage = `Attack repelled! Couldn't make the move on ${targetPosP}.`;
            }
            break;
        case 'defend_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = `Pressure from ${rivalPosP}! Defend P1 with everything!`;
                dynamicTexts.actionText = "Defend P1!";
                dynamicTexts.successMessage = `Solid defense! P1 maintained against ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Overtaken! Dropped from P1 by ${rivalPosP}.`;
            } else {
                dynamicTexts.description = `Under attack from ${rivalPosP}! Defend ${posP}!`;
                dynamicTexts.actionText = `Hold ${posP}!`;
                dynamicTexts.successMessage = `Position Held! Kept ${posP} from ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Lost ${posP}! Dropped to ${rivalPosP}.`;
            }
            break;
        case 'drs_qte':
             dynamicTexts.description = currentPosition > 1 ? `DRS enabled! Close in on ${targetPosP}!` : "DRS active! Extend your lead!";
             dynamicTexts.actionText = "Activate DRS!";
             dynamicTexts.successMessage = "DRS effective! Good gain.";
             dynamicTexts.failureMessage = "DRS activation window missed!";
            break;
        case 'qte_generic':
            if (baseEvent.event_subtype === 'safety_car_restart') {
                dynamicTexts.description = `Safety Car In! Get ready for the restart from ${posP}!`;
                dynamicTexts.actionText = "Jump Restart!";
                dynamicTexts.successMessage = "Great restart, held or gained!";
                dynamicTexts.failureMessage = "Poor restart, lost ground!";
            }
            break;
        default: // Fallback for other types or if more specific logic isn't needed
            dynamicTexts.description = baseEvent.description;
            dynamicTexts.actionText = baseEvent.actionText || "React!";
    }
    return dynamicTexts;
  }, []);

  const determineQualifyingPosition = (qualifyingTimeMs: number): number => {
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 3500) return 1; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 1500) return 2; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 1000) return 3; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 3000) return 4; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 5000) return 5;
    return 6; // P6 or lower
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

    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'qualifying_result') return;

        setPlayerState(prev => ({
            ...INITIAL_PLAYER_STATE, // Reset most things
            qualifyingTimeMs: prev.qualifyingTimeMs, // Keep these from quali
            startingPosition: prev.startingPosition,
            position: prev.startingPosition || 6, // Set current race position
            lastEventMessage: `Race starting from P${prev.startingPosition || 6}...`
        }));
        currentEventIndexRef.current = 0; 
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
    }, 4000);
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
        position: finalPlayerState.position,
        lap: TOTAL_LAPS,
        lastEventMessage: finalMessage 
    }));

    if (finalPlayerState.position === 1) {
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
        } else { 
            let finalLapCompletionTime = PLAYER_BASE_LAP_TIME_MS;
            finalLapCompletionTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
            
            setPlayerState(prev => ({
                ...prev,
                playerTimeMs: prev.playerTimeMs + finalLapCompletionTime,
                tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP),
                lap: TOTAL_LAPS 
            }));
            setGameState("calculating_results");
            eventTimeoutRef.current = setTimeout(endRace, 1500);
        }
        return;
    }
    
    if (!isQualifying) {
        setGameState("lap_transition");
        const baseEventConfigForLapCheck = eventsConfig[currentEventIndexRef.current];
        let newPlayerTime = playerStateRef.current.playerTimeMs;
        let newTireWear = playerStateRef.current.tireWear;
        let currentLapForPlayer = playerStateRef.current.lap;

        if (baseEventConfigForLapCheck.lap > completedLapRef.current) {
            if (completedLapRef.current > 0) { 
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
    const fullEvent: RaceEvent = { ...baseEventConfig, ...dynamicTexts };
    setCurrentEvent(fullEvent);

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      
      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage}));
        eventTimeoutRef.current = setTimeout(processNextEvent, 2000);
      } else {
        setGameState(isQualifying ? "qualifying_lap" : "event_active");
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
    }, isQualifying ? 800 : 1200);

    currentEventIndexRef.current++;

  }, [endRace, playSound, clearTimers, generateDynamicEventTexts, calculateQualifyingResults]);


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    const currentPhase = gameStateRef.current;
    if ((currentPhase !== "event_active" && currentPhase !== "qualifying_lap") || !currentEvent) return;
    clearTimers();

    let timeDelta = 0;
    let newTireWear = playerStateRef.current.tireWear;
    let eventResultMessage = "";
    let positionChange = 0; 

    const reactionTime = performance.now() - qteStartRef.current;
    const qteSuccess = !timedOut && (currentEvent.qteDurationMs ? reactionTime <= currentEvent.qteDurationMs : true);

    if (currentPhase === "qualifying_lap") {
        if (qteSuccess) {
            timeDelta += QTE_QUALIFYING_BONUS;
            eventResultMessage = currentEvent.successMessage || "Quali QTE Success!";
            playSound('success');
        } else {
            timeDelta += QTE_QUALIFYING_PENALTY;
            eventResultMessage = currentEvent.failureMessage || "Quali QTE Failed!";
            playSound('fail');
        }
    } else { 
        if (timedOut || !qteSuccess) { 
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage || "Event Failed!";
            if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.7 ? 2 : 1; }
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
            else if (currentEvent.type === 'qte_generic') {
                if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_FAIL;
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.5 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else { 
            playSound('success');
            eventResultMessage = currentEvent.successMessage || "Event Success!";
            switch (currentEvent.type) {
                case 'start_qte': timeDelta += TIME_START_GOOD; if (playerStateRef.current.position > 1 && Math.random() < 0.4) positionChange = -1; break;
                case 'overtake_qte': timeDelta += TIME_OVERTAKE_SUCCESS; if(playerStateRef.current.position > 1) positionChange = -1; break;
                case 'defend_qte': timeDelta += TIME_DEFEND_SUCCESS; break;
                case 'drs_qte': timeDelta += (playerStateRef.current.tireWear < 70) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES; break;
                case 'pit_decision':
                    playSound('pit');
                    if (choice === currentEvent.options![0]) { 
                        timeDelta += TIME_PIT_STOP_COST;
                        newTireWear = TIRE_WEAR_PIT_RESET;
                        eventResultMessage = `Pit stop! Fresh tires. Cost: ${TIME_PIT_STOP_COST/1000}s. New wear: ${newTireWear}%.`;
                        if (playerStateRef.current.position <=3 && TOTAL_LAPS - playerStateRef.current.lap <= 2) positionChange = Math.random() < 0.85 ? 2 : 1; 
                        else if (playerStateRef.current.position < 5 ) positionChange = Math.random() < 0.6 ? 1 : 0; 
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
      playerTimeMs: prev.playerTimeMs + timeDelta,
      tireWear: newTireWear, 
      position: newCalculatedPosition, 
      lastEventMessage: eventResultMessage,
    }));
    
    processNextEvent();

  }, [currentEvent, processNextEvent, playSound, clearTimers]);


  const startGame = useCallback(() => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE); 
    playerStateRef.current = INITIAL_PLAYER_STATE;
    completedLapRef.current = 0;
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    
    setGameState("qualifying_lap"); 
    setPlayerState(prev => ({
        ...prev, 
        playerTimeMs: QUALIFYING_BASE_TIME_MS, 
        lastEventMessage: "Qualifying Lap: Get Ready!"
    }));
    playSound('event');
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
