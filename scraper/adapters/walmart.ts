import { extractNextDataJson, resilientFetch } from "../lib/http";
import type { ChainAdapter, ScrapedPrice, StoreSeed } from "./types";

/**
 * IMPORTANTE (ver README): el endpoint de búsqueda de walmart.com.mx está protegido por
 * PerimeterX/HUMAN Security ("Verifica tu identidad" / px-captcha). Un fetch simple —sin
 * resolver un challenge de JavaScript en un navegador real— es bloqueado de forma consistente,
 * incluso con headers realistas y cookies de una visita previa a la home. Este adapter queda
 * implementado con la arquitectura correcta (fetch + parseo de __NEXT_DATA__) y con manejo de
 * fallo explícito: en la práctica, para este proyecto de curso, `searchProduct` va a lanzar un
 * error de bloqueo casi siempre al correr en un entorno automatizado/datacenter, y eso es lo
 * esperado — no se implementa evasión de captcha (proxies residenciales, resolución de
 * captcha, spoofing de fingerprint), ya que ese endpoint está deliberadamente protegido contra
 * acceso automatizado. El resto del sistema (persist.ts, run-all) está diseñado para degradar
 * con gracia cuando esto ocurre: la tienda queda marcada como "sin datos" en vez de romper.
 */
export const walmartAdapter: ChainAdapter = {
  chainSlug: "walmart",
  async searchProduct(_store: StoreSeed, query: string): Promise<ScrapedPrice[]> {
    const url = `https://www.walmart.com.mx/search?q=${encodeURIComponent(query)}`;
    const html = await resilientFetch(url);

    const nextData = extractNextDataJson(html) as {
      props?: { pageProps?: Record<string, unknown> };
    };
    const pageProps = nextData.props?.pageProps ?? {};

    // Best-effort: distintas versiones del sitio han usado nombres distintos para el bloque
    // de resultados de búsqueda dentro de pageProps. Se intentan varias rutas conocidas.
    const candidatePaths = [
      ["searchResult", "products"],
      ["initialData", "searchResult", "itemStacks", 0, "items"],
      ["searchContent", "items"],
    ] as const;

    let rawProducts: unknown[] | null = null;
    for (const path of candidatePaths) {
      let node: unknown = pageProps;
      for (const key of path) {
        if (node && typeof node === "object") {
          node = (node as Record<string | number, unknown>)[key as string | number];
        } else {
          node = undefined;
          break;
        }
      }
      if (Array.isArray(node)) {
        rawProducts = node;
        break;
      }
    }

    if (!rawProducts) {
      throw new Error(
        "No se encontró la lista de productos en __NEXT_DATA__ (estructura de la página cambió o los resultados se cargan vía API del lado del cliente)",
      );
    }

    return rawProducts.slice(0, 5).map((p) => {
      const item = p as Record<string, unknown>;
      const name = String(item.name ?? item.title ?? "");
      const priceInfo = item.priceInfo as Record<string, unknown> | undefined;
      const price =
        typeof item.price === "number"
          ? item.price
          : typeof priceInfo?.currentPrice === "object"
            ? Number((priceInfo.currentPrice as Record<string, unknown>).price)
            : null;
      const usItemId = item.usItemId ?? item.id ?? "";

      return {
        rawTitle: name,
        price: Number.isFinite(price) ? (price as number) : null,
        inStock: item.availabilityStatus !== "OUT_OF_STOCK",
        url: `https://www.walmart.com.mx/ip/${usItemId}`,
      };
    });
  },
};
