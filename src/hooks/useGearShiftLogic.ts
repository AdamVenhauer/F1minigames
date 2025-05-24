
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const GEAR_SHIFT_LEADERBOARD_KEY = "apexGearShiftLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;

export const MAX_GEARS = 6;
const RPM_INCREASE_PER_TICK = 2; // RPM increases by this much each tick
const RPM_TICK_INTERVAL = 25; // Milliseconds, affects speed of RPM rise
export const OPTIMAL_RPM_MIN = 75;
export const OPTIMAL_RPM_MAX = 90;
const GOOD_RPM_OFFSET = 5; // Within 5 of optimal is 'good'
const MISFIRE_TOO_EARLY_THRESHOLD = 30; // Shift below this is a misfire

export type GearShiftGameState =
  | "idle"
  | "revving"
  | "shifted_check" // Brief state to show feedback before next gear or finish
  | "misfire_early"
  | "misfire_late"
  | "finished";

interface ShiftFeedback {
  message: string;
  type: 'perfect' | 'good' | 'early' | 'late' | 'misfire_early' | 'misfire_late';
  points: number;
}

export function useGearShiftLogic() {
  const [gameState, setGameState] = useState<GearShiftGameState>("idle");
  const [currentGear, setCurrentGear] = useState(1);
  const [rpm, setRpm] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [shiftFeedback, setShiftFeedback] = useState<ShiftFeedback | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const rpmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const synthsRef = useRef<{
    shiftSuccess?: Tone.Synth;
    shiftPerfect?: Tone.Synth;
    shiftFail?: Tone.NoiseSynth;
    gameComplete?: Tone.PolySynth;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        shiftSuccess: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 }}).toDestination(),
        shiftPerfect: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.05, release: 0.1 }}).toDestination(),
        shiftFail: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }}).toDestination(),
        gameComplete: new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }}).toDestination(),
      };
    }
    const storedLeaderboard = localStorage.getItem(GEAR_SHIFT_LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    return () => {
      if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const playSound = useCallback((type: 'success' | 'perfect' | 'fail' | 'complete') => {
    if (Tone.context.state !== 'running') Tone.start();
    const synth = synthsRef.current?.[
        type === 'success' ? 'shiftSuccess' :
        type === 'perfect' ? 'shiftPerfect' :
        type === 'fail' ? 'shiftFail' :
        'gameComplete'
    ];
    if (!synth) return;

    const time = Tone.now() + 0.01; // Add a small delay to prevent timing issues

    if (type === 'success' && synth instanceof Tone.Synth) synth.triggerAttackRelease("C5", "8n", time);
    if (type === 'perfect' && synth instanceof Tone.Synth) synth.triggerAttackRelease("E5", "8n", time, 0.8);
    if (type === 'fail' && synth instanceof Tone.NoiseSynth) synth.triggerAttackRelease("2n", time);
    if (type === 'complete' && synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4"], "4n", time);
  }, []);

  const clearTimers = useCallback(() => {
    if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);
  
  const startRevving = useCallback(() => {
    setRpm(0);
    setGameState("revving");
    setShiftFeedback(null);
    clearTimers();

    rpmIntervalRef.current = setInterval(() => {
      setRpm(prevRpm => {
        const nextRpm = prevRpm + RPM_INCREASE_PER_TICK;
        if (nextRpm >= 100) {
          clearInterval(rpmIntervalRef.current!);
          const feedback: ShiftFeedback = { message: "Engine Over-Revved!", type: 'misfire_late', points: 0 };
          setShiftFeedback(feedback);
          playSound('fail');
          setGameState('misfire_late');
          feedbackTimeoutRef.current = setTimeout(proceedToNextStepOrFinish, 1500);
          return 100;
        }
        return nextRpm;
      });
    }, RPM_TICK_INTERVAL);
  }, [playSound, clearTimers, /* Removed proceedToNextStepOrFinish from deps to avoid cycle if it changes frequently */]);

  const proceedToNextStepOrFinish = useCallback(() => {
    setGameState(prevGameState => { // Use functional update for gameState
      if (currentGear < MAX_GEARS) {
        setCurrentGear(g => g + 1);
        startRevving(); // This will set its own gameState to 'revving'
        // No need to return a state here, startRevving handles it.
      } else {
        playSound('complete');
         const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || totalScore > 0 && (leaderboard.length === 0 || totalScore > leaderboard[leaderboard.length-1].time);
         if (isTopScore && totalScore > 0) {
           setShowNicknameModal(true);
         }
        return "finished";
      }
      // If not finished, the state will be managed by startRevving or handleShift
      return prevGameState; // Default to previous state if no explicit change
    });
  }, [currentGear, startRevving, playSound, totalScore, leaderboard]); // Removed setGameState from deps of startRevving or handleShift where possible


  const handleShift = useCallback(() => {
    if (gameState !== "revving") return;
    clearTimers();

    let feedback: ShiftFeedback;

    if (rpm < MISFIRE_TOO_EARLY_THRESHOLD) {
      feedback = { message: "Misfire! Too early!", type: 'misfire_early', points: 0 };
      playSound('fail');
      setGameState('misfire_early');
    } else if (rpm >= OPTIMAL_RPM_MIN && rpm <= OPTIMAL_RPM_MAX) {
      feedback = { message: "Perfect Shift!", type: 'perfect', points: 100 };
      playSound('perfect');
    } else if (rpm >= OPTIMAL_RPM_MIN - GOOD_RPM_OFFSET && rpm <= OPTIMAL_RPM_MAX + GOOD_RPM_OFFSET) {
      feedback = { message: "Good Shift!", type: 'good', points: 50 };
      playSound('success');
    } else if (rpm < OPTIMAL_RPM_MIN) {
      feedback = { message: "Shifted Early!", type: 'early', points: 25 };
      playSound('success');
    } else { // rpm > OPTIMAL_RPM_MAX
      feedback = { message: "Shifted Late!", type: 'late', points: 25 };
      playSound('success');
    }
    
    setShiftFeedback(feedback);
    setTotalScore(s => s + feedback.points);
    if (feedback.type !== 'misfire_early' && feedback.type !== 'misfire_late') {
        setGameState("shifted_check");
    }

    feedbackTimeoutRef.current = setTimeout(proceedToNextStepOrFinish, 1500);

  }, [gameState, rpm, clearTimers, playSound, proceedToNextStepOrFinish]);

  const startGame = useCallback(() => {
    clearTimers();
    setCurrentGear(1);
    setTotalScore(0);
    setShiftFeedback(null);
    setShowNicknameModal(false);
    // setGameState will be called by startRevving
    startRevving();
  }, [clearTimers, startRevving]);

  const saveGearShiftScore = useCallback((nickname: string) => {
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: totalScore, 
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.time - a.time) 
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(GEAR_SHIFT_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Score Saved!", description: `Awesome driving, ${nickname}!` });
  }, [totalScore, leaderboard, toast]);

  return {
    gameState,
    currentGear,
    rpm,
    totalScore,
    shiftFeedback,
    leaderboard,
    showNicknameModal,
    startGame,
    handleShift,
    saveGearShiftScore,
    setShowNicknameModal,
    MAX_GEARS,
    OPTIMAL_RPM_MIN,
    OPTIMAL_RPM_MAX,
  };
}
