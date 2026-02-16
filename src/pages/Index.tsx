import { Link } from "react-router-dom";
import { Car, Activity, PauseCircle, WifiOff, Fuel } from "lucide-react";
import { type VehicleStatus } from "@/data/mockData";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { usePolling } from "@/hooks/usePolling";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import RefreshCountdown from "@/components/RefreshCountdown";

type Filter = "all" | VehicleStatus;

const POLL_INTERVAL = 30_000;

const Index = () => {
  const { vehicles, statusFilter, loading, error, lastUpdated } = useFleetState();
  const { fetchVehicles, setStatusFilter } = useFleetActions();

  usePolling(fetchVehicles, POLL_INTERVAL);

  if (loading.vehicles && vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Přehled flotily</h1>
          <p className="text-sm text-muted-foreground">Stav vašich vozidel v reálném čase</p>
        </div>
        <LoadingState message="Načítání vozidel…" rows={4} />
      </div>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Přehled flotily</h1>
          <p className="text-sm text-muted-foreground">Stav vašich vozidel v reálném čase</p>
        </div>
        <ErrorState message={error} onRetry={fetchVehicles} />
      </div>
    );
  }

  const counts = {
    total: vehicles.length,
    moving: vehicles.filter((v) => v.status === "moving").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  };

  const filtered =
    statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `Vše (${counts.total})` },
    { key: "moving", label: `V pohybu (${counts.moving})` },
    { key: "idle", label: `Nečinné (${counts.idle})` },
    { key: "offline", label: `Offline (${counts.offline})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Přehled flotily</h1>
          <p className="text-sm text-muted-foreground">
            Stav vašich vozidel v reálném čase
          </p>
        </div>
        <RefreshCountdown
          lastUpdated={lastUpdated}
          intervalMs={POLL_INTERVAL}
          onRefresh={fetchVehicles}
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          title="Celkem vozidel"
          value={counts.total}
          icon={<Car className="h-5 w-5 text-primary" />}
        />
        <KPICard
          title="V pohybu"
          value={counts.moving}
          icon={<Activity className="h-5 w-5 text-status-moving" />}
          accent="text-status-moving"
        />
        <KPICard
          title="Nečinné"
          value={counts.idle}
          icon={<PauseCircle className="h-5 w-5 text-status-idle" />}
          accent="text-status-idle"
        />
        <KPICard
          title="Offline"
          value={counts.offline}
          icon={<WifiOff className="h-5 w-5 text-status-offline" />}
          accent="text-status-offline"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Vehicle table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Žádná vozidla"
          description={
            statusFilter === "all"
              ? "Ve flotile nejsou žádná registrovaná vozidla."
              : `Žádná vozidla ve stavu „${filters.find((f) => f.key === statusFilter)?.label ?? statusFilter}".`
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Vozidlo</th>
                <th className="px-4 py-3 font-medium">SPZ</th>
                <th className="px-4 py-3 font-medium">Stav</th>
                <th className="px-4 py-3 font-medium">Rychlost</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Palivo</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Poslední aktualizace</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-border/50 transition-colors hover:bg-secondary/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/vehicle/${v.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {v.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{v.driver}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {v.plate}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3">
                    {v.speed > 0 ? `${v.speed} km/h` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="h-1.5 w-16 rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${
                            v.fuelLevel > 50
                              ? "bg-status-moving"
                              : v.fuelLevel > 20
                              ? "bg-status-idle"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${v.fuelLevel}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {v.fuelLevel}%
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {new Date(v.lastUpdate).toLocaleString("cs-CZ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Index;
