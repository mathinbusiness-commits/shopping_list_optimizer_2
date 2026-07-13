"use client";

import type { ParetoCandidate } from "@/lib/optimizer/types";

interface ParetoChartProps {
  frontier: ParetoCandidate[];
  selected: ParetoCandidate | null;
  onSelect: (candidate: ParetoCandidate) => void;
}

const WIDTH = 420;
const HEIGHT = 300;
const PAD = 40;

export function ParetoChart({ frontier, selected, onSelect }: ParetoChartProps) {
  if (frontier.length === 0) return null;

  const costs = frontier.map((c) => c.totalCost);
  const times = frontier.map((c) => c.totalTimeMin);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const costRange = maxCost - minCost || 1;
  const timeRange = maxTime - minTime || 1;

  function toX(cost: number) {
    return PAD + ((cost - minCost) / costRange) * (WIDTH - 2 * PAD);
  }
  // arriba = más rápido (menor tiempo), abajo = más lento
  function toY(time: number) {
    return PAD + ((time - minTime) / timeRange) * (HEIGHT - 2 * PAD);
  }

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-md rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="currentColor" strokeOpacity={0.3} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} stroke="currentColor" strokeOpacity={0.3} />
        <text x={WIDTH / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
          Costo (MXN) →
        </text>
        <text
          x={12}
          y={HEIGHT / 2}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          opacity={0.6}
          transform={`rotate(-90, 12, ${HEIGHT / 2})`}
        >
          ← Más rápido
        </text>

        {frontier.length > 1 && (
          <polyline
            points={frontier.map((c) => `${toX(c.totalCost)},${toY(c.totalTimeMin)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="4 3"
          />
        )}

        {frontier.map((c, i) => {
          const isSelected = c === selected;
          return (
            <g key={i}>
              <circle
                cx={toX(c.totalCost)}
                cy={toY(c.totalTimeMin)}
                r={isSelected ? 8 : 6}
                className={isSelected ? "fill-blue-600" : "fill-zinc-500 hover:fill-blue-400"}
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(c)}
              >
                <title>
                  ${c.totalCost} MXN · {c.totalTimeMin} min · {c.storeIds.length} tienda(s)
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-zinc-500">
        Cada punto es una combinación de tiendas distinta. Haz clic en un punto para ver el detalle.
      </p>
    </div>
  );
}
