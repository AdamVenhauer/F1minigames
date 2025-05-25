
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { SegmentType, PlacedSegment, Rotation, SegmentDefinition, TrackLayout, TrackAnalysisInput, TrackAnalysisOutput } from '@/lib/types';
// Removed import for analyzeTrackFlow as AI is no longer used for this
import { v4 as uuidv4 } from 'uuid';

export const AVAILABLE_SEGMENTS: SegmentDefinition[] = [
  { type: 'straight', label: 'Straight', baseTimeMs: 300 },
  { type: 'corner', label: 'Corner', baseTimeMs: 700 },
];

export const CELL_SIZE = 30;
const GRID_COLS = 30;
const GRID_ROWS = 20;
const LOCAL_STORAGE_TRACK_PREFIX = "apexSketcherTrack_";
const MIN_SEGMENTS_FOR_LOOP = 4; // Minimum segments for a track to be considered for lap time calculation

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
      x: centerX - CELL_SIZE / 2,
      y: centerY - CELL_SIZE / 2,
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

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const handleAnalyzeTrack = useCallback(async () => {
    if (placedSegments.length === 0) {
      alert("Please place some segments before analyzing.");
      setAnalysisResult({
        estimatedLapTime: "N/A",
        trackCharacteristics: ["No segments placed."],
        designFeedback: "Add segments to your track to enable analysis.",
        isClosedLoop: false,
      });
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const numStraights = placedSegments.filter(s => s.type === 'straight').length;
    const numCorners = placedSegments.filter(s => s.type === 'corner').length;

    let totalCalculatedTimeMs = 0;
    placedSegments.forEach(segment => {
      const definition = AVAILABLE_SEGMENTS.find(def => def.type === segment.type);
      if (definition) {
        totalCalculatedTimeMs += definition.baseTimeMs;
      }
    });

    // Basic closure check
    const isPotentiallyClosed = placedSegments.length >= MIN_SEGMENTS_FOR_LOOP;
    let characteristics: string[] = [];
    let feedback: string;

    if (!isPotentiallyClosed) {
      feedback = `Track has ${placedSegments.length} segments. A minimum of ${MIN_SEGMENTS_FOR_LOOP} segments is suggested for a loop. Track closure validation not yet fully implemented.`;
      characteristics.push(`Straights: ${numStraights}`, `Corners: ${numCorners}`);
      setAnalysisResult({
        estimatedLapTime: "N/A (Track too short or not closed)",
        trackCharacteristics: characteristics,
        designFeedback: feedback,
        isClosedLoop: false,
      });
    } else {
      // For now, assume it's a loop if it meets minimum segments
      // A proper connectivity check (graph traversal) would be needed here for true validation
      feedback = "Track analysis based on segment count. Advanced closure validation is a future enhancement. Assuming a basic loop for lap time calculation.";
      characteristics.push(`Straights: ${numStraights}`, `Corners: ${numCorners}`);
      characteristics.push(`Track Composition: Balanced (Example Characteristic)`); // Example
      
      setAnalysisResult({
        estimatedLapTime: formatTime(totalCalculatedTimeMs),
        trackCharacteristics: characteristics,
        designFeedback: feedback,
        isClosedLoop: true, // Basic assumption
      });
    }
    setIsAnalyzing(false);
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
