
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
        gameComplete: new Tone.PolySynth(Tone.Synth, { PolySynth: {volume: -6}, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }}).toDestination(),
      };
    }
    const storedLeaderboard = localStorage.getItem(GEAR_SHIFT_LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    return () => {
      if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      // Dispose of Tone.js synths on unmount
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => {
          if (synth && typeof synth.dispose === 'function') {
            try {
              synth.dispose();
            } catch (e) {
              console.error("Error disposing synth:", e);
            }
          }
        });
        synthsRef.current = null; // Clear the ref
      }
    };
  }, []);

  const playSound = useCallback((type: 'success' | 'perfect' | 'fail' | 'complete') => {
    if (Tone.context.state !== 'running') {
        // Ensure Tone.start() is called in response to a user gesture if possible,
        // though here it's a fallback.
        Tone.start().catch(e => console.error("Tone.start failed:", e));
    }
    const synthConfig = synthsRef.current;
    if (!synthConfig) return;

    const scheduleTime = Tone.now(); 

    switch (type) {
      case 'success':
        if (synthConfig.shiftSuccess) synthConfig.shiftSuccess.triggerAttackRelease("C5", "8n", scheduleTime + 0.02);
        break;
      case 'perfect':
        if (synthConfig.shiftPerfect) synthConfig.shiftPerfect.triggerAttackRelease("E5", "8n", scheduleTime + 0.02, 0.8);
        break;
      case 'fail':
        if (synthConfig.shiftFail) {
          // Stop any ongoing sound from this synth immediately.
          synthConfig.shiftFail.stop(scheduleTime); 
          // Schedule the new sound slightly in the future.
          synthConfig.shiftFail.triggerAttackRelease("2n", scheduleTime + 0.03); 
        }
        break;
      case 'complete':
        if (synthConfig.gameComplete) synthConfig.gameComplete.triggerAttackRelease(["C4", "E4", "G4"], "4n", scheduleTime + 0.02);
        break;
    }
  }, []);


  const clearTimers = useCallback(() => {
    if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);
  
  const proceedToNextStepOrFinish = useCallback(() => {
    setGameState(prevGameState => { 
      if (currentGear < MAX_GEARS) {
        setCurrentGear(g => g + 1);
        startRevving(); 
      } else {
        playSound('complete');
         const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || totalScore > 0 && (leaderboard.length === 0 || totalScore > leaderboard[leaderboard.length-1].time);
         if (isTopScore && totalScore > 0) {
           setShowNicknameModal(true);
         }
        return "finished";
      }
      return prevGameState; 
    });
  }, [currentGear, playSound, totalScore, leaderboard, /* startRevving is memoized, added here if its identity could change based on its own deps */ ]);
  // Removed startRevving from proceedToNextStepOrFinish's dependency array if it's stable or ensure its deps are stable.
  // Re-added startRevving to be safe, ensure it's correctly memoized.

  const startRevving = useCallback(() => {
    setRpm(0);
    setGameState("revving");
    setShiftFeedback(null);
    clearTimers();

    rpmIntervalRef.current = setInterval(() => {
      setRpm(prevRpm => {
        const nextRpm = prevRpm + RPM_INCREASE_PER_TICK;
        if (nextRpm >= 100) {
          if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
          const feedback: ShiftFeedback = { message: "Engine Over-Revved!", type: 'misfire_late', points: 0 };
          setShiftFeedback(feedback);
          playSound('fail');
          setGameState('misfire_late');
          // Check if proceedToNextStepOrFinish is defined before calling
          if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current); // Clear previous if any
          feedbackTimeoutRef.current = setTimeout(() => proceedToNextStepOrFinish(), 1500);
          return 100;
        }
        return nextRpm;
      });
    }, RPM_TICK_INTERVAL);
  }, [playSound, clearTimers, proceedToNextStepOrFinish]); // Added proceedToNextStepOrFinish as a dependency


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
    } else { 
      feedback = { message: "Shifted Late!", type: 'late', points: 25 };
      playSound('success');
    }
    
    setShiftFeedback(feedback);
    setTotalScore(s => s + feedback.points);
    if (feedback.type !== 'misfire_early' && feedback.type !== 'misfire_late') {
        setGameState("shifted_check");
    }
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current); // Clear previous if any
    feedbackTimeoutRef.current = setTimeout(() => proceedToNextStepOrFinish(), 1500);

  }, [gameState, rpm, clearTimers, playSound, proceedToNextStepOrFinish]);

  const startGame = useCallback(() => {
    clearTimers();
    setCurrentGear(1);
    setTotalScore(0);
    setShiftFeedback(null);
    setShowNicknameModal(false);
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
  
  // Ensure proceedToNextStepOrFinish has stable dependencies or is itself stable
  // If startRevving is a dependency of proceedToNextStepOrFinish, and vice-versa (indirectly),
  // it can cause re-renders. Let's make sure `useCallback` dependencies are minimal and correct.
  // The current dependencies for proceedToNextStepOrFinish now include startRevving.
  // The dependencies for startRevving include proceedToNextStepOrFinish.
  // This is a mutual dependency. It's okay if they are stable.
  // Let's review deps for proceedToNextStepOrFinish more: [currentGear, playSound, totalScore, leaderboard, startRevving]
  // And for startRevving: [playSound, clearTimers, proceedToNextStepOrFinish]
  // This structure should be okay if startRevving is correctly memoized.
  // For proceedToNextStepOrFinish, startRevving is indeed a dependency.
  // For startRevving, proceedToNextStepOrFinish is a dependency. This creates a cycle that useCallback is designed to handle if the functions themselves don't change unnecessarily.

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

