/**
 * Pure geometry / combinatorics helpers shared by the server optimiser (`optimizer.ts`, SQLite) and the
 * in-browser Basket Optimizer UI. No imports on purpose: this file must stay safe to bundle for the browser.
 */
export interface LatLng { lat: number; lng: number }

const R_EARTH_KM = 6371;
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Shortest round trip home → stores (any order) → home, straight-line km. Max 3 stores → ≤ 6 permutations. */
export function roundTripKm(home: LatLng, points: LatLng[]): number {
  if (!points.length) return 0;
  const perms = (xs: LatLng[]): LatLng[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  let best = Infinity;
  for (const order of perms(points)) {
    let d = 0, prev = home;
    for (const p of order) { d += haversineKm(prev, p); prev = p; }
    d += haversineKm(prev, home);
    best = Math.min(best, d);
  }
  return best;
}

export function combinations<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (xs.length < k) return [];
  const [head, ...rest] = xs as [T, ...T[]];
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}
