"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddressInput, type ResolvedOrigin } from "@/components/AddressInput";
import { ShoppingListBuilder, type ListItem } from "@/components/ShoppingListBuilder";
import { savePlan } from "@/lib/planStorage";

export default function PlanearPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState<ResolvedOrigin | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [maxStops, setMaxStops] = useState(3);
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!origin) {
      setError("Primero busca y confirma tu dirección de origen");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un producto a tu lista");
      return;
    }
    setError("");
    savePlan({ origin, items, maxStops });
    router.push("/resultados");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Optimizador de compras — CDMX</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Dinos de dónde partes y qué necesitas comprar. Comparamos precios reales de
          Walmart y Bodega Aurrera en tiendas cercanas, y te damos opciones según
          presupuesto o tiempo.
        </p>
      </div>

      <AddressInput value={origin} onResolved={setOrigin} />
      <ShoppingListBuilder items={items} onChange={setItems} />

      <div className="flex flex-col gap-2">
        <label htmlFor="max-stops" className="text-sm font-medium">
          Máximo de tiendas a visitar: {maxStops}
        </label>
        <input
          id="max-stops"
          type="range"
          min={1}
          max={5}
          value={maxStops}
          onChange={(e) => setMaxStops(Number(e.target.value))}
        />
        <p className="text-xs text-zinc-500">
          Limita cuántas paradas estás dispuesto a hacer para conseguir mejores precios.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        id="submit-plan"
        type="button"
        onClick={handleSubmit}
        className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Ver opciones de compra
      </button>
    </div>
  );
}
