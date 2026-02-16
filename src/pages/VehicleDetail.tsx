import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import StatusBadge from "@/components/StatusBadge";
import { ArrowLeft, Navigation, Gauge, Fuel, Clock, Key, MapPin } from "lucide-react";

const VehicleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { vehicles, trips } = useFleetState();
  const { fetchVehicles, fetchTrips } = useFleetActions();

  useEffect(() => {
    if (vehicles.length === 0) fetchVehicles();
    if (trips.length === 0) fetchTrips();
  }, [vehicles.length, trips.length, fetchVehicles, fetchTrips]);

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Vozidlo nenalezeno</h2>
        <p className="mt-2 text-muted-foreground">Zkontrolujte ID vozidla</p>
        <Link to="/" className="mt-4 text-primary hover:underline">
          Zpět na přehled
        </Link>
      </div>
    );
  }

  const vehicleTrips = trips.filter((t) => t.vehicleId === vehicle.id);

  const infoItems = [
    { icon: Navigation, label: "Pozice", value: `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` },
    { icon: Gauge, label: "Rychlost", value: `${vehicle.speed} km/h` },
    { icon: Key, label: "Zapalování", value: vehicle.ignition ? "Zapnuto" : "Vypnuto" },
    { icon: Fuel, label: "Palivo", value: `${vehicle.fuelLevel}%` },
    { icon: Clock, label: "Poslední aktualizace", value: new Date(vehicle.lastUpdate).toLocaleString("cs-CZ") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg bg-secondary p-2 hover:bg-secondary/80">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{vehicle.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{vehicle.plate} · {vehicle.driver}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={vehicle.status} size="md" />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {infoItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <item.icon className="h-4 w-4" />
              <span className="text-xs">{item.label}</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Odometer */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Stav tachometru</p>
        <p className="mt-1 text-3xl font-bold">{vehicle.odometer.toLocaleString("cs-CZ")} km</p>
      </div>

      {/* Recent trips */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Poslední jízdy</h2>
        {vehicleTrips.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
            Žádné jízdy k zobrazení
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Začátek</th>
                  <th className="px-4 py-3 font-medium">Odkud</th>
                  <th className="px-4 py-3 font-medium">Kam</th>
                  <th className="px-4 py-3 font-medium">Vzdálenost</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Max rychlost</th>
                </tr>
              </thead>
              <tbody>
                {vehicleTrips.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(t.startTime).toLocaleString("cs-CZ")}
                    </td>
                    <td className="px-4 py-3">{t.startLocation}</td>
                    <td className="px-4 py-3">{t.endLocation}</td>
                    <td className="px-4 py-3">{t.distance} km</td>
                    <td className="hidden px-4 py-3 md:table-cell">{t.maxSpeed} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleDetail;
