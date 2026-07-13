export interface StoreCandidate {
  id: string;
  name: string;
  chainName: string;
  lat: number;
  lng: number;
}

/** Disponibilidad de un producto de la lista en las tiendas candidatas. */
export interface ItemAvailability {
  productId: string;
  canonicalName: string;
  /** Precio por tienda, solo para las tiendas donde hay stock. */
  pricesByStoreId: Record<string, number>;
}

export interface OptimizeInput {
  /** Tiendas candidatas, ya filtradas a las más cercanas al origen (ver distance.ts). */
  stores: StoreCandidate[];
  items: ItemAvailability[];
  /**
   * Matriz de tiempos de viaje en minutos, índice 0 = origen del usuario,
   * índices 1..N = stores[0..N-1] en el mismo orden.
   */
  distanceMatrixMinutes: number[][];
  /** Máximo número de tiendas a visitar en una misma opción. */
  maxStops: number;
  /** Minutos fijos estimados por parada (estacionar + comprar), sumados al tiempo de ruta. */
  stopOverheadMin: number;
}

export interface StoreAssignment {
  storeId: string;
  storeName: string;
  items: { productId: string; canonicalName: string; price: number }[];
  subtotal: number;
}

export interface ParetoCandidate {
  storeIds: string[];
  totalCost: number;
  totalTimeMin: number;
  /** Orden sugerido de visita (ids de tienda), resultado del TSP exacto. */
  route: string[];
  assignments: StoreAssignment[];
}

export interface OptimizeResult {
  /** Frontera de Pareto: candidatos no dominados, ordenados por costo ascendente. */
  paretoFrontier: ParetoCandidate[];
  cheapest: ParetoCandidate | null;
  fastest: ParetoCandidate | null;
  balanced: ParetoCandidate | null;
  /** Productos sin precio en ninguna de las tiendas candidatas (excluidos del cálculo). */
  unavailableProductIds: string[];
}
