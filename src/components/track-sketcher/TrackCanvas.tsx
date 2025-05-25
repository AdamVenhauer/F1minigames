
"use client";

import type { PlacedSegment, SegmentType, Rotation } from '@/lib/types';
import React, { useRef, useState, useEffect } from 'react';
import { CELL_SIZE } from '@/hooks/useApexTrackSketcherLogic';

interface TrackCanvasProps {
  gridCols: number;
  gridRows: number;
  placedSegments: PlacedSegment[];
  onPlaceSegment: (centerX: number, centerY: number) => void;
  onRemoveSegment: (clickX: number, clickY: number) => void;
  selectedSegmentType: SegmentType | null;
  currentRotation: Rotation;
  isSimulating: boolean;
  simulationCarPosition: { x: number; y: number } | null;
  simulationCarRotation: number;
}

const SegmentVisual = ({ segment, isPreview }: { segment: PlacedSegment, isPreview?: boolean }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: segment.x,
    top: segment.y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    transform: `rotate(${segment.rotation}deg)`,
    transformOrigin: 'center center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isPreview ? 0.6 : 1,
    pointerEvents: 'none', // Important for previews so they don't block clicks
  };

  const svgStyle: React.SVGAttributes<SVGSVGElement> = {
    width: '100%',
    height: '100%',
    overflow: 'visible', // Allow strokes to go slightly outside if needed
  };

  const strokeColor = "hsl(var(--primary))";
  const trackStrokeWidth = Math.max(4, CELL_SIZE / 3.5); // Made thicker
  const radius = CELL_SIZE / 2;

  switch (segment.type) {
    case 'straight':
      return (
        <div style={style}>
          <svg {...svgStyle}>
            <line
              x1="0"
              y1={radius}
              x2={CELL_SIZE}
              y2={radius}
              stroke={strokeColor}
              strokeWidth={trackStrokeWidth}
              strokeLinecap="butt" // Changed from "round" for better connection
              strokeLinejoin="round" // Added for smoother joins with thick lines
            />
          </svg>
        </div>
      );
    case 'corner':
      return (
        <div style={style}>
          <svg {...svgStyle}>
            <path
              d={`M 0 ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0`}
              stroke={strokeColor}
              strokeWidth={trackStrokeWidth}
              fill="none"
              strokeLinecap="butt" // Changed from "round" for better connection
              strokeLinejoin="round" // Added for smoother joins with thick lines
            />
          </svg>
        </div>
      );
    default:
      return <div style={{ ...style, backgroundColor: 'rgba(255,0,0,0.3)' }} title={`Unknown: ${segment.type}`} />;
  }
};


export function TrackCanvas({
  gridCols,
  gridRows,
  placedSegments,
  onPlaceSegment,
  onRemoveSegment,
  selectedSegmentType,
  currentRotation,
  isSimulating,
  simulationCarPosition,
  simulationCarRotation,
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const canvasWidth = gridCols * CELL_SIZE;
  const canvasHeight = gridRows * CELL_SIZE;

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || isSimulating) return; // Prevent placement during simulation
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // No longer snapping to grid for segment center
    onPlaceSegment(clickX, clickY);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!canvasRef.current || isSimulating) return; // Prevent removal during simulation
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    onRemoveSegment(clickX, clickY);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePosition(null);
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCols}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(${gridRows}, ${CELL_SIZE}px)`,
    width: canvasWidth,
    height: canvasHeight,
    border: '1px solid hsl(var(--border))',
    position: 'relative', // For absolute positioning of segments
    backgroundColor: 'hsl(var(--muted) / 0.3)',
    cursor: isSimulating ? 'default' : 'crosshair',
    overflow: 'hidden', // Clip segments that go outside bounds
  };

  const carSize = CELL_SIZE / 2.5; // Car size relative to cell size

  return (
    <div
      className="overflow-auto max-w-full max-h-[70vh] border rounded-md shadow-inner bg-background flex items-center justify-center"
      style={{ width: canvasWidth + 4, height: canvasHeight + 4 }} // +4 for border
    >
      <div
        ref={canvasRef}
        style={gridStyle}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="application"
        aria-label="Track design canvas"
      >
        {/* Render Grid Cells (optional, can be done with CSS background) */}
        {Array.from({ length: gridRows * gridCols }).map((_, index) => {
          const col = index % gridCols;
          const row = Math.floor(index / gridCols);
          return (
            <div
              key={`gridcell-${row}-${col}`}
              className="border-r border-b border-[hsl(var(--border)/0.1)]"
              style={{ gridColumnStart: col + 1, gridRowStart: row + 1 }}
              aria-hidden="true"
            />
          );
        })}

        {/* Render Placed Segments */}
        {placedSegments.map((segment) => (
          <SegmentVisual key={segment.id} segment={segment} />
        ))}

        {/* Render Hover Preview Segment if a type is selected and not simulating */}
        {mousePosition && selectedSegmentType && !isSimulating && (
          <SegmentVisual
            segment={{
              id: 'preview',
              type: selectedSegmentType,
              x: mousePosition.x - CELL_SIZE / 2, // Center preview on mouse
              y: mousePosition.y - CELL_SIZE / 2,
              rotation: currentRotation,
            }}
            isPreview
          />
        )}

        {/* Render Simulation Car */}
        {isSimulating && simulationCarPosition && (
          <div
            style={{
              position: 'absolute',
              left: simulationCarPosition.x - carSize / 2,
              top: simulationCarPosition.y - carSize / 2,
              width: carSize,
              height: carSize,
              transform: `rotate(${simulationCarRotation}deg)`,
              transformOrigin: 'center center',
              transition: 'left 0.05s linear, top 0.05s linear', // Smooths rapid updates if React batches
            }}
            aria-label="Simulation car"
          >
            {/* SVG for the car - simple triangle pointing "right" (0 degrees in its own space) */}
            <svg width={carSize} height={carSize} viewBox={`-${carSize/2.5} -${carSize/2.5} ${carSize*1.2} ${carSize*1.2}`} fill="hsl(var(--destructive))">
                {/* Adjusted path for better centering and pointing direction */}
                <path d={`M${carSize*0.4} 0 L-${carSize*0.2} -${carSize*0.25} L-${carSize*0.2} ${carSize*0.25} Z`} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
