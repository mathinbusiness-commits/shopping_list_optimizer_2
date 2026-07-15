"use client";

import { useState } from "react";
import type { ListItem } from "./ShoppingListBuilder";

interface AIListAssistantProps {
  onGenerated: (items: ListItem[]) => void;
}

export function AIListAssistant({ onGenerated }: AIListAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGenerate() {
    if (prompt.trim().length < 5) {
      setStatus("error");
      setErrorMsg("Describe con un poco más de detalle qué lista necesitas");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/asistente/generar-lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "No se pudo generar la lista");
        return;
      }
      onGenerated(data.items);
      setStatus("idle");
      setPrompt("");
    } catch {
      setStatus("error");
      setErrorMsg("Error de red al generar la lista");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <label htmlFor="ai-prompt" className="text-sm font-medium">
        ✨ Generar lista con IA
      </label>
      <textarea
        id="ai-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder='Ej. "Lista de compras semanal de comida para una familia de 4, 2 niños y 2 adultos"'
        rows={2}
        className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        onClick={handleGenerate}
        disabled={status === "loading"}
        className="self-start rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
      >
        {status === "loading" ? "Generando…" : "Generar lista"}
      </button>
      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
      <p className="text-xs text-zinc-500">
        Solo elige productos que ya existen en el catálogo de la app, para que siempre tengan
        precio disponible.
      </p>
    </div>
  );
}
