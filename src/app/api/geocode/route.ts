import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (address.length < 3) {
    return NextResponse.json(
      { error: "Falta el parámetro 'address' (mínimo 3 caracteres)" },
      { status: 400 },
    );
  }

  try {
    const result = await geocodeAddress(address);
    if (!result) {
      return NextResponse.json({ error: "No se encontró la dirección" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo geocodificar la dirección, intenta de nuevo" }, { status: 502 });
  }
}
