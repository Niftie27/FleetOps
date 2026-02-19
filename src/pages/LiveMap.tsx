import { type VehicleStatus } from "@/types/fleet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { usePolling } from "@/hooks/usePolling";
import { useWeather } from "@/hooks/useWeather";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import RefreshCountdown from "@/components/RefreshCountdown";
import { X, Navigation, Gauge, MapPin, Thermometer } from "lucide-react";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const STATUS_COLORS: Record<VehicleStatus, string> = {
  moving: "#22c55e",
  idle: "#eab308",
  offline: "#737373",
};

const createMarkerIcon = (status: VehicleStatus, isSelected = false) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:${isSelected ? 18 : 13}px;
      height:${isSelected ? 18 : 13}px;
      border-radius:50%;
      background:${STATUS_COLORS[status]};
      border:${isSelected ? 3 : 2}px solid rgba(15,23,42,0.9);
      box-shadow:0 0 ${isSelected ? 14 : 7}px ${STATUS_COLORS[status]}${isSelected ? "cc" : "80"};
      transition:all 0.2s;
    "></div>`,
    iconSize: [isSelected ? 18 : 13, isSelected ? 18 : 13],
    iconAnchor: [isSelected ? 9 : 6.5, isSelected ? 9 : 6.5],
  });

// Compact weather string: ⛅ -3°C · Oblačno · 💨 12 km/h
function formatWeatherLine(icon: string, temp: number, condition: string, wind: number): string {
  return `${icon} ${temp}°C · ${condition} · 💨 ${wind} km/h`;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length === 0) return;
    fitted.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], 12);
    } else {
      map.fitBounds(positions, { padding: [50, 50], maxZoom: 12 });
    }
  }, [map, positions]);
  return null;
}

function FlyToSelected({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 1 });
  }, [map, lat, lng]);
  return null;
}

const POLL_INTERVAL = 15_000;

// ── Weather widget for the sidebar ───────────────────────
// Fetches weather at vehicle coordinates and displays it.
// Rendered as a child component so the hook only runs when a vehicle is selected.
function VehicleWeatherPanel({ lat, lng }: { lat: number; lng: number }) {
  const { data, loading } = useWeather(lat, lng);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Thermometer className="h-3.5 w-3.5 shrink-0" />
        <span>Načítám počasí…</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">Počasí v místě vozidla</p>
      <p className="text-sm font-medium">
        {data.icon} {data.temperature}°C · {data.condition} · 💨 {data.windSpeed} km/h
      </p>
    </div>
  );
}

const LiveMap = () => {
  const { vehicles, selectedVehicleId, statusFilter, searchQuery, loading, error, lastUpdated } = useFleetState();
  const { fetchVehicles, selectVehicle, setStatusFilter } = useFleetActions();

  usePolling(fetchVehicles, POLL_INTERVAL);

  // React to global search query — find matching vehicle and select it
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    const match = vehicles.find(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        (v.driver && v.driver.toLowerCase().includes(q))
    );
    if (match) selectVehicle(match.id);
  }, [searchQuery, vehicles, selectVehicle]);

  const vehiclesWithPos = vehicles.filter((v) => v.lat !== 0 && v.lng !== 0);
  const displayedVehicles =
    statusFilter === "all" ? vehiclesWithPos : vehiclesWithPos.filter((v) => v.status === statusFilter);
  const markerPositions: [number, number][] = vehiclesWithPos.map((v) => [v.lat, v.lng]);

  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const filterOptions: { key: "all" | VehicleStatus; label: string }[] = [
    { key: "all", label: "Vše" },
    { key: "moving", label: "V pohybu" },
    { key: "idle", label: "Nečinné" },
    { key: "offline", label: "Offline" },
  ];

  if (loading.vehicles && vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Živá mapa</h1>
        <LoadingState message="Načítání pozic vozidel…" rows={1} />
        <div className="h-[calc(100vh-16rem)] animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Živá mapa</h1>
        <ErrorState message={error} onRetry={fetchVehicles} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Živá mapa</h1>
        <div className="flex items-center gap-4">
          <RefreshCountdown lastUpdated={lastUpdated} intervalMs={POLL_INTERVAL} onRefresh={fetchVehicles} />
          <div className="flex gap-1">
            {filterOptions.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {displayedVehicles.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title="Žádná vozidla na mapě"
          description={
            vehiclesWithPos.length === 0
              ? "Načtená vozidla zatím nemají GPS pozici."
              : "Pro vybraný filtr nejsou k dispozici žádná vozidla."
          }
        />
      ) : (
        <div className="relative flex gap-4">
          {/* Map */}
          <div className="flex-1 overflow-hidden rounded-xl border border-border h-[calc(100vh-14rem)]">
            <MapContainer center={[50.075, 14.44]} zoom={7} className="h-full w-full" zoomControl={false}>
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <FitBounds positions={markerPositions} />
              {selected && selected.lat !== 0 && (
                <FlyToSelected lat={selected.lat} lng={selected.lng} />
              )}
              {displayedVehicles.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={createMarkerIcon(v.status, v.id === selectedVehicleId)}
                  eventHandlers={{ click: () => selectVehicle(v.id) }}
                >
                  <VehiclePopup v={v} />
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Selected vehicle sidebar */}
          {selected && (
            <div className="w-72 shrink-0 rounded-xl border border-border bg-card p-4 space-y-3 self-start">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold leading-tight">{selected.name}</h3>
                  {selected.plate && <p className="text-xs text-muted-foreground">{selected.plate}</p>}
                </div>
                <button onClick={() => selectVehicle(null)} className="rounded p-1 hover:bg-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <StatusBadge status={selected.status} size="md" />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gauge className="h-4 w-4 shrink-0" />
                  <span>{selected.speed} km/h</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Navigation className="h-4 w-4 shrink-0" />
                  <span className="text-xs tabular-nums">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="text-xs">{new Date(selected.lastUpdate).toLocaleString("cs-CZ")}</span>
                </div>
                {selected.driver && (
                  <p className="text-xs text-muted-foreground">Řidič: {selected.driver}</p>
                )}
                {selected.odometer > 0 && (
                  <p className="text-xs text-muted-foreground">Odometr: {selected.odometer.toLocaleString("cs-CZ")} km</p>
                )}
              </div>

              {/* Weather at vehicle's location */}
              {selected.lat !== 0 && selected.lng !== 0 && (
                <VehicleWeatherPanel lat={selected.lat} lng={selected.lng} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Map popup with weather ─────────────────────────────────
// Separate component so useWeather hook re-runs per vehicle
function VehiclePopup({ v }: { v: ReturnType<typeof import("@/store/FleetStore").useFleetState>["vehicles"][0] }) {
  const { data: weather } = useWeather(v.lat, v.lng);

  return (
    <Popup>
      <div className="min-w-[170px] text-sm space-y-1">
        <p className="font-semibold">{v.name}</p>
        {v.plate && <p className="text-xs text-gray-500">{v.plate}</p>}
        <p>{v.speed} km/h</p>
        {weather && (
          <p className="text-xs text-gray-400 mt-1">
            {formatWeatherLine(weather.icon, weather.temperature, weather.condition, weather.windSpeed)}
          </p>
        )}
        <p className="text-xs text-gray-400">{new Date(v.lastUpdate).toLocaleString("cs-CZ")}</p>
      </div>
    </Popup>
  );
}

export default LiveMap;
