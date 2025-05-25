
"use client";

import type { TrackAnalysisOutput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Clock, ListChecks, CircleCheck, CircleAlert, Play, Timer } from 'lucide-react';

interface AnalysisDisplayProps {
  analysisResult: TrackAnalysisOutput | null;
  isAnalyzing: boolean;
  isSimulating: boolean;
  simulatedTime: number;
  formatTime: (ms: number) => string;
}

export function AnalysisDisplay({
  analysisResult,
  isAnalyzing,
  isSimulating,
  simulatedTime,
  formatTime,
}: AnalysisDisplayProps) {
  if (isSimulating) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <Play className="w-5 h-5 mr-2 text-destructive animate-pulse" /> Simulating Lap...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-primary">{formatTime(simulatedTime)}</p>
            <p className="text-sm text-muted-foreground">Current Lap Time</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Show simulation results if simulation just finished
  if (!isSimulating && simulatedTime > 0 && !isAnalyzing && !analysisResult) { // If sim just ended, analysisResult might be null
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <Clock className="w-5 h-5 mr-2 text-green-500" /> Lap Simulation Complete!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-primary">{formatTime(simulatedTime)}</p>
            <p className="text-sm text-muted-foreground">Final Simulated Lap Time</p>
          </div>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground">
                Click "Analyze Track" for detailed characteristics or simulate again.
            </p>
        </CardFooter>
      </Card>
    );
  }


  if (isAnalyzing) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Track Analysis</CardTitle>
          <CardDescription>Calculating track properties...</CardDescription>
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
            Design your track and click "Analyze Track" to get calculated insights and lap time estimations.
            A minimum of {MIN_SEGMENTS_FOR_LOOP} segments are usually needed for a valid track.
            You can also simulate a lap on an analyzed closed track.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Regular analysis display
  const isLapTimeAvailable = analysisResult.estimatedLapTime && !analysisResult.estimatedLapTime.toLowerCase().includes("n/a");

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <Lightbulb className="w-5 h-5 mr-2 text-accent" /> 
          {analysisResult.estimatedLapTime.startsWith("Error") || analysisResult.estimatedLapTime.startsWith("N/A") ? "Analysis Information" : "Track Analysis Complete"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-md flex items-center mb-1">
            <Timer className="w-4 h-4 mr-2 text-primary" /> Calculated Lap Time:
          </h4>
          <p className={`text-2xl font-bold ${isLapTimeAvailable ? 'text-primary' : 'text-muted-foreground'}`}>
            {analysisResult.estimatedLapTime}
          </p>
        </div>
        
        {analysisResult.isClosedLoop !== undefined && (
          <div className="flex items-center text-sm">
            {analysisResult.isClosedLoop ? (
              <>
                <CircleCheck className="w-4 h-4 mr-2 text-green-500" />
                <span>Track considered a closed loop (basic check).</span>
              </>
            ) : (
              <>
                <CircleAlert className="w-4 h-4 mr-2 text-yellow-500" />
                <span>Track may not be a closed loop or is too short.</span>
              </>
            )}
          </div>
        )}

        {analysisResult.trackCharacteristics && analysisResult.trackCharacteristics.length > 0 && (
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
        )}
        
        {analysisResult.designFeedback && (
          <div>
            <h4 className="font-semibold text-md mb-1">Feedback:</h4>
            <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md">
              "{analysisResult.designFeedback}"
            </p>
          </div>
        )}

      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Note: Lap times are calculated based on segment properties. Track closure check is basic.
        </p>
      </CardFooter>
    </Card>
  );
}

// Expose MIN_SEGMENTS_FOR_LOOP for use in the component if needed for messages
export const MIN_SEGMENTS_FOR_LOOP = 4; 
