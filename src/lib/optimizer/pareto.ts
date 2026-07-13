import { shortestOpenRouteMinutes } from "./heldKarp";
import type {
  ItemAvailability,
  OptimizeInput,
  OptimizeResult,
  ParetoCandidate,
  StoreAssignment,
  StoreCandidate,
} from "./types";

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m > 0) {
    count += m & 1;
    m >>= 1;
  }
  return count;
}

/** Asigna cada item a la tienda de menor precio dentro del subconjunto. Greedy: óptimo porque los items son independientes entre sí. */
function assignItemsToSubset(
  subsetStores: StoreCandidate[],
  items: ItemAvailability[],
): { assignments: StoreAssignment[]; totalCost: number; feasible: boolean } {
  const subsetStoreIds = new Set(subsetStores.map((s) => s.id));
  const byStore = new Map<string, StoreAssignment>();
  for (const s of subsetStores) {
    byStore.set(s.id, { storeId: s.id, storeName: s.name, items: [], subtotal: 0 });
  }

  let totalCost = 0;

  for (const item of items) {
    let bestStoreId: string | null = null;
    let bestPrice = Infinity;
    for (const [storeId, price] of Object.entries(item.pricesByStoreId)) {
      if (!subsetStoreIds.has(storeId)) continue;
      if (price < bestPrice) {
        bestPrice = price;
        bestStoreId = storeId;
      }
    }

    if (bestStoreId === null) {
      return { assignments: [], totalCost: 0, feasible: false };
    }

    const assignment = byStore.get(bestStoreId)!;
    assignment.items.push({ productId: item.productId, canonicalName: item.canonicalName, price: bestPrice });
    assignment.subtotal = Math.round((assignment.subtotal + bestPrice) * 100) / 100;
    totalCost = Math.round((totalCost + bestPrice) * 100) / 100;
  }

  const assignments = subsetStores
    .map((s) => byStore.get(s.id)!)
    .filter((a) => a.items.length > 0);

  return { assignments, totalCost, feasible: true };
}

/** Frontera de Pareto (skyline) costo-vs-tiempo: se queda solo con los candidatos no dominados. */
function computeParetoFrontier(candidates: ParetoCandidate[]): ParetoCandidate[] {
  const sorted = [...candidates].sort((a, b) => a.totalCost - b.totalCost || a.totalTimeMin - b.totalTimeMin);
  const frontier: ParetoCandidate[] = [];
  let bestTimeSeen = Infinity;
  for (const c of sorted) {
    if (c.totalTimeMin < bestTimeSeen) {
      frontier.push(c);
      bestTimeSeen = c.totalTimeMin;
    }
  }
  return frontier;
}

function pickBalanced(frontier: ParetoCandidate[]): ParetoCandidate | null {
  if (frontier.length === 0) return null;
  if (frontier.length === 1) return frontier[0];

  const costs = frontier.map((c) => c.totalCost);
  const times = frontier.map((c) => c.totalTimeMin);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const costRange = maxCost - minCost || 1;
  const timeRange = maxTime - minTime || 1;

  let best = frontier[0];
  let bestDist = Infinity;
  for (const c of frontier) {
    const costNorm = (c.totalCost - minCost) / costRange;
    const timeNorm = (c.totalTimeMin - minTime) / timeRange;
    const dist = Math.sqrt(costNorm * costNorm + timeNorm * timeNorm);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Núcleo del optimizador: dado un conjunto de tiendas candidatas cercanas y una
 * lista de compras, enumera subconjuntos de tiendas (bitmask, tamaño <= maxStops),
 * asigna cada item a su tienda más barata dentro del subconjunto, calcula el tiempo
 * de ruta óptimo (Held-Karp) por subconjunto, y construye la frontera de Pareto
 * costo-vs-tiempo sobre todos los subconjuntos factibles.
 */
export function optimizeShoppingList(input: OptimizeInput): OptimizeResult {
  const { stores, items, distanceMatrixMinutes, maxStops, stopOverheadMin } = input;
  const n = stores.length;

  const globallyAvailable = items.filter((item) => Object.keys(item.pricesByStoreId).length > 0);
  const unavailableProductIds = items
    .filter((item) => Object.keys(item.pricesByStoreId).length === 0)
    .map((item) => item.productId);

  const candidates: ParetoCandidate[] = [];

  const maxMask = 1 << n;
  for (let mask = 1; mask < maxMask; mask++) {
    const size = popcount(mask);
    if (size > maxStops) continue;

    const subsetIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subsetIndices.push(i);
    }
    const subsetStores = subsetIndices.map((i) => stores[i]);

    const { assignments, totalCost, feasible } = assignItemsToSubset(subsetStores, globallyAvailable);
    if (!feasible) continue;

    const matrixIndices = subsetIndices.map((i) => i + 1); // +1 porque el índice 0 es el origen
    const { timeMin: travelTimeMin, orderedMatrixIndices } = shortestOpenRouteMinutes(
      matrixIndices,
      distanceMatrixMinutes,
    );
    const totalTimeMin = Math.round(travelTimeMin + stopOverheadMin * size);

    const route = orderedMatrixIndices.map((matrixIdx) => stores[matrixIdx - 1].id);

    candidates.push({
      storeIds: subsetStores.map((s) => s.id),
      totalCost,
      totalTimeMin,
      route,
      assignments,
    });
  }

  const paretoFrontier = computeParetoFrontier(candidates);
  const cheapest = paretoFrontier[0] ?? null;
  const fastest = paretoFrontier[paretoFrontier.length - 1] ?? null;
  const balanced = pickBalanced(paretoFrontier);

  return { paretoFrontier, cheapest, fastest, balanced, unavailableProductIds };
}
