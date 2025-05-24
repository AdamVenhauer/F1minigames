
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, GameState } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext"; // Added import

const LEADERBOARD_KEY = "apexStartLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const LIGHT_INTERVAL = 700; // ms between red lights
const MIN_GREEN_LIGHT_DELAY = 1000; // ms
const MAX_GREEN_LIGHT_DELAY = 4000; // ms

export function useGameLogic() {
  const { isMuted } = useSound(); // Added
  const [gameState, setGameState] = useState<GameState>("idle");
  const [activeRedLights, setActiveRedLights] = useState(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const lightSequenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const greenLightTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const synthsRef = useRef<{
    countdown?: Tone.Synth,
    go?: Tone.Synth,
    penalty?: Tone.Synth,
    success?: Tone.Synth
  } | null>(null);

  useEffect(() => {
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

    const storedLeaderboard = localStorage.getItem(LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    
    return () => {
        if (lightSequenceTimerRef.current) clearTimeout(lightSequenceTimerRef.current);
        if (greenLightTimerRef.current) clearTimeout(greenLightTimerRef.current);
        // Dispose synths on cleanup
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

  const playSound = useCallback((soundType: 'countdown' | 'go' | 'penalty' | 'success') => {
    if (isMuted || !synthsRef.current) return; // Added isMuted check

    try {
      if (Tone.context.state !== 'running') {
        Tone.start().catch(e => console.warn("Tone.start failed:", e));
      }
      const synth = synthsRef.current?.[soundType];
      if (synth && !(synth as any).disposed) {
          switch(soundType) {
              case 'countdown': synth.triggerAttackRelease("C5", "8n", Tone.now() + 0.01); break;
              case 'go': synth.triggerAttackRelease("G5", "4n", Tone.now() + 0.01); break;
              case 'penalty': synth.triggerAttackRelease("A2", "4n", Tone.now() + 0.01); break;
              case 'success': 
                (synth as Tone.MonoSynth).triggerAttackRelease("E4", "8n", Tone.now() + 0.01);
                (synth as Tone.MonoSynth).triggerAttackRelease("G4", "8n", Tone.now() + 0.11);
                (synth as Tone.MonoSynth).triggerAttackRelease("C5", "8n", Tone.now() + 0.21);
                break;
          }
      }
    } catch (e) {
      console.error(`Error playing sound (${soundType}):`, e);
    }
  }, [isMuted]);


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
        const delay = Math.random() * (MAX_GREEN_LIGHT_DELAY - MIN_GREEN_LIGHT_DELAY) + MIN_GREEN_LIGHT_DELAY;
        greenLightTimerRef.current = setTimeout(() => {
          setActiveRedLights(0); 
          setGameState("greenLight");
          playSound('go');
          startTimeRef.current = performance.now();
        }, delay);
      }
    };
    lightSequenceTimerRef.current = setTimeout(advanceLights, LIGHT_INTERVAL);
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
