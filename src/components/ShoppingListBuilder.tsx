"use client";

import { useEffect, useState } from "react";
import type { ProductSummary } from "@/lib/api-types";

export interface ListItem {
  productId: string;
  canonicalName: string;
}

interface ShoppingListBuilderProps {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
}

export function ShoppingListBuilder({ items, onChange }: ShoppingListBuilderProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.products ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function addItem(product: ProductSummary) {
    if (items.some((i) => i.productId === product.id)) return;
    onChange([...items, { productId: product.id, canonicalName: product.canonicalName }]);
    setQuery("");
    setSuggestions([]);
  }

  function removeItem(productId: string) {
    onChange(items.filter((i) => i.productId !== productId));
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="product-search" className="text-sm font-medium">
        Lista de compras
      </label>
      <div className="relative">
        <input
          id="product-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca un producto, ej. leche, arroz…"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {query.trim().length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {loading && <li className="px-3 py-2 text-sm text-zinc-500">Buscando…</li>}
            {!loading && suggestions.length === 0 && (
              <li className="px-3 py-2 text-sm text-zinc-500">Sin resultados</li>
            )}
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => addItem(p)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span>{p.canonicalName}</span>
                  {p.category && <span className="text-xs text-zinc-500">{p.category}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800"
            >
              <span>{item.canonicalName}</span>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-zinc-500 hover:text-red-600"
                aria-label={`Quitar ${item.canonicalName}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
