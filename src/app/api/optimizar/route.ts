import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { OptimizeRequestBody, OptimizeResponseBody, StoreInfoDTO } from "@/lib/api-types";
import { fetchTravelTimeMatrixMinutes, nearestStores } from "@/lib/optimizer/distance";
import { optimizeShoppingList } from "@/lib/optimizer/pareto";
import type { ItemAvailability, StoreCandidate } from "@/lib/optimizer/types";

const NEAREST_STORE_LIMIT = 12;
const MAX_STOPS_CEILING = 5;

export async function POST(req: NextRequest) {
  let body: OptimizeRequestBody;
  try {
    body = (await req.json()) as OptimizeRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { origin, productIds, maxStops } = body ?? {};
  if (
    !origin ||
    typeof origin.lat !== "number" ||
    typeof origin.lng !== "number" ||
    !Array.isArray(productIds) ||
    productIds.length === 0
  ) {
    return NextResponse.json(
      { error: "Se requiere 'origin' (lat, lng) y 'productIds' (al menos 1)" },
      { status: 400 },
    );
  }

  const allStores = await prisma.store.findMany({ include: { chain: true } });
  if (allStores.length === 0) {
    return NextResponse.json({ error: "No hay tiendas cargadas todavía" }, { status: 503 });
  }

  const storeCandidates: (StoreCandidate & { address: string })[] = allStores.map((s) => ({
    id: s.id,
    name: s.name,
    chainName: s.chain.name,
    lat: s.lat,
    lng: s.lng,
    address: s.address,
  }));

  const nearStores = nearestStores(origin, storeCandidates, NEAREST_STORE_LIMIT);
  const effectiveMaxStops = Math.max(1, Math.min(maxStops || 1, MAX_STOPS_CEILING, nearStores.length));

  let distanceMatrixMinutes: number[][];
  try {
    const points = [{ lat: origin.lat, lng: origin.lng }, ...nearStores.map((s) => ({ lat: s.lat, lng: s.lng }))];
    distanceMatrixMinutes = await fetchTravelTimeMatrixMinutes(points);
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudieron calcular las distancias: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const storeIds = nearStores.map((s) => s.id);
  const [products, prices] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } } }),
    prisma.storePrice.findMany({
      where: { storeId: { in: storeIds }, productId: { in: productIds }, inStock: true },
    }),
  ]);

  const items: ItemAvailability[] = products.map((p) => ({
    productId: p.id,
    canonicalName: p.canonicalName,
    pricesByStoreId: {},
  }));
  const itemByProductId = new Map(items.map((i) => [i.productId, i]));
  let latestScrapedAt: Date | null = null;
  for (const price of prices) {
    const item = itemByProductId.get(price.productId);
    if (item) item.pricesByStoreId[price.storeId] = price.price;
    if (!latestScrapedAt || price.scrapedAt > latestScrapedAt) latestScrapedAt = price.scrapedAt;
  }

  const result = optimizeShoppingList({
    stores: nearStores,
    items,
    distanceMatrixMinutes,
    maxStops: effectiveMaxStops,
    stopOverheadMin: Number(process.env.STOP_OVERHEAD_MIN ?? 10),
  });

  const usedStoreIds = new Set(result.paretoFrontier.flatMap((c) => c.storeIds));
  const storesDto: Record<string, StoreInfoDTO> = {};
  for (const s of nearStores) {
    if (!usedStoreIds.has(s.id)) continue;
    storesDto[s.id] = { id: s.id, name: s.name, chainName: s.chainName, address: s.address, lat: s.lat, lng: s.lng };
  }

  const unavailableSet = new Set(result.unavailableProductIds);
  const unavailableProducts = products
    .filter((p) => unavailableSet.has(p.id))
    .map((p) => ({ id: p.id, canonicalName: p.canonicalName }));

  const response: OptimizeResponseBody = {
    paretoFrontier: result.paretoFrontier,
    cheapest: result.cheapest,
    fastest: result.fastest,
    balanced: result.balanced,
    unavailableProducts,
    stores: storesDto,
    pricesAsOf: latestScrapedAt ? latestScrapedAt.toISOString() : null,
  };

  return NextResponse.json(response);
}
