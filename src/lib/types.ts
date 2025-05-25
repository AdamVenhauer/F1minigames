
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
  | "qualifying_lap"
  | "qualifying_result"
  | "countdown"
  | "event_active"
  | "lap_transition"
  | "calculating_results"
  | "finished";

export interface PlayerRaceState {
  lap: number;
  position: number;
  tireWear: number;
  playerTimeMs: number;
  lastEventMessage: string | null;
  qualifyingTimeMs: number | null;
  startingPosition: number | null;
}

export interface RaceEvent {
  id: string;
  lap: number;
  type: "start_qte" | "overtake_qte" | "defend_qte" | "pit_decision" | "drs_qte" | "qte_generic" | "message_only" | "qualifying_qte";
  event_subtype?: 'weather_drizzle' | 'mechanical_scare' | 'safety_car_restart' | 'yellow_flag' | 'component_warning' | 'blue_flags' | 'hot_lap_sector' | 'tight_corners' | 'backmarker_traffic' | 'sudden_rain';
  description: string;
  qteDurationMs?: number;
  options?: string[];
  successMessage: string;
  failureMessage: string;
  actionText?: string;
}

// Types for Reflex Tiles Challenge
export interface ReflexTile {
  id: number;
  isLit: boolean;
}

export type ReflexTilesGameState =
  | "idle"
  | "playing"
  | "finished";

// Types for Apex Track Sketcher
export type SegmentType = 'straight' | 'corner' | 'chicane_left' | 'chicane_right'; // Add more as needed
export type Rotation = 0 | 90 | 180 | 270;

export interface SegmentDefinition {
  type: SegmentType;
  label: string;
  // icon?: React.ReactNode; // For future use
}

export interface PlacedSegment {
  id: string;
  type: SegmentType;
  x: number; // Grid column index
  y: number; // Grid row index
  rotation: Rotation;
}

export interface TrackLayout {
  placedSegments: PlacedSegment[];
  // Potentially add other metadata like name, description later
}

export interface TrackAnalysisInput {
  segments: Array<{ type: SegmentType; length?: number; radius?: string }>; // Simplified for AI
  totalLength?: number;
  turns?: number;
}

export interface TrackAnalysisOutput {
  estimatedLapTime: string;
  trackCharacteristics: string[];
  designFeedback: string;
}
