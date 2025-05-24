
"use client";

import { useState } from 'react';
import { Analytics } from "@vercel/analytics/next"
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSound } from "@/context/SoundContext";
import { useToast } from "@/hooks/use-toast";
import { Trash2, VolumeX, Volume2 } from 'lucide-react';

const LEADERBOARD_KEYS = [
  "apexStartLeaderboard",
  "apexPitStopLeaderboard",
  "apexGearShiftLeaderboard",
  "apexF1TriviaLeaderboard",
  "apexRaceStrategyLeaderboard_P1_v3_quali",
];

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { isMuted, toggleMute } = useSound();
  const { toast } = useToast();
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);

  const handleResetScores = () => {
    LEADERBOARD_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
    toast({
      title: "Scores Reset",
      description: "All game scores have been cleared.",
    });
    setIsResetAlertOpen(false); // Close alert dialog
    // Optionally, close the main settings dialog too
    // onOpenChange(false); 
    // For now, let's keep it open, user might want to mute/unmute
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card/90 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center text-primary">Game Settings</DialogTitle>
          <DialogDescription className="text-center">
            Manage your game preferences here.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg shadow">
            <Label htmlFor="mute-sounds" className="flex items-center text-lg">
              {isMuted ? <VolumeX className="mr-2 h-5 w-5" /> : <Volume2 className="mr-2 h-5 w-5" />}
              Mute Sounds
            </Label>
            <Switch
              id="mute-sounds"
              checked={isMuted}
              onCheckedChange={toggleMute}
              aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
            />
          </div>

          <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full text-lg py-6" onClick={() => setIsResetAlertOpen(true)}>
                <Trash2 className="mr-2 h-5 w-5" /> Reset All Scores
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your saved scores for all minigames will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsResetAlertOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetScores}>
                  Yes, Reset Scores
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
