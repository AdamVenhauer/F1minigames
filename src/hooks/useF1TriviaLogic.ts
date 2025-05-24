
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScoreEntry, TriviaQuestion, F1TriviaGameState } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone';

const F1_TRIVIA_LEADERBOARD_KEY = "apexF1TriviaLeaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const POINTS_PER_CORRECT_ANSWER = 10;

const TRIVIA_QUESTIONS_SET: TriviaQuestion[] = [
  { id: 'q1', questionText: 'Lewis Hamilton has won how many F1 World Championships as of the end of the 2023 season?', options: ['5', '6', '7', '8'], correctAnswer: '7', explanation: 'Lewis Hamilton is tied with Michael Schumacher with 7 World Championships.' },
  { id: 'q2', questionText: 'In which year was the first official F1 World Championship race held?', options: ['1948', '1950', '1952', '1960'], correctAnswer: '1950' },
  { id: 'q3', questionText: 'What does DRS stand for in F1?', options: ['Direct Racing System', 'Drag Reduction System', 'Driver Reaction System', 'Dynamic Racing Setup'], correctAnswer: 'Drag Reduction System' },
  { id: 'q4', questionText: 'Which team has won the most F1 Constructors\' Championships as of end of 2023?', options: ['McLaren', 'Williams', 'Mercedes', 'Ferrari'], correctAnswer: 'Ferrari' },
  { id: 'q5', questionText: 'What is the home country of the Monza circuit, famously known as the "Temple of Speed"?', options: ['France', 'Germany', 'Italy', 'Spain'], correctAnswer: 'Italy' },
  { id: 'q6', questionText: 'Which F1 driver is known by the nickname "The Honey Badger"?', options: ['Max Verstappen', 'Daniel Ricciardo', 'Lando Norris', 'Charles Leclerc'], correctAnswer: 'Daniel Ricciardo' },
  { id: 'q7', questionText: 'What is the maximum number of points a driver can score in a single F1 race weekend (including sprint race and fastest lap)?', options: ['25', '26', '33', '34'], correctAnswer: '34', explanation: '25 (win) + 1 (fastest lap) + 8 (sprint win) = 34 points.' },
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

  const loadQuestion = useCallback((index: number) => {
    if (index < questions.length) {
      setCurrentQuestion(questions[index]);
      setSelectedAnswer(null);
      setIsAnswerCorrect(null);
      setGameState("displaying_question");
    } else {
      // All questions answered
      setGameState("finished");
      playSound('complete');
      const isTopScore = score > 0 && (leaderboard.length < MAX_LEADERBOARD_ENTRIES || score > leaderboard[leaderboard.length - 1].time);
      if (isTopScore) {
        setShowNicknameModal(true);
      }
    }
  }, [questions, leaderboard, score, playSound]);

  const startGame = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const shuffledQuestions = shuffleArray(TRIVIA_QUESTIONS_SET);
    setQuestions(shuffledQuestions);
    setScore(0);
    setCurrentQuestionIndex(0);
    setShowNicknameModal(false);
    loadQuestion(0); // Load the first question from the shuffled set
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
      loadQuestion(nextIndex);
    }, 2000); // Show feedback for 2 seconds

  }, [gameState, currentQuestion, currentQuestionIndex, playSound, loadQuestion]);
  

  const saveTriviaScore = useCallback((nickname: string) => {
    const newScore: ScoreEntry = {
      id: Date.now().toString(),
      nickname,
      time: score, // Store score in the 'time' field for consistency with ScoreEntry
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.time - a.time) // Sort descending for trivia (higher score is better)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem(F1_TRIVIA_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
    setShowNicknameModal(false);
    toast({ title: "Score Saved!", description: `Great F1 knowledge, ${nickname}!` });
  }, [score, leaderboard, toast]);

  const totalQuestions = questions.length;

  return {
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
  };
}
