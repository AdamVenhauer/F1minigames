
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HelmetIcon } from "@/components/icons/HelmetIcon";

interface NicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNickname: (nickname: string) => void;
  reactionTime: number | null; // Kept for score value, despite the name
  scoreMessagePrefix?: string;
  scoreUnit?: string;
}

export function NicknameModal({ 
  isOpen, 
  onClose, 
  onSubmitNickname, 
  reactionTime, 
  scoreMessagePrefix = "You got a reaction time of ", 
  scoreUnit = "ms" 
}: NicknameModalProps) {
  const [nickname, setNickname] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      onSubmitNickname(nickname.trim());
      setNickname(""); // Reset for next time
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <HelmetIcon className="w-12 h-12 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">New High Score!</DialogTitle>
            <DialogDescription className="text-center">
              {scoreMessagePrefix}<span className="font-bold text-accent">{reactionTime}</span>{scoreUnit && `${scoreUnit}`}!
              <br />
              Enter your nickname to save your score on the leaderboard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nickname" className="text-right col-span-1">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="col-span-3"
                maxLength={15}
                required
                aria-label="Enter your nickname"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!nickname.trim()}>Save Score</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
