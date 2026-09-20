import type { LocationObject } from 'expo-location';

const EARTH_RADIUS_M = 6_371_000;

/** Haversine formula - returns distance between two GPS coords in metres */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns true if the new point should be accepted (not noise / not a vehicle) */
export function isValidWalkingPoint(
  prev: LocationObject,
  next: LocationObject,
): boolean {
  const dist = haversineDistance(
    prev.coords.latitude,  prev.coords.longitude,
    next.coords.latitude,  next.coords.longitude,
  );

  // Reject points with poor GPS accuracy
  if (next.coords.accuracy && next.coords.accuracy > 30) return false;

  // Reject if the user hasn't moved (< 5 m) - avoids GPS drift accumulation
  if (dist < 5) return false;

  // Reject if speed implies they're in a vehicle (> 10 m/s ≈ 36 km/h)
  const timeDelta = (next.timestamp - prev.timestamp) / 1000; // seconds
  if (timeDelta > 0) {
    const speed = dist / timeDelta;
    if (speed > 10) return false;
  }

  return true;
}

export const metersToKm   = (m: number) => (m / 1000).toFixed(2);
export const mpsToKmh     = (mps: number) => (mps * 3.6).toFixed(1);
export const formatTime   = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
