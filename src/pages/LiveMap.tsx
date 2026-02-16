import { type VehicleStatus } from "@/data/mockData";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { usePolling } from "@/hooks/usePolling";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import RefreshCountdown from "@/components/RefreshCountdown";
import { X, Navigation, Gauge, Fuel, MapPin } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const statusColors: Record<VehicleStatus, string> = {
  moving: "#22c55e",
  idle: "#eab308",
  offline: "#737373",
};

const createIcon = (status: VehicleStatus) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${statusColors[status]};border:2px solid hsl(217,33%,17%);box-shadow:0 0 8px ${statusColors[status]}80;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const WeatherPopup = ({ lat, lng, name, plate }: { lat: number; lng: number; name: string; plate: string }) => {
  const { data, loading } = useWeather(lat, lng);
  return (
    <div>
      <strong>{name}</strong>
      <br />
      {plate}
      <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", borderTop: "1px solid #334155", paddingTop: 4 }}>
        {loading ? (
          <span>Počasí…</span>
        ) : data ? (
          <span>
            {data.icon} {data.temperature}°C · {data.condition} · 💨 {data.windSpeed} km/h
          </span>
        ) : null}
      </div>
    </div>
  );
};

const POLL_INTERVAL = 15_000;

const LiveMap = () => {
  const { vehicles, selectedVehicleId, statusFilter, loading, error, lastUpdated } = useFleetState();
  const { fetchVehicles, selectVehicle, setStatusFilter } = useFleetActions();

  usePolling(fetchVehicles, POLL_INTERVAL);

  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const displayedVehicles =
    statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Živá mapa</h1>
        <div className="flex items-center gap-4">
          <RefreshCountdown
            lastUpdated={lastUpdated}
            intervalMs={POLL_INTERVAL}
            onRefresh={fetchVehicles}
          />
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
          description="Pro vybraný filtr nejsou k dispozici žádná vozidla."
        />
      ) : (
        <div className="relative flex gap-4">
          <div className="flex-1 overflow-hidden rounded-xl border border-border h-[calc(100vh-14rem)]">
            <MapContainer
              center={[50.075, 14.44]}
              zoom={13}
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {displayedVehicles.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={createIcon(v.status)}
                  eventHandlers={{ click: () => selectVehicle(v.id) }}
                >
                  <Popup>
                    <WeatherPopup lat={v.lat} lng={v.lng} name={v.name} plate={v.plate} />
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {selected && (
            <div className="hidden w-80 shrink-0 rounded-xl border border-border bg-card p-5 lg:block">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selected.name}</h3>
                <button
                  onClick={() => selectVehicle(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-1 text-sm text-muted-foreground font-mono">{selected.plate}</p>

              <div className="mt-4">
                <StatusBadge status={selected.status} size="md" />
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pozice</p>
                    <p className="text-sm font-mono">{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rychlost</p>
                    <p className="text-sm">{selected.speed} km/h</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Palivo</p>
                    <p className="text-sm">{selected.fuelLevel}%</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Řidič</p>
                <p className="text-sm font-medium">{selected.driver}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveMap;
