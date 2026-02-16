import { useWeather } from "@/hooks/useWeather";
import { useFleetState } from "@/store/FleetStore";
import { useMemo } from "react";

const PRAGUE = { lat: 50.075, lng: 14.44 };

const FleetWeather = () => {
  const { vehicles } = useFleetState();

  const coords = useMemo(() => {
    const active = vehicles.filter((v) => v.lat && v.lng);
    if (active.length === 0) return PRAGUE;
    const lat = active.reduce((s, v) => s + v.lat, 0) / active.length;
    const lng = active.reduce((s, v) => s + v.lng, 0) / active.length;
    return { lat, lng };
  }, [vehicles]);

  const { data, loading } = useWeather(coords.lat, coords.lng);

  if (loading) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
        Počasí…
      </span>
    );
  }

  if (!data) return null;

  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
      <span>{data.icon}</span>
      <span>{data.temperature}°C</span>
      <span className="text-muted-foreground/60">·</span>
      <span>{data.condition}</span>
      <span className="text-muted-foreground/60">·</span>
      <span>💨 {data.windSpeed} km/h</span>
    </span>
  );
};

export default FleetWeather;
