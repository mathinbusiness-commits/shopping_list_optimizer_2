"use client";

import { useState } from "react";
import type { ParetoCandidate } from "@/lib/optimizer/types";

interface TradeoffSliderProps {
  frontier: ParetoCandidate[];
  onSelect: (candidate: ParetoCandidate) => void;
}

export function TradeoffSlider({ frontier, onSelect }: TradeoffSliderProps) {
  const [lambda, setLambda] = useState(50); // 0 = prioriza presupuesto, 100 = prioriza tiempo

  function handleChange(value: number) {
    setLambda(value);
    if (frontier.length === 0) return;

    const costs = frontier.map((c) => c.totalCost);
    const times = frontier.map((c) => c.totalTimeMin);
    const minCost = Math.min(...costs);
    const costRange = Math.max(...costs) - minCost || 1;
    const minTime = Math.min(...times);
    const timeRange = Math.max(...times) - minTime || 1;

    const w = value / 100; // peso del tiempo
    let best = frontier[0];
    let bestScore = Infinity;
    for (const c of frontier) {
      const costNorm = (c.totalCost - minCost) / costRange;
      const timeNorm = (c.totalTimeMin - minTime) / timeRange;
      const score = (1 - w) * costNorm + w * timeNorm;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    onSelect(best);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="tradeoff" className="text-sm font-medium">
        Prioridad
      </label>
      <input
        id="tradeoff"
        type="range"
        min={0}
        max={100}
        value={lambda}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full max-w-md"
      />
      <div className="flex w-full max-w-md justify-between text-xs text-zinc-500">
        <span>Más barato</span>
        <span>Balanceado</span>
        <span>Más rápido</span>
      </div>
    </div>
  );
}
