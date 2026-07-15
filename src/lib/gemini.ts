export interface CatalogEntry {
  id: string;
  canonicalName: string;
  category: string | null;
}

export class GeminiConfigError extends Error {}

/**
 * Pide a Gemini que arme una lista de compras a partir de un prompt en lenguaje natural,
 * restringido al catálogo de productos disponibles en la app. Se usa `responseSchema` con
 * un `enum` de los IDs válidos: el modelo solo puede decodificar IDs que existen en el
 * catálogo, así que no hay riesgo de que "invente" productos que luego no tengan precio.
 */
export async function generateShoppingListFromPrompt(
  prompt: string,
  catalog: CatalogEntry[],
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("Falta configurar GEMINI_API_KEY en el archivo .env");
  }
  if (catalog.length === 0) {
    return [];
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const catalogLines = catalog
    .map((p) => `- ${p.id}: ${p.canonicalName}${p.category ? ` (${p.category})` : ""}`)
    .join("\n");

  const instructionText = [
    "Eres un asistente para armar listas de compras de supermercado en México.",
    "Este es el catálogo de productos disponibles en la app (no existen otros):",
    catalogLines,
    "",
    `Petición del usuario: "${prompt}"`,
    "",
    "Selecciona los productos del catálogo de arriba que sean razonables para esa petición.",
    "Responde solo con productos que existan en el catálogo.",
  ].join("\n");

  const validIds = catalog.map((p) => p.id);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instructionText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                items: { type: "STRING", enum: validIds },
              },
            },
            required: ["items"],
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini respondió ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini no devolvió contenido (posible bloqueo de seguridad o respuesta vacía)");
  }

  const parsed = JSON.parse(text) as { items?: string[] };
  const validIdSet = new Set(validIds);
  return (parsed.items ?? []).filter((id) => validIdSet.has(id));
}
