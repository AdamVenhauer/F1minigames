
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext"; 

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1_v3_quali";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5; 

const PLAYER_BASE_LAP_TIME_MS = 19500; 
const TIRE_WEAR_PER_LAP = 22; 
const TIRE_WEAR_PIT_RESET = 5; 
const TIRE_WEAR_TIME_PENALTY_FACTOR = 60; 

// QTE Time Adjustments (Negative is good for player)
const TIME_START_GOOD = -3000; 
const TIME_START_BAD = 4500;  
const TIME_OVERTAKE_SUCCESS = -3200; 
const TIME_OVERTAKE_FAIL = 3800;  
const TIME_DEFEND_SUCCESS = -1800; 
const TIME_DEFEND_FAIL = 4200;  
const TIME_PIT_STOP_COST = 8000; 
const DRS_BONUS_GOOD_TIRES = -2500; 
const DRS_BONUS_WORN_TIRES = -1300; 
const DRS_FAIL_PENALTY = 2200;  

// Generic QTEs
const WEATHER_QTE_SUCCESS = -1200;
const WEATHER_QTE_FAIL = 2800;
const MECHANICAL_SCARE_SUCCESS = -900;
const MECHANICAL_SCARE_FAIL = 3600;
const SAFETY_CAR_SUCCESS = -800; 
const SAFETY_CAR_FAIL = 2500;
const YELLOW_FLAG_SUCCESS = -500;
const YELLOW_FLAG_FAIL = 3800; 
const COMPONENT_WARNING_SUCCESS = -600;
const COMPONENT_WARNING_FAIL = 3300;
const BLUE_FLAG_SUCCESS = -200;
const BLUE_FLAG_FAIL = 2200;

// Qualifying
const QUALIFYING_BASE_TIME_MS = 58000; 
const QTE_QUALIFYING_BONUS = -2500; 
const QTE_QUALIFYING_PENALTY = 3500; 

