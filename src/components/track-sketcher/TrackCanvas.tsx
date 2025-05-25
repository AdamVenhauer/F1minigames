
"use client";

import type { PlacedSegment, SegmentType, Rotation } from '@/lib/types';
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TrackCanvasProps {
  gridCols: number;
  gridRows: number;
  placedSegments: PlacedSegment[];
  onPlaceSegment: (x: number, y: number) => void;
  onRemoveSegment: (x: number, y: number) => void; // Added for right-click removal
  cellSize?: number;
  selectedSegmentType: SegmentType | null; // For preview/hover
  currentRotation: Rotation; // For preview/hover
}

const CELL_SIZE_DEFAULT = 30; // px

const SegmentVisual = ({ segment, cellSize }: { segment: PlacedSegment, cellSize: number }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: segment.x * cellSize,
    top: segment.y * cellSize,
    width: cellSize,
    height: cellSize,
    transform: `rotate(${segment.rotation}deg)`,
    transformOrigin: 'center center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed rgba(255,255,255,0.1)', // For visual debugging of cell
  };

  const svgStyle: React.SVGAttributes<SVGSVGElement> = {
    width: '100%',
    height: '100%',
    overflow: 'visible', // Allow strokes to go outside the box slightly
  };

  const strokeColor = "hsl(var(--primary))";
  const strokeWidth = Math.max(2, cellSize / 10);


  switch (segment.type) {
    case 'straight':
      return (
        <div style={style}>
          <svg {...svgStyle}>
            <line x1="0" y1={cellSize / 2} x2={cellSize} y2={cellSize / 2} stroke={strokeColor} strokeWidth={strokeWidth} />
          </svg>
        </div>
      );
    case 'corner': // 90-degree corner, default open towards top-right when rotation=0
      return (
        <div style={style}>
          <svg {...svgStyle}>
            {/* Path: from mid-left to center, then center to mid-top */}
            <path d={`M0 ${cellSize / 2} L ${cellSize / 2} ${cellSize / 2} L ${cellSize / 2} 0`}
                  stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          </svg>
        </div>
      );
    // Add cases for chicane_left, chicane_right etc. when defined
    default:
      return <div style={{...style, backgroundColor: 'rgba(255,0,0,0.3)'}} title={`Unknown: ${segment.type}`} />;
  }
};


export function TrackCanvas({
  gridCols,
  gridRows,
  placedSegments,
  onPlaceSegment,
  onRemoveSegment,
  cellSize = CELL_SIZE_DEFAULT,
  selectedSegmentType, // for hover preview
  currentRotation, // for hover preview
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoverCell, setHoverCell] = React.useState<{ x: number, y: number } | null>(null);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);

    if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
      onPlaceSegment(x, y);
    }
  };
  
  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent browser context menu
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);

    if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
      onRemoveSegment(x, y);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedSegmentType) {
      setHoverCell(null);
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);

    if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
      setHoverCell({ x, y });
    } else {
      setHoverCell(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverCell(null);
  };


  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
    width: gridCols * cellSize,
    height: gridRows * cellSize,
    border: '1px solid hsl(var(--border))',
    position: 'relative', // For absolute positioning of segments
    backgroundColor: 'hsl(var(--muted) / 0.3)',
    cursor: 'crosshair',
  };

  return (
    <div
      ref={canvasRef}
      className="overflow-auto max-w-full max-h-[70vh] border rounded-md shadow-inner bg-background"
      style={{ width: gridCols * cellSize + 2, height: gridRows * cellSize + 2 }} // +2 for border
    >
      <div 
        style={gridStyle} 
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="grid"
        aria-label="Track design canvas"
      >
        {/* Render Grid Cells (optional, for visual aid) */}
        {Array.from({ length: gridRows * gridCols }).map((_, index) => (
          <div
            key={index}
            className="border-r border-b border-[hsl(var(--border)/0.2)]"
            style={{
              gridColumnStart: (index % gridCols) + 1,
              gridRowStart: Math.floor(index / gridCols) + 1,
            }}
            aria-hidden="true"
          />
        ))}

        {/* Render Placed Segments */}
        {placedSegments.map((segment) => (
          <SegmentVisual key={segment.id} segment={segment} cellSize={cellSize} />
        ))}
        
        {/* Render Hover Preview */}
        {hoverCell && selectedSegmentType && (
          <SegmentVisual 
            segment={{ 
              id: 'preview', 
              type: selectedSegmentType, 
              x: hoverCell.x, 
              y: hoverCell.y, 
              rotation: currentRotation 
            }} 
            cellSize={cellSize} 
          />
        )}
      </div>
    </div>
  );
}
