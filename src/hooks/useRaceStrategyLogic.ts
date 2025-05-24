
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1_v2";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5;

// Difficulty and Realism Tuning
const PLAYER_BASE_LAP_TIME_MS = 19500; // Target for a very good lap
const TIRE_WEAR_PER_LAP = 22; // Higher wear
const TIRE_WEAR_PIT_RESET = 8; // Slight remaining wear after pit
const TIRE_WEAR_TIME_PENALTY_FACTOR = 60; // ms penalty per % of tire wear *per lap segment*

// Time adjustments (ms) - more impactful
const TIME_START_GOOD = -2000; // Bigger bonus for good start
const TIME_START_BAD = 2500;  // Bigger penalty for bad start
const TIME_OVERTAKE_SUCCESS = -2200;
const TIME_OVERTAKE_FAIL = 1800;
const TIME_DEFEND_SUCCESS = -800; // Smaller bonus, defense is about not losing time
const TIME_DEFEND_FAIL = 2800;  // Bigger penalty for failed defense
const TIME_PIT_STOP_COST = 8000; // Costly pit stop
const DRS_BONUS_GOOD_TIRES = -2000;
const DRS_BONUS_WORN_TIRES = -1000; // Less effective on worn
const DRS_FAIL_PENALTY = 1000;

const WEATHER_QTE_SUCCESS = -800;
const WEATHER_QTE_FAIL = 1500;
const MECHANICAL_SCARE_SUCCESS = -500;
const MECHANICAL_SCARE_FAIL = 2200;
const SAFETY_CAR_SUCCESS = -400; // Small bonus for good restart
const SAFETY_CAR_FAIL = 1200;
const YELLOW_FLAG_SUCCESS = -200; // Minimal gain for good reaction
const YELLOW_FLAG_FAIL = 2500; // Significant penalty
const COMPONENT_WARNING_SUCCESS = -300;
const COMPONENT_WARNING_FAIL = 2000;
const BLUE_FLAG_SUCCESS = -100; // Minimal gain
const BLUE_FLAG_FAIL = 1200; // Penalty for being held up


// Base event configurations - text will be dynamic
const BASE_RACE_EVENTS_CONFIG: Omit<RaceEvent, 'description' | 'actionText' | 'successMessage' | 'failureMessage'>[] = [
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 1800 },
  { id: 'evt_lap1_drs_early', lap: 1, type: 'drs_qte', qteDurationMs: 1000 },
  { id: 'evt_lap1_corners', lap: 1, type: 'defend_qte', qteDurationMs: 1500 },
  { id: 'evt_lap1_yellow', lap: 1, type: 'qte_generic', event_subtype: 'yellow_flag', qteDurationMs: 1300 },
  // Lap 2
  { id: 'evt_lap2_overtake_mid', lap: 2, type: 'overtake_qte', qteDurationMs: 1300 },
  { id: 'evt_lap2_pit', lap: 2, type: 'pit_decision', options: ["Pit for Fresh Tires", "Stay Out"] },
  { id: 'evt_lap2_drs', lap: 2, type: 'drs_qte', qteDurationMs: 900 },
  { id: 'evt_lap2_component', lap: 2, type: 'qte_generic', event_subtype: 'component_warning', qteDurationMs: 1600 },
  // Lap 3
  { id: 'evt_lap3_defend_hard', lap: 3, type: 'defend_qte', qteDurationMs: 1400 },
  { id: 'evt_lap3_weather', lap: 3, type: 'qte_generic', event_subtype: 'weather_drizzle', qteDurationMs: 1700 },
  { id: 'evt_lap3_blue_flags', lap: 3, type: 'qte_generic', event_subtype: 'blue_flags', qteDurationMs: 1400},
  { id: 'evt_lap3_drs_option', lap: 3, type: 'drs_qte', qteDurationMs: 950 },
  // Lap 4
  { id: 'evt_lap4_mechanical', lap: 4, type: 'qte_generic', event_subtype: 'mechanical_scare', qteDurationMs: 1400 },
  { id: 'evt_lap4_pit_late', lap: 4, type: 'pit_decision', options: ["Late Pit Gamble", "Risk it on Old Tires"] },
  { id: 'evt_lap4_drs_charge', lap: 4, type: 'drs_qte', qteDurationMs: 800 },
  { id: 'evt_lap4_overtake_late', lap: 4, type: 'overtake_qte', qteDurationMs: 1200 },
  // Lap 5
  { id: 'evt_lap5_safety_car', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', qteDurationMs: 1500 },
  { id: 'evt_lap5_drs_final', lap: 5, type: 'drs_qte', qteDurationMs: 700 },
  { id: 'evt_lap5_final_push', lap: 5, type: 'overtake_qte', qteDurationMs: 1100 },
  { id: 'evt_lap5_defend_finish', lap: 5, type: 'defend_qte', qteDurationMs: 1300 },
];

