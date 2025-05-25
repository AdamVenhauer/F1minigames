
"use client";

import type { PlacedSegment, SegmentType, Rotation } from '@/lib/types';
import React, { useRef, useState, useEffect } from 'react';
import { CELL_SIZE } from '@/hooks/useApexTrackSketcherLogic'; // Import CELL_SIZE

interface TrackCanvasProps {
  gridCols: number; // Now used for initial canvas dimensions, not snapping
  gridRows: number; // Now used for initial canvas dimensions, not snapping
  placedSegments: PlacedSegment[];
  onPlaceSegment: (centerX: number, centerY: number) => void;
  onRemoveSegment: (clickX: number, clickY: number) => void;
  selectedSegmentType: SegmentType | null;
  currentRotation: Rotation;
}

const SegmentVisual = ({ segment, isPreview }: { segment: PlacedSegment, isPreview?: boolean }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: segment.x, // top-left x
    top: segment.y,  // top-left y
    width: CELL_SIZE,
    height: CELL_SIZE,
    transform: `rotate(${segment.rotation}deg)`,
    transformOrigin: 'center center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isPreview ? 0.6 : 1,
    pointerEvents: 'none', // Important for preview so it doesn't block clicks
  };

  const svgStyle: React.SVGAttributes<SVGSVGElement> = {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  };

  const strokeColor = "hsl(var(--primary))";
  const trackStrokeWidth = Math.max(4, CELL_SIZE / 3.5);
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
              strokeLinecap="butt"
              strokeLinejoin="round"
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
              strokeLinecap="butt"
              strokeLinejoin="round"
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
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const canvasWidth = gridCols * CELL_SIZE;
  const canvasHeight = gridRows * CELL_SIZE;

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedSegmentType) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    onPlaceSegment(clickX, clickY); // Pass raw coords (center of new segment)
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!canvasRef.current) return;
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
    display: 'grid', // Still useful for the background grid lines
    gridTemplateColumns: `repeat(${gridCols}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(${gridRows}, ${CELL_SIZE}px)`,
    width: canvasWidth,
    height: canvasHeight,
    border: '1px solid hsl(var(--border))',
    position: 'relative',
    backgroundColor: 'hsl(var(--muted) / 0.3)',
    cursor: 'crosshair',
    overflow: 'hidden', // Clip segments that go off-canvas
  };

  return (
    <div
      className="overflow-auto max-w-full max-h-[70vh] border rounded-md shadow-inner bg-background flex items-center justify-center"
      // Style below is for the outer scroll container, making sure it can contain the canvas
      style={{ width: canvasWidth + 4, height: canvasHeight + 4 }} 
    >
      <div
        ref={canvasRef}
        style={gridStyle}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="application" // More appropriate role for interactive canvas
        aria-label="Track design canvas"
      >
        {/* Background Grid Lines */}
        {Array.from({ length: gridRows * gridCols }).map((_, index) => {
          const col = index % gridCols;
          const row = Math.floor(index / gridCols);
          return (
            <div
              key={`gridcell-${row}-${col}`}
              className="border-r border-b border-[hsl(var(--border)/0.1)]"
              style={{
                gridColumnStart: col + 1,
                gridRowStart: row + 1,
              }}
              aria-hidden="true"
            />
          );
        })}

        {/* Placed Segments */}
        {placedSegments.map((segment) => (
          <SegmentVisual key={segment.id} segment={segment} />
        ))}

        {/* Hover Preview Segment */}
        {mousePosition && selectedSegmentType && (
          <SegmentVisual
            segment={{
              id: 'preview',
              type: selectedSegmentType,
              x: mousePosition.x - CELL_SIZE / 2, // Position top-left for preview
              y: mousePosition.y - CELL_SIZE / 2, // Position top-left for preview
              rotation: currentRotation,
            }}
            isPreview
          />
        )}
      </div>
    </div>
  );
}

    