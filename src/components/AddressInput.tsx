"use client";

import { useState } from "react";

export interface ResolvedOrigin {
  lat: number;
  lng: number;
  displayName: string;
}

interface AddressInputProps {
  value: ResolvedOrigin | null;
  onResolved: (origin: ResolvedOrigin | null) => void;
}

export function AddressInput({ value, onResolved }: AddressInputProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSearch() {
    if (query.trim().length < 3) {
      setStatus("error");
      setErrorMsg("Escribe al menos 3 caracteres");
      return;
    }
    setStatus("loading");
    onResolved(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "No se pudo geocodificar la dirección");
        return;
      }
      onResolved({ lat: data.lat, lng: data.lng, displayName: data.displayName });
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMsg("Error de red al buscar la dirección");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="address" className="text-sm font-medium">
        Tu dirección u origen
      </label>
      <div className="flex gap-2">
        <input
          id="address"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Ej. Zócalo, Ciudad de México"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={status === "loading"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {status === "loading" ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
      {value && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Origen: {value.displayName}
        </p>
      )}
    </div>
  );
}
