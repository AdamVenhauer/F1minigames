
"use client";

import type { PlacedSegment, SegmentType, Rotation } from '@/lib/types';
import React, { useRef } from 'react'; // Removed useEffect as it's not used

interface TrackCanvasProps {
  gridCols: number;
  gridRows: number;
  placedSegments: PlacedSegment[];
  onPlaceSegment: (x: number, y: number) => void;
  onRemoveSegment: (x: number, y: number) => void;
  cellSize?: number;
  selectedSegmentType: SegmentType | null;
  currentRotation: Rotation;
}

const CELL_SIZE_DEFAULT = 30; // px

const SegmentVisual = ({ segment, cellSize, isPreview }: { segment: PlacedSegment, cellSize: number, isPreview?: boolean }) => {
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
    opacity: isPreview ? 0.6 : 1,
    // border: '1px dashed rgba(255,255,255,0.1)', // For visual debugging
  };

  const svgStyle: React.SVGAttributes<SVGSVGElement> = {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  };

  const strokeColor = "hsl(var(--primary))";
  const trackStrokeWidth = Math.max(4, cellSize / 3.5); // Increased thickness
  const radius = cellSize / 2;

  switch (segment.type) {
    case 'straight':
      return (
        <div style={style}>
          <svg {...svgStyle}>
            <line
              x1="0"
              y1={radius}
              x2={cellSize}
              y2={radius}
              stroke={strokeColor}
              strokeWidth={trackStrokeWidth}
              strokeLinecap="round" // Added for smoother ends
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
              strokeLinecap="round" // Added for smoother ends and connections
            />
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
  selectedSegmentType,
  currentRotation,
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
    event.preventDefault();
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
    position: 'relative',
    backgroundColor: 'hsl(var(--muted) / 0.3)',
    cursor: 'crosshair',
  };

  return (
    <div
      ref={canvasRef}
      className="overflow-auto max-w-full max-h-[70vh] border rounded-md shadow-inner bg-background"
      style={{ width: gridCols * cellSize + 2, height: gridRows * cellSize + 2 }}
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

        {placedSegments.map((segment) => (
          <SegmentVisual key={segment.id} segment={segment} cellSize={cellSize} />
        ))}
        
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
            isPreview
          />
        )}
      </div>
    </div>
  );
}
