# Optimizador de Compras — CDMX

Proyecto del curso *Applied Algorithmic Thinking* (LINQ03.2). Dada una lista de compras
y una dirección de origen en Ciudad de México, la app compara precios en sucursales
cercanas (Walmart / Bodega Aurrera) y calcula distintas formas de abastecer la lista
completa —eventualmente repartida entre varias tiendas— optimizando costo, tiempo, o un
balance entre ambos.

## Por qué importa el algoritmo (no solo el scraping)

El scraping y la geolocalización son la infraestructura de datos; el corazón del proyecto
es el motor de optimización combinatoria en [`src/lib/optimizer/pareto.ts`](src/lib/optimizer/pareto.ts):

1. **Reducción del espacio de búsqueda**: de todas las sucursales, se toman las N más
   cercanas en línea recta al origen (filtro rápido antes de pedir distancias reales).
2. **Enumeración de subconjuntos vía bitmask**: para cada posible combinación de hasta
   `maxStops` tiendas, se evalúa si esa combinación cubre toda la lista.
3. **Asignación greedy**: dentro de una combinación de tiendas ya fija, cada producto se
   asigna a su tienda más barata — es óptimo porque los productos son independientes
   entre sí (no hay descuentos por combinar productos).
4. **TSP exacto vía Held-Karp** ([`src/lib/optimizer/heldKarp.ts`](src/lib/optimizer/heldKarp.ts)):
   para cada combinación de tiendas, se calcula el orden de visita que minimiza el tiempo
   de viaje (`O(2^k · k²)`, instantáneo para `k ≤ 8`), usando la matriz de tiempos real de
   OSRM.
5. **Frontera de Pareto**: con el costo y el tiempo de cada combinación factible, se
   calcula el *skyline* costo-vs-tiempo (`O(n log n)`) y se exponen tres opciones —"más
   barato", "más rápido", "balanceado"— más un slider continuo entre ambos extremos.

Ver [`src/lib/optimizer/pareto.test.ts`](src/lib/optimizer/pareto.test.ts) para las
pruebas, incluyendo la verificación de Held-Karp contra fuerza bruta.

## Arquitectura

La app **nunca scrapea en vivo durante una petición del usuario**. Un catálogo de precios
se pobla por separado (seed de ejemplo, o el scraper real) en una base de datos SQLite; la
app de cara al usuario solo lee ese catálogo. Esto evita depender de que el scraping en
vivo responda a tiempo dentro de un request HTTP.

```
data/            sucursales y catálogo de productos curados (JSON, versionado)
prisma/          esquema de la base de datos + seed con precios de ejemplo
scraper/         CLI para poblar precios reales (`npm run scrape -- --chain=walmart`)
src/lib/optimizer/   núcleo algorítmico (bitmask + Held-Karp + Pareto)
src/lib/         geocodificación, distancias, cliente de base de datos
src/app/         páginas (/planear, /resultados) y rutas API
```

## Asistente de IA para generar la lista (Gemini)

En `/planear` hay un cuadro "✨ Generar lista con IA": describes para qué es la lista
(ej. *"Lista de compras semanal de comida para una familia de 4, 2 niños y 2 adultos"*) y
Gemini selecciona los productos del catálogo (`src/lib/gemini.ts`,
`/api/asistente/generar-lista`) que encajan con esa petición.

El modelo **solo puede elegir productos que ya existen en el catálogo**: la llamada a
Gemini usa `responseSchema` con un `enum` de los IDs válidos, así que no hay riesgo de que
alucine un producto que no tenga precio en la base de datos — es una restricción a nivel
de decodificación del modelo, no una validación posterior.

Para usarlo, consigue una API key gratis en <https://aistudio.google.com/apikey> y
ponla en `.env`:

```bash
GEMINI_API_KEY=tu-api-key-aqui
```

Si falta la key, el botón muestra un error claro ("Falta configurar GEMINI_API_KEY...")
en vez de fallar de forma confusa.

## Sobre el scraping real: limitación conocida

El adapter de Walmart (`scraper/adapters/walmart.ts`) está implementado correctamente
(fetch + parseo de `__NEXT_DATA__`), pero **el endpoint de búsqueda de walmart.com.mx está
protegido por PerimeterX/HUMAN Security** (una pantalla de captcha "Verifica tu
identidad"). Un cliente HTTP simple —sin resolver un challenge de JavaScript en un
navegador real— es bloqueado de forma consistente, incluso con headers realistas y
cookies de una visita previa. Esto se verificó manualmente antes de escribir el adapter.

Deliberadamente **no se implementó evasión de esa protección** (proxies residenciales,
resolución de captcha, spoofing de fingerprint): ese endpoint está protegido a propósito
contra acceso automatizado, y saltárselo excede el alcance educativo del proyecto.

En la práctica esto significa:

- `npm run scrape -- --chain=walmart` va a reportar bloqueos en un entorno automatizado
  (CI, servidor, sandbox) — y eso es el comportamiento esperado, no un bug. Cada fallo se
  loguea por tienda/producto sin detener el resto de la corrida (degradación elegante).
- La app funciona con los precios de ejemplo generados por `npm run db:seed` (variación
  determinística ±18% sobre un precio base realista por producto, con ~12% de
  combinaciones tienda-producto marcadas sin stock a propósito, para ejercitar el camino
  de "sin datos" del optimizador).
- Si se quisiera obtener precios reales de verdad, el camino correcto sería que una
  persona lo haga manualmente desde un navegador real (no automatizado), no scriptear una
  evasión del captcha.

## Requisitos

- Node.js **20.19+** o **22.12+** (Prisma 7 lo exige). Si `node --version` muestra algo
  menor, usa una versión más nueva solo para este proyecto, ej. con `nvm` o apuntando el
  `PATH` a una instalación más nueva.

## Cómo correrlo

```bash
npm install
cp .env.example .env   # o edita .env directamente
npm run db:push        # crea prisma/dev.db según el schema
npm run db:seed        # carga sucursales + catálogo + precios de ejemplo
npm run dev             # http://localhost:3000
```

Para intentar refrescar precios reales de Walmart (ver limitación arriba):

```bash
npm run scrape -- --chain=walmart --query="leche entera 1l" --dry-run   # prueba sin escribir en la DB
npm run scrape -- --chain=walmart                                       # corrida completa contra el catálogo
```

## Pruebas

```bash
npm test        # vitest: núcleo algorítmico
npx tsc --noEmit
npx eslint .
```

## Despliegue

Pensado para Vercel. La base de datos SQLite vive en el filesystem del proyecto, lo cual
funciona para desarrollo local; para producción en Vercel (filesystem efímero) hay que
migrar a algo como Turso/libSQL antes de desplegar — ver nota en el plan del proyecto.
