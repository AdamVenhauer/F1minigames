
"use client";
import { useState, type ReactNode } from 'react';
import { GameInterface } from "@/components/game/GameInterface";
import { PitStopChallenge } from "@/components/game/PitStopChallenge";
import { GearShiftChallenge } from "@/components/game/GearShiftChallenge";
import { F1TriviaChallenge } from "@/components/game/F1TriviaChallenge"; // Added import
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, Zap, Wrench, Gauge, Brain } from 'lucide-react'; // Added Brain icon

type GameKey = 'menu' | 'reflex' | 'pitstop' | 'gearshift' | 'trivia'; // Added 'trivia'

interface GameCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}

function GameSelectionCard({ title, description, icon, onClick }: GameCardProps) {
  return (
    <Card 
      className="hover:shadow-primary/30 hover:border-primary cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 bg-card/70 backdrop-blur-sm"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        {icon}
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Click to play!</p>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const [selectedGame, setSelectedGame] = useState<GameKey>('menu');

  const renderSelectedGame = () => {
    switch (selectedGame) {
      case 'reflex':
        return <GameInterface />;
      case 'pitstop':
        return <PitStopChallenge />;
      case 'gearshift':
        return <GearShiftChallenge />;
      case 'trivia': // Added case for F1TriviaChallenge
        return <F1TriviaChallenge />;
      default:
        return null;
    }
  };

  if (selectedGame !== 'menu') {
    return (
      <div className="p-4 md:p-8">
        <Button onClick={() => setSelectedGame('menu')} variant="outline" className="mb-6 shadow-md">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Games
        </Button>
        {renderSelectedGame()}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--footer-height,100px))] p-4 pt-12 md:pt-20"> {/* Adjust min-height based on footer */}
      <header className="mb-10 md:mb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-primary">
          Apex Start Arena
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mt-2">Choose Your F1 Challenge!</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-3xl">
        <GameSelectionCard
          title="Reflex Test"
          description="Test your starting light reaction time."
          icon={<Zap className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('reflex')}
        />
        <GameSelectionCard
          title="Pit Stop Challenge"
          description="Execute a lightning-fast pit stop."
          icon={<Wrench className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('pitstop')}
        />
        <GameSelectionCard 
          title="Gear Shift Precision"
          description="Time your shifts perfectly up the gearbox."
          icon={<Gauge className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('gearshift')}
        />
        <GameSelectionCard 
          title="F1 Trivia Challenge"
          description="Test your Formula 1 knowledge."
          icon={<Brain className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('trivia')}
        />
      </div>
      <style jsx global>{`
        :root {
          --footer-height: 110px; /* Approximate height of your footer */
        }
        body {
          background: 
            linear-gradient(rgba(21, 23, 29, 0.9), rgba(21, 23, 29, 0.9)),
            url('https://placehold.co/1920x1080/2a2f36/3a3f46.png?text=F1+Background') no-repeat center center fixed;
          background-size: cover;
          /* data-ai-hint: abstract race track */
        }
      `}</style>
    </div>
  );
}
