"use client";

import type { ScoreEntry } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { CheckeredFlagIcon } from "@/components/icons/CheckeredFlagIcon";
import { format } from 'date-fns';

interface LeaderboardProps {
  scores: ScoreEntry[];
}

export function Leaderboard({ scores }: LeaderboardProps) {
  if (!scores || scores.length === 0) {
    return (
      <div className="mt-8 p-6 bg-card rounded-lg shadow-md text-center">
        <CheckeredFlagIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Leaderboard</h2>
        <p className="text-muted-foreground">No scores yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full max-w-md mx-auto">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckeredFlagIcon className="w-8 h-8 mr-2 text-primary" />
            <CardTitle className="text-3xl font-bold">Leaderboard</CardTitle>
          </div>
          <CardDescription>Top 10 Reflex Masters</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">Rank</TableHead>
                <TableHead>Nickname</TableHead>
                <TableHead className="text-right">Time (ms)</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((score, index) => (
                <TableRow key={score.id} className={index === 0 ? "bg-accent/20" : ""}>
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

// Dummy Card components if not imported globally or from shadcn
// This is to satisfy the structure. Ensure Card, CardHeader, CardTitle, CardDescription, CardContent are properly imported from '@/components/ui/card'
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
