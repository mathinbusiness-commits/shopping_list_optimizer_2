export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Distancia en línea recta (km), usada como filtro rápido antes de llamar a OSRM. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Selecciona las N tiendas más cercanas en línea recta al origen (reduce el espacio de búsqueda del optimizador). */
export function nearestStores<T extends GeoPoint>(origin: GeoPoint, stores: T[], limit: number): T[] {
  return [...stores]
    .sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b))
    .slice(0, limit);
}

const matrixCache = new Map<string, number[][]>();

function cacheKey(points: GeoPoint[]): string {
  return points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
}

/**
 * Matriz de tiempos de viaje en auto (minutos) entre `points[0]` (origen) y el resto.
 * Usa el servicio `table` de OSRM en una sola llamada, cacheada por combinación de coordenadas.
 */
export async function fetchTravelTimeMatrixMinutes(points: GeoPoint[]): Promise<number[][]> {
  if (points.length < 2) {
    throw new Error("Se necesitan al menos 2 puntos (origen + 1 tienda) para calcular la matriz");
  }

  const key = cacheKey(points);
  const cached = matrixCache.get(key);
  if (cached) return cached;

  const baseUrl = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${baseUrl}/table/v1/driving/${coords}?annotations=duration`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM respondió ${res.status}`);
  }
  const data = (await res.json()) as { code: string; durations?: (number | null)[][] };
  if (data.code !== "Ok" || !data.durations) {
    throw new Error(`OSRM no pudo calcular la matriz de tiempos (code=${data.code})`);
  }

  const matrixMinutes = data.durations.map((row) => row.map((seconds) => Math.round((seconds ?? 0) / 60)));
  matrixCache.set(key, matrixMinutes);
  return matrixMinutes;
}
