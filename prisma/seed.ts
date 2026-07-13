import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type StoreSeed = {
  chain: string;
  chainName: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type ProductSeed = {
  canonicalName: string;
  category: string;
  unit: string;
  basePriceMXN: number;
  searchTerms: Record<string, string>;
};

const dataDir = join(import.meta.dirname, "..", "data");

function loadJson<T>(filename: string): T {
  const raw = readFileSync(join(dataDir, filename), "utf-8");
  return JSON.parse(raw) as T;
}

// Hash determinístico simple (FNV-1a) para generar precios/stock reproducibles
// sin necesitar guardar los valores generados en el repo.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff; // normalizado a [0, 1)
}

async function main() {
  const stores = loadJson<StoreSeed[]>("stores.json");
  const products = loadJson<ProductSeed[]>("products.json");

  const chainSlugs = [...new Set(stores.map((s) => s.chain))];
  const chainByslug = new Map<string, string>();
  for (const slug of chainSlugs) {
    const chainName = stores.find((s) => s.chain === slug)!.chainName;
    const chain = await prisma.chain.upsert({
      where: { slug },
      update: { name: chainName },
      create: { slug, name: chainName },
    });
    chainByslug.set(slug, chain.id);
  }

  const storeIds: { id: string; chain: string; name: string }[] = [];
  for (const s of stores) {
    const store = await prisma.store.upsert({
      where: { id: `${s.chain}::${s.name}` },
      update: {
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        chainId: chainByslug.get(s.chain)!,
      },
      create: {
        id: `${s.chain}::${s.name}`,
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        city: "CDMX",
        chainId: chainByslug.get(s.chain)!,
      },
    });
    storeIds.push({ id: store.id, chain: s.chain, name: s.name });
  }

  const productIds: { id: string; canonicalName: string; basePriceMXN: number }[] = [];
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { id: `product::${p.canonicalName}` },
      update: {
        category: p.category,
        unit: p.unit,
        searchTerms: p.searchTerms,
      },
      create: {
        id: `product::${p.canonicalName}`,
        canonicalName: p.canonicalName,
        category: p.category,
        unit: p.unit,
        searchTerms: p.searchTerms,
      },
    });
    productIds.push({ id: product.id, canonicalName: p.canonicalName, basePriceMXN: p.basePriceMXN });
  }

  // Precios de ejemplo: variación de ±18% por tienda alrededor del precio base,
  // y ~12% de combinaciones tienda-producto marcadas sin stock, para que el
  // optimizador tenga casos reales de "no cubierto por este subconjunto" que resolver.
  let priceCount = 0;
  for (const store of storeIds) {
    for (const product of productIds) {
      const key = `${store.id}::${product.id}`;
      const stockRoll = hash(`stock::${key}`);
      const inStock = stockRoll > 0.12;
      if (!inStock) continue;

      const variance = hash(`price::${key}`) * 0.36 - 0.18; // [-0.18, +0.18]
      const price = Math.round(product.basePriceMXN * (1 + variance) * 100) / 100;

      await prisma.storePrice.upsert({
        where: { storeId_productId: { storeId: store.id, productId: product.id } },
        update: { price, inStock: true, rawTitle: product.canonicalName },
        create: {
          storeId: store.id,
          productId: product.id,
          price,
          inStock: true,
          rawTitle: product.canonicalName,
        },
      });
      priceCount++;
    }
  }

  console.log(
    `Seed listo: ${chainSlugs.length} cadenas, ${storeIds.length} sucursales, ${productIds.length} productos, ${priceCount} precios de ejemplo.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
