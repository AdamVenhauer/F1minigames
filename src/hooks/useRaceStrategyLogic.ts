
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
const QUALIFYING_BASE_TIME_MS = 60000; // Base time for a qualifying lap attempt
const PLAYER_BASE_LAP_TIME_MS = 19500; // Target for a good race lap (P1 pace)

const TIRE_WEAR_PER_LAP = 22; // % wear per lap
const TIRE_WEAR_PIT_RESET = 5; // % wear after a pit stop
const TIRE_WEAR_TIME_PENALTY_FACTOR = 60; // ms penalty per % of tire wear, per lap segment

// QTE Time Adjustments (Negative is good for player)
const TIME_START_GOOD = -2800;
const TIME_START_BAD = 5000;
const TIME_OVERTAKE_SUCCESS = -2500;
const TIME_OVERTAKE_FAIL = 4200;
const TIME_DEFEND_SUCCESS = -1500;
const TIME_DEFEND_FAIL = 4500;
const TIME_PIT_STOP_COST = 8000;
const DRS_BONUS_GOOD_TIRES = -2200;
const DRS_BONUS_WORN_TIRES = -1100;
const DRS_FAIL_PENALTY = 2500;

// Generic QTEs
const WEATHER_QTE_SUCCESS = -1000;
const WEATHER_QTE_FAIL = 3000;
const MECHANICAL_SCARE_SUCCESS = -800;
const MECHANICAL_SCARE_FAIL = 3800;
const SAFETY_CAR_SUCCESS = -700;
const SAFETY_CAR_FAIL = 2800;
const YELLOW_FLAG_SUCCESS = -400;
const YELLOW_FLAG_FAIL = 4000;
const COMPONENT_WARNING_SUCCESS = -500;
const COMPONENT_WARNING_FAIL = 3500;
const BLUE_FLAG_SUCCESS = -100;
const BLUE_FLAG_FAIL = 2500;
const QTE_QUALIFYING_BONUS = -2000;
const QTE_QUALIFYING_PENALTY = 3800;


