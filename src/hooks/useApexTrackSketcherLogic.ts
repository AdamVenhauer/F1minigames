
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SegmentType, PlacedSegment, Rotation, SegmentDefinition, TrackLayout, TrackAnalysisOutput } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const AVAILABLE_SEGMENTS: SegmentDefinition[] = [
  { type: 'straight', label: 'Straight', baseTimeMs: 300 },
  { type: 'corner', label: 'Corner', baseTimeMs: 700 },
];

export const CELL_SIZE = 30;
const GRID_COLS = 30;
const GRID_ROWS = 20;
const LOCAL_STORAGE_TRACK_PREFIX = "apexSketcherTrack_";
const MIN_SEGMENTS_FOR_LOOP = 4; // Minimum segments for a track to be considered for simulation/analysis

export function useApexTrackSketcherLogic() {
  const [placedSegments, setPlacedSegments] = useState<PlacedSegment[]>([]);
  const [selectedSegmentType, setSelectedSegmentType] = useState<SegmentType | null>(AVAILABLE_SEGMENTS[0]?.type || null);
  const [currentRotation, setCurrentRotation] = useState<Rotation>(0);
  const [trackName, setTrackName] = useState<string>("My Custom Track");
  const [analysisResult, setAnalysisResult] = useState<TrackAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationCarPosition, setSimulationCarPosition] = useState<{ x: number; y: number } | null>(null);
  const [simulationCarRotation, setSimulationCarRotation] = useState<number>(0);
  const [simulatedTime, setSimulatedTime] = useState<number>(0);
  const [currentSimSegmentIndex, setCurrentSimSegmentIndex] = useState<number | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const segmentEnterTimeRef = useRef<number>(0);
  const isSimulatingRef = useRef(isSimulating); // For access inside requestAnimationFrame
  const simulatedTimeRef = useRef(simulatedTime); // For access inside requestAnimationFrame

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    simulatedTimeRef.current = simulatedTime;
  }, [simulatedTime]);

  const handleSelectSegmentType = useCallback((type: SegmentType) => {
    setSelectedSegmentType(type);
  }, []);

  const handleRotatePreviewSegment = useCallback(() => {
    setCurrentRotation(prevRotation => (prevRotation + 90) % 360 as Rotation);
  }, []);

  const handlePlaceSegment = useCallback((centerX: number, centerY: number) => {
    if (!selectedSegmentType) return;

    const newSegmentX = centerX - CELL_SIZE / 2;
    const newSegmentY = centerY - CELL_SIZE / 2;

    const newSegment: PlacedSegment = {
      id: uuidv4(),
      type: selectedSegmentType,
      x: newSegmentX,
      y: newSegmentY,
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
    if (isSimulating) setIsSimulating(false);
  }, [isSimulating]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const handleAnalyzeTrack = useCallback(async () => {
    if (placedSegments.length === 0) {
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
    await new Promise(resolve => setTimeout(resolve, 500));

    const numStraights = placedSegments.filter(s => s.type === 'straight').length;
    const numCorners = placedSegments.filter(s => s.type === 'corner').length;

    let totalCalculatedTimeMs = 0;
    placedSegments.forEach(segment => {
      const definition = AVAILABLE_SEGMENTS.find(def => def.type === segment.type);
      if (definition) {
        totalCalculatedTimeMs += definition.baseTimeMs;
      }
    });

    const isPotentiallyClosed = placedSegments.length >= MIN_SEGMENTS_FOR_LOOP;
    let characteristics: string[] = [`Total Segments: ${placedSegments.length}`, `Straights: ${numStraights}`, `Corners: ${numCorners}`];
    let feedback: string;

    if (!isPotentiallyClosed) {
      feedback = `Track has ${placedSegments.length} segments. A minimum of ${MIN_SEGMENTS_FOR_LOOP} segments is suggested for a loop.`;
      setAnalysisResult({
        estimatedLapTime: "N/A (Track too short or not closed)",
        trackCharacteristics: characteristics,
        designFeedback: feedback,
        isClosedLoop: false,
      });
    } else {
      feedback = "Track analysis based on segment count. Assuming a basic loop for lap time calculation.";
      setAnalysisResult({
        estimatedLapTime: formatTime(totalCalculatedTimeMs),
        trackCharacteristics: characteristics,
        designFeedback: feedback,
        isClosedLoop: true,
      });
    }
    setIsAnalyzing(false);
  }, [placedSegments]);

  const getSegmentVisualEndpoints = useCallback((segment: PlacedSegment) => {
    const { type, x, y, rotation } = segment;
    const segTopLeftX = x;
    const segTopLeftY = y;

    let localEntryPointX = 0, localEntryPointY = 0, localExitPointX = 0, localExitPointY = 0;

    switch (type) {
      case 'straight':
        localEntryPointX = 0;
        localEntryPointY = CELL_SIZE / 2;
        localExitPointX = CELL_SIZE;
        localExitPointY = CELL_SIZE / 2;
        break;
      case 'corner': // Default: enters from left, exits to top
        localEntryPointX = 0;
        localEntryPointY = CELL_SIZE / 2;
        localExitPointX = CELL_SIZE / 2;
        localExitPointY = 0;
        break;
    }

    // Rotate points around segment's own center (CELL_SIZE/2, CELL_SIZE/2) then translate
    const segmentCenterX = CELL_SIZE / 2;
    const segmentCenterY = CELL_SIZE / 2;

    const pointsToRotate = [
      { x: localEntryPointX, y: localEntryPointY },
      { x: localExitPointX, y: localExitPointY },
    ];
    const rotatedPoints = pointsToRotate.map(point => {
      const relX = point.x - segmentCenterX;
      const relY = point.y - segmentCenterY;
      const rotRad = (rotation * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      return {
        x: (relX * cosR - relY * sinR) + segmentCenterX + segTopLeftX,
        y: (relX * sinR + relY * cosR) + segmentCenterY + segTopLeftY,
      };
    });
    return { entryPoint: rotatedPoints[0], exitPoint: rotatedPoints[1] };
  }, []);

  const handleStartSimulation = useCallback(() => {
    if (placedSegments.length < MIN_SEGMENTS_FOR_LOOP) {
      alert(`Track must have at least ${MIN_SEGMENTS_FOR_LOOP} segments to simulate.`);
      return;
    }
    if (!analysisResult || !analysisResult.isClosedLoop) {
      alert("Please analyze the track and ensure it's a closed loop before simulating.");
      return;
    }
    if (isAnalyzing) {
      alert("Please wait for analysis to complete before simulating.");
      return;
    }
    if (isSimulating) return; // Already simulating

    setIsSimulating(true);
    setSimulatedTime(0);
    setCurrentSimSegmentIndex(0);
    segmentEnterTimeRef.current = 0;

    const firstSegment = placedSegments[0];
    if (firstSegment) {
      const { entryPoint } = getSegmentVisualEndpoints(firstSegment);
      setSimulationCarPosition(entryPoint);
      setSimulationCarRotation(firstSegment.rotation);
    }
    lastFrameTimeRef.current = performance.now();
  }, [analysisResult, isAnalyzing, isSimulating, placedSegments, getSegmentVisualEndpoints]);

  useEffect(() => {
    if (!isSimulating || currentSimSegmentIndex === null || currentSimSegmentIndex >= placedSegments.length) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      // setIsSimulating(false); // Only set to false if it was explicitly stopped or finished
      return;
    }

    const animate = (timestamp: number) => {
      if (!isSimulatingRef.current) { // Use ref for immediate check
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const currentSegment = placedSegments[currentSimSegmentIndex];
      if (!currentSegment) {
        setIsSimulating(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const deltaTime = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const newSimulatedTotalTime = simulatedTimeRef.current + deltaTime;
      simulatedTimeRef.current = newSimulatedTotalTime; // Update ref immediately
      setSimulatedTime(newSimulatedTotalTime); // Update state for display

      const segmentDef = AVAILABLE_SEGMENTS.find(s => s.type === currentSegment.type);
      const segmentDuration = segmentDef ? segmentDef.baseTimeMs : 1000;

      const elapsedInSegment = newSimulatedTotalTime - segmentEnterTimeRef.current;
      let progressRatio = Math.min(1, elapsedInSegment / segmentDuration);

      let newCarX = 0;
      let newCarY = 0;
      let newCarRot = simulationCarRotation; // Keep current rotation unless changed

      const { entryPoint, exitPoint } = getSegmentVisualEndpoints(currentSegment);

      if (currentSegment.type === 'straight') {
        newCarX = entryPoint.x + (exitPoint.x - entryPoint.x) * progressRatio;
        newCarY = entryPoint.y + (exitPoint.y - entryPoint.y) * progressRatio;
        newCarRot = currentSegment.rotation;
      } else if (currentSegment.type === 'corner') {
        // Arc path logic
        const segmentTopLeftX = currentSegment.x;
        const segmentTopLeftY = currentSegment.y;
        const radius = CELL_SIZE / 2;
        
        // Define arc center in local coords (relative to segment's top-left 0,0)
        // For a corner SVG drawn as <path d="M 0 ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0" />
        // The arc is in the top-left quadrant of a square, center is (radius, radius)
        const arcCenterXLocal = radius; 
        const arcCenterYLocal = radius;

        const startAngle = Math.PI; // Start from left-middle (180 deg)
        const endAngle = Math.PI / 2; // End at top-middle (90 deg)
        const currentAngle = startAngle + (endAngle - startAngle) * progressRatio;

        const carX_local_to_arc_center = radius * Math.cos(currentAngle);
        const carY_local_to_arc_center = radius * Math.sin(currentAngle);
        
        const carX_local_to_segment_origin = arcCenterXLocal + carX_local_to_arc_center;
        const carY_local_to_segment_origin = arcCenterYLocal + carY_local_to_arc_center;

        const rotRad = (currentSegment.rotation * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);
        
        // Transform local segment coords to global canvas coords
        // This needs to rotate around the segment's own center (CELL_SIZE/2, CELL_SIZE/2)
        const localRelX = carX_local_to_segment_origin - CELL_SIZE/2;
        const localRelY = carY_local_to_segment_origin - CELL_SIZE/2;

        newCarX = (localRelX * cosR - localRelY * sinR) + CELL_SIZE/2 + segmentTopLeftX;
        newCarY = (localRelX * sinR + localRelY * cosR) + CELL_SIZE/2 + segmentTopLeftY;
        
        // Tangential rotation
        const tangentAngleRad = currentAngle - Math.PI / 2; 
        newCarRot = (tangentAngleRad * 180 / Math.PI) + currentSegment.rotation;
      }

      setSimulationCarPosition({ x: newCarX, y: newCarY });
      setSimulationCarRotation(newCarRot);

      if (progressRatio >= 1) {
        const nextSimSegmentIndex = currentSimSegmentIndex + 1;
        if (nextSimSegmentIndex < placedSegments.length) {
          segmentEnterTimeRef.current = newSimulatedTotalTime;
          setCurrentSimSegmentIndex(nextSimSegmentIndex);
        } else {
          setIsSimulating(false); // Lap finished
          const finalSegment = placedSegments[placedSegments.length-1];
          const { exitPoint: finalExit } = getSegmentVisualEndpoints(finalSegment);
          setSimulationCarPosition(finalExit); // Snap to exact end
        }
      }
      
      if (isSimulatingRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, currentSimSegmentIndex, placedSegments, getSegmentVisualEndpoints]); // simulationCarRotation removed to avoid loop with its own update

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
        if (isSimulating) setIsSimulating(false);
        alert(`Track "${trackLayout.trackName || nameToLoad}" loaded!`);
      } catch (e) {
        alert("Failed to load track. Data might be corrupted.");
        console.error("Error loading track:", e);
      }
    } else {
      alert(`No track found with name "${nameToLoad}".`);
    }
  }, [isSimulating]);

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
    // Simulation
    isSimulating,
    simulationCarPosition,
    simulationCarRotation,
    simulatedTime,
    handleStartSimulation,
    formatTime,
    MIN_SEGMENTS_FOR_LOOP,
  };
}

    