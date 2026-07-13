export interface ShoppingPlan {
  origin: { lat: number; lng: number; displayName: string };
  items: { productId: string; canonicalName: string }[];
  maxStops: number;
}

const STORAGE_KEY = "mi_app:shopping-plan";

export function savePlan(plan: ShoppingPlan) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function loadPlan(): ShoppingPlan | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShoppingPlan;
  } catch {
    return null;
  }
}
