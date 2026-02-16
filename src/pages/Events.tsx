import { useState, useEffect, useMemo } from "react";
import { type FleetEvent } from "@/data/mockData";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { AlertTriangle, AlertCircle, Info, Filter, Bell } from "lucide-react";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";

const severityConfig: Record<FleetEvent["severity"], { icon: typeof AlertTriangle; className: string; label: string }> = {
  high: { icon: AlertTriangle, className: "text-destructive", label: "Vysoká" },
  medium: { icon: AlertCircle, className: "text-status-idle", label: "Střední" },
  low: { icon: Info, className: "text-primary", label: "Nízká" },
};

const Events = () => {
  const [vehicleId, setVehicleId] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-02-15");
  const [dateTo, setDateTo] = useState("2026-02-16");

  const { vehicles, events, loading, error } = useFleetState();
  const { fetchVehicles, fetchEvents } = useFleetActions();

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    fetchEvents();
  }, [dateFrom, dateTo, fetchEvents]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (vehicleId !== "all" && e.vehicleId !== vehicleId) return false;
      const d = e.timestamp.slice(0, 10);
      if (d < dateFrom || d > dateTo) return false;
      return true;
    });
  }, [events, vehicleId, dateFrom, dateTo]);

  const selectClass =
    "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (error && events.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Události a upozornění</h1>
        <ErrorState message={error} onRetry={fetchEvents} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Události a upozornění</h1>
        <p className="text-sm text-muted-foreground">
          Bezpečnostní události a systémová upozornění
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Vozidlo</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className={selectClass}
          >
            <option value="all">Všechna vozidla</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Od</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={selectClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Do</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={selectClass}
          />
        </div>
      </div>

      {/* Events */}
      {loading.events && events.length === 0 ? (
        <LoadingState message="Načítání událostí…" rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="Žádné události"
          description={`Pro období ${dateFrom} – ${dateTo}${vehicleId !== "all" ? ` a vybrané vozidlo` : ""} nejsou k dispozici žádné události. Zkuste rozšířit datumový rozsah.`}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const sev = severityConfig[event.severity];
            const SevIcon = sev.icon;
            return (
              <div
                key={event.id}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className={`mt-0.5 ${sev.className}`}>
                  <SevIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{event.vehicleName}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        event.severity === "high"
                          ? "bg-destructive/15 text-destructive"
                          : event.severity === "medium"
                          ? "bg-status-idle/15 text-status-idle"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {sev.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.message}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString("cs-CZ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Events;
