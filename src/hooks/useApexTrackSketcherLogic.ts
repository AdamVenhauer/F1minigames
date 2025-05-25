
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { SegmentType, PlacedSegment, Rotation, SegmentDefinition, TrackLayout, TrackAnalysisInput, TrackAnalysisOutput } from '@/lib/types';
import { analyzeTrackFlow } from '@/ai/flows/analyze-track-flow'; // Ensuring this is the alias path
import { v4 as uuidv4 } from 'uuid';

export const AVAILABLE_SEGMENTS: SegmentDefinition[] = [
  { type: 'straight', label: 'Straight' },
  { type: 'corner', label: 'Corner' },
  // Future segment types like 'chicane_left', 'chicane_right' can be added here
];

export const CELL_SIZE = 30; // Visual size of a grid cell and base segment size
const GRID_COLS = 30; // Number of columns in the grid
const GRID_ROWS = 20; // Number of rows in the grid
const LOCAL_STORAGE_TRACK_PREFIX = "apexSketcherTrack_";


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

  const handlePlaceSegment = useCallback((centerX: number, centerY: number) => {
    if (!selectedSegmentType) return;

    const newSegment: PlacedSegment = {
      id: uuidv4(),
      type: selectedSegmentType,
      x: centerX - CELL_SIZE / 2, // Store top-left based on center
      y: centerY - CELL_SIZE / 2, // Store top-left based on center
      rotation: currentRotation,
    };
    
    const proximityThreshold = CELL_SIZE / 2.5; 
    const existingSegmentIndex = placedSegments.findIndex(seg => {
        const segCenterX = seg.x + CELL_SIZE / 2;
        const segCenterY = seg.y + CELL_SIZE / 2;
        return Math.abs(segCenterX - centerX) < proximityThreshold && Math.abs(segCenterY - centerY) < proximityThreshold;
    });

    if (existingSegmentIndex !== -1) {
        setPlacedSegments(prevSegments => {
            const updatedSegments = [...prevSegments];
            updatedSegments[existingSegmentIndex] = newSegment;
            return updatedSegments;
        });
    } else {
        setPlacedSegments(prevSegments => [...prevSegments, newSegment]);
    }
  }, [selectedSegmentType, currentRotation, placedSegments]);

  const handleRemoveSegment = useCallback((clickX: number, clickY: number) => {
    let segmentToRemoveId: string | null = null;

    for (let i = placedSegments.length - 1; i >= 0; i--) {
      const segment = placedSegments[i];
      const segCenterX = segment.x + CELL_SIZE / 2;
      const segCenterY = segment.y + CELL_SIZE / 2;

      const relX = clickX - segCenterX;
      const relY = clickY - segCenterY;

      const angleRad = -(segment.rotation * Math.PI) / 180; 
      const cosAngle = Math.cos(angleRad);
      const sinAngle = Math.sin(angleRad);

      const rotatedRelX = relX * cosAngle - relY * sinAngle;
      const rotatedRelY = relX * sinAngle + relY * cosAngle;

      if (
        rotatedRelX >= -CELL_SIZE / 2 &&
        rotatedRelX <= CELL_SIZE / 2 &&
        rotatedRelY >= -CELL_SIZE / 2 &&
        rotatedRelY <= CELL_SIZE / 2
      ) {
        segmentToRemoveId = segment.id;
        break; 
      }
    }

    if (segmentToRemoveId) {
      setPlacedSegments(prevSegments => prevSegments.filter(seg => seg.id !== segmentToRemoveId));
    }
  }, [placedSegments]);

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

    const numStraights = placedSegments.filter(s => s.type === 'straight').length;
    const numCorners = placedSegments.filter(s => s.type === 'corner').length;

    const input: TrackAnalysisInput = {
      trackName,
      numStraights,
      numCorners,
      totalSegments: placedSegments.length,
    };

    try {
      const result = await analyzeTrackFlow(input);
      setAnalysisResult(result);
    } catch (error: any) {
      console.error("Error analyzing track:", error);
      let errorMessage = "Failed to analyze track. See console for details.";
       if (error.message && (error.message.includes('GEMINI_API_KEY') || error.message.includes('GOOGLE_API_KEY') || (error.cause as any)?.code === 'FAILED_PRECONDITION' || (error.cause as any)?.status === 'FAILED_PRECONDITION')) {
        errorMessage = "AI Analysis Error: API Key is missing, invalid, or has insufficient quota. Please check your environment configuration and Google Cloud project.";
      } else if (error.message) {
        errorMessage = `AI Analysis Error: ${error.message}`;
      }
      setAnalysisResult({
        estimatedLapTime: "Error",
        trackCharacteristics: [errorMessage],
        designFeedback: "Could not complete analysis.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [placedSegments, trackName]);

  const handleSaveTrack = useCallback(() => {
    if (!trackName.trim()) {
      alert("Please enter a track name to save.");
      return;
    }
    const trackLayout: TrackLayout = { trackName: trackName.trim(), placedSegments };
    try {
      localStorage.setItem(LOCAL_STORAGE_TRACK_PREFIX + trackName.trim(), JSON.stringify(trackLayout));
      alert(`Track "${trackName.trim()}" saved!`);
    } catch (e) {
      alert("Failed to save track. Local storage might be full or disabled.");
      console.error("Error saving track:", e);
    }
  }, [placedSegments, trackName]);

  const handleLoadTrack = useCallback((nameToLoad: string) => {
    const savedTrackJSON = localStorage.getItem(LOCAL_STORAGE_TRACK_PREFIX + nameToLoad);
    if (savedTrackJSON) {
      try {
        const trackLayout: TrackLayout = JSON.parse(savedTrackJSON);
        setPlacedSegments(trackLayout.placedSegments || []);
        setTrackName(trackLayout.trackName || nameToLoad);
        setAnalysisResult(null); 
        alert(`Track "${trackLayout.trackName || nameToLoad}" loaded!`);
      } catch (e) {
        alert("Failed to load track. Data might be corrupted.");
        console.error("Error loading track:", e);
      }
    } else {
      alert(`No track found with name "${nameToLoad}".`);
    }
  }, []);

  const getSavedTrackNames = useCallback(() => {
    const names: string[] = [];
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_TRACK_PREFIX)) {
          names.push(key.replace(LOCAL_STORAGE_TRACK_PREFIX, ""));
        }
      }
    }
    return names.sort();
  }, []);


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
    CELL_SIZE,  
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
