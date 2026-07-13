import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walmartAdapter } from "./adapters/walmart";
import type { ChainAdapter, StoreSeed } from "./adapters/types";
import { prisma, upsertScrapedPrice } from "./lib/persist";

// Cadenas soportadas hoy. Soriana/Chedraui/La Comer quedan para una iteración futura
// (requieren investigar la estructura de cada sitio — ver README).
const ADAPTERS: Record<string, ChainAdapter> = {
  walmart: walmartAdapter,
};

interface ProductSeed {
  canonicalName: string;
  searchTerms: Record<string, string>;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value ?? true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chainSlug = String(args.chain ?? "");
  const dryRun = Boolean(args["dry-run"]);
  const singleQuery = typeof args.query === "string" ? args.query : null;

  const adapter = ADAPTERS[chainSlug];
  if (!adapter) {
    console.error(
      `Cadena desconocida o no soportada: "${chainSlug}". Disponibles: ${Object.keys(ADAPTERS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const dataDir = join(import.meta.dirname, "..", "data");
  const allStores = JSON.parse(readFileSync(join(dataDir, "stores.json"), "utf-8")) as StoreSeed[];
  const stores = allStores.filter((s) => s.chain === chainSlug);
  const products = JSON.parse(readFileSync(join(dataDir, "products.json"), "utf-8")) as ProductSeed[];

  if (stores.length === 0) {
    console.error(`No hay sucursales de "${chainSlug}" en data/stores.json`);
    process.exitCode = 1;
    return;
  }

  let itemsScraped = 0;
  let failures = 0;

  for (const storeSeed of stores) {
    const storeId = `${storeSeed.chain}::${storeSeed.name}`;

    if (!dryRun) {
      const dbStore = await prisma.store.findUnique({ where: { id: storeId } });
      if (!dbStore) {
        console.warn(`Tienda no encontrada en la DB (¿corriste "npm run db:seed"?): ${storeId}`);
        continue;
      }
    }

    for (const product of products) {
      const query = singleQuery ?? product.searchTerms[chainSlug];
      if (!query) continue;

      try {
        const results = await adapter.searchProduct(storeSeed, query);
        if (results.length === 0) {
          console.log(`[${storeSeed.name}] "${query}" -> sin resultados`);
        } else {
          const best = results[0];
          console.log(
            `[${storeSeed.name}] "${query}" -> ${best.rawTitle}: $${best.price ?? "?"} (${best.inStock ? "en stock" : "agotado"})`,
          );
          if (!dryRun) {
            const productId = `product::${product.canonicalName}`;
            await upsertScrapedPrice(storeId, productId, best);
          }
          itemsScraped++;
        }
      } catch (e) {
        failures++;
        console.error(`[${storeSeed.name}] "${query}" -> ERROR: ${(e as Error).message}`);
      }

      if (singleQuery) break; // modo --query: solo un producto de prueba por tienda
    }
  }

  if (!dryRun) {
    await prisma.$disconnect();
  }

  console.log(
    `\nListo. ${itemsScraped} precios obtenidos, ${failures} fallos${dryRun ? " (--dry-run: no se escribió en la DB)" : ""}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
