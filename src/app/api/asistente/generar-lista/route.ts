import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GeminiConfigError, generateShoppingListFromPrompt } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = body?.prompt?.trim() ?? "";
  if (prompt.length < 5) {
    return NextResponse.json({ error: "Describe con un poco más de detalle qué lista necesitas" }, { status: 400 });
  }

  const catalog = await prisma.product.findMany({
    select: { id: true, canonicalName: true, category: true },
  });

  try {
    const selectedIds = await generateShoppingListFromPrompt(prompt, catalog);
    const items = catalog
      .filter((p) => selectedIds.includes(p.id))
      // conserva el orden elegido por el modelo
      .sort((a, b) => selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron productos del catálogo que encajen con esa petición" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      items: items.map((p) => ({ productId: p.id, canonicalName: p.canonicalName })),
    });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `No se pudo generar la lista con IA: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
