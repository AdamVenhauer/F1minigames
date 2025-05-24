"use client";

import type { GameState } from "@/lib/types";

interface StartLightsProps {
  gameState: GameState;
  activeRedLights: number;
}

const Light = ({ active, color }: { active: boolean; color: string }) => (
  <div
    className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-gray-500 transition-all duration-100 ease-in-out ${
      active ? color : "bg-gray-700 opacity-30"
    }`}
    role="status"
    aria-live="polite"
    aria-label={active ? `${color.split('-')[1]} light on` : `light off`}
  />
);

export function StartLights({ gameState, activeRedLights }: StartLightsProps) {
  const totalRedLights = 5;
  const redLights = Array.from({ length: totalRedLights }, (_, i) => (
    <Light key={`red-${i}`} active={i < activeRedLights} color="bg-red-500" />
  ));

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-gray-800 rounded-lg shadow-xl">
      <div className="flex space-x-2 md:space-x-3">
        {redLights}
      </div>
      <div className="flex space-x-2 md:space-x-3">
        <Light active={gameState === "greenLight"} color="bg-green-500" />
        <Light active={gameState === "greenLight"} color="bg-green-500" />
      </div>
    </div>
  );
}
