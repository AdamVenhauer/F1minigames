
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
  | "qualifying_lap"      // New state for active qualifying
  | "qualifying_result"   // New state to show qualifying outcome
  | "countdown"
  | "event_active"
  | "lap_transition"
  | "calculating_results"
  | "finished";

export interface PlayerRaceState {
  lap: number; // Current lap in the main race
  position: number; // Current race position, or starting position after qualifying
  tireWear: number;
  playerTimeMs: number; // Used for qualifying lap time, then reset for main race time
  lastEventMessage: string | null;
  qualifyingTimeMs: number | null; // Stores the completed qualifying lap time
  startingPosition: number | null; // Stores the determined starting position for the race
}

export interface RaceEvent {
  id: string;
  lap: number; // For race events, can be 0 or 1 for qualifying events
  type: "start_qte" | "overtake_qte" | "defend_qte" | "pit_decision" | "drs_qte" | "qte_generic" | "message_only" | "qualifying_qte"; // Added 'qualifying_qte'
  event_subtype?: 'weather_drizzle' | 'mechanical_scare' | 'safety_car_restart' | 'yellow_flag' | 'component_warning' | 'blue_flags' | 'hot_lap_sector'; // Added 'hot_lap_sector' for qualifying
  description: string;
  qteDurationMs?: number;
  options?: string[];
  successMessage: string;
  failureMessage: string;
  actionText?: string;
}

