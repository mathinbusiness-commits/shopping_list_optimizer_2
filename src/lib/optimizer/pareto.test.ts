import { describe, expect, it } from "vitest";
import { shortestOpenRouteMinutes } from "./heldKarp";
import { optimizeShoppingList } from "./pareto";
import type { ItemAvailability, StoreCandidate } from "./types";

// --- Fixtures: 3 tiendas, 5 items, con solapes y un hueco de stock intencional ---

const stores: StoreCandidate[] = [
  { id: "A", name: "Tienda A", chainName: "X", lat: 19.40, lng: -99.13 },
  { id: "B", name: "Tienda B", chainName: "Y", lat: 19.38, lng: -99.14 },
  { id: "C", name: "Tienda C", chainName: "Z", lat: 19.37, lng: -99.16 },
];

// Matriz [origen, A, B, C] en minutos, simétrica y con desigualdad triangular razonable.
const distanceMatrixMinutes = [
  [0, 8, 12, 20],
  [8, 0, 6, 15],
  [12, 6, 0, 10],
  [20, 15, 10, 0],
];

const items: ItemAvailability[] = [
  { productId: "leche", canonicalName: "Leche", pricesByStoreId: { A: 24, B: 22, C: 25 } },
  { productId: "huevo", canonicalName: "Huevo", pricesByStoreId: { A: 90, B: 95, C: 88 } },
  { productId: "pan", canonicalName: "Pan", pricesByStoreId: { B: 38, C: 40 } }, // no disponible en A
  { productId: "arroz", canonicalName: "Arroz", pricesByStoreId: { A: 28, C: 30 } }, // no disponible en B
  { productId: "cafe", canonicalName: "Café", pricesByStoreId: {} }, // no disponible en ninguna
];

describe("optimizeShoppingList", () => {
  it("excluye productos sin precio en ninguna tienda candidata y los reporta aparte", () => {
    const result = optimizeShoppingList({
      stores,
      items,
      distanceMatrixMinutes,
      maxStops: 3,
      stopOverheadMin: 10,
    });
    expect(result.unavailableProductIds).toEqual(["cafe"]);
    for (const c of result.paretoFrontier) {
      const coveredProductIds = c.assignments.flatMap((a) => a.items.map((i) => i.productId));
      expect(coveredProductIds).not.toContain("cafe");
    }
  });

  it("descarta subconjuntos que no cubren toda la lista (ej. una sola tienda que no vende todo)", () => {
    const result = optimizeShoppingList({
      stores,
      items,
      distanceMatrixMinutes,
      maxStops: 1,
      stopOverheadMin: 10,
    });
    // Ninguna tienda individual tiene los 4 items disponibles (pan falta en A, arroz falta en B).
    // Solo C tiene los 4 disponibles (leche, huevo, pan, arroz).
    expect(result.paretoFrontier.length).toBeGreaterThan(0);
    for (const c of result.paretoFrontier) {
      expect(c.storeIds).toEqual(["C"]);
    }
  });

  it("respeta el límite maxStops en todos los candidatos de la frontera", () => {
    const result = optimizeShoppingList({
      stores,
      items,
      distanceMatrixMinutes,
      maxStops: 2,
      stopOverheadMin: 10,
    });
    for (const c of result.paretoFrontier) {
      expect(c.storeIds.length).toBeLessThanOrEqual(2);
    }
  });

  it("la frontera de Pareto no contiene puntos dominados (ningún otro candidato es <= en ambas dimensiones y < en alguna)", () => {
    const result = optimizeShoppingList({
      stores,
      items,
      distanceMatrixMinutes,
      maxStops: 3,
      stopOverheadMin: 10,
    });
    const { paretoFrontier } = result;
    for (const a of paretoFrontier) {
      for (const b of paretoFrontier) {
        if (a === b) continue;
        const bDominatesA =
          b.totalCost <= a.totalCost &&
          b.totalTimeMin <= a.totalTimeMin &&
          (b.totalCost < a.totalCost || b.totalTimeMin < a.totalTimeMin);
        expect(bDominatesA).toBe(false);
      }
    }
  });

  it("cheapest tiene el menor costo y fastest el menor tiempo de toda la frontera", () => {
    const result = optimizeShoppingList({
      stores,
      items,
      distanceMatrixMinutes,
      maxStops: 3,
      stopOverheadMin: 10,
    });
    const minCost = Math.min(...result.paretoFrontier.map((c) => c.totalCost));
    const minTime = Math.min(...result.paretoFrontier.map((c) => c.totalTimeMin));
    expect(result.cheapest?.totalCost).toBe(minCost);
    expect(result.fastest?.totalTimeMin).toBe(minTime);
  });

  it("asigna cada item a la tienda de menor precio dentro del subconjunto de 1 tienda (greedy trivial)", () => {
    const result = optimizeShoppingList({
      stores: [stores[0]], // solo A: leche 24, huevo 90, arroz 28 (pan no disponible en A -> subset infeasible)
      items: items.filter((i) => i.productId !== "pan" && i.productId !== "cafe"),
      distanceMatrixMinutes: [
        [0, 8],
        [8, 0],
      ],
      maxStops: 1,
      stopOverheadMin: 10,
    });
    expect(result.paretoFrontier).toHaveLength(1);
    const [only] = result.paretoFrontier;
    expect(only.totalCost).toBe(24 + 90 + 28);
  });
});

describe("shortestOpenRouteMinutes (Held-Karp) vs fuerza bruta", () => {
  function bruteForce(indices: number[], matrix: number[][]): number {
    if (indices.length === 0) return 0;
    const permute = (arr: number[]): number[][] => {
      if (arr.length <= 1) return [arr];
      const perms: number[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const p of permute(rest)) perms.push([arr[i], ...p]);
      }
      return perms;
    };
    let best = Infinity;
    for (const perm of permute(indices)) {
      let time = matrix[0][perm[0]];
      for (let i = 1; i < perm.length; i++) {
        time += matrix[perm[i - 1]][perm[i]];
      }
      best = Math.min(best, time);
    }
    return best;
  }

  it("coincide con fuerza bruta para conjuntos de hasta 6 destinos, sobre 20 casos aleatorios", () => {
    for (let trial = 0; trial < 20; trial++) {
      const k = 2 + (trial % 5); // 2..6 destinos
      const size = k + 1;
      const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (i === j) continue;
          // matriz determinística pseudo-aleatoria pero simétrica
          const v = ((i + 1) * 31 + (j + 1) * 17 + trial * 7) % 50 + 1;
          matrix[i][j] = v;
          matrix[j][i] = v;
        }
      }
      const indices = Array.from({ length: k }, (_, i) => i + 1);
      const expected = bruteForce(indices, matrix);
      const { timeMin } = shortestOpenRouteMinutes(indices, matrix);
      expect(timeMin).toBe(expected);
    }
  });

  it("caso base: un solo destino es la distancia directa desde el origen", () => {
    const matrix = [
      [0, 5, 9],
      [5, 0, 3],
      [9, 3, 0],
    ];
    expect(shortestOpenRouteMinutes([1], matrix).timeMin).toBe(5);
    expect(shortestOpenRouteMinutes([2], matrix).timeMin).toBe(9);
  });
});
