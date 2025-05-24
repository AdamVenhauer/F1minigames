export interface ScoreEntry {
  id: string;
  nickname: string;
  time: number;
  date: string; // ISO date string
}

export type GameState =
  | "idle"
  | "lightsSequence"
  | "greenLight"
  | "jumpStart"
  | "result";
