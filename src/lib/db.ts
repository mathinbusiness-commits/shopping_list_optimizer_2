import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton para evitar abrir múltiples conexiones SQLite en dev (hot reload de Next.js).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // La app nunca escribe en la base de datos en tiempo de ejecución (solo lee) —
  // el catálogo se puebla aparte con `npm run db:seed` / `npm run scrape`. Abrir en
  // modo readonly es necesario además de correcto: en Vercel el archivo se sirve
  // desde el bundle de la función serverless, cuyo filesystem es de solo lectura.
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL!, readonly: true });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
