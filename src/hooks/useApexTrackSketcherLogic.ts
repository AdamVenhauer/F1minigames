
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SegmentType, PlacedSegment, Rotation, SegmentDefinition, TrackLayout, TrackAnalysisInput, TrackAnalysisOutput } from '@/lib/types';
// Removed analyzeTrackFlow import as it's no longer used
import { v4 as uuidv4 } from 'uuid';

export const AVAILABLE_SEGMENTS: SegmentDefinition[] = [
  { type: 'straight', label: 'Straight', baseTimeMs: 300 },
  { type: 'corner', label: 'Corner', baseTimeMs: 700 }, // Increased time for corners
];

export const CELL_SIZE = 30; // pixels
const GRID_COLS = 30; // Number of columns in the grid
const GRID_ROWS = 20; // Number of rows in the grid
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
  const segmentEnterTimeRef = useRef<number>(0); // Time when car entered current segment
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
    if (!selectedSegmentType || isSimulating) return;

    const newSegmentX = centerX - CELL_SIZE / 2; // Calculate top-left from center
    const newSegmentY = centerY - CELL_SIZE / 2;

    const newSegment: PlacedSegment = {
      id: uuidv4(),
      type: selectedSegmentType,
      x: newSegmentX,
      y: newSegmentY,
      rotation: currentRotation,
    };
    
    // Check if placing on top of an existing segment (within a small threshold)
    const proximityThreshold = CELL_SIZE / 2.5; 
    const existingSegmentIndex = placedSegments.findIndex(seg => {
        // Calculate center of existing segment
        const segCenterX = seg.x + CELL_SIZE / 2;
        const segCenterY = seg.y + CELL_SIZE / 2;
        return Math.abs(segCenterX - centerX) < proximityThreshold && Math.abs(segCenterY - centerY) < proximityThreshold;
    });

    if (existingSegmentIndex !== -1) {
      // Replace existing segment
      setPlacedSegments(prevSegments => {
        const updatedSegments = [...prevSegments];
        updatedSegments[existingSegmentIndex] = newSegment;
        return updatedSegments;
      });
    } else {
      // Add new segment
      setPlacedSegments(prevSegments => [...prevSegments, newSegment]);
    }
    setAnalysisResult(null); // New segment invalidates previous analysis
  }, [selectedSegmentType, currentRotation, placedSegments, isSimulating]);

  const handleRemoveSegment = useCallback((clickX: number, clickY: number) => {
    if (isSimulating) return;
    let segmentToRemoveId: string | null = null;
    // Iterate in reverse to remove topmost segment if overlapping
    for (let i = placedSegments.length - 1; i >= 0; i--) {
        const segment = placedSegments[i];
        const segCenterX = segment.x + CELL_SIZE / 2;
        const segCenterY = segment.y + CELL_SIZE / 2;

        // Translate click point to be relative to segment's center
        const relX = clickX - segCenterX;
        const relY = clickY - segCenterY;

        // Apply inverse rotation of the segment to the relative click point
        const angleRad = -(segment.rotation * Math.PI) / 180;
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);

        const rotatedRelX = relX * cosAngle - relY * sinAngle;
        const rotatedRelY = relX * sinAngle + relY * cosAngle;

        // Check if the un-rotated point is within the segment's un-rotated bounding box
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
      setAnalysisResult(null); // Removing segment invalidates analysis
    }
  }, [placedSegments, isSimulating]);

  const handleClearCanvas = useCallback(() => {
    if (isSimulating) setIsSimulating(false); // Stop simulation if running
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
    setAnalysisResult(null); // Clear previous results
    setSimulatedTime(0);    // Reset simulated time from previous runs

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
        isClosedLoop: true, // Basic check, not a true geometric check
      });
    }
    setIsAnalyzing(false);
  }, [placedSegments]);


  const getSegmentVisualEndpoints = useCallback((segment: PlacedSegment) => {
    const { type, x, y, rotation } = segment;
    const segTopLeftX = x; // This is the segment's CSS top-left position
    const segTopLeftY = y;

    // Local coordinates (relative to segment's unrotated top-left 0,0) of entry/exit points of the centerline
    let localEntryPointX = 0, localEntryPointY = 0, localExitPointX = 0, localExitPointY = 0;

    switch (type) {
      case 'straight':
        localEntryPointX = 0;            // Left edge, middle
        localEntryPointY = CELL_SIZE / 2;
        localExitPointX = CELL_SIZE;     // Right edge, middle
        localExitPointY = CELL_SIZE / 2;
        break;
      case 'corner': // Assuming default corner enters from left, exits to top (like the SVG)
        localEntryPointX = 0;            // Left edge, middle
        localEntryPointY = CELL_SIZE / 2;
        localExitPointX = CELL_SIZE / 2; // Top edge, middle
        localExitPointY = 0;
        break;
    }

    // The segment's visual center in its own local coordinate system
    const segmentLocalCenterX = CELL_SIZE / 2;
    const segmentLocalCenterY = CELL_SIZE / 2;

    const pointsToRotate = [
      { x: localEntryPointX, y: localEntryPointY }, // Entry
      { x: localExitPointX, y: localExitPointY }, // Exit
    ];

    const rotatedPoints = pointsToRotate.map(point => {
      // Translate point so rotation origin (segmentLocalCenter) is at (0,0)
      const relX = point.x - segmentLocalCenterX;
      const relY = point.y - segmentLocalCenterY;

      // Rotate point
      const rotRad = (rotation * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const rotatedX = relX * cosR - relY * sinR;
      const rotatedY = relX * sinR + relY * cosR;

      // Translate point back, then add segment's global top-left position
      return {
        x: rotatedX + segmentLocalCenterX + segTopLeftX,
        y: rotatedY + segmentLocalCenterY + segTopLeftY,
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
      alert("Please analyze the track and ensure it's considered a closed loop before simulating.");
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
    segmentEnterTimeRef.current = 0; // Simulation starts at time 0 relative to the first segment

    const firstSegment = placedSegments[0];
    if (firstSegment) {
      const { entryPoint } = getSegmentVisualEndpoints(firstSegment);
      setSimulationCarPosition(entryPoint);
      setSimulationCarRotation(firstSegment.rotation); // Initial car rotation matches first segment
    } else {
      setIsSimulating(false); // Should not happen if guards above pass
      return;
    }
    lastFrameTimeRef.current = performance.now();
  }, [analysisResult, isAnalyzing, isSimulating, placedSegments, getSegmentVisualEndpoints]);

  useEffect(() => {
    // Animation loop
    if (!isSimulating || currentSimSegmentIndex === null || currentSimSegmentIndex >= placedSegments.length) {
      if (isSimulating) { // If it was simulating but conditions no longer met (e.g., end of track)
          setIsSimulating(false);
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const animate = (timestamp: number) => {
      if (!isSimulatingRef.current) { // Use ref for immediate check
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const currentSegment = placedSegments[currentSimSegmentIndex];
      if (!currentSegment) { // Should not happen if index is within bounds
        setIsSimulating(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      const deltaTime = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const newSimulatedTotalTime = simulatedTimeRef.current + deltaTime;
      simulatedTimeRef.current = newSimulatedTotalTime;
      setSimulatedTime(newSimulatedTotalTime); // Update state for display

      const segmentDef = AVAILABLE_SEGMENTS.find(s => s.type === currentSegment.type);
      const segmentDuration = segmentDef ? segmentDef.baseTimeMs : 1000; // Default duration if somehow undefined

      const elapsedInSegment = newSimulatedTotalTime - segmentEnterTimeRef.current;
      let progressRatio = Math.min(1, elapsedInSegment / segmentDuration);

      let newCarX, newCarY;
      let newCarRot = currentSegment.rotation; // Default to segment's rotation

      const { entryPoint, exitPoint } = getSegmentVisualEndpoints(currentSegment);

      if (currentSegment.type === 'straight') {
        newCarX = entryPoint.x + (exitPoint.x - entryPoint.x) * progressRatio;
        newCarY = entryPoint.y + (exitPoint.y - entryPoint.y) * progressRatio;
        newCarRot = currentSegment.rotation;
      } else { // Corner
        const segmentTopLeftX = currentSegment.x;
        const segmentTopLeftY = currentSegment.y;
        const radius = CELL_SIZE / 2;
        
        // Local arc params (relative to segment's origin, matching SVG path)
        // For <path d="M 0 ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0">
        // Arc center in local space is (radius, radius) for this specific drawing
        const arcCenterXLocal = radius;
        const arcCenterYLocal = radius;
        const startAngleRad = Math.PI; // Starts at left-middle of the segment box
        const endAngleRad = Math.PI / 2;   // Ends at top-middle of the segment box (90 deg sweep CCW visually)
        
        const currentAngleRad = startAngleRad + (endAngleRad - startAngleRad) * progressRatio;
        
        // Position on the arc relative to the arc's center
        const carX_on_arc_local_to_center = radius * Math.cos(currentAngleRad);
        const carY_on_arc_local_to_center = radius * Math.sin(currentAngleRad);
        
        // Position on the arc relative to the segment's top-left (0,0)
        const carX_local_to_segment_origin = arcCenterXLocal + carX_on_arc_local_to_center;
        const carY_local_to_segment_origin = arcCenterYLocal + carY_on_arc_local_to_center;
        
        // Now, transform this local point (within segment) to global canvas coordinates
        // taking into account the segment's rotation and global position.
        // First, get coords relative to segment's own rotation center (CELL_SIZE/2, CELL_SIZE/2)
        const localRelToSegCenter_X = carX_local_to_segment_origin - (CELL_SIZE / 2);
        const localRelToSegCenter_Y = carY_local_to_segment_origin - (CELL_SIZE / 2);
        
        const segRotRad = (currentSegment.rotation * Math.PI) / 180;
        const cosSegRot = Math.cos(segRotRad);
        const sinSegRot = Math.sin(segRotRad);
        
        // Rotate these relative coords
        const rotatedRelX = localRelToSegCenter_X * cosSegRot - localRelToSegCenter_Y * sinSegRot;
        const rotatedRelY = localRelToSegCenter_X * sinSegRot + localRelToSegCenter_Y * cosSegRot;
        
        // Translate back by segment's center, then by segment's global top-left
        newCarX = rotatedRelX + (CELL_SIZE / 2) + segmentTopLeftX;
        newCarY = rotatedRelY + (CELL_SIZE / 2) + segmentTopLeftY;
        
        // Tangential rotation for the car
        // The tangent to a circle at angle 'a' is 'a - PI/2' (or 'a + PI/2' depending on direction)
        const tangentAngleRad = currentAngleRad - (Math.PI / 2); // If sweep is CCW
        newCarRot = (tangentAngleRad * 180 / Math.PI) + currentSegment.rotation;
      }

      setSimulationCarPosition({ x: newCarX, y: newCarY });
      setSimulationCarRotation(newCarRot);

      if (progressRatio >= 1) {
        const nextSimSegmentIndex = currentSimSegmentIndex + 1;
        if (nextSimSegmentIndex < placedSegments.length) {
          segmentEnterTimeRef.current = newSimulatedTotalTime; // Mark entry time for next segment
          setCurrentSimSegmentIndex(nextSimSegmentIndex);
          // Set car to exact exit point of current segment / entry of next to avoid visual jumps
          const nextSegment = placedSegments[nextSimSegmentIndex];
          const { entryPoint: nextEntryPoint } = getSegmentVisualEndpoints(nextSegment);
          setSimulationCarPosition(nextEntryPoint); // Could also use exitPoint of current
          setSimulationCarRotation(nextSegment.rotation); // Initial rotation for next segment
        } else { // End of track
          setIsSimulating(false);
          // Snap car to the final exit point
          const { exitPoint: finalExitPoint } = getSegmentVisualEndpoints(currentSegment);
          setSimulationCarPosition(finalExitPoint);
        }
      }
      
      if (isSimulatingRef.current && currentSimSegmentIndex < placedSegments.length -1 || (currentSimSegmentIndex === placedSegments.length -1 && progressRatio < 1) ) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (isSimulatingRef.current) { // If it was simulating but conditions to continue are no longer met
        setIsSimulating(false); 
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, currentSimSegmentIndex, placedSegments, getSegmentVisualEndpoints]);


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
        setAnalysisResult(null); // Reset analysis
        setSimulatedTime(0);    // Reset simulated time
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
    GRID_COLS, // Export for canvas sizing if needed elsewhere
    GRID_ROWS,  // Export for canvas sizing if needed elsewhere
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
