
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext"; // Added import

const GEAR_SHIFT_LEADERBOARD_KEY = "apexGearShiftLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;

export const MAX_GEARS = 6;
const RPM_INCREASE_PER_TICK = 2; 
const RPM_TICK_INTERVAL = 25; 
export const OPTIMAL_RPM_MIN = 75;
export const OPTIMAL_RPM_MAX = 90;
const GOOD_RPM_OFFSET = 5; 
const MISFIRE_TOO_EARLY_THRESHOLD = 30;

export type GearShiftGameState =
  | "idle"
  | "revving"
  | "shifted_check" 
  | "misfire_early"
  | "misfire_late"
  | "finished";

interface ShiftFeedback {
  message: string;
  type: 'perfect' | 'good' | 'early' | 'late' | 'misfire_early' | 'misfire_late';
  points: number;
}

export function useGearShiftLogic() {
  const { isMuted } = useSound(); // Added
  const [gameState, setGameState] = useState<GearShiftGameState>("idle");
  const gameStateRef = useRef(gameState); 

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
    gameStateRef.current = gameState;
  }, [gameState]);

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
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => {
          if (synth && !(synth as any).disposed) {
            try { synth.dispose(); } catch (e) { /* ignore */ }
          }
        });
        synthsRef.current = null; 
      }
    };
  }, []);

  const playSound = useCallback((type: 'success' | 'perfect' | 'fail' | 'complete') => {
    if (isMuted || !synthsRef.current) return; // Added isMuted check

    try {
      if (Tone.context.state !== 'running') {
          Tone.start().catch(e => console.warn("Tone.start failed:", e));
      }
      const synth = synthsRef.current?.[type];
      if (!synth || (synth as any).disposed) return;

      const now = Tone.now();
      const scheduleTime = now + 0.02;

      switch (type) {
        case 'success':
          if (synth instanceof Tone.Synth) synth.triggerAttackRelease("C5", "8n", scheduleTime);
          break;
        case 'perfect':
          if (synth instanceof Tone.Synth) synth.triggerAttackRelease("E5", "8n", scheduleTime, 0.8);
          break;
        case 'fail':
          if (synth instanceof Tone.NoiseSynth) {
              synth.triggerRelease(now); // Stop any previous sound
              synth.triggerAttackRelease("8n", now + 0.05); // Schedule new sound with delay
          }
          break;
        case 'complete':
          if (synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4"], "4n", scheduleTime);
          break;
      }
    } catch(e) {
      console.error(`Error playing sound (${type}):`, e);
    }
  }, [isMuted]);


  const clearTimers = useCallback(() => {
    if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);

  const proceedToNextStepOrFinish = useCallback(() => {
    const currentActualGameState = gameStateRef.current;
  
    if (currentActualGameState === 'finished') return; 
  
    if (currentGear < MAX_GEARS) {
      if (currentActualGameState === 'shifted_check' || 
          currentActualGameState === 'misfire_early' || 
          currentActualGameState === 'misfire_late') {
        setCurrentGear(g => g + 1);
        setTimeout(() => {
          if (gameStateRef.current !== 'finished') {
             setRpm(0);
             setGameState("revving");
             setShiftFeedback(null);
             clearTimers(); 

             rpmIntervalRef.current = setInterval(() => {
                if (gameStateRef.current !== 'revving') {
                  if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
                  return;
                }
                setRpm(prevRpm => {
                  if (gameStateRef.current !== 'revving') return prevRpm; // Guard against state change
                  if (prevRpm >= 100) return 100; // Already at max, interval should have been cleared
                  
                  const nextRpm = prevRpm + RPM_INCREASE_PER_TICK;
                  if (nextRpm >= 100) {
                    if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
                    if (gameStateRef.current === 'revving') { // Check state *before* setting new state
                      const feedback: ShiftFeedback = { message: "Engine Over-Revved!", type: 'misfire_late', points: 0 };
                      setShiftFeedback(feedback);
                      playSound('fail');
                      setGameState('misfire_late');
                      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
                      feedbackTimeoutRef.current = setTimeout(() => {
                        if (gameStateRef.current === 'misfire_late') proceedToNextStepOrFinish();
                      }, 1500);
                    }
                    return 100;
                  }
                  return nextRpm;
                });
             }, RPM_TICK_INTERVAL);
          }
        }, 0);
      }
    } else { 
      if (currentActualGameState !== 'finished') {
          playSound('complete');
          setGameState("finished");
          const currentTotalScore = totalScore; // Capture current score for leaderboard check
          const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || (currentTotalScore > 0 && (leaderboard.length === 0 || currentTotalScore > (leaderboard[leaderboard.length-1]?.time ?? -1) ));
          if (isTopScore && currentTotalScore > 0) {
            setShowNicknameModal(true);
          }
      }
    }
  }, [currentGear, leaderboard, totalScore, playSound, clearTimers]);


  const startRevving = useCallback(() => {
    if (gameStateRef.current === 'finished' || gameStateRef.current === 'misfire_early' || gameStateRef.current === 'misfire_late') {
      return;
    }
    setRpm(0);
    setGameState("revving"); 
    setShiftFeedback(null);
    clearTimers(); 

    rpmIntervalRef.current = setInterval(() => {
      if (gameStateRef.current !== 'revving') {
        if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
        return;
      }

      setRpm(prevRpm => {
        if (gameStateRef.current !== 'revving') return prevRpm;
        if (prevRpm >= 100) return 100; // Guard: if already 100, interval should have been cleared
        
        const nextRpm = prevRpm + RPM_INCREASE_PER_TICK;
        if (nextRpm >= 100) {
          if (rpmIntervalRef.current) clearInterval(rpmIntervalRef.current);
          
          if (gameStateRef.current === 'revving') { 
            const feedback: ShiftFeedback = { message: "Engine Over-Revved!", type: 'misfire_late', points: 0 };
            setShiftFeedback(feedback);
            playSound('fail'); 
            setGameState('misfire_late'); 
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = setTimeout(() => {
               if (gameStateRef.current === 'misfire_late') { 
                  proceedToNextStepOrFinish();
               }
            }, 1500);
          }
          return 100; 
        }
        return nextRpm;
      });
    }, RPM_TICK_INTERVAL);
  }, [clearTimers, playSound, proceedToNextStepOrFinish]);


  const handleShift = useCallback(() => {
    if (gameStateRef.current !== "revving") return; 

    clearTimers(); 

    let feedback: ShiftFeedback;
    const currentRpm = rpm; // Capture rpm at the moment of shift

    if (currentRpm < MISFIRE_TOO_EARLY_THRESHOLD) {
      feedback = { message: "Misfire! Too early!", type: 'misfire_early', points: 0 };
    } else if (currentRpm >= OPTIMAL_RPM_MIN && currentRpm <= OPTIMAL_RPM_MAX) {
      feedback = { message: "Perfect Shift!", type: 'perfect', points: 100 };
    } else if (currentRpm >= OPTIMAL_RPM_MIN - GOOD_RPM_OFFSET && currentRpm <= OPTIMAL_RPM_MAX + GOOD_RPM_OFFSET) {
      feedback = { message: "Good Shift!", type: 'good', points: 50 };
    } else if (currentRpm < OPTIMAL_RPM_MIN) {
      feedback = { message: "Shifted Early!", type: 'early', points: 25 };
    } else { 
      feedback = { message: "Shifted Late!", type: 'late', points: 25 };
    }
    
    setShiftFeedback(feedback);
    setTotalScore(s => s + feedback.points);

    if (feedback.type === 'misfire_early' || feedback.type === 'misfire_late') {
      playSound('fail');
      setGameState(feedback.type); 
    } else {
      playSound(feedback.type === 'perfect' ? 'perfect' : 'success');
      setGameState("shifted_check"); 
    }
    
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current); 
    feedbackTimeoutRef.current = setTimeout(() => {
        const expectedStateAfterShift = feedback.type === 'misfire_early' || feedback.type === 'misfire_late' ? feedback.type : 'shifted_check';
        if (gameStateRef.current === expectedStateAfterShift) {
            proceedToNextStepOrFinish();
        }
    }, 1500);

  }, [rpm, clearTimers, playSound, proceedToNextStepOrFinish]);

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
  
  useEffect(() => {
  }, [playSound, clearTimers, proceedToNextStepOrFinish, startRevving]);


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
