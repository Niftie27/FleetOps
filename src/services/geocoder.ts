// Reverse geocoding via backend proxy (Nominatim blocked by CORS from browsers)
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function fetchAddress(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/geocode/reverse?lat=${lat}&lng=${lng}`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const data = await res.json();
  return data.address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!lat && !lng) return "—";

  const key = cacheKey(lat, lng);

  const cached = cache.get(key);
  if (cached) return cached;

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = fetchAddress(lat, lng)
    .then((addr) => {
      cache.set(key, addr);
      return addr;
    })
    .catch(() => {
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      cache.set(key, fallback);
      return fallback;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}
