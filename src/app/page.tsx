
"use client";
import { useState, type ReactNode } from 'react';
import { GameInterface } from "@/components/game/GameInterface";
import { PitStopChallenge } from "@/components/game/PitStopChallenge";
import { GearShiftChallenge } from "@/components/game/GearShiftChallenge";
import { F1TriviaChallenge } from "@/components/game/F1TriviaChallenge";
import { RaceStrategyChallenge } from "@/components/game/RaceStrategyChallenge";
import { ReflexTilesChallenge } from "@/components/game/ReflexTilesChallenge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, Zap, Wrench, Gauge, Brain, Rocket, Settings, LayoutGrid } from 'lucide-react';
import { SettingsDialog } from '@/components/layout/SettingsDialog';
import { Analytics } from "@vercel/analytics/next"

type GameKey = 'menu' | 'reflex' | 'pitstop' | 'gearshift' | 'trivia' | 'race_strategy' | 'reflex_tiles';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const renderSelectedGame = () => {
    switch (selectedGame) {
      case 'reflex':
        return <GameInterface />;
      case 'pitstop':
        return <PitStopChallenge />;
      case 'gearshift':
        return <GearShiftChallenge />;
      case 'trivia':
        return <F1TriviaChallenge />;
      case 'race_strategy':
        return <RaceStrategyChallenge />;
      case 'reflex_tiles':
        return <ReflexTilesChallenge />;
      default:
        return null;
    }
  };

  if (selectedGame !== 'menu') {
    return (
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => setSelectedGame('menu')} variant="outline" className="shadow-md">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Games
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="shadow-md" aria-label="Open Settings">
            <Settings className="h-6 w-6 text-primary" />
          </Button>
        </div>
        {renderSelectedGame()}
        <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--footer-height,100px))] p-4 pt-12 md:pt-20">
      <header className="mb-10 md:mb-16 text-center relative w-full max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-primary">
          Apex Start Arena
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mt-2">Choose Your F1 Challenge!</p>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsSettingsOpen(true)} 
          className="absolute top-0 right-0 md:top-2 md:right-2 shadow-md"
          aria-label="Open Settings"
        >
          <Settings className="h-7 w-7 text-primary hover:text-primary/80" />
        </Button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full max-w-4xl">
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
        <GameSelectionCard 
          title="Race Strategy"
          description="Make critical calls to win the race."
          icon={<Rocket className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('race_strategy')}
        />
        <GameSelectionCard 
          title="Reflex Tiles"
          description="Hit the lit tiles as quickly as possible."
          icon={<LayoutGrid className="w-10 h-10 text-accent" />}
          onClick={() => setSelectedGame('reflex_tiles')}
        />
      </div>
      <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <style jsx global>{`
        :root {
          --footer-height: 110px; /* Approximate height of your footer */
        }
        body {
          background: 
            linear-gradient(rgba(21, 23, 29, 0.9), rgba(21, 23, 29, 0.9)),
            url('https://placehold.co/1920x1080.png') no-repeat center center fixed;
          background-size: cover;
          /* data-ai-hint: race illustration */
        }
      `}</style>
    </div>
  );
}
