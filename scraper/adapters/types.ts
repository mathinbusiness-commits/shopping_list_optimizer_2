export interface StoreSeed {
  chain: string;
  chainName: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface ScrapedPrice {
  rawTitle: string;
  price: number | null;
  inStock: boolean;
  url: string;
}

export interface ChainAdapter {
  chainSlug: string;
  /** Busca un producto en el sitio de la cadena. Debe fallar de forma controlada (lanzar) si el sitio bloquea la petición o cambia su estructura. */
  searchProduct(store: StoreSeed, query: string): Promise<ScrapedPrice[]>;
}
