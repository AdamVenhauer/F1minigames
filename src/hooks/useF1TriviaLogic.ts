"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, TriviaQuestion, F1TriviaGameState } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const F1_TRIVIA_LEADERBOARD_KEY = "apexF1TriviaLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const POINTS_PER_CORRECT_ANSWER = 10;
const QUESTIONS_PER_GAME = 10;

const TRIVIA_QUESTIONS_SET: TriviaQuestion[] = [
  { id: 'q1', questionText: 'Lewis Hamilton has won how many F1 World Championships as of the end of the 2023 season?', options: ['5', '6', '7', '8'], correctAnswer: '7', explanation: 'Lewis Hamilton is tied with Michael Schumacher with 7 World Championships.' },
  { id: 'q2', questionText: 'In which year was the first official F1 World Championship race held?', options: ['1948', '1950', '1952', '1960'], correctAnswer: '1950', explanation: 'The first race contributing to the World Championship was the British Grand Prix at Silverstone on May 13, 1950.' },
  { id: 'q3', questionText: 'What does DRS stand for in F1?', options: ['Direct Racing System', 'Drag Reduction System', 'Driver Reaction System', 'Dynamic Racing Setup'], correctAnswer: 'Drag Reduction System', explanation: 'DRS is an adjustable rear wing that reduces aerodynamic drag to aid overtaking.' },
  { id: 'q4', questionText: 'Which team has won the most F1 Constructors\' Championships as of end of 2023?', options: ['McLaren', 'Williams', 'Mercedes', 'Ferrari'], correctAnswer: 'Ferrari', explanation: 'Ferrari holds the record for the most Constructors\' Championships.' },
  { id: 'q5', questionText: 'What is the home country of the Monza circuit, famously known as the "Temple of Speed"?', options: ['France', 'Germany', 'Italy', 'Spain'], correctAnswer: 'Italy', explanation: 'Monza is located near Milan, Italy.' },
  { id: 'q6', questionText: 'Which F1 driver is known by the nickname "The Honey Badger"?', options: ['Max Verstappen', 'Daniel Ricciardo', 'Lando Norris', 'Charles Leclerc'], correctAnswer: 'Daniel Ricciardo', explanation: 'Daniel Ricciardo is known for his aggressive racing style and cheerful demeanor, hence the nickname.' },
  { id: 'q7', questionText: 'What is the maximum number of points a driver can score in a single F1 race weekend (including sprint race and fastest lap, pre-2024 format)?', options: ['25', '26', '33', '34'], correctAnswer: '34', explanation: '25 (win) + 1 (fastest lap if in top 10) + 8 (sprint win) = 34 points.' },
  { id: 'q8', questionText: 'Which constructor won their first F1 race in 2020 at the Sakhir Grand Prix?', options: ['AlphaTauri', 'Racing Point', 'Haas', 'Alpine'], correctAnswer: 'Racing Point', explanation: 'Racing Point, now Aston Martin, won with Sergio Pérez at the Sakhir Grand Prix.' },
  { id: 'q9', questionText: 'What was the minimum weight limit for an F1 car (without fuel, with driver) for the 2023 season?', options: ['752 kg', '798 kg', '810 kg', '740 kg'], correctAnswer: '798 kg', explanation: 'The minimum weight limit was 798 kg for the 2023 F1 season.'},
  { id: 'q10', questionText: 'Who was the first-ever Formula 1 World Champion?', options: ['Juan Manuel Fangio', 'Alberto Ascari', 'Giuseppe "Nino" Farina', 'Stirling Moss'], correctAnswer: 'Giuseppe "Nino" Farina', explanation: 'Nino Farina won the inaugural championship in 1950 driving for Alfa Romeo.' },
  { id: 'q11', questionText: 'The "Senna S" is a famous corner sequence at which F1 circuit?', options: ['Silverstone', 'Spa-Francorchamps', 'Interlagos', 'Monaco'], correctAnswer: 'Interlagos', explanation: 'The Senna S is at the Autódromo José Carlos Pace (Interlagos) in Brazil.' },
  { id: 'q12', questionText: 'What material are F1 car monocoques primarily made from for strength and lightness?', options: ['Titanium Alloy', 'Aluminum Honeycomb', 'Carbon Fibre Composite', 'Steel Spaceframe'], correctAnswer: 'Carbon Fibre Composite', explanation: 'Carbon fibre composites offer an excellent strength-to-weight ratio.' },
  { id: 'q13', questionText: 'How many teams typically competed in the Formula 1 season as of 2023-2024?', options: ['8', '10', '12', '11'], correctAnswer: '10', explanation: 'There are typically 10 teams, each fielding two drivers.' },
  { id: 'q14', questionText: 'What color flag is waved to indicate the end of a race session?', options: ['Yellow Flag', 'Green Flag', 'Red Flag', 'Chequered Flag'], correctAnswer: 'Chequered Flag' },
  { id: 'q15', questionText: 'Which driver holds the record for the most F1 race wins as of the end of 2023?', options: ['Michael Schumacher', 'Ayrton Senna', 'Lewis Hamilton', 'Sebastian Vettel'], correctAnswer: 'Lewis Hamilton' },
  { id: 'q16', questionText: 'The Eau Rouge / Raidillon complex is a famous sequence of corners at which circuit?', options: ['Monza', 'Nürburgring', 'Silverstone', 'Spa-Francorchamps'], correctAnswer: 'Spa-Francorchamps' },
  { id: 'q17', questionText: 'What is Kimi Räikkönen\'s nickname?', options: ['The Professor', 'The Iceman', 'The Flying Finn', 'The Stig'], correctAnswer: 'The Iceman', explanation: 'Known for his calm and cool demeanor.' },
  { id: 'q18', questionText: 'In F1, what does a blue flag mean?', options: ['Dangerous conditions ahead', 'Faster car approaching, let them pass', 'End of session', 'Slippery track'], correctAnswer: 'Faster car approaching, let them pass', explanation: 'A blue flag is shown to a slower car when a faster car is trying to lap them.' },
  { id: 'q19', questionText: 'Which of these is NOT a type of tire compound used in F1 (as of recent seasons)?', options: ['Soft', 'Medium', 'Hard', 'Super-Hard'], correctAnswer: 'Super-Hard', explanation: 'Pirelli typically offers Soft, Medium, and Hard dry compounds, plus Intermediate and Wet tires.' },
  { id: 'q20', questionText: 'What is a "Grand Chelem" or "Grand Slam" in F1?', options: ['Winning 4 races in a row', 'Winning from pole, leading every lap, and setting fastest lap', 'Winning the championship with most poles', 'Finishing on podium in every race'], correctAnswer: 'Winning from pole, leading every lap, and setting fastest lap' },
  { id: 'q21', questionText: 'Which team introduced the "double diffuser" in 2009, leading to a championship win?', options: ['Ferrari', 'McLaren', 'Red Bull Racing', 'Brawn GP'], correctAnswer: 'Brawn GP', explanation: 'Brawn GP, Toyota, and Williams exploited a loophole for the double diffuser.' },
  { id: 'q22', questionText: 'What is the name of the F1 circuit located in Monte Carlo?', options: ['Circuit de Monaco', 'Circuit Paul Ricard', 'Circuit de Nevers Magny-Cours', 'Circuit de la Sarthe'], correctAnswer: 'Circuit de Monaco' },
  { id: 'q23', questionText: 'Who is the CEO of Formula One Group as of early 2024?', options: ['Bernie Ecclestone', 'Chase Carey', 'Stefano Domenicali', 'Jean Todt'], correctAnswer: 'Stefano Domenicali' },
  { id: 'q24', questionText: 'Which country hosts the F1 race at the Albert Park Circuit?', options: ['Canada', 'Australia', 'Brazil', 'United States'], correctAnswer: 'Australia', explanation: 'The Australian Grand Prix is typically held at Albert Park in Melbourne.' },
  { id: 'q25', questionText: 'What does "Parc Fermé" refer to in F1?', options: ['The pit lane entry', 'The VIP hospitality area', 'A secure area where cars are kept post-session to prevent unauthorized work', 'The driver briefing room'], correctAnswer: 'A secure area where cars are kept post-session to prevent unauthorized work' },
  { id: 'q26', questionText: 'Which driver famously drove for McLaren and Ferrari, winning championships with both?', options: ['Niki Lauda', 'Alain Prost', 'Ayrton Senna', 'Michael Schumacher'], correctAnswer: 'Niki Lauda', explanation: 'Lauda won with Ferrari (1975, 1977) and McLaren (1984).' },
  { id: 'q27', questionText: 'What is the primary role of the FIA in Formula 1?', options: ['Broadcasting the races', 'Team ownership', 'Governing body and rule maker', 'Sponsorship management'], correctAnswer: 'Governing body and rule maker', explanation: 'FIA stands for Fédération Internationale de l\'Automobile.' },
  { id: 'q28', questionText: 'The "Wall of Champions" is a notorious part of which F1 circuit?', options: ['Circuit Gilles Villeneuve (Canada)', 'Hungaroring (Hungary)', 'Baku City Circuit (Azerbaijan)', 'Marina Bay Street Circuit (Singapore)'], correctAnswer: 'Circuit Gilles Villeneuve (Canada)', explanation: 'Many champions have crashed at the final chicane there.' },
  { id: 'q29', questionText: 'As of the end of 2023, who is the youngest driver to ever start an F1 race?', options: ['Lando Norris', 'Lance Stroll', 'Max Verstappen', 'Jaime Alguersuari'], correctAnswer: 'Max Verstappen', explanation: 'Max Verstappen was 17 years and 166 days old at the 2015 Australian Grand Prix.' },
  { id: 'q30', questionText: 'What year saw the introduction of the V6 turbo-hybrid power units in F1?', options: ['2010', '2012', '2014', '2016'], correctAnswer: '2014' },
  { id: 'q31', questionText: 'What is the name of McLaren\'s headquarters?', options: ['Maranello Technology Centre', 'McLaren Technology Centre', 'Grove Technical Centre', 'Enstone Technology Park'], correctAnswer: 'McLaren Technology Centre', explanation: 'Often abbreviated as MTC, located in Woking, UK.' },
  { id: 'q32', questionText: 'Which driver has the most F1 pole positions as of the end of 2023?', options: ['Ayrton Senna', 'Michael Schumacher', 'Lewis Hamilton', 'Sebastian Vettel'], correctAnswer: 'Lewis Hamilton' },
  { id: 'q33', questionText: 'The term "undercut" in F1 strategy refers to:', options: ['Driving under another car', 'Pitting earlier than a rival to gain track position', 'Taking a shortcut on the track', 'Using less fuel than allowed'], correctAnswer: 'Pitting earlier than a rival to gain track position', explanation: 'The aim is to use fresh tires to set faster lap times while the rival is on older tires.' },
  { id: 'q34', questionText: 'Which of these circuits is known for being the longest on the F1 calendar?', options: ['Monaco', 'Spa-Francorchamps', 'Silverstone', 'Baku City Circuit'], correctAnswer: 'Spa-Francorchamps', explanation: 'Circuit de Spa-Francorchamps is over 7km long.' },
  { id: 'q35', questionText: 'Who was the legendary F1 commentator known for the phrase "And it\'s lights out and away we go!"?', options: ['Martin Brundle', 'James Hunt', 'Murray Walker', 'David Croft'], correctAnswer: 'Murray Walker' },
  { id: 'q36', questionText: 'What safety device, introduced fully in 2018, protects the driver\'s head?', options: ['HANS Device', 'Roll Hoop', 'Halo', 'Side Impact Structures'], correctAnswer: 'Halo' },
  { id: 'q37', questionText: 'Which team is based in Silverstone, UK, adjacent to the circuit?', options: ['Mercedes-AMG Petronas F1 Team', 'Oracle Red Bull Racing', 'Aston Martin Aramco F1 Team', 'Williams Racing'], correctAnswer: 'Aston Martin Aramco F1 Team', explanation: 'Their factory is located right next to the Silverstone Circuit.' },
  { id: 'q38', questionText: 'How many World Championships did Ayrton Senna win?', options: ['2', '3', '4', '5'], correctAnswer: '3', explanation: 'Ayrton Senna won championships in 1988, 1990, and 1991.' },
  { id: 'q39', questionText: 'The "Prancing Horse" is the famous symbol of which F1 team?', options: ['McLaren', 'Williams', 'Ferrari', 'Mercedes'], correctAnswer: 'Ferrari' },
  { id: 'q40', questionText: 'What is the minimum time penalty a driver can receive for speeding in the pit lane during a race?', options: ['1 second', '3 seconds', '5 seconds', '10 seconds'], correctAnswer: '5 seconds', explanation: 'A 5-second time penalty is common for this offense.' },
  { id: 'q41', questionText: 'Which F1 team was previously known as Jordan, Midland, Spyker, and Force India?', options: ['Sauber', 'Minardi', 'Racing Point/Aston Martin', 'Toro Rosso/AlphaTauri'], correctAnswer: 'Racing Point/Aston Martin' },
  { id: 'q42', questionText: 'What does "ERS" stand for in the context of F1 power units?', options: ['Engine Recovery System', 'Energy Recovery System', 'Exhaust Recuperation System', 'Electronic Racing Software'], correctAnswer: 'Energy Recovery System' },
  { id: 'q43', questionText: 'The first F1 night race was held in which country?', options: ['Bahrain', 'Abu Dhabi', 'Singapore', 'Qatar'], correctAnswer: 'Singapore', explanation: 'The Singapore Grand Prix was the first F1 night race in 2008.' },
  { id: 'q44', questionText: 'Which driver won the F1 World Championship in 2016 and then immediately retired?', options: ['Jenson Button', 'Felipe Massa', 'Nico Rosberg', 'Sebastian Vettel'], correctAnswer: 'Nico Rosberg' },
  { id: 'q45', questionText: 'What is the name of Ferrari\'s private test track?', options: ['Balocco', 'Imola', 'Mugello', 'Fiorano'], correctAnswer: 'Fiorano Circuit' },
  { id: 'q46', questionText: 'A "stint" in F1 refers to:', options: ['A single lap', 'A driver\'s career length', 'The period a driver spends on track between pit stops', 'A type of suspension component'], correctAnswer: 'The period a driver spends on track between pit stops' },
  { id: 'q47', questionText: 'Which F1 circuit features the famous "Maggotts, Becketts, Chapel" sequence of corners?', options: ['Monza', 'Silverstone', 'Suzuka', 'Catalunya'], correctAnswer: 'Silverstone' },
  { id: 'q48', questionText: 'In F1, what is "dirty air"?', options: ['Polluted air from factories near a track', 'Turbulent air behind another F1 car, reducing downforce', 'Air that has passed through the engine', 'Air with high humidity'], correctAnswer: 'Turbulent air behind another F1 car, reducing downforce' },
  { id: 'q49', questionText: 'Who is the only driver to have won the F1 World Championship, the Indianapolis 500, and the 24 Hours of Le Mans (the "Triple Crown of Motorsport")?', options: ['Jim Clark', 'Mario Andretti', 'Graham Hill', 'Fernando Alonso'], correctAnswer: 'Graham Hill' },
  { id: 'q50', questionText: 'Which company has been the sole tire supplier to F1 in recent years (e.g., 2011-2024)?', options: ['Michelin', 'Bridgestone', 'Goodyear', 'Pirelli'], correctAnswer: 'Pirelli' },
  { id: 'q51', questionText: 'What is the role of a "lollipop man" in a traditional F1 pit stop (though now less common)?', options: ['To hand the driver a drink', 'To signal the driver when to leave the pit box', 'To clean the driver\'s visor', 'To check tire pressures'], correctAnswer: 'To signal the driver when to leave the pit box', explanation: 'The lollipop-shaped sign indicated when it was safe to go.'},
  { id: 'q52', questionText: 'Which team famously ran with a six-wheeled car (the P34) in the 1970s?', options: ['Lotus', 'Brabham', 'Tyrrell', 'March'], correctAnswer: 'Tyrrell', explanation: 'The Tyrrell P34 had four small front wheels and two standard rear wheels.'},
  { id: 'q53', questionText: 'What is the term for the aerodynamic effect that helps pull a car forward when closely following another, especially on straights?', options: ['Ground Effect', 'Slipstream (or Tow)', 'Venturi Effect', 'Coandă Effect'], correctAnswer: 'Slipstream (or Tow)'},
  { id: 'q54', questionText: 'Which F1 track is located in the desert and often hosts pre-season testing?', options: ['Yas Marina Circuit', 'Bahrain International Circuit', 'Losail International Circuit', 'Jeddah Street Circuit'], correctAnswer: 'Bahrain International Circuit'},
  { id: 'q55', questionText: 'What do the letters in "KERS" stand for?', options: ['Kinetic Energy Recharging System', 'Kinetic Energy Recovery System', 'Kinetic Engine Regulation System', 'Key Energy Release System'], correctAnswer: 'Kinetic Energy Recovery System'},
];


