import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import type { ScrapedPrice } from "../adapters/types";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });

export async function upsertScrapedPrice(storeId: string, productId: string, scraped: ScrapedPrice) {
  if (scraped.price === null) return;
  await prisma.storePrice.upsert({
    where: { storeId_productId: { storeId, productId } },
    update: {
      price: scraped.price,
      inStock: scraped.inStock,
      rawTitle: scraped.rawTitle,
      url: scraped.url,
      scrapedAt: new Date(),
    },
    create: {
      storeId,
      productId,
      price: scraped.price,
      inStock: scraped.inStock,
      rawTitle: scraped.rawTitle,
      url: scraped.url,
    },
  });
}
