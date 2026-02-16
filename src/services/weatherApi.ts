// Open-Meteo weather service with 10-minute cache

interface WeatherData {
  temperature: number;
  windSpeed: number;
  condition: string;
  icon: string;
}

interface CacheEntry {
  data: WeatherData;
  expires: number;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

// WMO Weather interpretation codes → label + emoji
function interpretWMO(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: "Jasno", icon: "☀️" };
  if (code <= 3) return { condition: "Oblačno", icon: "⛅" };
  if (code <= 48) return { condition: "Mlha", icon: "🌫️" };
  if (code <= 57) return { condition: "Mrholení", icon: "🌦️" };
  if (code <= 67) return { condition: "Déšť", icon: "🌧️" };
  if (code <= 77) return { condition: "Sníh", icon: "🌨️" };
  if (code <= 82) return { condition: "Přeháňky", icon: "🌧️" };
  if (code <= 86) return { condition: "Sněžení", icon: "🌨️" };
  if (code <= 99) return { condition: "Bouřka", icon: "⛈️" };
  return { condition: "Neznámé", icon: "❓" };
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();

  const current = json.current;
  const { condition, icon } = interpretWMO(current.weather_code);

  const data: WeatherData = {
    temperature: Math.round(current.temperature_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    condition,
    icon,
  };

  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

export type { WeatherData };