const INITIAL_PLAYER_STATE: PlayerRaceState = {
  lap: 0,
  position: 1,
  tireWear: 0,
  playerTimeMs: 0,
  lastEventMessage: null,
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
       // console.error(`Error playing sound type ${type}:`, e);
    }
  }, []);
  
  const generateDynamicEventTexts = (baseEvent: Omit<RaceEvent, 'description' | 'actionText' | 'successMessage' | 'failureMessage'>, currentPosition: number): Partial<RaceEvent> => {
    let dynamicTexts: Partial<RaceEvent> = {};
    const posP = `P${currentPosition}`;
    const targetPosP = currentPosition > 1 ? `P${currentPosition - 1}` : 'the lead';

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = "Race Start! Nail the launch!";
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "P1 Launch! Perfect getaway!";
            dynamicTexts.failureMessage = "Slow Start! Dropped positions.";
            break;
        case 'overtake_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = "Clear track ahead! Push to extend your P1 lead!";
                dynamicTexts.actionText = "Extend Lead!";
                dynamicTexts.successMessage = "Excellent pace! P1 lead increased.";
                dynamicTexts.failureMessage = "Pace dropped slightly, field closing in.";
            } else {
                dynamicTexts.description = `Opportunity! Attack ${targetPosP}!`;
                dynamicTexts.actionText = `Attack ${targetPosP}!`;
                dynamicTexts.successMessage = `Overtake Complete! Now ${posP === 'P2' ? 'P1' : `P${currentPosition -1}`}!`;
                dynamicTexts.failureMessage = `Attack failed! Couldn't make the move stick on ${targetPosP}.`;
            }
            break;
        case 'defend_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = "Pressure from behind! Defend P1!";
                dynamicTexts.actionText = "Defend P1!";
                dynamicTexts.successMessage = "Solid defense! P1 maintained.";
                dynamicTexts.failureMessage = "Overtaken! Dropped to P2.";
            } else {
                dynamicTexts.description = `Under pressure! Defend ${posP} from P${currentPosition + 1}!`;
                dynamicTexts.actionText = `Hold ${posP}!`;
                dynamicTexts.successMessage = `Position Held! Kept ${posP}.`;
                dynamicTexts.failureMessage = `Lost ${posP}! Dropped to P${currentPosition + 1}.`;
            }
            break;
        case 'drs_qte':
            dynamicTexts.description = `DRS Zone lap ${baseEvent.lap}! Maximize it!`;
            dynamicTexts.actionText = "Activate DRS!";
            dynamicTexts.successMessage = "DRS effective! Gaining time.";
            dynamicTexts.failureMessage = "DRS missed! Lost vital tenths.";
            break;
        case 'pit_decision':
            dynamicTexts.description = `Lap ${baseEvent.lap}: Pit window open. Tires: ${playerStateRef.current.tireWear}% worn. Strategy call?`;
            dynamicTexts.options = baseEvent.options; // Pit decision options are static
            // Success/Failure messages handled by choice in handleEventAction
            break;
        case 'qte_generic':
            switch(baseEvent.event_subtype) {
                case 'weather_drizzle':
                    dynamicTexts.description = "Light drizzle starts! Adapt your driving line!";
                    dynamicTexts.actionText = "Adapt to Drizzle";
                    dynamicTexts.successMessage = "Handled the slippery conditions well!";
                    dynamicTexts.failureMessage = "Struggled in the drizzle, lost time.";
                    break;
                case 'mechanical_scare':
                    dynamicTexts.description = "Mechanical issue detected! Quick system reset needed!";
                    dynamicTexts.actionText = "Reset Systems!";
                    dynamicTexts.successMessage = "Systems reset! Crisis averted for now.";
                    dynamicTexts.failureMessage = "Minor issue, but it cost valuable time.";
                    break;
                case 'safety_car_restart':
                    dynamicTexts.description = `Safety Car In This Lap! Get ready for the restart from ${posP}!`;
                    dynamicTexts.actionText = "Nail Restart!";
                    dynamicTexts.successMessage = `Great restart! Maintained ${posP}.`;
                    dynamicTexts.failureMessage = `Slow restart! Lost ground (potentially a position).`;
                    break;
                case 'yellow_flag':
                    dynamicTexts.description = "Yellow flags in next sector! React quickly and safely!";
                    dynamicTexts.actionText = "Slow for Yellows";
                    dynamicTexts.successMessage = "Good reaction to yellow flags.";
                    dynamicTexts.failureMessage = "Penalty risk! Didn't slow enough for yellows.";
                    break;
                case 'component_warning':
                    dynamicTexts.description = `Warning! ${posP} car has a component overheating! Nurse it or push?`;
                    dynamicTexts.actionText = "Manage Component";
                    dynamicTexts.successMessage = "Careful management, component holding!";
                    dynamicTexts.failureMessage = "Component issue worsened, significant time loss!";
                    break;
                case 'blue_flags':
                    dynamicTexts.description = `Blue flags for slower cars ahead! Navigate traffic from ${posP}.`;
                    dynamicTexts.actionText = "Clear Traffic";
                    dynamicTexts.successMessage = "Efficiently cleared the backmarkers!";
                    dynamicTexts.failureMessage = "Held up by traffic, lost momentum.";
                    break;
                default:
                    dynamicTexts.description = "Generic QTE Event!";
                    dynamicTexts.actionText = "React!";
                    dynamicTexts.successMessage = "QTE Success!";
                    dynamicTexts.failureMessage = "QTE Failed.";
            }
            break;
        default:
            dynamicTexts.description = "Upcoming event...";
            dynamicTexts.actionText = "Prepare";
            dynamicTexts.successMessage = "Event passed.";
            dynamicTexts.failureMessage = "Event challenge.";
    }
    return dynamicTexts;
  };
  
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
        playerTimeMs: finalPlayerState.playerTimeMs,
        position: finalPlayerState.position,
        lap: TOTAL_LAPS,
        lastEventMessage: finalMessage 
    }));

    // Only P1 times go on this leaderboard
    if (finalPlayerState.position === 1) {
        const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || finalPlayerState.playerTimeMs < (leaderboard[leaderboard.length - 1]?.time ?? Infinity);
        if (isTopScore) {
            setShowNicknameModal(true);
        }
    }
  }, [leaderboard, clearTimers, playSound]);

  const processNextEvent = useCallback(() => {
    clearTimers();
    if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;

    setGameState("lap_transition");
    
    let newPlayerTime = playerStateRef.current.playerTimeMs;
    let newTireWear = playerStateRef.current.tireWear;
    // Position change is handled by event outcomes, not here directly.
    // let newPosition = playerStateRef.current.position; 
    let currentLapForPlayer = playerStateRef.current.lap;
    let lastEventMsg = playerStateRef.current.lastEventMessage; // Carry over any pending message

    const baseEventConfig = BASE_RACE_EVENTS_CONFIG[currentEventIndexRef.current];

    if (baseEventConfig && baseEventConfig.lap > completedLapRef.current) {
      if (completedLapRef.current > 0) {
        newPlayerTime += PLAYER_BASE_LAP_TIME_MS;
        newPlayerTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
        newTireWear = Math.min(100, newTireWear + TIRE_WEAR_PER_LAP);
      }
      completedLapRef.current = baseEventConfig.lap;
      currentLapForPlayer = baseEventConfig.lap;
    }
    
    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: newPlayerTime,
      tireWear: newTireWear,
      lap: currentLapForPlayer,
      lastEventMessage: prev.lastEventMessage // Keep previous message until new one from event
    }));

    if (currentEventIndexRef.current >= BASE_RACE_EVENTS_CONFIG.length) {
      let finalLapCompletionTime = PLAYER_BASE_LAP_TIME_MS;
      finalLapCompletionTime += playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
      
      setPlayerState(prev => ({
        ...prev,
        playerTimeMs: prev.playerTimeMs + finalLapCompletionTime,
        tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP)
      }));
      
      setGameState("calculating_results");
      eventTimeoutRef.current = setTimeout(endRace, 1500);
      return;
    }
    
    const dynamicTexts = generateDynamicEventTexts(baseEventConfig, playerStateRef.current.position);
    const fullEvent: RaceEvent = {
        ...baseEventConfig,
        description: dynamicTexts.description || "Event description missing",
        actionText: dynamicTexts.actionText || "React!",
        successMessage: dynamicTexts.successMessage || "Success!",
        failureMessage: dynamicTexts.failureMessage || "Failed!",
        options: dynamicTexts.options || baseEventConfig.options, // For pit stops
    };
    setCurrentEvent(fullEvent);

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      
      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage}));
        eventTimeoutRef.current = setTimeout(processNextEvent, 2000);
      } else {
        setGameState("event_active");
        playSound('event');
        qteStartRef.current = performance.now();
        setEventTimer(0);

        if (fullEvent.qteDurationMs) {
          qteIntervalRef.current = setInterval(() => {
            if (gameStateRef.current !== 'event_active') {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              return;
            }
            const elapsed = performance.now() - qteStartRef.current;
            setEventTimer(Math.min(100, (elapsed / fullEvent.qteDurationMs!) * 100));
            if (elapsed >= fullEvent.qteDurationMs!) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              if(gameStateRef.current === 'event_active') {
                handleEventAction(undefined, true); 
              }
            }
          }, 50);
        }
      }
    }, 1200); // Slightly longer for lap transition text

    currentEventIndexRef.current++;

  }, [endRace, playSound, clearTimers]);


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    if (gameStateRef.current !== "event_active" || !currentEvent) return;
    clearTimers();

    let timeDeltaPlayer = 0;
    let newTireWear = playerStateRef.current.tireWear;
    let eventResultMessage = "";
    let positionChange = 0; // How many positions are gained (-) or lost (+)

    const reactionTime = performance.now() - qteStartRef.current;
    const qteSuccess = !timedOut && (currentEvent.qteDurationMs ? reactionTime <= currentEvent.qteDurationMs : true);

    if (timedOut || !qteSuccess) { 
      playSound('fail');
      eventResultMessage = currentEvent.failureMessage;
      // Penalties
      if (currentEvent.type === 'start_qte') { timeDeltaPlayer += TIME_START_BAD; positionChange = Math.random() < 0.5 ? 1 : 2; } // Lose 1 or 2 positions
      else if (currentEvent.type === 'overtake_qte') { timeDeltaPlayer += TIME_OVERTAKE_FAIL; /* No pos change on fail, just time loss */ }
      else if (currentEvent.type === 'defend_qte') { timeDeltaPlayer += TIME_DEFEND_FAIL; positionChange = 1; }
      else if (currentEvent.type === 'drs_qte') { timeDeltaPlayer += DRS_FAIL_PENALTY; }
      else if (currentEvent.type === 'qte_generic') {
        if (currentEvent.event_subtype === 'weather_drizzle') timeDeltaPlayer += WEATHER_QTE_FAIL;
        if (currentEvent.event_subtype === 'mechanical_scare') timeDeltaPlayer += MECHANICAL_SCARE_FAIL;
        if (currentEvent.event_subtype === 'safety_car_restart') { timeDeltaPlayer += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.3 ? 1: 0; } // Chance to lose a position
        if (currentEvent.event_subtype === 'yellow_flag') timeDeltaPlayer += YELLOW_FLAG_FAIL;
        if (currentEvent.event_subtype === 'component_warning') timeDeltaPlayer += COMPONENT_WARNING_FAIL;
        if (currentEvent.event_subtype === 'blue_flags') timeDeltaPlayer += BLUE_FLAG_FAIL;
      }
    } else { 
      playSound('success');
      eventResultMessage = currentEvent.successMessage;
      // Bonuses/Changes
      switch (currentEvent.type) {
        case 'start_qte': timeDeltaPlayer += TIME_START_GOOD; break; // Stay P1 or close
        case 'overtake_qte': 
            timeDeltaPlayer += TIME_OVERTAKE_SUCCESS; 
            if(playerStateRef.current.position > 1) positionChange = -1; // Gain a position if not P1
            break;
        case 'defend_qte': timeDeltaPlayer += TIME_DEFEND_SUCCESS; break; // Maintained position
        case 'drs_qte':
          timeDeltaPlayer += (playerStateRef.current.tireWear < 60) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES;
          break;
        case 'pit_decision':
          playSound('pit');
          if (choice === currentEvent.options![0]) { // Assuming first option is "Pit"
            timeDeltaPlayer += TIME_PIT_STOP_COST;
            newTireWear = TIRE_WEAR_PIT_RESET;
            eventResultMessage = `Pit stop! Fresh tires cost ${TIME_PIT_STOP_COST/1000}s. New wear: ${newTireWear}%.`;
            if (playerStateRef.current.position === 1 && TOTAL_LAPS - playerStateRef.current.lap <= 2) positionChange = Math.random() < 0.7 ? 1 : 0; // High chance to lose P1 if pitting late
            else if (playerStateRef.current.position < 3) positionChange = Math.random() < 0.4 ? 1 : 0; // Moderate chance

          } else { 
            eventResultMessage = `Staying out! Tires at ${playerStateRef.current.tireWear}%. Risk vs Reward.`;
          }
          break;
        case 'qte_generic':
          if (currentEvent.event_subtype === 'weather_drizzle') timeDeltaPlayer += WEATHER_QTE_SUCCESS;
          if (currentEvent.event_subtype === 'mechanical_scare') timeDeltaPlayer += MECHANICAL_SCARE_SUCCESS;
          if (currentEvent.event_subtype === 'safety_car_restart') timeDeltaPlayer += SAFETY_CAR_SUCCESS;
          if (currentEvent.event_subtype === 'yellow_flag') timeDeltaPlayer += YELLOW_FLAG_SUCCESS;
          if (currentEvent.event_subtype === 'component_warning') timeDeltaPlayer += COMPONENT_WARNING_SUCCESS;
          if (currentEvent.event_subtype === 'blue_flags') timeDeltaPlayer += BLUE_FLAG_SUCCESS;
          break;
      }
    }
    
    const newPosition = Math.max(1, playerStateRef.current.position + positionChange);

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDeltaPlayer,
      tireWear: newTireWear,
      position: newPosition,
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
    const finalPlayerState = playerStateRef.current;
    if (!finalPlayerState.playerTimeMs || finalPlayerState.position !== 1) return; // Only save P1 times
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
