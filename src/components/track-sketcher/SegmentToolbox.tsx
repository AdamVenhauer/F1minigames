
"use client";

import type { SegmentDefinition, SegmentType, Rotation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCw, FastForward, CornerLeftDown } from 'lucide-react'; 
import { cn } from '@/lib/utils';

interface SegmentToolboxProps {
  availableSegments: SegmentDefinition[];
  selectedSegmentType: SegmentType | null;
  currentRotation: Rotation;
  onSelectSegment: (type: SegmentType) => void;
  onRotateSegment: () => void;
  isSimulating: boolean; // New prop
}

const SegmentIcon = ({ type }: { type: SegmentType }) => {
  switch (type) {
    case 'straight':
      return <FastForward className="w-5 h-5 mr-2" />;
    case 'corner':
      return <CornerLeftDown className="w-5 h-5 mr-2" />;
    default:
      return null;
  }
};

export function SegmentToolbox({
  availableSegments,
  selectedSegmentType,
  currentRotation,
  onSelectSegment,
  onRotateSegment,
  isSimulating, // Destructure new prop
}: SegmentToolboxProps) {
  return (
    <Card className="w-full md:w-64 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Track Segments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Select Segment:</h4>
          {availableSegments.map((segment) => (
            <Button
              key={segment.type}
              variant={selectedSegmentType === segment.type ? 'default' : 'outline'}
              className={cn(
                "w-full justify-start text-left",
                selectedSegmentType === segment.type && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={() => onSelectSegment(segment.type)}
              disabled={isSimulating} // Disable during simulation
            >
              <SegmentIcon type={segment.type} />
              {segment.label}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Rotation:</h4>
          <Button
            variant="outline"
            className="w-full"
            onClick={onRotateSegment}
            aria-label="Rotate selected segment"
            disabled={isSimulating} // Disable during simulation
          >
            <RotateCw className="w-5 h-5 mr-2" />
            Rotate ({currentRotation}°)
          </Button>
        </div>
        {selectedSegmentType && !isSimulating && (
          <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
            Selected: {availableSegments.find(s => s.type === selectedSegmentType)?.label} at {currentRotation}°
          </p>
        )}
      </CardContent>
    </Card>
  );
}

    