const QUALIFYING_EVENTS_CONFIG: RaceEvent[] = [
  { id: 'q_evt1', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Quali Sector 1: Maximize entry!", actionText: "Full Commit!", qteDurationMs: 800, successMessage: "Perfect entry, time gained!", failureMessage: "Overshot braking, lost tenths!" },
  { id: 'q_evt2', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Quali Sector 2: Smooth chicane!", actionText: "Thread the Needle!", qteDurationMs: 700, successMessage: "Flawless chicane!", failureMessage: "Hit the kerb, unsettled car!" },
  { id: 'q_evt3', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Quali Sector 3: Power on exit!", actionText: "Launch Out!", qteDurationMs: 600, successMessage: "Monster exit, carried speed!", failureMessage: "Wheelspin, lost momentum!" },
  { id: 'q_evt4', lap: 1, type: 'qualifying_qte', event_subtype: 'hot_lap_sector', description: "Quali Final Corner: DRS open!", actionText: "Pin It!", qteDurationMs: 500, successMessage: "Textbook final corner!", failureMessage: "Ran wide, scrubbed speed!" },
];

const RACE_EVENTS_CONFIG: RaceEvent[] = [
  // Lap 1
  { id: 'evt_lap1_start', lap: 1, type: 'start_qte', qteDurationMs: 600 },
  { id: 'evt_lap1_overtake_early', lap: 1, type: 'overtake_qte', qteDurationMs: 550 },
  { id: 'evt_lap1_tight_corners', lap: 1, type: 'defend_qte', event_subtype: 'tight_corners', qteDurationMs: 700 },
  { id: 'evt_lap1_drs_zone_early', lap: 1, type: 'drs_qte', qteDurationMs: 280 },
  
  // Lap 2
  { id: 'evt_lap2_defend_pressure', lap: 2, type: 'defend_qte', qteDurationMs: 600 },
  { id: 'evt_lap2_weather_drizzle', lap: 2, type: 'qte_generic', event_subtype: 'weather_drizzle', description: "Sky darkens... Light drizzle starts!", actionText: "Adapt to Conditions!", qteDurationMs: 800, successMessage: "Adapted well to the light drizzle!", failureMessage: "Struggled in the slippery conditions, lost pace." },
  { id: 'evt_lap2_pit_window1', lap: 2, type: 'pit_decision', options: ["Pit for Hards", "Stay Out (Mediums)"] },
  { id: 'evt_lap2_blue_flags', lap: 2, type: 'qte_generic', event_subtype: 'blue_flags', description: "Approaching backmarkers!", actionText: "Navigate Traffic!", qteDurationMs: 650, successMessage: "Efficiently cleared backmarkers!", failureMessage: "Held up by slow traffic!" },

  // Lap 3
  { id: 'evt_lap3_overtake_midrace', lap: 3, type: 'overtake_qte', qteDurationMs: 500 },
  { id: 'evt_lap3_drs_long_straight', lap: 3, type: 'drs_qte', qteDurationMs: 250 },
  { id: 'evt_lap3_mechanical_scare', lap: 3, type: 'qte_generic', event_subtype: 'mechanical_scare', description: "Odd sound from the engine...", actionText: "Quick System Check!", qteDurationMs: 650, successMessage: "Systems reset! Crisis averted, minimal time loss.", failureMessage: "Mechanical gremlin cost valuable seconds." },
  { id: 'evt_lap3_yellow_flag_debris', lap: 3, type: 'qte_generic', event_subtype: 'yellow_flag', description: "Yellow flags! Debris on track!", actionText: "Slow Safely!", qteDurationMs: 550, successMessage: "Good reaction to yellow flags for debris.", failureMessage: "Penalty risk! Too fast through debris zone." },

  // Lap 4
  { id: 'evt_lap4_defend_late_braking', lap: 4, type: 'defend_qte', qteDurationMs: 550 },
  { id: 'evt_lap4_pit_window2', lap: 4, type: 'pit_decision', options: ["Pit for Softs (Aggressive)", "Stay Out (Worn Tires)"] },
  { id: 'evt_lap4_component_warning', lap: 4, type: 'qte_generic', event_subtype: 'component_warning', description: "Engineer: 'Component temps rising!'", actionText: "Nurse Component!", qteDurationMs: 750, successMessage: "Careful management, component holding!", failureMessage: "Component issue worsened, significant time lost." },
  { id: 'evt_lap4_drs_train', lap: 4, type: 'drs_qte', qteDurationMs: 220 },

  // Lap 5
  { id: 'evt_lap5_safety_car_restart', lap: 5, type: 'qte_generic', event_subtype: 'safety_car_restart', description: "Safety Car Ending! Get ready for the restart!", actionText: "Jump Restart!", qteDurationMs: 650, successMessage: "Great restart, held position or gained!", failureMessage: "Poor restart, lost ground to rivals!"},
  { id: 'evt_lap5_overtake_final_laps', lap: 5, type: 'overtake_qte', qteDurationMs: 450, description: "Final lap push! Chance for a last-gasp move!" },
  { id: 'evt_lap5_drs_final_chance', lap: 5, type: 'drs_qte', qteDurationMs: 180 },
  { id: 'evt_lap5_defend_to_finish', lap: 5, type: 'defend_qte', qteDurationMs: 500, description: "Just hold on! Defend to the chequered flag!" },
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
  const eventActiveRef = useRef(false); // Safeguard for QTE race conditions

  const currentEventIndexRef = useRef(0);
  const completedLapRef = useRef(0); 

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
      if (Tone.context.state === 'suspended') await Tone.start();
      if (Tone.context.state !== 'running') return;
    } catch (e) {
      console.warn(`Tone.start() failed in playSound (${type}):`, e);
      return;
    }

    if (isMuted || !synthsRef.current) return;

    try {
      const synthConfig = synthsRef.current;
      let synthToPlay: Tone.Synth | Tone.NoiseSynth | Tone.PolySynth | undefined;
      const now = Tone.now();
      const scheduleTime = now + 0.03; // Slightly increased offset

      switch (type) {
        case 'event': synthToPlay = synthConfig.eventTrigger; break;
        case 'success': synthToPlay = synthConfig.qteSuccess; break;
        case 'fail': synthToPlay = synthConfig.qteFail; break;
        case 'pit': synthToPlay = synthConfig.pitStop; break;
        case 'finish': synthToPlay = synthConfig.raceFinish; break;
        case 'countdown': synthToPlay = synthConfig.countdown; break;
      }

      if (!synthToPlay || (synthToPlay as any).disposed) return;

      if (type === 'fail' && synthToPlay instanceof Tone.NoiseSynth) {
        synthToPlay.triggerRelease(now);
        synthToPlay.triggerAttackRelease("8n", scheduleTime);
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
    let dynamicTexts: Partial<RaceEvent> = { /* defaults from baseEvent are implicitly used */ };
    const posP = `P${currentPosition}`;
    const targetPosP = currentPosition > 1 ? `P${currentPosition - 1}` : 'the lead';
    const rivalPosP = `P${currentPosition + 1}`;

    dynamicTexts.description = baseEvent.description;
    dynamicTexts.actionText = baseEvent.actionText;
    dynamicTexts.successMessage = baseEvent.successMessage;
    dynamicTexts.failureMessage = baseEvent.failureMessage;

    switch (baseEvent.type) {
        case 'start_qte':
            dynamicTexts.description = `Lights Out! Nail the start from ${playerStateRef.current.startingPosition ? 'P'+playerStateRef.current.startingPosition : 'your grid slot'}!`;
            dynamicTexts.actionText = "Launch!";
            dynamicTexts.successMessage = "Great launch! Held position or gained!";
            dynamicTexts.failureMessage = "Slow start! Lost vital ground.";
            break;
        case 'overtake_qte':
            if (currentPosition <= 1) {
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
            } else if (currentPosition <= 1) {
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
            const tireWearPercent = playerStateRef.current.tireWear;
            dynamicTexts.description = baseEvent.options?.[0]?.toLowerCase().includes("hards") ?
                `Pit window open! Current pos: ${posP}. Tire wear: ${tireWearPercent}%. Hards for durability?` :
                `Final pit window! Pos: ${posP}. Wear: ${tireWearPercent}%. Softs for a late charge?`;
            break;
    }
    return dynamicTexts;
  }, []);


  const endRace = useCallback(() => {
    clearTimers();
    eventActiveRef.current = false;

    const finalPlayerState = playerStateRef.current;
    let finalTime = finalPlayerState.playerTimeMs;

    // Ensure final lap's base time and penalties are added if not already
    if (finalPlayerState.lap === TOTAL_LAPS && completedLapRef.current < TOTAL_LAPS) {
        const lapTimePenalty = finalPlayerState.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
        finalTime += PLAYER_BASE_LAP_TIME_MS + lapTimePenalty;
        completedLapRef.current = TOTAL_LAPS; // Mark final lap as accounted
    }
    
    const finalMessage = finalPlayerState.position === 1
      ? `P1 Finish! Your Time: ${(finalTime / 1000).toFixed(3)}s`
      : `Race Complete! Final Position: P${finalPlayerState.position}. Time: ${(finalTime / 1000).toFixed(3)}s.`;

    setPlayerState(prev => ({
        ...prev,
        playerTimeMs: finalTime, // Ensure playerTimeMs in state is the true final time
        lastEventMessage: finalMessage,
        lap: TOTAL_LAPS // Ensure lap is set to total laps
    }));
    setGameState("finished");
    playSound('finish');

    if (finalPlayerState.position === 1) {
      const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES ||
                         (leaderboard.length > 0 && finalTime < leaderboard[leaderboard.length - 1].time) ||
                         leaderboard.length === 0;
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [leaderboard, playSound, clearTimers]);


  const calculateQualifyingResults = useCallback(() => {
    clearTimers();
    eventActiveRef.current = false;
    const qTime = playerStateRef.current.playerTimeMs;

    let startPos = 8; 
    if (qTime <= QUALIFYING_BASE_TIME_MS - 5500) startPos = 1;
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 4000) startPos = 2;
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 2500) startPos = 3;
    else if (qTime <= QUALIFYING_BASE_TIME_MS - 1000) startPos = 4;
    else if (qTime <= QUALIFYING_BASE_TIME_MS + 500) startPos = 5;
    else if (qTime <= QUALIFYING_BASE_TIME_MS + 2000) startPos = 6;
    else if (qTime <= QUALIFYING_BASE_TIME_MS + 3500) startPos = 7;

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
          position: prev.startingPosition || 8, 
          lap: 0, 
          lastEventMessage: `Race starting from P${prev.startingPosition || 8}...`
      }));
      currentEventIndexRef.current = 0; 
      completedLapRef.current = 0;

      setGameState("countdown");
      let countdown = 3;
      playSound('countdown');
      setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
      
      const countdownInterval = setInterval(() => {
          if (gameStateRef.current !== 'countdown') {
               clearInterval(countdownInterval);
               return;
          }
          countdown--;
          if (countdown > 0) {
              playSound('countdown');
              setPlayerState(prev => ({...prev, lastEventMessage: `${countdown}...`}));
          } else if (countdown === 0){
              playSound('success'); // GO sound
              setPlayerState(prev => ({...prev, lastEventMessage: `GO!`}));
          } else {
              clearInterval(countdownInterval);
              if (gameStateRef.current === 'countdown' && processNextEventRef.current) {
                  processNextEventRef.current();
              }
          }
      }, 1000);
    }, 3000); // Shortened quali result display time
  }, [playSound, clearTimers]);

  const handleEventAction = useCallback((choice?: string | number | undefined, timedOut: boolean = false) => {
    if (!eventActiveRef.current && !timedOut) { // If user clicks after timeout, ignore click. Timeout path is valid.
        return;
    }
    clearTimers();
    eventActiveRef.current = false; // Event is now being resolved

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
        } else if (!qteSuccess && currentEvent.type !== 'pit_decision') {
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
        } else { 
            if (currentEvent.type !== 'pit_decision') playSound('success');
            eventResultMessage = currentEvent.successMessage || "Event Success!";
            switch (currentEvent.type) {
                case 'start_qte': timeDelta += TIME_START_GOOD; if (playerStateRef.current.startingPosition && playerStateRef.current.startingPosition > 2 && Math.random() < 0.5) positionChange = -1; break;
                case 'overtake_qte': timeDelta += TIME_OVERTAKE_SUCCESS; if(playerStateRef.current.position > 1) positionChange = -1; break;
                case 'defend_qte': timeDelta += TIME_DEFEND_SUCCESS; break;
                case 'drs_qte': timeDelta += (playerStateRef.current.tireWear < 55) ? DRS_BONUS_GOOD_TIRES : DRS_BONUS_WORN_TIRES; break;
                case 'pit_decision':
                    playSound('pit');
                    const chosenOption = timedOut && currentEvent.options ? currentEvent.options[1] : choice; // Default to "Stay Out" if timed out
                    if (chosenOption === currentEvent.options![0]) { 
                        timeDelta += TIME_PIT_STOP_COST;
                        newTireWear = TIRE_WEAR_PIT_RESET;
                        eventResultMessage = `Pit stop for ${chosenOption}! Cost: ${(TIME_PIT_STOP_COST/1000).toFixed(1)}s. New tire wear: ${newTireWear}%.`;
                        const lapsRemaining = TOTAL_LAPS - playerStateRef.current.lap;
                        if (playerStateRef.current.position <=3 && lapsRemaining <= 2) positionChange = Math.random() < 0.5 ? 2 : 1;
                        else if (playerStateRef.current.position < 7 ) positionChange = Math.random() < 0.3 ? 1 : 0;
                    } else { 
                        eventResultMessage = `Staying out on ${currentEvent.options![1].split('(')[1].replace(')','')}! Current tire wear: ${playerStateRef.current.tireWear}%. Gambling.`;
                        if (playerStateRef.current.tireWear > 70) timeDelta += 2500;
                        if (playerStateRef.current.tireWear > 85) timeDelta += 2000; 
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
        ? playerStateRef.current.position 
        : Math.max(1, Math.min(20, playerStateRef.current.position + positionChange)); 

    setPlayerState(prev => ({
      ...prev,
      playerTimeMs: prev.playerTimeMs + timeDelta,
      tireWear: newTireWear,
      position: newCalculatedPosition,
      lastEventMessage: eventResultMessage,
    }));

    currentEventIndexRef.current++; 

    const outcomeDisplayDuration = (currentEvent.type === 'pit_decision' || timedOut) ? 1200 : 700;

    eventTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'finished' && gameStateRef.current !== 'calculating_results') {
            if (processNextEventRef.current) {
                processNextEventRef.current();
            }
        }
    }, outcomeDisplayDuration);

  }, [currentEvent, playSound, clearTimers, generateDynamicEventTexts]);


  const processNextEventInternal = useCallback(() => {
    clearTimers();
    const currentPhase = gameStateRef.current;

    if (currentPhase === 'finished' || currentPhase === 'calculating_results') return;

    const isQualifying = currentPhase === 'qualifying_lap' || currentPhase === 'qualifying_result' || (currentPhase === 'idle' && !playerStateRef.current.qualifyingTimeMs);
    const eventsConfig = isQualifying ? QUALIFYING_EVENTS_CONFIG : RACE_EVENTS_CONFIG;

    if (currentEventIndexRef.current >= eventsConfig.length) {
        if (isQualifying && currentPhase === 'qualifying_lap') {
            calculateQualifyingResults();
        } else if (!isQualifying && playerStateRef.current.lap >= TOTAL_LAPS) {
            setGameState("calculating_results"); // Intermediate state before final endRace
            eventTimeoutRef.current = setTimeout(endRace, 500); // Give time for "calculating" message
        } else if (!isQualifying && playerStateRef.current.lap < TOTAL_LAPS) {
          // This case implies we ran out of configured events for race laps
          // but not enough laps completed. This might indicate an issue with event config or lap count.
          // For now, proceed to endRace if lap count is met, otherwise log.
          console.warn("Ran out of race events before completing all laps. Current lap:", playerStateRef.current.lap);
           if (playerStateRef.current.lap >= TOTAL_LAPS) {
               setGameState("calculating_results");
               eventTimeoutRef.current = setTimeout(endRace, 500);
           } else {
             // Potentially advance to next lap if events are exhausted for current configured max lap
             // This part needs careful thought if events don't span all TOTAL_LAPS
             // For now, if events end early, but laps not done, we might get stuck.
             // A better way is to ensure events cover all laps or end race.
             // Let's assume events run out means end of configured race, thus end race.
             setGameState("calculating_results");
             eventTimeoutRef.current = setTimeout(endRace, 500);
           }
        }
        return;
    }

    const baseEventConfig = eventsConfig[currentEventIndexRef.current];
    let newPlayerTimeMs = playerStateRef.current.playerTimeMs;
    let newTireWear = playerStateRef.current.tireWear;
    let newLapNumber = playerStateRef.current.lap;
    let lapTransitionMessage: string | null = null;

    if (!isQualifying) {
        const eventIsForLap = baseEventConfig.lap;
        if (eventIsForLap > newLapNumber) { // Lap transition
            if (newLapNumber > 0 && completedLapRef.current < newLapNumber) { // Add time for the lap just completed
                const lapTimePenalty = playerStateRef.current.tireWear * TIRE_WEAR_TIME_PENALTY_FACTOR;
                newPlayerTimeMs += PLAYER_BASE_LAP_TIME_MS + lapTimePenalty;
                newTireWear = Math.min(100, playerStateRef.current.tireWear + TIRE_WEAR_PER_LAP);
                completedLapRef.current = newLapNumber;
            }
            newLapNumber = eventIsForLap;
            lapTransitionMessage = `Starting Lap ${newLapNumber}...`;
            setGameState("lap_transition");
        } else if (gameStateRef.current !== "event_active") {
            setGameState("event_active");
        }
    } else {
         if (gameStateRef.current !== "qualifying_lap") setGameState("qualifying_lap");
    }

    setPlayerState(prev => ({
        ...prev,
        playerTimeMs: newPlayerTimeMs,
        tireWear: newTireWear,
        lap: newLapNumber,
        lastEventMessage: lapTransitionMessage || (isQualifying && currentEventIndexRef.current === 0 && gameStateRef.current !== 'qualifying_result' ? "Qualifying Lap: Get Ready!" : prev.lastEventMessage)
    }));
    
    const dynamicTexts = generateDynamicEventTexts(baseEventConfig, playerStateRef.current.position);
    const fullEvent: RaceEvent = { ...baseEventConfig, ...dynamicTexts };
    setCurrentEvent(fullEvent);

    let displayDelay: number;
    const isFirstRaceEventAfterCountdown = !isQualifying && baseEventConfig.type === 'start_qte' && playerStateRef.current.lap === 1 && gameStateRef.current !== 'lap_transition';

    if (lapTransitionMessage || (isQualifying && currentEventIndexRef.current === 0 && gameStateRef.current !== 'qualifying_result')) {
      displayDelay = 1200; 
    } else if (isFirstRaceEventAfterCountdown) {
      displayDelay = 200; 
    } else {
      displayDelay = 500; 
    }

    eventTimeoutRef.current = setTimeout(() => {
      const currentPhaseCheck = gameStateRef.current;
      if (currentPhaseCheck === 'finished' || currentPhaseCheck === 'calculating_results') return;

      if (currentPhaseCheck === "lap_transition") setGameState("event_active");
      else if (isQualifying && currentPhaseCheck !== "qualifying_lap") setGameState("qualifying_lap");

      if (fullEvent.type === 'message_only') {
        setPlayerState(prev => ({...prev, lastEventMessage: fullEvent.successMessage || prev.lastEventMessage}));
        currentEventIndexRef.current++; 
        if (processNextEventRef.current) {
            eventTimeoutRef.current = setTimeout(processNextEventRef.current, 1000); // Shorter delay for message only
        }
      } else {
        playSound('event');
        qteStartRef.current = performance.now();
        setEventTimer(0);
        eventActiveRef.current = true;

        if (fullEvent.qteDurationMs) {
          qteIntervalRef.current = setInterval(() => {
            const activePhaseForQTE = gameStateRef.current === "event_active" || gameStateRef.current === "qualifying_lap";
            if (!activePhaseForQTE || !eventActiveRef.current) { // Check eventActiveRef too
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              return;
            }
            const elapsed = performance.now() - qteStartRef.current;
            const progress = Math.min(100, (elapsed / fullEvent.qteDurationMs!) * 100);
            setEventTimer(progress);

            if (elapsed >= fullEvent.qteDurationMs!) {
              if(qteIntervalRef.current) clearInterval(qteIntervalRef.current);
              // Check eventActiveRef before processing timeout to avoid double handling
              if(eventActiveRef.current && (gameStateRef.current === "event_active" || gameStateRef.current === "qualifying_lap")) { 
                handleEventAction(undefined, true); 
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
    completedLapRef.current = 0; 
    eventActiveRef.current = false;

    setGameState("qualifying_lap"); 
    setPlayerState(prev => ({
        ...prev,
        playerTimeMs: 0, // Start quali time from 0, add base time later or adjust QTEs
        lap: 0, 
    }));

    if (processNextEventRef.current) {
        eventTimeoutRef.current = setTimeout(processNextEventRef.current, 500); // Quicker start to quali
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

