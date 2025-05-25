
"use client";

import { useState, useCallback } from 'react';
import type { SegmentType, PlacedSegment, TrackLayout, TrackAnalysisInput, TrackAnalysisOutput, Rotation, SegmentDefinition } from '@/lib/types';
// import { analyzeTrackFlow } from '@/ai/flows/analyze-track-flow'; // Placeholder for AI integration
import { v4 as uuidv4 } from 'uuid';


export const AVAILABLE_SEGMENTS: SegmentDefinition[] = [
  { type: 'straight', label: 'Straight' },
  { type: 'corner', label: 'Corner' },
  // { type: 'chicane_left', label: 'Chicane (L)' }, // Future additions
  // { type: 'chicane_right', label: 'Chicane (R)' },
];

const GRID_COLS = 30;
const GRID_ROWS = 20;

export function useApexTrackSketcherLogic() {
  const [placedSegments, setPlacedSegments] = useState<PlacedSegment[]>([]);
  const [selectedSegmentType, setSelectedSegmentType] = useState<SegmentType | null>(AVAILABLE_SEGMENTS[0]?.type || null);
  const [currentRotation, setCurrentRotation] = useState<Rotation>(0);
  const [trackName, setTrackName] = useState<string>("My Custom Track");
  const [analysisResult, setAnalysisResult] = useState<TrackAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const handleSelectSegmentType = useCallback((type: SegmentType) => {
    setSelectedSegmentType(type);
  }, []);

  const handleRotatePreviewSegment = useCallback(() => {
    setCurrentRotation(prevRotation => (prevRotation + 90) % 360 as Rotation);
  }, []);

  const handlePlaceSegment = useCallback((x: number, y: number) => {
    if (!selectedSegmentType) return; // No segment type selected

    // Check if a segment already exists at this position
    const existingSegment = placedSegments.find(seg => seg.x === x && seg.y === y);
    if (existingSegment) {
      // Option 1: Replace existing segment
      // Option 2: Prevent placing (current implementation)
      // console.warn(`Segment already exists at (${x}, ${y}). To replace, first remove.`);
      // For now, let's allow replacement by filtering out the old one
      setPlacedSegments(prevSegments => 
        prevSegments.filter(seg => !(seg.x === x && seg.y === y))
      );
    }

    const newSegment: PlacedSegment = {
      id: uuidv4(),
      type: selectedSegmentType,
      x,
      y,
      rotation: currentRotation,
    };
    setPlacedSegments(prevSegments => [...prevSegments, newSegment]);
  }, [selectedSegmentType, currentRotation, placedSegments]);

  const handleRemoveSegment = useCallback((x: number, y: number) => {
    setPlacedSegments(prevSegments => prevSegments.filter(seg => !(seg.x === x && seg.y === y)));
  }, []);
  
  const handleClearCanvas = useCallback(() => {
    setPlacedSegments([]);
    setAnalysisResult(null);
  }, []);

  const handleAnalyzeTrack = useCallback(async () => {
    if (placedSegments.length === 0) {
      alert("Please place some segments before analyzing.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Prepare data for AI (simplified for now)
    const simplifiedSegments = placedSegments.map(seg => ({
      type: seg.type,
      // We can add more properties like length/radius if we define them for segments
    }));

    const input: TrackAnalysisInput = {
      segments: simplifiedSegments,
      totalLength: placedSegments.length * 100, // Rough estimate: each segment is 100m
      turns: placedSegments.filter(seg => seg.type === 'corner').length,
    };

    try {
      // const result = await analyzeTrackFlow(input); // AI Call placeholder
      // Mocked result for now:
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      const mockResult: TrackAnalysisOutput = {
        estimatedLapTime: `1:${Math.floor(Math.random() * 20) + 20}.${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
        trackCharacteristics: [
          `Features ${input.turns} corners.`,
          `${placedSegments.filter(s => s.type === 'straight').length} straights provide overtaking opportunities.`,
          `Consider adding more elevation changes for complexity.`
        ],
        designFeedback: "This is a promising layout! The balance of straights and corners looks good. Maybe vary corner radii more?",
      };
      setAnalysisResult(mockResult);
    } catch (error) {
      console.error("Error analyzing track:", error);
      alert("Failed to analyze track. See console for details.");
      setAnalysisResult({ // Mock error result
        estimatedLapTime: "N/A",
        trackCharacteristics: ["Error during analysis."],
        designFeedback: "Could not analyze track.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [placedSegments]);

  // Save and Load logic (localStorage)
  const handleSaveTrack = useCallback(() => {
    if (placedSegments.length === 0) {
      alert("Track is empty, nothing to save.");
      return;
    }
    const trackLayout: TrackLayout = { placedSegments };
    localStorage.setItem(trackName, JSON.stringify(trackLayout));
    alert(`Track "${trackName}" saved!`);
  }, [placedSegments, trackName]);

  const handleLoadTrack = useCallback((name: string) => {
    const savedTrack = localStorage.getItem(name);
    if (savedTrack) {
      try {
        const trackLayout: TrackLayout = JSON.parse(savedTrack);
        setPlacedSegments(trackLayout.placedSegments || []);
        setTrackName(name);
        setAnalysisResult(null); // Clear previous analysis
        alert(`Track "${name}" loaded!`);
      } catch (e) {
        alert("Failed to load track. Data might be corrupted.");
        console.error("Error loading track:", e);
      }
    } else {
      alert(`No track found with name "${name}".`);
    }
  }, []);

  // Placeholder for saved track names, would ideally list keys from localStorage
  const getSavedTrackNames = () => {
    // This is a simplified way. A more robust method would iterate localStorage keys
    // and filter for those that seem like track saves.
    const names = [];
    for(let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i);
      // Add a prefix or some other way to identify track saves if you have other items in localStorage
      if(key && key.startsWith("Track_")) { // Assuming tracks are saved with a prefix
         names.push(key);
      } else if (key === "My Custom Track" || key === "Monza_Remix" || key === "Spa_Short") { // Example fixed names
         names.push(key);
      }
    }
    // For now, just returning a few examples or what might be manually saved
    return Array.from(new Set([...names, "My Custom Track", "Monza_Remix", "Spa_Short"])).slice(0,5);
  };


  return {
    placedSegments,
    selectedSegmentType,
    currentRotation,
    trackName,
    setTrackName,
    analysisResult,
    isAnalyzing,
    GRID_COLS,
    GRID_ROWS,
    availableSegmentTypes: AVAILABLE_SEGMENTS,
    handleSelectSegmentType,
    handleRotatePreviewSegment,
    handlePlaceSegment,
    handleRemoveSegment,
    handleClearCanvas,
    handleAnalyzeTrack,
    handleSaveTrack,
    handleLoadTrack,
    getSavedTrackNames,
  };
}
