
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wrench, CheckCircle, XCircle, Clock, Zap, RotateCcw, Users, Fuel } from 'lucide-react';
import { TireIcon } from '@/components/icons/TireIcon';
import * as Tone from 'tone';
import type { ScoreEntry } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { NicknameModal } from "./NicknameModal";
import { Leaderboard } from "./Leaderboard";


type PitStopStepKey = 'idle' | 'ready' | 'jack_up' | 'tires_off' | 'tires_on' | 'fueling' | 'jack_down' | 'go' | 'finished' | 'failed';

interface PitStopStep {
  key: PitStopStepKey;
  label: string;
  actionText: string;
  icon: React.ReactNode;
  durationMs: number; 
  next: PitStopStepKey | null;
  fail?: PitStopStepKey; 
}

const PIT_STOP_STEPS: Record<PitStopStepKey, PitStopStep> = {
  idle: { key: 'idle', label: 'Awaiting Pit Crew', actionText: 'Start Pit Stop', icon: <Users className="w-8 h-8" />, durationMs: 0, next: 'ready' },
  ready: { key: 'ready', label: 'Get Ready!', actionText: 'Wait for Signal...', icon: <Clock className="w-8 h-8 animate-pulse" />, durationMs: 1500, next: 'jack_up' },
  jack_up: { key: 'jack_up', label: 'Jack Up Car!', actionText: 'Jack UP!', icon: <Zap className="w-8 h-8 text-yellow-400" />, durationMs: 0, next: 'tires_off', fail: 'failed' },
  tires_off: { key: 'tires_off', label: 'Tires Off!', actionText: 'Remove Tires!', icon: <TireIcon className="w-8 h-8 text-red-500" />, durationMs: 0, next: 'tires_on', fail: 'failed' },
  tires_on: { key: 'tires_on', label: 'Tires On!', actionText: 'Attach Tires!', icon: <TireIcon className="w-8 h-8 text-green-500" />, durationMs: 0, next: 'fueling', fail: 'failed' },
  fueling: { key: 'fueling', label: 'Fueling!', actionText: 'Start Fueling', icon: <Fuel className="w-8 h-8 text-orange-400" />, durationMs: 2000, next: 'jack_down', fail: 'failed' }, // Fueling is timed
  jack_down: { key: 'jack_down', label: 'Jack Down Car!', actionText: 'Jack DOWN!', icon: <Zap className="w-8 h-8 text-yellow-400" />, durationMs: 0, next: 'go', fail: 'failed' },
  go: { key: 'go', label: 'GO GO GO!', actionText: 'Release Car!', icon: <CheckCircle className="w-8 h-8 text-green-400" />, durationMs: 0, next: 'finished', fail: 'failed' },
  finished: { key: 'finished', label: 'Pit Stop Complete!', actionText: 'Try Again', icon: <CheckCircle className="w-10 h-10 text-green-500" />, durationMs: 0, next: 'idle' },
  failed: { key: 'failed', label: 'Mistake in Pit!', actionText: 'Try Again', icon: <XCircle className="w-10 h-10 text-destructive" />, durationMs: 0, next: 'idle' },
};

const PIT_LEADERBOARD_KEY = "apexPitStopLeaderboard";
const MAX_PIT_LEADERBOARD_ENTRIES = 10;
const ACTION_COOLDOWN_MS = 150; // Brief cooldown to prevent spamming

