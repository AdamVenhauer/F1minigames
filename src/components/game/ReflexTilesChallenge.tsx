
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Target, RotateCcw, Award } from 'lucide-react';
import { useReflexTilesLogic } from "@/hooks/useReflexTilesLogic";
import { NicknameModal } from "./NicknameModal";
import { Leaderboard } from "./Leaderboard";
import { cn } from "@/lib/utils";

export function ReflexTilesChallenge() {
  const {
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
  } = useReflexTilesLogic();

  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-md mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl flex items-center justify-center">
            <Target className="mr-2 h-7 w-7 text-primary" /> Reflex Tiles Challenge
          </CardTitle>
          {gameState === "playing" && (
            <CardDescription>
              Score: {score} | Tiles Hit: {correctHits} / {TILES_TO_COMPLETE}
            </CardDescription>
          )}
          {gameState === "finished" && (
            <CardDescription>
              Challenge Complete! Final Score: {score} | Avg Reaction: {averageReactionTime}ms
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[300px] justify-center">
          {gameState === "idle" && (
            <div className="flex flex-col items-center space-y-4">
              <Target className="w-16 h-16 text-accent" />
              <p className="text-xl text-muted-foreground">Hit {TILES_TO_COMPLETE} tiles as fast as you can!</p>
              <Button onClick={startGame} size="lg" className="mt-4">
                Start Challenge
              </Button>
            </div>
          )}

          {(gameState === "playing" || gameState === "finished") && (
             <div 
              className="grid gap-2 p-2 bg-secondary/30 rounded-lg shadow-inner"
              style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
            >
              {tiles.map((tile) => (
                <Button
                  key={tile.id}
                  variant="outline"
                  className={cn(
                    "aspect-square h-20 w-20 sm:h-24 sm:w-24 text-2xl font-bold transition-all duration-100 ease-in-out",
                    tile.isLit ? "bg-accent text-accent-foreground animate-pulse ring-2 ring-offset-2 ring-accent" : "bg-muted hover:bg-muted/80",
                    gameState === "finished" && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleTileClick(tile.id)}
                  disabled={gameState === "finished"}
                  aria-label={`Tile ${tile.id + 1}`}
                >
                  {/* Can add content inside tiles if needed, e.g., tile.id + 1 */}
                </Button>
              ))}
            </div>
          )}
          
          {gameState === "finished" && (
             <div className="flex flex-col items-center space-y-4 mt-6">
                <p className="text-3xl font-bold text-accent flex items-center">
                  <Award className="mr-2 h-8 w-8" /> Final Score: {score}
                </p>
                {averageReactionTime > 0 && (
                    <p className="text-lg text-muted-foreground">Average Reaction: {averageReactionTime}ms</p>
                )}
                <Button onClick={startGame} size="lg" variant="outline" className="mt-4">
                    <RotateCcw className="mr-2 h-5 w-5" /> Play Again
                </Button>
            </div>
          )}

        </CardContent>
      </Card>
      <Leaderboard scores={leaderboard} scoreHeaderText="Score" />
      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmitNickname={saveReflexTilesScore}
        reactionTime={score} 
        scoreMessagePrefix="Your final score is "
        scoreUnit=" points"
      />
    </div>
  );
}
