
export interface ScoreEntry {
  id: string;
  nickname: string;
  time: number; // Can be time in ms or points for trivia/gear shift
  date: string; // ISO date string
}

export type GameState =
  | "idle"
  | "lightsSequence"
  | "greenLight"
  | "jumpStart"
  | "result";

export interface TriviaQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export type F1TriviaGameState =
  | "idle"
  | "displaying_question"
  | "answered"
  | "finished";
