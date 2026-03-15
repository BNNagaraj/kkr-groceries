/**
 * Geo-distance utilities for nearest-store and nearest-delivery-boy logic.
 * Uses Haversine formula (pure math, no Google Maps dependency).
 */

const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two lat/lng points in kilometers */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GeoEntity {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Find the nearest entity to a given lat/lng. Returns null if list is empty. */
export function findNearest<T extends GeoEntity>(
  lat: number,
  lng: number,
  entities: T[]
): (T & { distanceKm: number }) | null {
  if (entities.length === 0) return null;
  let best: T | null = null;
  let bestDist = Infinity;

  for (const e of entities) {
    const d = haversineDistance(lat, lng, e.lat, e.lng);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }

  return best ? { ...best, distanceKm: bestDist } : null;
}
