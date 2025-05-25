
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
export const MIN_SEGMENTS_FOR_LOOP = 4;


export function useApexTrackSketcherLogic() {
  const [placedSegments, setPlacedSegments] = useState<PlacedSegment[]>([]);
  const [selectedSegmentType, setSelectedSegmentType] = useState<SegmentType | null>(AVAILABLE_SEGMENTS[0]?.type || null);
  const [currentRotation, setCurrentRotation] = useState<Rotation>(0);
  const [trackName, setTrackName] = useState<string>("My Custom Track");
  const [analysisResult, setAnalysisResult] = useState<TrackAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationCarPosition, setSimulationCarPosition] = useState<{ x: number; y: number } | null>(null);
  const [simulationCarRotation, setSimulationCarRotation] = useState<number>(0);
  const [simulatedTime, setSimulatedTime] = useState<number>(0);
  const [currentSimSegmentIndex, setCurrentSimSegmentIndex] = useState<number | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const segmentEnterTimeRef = useRef<number>(0);
  const isSimulatingRef = useRef(isSimulating);
  const simulatedTimeRef = useRef(simulatedTime);
  const previousCarPositionForRotationRef = useRef<{ x: number; y: number } | null>(null);


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
    if (!selectedSegmentType || isSimulating) return;

    const newSegmentX = centerX - CELL_SIZE / 2;
    const newSegmentY = centerY - CELL_SIZE / 2;

    const newSegment: PlacedSegment = {
      id: uuidv4(),
      type: selectedSegmentType,
      x: newSegmentX,
      y: newSegmentY,
      rotation: currentRotation,
    };

    const existingSegmentIndex = placedSegments.findIndex(seg => {
        const segCenterX = seg.x + CELL_SIZE / 2;
        const segCenterY = seg.y + CELL_SIZE / 2;
        return Math.abs(segCenterX - centerX) < CELL_SIZE / 2.5 && Math.abs(segCenterY - centerY) < CELL_SIZE / 2.5;
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
    setAnalysisResult(null);
    setSimulatedTime(0);
  }, [selectedSegmentType, currentRotation, placedSegments, isSimulating]);

  const handleRemoveSegment = useCallback((clickX: number, clickY: number) => {
    if (isSimulating) return;
    let segmentToRemoveId: string | null = null;
    for (let i = placedSegments.length - 1; i >= 0; i--) {
        const segment = placedSegments[i];
        const segCenterX = segment.x + CELL_SIZE / 2;
        const segCenterY = segment.y + CELL_SIZE / 2;

        // Translate click point to be relative to segment's center
        const relX = clickX - segCenterX;
        const relY = clickY - segCenterY;

        // Apply inverse rotation to the click point
        const angleRad = -(segment.rotation * Math.PI) / 180;
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);

        const rotatedRelX = relX * cosAngle - relY * sinAngle;
        const rotatedRelY = relX * sinAngle + relY * cosAngle;

        // Check if the un-rotated click point is within the segment's un-rotated bounding box
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
      setAnalysisResult(null);
      setSimulatedTime(0);
    }
  }, [placedSegments, isSimulating]);

  const handleClearCanvas = useCallback(() => {
    if (isSimulating) setIsSimulating(false);
    setPlacedSegments([]);
    setAnalysisResult(null);
    setSimulatedTime(0);
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
    setSimulatedTime(0);

    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing

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
      case 'corner':
        localEntryPointX = 0;
        localEntryPointY = CELL_SIZE / 2;
        localExitPointX = CELL_SIZE / 2;
        localExitPointY = 0;
        break;
    }

    const segmentLocalCenterX = CELL_SIZE / 2;
    const segmentLocalCenterY = CELL_SIZE / 2;

    const pointsToRotate = [
      { x: localEntryPointX, y: localEntryPointY },
      { x: localExitPointX, y: localExitPointY },
    ];

    const rotatedPoints = pointsToRotate.map(point => {
      const relX = point.x - segmentLocalCenterX;
      const relY = point.y - segmentLocalCenterY;

      const rotRad = (rotation * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const rotatedX = relX * cosR - relY * sinR;
      const rotatedY = relX * sinR + relY * cosR;

      return {
        x: rotatedX + segmentLocalCenterX + segTopLeftX,
        y: rotatedY + segmentLocalCenterY + segTopLeftY,
      };
    });
    return { entryPoint: rotatedPoints[0], exitPoint: rotatedPoints[1] };
  }, []);


  const handleStartSimulation = useCallback(() => {
    if (isAnalyzing) {
      alert("Please wait for analysis to complete before simulating.");
      return;
    }
    if (!analysisResult || !analysisResult.isClosedLoop) {
      alert("Please analyze the track and ensure it's considered a closed loop before simulating.");
      return;
    }
    if (placedSegments.length < MIN_SEGMENTS_FOR_LOOP) {
      alert(`Track must have at least ${MIN_SEGMENTS_FOR_LOOP} segments to simulate.`);
      return;
    }
    if (isSimulating) return;

    setIsSimulating(true);
    setSimulatedTime(0);
    simulatedTimeRef.current = 0;
    setCurrentSimSegmentIndex(0);
    segmentEnterTimeRef.current = 0;

    const firstSegment = placedSegments[0];
    if (firstSegment) {
      const { entryPoint } = getSegmentVisualEndpoints(firstSegment);
      setSimulationCarPosition(entryPoint);
      setSimulationCarRotation(firstSegment.rotation); // Initial rotation based on first segment
      previousCarPositionForRotationRef.current = { ...entryPoint }; // Initialize for rotation calc
    } else {
      setIsSimulating(false);
      return;
    }
    lastFrameTimeRef.current = performance.now();
  }, [analysisResult, isAnalyzing, isSimulating, placedSegments, getSegmentVisualEndpoints]);

  useEffect(() => {
    if (!isSimulating) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        previousCarPositionForRotationRef.current = null; // Reset on simulation stop
        return;
    }
    if (currentSimSegmentIndex === null || currentSimSegmentIndex >= placedSegments.length) {
        setIsSimulating(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
    }

    const animate = (timestamp: number) => {
      if (!isSimulatingRef.current) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const currentSegment = placedSegments[currentSimSegmentIndex!];
      if (!currentSegment) {
        setIsSimulating(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const deltaTime = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const newSimulatedTotalTime = simulatedTimeRef.current + deltaTime;
      simulatedTimeRef.current = newSimulatedTotalTime;
      setSimulatedTime(newSimulatedTotalTime);

      const segmentDef = AVAILABLE_SEGMENTS.find(s => s.type === currentSegment.type);
      const segmentDuration = segmentDef ? segmentDef.baseTimeMs : 1000;

      const elapsedInSegment = newSimulatedTotalTime - segmentEnterTimeRef.current;
      let progressRatio = Math.min(1, elapsedInSegment / segmentDuration);

      let newCarX, newCarY;
      let newCarRot = simulationCarRotation; // Default to current rotation

      const { entryPoint, exitPoint } = getSegmentVisualEndpoints(currentSegment);

      if (currentSegment.type === 'straight') {
        newCarX = entryPoint.x + (exitPoint.x - entryPoint.x) * progressRatio;
        newCarY = entryPoint.y + (exitPoint.y - entryPoint.y) * progressRatio;
      } else { // Corner
        const segmentTopLeftX = currentSegment.x;
        const segmentTopLeftY = currentSegment.y;
        const radius = CELL_SIZE / 2;

        const arcCenterXLocal = radius;
        const arcCenterYLocal = radius;
        const startAngleRad = Math.PI; // Local angle for the arc starting at the left mid-point
        const endAngleRad = Math.PI / 2;   // Local angle for the arc ending at the top mid-point

        const currentAngleRad = startAngleRad + (endAngleRad - startAngleRad) * progressRatio;

        const carX_on_arc_local_to_center = radius * Math.cos(currentAngleRad);
        const carY_on_arc_local_to_center = radius * Math.sin(currentAngleRad);

        const carX_local_to_segment_origin = arcCenterXLocal + carX_on_arc_local_to_center;
        const carY_local_to_segment_origin = arcCenterYLocal + carY_on_arc_local_to_center;

        const localRelToSegCenter_X = carX_local_to_segment_origin - (CELL_SIZE / 2);
        const localRelToSegCenter_Y = carY_local_to_segment_origin - (CELL_SIZE / 2);

        const segRotRad = (currentSegment.rotation * Math.PI) / 180;
        const cosSegRot = Math.cos(segRotRad);
        const sinSegRot = Math.sin(segRotRad);

        const rotatedRelX = localRelToSegCenter_X * cosSegRot - localRelToSegCenter_Y * sinSegRot;
        const rotatedRelY = localRelToSegCenter_X * sinSegRot + localRelToSegCenter_Y * cosSegRot;

        newCarX = rotatedRelX + (CELL_SIZE / 2) + segmentTopLeftX;
        newCarY = rotatedRelY + (CELL_SIZE / 2) + segmentTopLeftY;
      }

      // Update rotation based on movement direction
      const prevPosForRot = previousCarPositionForRotationRef.current;
      if (prevPosForRot) {
          const dx = newCarX - prevPosForRot.x;
          const dy = newCarY - prevPosForRot.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) { // Avoid atan2(0,0) and ensure movement
              const angleRad = Math.atan2(dy, dx);
              newCarRot = (angleRad * 180) / Math.PI;
          }
      }
      setSimulationCarRotation(newCarRot % 360);
      setSimulationCarPosition({ x: newCarX, y: newCarY });
      previousCarPositionForRotationRef.current = { x: newCarX, y: newCarY };


      if (progressRatio >= 1) {
        const nextSimSegmentIndex = currentSimSegmentIndex! + 1;
        // Store the exit point of the current segment before moving to the next
        const currentSegmentExitPoint = getSegmentVisualEndpoints(currentSegment).exitPoint;
        previousCarPositionForRotationRef.current = { ...currentSegmentExitPoint }; // Prime for next segment entry rotation

        if (nextSimSegmentIndex < placedSegments.length) {
          segmentEnterTimeRef.current = newSimulatedTotalTime;
          setCurrentSimSegmentIndex(nextSimSegmentIndex);

          const nextSegment = placedSegments[nextSimSegmentIndex];
          const { entryPoint: nextEntryPoint } = getSegmentVisualEndpoints(nextSegment);
          setSimulationCarPosition(nextEntryPoint); // Snap to start of next segment
          // Initial rotation for the next segment will be calculated in the next frame
        } else {
          setIsSimulating(false);
          setSimulationCarPosition(exitPoint); // Ensure car is at the very end
        }
      }

      if (isSimulatingRef.current && (currentSimSegmentIndex! < placedSegments.length -1 || (currentSimSegmentIndex === placedSegments.length -1 && progressRatio < 1)) ) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (isSimulatingRef.current) {
        setIsSimulating(false);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, currentSimSegmentIndex, placedSegments, getSegmentVisualEndpoints, simulationCarRotation]);


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
    if (isSimulating) setIsSimulating(false);
    const savedTrackJSON = localStorage.getItem(LOCAL_STORAGE_TRACK_PREFIX + nameToLoad);
    if (savedTrackJSON) {
      try {
        const trackLayout: TrackLayout = JSON.parse(savedTrackJSON);
        setPlacedSegments(trackLayout.placedSegments || []);
        setTrackName(trackLayout.trackName || nameToLoad);
        setAnalysisResult(null);
        setSimulatedTime(0);
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

    isSimulating,
    simulationCarPosition,
    simulationCarRotation,
    simulatedTime,
    handleStartSimulation,
    formatTime,
    MIN_SEGMENTS_FOR_LOOP,
  };
}
