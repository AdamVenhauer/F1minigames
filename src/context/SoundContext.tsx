
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_MUTED_KEY = "apexSoundsMuted";

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedMuteState = localStorage.getItem(SOUND_MUTED_KEY);
      return storedMuteState === 'true';
    }
    return false; // Default to unmuted if localStorage is not available (SSR)
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MUTED_KEY, String(isMuted));
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prevMuted => {
      const newMutedState = !prevMuted;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SOUND_MUTED_KEY, String(newMutedState));
      }
      return newMutedState;
    });
  }, []);

  return (
    <SoundContext.Provider value={{ isMuted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