export function PitStopChallenge() {
  const [currentStepKey, setCurrentStepKey] = useState<PitStopStepKey>('idle');
  const [totalPitTime, setTotalPitTime] = useState<number | null>(null);
  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [isActionLocked, setIsActionLocked] = useState(false); // For anti-spam
  const { toast } = useToast();

  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const synthsRef = useRef<{ click?: Tone.Synth, success?: Tone.Synth, error?: Tone.Synth, complete?: Tone.Synth } | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        click: new Tone.MembraneSynth().toDestination(),
        success: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 }}).toDestination(),
        error: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }}).toDestination(),
        complete: new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }}).toDestination(),
      };
    }
    const storedLeaderboard = localStorage.getItem(PIT_LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    return () => {
      if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
      if (actionLockTimeoutRef.current) clearTimeout(actionLockTimeoutRef.current);
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => synth?.dispose());
        synthsRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback((type: 'click' | 'success' | 'error' | 'complete') => {
    if (Tone.context.state !== 'running') Tone.start().catch(e => console.error("Tone.start failed:", e));
    const synth = synthsRef.current?.[type];
    if (!synth) return;
    const now = Tone.now();
    if (type === 'click' && synth instanceof Tone.MembraneSynth) synth.triggerAttackRelease("C2", "8n", now + 0.01);
    if (type === 'success' && synth instanceof Tone.Synth) synth.triggerAttackRelease("C5", "8n", now + 0.02);
    if (type === 'error' && synth instanceof Tone.NoiseSynth) synth.triggerAttackRelease("2n", now + 0.03);
    if (type === 'complete' && synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4"], "4n", now + 0.02);
  }, []);

  const currentStep = PIT_STOP_STEPS[currentStepKey];

  const advanceStep = useCallback((nextKey: PitStopStepKey) => {
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    
    const nextStepConfig = PIT_STOP_STEPS[nextKey];
    setCurrentStepKey(nextKey);
    setStepStartTime(performance.now());
    setProgress(0);

    if (nextStepConfig.durationMs > 0) { 
      stepTimeoutRef.current = setTimeout(() => {
        if (nextStepConfig.next) {
          advanceStep(nextStepConfig.next);
        }
      }, nextStepConfig.durationMs);
    }
    
    if (nextKey === 'finished') {
      playSound('complete');
      if (totalPitTime !== null) {
         const isTopScore = leaderboard.length < MAX_PIT_LEADERBOARD_ENTRIES || totalPitTime < leaderboard[leaderboard.length - 1].time;
         if (isTopScore) {
           setShowNicknameModal(true);
         }
      }
    } else if (nextKey === 'failed') {
      playSound('error');
      setTotalPitTime(null); 
    }

  }, [playSound, leaderboard, totalPitTime]);


  const handleAction = useCallback(() => {
    if (isActionLocked) return; // Prevent action if locked

    setIsActionLocked(true); // Lock action
    if(actionLockTimeoutRef.current) clearTimeout(actionLockTimeoutRef.current);
    actionLockTimeoutRef.current = setTimeout(() => setIsActionLocked(false), ACTION_COOLDOWN_MS);


    if (!currentStep.next && currentStepKey !== 'finished' && currentStepKey !== 'failed') return;
    playSound('click');

    if (currentStepKey === 'idle') {
      setTotalPitTime(0); 
      advanceStep('ready');
      return;
    }
    
    if (currentStepKey === 'finished' || currentStepKey === 'failed') {
      setTotalPitTime(null);
      advanceStep('idle');
      return;
    }

    if (currentStep.durationMs === 0) {
      if (currentStep.next) {
        if (stepStartTime && currentStepKey !== 'ready') { 
            setTotalPitTime(prev => (prev ?? 0) + (performance.now() - stepStartTime));
        }
        advanceStep(currentStep.next);
        playSound('success');
      }
    } else { 
      if (currentStep.fail) {
        advanceStep(currentStep.fail);
      }
    }
  }, [currentStep, stepStartTime, advanceStep, playSound, currentStepKey, isActionLocked]);


  useEffect(() => { 
    let intervalId: NodeJS.Timeout | undefined;
    if (stepStartTime && (currentStepKey !== 'idle' && currentStepKey !== 'finished' && currentStepKey !== 'failed')) {
      intervalId = setInterval(() => {
        const elapsed = performance.now() - stepStartTime;
        setDisplayTime(elapsed);
        if (currentStep.durationMs > 0) {
          setProgress(Math.min(100, (elapsed / currentStep.durationMs) * 100));
        }
      }, 50);
    } else {
      setDisplayTime(0);
      setProgress(0);
    }
    return () => clearInterval(intervalId);
  }, [stepStartTime, currentStepKey, currentStep.durationMs]);

  const savePitScore = useCallback((nickname: string) => {
    if (totalPitTime === null) return;
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: Math.round(totalPitTime), 
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => a.time - b.time)
      .slice(0, MAX_PIT_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(PIT_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Pit Score Saved!", description: `Awesome pit stop, ${nickname}!` });
  }, [totalPitTime, leaderboard, toast]);


  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-lg mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Pit Stop Challenge</CardTitle>
          <CardDescription>
            {currentStep.label}
            {totalPitTime !== null && currentStepKey !== 'idle' && currentStepKey !== 'finished' && currentStepKey !== 'failed' && (
                 ` - Total: ${(totalPitTime / 1000).toFixed(3)}s`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[250px] justify-center">
          <div className="h-12 w-12 flex items-center justify-center mb-4" aria-live="polite">
            {currentStep.icon}
          </div>

          {currentStep.durationMs > 0 && currentStepKey !== 'idle' && currentStepKey !== 'finished' && currentStepKey !== 'failed' && (
            <div className="w-full px-4">
              <Progress value={progress} className="w-full h-4" />
              <p className="text-sm text-muted-foreground mt-1">{(displayTime / 1000).toFixed(2)}s / {(currentStep.durationMs / 1000).toFixed(2)}s</p>
            </div>
          )}

          {currentStepKey === 'finished' && totalPitTime !== null && (
            <p className="text-4xl font-bold text-accent">{(totalPitTime / 1000).toFixed(3)}s</p>
          )}
           {currentStepKey === 'failed' && (
            <p className="text-lg text-destructive font-semibold">Mistake! Try to be precise.</p>
          )}

          <Button
            onClick={handleAction}
            size="lg"
            className="w-full max-w-xs text-lg py-6 rounded-lg shadow-lg transition-transform hover:scale-105 focus:ring-4 focus:ring-accent/50"
            disabled={isActionLocked || currentStepKey === 'ready' || (currentStepKey === 'fueling' && progress < 100) }
            variant={(currentStepKey === 'finished' || currentStepKey === 'failed') ? 'outline' : 'default'}
          >
            {currentStep.actionText}
          </Button>
        </CardContent>
      </Card>
      <Leaderboard scores={leaderboard} scoreHeaderText="Pit Time (ms)" />
      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={savePitScore}
        reactionTime={totalPitTime !== null ? Math.round(totalPitTime) : null}
      />
    </div>
  );
}
