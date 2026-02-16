// In-memory reverse geocoding with Nominatim + cache
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function fetchAddress(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=16&accept-language=cs`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FleetInsights/1.0" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();

  const a = data.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.neighbourhood ?? "";
  const houseNumber = a.house_number ?? "";
  const city =
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";

  const parts: string[] = [];
  if (city) parts.push(city);
  if (street) parts.push(street + (houseNumber ? ` ${houseNumber}` : ""));

  return parts.length > 0 ? parts.join(", ") : data.display_name ?? `${lat}, ${lng}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!lat && !lng) return "—";

  const key = cacheKey(lat, lng);

  const cached = cache.get(key);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same coords
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
