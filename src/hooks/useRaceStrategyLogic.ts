
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, PlayerRaceState, RaceStrategyGameState, RaceEvent } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext";

const RACE_STRATEGY_LEADERBOARD_KEY = "apexRaceStrategyLeaderboard_P1_v3_quali";
const MAX_LEADERBOARD_ENTRIES = 10;
export const TOTAL_LAPS = 5;

// Difficulty & Realism Parameters
const QUALIFYING_BASE_TIME_MS = 58000; // Base time for a qualifying lap attempt
const PLAYER_BASE_LAP_TIME_MS = 19500; // Target for a good race lap (P1 pace)

const TIRE_WEAR_PER_LAP = 22; // % wear per lap
const TIRE_WEAR_PIT_RESET = 5; // % wear after a pit stop
const TIRE_WEAR_TIME_PENALTY_FACTOR = 60; // ms penalty per % of tire wear, per lap segment

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
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 650 },
  { id: 'evt_lap1_overtake_early', lap: 1, type: 'overtake_qte', qteDurationMs: 600},
  { id: 'evt_lap1_corners_tight', lap: 1, type: 'defend_qte', event_subtype: 'tight_corners', qteDurationMs: 750 },
  { id: 'evt_lap1_drs_zone_early', lap: 1, type: 'drs_qte', qteDurationMs: 300 },
  
  // Lap 2
  { id: 'evt_lap2_defend_pressure', lap: 2, type: 'defend_qte', qteDurationMs: 650 },
  { id: 'evt_lap2_weather_drizzle', lap: 2, type: 'qte_generic', event_subtype: 'weather_drizzle', description: "Sky darkens... Light drizzle starts!", actionText: "Adapt to Conditions!", qteDurationMs: 900, successMessage: "Adapted well to the light drizzle!", failureMessage: "Struggled in the slippery conditions, lost pace." },
  { id: 'evt_lap2_pit_window1', lap: 2, type: 'pit_decision', options: ["Pit for Hards", "Stay Out (Mediums)"] },
  { id: 'evt_lap2_blue_flags', lap: 2, type: 'qte_generic', event_subtype: 'blue_flags', description: "Approaching backmarkers!", actionText: "Navigate Traffic!", qteDurationMs: 700, successMessage: "Efficiently cleared backmarkers!", failureMessage: "Held up by slow traffic!" },

  // Lap 3
  { id: 'evt_lap3_overtake_midrace', lap: 3, type: 'overtake_qte', qteDurationMs: 550 },
  { id: 'evt_lap3_drs_long_straight', lap: 3, type: 'drs_qte', qteDurationMs: 280 },
  { id: 'evt_lap3_mechanical_scare', lap: 3, type: 'qte_generic', event_subtype: 'mechanical_scare', description: "Odd sound from the engine...", actionText: "Quick System Check!", qteDurationMs: 700, successMessage: "Systems reset! Crisis averted, minimal time loss.", failureMessage: "Mechanical gremlin cost valuable seconds." },
  { id: 'evt_lap3_yellow_flag_debris', lap: 3, type: 'qte_generic', event_subtype: 'yellow_flag', description: "Yellow flags! Debris on track!", actionText: "Slow Safely!", qteDurationMs: 600, successMessage: "Good reaction to yellow flags for debris.", failureMessage: "Penalty risk! Too fast through debris zone." },

  // Lap 4
  { id: 'evt_lap4_defend_late_braking', lap: 4, type: 'defend_qte', qteDurationMs: 600 },
  { id: 'evt_lap4_pit_window2', lap: 4, type: 'pit_decision', options: ["Pit for Softs (Aggressive)", "Stay Out (Worn Tires)"] },
  { id: 'evt_lap4_component_warning', lap: 4, type: 'qte_generic', event_subtype: 'component_warning', description: "Engineer: 'Component temps rising!'", actionText: "Nurse Component!", qteDurationMs: 800, successMessage: "Careful management, component holding!", failureMessage: "Component issue worsened, significant time lost." },
  { id: 'evt_lap4_drs_train', lap: 4, type: 'drs_qte', qteDurationMs: 250 },

  // Lap 5
  { id: 'evt_lap5_safety_car_restart', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', description: "Safety Car Ending! Get ready for the restart!", actionText: "Jump Restart!", qteDurationMs: 700, successMessage: "Great restart, held position or gained!", failureMessage: "Poor restart, lost ground to rivals!"},
  { id: 'evt_lap5_overtake_final_laps', lap: 5, type: 'overtake_qte', qteDurationMs: 500, description: "Final lap push! Chance for a last-gasp move!" },
  { id: 'evt_lap5_drs_final_chance', lap: 5, type: 'drs_qte', qteDurationMs: 200 },
  { id: 'evt_lap5_defend_to_finish', lap: 5, type: 'defend_qte', qteDurationMs: 550, description: "Just hold on! Defend to the chequered flag!" },
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
  const completedLapTimeCalcRef = useRef(0); // Tracks the last lap for which base time/penalties are fully accounted

  const processNextEventRef = useRef<() => void>();

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
          countdown: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.01 } }).toDestination(),
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
       console.error(`Error playing sound type ${type}:`, e);
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
    const rivalPosP = currentPosition < 20 ? `P${currentPosition + 1}` : 'the car behind'; // Max 20 cars

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = `Lights Out! Nail the start from ${playerStateRef.current.startingPosition ? 'P'+playerStateRef.current.startingPosition : 'your grid slot'}!`;
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "Great launch! Held position or gained!";
            dynamicTexts.failureMessage = "Slow start! Lost vital ground.";
            break;
        case 'overtake_qte':
            if (currentPosition <= 1) { // Should be currentPosition === 1, but <=1 for safety
                dynamicTexts.description = baseEvent.description || `Clear track ahead! Push to extend your P1 lead!`;
                dynamicTexts.actionText = baseEvent.actionText || "Extend P1 Lead!";
                dynamicTexts.successMessage = baseEvent.successMessage || "Excellent pace! P1 lead increased.";
                dynamicTexts.failureMessage = baseEvent.failureMessage || "Pace stagnated, lost a bit of overall time.";
            } else {
                dynamicTexts.description = baseEvent.description || `Attack opportunity on ${targetPosP}! Seize the moment!`;
                dynamicTexts.actionText = baseEvent.actionText || `Go for ${targetPosP}!`;
                dynamicTexts.successMessage = baseEvent.successMessage || `Move Made! Successfully overtook for ${targetPosP}!`;
                dynamicTexts.failureMessage = baseEvent.failureMessage || `Attack repelled! Couldn't make the move on ${targetPosP}.`;
            }
            break;
        case 'defend_qte':
             if (baseEvent.event_subtype === 'tight_corners') {
                dynamicTexts.description = `Navigating a tight sequence of corners under pressure from ${rivalPosP}, currently ${posP}!`;
                dynamicTexts.actionText = "Hold the Line!";
                dynamicTexts.successMessage = `Masterful through the technical section, ${posP} maintained!`;
                dynamicTexts.failureMessage = `Lost rhythm in the tight section from ${posP}, position lost to ${rivalPosP}.`;
            } else if (currentPosition <= 1) { // Should be currentPosition === 1
                dynamicTexts.description = baseEvent.description || `Heavy pressure from ${rivalPosP}! Defend P1 with everything you've got!`;
                dynamicTexts.actionText = baseEvent.actionText || "Defend P1!";
                dynamicTexts.successMessage = baseEvent.successMessage || `Solid defense! P1 maintained against ${rivalPosP}.`;
                dynamicTexts.failureMessage = baseEvent.failureMessage || `Overtaken! Dropped from P1 by ${rivalPosP}.`;
            } else {
                dynamicTexts.description = baseEvent.description || `Under attack from ${rivalPosP}! Defend ${posP} fiercely!`;
                dynamicTexts.actionText = baseEvent.actionText || `Hold ${posP}!`;
                dynamicTexts.successMessage = baseEvent.successMessage || `Position Held! Kept ${posP} from ${rivalPosP}.`;
                dynamicTexts.failureMessage = baseEvent.failureMessage || `Lost ${posP}! Overtaken by ${rivalPosP}.`;
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
            break;
        case 'qte_generic': // Descriptions for these are now in RACE_EVENTS_CONFIG
            dynamicTexts.description = baseEvent.description || dynamicTexts.description;
            dynamicTexts.actionText = baseEvent.actionText || dynamicTexts.actionText;
            dynamicTexts.successMessage = baseEvent.successMessage || dynamicTexts.successMessage;
            dynamicTexts.failureMessage = baseEvent.failureMessage || dynamicTexts.failureMessage;
            break;
        default:
            dynamicTexts.description = baseEvent.description || "Event Occurs!";
            dynamicTexts.actionText = baseEvent.actionText || "React!";
    }
    return dynamicTexts;
  }, []);


  const endRace = useCallback(() => {
    clearTimers();
    // Ensure final lap's base time and penalties are added before declaring results
    if (playerStateRef.current.lap > 0 && completedLapTimeCalcRef.current < playerStateRef.current.lap) {
        setPlayerState(prev => {
            let lapTimePenalty = prev.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
            let finalTimeUpdate = PLAYER_BASE_LAP_TIME_MS + lapTimePenalty;
            return {
                ...prev,
                playerTimeMs: prev.playerTimeMs + finalTimeUpdate,
                // Tire wear for the last lap isn't strictly necessary to add here as race is over
            };
        });
        completedLapTimeCalcRef.current = playerStateRef.current.lap;
    }

    // Use a timeout to allow the final setPlayerState to apply before reading playerStateRef.current
    setTimeout(() => {
        const finalPlayerState = playerStateRef.current;
        const finalMessage = finalPlayerState.position === 1
          ? `P1 Finish! Your Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s`
          : `Race Complete! Final Position: P${finalPlayerState.position}. Time: ${(finalPlayerState.playerTimeMs / 1000).toFixed(3)}s.`;

        setPlayerState(prev => ({
            ...prev,
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
    }, 50); // Small delay to ensure state updates
  }, [leaderboard, playSound, clearTimers]);


  const calculateQualifyingResults = useCallback(() => {
    clearTimers();
    const qTime = playerStateRef.current.playerTimeMs; // This is the accumulated qualifying time

    let startPos = 8; // Default to a lower position
    if (qTime <= QUALIFYING_BASE_TIME_MS - 6000) startPos = 1; // Pole
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 4500) startPos = 2;
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 3000) startPos = 3;
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 1500) startPos = 4;
    else if (qTime <= QUALIFYING_BASE_TIME_MS) startPos = 5;
    else if (qTime <= QUALIFYING_BASE_TIME_MS + 1500) startPos = 6;
    else if (qTime <= QUALIFYING_BASE_TIME_MS + 3000) startPos = 7;


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
            ...INITIAL_PLAYER_STATE, // Reset for race
            qualifyingTimeMs: prev.qualifyingTimeMs,
            startingPosition: prev.startingPosition,
            position: prev.startingPosition || 8, // Set initial race position
            lap: 0, // Start at lap 0 for the race, will increment to 1 on first race event
            lastEventMessage: `Race starting from P${prev.startingPosition || 8}...`
        }));
        currentEventIndexRef.current = 0; // Reset for race events
        completedLapTimeCalcRef.current = 0; // Reset for race laps

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
    }, 4000);
  }, [playSound, clearTimers]);


  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    clearTimers();
    const currentPhase = gameStateRef.current;
    if ((currentPhase !== "event_active" && currentPhase !== "qualifying_lap") || !currentEvent) return;

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
        if (timedOut && currentEvent.type !== 'pit_decision') {
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage || "Event Failed - Timed Out!";
            if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.8 ? 2 : 1; }
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
            else if (currentEvent.type === 'qte_generic') {
                if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_FAIL;
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.6 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else if (!qteSuccess && currentEvent.type !== 'pit_decision') { // QTE failed by action
            playSound('fail');
            eventResultMessage = currentEvent.failureMessage || "Event Failed!";
             if (currentEvent.type === 'start_qte') { timeDelta += TIME_START_BAD; positionChange = Math.random() < 0.8 ? 2 : 1; }
            else if (currentEvent.type === 'overtake_qte') { timeDelta += TIME_OVERTAKE_FAIL; }
            else if (currentEvent.type === 'defend_qte') { timeDelta += TIME_DEFEND_FAIL; positionChange = 1; }
            else if (currentEvent.type === 'drs_qte') { timeDelta += DRS_FAIL_PENALTY; }
             else if (currentEvent.type === 'qte_generic') {
                if (currentEvent.event_subtype === 'weather_drizzle') { timeDelta += WEATHER_QTE_FAIL; if (playerStateRef.current.tireWear > 70) timeDelta += 1500; }
                if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_FAIL;
                if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_FAIL; positionChange = Math.random() < 0.6 ? 1: 0; }
                if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_FAIL;
                if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_FAIL;
                if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_FAIL;
            }
        } else { // QTE Success OR Pit Decision
            if (currentEvent.type !== 'pit_decision') playSound('success');
            eventResultMessage = currentEvent.successMessage || "Event Success!";
            switch (currentEvent.type) {
                case 'start_qte': timeDelta += TIME_START_GOOD; if (playerStateRef.current.startingPosition && playerStateRef.current.startingPosition > 2 && Math.random() < 0.5) positionChange = -1; break;
                case 'overtake_qte': timeDelta += TIME_OVERTAKE_SUCCESS; if(playerStateRef.current.position > 1) positionChange = -1; break;
                case 'defend_qte': timeDelta += TIME_DEFEND_SUCCESS; break;
                case 'drs_qte': timeDelta += (playerStateRef.current.tireWear < 55) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES; break;
                case 'pit_decision':
                    playSound('pit');
                    const chosenOption = timedOut ? currentEvent.options![1] : choice; // Default to "Stay Out" if timed out
                    if (chosenOption === currentEvent.options![0]) { // "Pit for X"
                        timeDelta += TIME_PIT_STOP_COST;
                        newTireWear = TIRE_WEAR_PIT_RESET;
                        eventResultMessage = `Pit stop for ${chosenOption}! Cost: ${(TIME_PIT_STOP_COST/1000).toFixed(1)}s. New tire wear: ${newTireWear}%.`;
                        const lapsRemaining = TOTAL_LAPS - playerStateRef.current.lap;
                        if (playerStateRef.current.position <=3 && lapsRemaining <= 2) positionChange = Math.random() < 0.5 ? 2 : 1;
                        else if (playerStateRef.current.position < 7 ) positionChange = Math.random() < 0.3 ? 1 : 0;
                    } else { // "Stay Out"
                        eventResultMessage = `Staying out on ${currentEvent.options![1].split('(')[1].replace(')','')}! Current tire wear: ${playerStateRef.current.tireWear}%. Gambling on track position.`;
                        if (playerStateRef.current.tireWear > 70) timeDelta += 2500;
                        if (playerStateRef.current.tireWear > 85) timeDelta += 2000; // Extra penalty for very worn
                    }
                    break;
                case 'qte_generic':
                    if (currentEvent.event_subtype === 'weather_drizzle') timeDelta += WEATHER_QTE_SUCCESS;
                    if (currentEvent.event_subtype === 'mechanical_scare') timeDelta += MECHANICAL_SCARE_SUCCESS;
                    if (currentEvent.event_subtype === 'safety_car_restart') { timeDelta += SAFETY_CAR_SUCCESS; if (playerStateRef.current.position > 1 && Math.random() < 0.3) positionChange = -1;}
                    if (currentEvent.event_subtype === 'yellow_flag') timeDelta += YELLOW_FLAG_SUCCESS;
                    if (currentEvent.event_subtype === 'component_warning') timeDelta += COMPONENT_WARNING_SUCCESS;
                    if (currentEvent.event_subtype === 'blue_flags') timeDelta += BLUE_FLAG_SUCCESS;
                    break;
            }
        }
    }

    const newCalculatedPosition = currentPhase === "qualifying_lap"
        ? playerStateRef.current.position // Position doesn't change in quali QTEs
        : Math.max(1, Math.min(20, playerStateRef.current.position + positionChange)); // Cap at 20

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDelta,
      tireWear: newTireWear,
      position: newCalculatedPosition,
      lastEventMessage: eventResultMessage,
    }));

    currentEventIndexRef.current++; // Increment index AFTER processing current event

    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'finished' && gameStateRef.current !== 'calculating_results') {
            if (processNextEventRef.current) processNextEventRef.current();
        }
    }, 1800); // Delay to show event result message

  }, [currentEvent, playSound, clearTimers, generateDynamicEventTexts]); // Added generateDynamicEventTexts


  const processNextEventInternal = useCallback(() => {
    clearTimers();
    const currentPhase = gameStateRef.current;

    if (currentPhase === 'finished' || currentPhase === 'calculating_results') return;

    const isQualifying = currentPhase === 'qualifying_lap' || currentPhase === 'idle'; // idle means start of quali
    const eventsConfig = isQualifying ? QUALIFYING_EVENTS_CONFIG : RACE_EVENTS_CONFIG;

    if (currentEventIndexRef.current >= eventsConfig.length) {
        if (isQualifying && currentPhase === 'qualifying_lap') {
            calculateQualifyingResults();
        } else if (!isQualifying && currentPhase !== 'qualifying_result' && playerStateRef.current.lap >= TOTAL_LAPS) {
            endRace();
        }
        return;
    }

    const baseEventConfig = eventsConfig[currentEventIndexRef.current];

    if (!isQualifying) { // Race phase
        const currentLapInRace = playerStateRef.current.lap;
        const eventIsForLap = baseEventConfig.lap;

        // If this event starts a new lap, and the previous lap's base time hasn't been added
        if (eventIsForLap > currentLapInRace && currentLapInRace > 0 && completedLapTimeCalcRef.current < currentLapInRace) {
            setPlayerState(prev => {
                let lapTimePenalty = prev.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
                return {
                    ...prev,
                    playerTimeMs: prev.playerTimeMs + PLAYER_BASE_LAP_TIME_MS + lapTimePenalty,
                    tireWear: Math.min(100, prev.tireWear + TIRE_WEAR_PER_LAP), // Wear for the lap just completed
                };
            });
            completedLapTimeCalcRef.current = currentLapInRace;
        }
        // Update player's current lap display if this event belongs to a new lap for them
        if (eventIsForLap > currentLapInRace) {
            setPlayerState(prev => ({
                ...prev,
                lap: eventIsForLap,
                lastEventMessage: `Starting Lap ${eventIsForLap}...`
            }));
            setGameState("lap_transition"); // Show lap transition message
        } else {
             // If still on the same lap, or first event of the race after countdown
            if (gameStateRef.current !== "event_active") setGameState("event_active");
        }
    } else { // Qualifying phase
         if (gameStateRef.current !== "qualifying_lap") setGameState("qualifying_lap");
    }


    const dynamicTexts = generateDynamicEventTexts(baseEventConfig, playerStateRef.current.position);
    const fullEvent: RaceEvent = { ...baseEventConfig, ...dynamicTexts };
    setCurrentEvent(fullEvent);

    const displayDelay = (gameStateRef.current === "lap_transition" || (isQualifying && currentEventIndexRef.current === 0)) ? 1500 : 800;

    eventTimeoutRef.current = setTimeout(() => {
      const currentPhaseCheck = gameStateRef.current;
      if (currentPhaseCheck === 'finished' || currentPhaseCheck === 'calculating_results') return;

      // Transition from lap_transition to event_active for race, or ensure quali_lap
      if (currentPhaseCheck === "lap_transition") setGameState("event_active");
      else if (isQualifying && currentPhaseCheck !== "qualifying_lap") setGameState("qualifying_lap");


      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage || prev.lastEventMessage}));
        currentEventIndexRef.current++; // Advance after message displayed
        if (processNextEventRef.current) {
            eventTimeoutRef.current = setTimeout(processNextEventRef.current, 1200);
        }
      } else {
        playSound('event');
        qteStartRef.current = performance.now();
        setEventTimer(0);

        if (fullEvent.qteDurationMs) {
          qteIntervalRef.current = setInterval(() => {
            const activePhaseForQTE = gameStateRef.current === "event_active" || gameStateRef.current === "qualifying_lap";
            if (!activePhaseForQTE) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              return;
            }
            const elapsed = performance.now() - qteStartRef.current;
            const progress = Math.min(100, (elapsed / fullEvent.qteDurationMs!) * 100);
            setEventTimer(progress);

            if (elapsed >= fullEvent.qteDurationMs!) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              if(gameStateRef.current === "event_active" || gameStateRef.current === "qualifying_lap") { // Double check state
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
    if (Tone.context.state !== 'running') {
      try { await Tone.start(); } catch (e) { console.warn("Tone.start failed in startGame:", e); }
    }
    clearTimers();
    setPlayerState(INITIAL_PLAYER_STATE);
    setCurrentEvent(null);
    setShowNicknameModal(false);
    currentEventIndexRef.current = 0;
    completedLapTimeCalcRef.current = 0; // Reset for qualifying

    setGameState("qualifying_lap"); // Initial state before first quali event
    setPlayerState(prev => ({
        ...prev,
        playerTimeMs: QUALIFYING_BASE_TIME_MS, // Base time for qualifying, QTEs will modify this
        lap: 0, // Lap 0 for qualifying phase
        lastEventMessage: "Qualifying Lap: Get Ready!"
    }));

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
