import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { vehicles, type Vehicle } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { X, Navigation, Gauge, Fuel } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const statusColors = {
  moving: "#22c55e",
  idle: "#eab308",
  offline: "#737373",
};

const createIcon = (status: Vehicle["status"]) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${statusColors[status]};border:2px solid hsl(217,33%,17%);box-shadow:0 0 8px ${statusColors[status]}80;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const LiveMap = () => {
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Živá mapa</h1>
        <div className="h-[calc(100vh-12rem)] animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Živá mapa</h1>

      <div className="relative flex gap-4">
        {/* Map */}
        <div className={`flex-1 overflow-hidden rounded-xl border border-border ${selected ? "h-[calc(100vh-12rem)]" : "h-[calc(100vh-12rem)]"}`}>
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
            {vehicles.map((v) => (
              <Marker
                key={v.id}
                position={[v.lat, v.lng]}
                icon={createIcon(v.status)}
                eventHandlers={{ click: () => setSelected(v) }}
              >
                <Popup>
                  <strong>{v.name}</strong>
                  <br />
                  {v.plate}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="hidden w-80 shrink-0 rounded-xl border border-border bg-card p-5 lg:block">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{selected.name}</h3>
              <button
                onClick={() => setSelected(null)}
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
    </div>
  );
};

export default LiveMap;
