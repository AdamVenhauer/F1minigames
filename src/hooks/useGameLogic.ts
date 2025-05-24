"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, GameState } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import * as Tone from 'tone';

const LEADERBOARD_KEY = "apexStartLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const LIGHT_INTERVAL = 700; // ms between red lights
const MIN_GREEN_LIGHT_DELAY = 1000; // ms
const MAX_GREEN_LIGHT_DELAY = 4000; // ms

export function useGameLogic() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [activeRedLights, setActiveRedLights] = useState(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const lightSequenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const greenLightTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tone.js synths - ensure they are only created once
  const synthsRef = useRef<{
    countdown?: Tone.Synth,
    go?: Tone.Synth,
    penalty?: Tone.Synth,
    success?: Tone.Synth
  } | null>(null);

  useEffect(() => {
    // Initialize Tone.js synths on component mount (client-side only)
    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        countdown: new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.01 }
        }).toDestination(),
        go: new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.1 }
        }).toDestination(),
        penalty: new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
            modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination(),
        success: new Tone.MonoSynth({
            oscillator: { type: "square" },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 0.3 }
        }).toDestination(),
      };
    }

    // Load leaderboard from localStorage
    const storedLeaderboard = localStorage.getItem(LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    
    return () => { // Cleanup timeouts on unmount
        if (lightSequenceTimerRef.current) clearTimeout(lightSequenceTimerRef.current);
        if (greenLightTimerRef.current) clearTimeout(greenLightTimerRef.current);
    };
  }, []);

  const playSound = useCallback((soundType: 'countdown' | 'go' | 'penalty' | 'success') => {
    if (Tone.context.state !== 'running') {
      Tone.start(); // Ensure AudioContext is running
    }
    const synth = synthsRef.current?.[soundType];
    if (synth) {
        switch(soundType) {
            case 'countdown': synth.triggerAttackRelease("C5", "8n"); break;
            case 'go': synth.triggerAttackRelease("G5", "4n"); break;
            case 'penalty': synth.triggerAttackRelease("A2", "4n"); break;
            case 'success': synth.triggerAttackRelease("E4", "8n", Tone.now()); synth.triggerAttackRelease("G4", "8n", Tone.now() + 0.1); synth.triggerAttackRelease("C5", "8n", Tone.now() + 0.2); break;
        }
    }
  }, []);


  const clearTimers = useCallback(() => {
    if (lightSequenceTimerRef.current) clearTimeout(lightSequenceTimerRef.current);
    if (greenLightTimerRef.current) clearTimeout(greenLightTimerRef.current);
  }, []);

  const resetGame = useCallback(() => {
    clearTimers();
    setGameState("idle");
    setActiveRedLights(0);
    setReactionTime(null);
  }, [clearTimers]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("lightsSequence");
    setActiveRedLights(0);
    let currentLight = 0;

    const advanceLights = () => {
      if (currentLight < 5) {
        currentLight++;
        setActiveRedLights(currentLight);
        playSound('countdown');
        lightSequenceTimerRef.current = setTimeout(advanceLights, LIGHT_INTERVAL);
      } else {
        // All 5 red lights are on, wait for random delay then green light
        const delay = Math.random() * (MAX_GREEN_LIGHT_DELAY - MIN_GREEN_LIGHT_DELAY) + MIN_GREEN_LIGHT_DELAY;
        greenLightTimerRef.current = setTimeout(() => {
          setActiveRedLights(0); // Turn off red lights
          setGameState("greenLight");
          playSound('go');
          startTimeRef.current = performance.now();
        }, delay);
      }
    };
    lightSequenceTimerRef.current = setTimeout(advanceLights, LIGHT_INTERVAL); // Start sequence after a brief delay
  }, [resetGame, playSound]);

  const handleGameClick = useCallback(() => {
    if (gameState === "lightsSequence") {
      clearTimers();
      setGameState("jumpStart");
      playSound('penalty');
      setReactionTime(null);
    } else if (gameState === "greenLight") {
      clearTimers();
      const endTime = performance.now();
      const time = Math.floor(endTime - startTimeRef.current);
      setReactionTime(time);
      setGameState("result");
      playSound('success');

      const isTopScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES || time < leaderboard[leaderboard.length - 1].time;
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [gameState, leaderboard, clearTimers, playSound]);

  const saveScore = useCallback((nickname: string) => {
    if (reactionTime === null) return;

    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: reactionTime,
      date: new Date().toISOString(),
    };

    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time)
      .slice(0, MAX_LEADERBOARD_ENTRIES);

    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Score Saved!", description: `Great job, ${nickname}!` });
  }, [reactionTime, leaderboard, toast]);

  return {
    gameState,
    activeRedLights,
    reactionTime,
    leaderboard,
    showNicknameModal,
    startGame,
    handleGameClick,
    saveScore,
    resetGame,
    setShowNicknameModal,
  };
}
