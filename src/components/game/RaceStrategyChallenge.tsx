
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Flag, Zap, Wrench, Wind, CloudDrizzle, Settings2, ShieldAlert, RotateCcw, Trophy, ShieldBan, TriangleAlert, FastForward, Timer } from 'lucide-react'; // Added Timer
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

  const renderEventIcon = () => {
    if (!currentEvent) return <Rocket className="h-5 w-5 mr-2" />;
    if (currentEvent.type === 'qualifying_qte') return <Timer className="h-5 w-5 mr-2 text-purple-400" />;
    if (currentEvent.type === 'start_qte') return <Flag className="h-5 w-5 mr-2 text-green-400" />;
    if (currentEvent.type === 'overtake_qte') return <Zap className="h-5 w-5 mr-2 text-yellow-400" />;
    if (currentEvent.type === 'defend_qte') return <ShieldAlert className="h-5 w-5 mr-2 text-blue-400" />;
    if (currentEvent.type === 'pit_decision') return <Wrench className="h-5 w-5 mr-2 text-orange-400" />;
    if (currentEvent.type === 'drs_qte') return <Wind className="h-5 w-5 mr-2 text-teal-400" />;
    if (currentEvent.type === 'qte_generic') {
        if (currentEvent.event_subtype === 'weather_drizzle') return <CloudDrizzle className="h-5 w-5 mr-2 text-sky-400" />;
        if (currentEvent.event_subtype === 'mechanical_scare') return <Settings2 className="h-5 w-5 mr-2 text-orange-500" />;
        if (currentEvent.event_subtype === 'safety_car_restart') return <Zap className="h-5 w-5 mr-2 text-purple-400" />;
        if (currentEvent.event_subtype === 'yellow_flag') return <ShieldBan className="h-5 w-5 mr-2 text-yellow-500" />;
        if (currentEvent.event_subtype === 'component_warning') return <TriangleAlert className="h-5 w-5 mr-2 text-red-500" />;
        if (currentEvent.event_subtype === 'blue_flags') return <FastForward className="h-5 w-5 mr-2 text-blue-300" />;
    }
    return <Rocket className="h-5 w-5 mr-2" />;
  };

  const renderEventContent = () => {
    if (!currentEvent || (gameState !== "event_active" && gameState !== "qualifying_lap")) return null;
    
    const icon = renderEventIcon();

    return (
      <div className="space-y-4 my-4 w-full px-2">
        <Alert>
          <div className="flex items-start">
            {icon}
            <AlertTitle className="flex-1">{currentEvent.description}</AlertTitle>
          </div>
        </Alert>

        {currentEvent.qteDurationMs && (
          <div className="w-full">
            <Progress value={eventTimer} className="h-3" indicatorClassName={eventTimer > 75 ? "bg-destructive" : eventTimer > 50 ? "bg-yellow-500" : "bg-primary"} />
            <p className="text-xs text-muted-foreground text-center mt-1">Time Remaining</p>
          </div>
        )}

        {currentEvent.type === 'pit_decision' && currentEvent.options ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentEvent.options.map(option => (
              <Button key={option} onClick={() => handleEventAction(option)} size="lg" variant="secondary" className="shadow-md">
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <Button onClick={() => handleEventAction()} size="lg" className="w-full shadow-lg" disabled={gameState !== "event_active" && gameState !== "qualifying_lap"}>
            {currentEvent.actionText || "React!"}
          </Button>
        )}
      </div>
    );
  };

  const getPositionSuffix = (position: number) => {
    if (position === 0) return ""; // Should not happen if position is 1-indexed
    const j = position % 10, k = position % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }

  const renderHeaderInfo = () => {
    if (gameState === "idle" || gameState === "qualifying_result" ) return null;

    if (gameState === "qualifying_lap") {
      return (
        <CardDescription>
          Qualifying Lap in Progress... Current Time: <span className="font-mono">{(playerState.playerTimeMs / 1000).toFixed(3)}s</span>
        </CardDescription>
      );
    }
    // For race states: countdown, event_active, lap_transition, calculating_results
    if (playerState.lap > 0 || gameState === "countdown" || gameState === "calculating_results" || gameState === "lap_transition" || gameState === "event_active" ) {
         return (
            <CardDescription>
              {gameState !== "countdown" && `Lap: ${playerState.lap} / ${TOTAL_LAPS} | `}
              Position: <span className="font-bold">{playerState.position > 0 ? playerState.position : '-'}{playerState.position > 0 ? getPositionSuffix(playerState.position) : ''}</span>
              {gameState !== "countdown" && ` | Race Time: `}
              {gameState !== "countdown" && <span className="font-mono">{(playerState.playerTimeMs / 1000).toFixed(2)}s</span>}
            </CardDescription>
          );
    }
    return null;
  }

  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-2xl mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-3xl flex items-center justify-center">
            <Rocket className="mr-3 h-8 w-8 text-primary" /> Race Strategy Challenge
          </CardTitle>
          {renderHeaderInfo()}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[350px] justify-center">
          {gameState === "idle" && (
            <>
              <p className="text-xl text-muted-foreground">Complete qualifying then race {TOTAL_LAPS} laps for P1!</p>
              <p className="text-sm text-muted-foreground">React to events, manage tires, and make crucial strategy calls.</p>
              <Button onClick={startGame} size="lg" className="mt-6 shadow-lg">
                Start Qualifying
              </Button>
            </>
          )}

          { (gameState === "qualifying_lap" || gameState === "event_active") && renderEventContent()}

          { playerState.lastEventMessage && 
            (gameState === "qualifying_lap" || gameState === "qualifying_result" || gameState === "countdown" || gameState === "lap_transition" || gameState === "event_active") && 
            !playerState.lastEventMessage?.includes("...") && !playerState.lastEventMessage?.includes("GO!") &&
            (
             <Alert className={cn(
                "text-md mt-2 p-3 rounded-md max-w-md mx-auto",
                playerState.lastEventMessage.toLowerCase().includes("success") || playerState.lastEventMessage.toLowerCase().includes("great") || playerState.lastEventMessage.toLowerCase().includes("nice") || playerState.lastEventMessage.toLowerCase().includes("kept") || playerState.lastEventMessage.toLowerCase().includes("boost") || playerState.lastEventMessage.toLowerCase().includes("gaining") || playerState.lastEventMessage.toLowerCase().includes("effective") || playerState.lastEventMessage.toLowerCase().includes("p1") || playerState.lastEventMessage.toLowerCase().includes("maintained") || playerState.lastEventMessage.toLowerCase().includes("aggressive") || playerState.lastEventMessage.toLowerCase().includes("excellent") || playerState.lastEventMessage.toLowerCase().includes("complete") || playerState.lastEventMessage.toLowerCase().includes("gained") || playerState.lastEventMessage.toLowerCase().includes("up to") || playerState.lastEventMessage.toLowerCase().includes("holding") ?
                "bg-green-500/20 text-green-300 border-green-500/30" :
                playerState.lastEventMessage.toLowerCase().includes("fail") || playerState.lastEventMessage.toLowerCase().includes("missed") || playerState.lastEventMessage.toLowerCase().includes("slow") || playerState.lastEventMessage.toLowerCase().includes("overtaken") || playerState.lastEventMessage.toLowerCase().includes("lost") || playerState.lastEventMessage.toLowerCase().includes("dropped") || playerState.lastEventMessage.toLowerCase().includes("penalty") || playerState.lastEventMessage.toLowerCase().includes("stagnated") || playerState.lastEventMessage.toLowerCase().includes("repelled") || playerState.lastEventMessage.toLowerCase().includes("wasted") || playerState.lastEventMessage.toLowerCase().includes("gremlin") || playerState.lastEventMessage.toLowerCase().includes("worsened") ?
                "bg-red-500/20 text-red-300 border-red-500/30 variant-destructive" :
                "bg-blue-500/20 text-blue-300 border-blue-500/30" 
             )}>
                <AlertDescription>{playerState.lastEventMessage}</AlertDescription>
             </Alert>
          )}

           {(gameState === "countdown" || gameState === "qualifying_result") && playerState.lastEventMessage?.includes("...") && (
             <p className="text-4xl font-bold text-accent animate-ping">{playerState.lastEventMessage}</p>
           )}
           {(gameState === "countdown") && playerState.lastEventMessage?.includes("GO!") && (
             <p className="text-5xl font-extrabold text-green-400 animate-pulse">{playerState.lastEventMessage}</p>
           )}
            {gameState === "qualifying_result" && playerState.qualifyingTimeMs !== null && (
                <p className="text-2xl font-semibold text-accent">
                    Quali Time: {(playerState.qualifyingTimeMs / 1000).toFixed(3)}s 
                    {playerState.startingPosition && ` - Starting P${playerState.startingPosition}`}
                </p>
            )}

          {gameState === "calculating_results" && (
            <p className="text-xl text-accent animate-pulse">Calculating final race results...</p>
          )}

          {gameState === "finished" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center text-3xl sm:text-4xl font-bold">
                {playerState.position === 1 && <Trophy className="mr-3 h-8 w-8 sm:h-10 sm:w-10 text-yellow-400" />}
                <p className={playerState.position === 1 ? 'text-green-400' : 'text-accent'}>
                  {playerState.lastEventMessage || `Race Finished! P${playerState.position}`}
                </p>
              </div>
              <Button onClick={startGame} size="lg" variant="outline" className="mt-4">
                <RotateCcw className="mr-2 h-5 w-5" /> Play Again
              </Button>
            </div>
          )}

          {(gameState !== "idle" && gameState !== "qualifying_lap" && gameState !== "qualifying_result" && gameState !== "finished" && gameState !== "calculating_results") && (
            <div className="w-full max-w-xs mt-4">
              <label htmlFor="tireWear" className="text-sm text-muted-foreground">Tire Life</label>
              <Progress value={Math.max(0, 100 - playerState.tireWear)} id="tireWear" className="h-3 mt-1" indicatorClassName={playerState.tireWear > 75 ? 'bg-destructive' : playerState.tireWear > 50 ? 'bg-yellow-500' : 'bg-green-500'} />
              <p className="text-xs text-muted-foreground text-right">{playerState.tireWear}% Worn</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Leaderboard scores={leaderboard} scoreHeaderText="P1 Race Time (ms)" />

      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={saveRaceScore}
        reactionTime={Math.round(playerState.playerTimeMs)} 
        scoreMessagePrefix={playerState.position === 1 ? "P1 Finish! Your race time: " : "Race complete! Your time: "}
        scoreUnit="ms"
      />
    </div>
  );
}

