export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const cache = new Map<string, GeocodeResult | null>();

// Nominatim pide como máximo 1 req/seg desde su servidor público demo.
// Encadenamos las llamadas para respetar ese límite aunque lleguen varias en paralelo.
let lastCallAt = 0;
let callChain: Promise<void> = Promise.resolve();

function throttledNominatimCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = callChain.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  callChain = run;
  return run.then(fn);
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = address.trim().toLowerCase();
  if (key.length === 0) return null;
  if (cache.has(key)) return cache.get(key)!;

  const baseUrl = process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const userAgent = process.env.NOMINATIM_USER_AGENT ?? "mi_app-course-project/1.0";

  const result = await throttledNominatimCall(async () => {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "mx");

    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "es-MX" },
    });
    if (!res.ok) {
      throw new Error(`Nominatim respondió ${res.status}`);
    }
    const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
  });

  cache.set(key, result);
  return result;
}
