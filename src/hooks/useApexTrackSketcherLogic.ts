
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
const MIN_SEGMENTS_FOR_LOOP = 4;

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
  const [simulationCarRotation, setSimulationCarRotation] = useState<number>(0); // New state for car rotation
  const [simulatedTime, setSimulatedTime] = useState<number>(0);
  const [currentSimSegmentIndex, setCurrentSimSegmentIndex] = useState<number | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const segmentEnterTimeRef = useRef<number>(0);
  const isSimulatingRef = useRef(isSimulating);
  const simulatedTimeRef = useRef(simulatedTime);

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

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing

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
    let characteristics: string[] = [`Straights: ${numStraights}`, `Corners: ${numCorners}`];
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
    const segCenterX = x + CELL_SIZE / 2;
    const segCenterY = y + CELL_SIZE / 2;
    const radius = CELL_SIZE / 2;

    let localEntryX = 0, localEntryY = 0, localExitX = 0, localExitY = 0;

    switch (type) {
      case 'straight':
        localEntryX = -radius;
        localEntryY = 0;
        localExitX = radius;
        localExitY = 0;
        break;
      case 'corner': // Default 'corner' (0 deg rotation) enters from left, exits to top
        localEntryX = -radius;
        localEntryY = 0;
        localExitX = 0;
        localExitY = -radius;
        break;
    }

    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const entryPoint = {
      x: segCenterX + (localEntryX * cosR - localEntryY * sinR),
      y: segCenterY + (localEntryX * sinR + localEntryY * cosR),
    };
    const exitPoint = {
      x: segCenterX + (localExitX * cosR - localExitY * sinR),
      y: segCenterY + (localExitX * sinR + localExitY * cosR),
    };

    return { entryPoint, exitPoint };
  }, []);


  const handleStartSimulation = useCallback(() => {
    if (isAnalyzing || !analysisResult || !analysisResult.isClosedLoop || placedSegments.length === 0) {
      alert("Please ensure your track is analyzed and forms a closed loop before simulating.");
      return;
    }
    setIsSimulating(true);
    setSimulatedTime(0);
    setCurrentSimSegmentIndex(0);
    segmentEnterTimeRef.current = 0;

    const firstSegment = placedSegments[0];
    if (firstSegment) {
      const { entryPoint } = getSegmentVisualEndpoints(firstSegment);
      setSimulationCarPosition(entryPoint);
      setSimulationCarRotation(firstSegment.rotation); // Initial car rotation
    }
    lastFrameTimeRef.current = performance.now();
  }, [isAnalyzing, analysisResult, placedSegments, getSegmentVisualEndpoints]);


  useEffect(() => {
    if (!isSimulatingRef.current || currentSimSegmentIndex === null || currentSimSegmentIndex >= placedSegments.length) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setIsSimulating(false); // Ensure simulation stops if conditions aren't met
      return;
    }

    const animate = (timestamp: number) => {
      if (!isSimulatingRef.current) return;

      const currentSegment = placedSegments[currentSimSegmentIndex];
      if (!currentSegment) {
        setIsSimulating(false);
        return;
      }

      const deltaTime = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;
      
      const newSimulatedTime = simulatedTimeRef.current + deltaTime;
      setSimulatedTime(newSimulatedTime); // Update state for display

      const segmentDef = AVAILABLE_SEGMENTS.find(s => s.type === currentSegment.type);
      const segmentDuration = segmentDef ? segmentDef.baseTimeMs : 1000; // Fallback duration

      const elapsedInSegment = newSimulatedTime - segmentEnterTimeRef.current;
      let progressRatio = Math.min(1, elapsedInSegment / segmentDuration);

      const segCenterX = currentSegment.x + CELL_SIZE / 2;
      const segCenterY = currentSegment.y + CELL_SIZE / 2;
      const radius = CELL_SIZE / 2;

      let newCarX = 0;
      let newCarY = 0;
      let newCarRot = currentSegment.rotation;

      if (currentSegment.type === 'straight') {
        const { entryPoint, exitPoint } = getSegmentVisualEndpoints(currentSegment);
        newCarX = entryPoint.x + (exitPoint.x - entryPoint.x) * progressRatio;
        newCarY = entryPoint.y + (exitPoint.y - entryPoint.y) * progressRatio;
        newCarRot = currentSegment.rotation;
      } else if (currentSegment.type === 'corner') {
        // Arc path logic for a corner starting at 0 deg rotation (connects left to top)
        // Local arc center is (radius, radius) relative to top-left 0,0 of the segment's unrotated bounding box
        // It sweeps from PI (180deg, left middle) to PI/2 (90deg, top middle)
        const startAngle = Math.PI; // Corresponds to left entrance for a 0-degree rotated corner
        const endAngle = Math.PI / 2; // Corresponds to top exit
        const currentAngle = startAngle + (endAngle - startAngle) * progressRatio;

        // Local coordinates relative to the segment's own center
        const localCarX = radius * Math.cos(currentAngle);
        const localCarY = radius * Math.sin(currentAngle);

        // World coordinates transformation
        const rotRad = (currentSegment.rotation * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);
        
        // The center of the arc in local segment coordinates (for a 0-degree rotated corner)
        // This corner is defined such that its path is from (-radius, 0) to (0, -radius)
        // and the center of this arc is at (0,0) of the segment *if* the segment's center is the arc center.
        // Let's define the local arc for a 0-deg rotated corner as centered at (0,0) of its cell,
        // sweeping from (radius, 0) [right] to (0, -radius) [top] if radius is cell_size/2.
        // For our segment drawn from left-mid to top-mid:
        // Start: (-radius, 0), End: (0, -radius), relative to segment center.
        // Arc center for this type of corner (if it's a quarter circle in bottom-left quadrant of local coords) is (0,0)
        
        // Simpler: let's use the SVG path definition as guide. It went from (0, radius) to (radius, 0) relative to top-left.
        // This is a quarter circle in the top-left. Arc center is (radius, radius) from top-left (0,0).
        // Local coords for car: (relative to segment's top-left (0,0))
        // Arc radius = CELL_SIZE / 2
        // Arc center (local) = (CELL_SIZE / 2, CELL_SIZE / 2)
        // Angle sweep from 180 deg (PI) to 90 deg (PI/2) for a standard corner
        
        const arcCenterXLocal = radius;
        const arcCenterYLocal = radius;
        const angle = Math.PI + ( (Math.PI / 2) - Math.PI) * progressRatio; // Sweeps from PI to PI/2

        const carX_local_to_arc_center = radius * Math.cos(angle);
        const carY_local_to_arc_center = radius * Math.sin(angle);

        const carX_local_to_segment_origin = arcCenterXLocal + carX_local_to_arc_center;
        const carY_local_to_segment_origin = arcCenterYLocal + carY_local_to_arc_center;

        // Transform local segment coordinates to world coordinates
        newCarX = currentSegment.x + (carX_local_to_segment_origin * cosR - carY_local_to_segment_origin * sinR);
        newCarY = currentSegment.y + (carX_local_to_segment_origin * sinR + carY_local_to_segment_origin * cosR);

        // Tangential rotation
        const tangentAngle = angle - Math.PI / 2; // Normal to the radius vector
        newCarRot = (tangentAngle * 180 / Math.PI) + currentSegment.rotation;
      }

      setSimulationCarPosition({ x: newCarX, y: newCarY });
      setSimulationCarRotation(newCarRot);

      if (progressRatio >= 1) {
        if (currentSimSegmentIndex < placedSegments.length - 1) {
          segmentEnterTimeRef.current = newSimulatedTime; // Or use target duration? simulatedTimeRef.current;
          setCurrentSimSegmentIndex(prev => (prev !== null ? prev + 1 : 0));
        } else {
          setIsSimulating(false); // Lap finished
          const { exitPoint } = getSegmentVisualEndpoints(currentSegment);
          setSimulationCarPosition(exitPoint); // Snap to exact end
        }
      }

      if (isSimulatingRef.current) { // Check ref before requesting next frame
        animationFrameRef.current = requestAnimationFrame(animate);
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
  };
}
