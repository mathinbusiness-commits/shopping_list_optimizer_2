/**
 * TSP exacto (ruta abierta, sin volver al origen) vía Held-Karp.
 *
 * `matrixIndices` son posiciones dentro de `distanceMatrixMinutes` (índice 0 = origen)
 * que deben visitarse, en cualquier orden, empezando desde el origen.
 * Complejidad O(2^k * k^2) donde k = matrixIndices.length — instantáneo para k <= 8.
 */
export function shortestOpenRouteMinutes(
  matrixIndices: number[],
  distanceMatrixMinutes: number[][],
): { timeMin: number; orderedMatrixIndices: number[] } {
  const k = matrixIndices.length;
  if (k === 0) return { timeMin: 0, orderedMatrixIndices: [] };
  if (k === 1) {
    return {
      timeMin: distanceMatrixMinutes[0][matrixIndices[0]],
      orderedMatrixIndices: [matrixIndices[0]],
    };
  }

  const FULL = (1 << k) - 1;
  const dp: number[][] = Array.from({ length: 1 << k }, () => Array(k).fill(Infinity));
  const parent: number[][] = Array.from({ length: 1 << k }, () => Array(k).fill(-1));

  for (let j = 0; j < k; j++) {
    dp[1 << j][j] = distanceMatrixMinutes[0][matrixIndices[j]];
  }

  for (let mask = 1; mask <= FULL; mask++) {
    for (let j = 0; j < k; j++) {
      if (!(mask & (1 << j))) continue;
      const cur = dp[mask][j];
      if (cur === Infinity) continue;
      for (let l = 0; l < k; l++) {
        if (mask & (1 << l)) continue;
        const nextMask = mask | (1 << l);
        const candidate = cur + distanceMatrixMinutes[matrixIndices[j]][matrixIndices[l]];
        if (candidate < dp[nextMask][l]) {
          dp[nextMask][l] = candidate;
          parent[nextMask][l] = j;
        }
      }
    }
  }

  let bestEnd = 0;
  let bestTime = Infinity;
  for (let j = 0; j < k; j++) {
    if (dp[FULL][j] < bestTime) {
      bestTime = dp[FULL][j];
      bestEnd = j;
    }
  }

  const orderedLocal: number[] = [];
  let mask = FULL;
  let cur = bestEnd;
  while (cur !== -1) {
    orderedLocal.push(cur);
    const prevCur = parent[mask][cur];
    mask ^= 1 << cur;
    cur = prevCur;
  }
  orderedLocal.reverse();

  return {
    timeMin: bestTime,
    orderedMatrixIndices: orderedLocal.map((localIdx) => matrixIndices[localIdx]),
  };
}
