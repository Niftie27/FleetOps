import type { WeatherData } from "@/types";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  data: WeatherData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function interpretWeatherCode(code: number): Pick<WeatherData, "condition" | "icon"> {
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
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);

  const json = await res.json();
  const current = json?.current;
  if (!current) throw new Error("Unexpected Open-Meteo response shape");

  const { condition, icon } = interpretWeatherCode(Number(current.weather_code));
  const data: WeatherData = {
    temperature: Math.round(Number(current.temperature_2m)),
    windSpeed: Math.round(Number(current.wind_speed_10m)),
    condition,
    icon,
  };

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export function formatWeather(w: WeatherData): string {
  return `${w.icon} ${w.temperature}°C · ${w.condition} · 💨 ${w.windSpeed} km/h`;
}