const QUALIFYING_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'q_evt1', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 1: Maximize entry speed!", actionText: "Full Commit!", qteDurationMs: 900, successMessage: "Perfect entry, time gained!", failureMessage: "Overshot braking, lost precious tenths!" },
  { id: 'q_evt2', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 2: Smooth through the chicane!", actionText: "Thread the Needle!", qteDurationMs: 800, successMessage: "Flawless chicane!", failureMessage: "Hit the kerb hard, unsettled car!" },
  { id: 'q_evt3', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Sector 3: Perfect power application on exit!", actionText: "Launch Out!", qteDurationMs: 700, successMessage: "Monster exit, carried speed!", failureMessage: "Wheelspin on exit, lost momentum!" },
  { id: 'q_evt4', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Final Corner: DRS wide open, stick to the line!", actionText: "Pin It!", qteDurationMs: 600, successMessage: "Textbook final corner!", failureMessage: "Ran wide, scrubbed off speed!" },
];

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 700 },
  { id: 'evt_lap1_overtake_early', lap: 1, type: 'overtake_qte', qteDurationMs: 650},
  { id: 'evt_lap1_corners_tight', lap: 1, type: 'defend_qte', event_subtype: 'tight_corners', qteDurationMs: 800 },
  { id: 'evt_lap1_drs_zone', lap: 1, type: 'drs_qte', qteDurationMs: 350 },
  
  // Lap 2
  { id: 'evt_lap2_defend_pressure', lap: 2, type: 'defend_qte', qteDurationMs: 700 },
  { id: 'evt_lap2_pit_window1', lap: 2, type: 'pit_decision', options: ["Pit for Hards", "Stay Out (Mediums)"] },
  { id: 'evt_lap2_weather_drizzle', lap: 2, type: 'qte_generic', event_subtype: 'weather_drizzle', qteDurationMs: 950, successMessage: "Adapted well to the light drizzle!", failureMessage: "Struggled in the slippery conditions, lost pace." },
  { id: 'evt_lap2_blue_flags', lap: 2, type: 'qte_generic', event_subtype: 'blue_flags', qteDurationMs: 750, successMessage: "Efficiently cleared backmarkers!", failureMessage: "Held up by slow traffic!" },
  
  // Lap 3
  { id: 'evt_lap3_overtake_midrace', lap: 3, type: 'overtake_qte', qteDurationMs: 600 },
  { id: 'evt_lap3_drs_long_straight', lap: 3, type: 'drs_qte', qteDurationMs: 300 },
  { id: 'evt_lap3_mechanical_scare', lap: 3, type: 'qte_generic', event_subtype: 'mechanical_scare', qteDurationMs: 750, successMessage: "Systems reset! Crisis averted, minimal time loss.", failureMessage: "Mechanical gremlin cost valuable seconds." },
  { id: 'evt_lap3_yellow_flag_debris', lap: 3, type: 'qte_generic', event_subtype: 'yellow_flag', qteDurationMs: 650, successMessage: "Good reaction to yellow flags for debris.", failureMessage: "Penalty risk! Too fast through debris zone." },

  // Lap 4
  { id: 'evt_lap4_defend_late_braking', lap: 4, type: 'defend_qte', qteDurationMs: 650 },
  { id: 'evt_lap4_pit_window2', lap: 4, type: 'pit_decision', options: ["Pit for Softs (Aggressive)", "Stay Out (Worn Tires)"] },
  { id: 'evt_lap4_component_warning', lap: 4, type: 'qte_generic', event_subtype: 'component_warning', qteDurationMs: 850, successMessage: "Careful management, component holding!", failureMessage: "Component issue worsened, significant time lost." },
  { id: 'evt_lap4_drs_train', lap: 4, type: 'drs_qte', qteDurationMs: 280 },

  // Lap 5
  { id: 'evt_lap5_safety_car_restart', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', qteDurationMs: 750 },
  { id: 'evt_lap5_overtake_final_laps', lap: 5, type: 'overtake_qte', qteDurationMs: 550 },
  { id: 'evt_lap5_drs_final_chance', lap: 5, type: 'drs_qte', qteDurationMs: 230 },
  { id: 'evt_lap5_defend_to_finish', lap: 5, type: 'defend_qte', qteDurationMs: 600 },
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
  const { isMuted } = useSound(); 
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
  // Tracks the last lap for which base time and penalties have been fully accounted and added.
  const completedLapTimeCalcRef = useRef(0); 


  const synthsRef = useRef<{
    eventTrigger?: Tone.Synth;
    qteSuccess?: Tone.Synth;
    qteFail?: Tone.NoiseSynth;
    pitStop?: Tone.Synth;
    raceFinish?: Tone.PolySynth;
    countdown?: Tone.Synth;
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
          countdown: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.01 }}).toDestination(),
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
          } catch (e) { /* ignore */ }
        });
        synthsRef.current = null; 
      }
    };
  }, [clearTimers]);

  const playSound = useCallback(async (type: 'event' | 'success' | 'fail' | 'pit' | 'finish' | 'countdown') => {
    if (typeof window === 'undefined') return;

    try {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    } catch (e) {
        console.warn(`Tone.start() failed in playSound (${type}):`, e);
        return; 
    }
    
    if (isMuted || !synthsRef.current) return;

    try {
      const synthConfig = synthsRef.current;
      let synthToPlay: Tone.Synth | Tone.NoiseSynth | Tone.PolySynth | undefined;

      switch (type) {
        case 'event': synthToPlay = synthConfig.eventTrigger; break;
        case 'success': synthToPlay = synthConfig.qteSuccess; break;
        case 'fail': synthToPlay = synthConfig.qteFail; break;
        case 'pit': synthToPlay = synthConfig.pitStop; break;
        case 'finish': synthToPlay = synthConfig.raceFinish; break;
        case 'countdown': synthToPlay = synthConfig.countdown; break;
      }
      
      if (!synthToPlay || (synthToPlay as any).disposed) {
        // console.warn(`Synth for type ${type} not found or disposed.`);
        return;
      }

      const now = Tone.now();
      const scheduleTime = now + 0.02;

      if (type === 'fail' && synthToPlay instanceof Tone.NoiseSynth) {
          synthToPlay.triggerRelease(now); 
          synthToPlay.triggerAttackRelease("8n", now + 0.05); 
      } else if (type === 'finish' && synthToPlay instanceof Tone.PolySynth) {
        synthToPlay.triggerAttackRelease(["C4", "E4", "G4", "C5"], "2n", scheduleTime);
      } else if (synthToPlay instanceof Tone.Synth) {
        const note = type === 'event' ? "C4" : type === 'success' ? "G5" : type === 'countdown' ? "C5" : "A3";
        const duration = type === 'pit' ? "1n" : "8n";
        synthToPlay.triggerAttackRelease(note, duration, scheduleTime);
      }
    } catch (e) {
       // console.error(`Error playing sound type ${type}:`, e);
    }
  }, [isMuted]);
  
  const generateDynamicEventTexts = useCallback((baseEvent: RaceEvent, currentPosition: number): Partial<RaceEvent> => {
    let dynamicTexts: Partial<RaceEvent> = {
        description: baseEvent.description,
        actionText: baseEvent.actionText,
        successMessage: baseEvent.successMessage,
        failureMessage: baseEvent.failureMessage,
    };
    const posP = `P${currentPosition}`;
    const targetPosP = currentPosition > 1 ? `P${currentPosition - 1}` : 'the lead';
    const rivalPosP = currentPosition < 20 ? `P${currentPosition + 1}` : 'the car behind';

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = `Lights Out! Nail the start from ${playerStateRef.current.startingPosition ? 'P'+playerStateRef.current.startingPosition : 'your grid slot'}!`;
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "Great launch! Held position or gained!";
            dynamicTexts.failureMessage = "Slow start! Lost vital ground.";
            break;
        case 'overtake_qte':
            if (currentPosition === 1) {
                dynamicTexts.description = "Clear track ahead! Push to extend your P1 lead!";
                dynamicTexts.actionText = "Extend P1 Lead!";
                dynamicTexts.successMessage = "Excellent pace! P1 lead increased.";
                dynamicTexts.failureMessage = "Pace stagnated, lost a bit of overall time.";
            } else {
                dynamicTexts.description = `Attack opportunity on ${targetPosP}! Seize the moment!`;
                dynamicTexts.actionText = `Go for ${targetPosP}!`;
                dynamicTexts.successMessage = `Move Made! Successfully overtook for ${targetPosP}!`;
                dynamicTexts.failureMessage = `Attack repelled! Couldn't make the move on ${targetPosP}.`;
            }
            break;
        case 'defend_qte':
             if (baseEvent.event_subtype === 'tight_corners') {
                dynamicTexts.description = `Navigating a tight sequence of corners under pressure from ${rivalPosP}, currently ${posP}!`;
                dynamicTexts.actionText = "Hold the Line!";
                dynamicTexts.successMessage = `Masterful through the technical section, ${posP} maintained!`;
                dynamicTexts.failureMessage = `Lost rhythm in the tight section from ${posP}, position lost to ${rivalPosP}.`;
            } else if (currentPosition === 1) {
                dynamicTexts.description = `Heavy pressure from ${rivalPosP}! Defend P1 with everything you've got!`;
                dynamicTexts.actionText = "Defend P1!";
                dynamicTexts.successMessage = `Solid defense! P1 maintained against ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Overtaken! Dropped from P1 by ${rivalPosP}.`;
            } else {
                dynamicTexts.description = `Under attack from ${rivalPosP}! Defend ${posP} fiercely!`;
                dynamicTexts.actionText = `Hold ${posP}!`;
                dynamicTexts.successMessage = `Position Held! Kept ${posP} from ${rivalPosP}.`;
                dynamicTexts.failureMessage = `Lost ${posP}! Overtaken by ${rivalPosP}.`;
            }
            break;
        case 'drs_qte':
             dynamicTexts.description = currentPosition > 1 ? `DRS enabled! Closing in on ${targetPosP}!` : "DRS active! Extend your P1 lead further!";
             dynamicTexts.actionText = "Activate DRS!";
             dynamicTexts.successMessage = "DRS effective! Good gain on track.";
             dynamicTexts.failureMessage = "DRS activation window missed! Opportunity lost.";
            break;
        case 'pit_decision':
            dynamicTexts.description = baseEvent.options?.[0]?.toLowerCase().includes("hards") ? 
                `Pit window open! Current position: ${posP}. Hards offer durability for a long stint. Your call!` :
                `Final pit window! Currently ${posP}. Softs for a late charge, or brave it on worn tires?`;
            // actionText will be the options themselves
            break;
        case 'qte_generic':
            if (baseEvent.event_subtype === 'safety_car_restart') {
                dynamicTexts.description = `Safety Car In! Get ready for the restart from ${posP}!`;
                dynamicTexts.actionText = "Jump Restart!";
                dynamicTexts.successMessage = "Great restart, held position or gained!";
                dynamicTexts.failureMessage = "Poor restart, lost ground to rivals!";
            } else if (baseEvent.event_subtype === 'weather_drizzle') {
                dynamicTexts.description = `Light drizzle starts to fall! Adapt your driving from ${posP}. Your tires might lose grip.`;
                dynamicTexts.actionText = "Adjust to Conditions!";
            } else if (baseEvent.event_subtype === 'mechanical_scare') {
                dynamicTexts.description = `Uh oh! A strange noise from the car in ${posP}... Engineer says 'Possible issue, quick check!'`;
                dynamicTexts.actionText = "Diagnose Issue!";
            } else if (baseEvent.event_subtype === 'yellow_flag') {
                dynamicTexts.description = `Yellow flags in the next sector! Incident ahead. React cautiously from ${posP}!`;
                dynamicTexts.actionText = "Caution!";
            } else if (baseEvent.event_subtype === 'component_warning') {
                dynamicTexts.description = `Engineer: 'We have a component warning, ${posP}. Manage it carefully to avoid failure.'`;
                dynamicTexts.actionText = "Nurse Component!";
            } else if (baseEvent.event_subtype === 'blue_flags') {
                dynamicTexts.description = `Blue flags! Faster car approaching to lap you from ${posP}. Let them pass cleanly.`;
                dynamicTexts.actionText = "Yield Position!";
            }
            break;
        default: 
            dynamicTexts.description = baseEvent.description || "Event Occurs!";
            dynamicTexts.actionText = baseEvent.actionText || "React!";
    }
    return dynamicTexts;
  }, []); // playerStateRef is used inside, but its .current doesn't trigger re-memoization. Relies on re-render.

  const determineQualifyingPosition = (qualifyingTimeMs: number): number => {
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 5000) return 1; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 3500) return 2; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS - 2000) return 3; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS ) return 4; 
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 1500) return 5;
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 3000) return 6;
    if (qualifyingTimeMs <= QUALIFYING_BASE_TIME_MS + 4500) return 7;
    return 8; 
  };
  
  const processNextEventRef = useRef<() => void>();

  const endRace = useCallback(() => {
    clearTimers();
    const finalPlayerState = playerStateRef.current; // Use ref for latest state
    const finalMessage = finalPlayerState.position === 1 
      ? `P1 Finish! Your Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s`
      : `Race Complete! Final Position: P${finalPlayerState.position}. Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s.`;

    setPlayerState(prev => ({ 
        ...prev, // Use prev to ensure it's based on the latest state before this update
        lap: TOTAL_LAPS, 
        lastEventMessage: finalMessage 
    }));
    setGameState("finished"); 
    playSound('finish');

    if (finalPlayerState.position === 1) {
        const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || 
                           (leaderboard.length > 0 && finalPlayerState.playerTimeMs < leaderboard[leaderboard.length - 1].time) ||
                           leaderboard.length === 0;
        if (isTopScore) {
            setShowNicknameModal(true);
        }
    }
  }, [leaderboard, playSound]); // Dependencies on stable functions/refs

  const calculateQualifyingResults = useCallback(() => {
    clearTimers();
    const qTime = playerStateRef.current.playerTimeMs;
    const startPos = determineQualifyingPosition(qTime);
    
    setPlayerState(prev => ({
        ...prev,
        qualifyingTimeMs: qTime,
        startingPosition: startPos,
        lastEventMessage: `Qualifying Complete! Time: ${(qTime / 1000).toFixed(3)}s. Starting P${startPos}.`
    }));
    setGameState("qualifying_result");
    playSound('finish');

    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'qualifying_result') return;
        
        setPlayerState(prev => ({
            ...INITIAL_PLAYER_STATE, 
            qualifyingTimeMs: prev.qualifyingTimeMs, 
            startingPosition: prev.startingPosition,
            position: prev.startingPosition || 8, // Set initial race position
            // lap will be 0, processNextEvent will set it to 1 for the first race event
            lastEventMessage: `Race starting from P${prev.startingPosition || 8}...`
        }));
        currentEventIndexRef.current = 0; // Reset for race events
        completedLapTimeCalcRef.current = 0; // Reset for race

        setGameState("countdown");

        let countdown = 3;
        setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
        playSound('countdown');
        const countdownInterval = setInterval(() => {
            if (gameStateRef.current !== 'countdown') { 
                 clearInterval(countdownInterval);
                 return;
            }
            countdown--;
            if (countdown > 0) {
                setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
                playSound('countdown');
            } else if (countdown === 0){
                setPlayerState(prev => ({...prev, lastEventMessage: `GO!`}));
                playSound('success'); 
            } else {
                clearInterval(countdownInterval);
                if (gameStateRef.current === 'countdown' && processNextEventRef.current) { 
                    processNextEventRef.current(); 
                }
            }
        }, 1000);
    }, 4000); // Time to display qualifying results
  }, [playSound]);


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
    } else { // Race phase
        if (timedOut && currentEvent.type !== 'pit_decision') { // Pit decision timeout means "Stay Out" effectively
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage || "Event Failed - Timed Out!";
            if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.7 ? 2 : 1; } 
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
            else if (currentEvent.type === 'qte_generic') { // Generic QTE timed out
                if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_FAIL;
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.7 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else if (!qteSuccess && currentEvent.type !== 'pit_decision') { // QTE failed by action, not timeout
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage || "Event Failed!";
             if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.7 ? 2 : 1; } 
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
             else if (currentEvent.type === 'qte_generic') {
                if (currentEvent.event_subtype === 'weather_drizzle') { timeDelta += WEATHER_QTE_FAIL; if (playerStateRef.current.tireWear > 70) timeDelta += 1500; } 
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.7 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else { // QTE Success OR Pit Decision
            if (currentEvent.type !== 'pit_decision') playSound('success'); // Pit sound handled in pit_decision
            eventResultMessage = currentEvent.successMessage || "Event Success!";
            switch (currentEvent.type) {
                case 'start_qte': timeDelta += TIME_START_GOOD; if (playerStateRef.current.startingPosition && playerStateRef.current.startingPosition > 3 && Math.random() < 0.6) positionChange = -1; break;
                case 'overtake_qte': timeDelta += TIME_OVERTAKE_SUCCESS; if(playerStateRef.current.position > 1) positionChange = -1; break;
                case 'defend_qte': timeDelta += TIME_DEFEND_SUCCESS; break;
                case 'drs_qte': timeDelta += (playerStateRef.current.tireWear < 60) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES; break; 
                case 'pit_decision':
                    playSound('pit');
                    const chosenOption = timedOut ? currentEvent.options![1] : choice; // Default to "Stay Out" if timed out
                    if (chosenOption === currentEvent.options![0]) { // "Pit for X"
                        timeDelta += TIME_PIT_STOP_COST;
                        newTireWear = TIRE_WEAR_PIT_RESET;
                        eventResultMessage = `Pit stop for ${chosenOption}! Cost: ${(TIME_PIT_STOP_COST/1000).toFixed(1)}s. New tire wear: ${newTireWear}%.`;
                        const lapsRemaining = TOTAL_LAPS - playerStateRef.current.lap;
                        if (playerStateRef.current.position <=3 && lapsRemaining <= 2) positionChange = Math.random() < 0.6 ? 2 : 1; 
                        else if (playerStateRef.current.position < 7 ) positionChange = Math.random() < 0.4 ? 1 : 0; 
                    } else { // "Stay Out"
                        eventResultMessage = `Staying out on ${chosenOption}! Current tire wear: ${playerStateRef.current.tireWear}%. Gambling on track position.`;
                        if (playerStateRef.current.tireWear > 75) timeDelta += 2500; 
                    }
                    break;
                case 'qte_generic':
                    if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_SUCCESS;
                    if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_SUCCESS;
                    if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_SUCCESS; if (playerStateRef.current.position > 1 && Math.random() < 0.4) positionChange = -1;}
                    if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_SUCCESS;
                    if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_SUCCESS;
                    if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_SUCCESS;
                    break;
            }
        }
    }
    
    const newCalculatedPosition = currentPhase === "qualifying_lap" 
        ? playerStateRef.current.position // Position doesn't change in quali QTEs
        : Math.max(1, playerStateRef.current.position + positionChange);

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDelta,
      tireWear: newTireWear, 
      position: newCalculatedPosition, 
      lastEventMessage: eventResultMessage,
    }));
    
    currentEventIndexRef.current++; // Increment after handling the current QTE/decision

    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'finished' && gameStateRef.current !== 'calculating_results') {
            if (processNextEventRef.current) processNextEventRef.current();
        }
    }, 1800); // Delay to show event result message

  }, [currentEvent, playSound, clearTimers]);


  const processNextEventInternal = useCallback(() => {
    clearTimers();
    const currentPhase = gameStateRef.current;

    if (currentPhase === 'finished' || currentPhase === 'calculating_results') return;

    const isQualifying = currentPhase === 'qualifying_lap';
    const eventsConfig = isQualifying ? QUALIFYING_EVENTS_CONFIG : RACE_EVENTS_CONFIG;
    
    // Handle end of qualifying or race
    if (currentEventIndexRef.current >= eventsConfig.length) {
        if (isQualifying) {
            calculateQualifyingResults();
        } else { // End of race
            // Add time for the final lap if not yet accounted for
            if (completedLapTimeCalcRef.current < TOTAL_LAPS) {
                 setPlayerState(prev => {
                    let lapTime = PLAYER_BASE_LAP_TIME_MS;
                    lapTime += prev.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
                    return {
                        ...prev,
                        playerTimeMs: prev.playerTimeMs + lapTime,
                        tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP),
                        lap: TOTAL_LAPS // Ensure lap is set to final
                    };
                });
                completedLapTimeCalcRef.current = TOTAL_LAPS;
            }
            setGameState("calculating_results");
            eventTimeoutRef.current = setTimeout(endRace, 1500);
        }
        return;
    }
    
    const baseEventConfig = eventsConfig[currentEventIndexRef.current];
    
    // Lap progression and time/wear accounting for race phase
    if (!isQualifying) {
        const lapOfThisEvent = baseEventConfig.lap;
        // If this event starts a new lap whose time hasn't been accounted for yet
        if (lapOfThisEvent > completedLapTimeCalcRef.current) {
            for (let lapToAccount = completedLapTimeCalcRef.current + 1; lapToAccount < lapOfThisEvent; lapToAccount++) {
                // This loop ensures we account for any laps between the last accounted one and the current event's lap
                // (e.g. if events for a lap were skipped or didn't exist)
                 setPlayerState(prev => {
                    let lapTime = PLAYER_BASE_LAP_TIME_MS;
                    lapTime += prev.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR; // Use wear before this lap's increment
                    return {
                        ...prev,
                        playerTimeMs: prev.playerTimeMs + lapTime,
                        tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP),
                    };
                });
                completedLapTimeCalcRef.current = lapToAccount;
            }
        }
        // Update player's current lap if this event belongs to a new lap for them
        if (lapOfThisEvent > playerStateRef.current.lap) {
            setPlayerState(prev => ({
                ...prev,
                lap: lapOfThisEvent,
                lastEventMessage: `Starting Lap ${lapOfThisEvent}...`
            }));
        }
    }

    const dynamicTexts = generateDynamicEventTexts(baseEventConfig, playerStateRef.current.position);
    const fullEvent: RaceEvent = { ...baseEventConfig, ...dynamicTexts };
    setCurrentEvent(fullEvent);

    // Set game state for event display (lap_transition for race, or active for qualifying/event)
    if (!isQualifying && playerStateRef.current.lastEventMessage && playerStateRef.current.lastEventMessage.startsWith("Starting Lap")) {
        setGameState("lap_transition"); 
    } else {
        setGameState(isQualifying ? "qualifying_lap" : "event_active");
    }
    
    const displayDelay = (gameStateRef.current === "lap_transition" || (isQualifying && currentEventIndexRef.current === 0)) ? 1500 : 800;

    eventTimeoutRef.current = setTimeout(() => {
      if (gameStateRef.current === 'finished' || gameStateRef.current === 'calculating_results') return;
      
      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage || prev.lastEventMessage}));
        currentEventIndexRef.current++; // Advance after message displayed
        if (processNextEventRef.current) {
            eventTimeoutRef.current = setTimeout(processNextEventRef.current, 1200); // Shorter delay for message_only
        }
      } else {
        setGameState(isQualifying ? "qualifying_lap" : "event_active"); // Ensure correct active state
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
              // Check gameState again because it might have changed due to other actions
              if(gameStateRef.current === (isQualifying ? "qualifying_lap" : "event_active")) {
                handleEventAction(undefined, true); // QTE timed out
              }
            }
          }, 50);
        }
      }
    }, displayDelay); 

  }, [
      calculateQualifyingResults, endRace, handleEventAction, 
      generateDynamicEventTexts, playSound, clearTimers
    ]);

  useEffect(() => {
    processNextEventRef.current = processNextEventInternal;
  }, [processNextEventInternal]);


  const startGame = useCallback(async () => {
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE); 
    completedLapTimeCalcRef.current = 0;
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    
    setGameState("qualifying_lap"); 
    setPlayerState(prev => ({ // Use functional update
        ...prev, 
        playerTimeMs: QUALIFYING_BASE_TIME_MS, // Base time for qualifying, QTEs will modify this
        lastEventMessage: "Qualifying Lap: Get Ready!"
    }));
    
    // Initial call to start processing qualifying events
    if (processNextEventRef.current) {
        eventTimeoutRef.current = setTimeout(processNextEventRef.current, 1500); // Delay before first quali event
    }

  }, [clearTimers]); 

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

