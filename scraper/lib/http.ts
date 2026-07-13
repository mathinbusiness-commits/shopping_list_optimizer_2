const REALISTIC_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
};

const lastRequestAtByDomain = new Map<string, number>();

async function throttlePerDomain(domain: string) {
  const rateLimitMs = Number(process.env.SCRAPE_RATE_LIMIT_MS ?? 1500);
  const last = lastRequestAtByDomain.get(domain) ?? 0;
  const wait = rateLimitMs - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAtByDomain.set(domain, Date.now());
}

/**
 * Fetch resiliente para el scraper: rate limiting por dominio, headers realistas,
 * timeout, y detección explícita de bloqueo por protección anti-bot (ej. PerimeterX/HUMAN,
 * que Walmart MX usa en su endpoint de búsqueda — ver README). Lanza un error descriptivo
 * en vez de devolver HTML de una página de captcha como si fuera contenido válido.
 */
export async function resilientFetch(
  url: string,
  opts: { timeoutMs?: number; extraHeaders?: Record<string, string> } = {},
): Promise<string> {
  const domain = new URL(url).hostname;
  await throttlePerDomain(domain);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      headers: { ...REALISTIC_HEADERS, ...opts.extraHeaders },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} para ${url}`);
    }
    if (/\/blocked\b|captcha/i.test(res.url)) {
      throw new Error(`Bloqueado por protección anti-bot (redirigido a ${res.url})`);
    }
    const html = await res.text();
    if (/px-captcha|verifica tu identidad/i.test(html)) {
      throw new Error("Bloqueado por protección anti-bot (captcha detectado en el HTML)");
    }
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/** Extrae y parsea el JSON de `<script id="__NEXT_DATA__">`, presente en sitios construidos con Next.js. */
export function extractNextDataJson(html: string): unknown {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("No se encontró __NEXT_DATA__ en el HTML (¿cambió la estructura del sitio?)");
  }
  return JSON.parse(match[1]);
}
