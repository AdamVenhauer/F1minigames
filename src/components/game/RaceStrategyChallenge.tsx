
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Flag, Zap, Wrench, Wind, RotateCcw, Trophy } from 'lucide-react'; // Replaced CheckCircle/XCircle with Trophy
import { useRaceStrategyLogic } from "@/hooks/useRaceStrategyLogic";
import { NicknameModal } from "./NicknameModal";
import { Leaderboard } from "./Leaderboard";
import { cn } from "@/lib/utils";

export function RaceStrategyChallenge() {
  const {
    gameState,
    playerState,
    currentEvent,
    eventTimer,
    leaderboard,
    showNicknameModal,
    startGame,
    handleEventAction,
    saveRaceScore,
    setShowNicknameModal,
    TOTAL_LAPS
  } = useRaceStrategyLogic();

  const renderEventContent = () => {
    if (!currentEvent || gameState !== "event_active") return null;

    return (
      <div className="space-y-4 my-4">
        <Alert>
          <div className="flex items-center">
            {currentEvent.type === 'start_qte' && <Flag className="h-5 w-5 mr-2" />}
            {currentEvent.type === 'overtake_qte' && <Zap className="h-5 w-5 mr-2 text-yellow-400" />}
            {currentEvent.type === 'defend_qte' && <Zap className="h-5 w-5 mr-2 text-orange-400" />}
            {currentEvent.type === 'pit_decision' && <Wrench className="h-5 w-5 mr-2" />}
            {currentEvent.type === 'drs_qte' && <Wind className="h-5 w-5 mr-2 text-blue-400" />}
            <AlertTitle>Lap {currentEvent.lap}: {currentEvent.description}</AlertTitle>
          </div>
        </Alert>

        {currentEvent.qteDurationMs && (
          <div className="w-full">
            <Progress value={eventTimer} className="h-3" indicatorClassName={eventTimer > 80 ? "bg-destructive" : "bg-primary"} />
            <p className="text-xs text-muted-foreground text-center mt-1">Time Remaining</p>
          </div>
        )}

        {currentEvent.type === 'pit_decision' && currentEvent.options ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentEvent.options.map(option => (
              <Button key={option} onClick={() => handleEventAction(option)} size="lg">
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <Button onClick={() => handleEventAction()} size="lg" className="w-full">
            {currentEvent.actionText || "React!"}
          </Button>
        )}
      </div>
    );
  };

  const getPositionSuffix = (position: number) => {
    if (position === 1) return "st";
    if (position === 2) return "nd";
    if (position === 3) return "rd";
    return "th";
  }

  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-2xl mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-3xl flex items-center justify-center">
            <Rocket className="mr-3 h-8 w-8 text-primary" /> Race Strategy Challenge
          </CardTitle>
          {gameState !== "idle" && gameState !== "finished" && (
            <CardDescription>
              Lap: {playerState.lap} / {TOTAL_LAPS} | Position: {playerState.position}{getPositionSuffix(playerState.position)} | Race Time: {(playerState.playerTimeMs / 1000).toFixed(2)}s
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[300px] justify-center">
          {gameState === "idle" && (
            <>
              <p className="text-xl text-muted-foreground">Aim for P1! Execute the best strategy.</p>
              <p className="text-sm text-muted-foreground">A {TOTAL_LAPS}-lap race against the clock.</p>
              <Button onClick={startGame} size="lg" className="mt-6 shadow-lg">
                Start Race
              </Button>
            </>
          )}

          {(gameState === "countdown" || gameState === "lap_transition") && playerState.lastEventMessage && (
            <p className={cn("text-2xl font-semibold animate-pulse", gameState === "countdown" && playerState.lastEventMessage?.includes("GO") && "text-green-400")}>
              {playerState.lastEventMessage}
            </p>
          )}
          
          {gameState === "lap_transition" && currentEvent && (
             <p className="text-lg text-muted-foreground">
                Entering Lap {currentEvent.lap}... Focus!
            </p>
          )}

          {gameState === "event_active" && renderEventContent()}
          
          {playerState.lastEventMessage && (gameState === "lap_transition" || gameState === "event_active") && (
             <p className={cn(
                "text-md mt-2 p-2 rounded-md max-w-md",
                playerState.lastEventMessage.includes("Success") || playerState.lastEventMessage.includes("Great") || playerState.lastEventMessage.includes("Nice") || playerState.lastEventMessage.includes("Kept") || playerState.lastEventMessage.includes("Boost") || playerState.lastEventMessage.includes("Gaining") || playerState.lastEventMessage.includes("Effective") || playerState.lastEventMessage.includes("P1") || playerState.lastEventMessage.includes("Maintained") || playerState.lastEventMessage.includes("Aggressive") || playerState.lastEventMessage.includes("Excellent"),
                "bg-green-500/20 text-green-300",
                playerState.lastEventMessage.includes("Fail") || playerState.lastEventMessage.includes("Missed") || playerState.lastEventMessage.includes("Slow") || playerState.lastEventMessage.includes("Overtaken") || playerState.lastEventMessage.includes("Lost") || playerState.lastEventMessage.includes("Dropped"),
                "bg-red-500/20 text-red-300",
                !(playerState.lastEventMessage.includes("Success") || playerState.lastEventMessage.includes("Great") || playerState.lastEventMessage.includes("Nice") || playerState.lastEventMessage.includes("Kept") || playerState.lastEventMessage.includes("Boost") || playerState.lastEventMessage.includes("Gaining") || playerState.lastEventMessage.includes("Effective") || playerState.lastEventMessage.includes("P1") || playerState.lastEventMessage.includes("Maintained") || playerState.lastEventMessage.includes("Aggressive") || playerState.lastEventMessage.includes("Excellent") || playerState.lastEventMessage.includes("Fail") || playerState.lastEventMessage.includes("Missed") || playerState.lastEventMessage.includes("Slow") || playerState.lastEventMessage.includes("Overtaken") || playerState.lastEventMessage.includes("Lost") || playerState.lastEventMessage.includes("Dropped")) &&
                "bg-blue-500/20 text-blue-300" // For neutral messages like pit info
             )}>
                {playerState.lastEventMessage}
             </p>
          )}

          {gameState === "calculating_results" && (
            <p className="text-xl text-accent animate-pulse">Calculating final results...</p>
          )}

          {gameState === "finished" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center text-4xl font-bold">
                {playerState.position === 1 && <Trophy className="mr-3 h-10 w-10 text-yellow-400" />}
                <p className={playerState.position === 1 ? 'text-green-400' : 'text-accent'}>
                  {playerState.lastEventMessage || `Race Finished! P${playerState.position}`}
                </p>
              </div>
              <p className="text-lg">Your Final Time: {(playerState.playerTimeMs / 1000).toFixed(3)}s</p>
              <Button onClick={startGame} size="lg" variant="outline" className="mt-4">
                <RotateCcw className="mr-2 h-5 w-5" /> Play Again
              </Button>
            </div>
          )}

          {gameState !== "idle" && gameState !== "finished" && (
            <div className="w-full max-w-xs mt-4">
              <label htmlFor="tireWear" className="text-sm text-muted-foreground">Tire Wear</label>
              <Progress value={100 - playerState.tireWear} id="tireWear" className="h-3 mt-1" indicatorClassName={playerState.tireWear > 70 ? 'bg-destructive' : playerState.tireWear > 40 ? 'bg-yellow-500' : 'bg-green-500'} />
              <p className="text-xs text-muted-foreground text-right">{playerState.tireWear}% Worn</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Leaderboard scores={leaderboard} scoreHeaderText="Best Race Time (ms)" />

      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={saveRaceScore}
        reactionTime={Math.round(playerState.playerTimeMs)} 
        scoreMessagePrefix="P1 Finish! Your race time: "
        scoreUnit="ms"
      />
    </div>
  );
}
