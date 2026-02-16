import { useEffect, useState } from "react";
import { fetchWeather, type WeatherData } from "@/services/weatherApi";

export function useWeather(lat: number, lng: number) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeather(lat, lng)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* fail silently */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  return { data, loading };
}
