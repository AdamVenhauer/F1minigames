
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

interface TrackControlsProps {
  trackName: string;
  onTrackNameChange: (name: string) => void;
  onClearCanvas: () => void;
  onAnalyzeTrack: () => void;
  isAnalyzing: boolean;
  onSaveTrack: () => void;
  onLoadTrack: (name: string) => void;
  getSavedTrackNames: () => string[];
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
}: TrackControlsProps) {
  const [savedTracks, setSavedTracks] = useState<string[]>([]);
  const [selectedTrackToLoad, setSelectedTrackToLoad] = useState<string>("");

  useEffect(() => {
    setSavedTracks(getSavedTrackNames());
  }, [getSavedTrackNames]); // Re-fetch if the function itself could change, or on some other trigger

  const handleLoad = () => {
    if (selectedTrackToLoad) {
      onLoadTrack(selectedTrackToLoad);
    }
  };
  
  // Placeholder for starting simulation, if we add that feature
  const handleStartSimulation = () => {
    alert("Track simulation feature coming soon!");
  };

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
          <Button onClick={onSaveTrack} variant="outline">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button onClick={onClearCanvas} variant="destructive_outline">
            <Eraser className="w-4 h-4 mr-2" /> Clear
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="loadTrackSelect" className="text-sm font-medium">Load Track</Label>
          <div className="flex gap-2">
            <Select value={selectedTrackToLoad} onValueChange={setSelectedTrackToLoad}>
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
            <Button onClick={handleLoad} disabled={!selectedTrackToLoad || selectedTrackToLoad === "no_tracks"} variant="outline" aria-label="Load selected track">
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button onClick={onAnalyzeTrack} disabled={isAnalyzing} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
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
        
        {/* Placeholder for simulation button */}
        <Button onClick={handleStartSimulation} variant="secondary" className="w-full" disabled>
           <Play className="w-4 h-4 mr-2" /> Simulate Lap (Soon)
        </Button>

      </CardContent>
    </Card>
  );
}
