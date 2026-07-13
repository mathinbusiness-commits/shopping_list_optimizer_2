import type { StoreInfoDTO } from "@/lib/api-types";
import type { ParetoCandidate } from "@/lib/optimizer/types";

interface ResultBreakdownProps {
  candidate: ParetoCandidate;
  stores: Record<string, StoreInfoDTO>;
  unavailableProducts: { id: string; canonicalName: string }[];
}

export function ResultBreakdown({ candidate, stores, unavailableProducts }: ResultBreakdownProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-6 rounded-md bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">Costo total</p>
          <p className="text-xl font-semibold">${candidate.totalCost.toFixed(2)} MXN</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Tiempo total</p>
          <p className="text-xl font-semibold">{candidate.totalTimeMin} min</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Tiendas a visitar</p>
          <p className="text-xl font-semibold">{candidate.storeIds.length}</p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {candidate.route.map((storeId, i) => {
          const store = stores[storeId];
          const assignment = candidate.assignments.find((a) => a.storeId === storeId);
          if (!store || !assignment) return null;
          return (
            <li key={storeId} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">
                  {i + 1}. {store.name}{" "}
                  <span className="text-sm font-normal text-zinc-500">({store.chainName})</span>
                </p>
                <p className="text-sm font-semibold">${assignment.subtotal.toFixed(2)}</p>
              </div>
              <p className="text-xs text-zinc-500">{store.address}</p>
              <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                {assignment.items.map((item) => (
                  <li key={item.productId} className="flex justify-between">
                    <span>{item.canonicalName}</span>
                    <span>${item.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      {unavailableProducts.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium text-amber-800 dark:text-amber-300">Sin datos de precio</p>
          <p className="text-amber-700 dark:text-amber-400">
            No encontramos precio para: {unavailableProducts.map((p) => p.canonicalName).join(", ")}. No
            se incluyen en el cálculo.
          </p>
        </div>
      )}
    </div>
  );
}
