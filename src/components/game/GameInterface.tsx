
"use client";

import { useGameLogic } from "@/hooks/useGameLogic";
import { StartLights } from "./StartLights";
import { Leaderboard } from "./Leaderboard";
import { NicknameModal } from "./NicknameModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SteeringWheelIcon } from "@/components/icons/SteeringWheelIcon";
import { RotateCcw, Zap, AlertTriangle } from "lucide-react";

export function GameInterface() {
  const {
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
  } = useGameLogic();

  const getButtonText = () => {
    if (gameState === "idle" || gameState === "result" || gameState === "jumpStart") {
      return "Start Reflex Test";
    }
    if (gameState === "lightsSequence" || gameState === "greenLight") {
      return "Click Now!";
    }
    return "Start Reflex Test";
  };

  const getButtonIcon = () => {
    if (gameState === "idle" || gameState === "result" || gameState === "jumpStart") {
      return <SteeringWheelIcon className="mr-2 h-5 w-5" />;
    }
    if (gameState === "lightsSequence" || gameState === "greenLight") {
      return <Zap className="mr-2 h-5 w-5" />;
    }
    return <SteeringWheelIcon className="mr-2 h-5 w-5" />;
  };
  
  const renderGameMessage = () => {
    if (gameState === "jumpStart") {
      return (
        <div className="flex items-center text-destructive text-2xl font-bold animate-pulse">
          <AlertTriangle className="mr-2 h-8 w-8" />
          Jump Start! Too Early!
        </div>
      );
    }
    if (gameState === "result" && reactionTime !== null) {
      return (
        <div className="text-accent text-3xl font-bold">
          Your Reaction: {reactionTime}ms
        </div>
      );
    }
    if (gameState === "lightsSequence") {
      return <div className="text-lg text-muted-foreground">Get Ready...</div>;
    }
    if (gameState === "greenLight") {
      return <div className="text-2xl text-green-400 font-bold animate-ping">GO!</div>;
    }
    return <div className="text-lg text-muted-foreground">Click "Start Reflex Test" to test your reflexes!</div>;
  };

  const mainButtonAction = () => {
    if (gameState === "idle" || gameState === "result" || gameState === "jumpStart") {
      startGame();
    } else {
      handleGameClick();
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <Card className="w-full max-w-lg mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Reflex Test Zone</CardTitle>
          <CardDescription>Focus on the lights!</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <StartLights gameState={gameState} activeRedLights={activeRedLights} />
          
          <div className="h-12 flex items-center justify-center" aria-live="polite">
            {renderGameMessage()}
          </div>

          <Button
            onClick={mainButtonAction}
            size="lg"
            className="w-full max-w-xs text-lg py-6 rounded-lg shadow-lg transition-transform hover:scale-105 focus:ring-4 focus:ring-accent/50"
            variant={gameState === "greenLight" ? "default" : "secondary"}
            disabled={gameState === "lightsSequence" && activeRedLights < 5}
            aria-label={getButtonText()}
          >
            {getButtonIcon()}
            {getButtonText()}
          </Button>

          {(gameState === "result" || gameState === "jumpStart") && (
             <Button
              onClick={resetGame}
              variant="outline"
              size="sm"
              className="mt-4"
              aria-label="Try Again"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>

      <Leaderboard scores={leaderboard} />

      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={saveScore}
        reactionTime={reactionTime}
      />
    </div>
  );
}
