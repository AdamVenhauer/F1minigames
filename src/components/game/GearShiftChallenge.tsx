
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gauge, CheckCircle, XCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { useGearShiftLogic, type GearShiftGameState } from "@/hooks/useGearShiftLogic";
import type { ScoreEntry } from '@/lib/types';
import { NicknameModal } from "./NicknameModal";
import { Leaderboard } from "./Leaderboard";

const getRPMBarColor = (rpm: number, optimalMin: number, optimalMax: number, gameState: GearShiftGameState) => {
  if (gameState === 'misfire_early' || gameState === 'misfire_late') return "bg-destructive";
  if (rpm > optimalMax) return "bg-orange-500"; // Over-revving slightly
  if (rpm >= optimalMin && rpm <= optimalMax) return "bg-green-500"; // Optimal zone
  return "bg-primary"; // Default revving color
};

export function GearShiftChallenge() {
  const {
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
  } = useGearShiftLogic();

  const renderGameMessage = () => {
    if (shiftFeedback) {
      return <p className={`text-xl font-semibold ${shiftFeedback.type === 'perfect' || shiftFeedback.type === 'good' ? 'text-accent' : 'text-destructive'}`}>{shiftFeedback.message}</p>;
    }
    if (gameState === 'finished') {
      return <p className="text-2xl font-bold text-accent">Final Score: {totalScore}</p>;
    }
    if (gameState === 'revving') {
      return <p className="text-lg text-muted-foreground">Get Ready to Shift!</p>;
    }
    return <p className="text-lg text-muted-foreground">Press "Start Challenge" to begin!</p>;
  };

  const rpmBarColor = getRPMBarColor(rpm, OPTIMAL_RPM_MIN, OPTIMAL_RPM_MAX, gameState);

  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-md mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl flex items-center justify-center">
            <Gauge className="mr-2 h-7 w-7" /> Gear Shift Precision
          </CardTitle>
          <CardDescription>
            Time your shifts perfectly! Current Score: {totalScore}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[300px] justify-center">
          <div className="w-full space-y-2">
            <p className="text-3xl font-bold">Gear: <span className="text-primary">{currentGear}</span> / {MAX_GEARS}</p>
            <div className="relative w-full h-10 bg-muted rounded-lg overflow-hidden border border-border">
              <div
                className="absolute left-0 top-0 bottom-0 bg-green-500/30"
                style={{ width: `${OPTIMAL_RPM_MAX - OPTIMAL_RPM_MIN}%`, left: `${OPTIMAL_RPM_MIN}%` }}
                title="Optimal Shift Zone"
              />
              <Progress value={rpm} className="w-full h-full" indicatorClassName={rpmBarColor} />
              <p className="absolute w-full text-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-medium text-foreground mix-blend-difference">
                RPM: {rpm.toFixed(0)}%
              </p>
            </div>
          </div>
          
          <div className="h-10" aria-live="polite">
            {renderGameMessage()}
          </div>

          {gameState === 'idle' || gameState === 'finished' || gameState === 'misfire_early' || gameState === 'misfire_late' ? (
            <Button
              onClick={startGame}
              size="lg"
              className="w-full max-w-xs text-lg py-6 rounded-lg shadow-lg"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              {gameState === 'idle' ? 'Start Challenge' : 'Try Again'}
            </Button>
          ) : (
            <Button
              onClick={handleShift}
              size="lg"
              className="w-full max-w-xs text-lg py-6 rounded-lg shadow-lg"
              disabled={gameState !== 'revving'}
            >
              <Gauge className="mr-2 h-5 w-5" />
              SHIFT!
            </Button>
          )}
        </CardContent>
      </Card>
      <Leaderboard scores={leaderboard} />
      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={saveGearShiftScore}
        reactionTime={totalScore} // Using reactionTime prop for totalScore here
      />
    </div>
  );
}
