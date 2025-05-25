
"use client";

import { useApexTrackSketcherLogic } from '@/hooks/useApexTrackSketcherLogic';
import { SegmentToolbox } from '@/components/track-sketcher/SegmentToolbox';
import { TrackCanvas } from '@/components/track-sketcher/TrackCanvas';
import { TrackControls } from '@/components/track-sketcher/TrackControls';
import { AnalysisDisplay } from '@/components/track-sketcher/AnalysisDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip } from 'lucide-react';

export default function ApexTrackSketcherPage() {
  const logic = useApexTrackSketcherLogic();

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-[calc(100vh-var(--header-height,120px)-var(--footer-height,100px))]">
      {/* Left Panel: Toolbox and Controls */}
      <ScrollArea className="w-full md:w-72 h-auto md:h-full pr-2">
        <div className="flex flex-col gap-4 ">
          <SegmentToolbox
            availableSegments={logic.availableSegmentTypes}
            selectedSegmentType={logic.selectedSegmentType}
            currentRotation={logic.currentRotation}
            onSelectSegment={logic.handleSelectSegmentType}
            onRotateSegment={logic.handleRotatePreviewSegment}
          />
          <TrackControls
            trackName={logic.trackName}
            onTrackNameChange={logic.setTrackName}
            onClearCanvas={logic.handleClearCanvas}
            onAnalyzeTrack={logic.handleAnalyzeTrack}
            isAnalyzing={logic.isAnalyzing}
            onSaveTrack={logic.handleSaveTrack}
            onLoadTrack={logic.handleLoadTrack}
            getSavedTrackNames={logic.getSavedTrackNames}
          />
        </div>
      </ScrollArea>

      {/* Middle Panel: Canvas */}
      <div className="flex-grow flex items-center justify-center overflow-hidden">
         <TrackCanvas
          gridCols={logic.GRID_COLS}
          gridRows={logic.GRID_ROWS}
          placedSegments={logic.placedSegments}
          onPlaceSegment={logic.handlePlaceSegment}
          onRemoveSegment={logic.handleRemoveSegment} // Added for right-click removal
          selectedSegmentType={logic.selectedSegmentType}
          currentRotation={logic.currentRotation}
        />
      </div>

      {/* Right Panel: Analysis (can be combined or toggled) */}
      <ScrollArea className="w-full md:w-72 h-auto md:h-full pl-2">
         <AnalysisDisplay
            analysisResult={logic.analysisResult}
            isAnalyzing={logic.isAnalyzing}
          />
      </ScrollArea>
    </div>
  );
}