export function useF1TriviaLogic() {
  const [gameState, setGameState] = useState<F1TriviaGameState>("idle");
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const { toast } = useToast();

  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const synthsRef = useRef<{
    correct?: Tone.Synth;
    incorrect?: Tone.NoiseSynth;
    complete?: Tone.PolySynth;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !synthsRef.current) {
      synthsRef.current = {
        correct: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 }}).toDestination(),
        incorrect: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }}).toDestination(),
        complete: new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }}).toDestination(),
      };
    }
    const storedLeaderboard = localStorage.getItem(F1_TRIVIA_LEADERBOARD_KEY);
    if (storedLeaderboard) {
      setLeaderboard(JSON.parse(storedLeaderboard));
    }
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (synthsRef.current) {
        Object.values(synthsRef.current).forEach(synth => synth?.dispose());
        synthsRef.current = null;
      }
    };
  }, []);
  
  const playSound = useCallback((type: 'correct' | 'incorrect' | 'complete') => {
    if (Tone.context.state !== 'running') Tone.start().catch(e => console.error("Tone.start failed:", e));
    const synth = synthsRef.current?.[type];
    if (!synth) return;
    const now = Tone.now();
    if (type === 'correct' && synth instanceof Tone.Synth) synth.triggerAttackRelease("C5", "8n", now + 0.02);
    else if (type === 'incorrect' && synth instanceof Tone.NoiseSynth) synth.triggerAttackRelease("2n", now + 0.03);
    else if (type === 'complete' && synth instanceof Tone.PolySynth) synth.triggerAttackRelease(["C4", "E4", "G4"], "4n", now + 0.02);
  }, []);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const loadQuestion = useCallback((index: number, currentQuestionsSet: TriviaQuestion[]) => {
    if (index < currentQuestionsSet.length) {
      setCurrentQuestion(currentQuestionsSet[index]);
      setSelectedAnswer(null);
      setIsAnswerCorrect(null);
      setGameState("displaying_question");
    } else {
      setGameState("finished");
      playSound('complete');
      const isTopScore = score > 0 && (leaderboard.length < MAX_LEADERBOARD_ENTRIES || score > leaderboard[leaderboard.length - 1].time);
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [leaderboard, score, playSound]);

  const startGame = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const shuffledQuestions = shuffleArray(TRIVIA_QUESTIONS_SET);
    const gameQuestions = shuffledQuestions.slice(0, QUESTIONS_PER_GAME);
    setQuestions(gameQuestions);
    setScore(0);
    setCurrentQuestionIndex(0);
    setShowNicknameModal(false);
    loadQuestion(0, gameQuestions); 
  }, [loadQuestion]);


  const handleAnswer = useCallback((selectedOption: string) => {
    if (gameState !== "displaying_question" || !currentQuestion) return;

    setSelectedAnswer(selectedOption);
    const correct = selectedOption === currentQuestion.correctAnswer;
    setIsAnswerCorrect(correct);

    if (correct) {
      setScore(prevScore => prevScore + POINTS_PER_CORRECT_ANSWER);
      playSound('correct');
    } else {
      playSound('incorrect');
    }
    setGameState("answered");

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      loadQuestion(nextIndex, questions); // Pass the current set of game questions
    }, currentQuestion.explanation || !correct ? 3000 : 1500); // Longer delay if explanation or incorrect

  }, [gameState, currentQuestion, currentQuestionIndex, playSound, loadQuestion, questions]);
  

  const saveTriviaScore = useCallback((nickname: string) => {
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: score, 
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.time - a.time) 
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(F1_TRIVIA_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Score Saved!", description: `Great F1 knowledge, ${nickname}!` });
  }, [score, leaderboard, toast]);

  const totalQuestionsInGame = questions.length; // This will now be 10 (or less if total pool is smaller)

  return {
    gameState,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions: totalQuestionsInGame,
    score,
    selectedAnswer,
    isAnswerCorrect,
    leaderboard,
    showNicknameModal,
    startGame,
    handleAnswer,
    saveTriviaScore,
    setShowNicknameModal,
  };
}
