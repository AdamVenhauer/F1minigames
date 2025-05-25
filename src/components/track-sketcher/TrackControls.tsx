
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eraser, BarChart2, Save, FolderOpen, RotateCcw, Play } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from 'react';
import type { TrackAnalysisOutput } from '@/lib/types'; // Import TrackAnalysisOutput

interface TrackControlsProps {
  trackName: string;
  onTrackNameChange: (name: string) => void;
  onClearCanvas: () => void;
  onAnalyzeTrack: () => void;
  isAnalyzing: boolean;
  onSaveTrack: () => void;
  onLoadTrack: (name: string) => void;
  getSavedTrackNames: () => string[];
  // New props for simulation button state
  onStartSimulation: () => void;
  isSimulating: boolean;
  analysisResult: TrackAnalysisOutput | null;
  placedSegmentsLength: number;
  minSegmentsForSimulation: number;
}

export function TrackControls({
  trackName,
  onTrackNameChange,
  onClearCanvas,
  onAnalyzeTrack,
  isAnalyzing,
  onSaveTrack,
  onLoadTrack,
  getSavedTrackNames,
  onStartSimulation, // New prop
  isSimulating,      // New prop
  analysisResult,    // New prop
  placedSegmentsLength, // New prop
  minSegmentsForSimulation, // New prop
}: TrackControlsProps) {
  const [savedTracks, setSavedTracks] = useState<string[]>([]);
  const [selectedTrackToLoad, setSelectedTrackToLoad] = useState<string>("");

  useEffect(() => {
    setSavedTracks(getSavedTrackNames());
  }, [getSavedTrackNames, isSimulating]); // Re-fetch if sim stops, might have new saved tracks

  const handleLoad = () => {
    if (selectedTrackToLoad) {
      onLoadTrack(selectedTrackToLoad);
    }
  };
  
  const canSimulate = 
    !isAnalyzing &&
    !isSimulating &&
    analysisResult !== null &&
    analysisResult.isClosedLoop === true &&
    placedSegmentsLength >= minSegmentsForSimulation;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Track Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="trackName" className="text-sm font-medium">Track Name</Label>
          <Input
            id="trackName"
            type="text"
            value={trackName}
            onChange={(e) => onTrackNameChange(e.target.value)}
            placeholder="Enter track name"
            className="mt-1"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onSaveTrack} variant="outline" disabled={isSimulating}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button onClick={onClearCanvas} variant="destructive" disabled={isSimulating}>
            <Eraser className="w-4 h-4 mr-2" /> Clear
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="loadTrackSelect" className="text-sm font-medium">Load Track</Label>
          <div className="flex gap-2">
            <Select value={selectedTrackToLoad} onValueChange={setSelectedTrackToLoad} disabled={isSimulating}>
              <SelectTrigger id="loadTrackSelect" className="flex-grow">
                <SelectValue placeholder="Select a track" />
              </SelectTrigger>
              <SelectContent>
                {savedTracks.length > 0 ? (
                  savedTracks.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="no_tracks" disabled>No saved tracks</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button onClick={handleLoad} disabled={!selectedTrackToLoad || selectedTrackToLoad === "no_tracks" || isSimulating} variant="outline" aria-label="Load selected track">
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button onClick={onAnalyzeTrack} disabled={isAnalyzing || isSimulating} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isAnalyzing ? (
            <>
              <RotateCcw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <BarChart2 className="w-4 h-4 mr-2" /> Analyze Track
            </>
          )}
        </Button>
        
        <Button onClick={onStartSimulation} variant="secondary" className="w-full" disabled={!canSimulate}>
           <Play className="w-4 h-4 mr-2" /> 
           {isSimulating ? 'Simulating...' : 'Simulate Lap'}
        </Button>

      </CardContent>
    </Card>
  );
}

    