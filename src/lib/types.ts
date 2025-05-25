
import { z } from 'zod';

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
  x: number; // Top-left x coordinate on canvas
  y: number; // Top-left y coordinate on canvas
  rotation: Rotation;
}

export interface TrackLayout {
  trackName: string;
  placedSegments: PlacedSegment[];
}

// Zod Schemas for Track Analysis (moved from analyze-track-flow.ts)
export const TrackAnalysisInputSchema = z.object({
  trackName: z.string().optional().describe("The name of the track being analyzed."),
  numStraights: z.number().int().min(0).describe("The number of straight segments in the track."),
  numCorners: z.number().int().min(0).describe("The number of corner segments in the track."),
  totalSegments: z.number().int().min(0).describe("The total number of segments in the track."),
});
export type TrackAnalysisInput = z.infer<typeof TrackAnalysisInputSchema>;

export const TrackAnalysisOutputSchema = z.object({
  estimatedLapTime: z.string().describe("The estimated lap time in M:SS.mmm format (e.g., 1:32.456)."),
  trackCharacteristics: z.array(z.string()).describe("A short list (3-5 bullet points) of the main characteristics of this track."),
  designFeedback: z.string().describe("A brief paragraph of design feedback, highlighting interesting aspects or potential areas for improvement from a racing perspective."),
});
export type TrackAnalysisOutput = z.infer<typeof TrackAnalysisOutputSchema>;
