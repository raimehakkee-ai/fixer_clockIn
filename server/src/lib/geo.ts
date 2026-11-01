export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6371008.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/** Jarak great-circle antara dua koordinat dalam meter. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(distanceMeters: number, radiusMeters: number): boolean {
  return distanceMeters <= radiusMeters;
}

export function roundDistance(distanceMeters: number): number {
  return Math.round(distanceMeters * 10) / 10;
}
