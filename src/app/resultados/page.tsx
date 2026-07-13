"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ParetoChart } from "@/components/ParetoChart";
import { ResultBreakdown } from "@/components/ResultBreakdown";
import { TradeoffSlider } from "@/components/TradeoffSlider";
import type { OptimizeResponseBody } from "@/lib/api-types";
import type { ParetoCandidate } from "@/lib/optimizer/types";
import { loadPlan } from "@/lib/planStorage";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "hace menos de una hora";
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

export default function ResultadosPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "empty" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<OptimizeResponseBody | null>(null);
  const [selected, setSelected] = useState<ParetoCandidate | null>(null);

  useEffect(() => {
    const plan = loadPlan();
    if (!plan) {
      router.replace("/planear");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/optimizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: plan.origin,
            productIds: plan.items.map((i) => i.productId),
            maxStops: plan.maxStops,
          }),
        });
        const json = (await res.json()) as OptimizeResponseBody & { error?: string };
        if (!res.ok) {
          setErrorMsg(json.error ?? "Error calculando las opciones");
          setStatus("error");
          return;
        }
        if (json.paretoFrontier.length === 0) {
          setData(json);
          setStatus("empty");
          return;
        }
        setData(json);
        setSelected(json.balanced ?? json.paretoFrontier[0]);
        setStatus("ready");
      } catch {
        setErrorMsg("Error de red calculando las opciones");
        setStatus("error");
      }
    })();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-10">
        <p className="text-zinc-500">Calculando las mejores combinaciones de tiendas…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 py-10">
        <p className="text-red-600">{errorMsg}</p>
        <Link href="/planear" className="text-sm underline">
          Volver a intentar
        </Link>
      </div>
    );
  }

  if (status === "empty" || !data) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 py-10">
        <p className="text-zinc-700 dark:text-zinc-300">
          No encontramos ninguna combinación de tiendas que cubra toda tu lista dentro del
          límite de paradas elegido.
        </p>
        {data && data.unavailableProducts.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Sin datos de precio: {data.unavailableProducts.map((p) => p.canonicalName).join(", ")}
          </p>
        )}
        <Link href="/planear" className="text-sm underline">
          Ajustar la lista o el número de paradas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Opciones de compra</h1>
        <Link href="/planear" className="text-sm underline">
          Editar lista
        </Link>
      </div>

      {data.pricesAsOf && (
        <p className="text-xs text-zinc-500">Precios actualizados {timeAgo(data.pricesAsOf)}.</p>
      )}

      <ParetoChart frontier={data.paretoFrontier} selected={selected} onSelect={setSelected} />
      <TradeoffSlider frontier={data.paretoFrontier} onSelect={setSelected} />

      {selected && (
        <ResultBreakdown
          candidate={selected}
          stores={data.stores}
          unavailableProducts={data.unavailableProducts}
        />
      )}
    </div>
  );
}
