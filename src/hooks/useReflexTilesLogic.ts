
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, ReflexTile, ReflexTilesGameState } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';
import { useSound } from "@/context/SoundContext";

const REFLEX_TILES_LEADERBOARD_KEY = "apexReflexTilesLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const GRID_SIZE = 3; // 3x3 grid
const TOTAL_TILES_IN_GRID = GRID_SIZE * GRID_SIZE;
const TILES_TO_COMPLETE = 15;
const INITIAL_TILE_DELAY_MS = 1000; // Delay before first tile lights up
const NEXT_TILE_DELAY_MS = 300; // Delay before next tile lights up after a correct hit

export function useReflexTilesLogic() {
  const { isMuted } = useSound();
  const [gameState, setGameState] = useState<ReflexTilesGameState>("idle");
  const [tiles, setTiles] = useState<ReflexTile[]>([]);
  const [score, setScore] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [activeTileId, setActiveTileId] = useState<number | null>(null);
  const [reactionStartTime, setReactionStartTime] = useState<number>(0);
  const [totalReactionTime, setTotalReactionTime] = useState(0);
  const [averageReactionTime, setAverageReactionTime] = useState(0);

  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const { toast } = useToast();

  const gameLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const synthsRef = useRef<{
    tileAppear?: Tone.Synth;
    correctHit?: Tone.Synth;
    incorrectHit?: Tone.NoiseSynth;
    gameComplete?: Tone.PolySynth;
  } | null>(null);

  const initializeGrid = useCallback(() => {
    const newTiles: ReflexTile[] = [];
    for (let i = 0; i < TOTAL_TILES_IN_GRID; i++) {
      newTiles.push({ id: i, isLit: false });
    }
    setTiles(newTiles);
  }, []);

  useEffect(() => {
    initializeGrid(); // Initialize grid on mount

    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        tileAppear: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
        correctHit: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
        incorrectHit: new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 } }).toDestination(),
        gameComplete: new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination(),
      };
    }

    const storedLeaderboard = localStorage.getItem(REFLEX_TILES_LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }

    return () => {
      if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => {
          if (synth && !(synth as any).disposed) {
            try { synth.dispose(); } catch (e) { /* ignore */ }
          }
        });
        synthsRef.current = null;
      }
    };
  }, [initializeGrid]);

  const playSound = useCallback(async (type: 'appear' | 'correct' | 'incorrect' | 'complete') => {
    if (typeof window === 'undefined') return;
    try {
      if (Tone.context.state !== 'running') await Tone.start();
    } catch (e) { console.warn(`Tone.start() failed:`, e); return; }

    if (isMuted || !synthsRef.current) return;
    const synthMap = synthsRef.current;
    const now = Tone.now();
    const scheduleTime = now + 0.02;

    try {
      if (type === 'appear' && synthMap.tileAppear && !synthMap.tileAppear.disposed) {
        synthMap.tileAppear.triggerAttackRelease("C5", "16n", scheduleTime);
      } else if (type === 'correct' && synthMap.correctHit && !synthMap.correctHit.disposed) {
        synthMap.correctHit.triggerAttackRelease("E5", "16n", scheduleTime);
      } else if (type === 'incorrect' && synthMap.incorrectHit && !synthMap.incorrectHit.disposed) {
        synthMap.incorrectHit.triggerRelease(now); // Stop if already playing
        synthMap.incorrectHit.triggerAttackRelease("8n", now + 0.05);
      } else if (type === 'complete' && synthMap.gameComplete && !synthMap.gameComplete.disposed) {
        synthMap.gameComplete.triggerAttackRelease(["C4", "E4", "G4"], "4n", scheduleTime);
      }
    } catch (e) { console.error(`Error playing sound (${type}):`, e); }
  }, [isMuted]);

  const lightUpRandomTile = useCallback(() => {
    setTiles(prevTiles => {
      const availableTiles = prevTiles.filter(t => !t.isLit);
      if (availableTiles.length === 0) { // Should not happen if logic is correct
        return prevTiles.map(t => ({ ...t, isLit: false })); // Reset if stuck
      }
      const randomIndex = Math.floor(Math.random() * availableTiles.length);
      const tileToLight = availableTiles[randomIndex];
      setActiveTileId(tileToLight.id);
      setReactionStartTime(performance.now());
      playSound('appear');
      return prevTiles.map(t => t.id === tileToLight.id ? { ...t, isLit: true } : { ...t, isLit: false });
    });
  }, [playSound]);

  const endGame = useCallback(() => {
    if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
    setGameState("finished");
    setActiveTileId(null);
    setTiles(prevTiles => prevTiles.map(t => ({ ...t, isLit: false }))); // Turn off all tiles
    const avgReaction = correctHits > 0 ? Math.round(totalReactionTime / correctHits) : 0;
    setAverageReactionTime(avgReaction);
    playSound('complete');

    const isTopScore = score > 0 && (leaderboard.length < MAX_LEADERBOARD_ENTRIES || score > (leaderboard[leaderboard.length - 1]?.time ?? -1));
    if (isTopScore) {
      setShowNicknameModal(true);
    }
  }, [score, correctHits, totalReactionTime, leaderboard, playSound]);


  const handleTileClick = useCallback((tileId: number) => {
    if (gameState !== "playing" || tileId !== activeTileId) {
      if (gameState === "playing" && activeTileId !== null) { // Misclick on a non-active tile
        playSound('incorrect');
        setScore(prev => Math.max(0, prev - 25)); // Penalty for misclick
      }
      return;
    }

    if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);

    const rt = performance.now() - reactionStartTime;
    const points = Math.max(10, 150 - Math.floor(rt / 10)); // Score inversely proportional to reaction time

    setScore(prevScore => prevScore + points);
    setTotalReactionTime(prev => prev + rt);
    setCorrectHits(prevHits => {
      const newHits = prevHits + 1;
      if (newHits >= TILES_TO_COMPLETE) {
        endGame();
      } else {
        gameLoopTimeoutRef.current = setTimeout(lightUpRandomTile, NEXT_TILE_DELAY_MS);
      }
      return newHits;
    });

    setTiles(prevTiles => prevTiles.map(t => t.id === tileId ? { ...t, isLit: false } : t));
    setActiveTileId(null); // Important to prevent re-triggering on the same lit tile quickly
    playSound('correct');

  }, [gameState, activeTileId, reactionStartTime, endGame, lightUpRandomTile, playSound]);

  const startGame = useCallback(async () => {
    if (Tone.context.state !== 'running') {
      try { await Tone.start(); } catch (e) { console.warn("Tone.start failed in startGame:", e); }
    }
    initializeGrid();
    setScore(0);
    setCorrectHits(0);
    setTotalReactionTime(0);
    setAverageReactionTime(0);
    setActiveTileId(null);
    setShowNicknameModal(false);
    setGameState("playing");
    if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
    gameLoopTimeoutRef.current = setTimeout(lightUpRandomTile, INITIAL_TILE_DELAY_MS);
  }, [initializeGrid, lightUpRandomTile]);

  const saveReflexTilesScore = useCallback((nickname: string) => {
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: score, // Store score, higher is better
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.time - a.time) // Sort descending by score
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(REFLEX_TILES_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Score Saved!", description: `Great reflexes, ${nickname}!` });
  }, [score, leaderboard, toast]);

  return {
    gameState,
    tiles,
    score,
    correctHits,
    averageReactionTime,
    leaderboard,
    showNicknameModal,
    GRID_SIZE,
    TILES_TO_COMPLETE,
    startGame,
    handleTileClick,
    saveReflexTilesScore,
    setShowNicknameModal,
  };
}
