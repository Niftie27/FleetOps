import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { type FleetEvent } from "@/types/fleet";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { AlertTriangle, AlertCircle, Info, Filter, Bell } from "lucide-react";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { getEvents } from "@/services/dozorApi";
import {
  TODAY,
  daysAgo,
  daysBetween,
  isValidDate,
  validateDateRange,
} from "@/utils/dateUtils";

const severityConfig: Record<FleetEvent["severity"], {
  icon: typeof AlertTriangle;
  className: string;
  bg: string;
  label: string;
}> = {
  high:   { icon: AlertTriangle, className: "text-destructive",  bg: "bg-destructive/10",   label: "Vysoká" },
  medium: { icon: AlertCircle,   className: "text-yellow-400",   bg: "bg-yellow-400/10",    label: "Střední" },
  low:    { icon: Info,          className: "text-primary",      bg: "bg-primary/10",       label: "Nízká" },
};

const Events = () => {
  const [vehicleId, setVehicleId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7));
  const [dateTo, setDateTo] = useState(TODAY);
  const [localEvents, setLocalEvents] = useState<FleetEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { vehicles, searchQuery } = useFleetState();
  const { fetchVehicles } = useFleetActions();

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  // React to global search → auto-select matching vehicle in dropdown
  useEffect(() => {
    if (!searchQuery?.trim() || vehicles.length === 0) return;
    const q = searchQuery.toLowerCase();
    const match = vehicles.find(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, ""))
    );
    if (match) setVehicleId(match.id);
  }, [searchQuery, vehicles]);

  const dateError = validateDateRange(dateFrom, dateTo);
  const days = isValidDate(dateFrom) && isValidDate(dateTo) ? daysBetween(dateFrom, dateTo) : 0;

  const handleDateFrom = (val: string) => {
    setDateFrom(val);
    if (isValidDate(val) && isValidDate(dateTo) && val > dateTo) setDateTo(val);
  };
  const handleDateTo = (val: string) => {
    setDateTo(val);
    if (isValidDate(val) && isValidDate(dateFrom) && val < dateFrom) setDateFrom(val);
  };

  // Debounce fetch — 600ms after last change
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const doFetch = useCallback(async (code: string | undefined, from: string, to: string) => {
    if (!isValidDate(from) || !isValidDate(to) || from > to) return;
    if (vehicles.length === 0) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const vehicleCodes = vehicles.map((v) => v.id).filter(Boolean);
      const data = await getEvents(
        code,
        `${from}T00:00`,
        `${to}T23:59`,
        code ? undefined : vehicleCodes
      );
      setLocalEvents(data);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setIsLoading(false);
    }
  }, [vehicles]);

  // Fire fetch with debounce when any filter changes (but only if dates are valid)
  useEffect(() => {
    if (dateError) return;
    if (vehicles.length === 0) return;
    clearTimeout(fetchTimerRef.current);
    const code = vehicleId === "all" ? undefined : vehicleId;
    fetchTimerRef.current = setTimeout(() => doFetch(code, dateFrom, dateTo), 600);
    return () => clearTimeout(fetchTimerRef.current);
  }, [vehicleId, dateFrom, dateTo, dateError, vehicles.length, doFetch]);

  // Retry: reset to safe defaults if dates are currently invalid
  const retry = useCallback(() => {
    const safeFrom = isValidDate(dateFrom) ? dateFrom : daysAgo(7);
    const safeTo = isValidDate(dateTo) ? dateTo : TODAY;
    if (safeFrom !== dateFrom) setDateFrom(safeFrom);
    if (safeTo !== dateTo) setDateTo(safeTo);
    setLoadError(null);
    const code = vehicleId === "all" ? undefined : vehicleId;
    doFetch(code, safeFrom, safeTo);
  }, [vehicleId, dateFrom, dateTo, doFetch]);

  // Filter by date (events already tagged per vehicle)
  const filtered = useMemo(() => {
    if (dateError) return [];
    return localEvents.filter((e) => {
      if (!e.timestamp) return false;
      const d = e.timestamp.slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    });
  }, [localEvents, dateFrom, dateTo, dateError]);

  const inputClass = "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loadError && localEvents.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Události a upozornění</h1>
        <ErrorState message={loadError} onRetry={retry} />
      </div>
    );
  }

  const speedingCount = filtered.filter((e) => e.type === "speeding").length;
  const longTripCount = filtered.filter((e) => e.type === "long_trip").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Události a upozornění</h1>
        <p className="text-sm text-muted-foreground">Překročení rychlosti a dlouhé jízdy — odvozeno z dat jízd</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Filter className="h-4 w-4 text-muted-foreground mt-6 shrink-0" />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Vozidlo</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputClass}>
              <option value="all">Všechna vozidla (max 3)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Od</label>
            <input
              type="date"
              value={dateFrom}
              max={TODAY}
              onChange={(e) => handleDateFrom(e.target.value)}
              className={`${inputClass} ${dateError && !isValidDate(dateFrom) ? "border-destructive" : ""}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Do</label>
            <input
              type="date"
              value={dateTo}
              max={TODAY}
              onChange={(e) => handleDateTo(e.target.value)}
              className={`${inputClass} ${dateError && isValidDate(dateFrom) && !isValidDate(dateTo) ? "border-destructive" : ""}`}
            />
          </div>
          {!dateError && isLoading && (
            <span className="mt-6 text-xs text-muted-foreground animate-pulse">Načítám…</span>
          )}
        </div>

        {/* Date error banner */}
        {dateError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
        {!dateError && days > 0 && (
          <p className="text-xs text-muted-foreground pl-7">
            Vybrané období: {days} {days === 1 ? "den" : days < 5 ? "dny" : "dní"} · max. 30 dní
          </p>
        )}
      </div>

      {/* Summary chips */}
      {filtered.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span>{speedingCount} překročení rychlosti</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <Info className="h-4 w-4 text-primary" />
            <span>{longTripCount} dlouhých jízd</span>
          </div>
        </div>
      )}

      {/* Events list */}
      {dateError ? (
        <EmptyState
          icon={<AlertCircle className="h-10 w-10 text-destructive" />}
          title="Neplatné datum"
          description={dateError}
        />
      ) : isLoading && localEvents.length === 0 ? (
        <LoadingState message="Načítám události…" rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="Žádné události"
          description={`Pro zvolené období ${dateFrom} – ${dateTo} nebyly nalezeny žádné události. Zkuste vybrat konkrétní vozidlo nebo rozšířit datum.`}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const cfg = severityConfig[event.severity];
            const Icon = cfg.icon;
            const vehicleName =
              vehicles.find((v) => v.id === event.vehicleId)?.name ||
              event.vehicleName ||
              event.vehicleId;
            return (
              <div
                key={event.id}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 hover:border-border/60 transition-colors"
              >
                <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.className}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{vehicleName}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground leading-snug">{event.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  {event.timestamp ? new Date(event.timestamp).toLocaleString("cs-CZ") : "—"}
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
