
"use client";

import type { TrackAnalysisOutput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Clock, ListChecks } from 'lucide-react';

interface AnalysisDisplayProps {
  analysisResult: TrackAnalysisOutput | null;
  isAnalyzing: boolean;
}

export function AnalysisDisplay({ analysisResult, isAnalyzing }: AnalysisDisplayProps) {
  if (isAnalyzing) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Track Analysis</CardTitle>
          <CardDescription>AI is reviewing your circuit...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analysisResult) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Track Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Design your track and click "Analyze Track" to get AI-powered insights and lap time estimations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <Lightbulb className="w-5 h-5 mr-2 text-accent" /> Track Analysis Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-md flex items-center mb-1">
            <Clock className="w-4 h-4 mr-2 text-primary" /> Estimated Lap Time:
          </h4>
          <p className="text-2xl font-bold text-primary">{analysisResult.estimatedLapTime}</p>
        </div>
        <div>
          <h4 className="font-semibold text-md flex items-center mb-1">
            <ListChecks className="w-4 h-4 mr-2" /> Characteristics:
          </h4>
          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
            {analysisResult.trackCharacteristics.map((char, index) => (
              <li key={index}>{char}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-md mb-1">Design Feedback:</h4>
          <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md">
            "{analysisResult.designFeedback}"
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Note: Lap times and analysis are AI-generated estimations and may not reflect real-world physics perfectly.
        </p>
      </CardFooter>
    </Card>
  );
}
