
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
            isSimulating={logic.isSimulating} // Pass isSimulating
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
            // Simulation props
            onStartSimulation={logic.handleStartSimulation}
            isSimulating={logic.isSimulating}
            analysisResult={logic.analysisResult}
            placedSegmentsLength={logic.placedSegments.length}
            minSegmentsForSimulation={logic.MIN_SEGMENTS_FOR_LOOP}
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
          onRemoveSegment={logic.handleRemoveSegment}
          selectedSegmentType={logic.selectedSegmentType}
          currentRotation={logic.currentRotation}
          cellSize={logic.CELL_SIZE}
          // Simulation props
          isSimulating={logic.isSimulating}
          simulationCarPosition={logic.simulationCarPosition}
          simulationCarRotation={logic.simulationCarRotation}
        />
      </div>

      {/* Right Panel: Analysis (can be combined or toggled) */}
      <ScrollArea className="w-full md:w-72 h-auto md:h-full pl-2">
         <AnalysisDisplay
            analysisResult={logic.analysisResult}
            isAnalyzing={logic.isAnalyzing}
            isSimulating={logic.isSimulating} // Pass isSimulating
            simulatedTime={logic.simulatedTime} // Pass simulatedTime
            formatTime={logic.formatTime} // Pass formatTime
          />
      </ScrollArea>
    </div>
  );
}

    