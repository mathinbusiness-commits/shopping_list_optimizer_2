import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // dev.db se abre por ruta de archivo en tiempo de ejecución (no por import estático),
  // así que el file tracer de Vercel no lo detecta solo — hay que declararlo a mano.
  outputFileTracingIncludes: {
    "/api/**": ["./dev.db"],
  },
};

export default nextConfig;
