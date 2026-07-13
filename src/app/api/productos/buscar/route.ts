import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const products = await prisma.product.findMany({
    select: { id: true, canonicalName: true, category: true, unit: true },
    orderBy: { canonicalName: "asc" },
  });

  if (q.length === 0) {
    return NextResponse.json({ products: products.slice(0, 20) });
  }

  const fuse = new Fuse(products, { keys: ["canonicalName"], threshold: 0.3, ignoreLocation: true });
  const results = fuse.search(q, { limit: 15 }).map((r) => r.item);
  return NextResponse.json({ products: results });
}
