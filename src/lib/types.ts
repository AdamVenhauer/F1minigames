
export interface ScoreEntry {
  id: string;
  nickname: string;
  time: number; // Can be time in ms or points for trivia/gear shift/race time
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

// Types for Race Strategy Challenge
export type RaceStrategyGameState =
  | "idle"
  | "countdown" // Initial countdown before race start
  | "event_active" // An event (QTE, decision) is currently active
  | "lap_transition" // Brief state showing lap/position updates
  | "calculating_results" // Brief state after last event before showing final results
  | "finished"; // Race completed, results shown

export interface PlayerRaceState {
  lap: number;
  position: 1 | 2; // 1st or 2nd
  tireWear: number; // 0-100, 0 is fresh, 100 is worn out
  playerTimeMs: number; // Player's cumulative time
  rivalTimeMs: number; // Rival's cumulative time
  lastEventMessage: string | null; // Feedback from the last event
}

export interface RaceEvent {
  id: string; // Unique ID for the event
  lap: number; // Lap on which this event occurs
  type: "start_qte" | "overtake_qte" | "defend_qte" | "pit_decision" | "drs_qte";
  description: string; // Text displayed to the player for the event
  qteDurationMs?: number; // For timed QTEs, how long the player has to react
  options?: string[]; // For decision events like pit stop
  successMessage: string;
  failureMessage: string;
  actionText?: string; // Text for the main action button for this event
}
