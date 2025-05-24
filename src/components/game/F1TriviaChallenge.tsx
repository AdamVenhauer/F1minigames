"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Brain, CheckCircle, XCircle, RotateCcw, HelpCircle } from 'lucide-react';
import { useF1TriviaLogic } from "@/hooks/useF1TriviaLogic";
import { NicknameModal } from "./NicknameModal";
import { Leaderboard } from "./Leaderboard";
import { cn } from "@/lib/utils";

export function F1TriviaChallenge() {
  const {
    gameState,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    score,
    selectedAnswer,
    isAnswerCorrect,
    leaderboard,
    showNicknameModal,
    startGame,
    handleAnswer,
    saveTriviaScore,
    setShowNicknameModal,
  } = useF1TriviaLogic();

  const getButtonClass = (option: string) => {
    if (gameState === "answered" && selectedAnswer === option) {
      return isAnswerCorrect ? "bg-green-500 hover:bg-green-600 border-green-700" : "bg-destructive hover:bg-destructive/90 border-red-700";
    }
    if (gameState === "answered" && option === currentQuestion?.correctAnswer) {
      return "bg-green-500/70 border-green-600"; 
    }
    return "bg-secondary hover:bg-secondary/80";
  };

  return (
    <div className="flex flex-col items-center p-4 text-center">
      <Card className="w-full max-w-2xl mb-8 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl flex items-center justify-center">
            <Brain className="mr-2 h-7 w-7 text-primary" /> F1 Trivia Challenge
          </CardTitle>
          {gameState !== "idle" && gameState !== "finished" && (
            <CardDescription>
              Question {currentQuestionIndex + 1} of {totalQuestions} - Score: {score}
            </CardDescription>
          )}
           {gameState === "finished" && (
            <CardDescription>
              Challenge Complete! Final Score: {score}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 min-h-[350px] justify-center">
          {gameState === "idle" && (
            <div className="flex flex-col items-center space-y-4">
              <HelpCircle className="w-16 h-16 text-accent" />
              <p className="text-xl text-muted-foreground">Ready to test your F1 knowledge?</p>
              <p className="text-sm text-muted-foreground">({totalQuestions > 0 ? totalQuestions : '10'} questions per game)</p>
              <Button onClick={startGame} size="lg" className="mt-4">
                Start Trivia
              </Button>
            </div>
          )}

          {(gameState === "displaying_question" || gameState === "answered") && currentQuestion && (
            <>
              <p className="text-xl font-semibold text-left w-full px-2 sm:px-6">{currentQuestion.questionText}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full px-2 sm:px-6">
                {currentQuestion.options.map((option, index) => (
                  <Button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={gameState === "answered"}
                    className={cn(
                      "justify-start text-left h-auto py-3 whitespace-normal",
                      getButtonClass(option)
                    )}
                    variant="outline"
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {gameState === "answered" && (
                <div className="mt-4 p-3 rounded-md w-full max-w-md text-center">
                  {isAnswerCorrect ? (
                    <div className="flex items-center justify-center text-green-400">
                      <CheckCircle className="mr-2 h-6 w-6" /> Correct!
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-destructive">
                      <XCircle className="mr-2 h-6 w-6" /> Incorrect. 
                      {currentQuestion.correctAnswer && <span className="ml-1">The answer was: {currentQuestion.correctAnswer}</span>}
                    </div>
                  )}
                  {currentQuestion.explanation && (
                    <p className="text-sm text-muted-foreground mt-2">{currentQuestion.explanation}</p>
                  )}
                </div>
              )}
            </>
          )}
          
          {gameState === "finished" && (
             <div className="flex flex-col items-center space-y-4">
                <p className="text-3xl font-bold text-accent">Final Score: {score}</p>
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
        onSubmitNickname={saveTriviaScore}
        reactionTime={score} 
        scoreMessagePrefix="Your final score is "
        scoreUnit=" points"
      />
    </div>
  );
}
