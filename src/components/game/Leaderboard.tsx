
"use client";

import type { ScoreEntry } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CheckeredFlagIcon } from "@/components/icons/CheckeredFlagIcon";
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface LeaderboardProps {
  scores: ScoreEntry[];
  scoreHeaderText?: string; // New prop
}

export function Leaderboard({ scores, scoreHeaderText = "Time (ms)" }: LeaderboardProps) {
  if (!scores || scores.length === 0) {
    return (
      <div className="mt-8 p-6 bg-card rounded-lg shadow-md text-center">
        <CheckeredFlagIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Leaderboard</h2>
        <p className="text-muted-foreground">No scores yet. Be the first!</p>
      </div>
    );
  }

  // Assuming scores are pre-sorted by the hook that provides them
  const displayedScores = scores.slice(0, 10);

  return (
    <div className="mt-8 w-full max-w-md mx-auto">
      <Card className="shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckeredFlagIcon className="w-8 h-8 mr-2 text-primary" />
            <CardTitle className="text-3xl font-bold">Leaderboard</CardTitle>
          </div>
          <CardDescription>Top {displayedScores.length} Contenders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">Rank</TableHead>
                <TableHead>Nickname</TableHead>
                <TableHead className="text-right">{scoreHeaderText}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedScores.map((score, index) => (
                <TableRow key={score.id} className={index === 0 ? "bg-primary/20" : ""}>
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell>{score.nickname}</TableCell>
                  <TableCell className="text-right">{score.time}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{format(new Date(score.date), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
