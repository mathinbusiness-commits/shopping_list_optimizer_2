import type { ParetoCandidate } from "./optimizer/types";

export interface OptimizeRequestBody {
  origin: { lat: number; lng: number; displayName?: string };
  productIds: string[];
  maxStops: number;
}

export interface StoreInfoDTO {
  id: string;
  name: string;
  chainName: string;
  address: string;
  lat: number;
  lng: number;
}

export interface OptimizeResponseBody {
  paretoFrontier: ParetoCandidate[];
  cheapest: ParetoCandidate | null;
  fastest: ParetoCandidate | null;
  balanced: ParetoCandidate | null;
  unavailableProducts: { id: string; canonicalName: string }[];
  /** Info de cada tienda referenciada en algún candidato, para mostrar nombre/dirección/ruta. */
  stores: Record<string, StoreInfoDTO>;
  /** ISO date del precio más reciente usado en el cálculo, o null si no hubo ninguno. */
  pricesAsOf: string | null;
}

export interface ProductSummary {
  id: string;
  canonicalName: string;
  category: string | null;
  unit: string | null;
}
