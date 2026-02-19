import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useFleetState, useFleetActions } from "@/store/FleetStore";
import { Download, Filter, Clock, AlertCircle } from "lucide-react";
import SpeedChart from "@/components/SpeedChart";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import {
  TODAY,
  daysAgo,
  daysBetween,
  isValidDate,
  calcBinHours,
  validateDateRange,
} from "@/utils/dateUtils";

const TripHistory = () => {
  // Default: last 7 days, but capped so it's never > 30 days
  const [vehicleId, setVehicleId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7));
  const [dateTo, setDateTo] = useState(TODAY);

  const { vehicles, trips, speedChart, loading, error } = useFleetState();
  const { fetchVehicles, fetchTrips, fetchSpeedChart } = useFleetActions();

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const binHours = useMemo(
    () => (isValidDate(dateFrom) && isValidDate(dateTo) ? calcBinHours(dateFrom, dateTo) : 1),
    [dateFrom, dateTo]
  );

  const dateError = validateDateRange(dateFrom, dateTo);

  // Debounce fetch — wait 600ms after last change before firing API
  // This prevents mid-typing (year "0020") from reaching the API
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const doFetch = useCallback(
    (code: string | undefined, from: string, to: string, bin: number) => {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = setTimeout(() => {
        const fromDT = `${from}T00:00`;
        const toDT = `${to}T23:59`;
        fetchTrips(code, fromDT, toDT);
        if (code) fetchSpeedChart(code, fromDT, toDT, bin);
      }, 600);
    },
    [fetchTrips, fetchSpeedChart]
  );

  useEffect(() => {
    if (dateError) return; // don't fetch while dates are invalid
    const code = vehicleId === "all" ? undefined : vehicleId;
    doFetch(code, dateFrom, dateTo, binHours);
    return () => clearTimeout(fetchTimerRef.current);
  }, [vehicleId, dateFrom, dateTo, binHours, dateError, doFetch]);

  const handleDateFrom = (val: string) => {
    setDateFrom(val);
    // Auto-push dateTo forward if from > to (only if both are valid)
    if (isValidDate(val) && isValidDate(dateTo) && val > dateTo) {
      setDateTo(val);
    }
  };

  const handleDateTo = (val: string) => {
    setDateTo(val);
    if (isValidDate(val) && isValidDate(dateFrom) && val < dateFrom) {
      setDateFrom(val);
    }
  };

  // Retry: reset dates to safe defaults if currently invalid
  const retry = useCallback(() => {
    const safeFrom = isValidDate(dateFrom) ? dateFrom : daysAgo(7);
    const safeTo = isValidDate(dateTo) ? dateTo : TODAY;
    if (safeFrom !== dateFrom) setDateFrom(safeFrom);
    if (safeTo !== dateTo) setDateTo(safeTo);
    const code = vehicleId === "all" ? undefined : vehicleId;
    doFetch(code, safeFrom, safeTo, binHours);
  }, [vehicleId, dateFrom, dateTo, binHours, doFetch]);

  // Filter trips by vehicle AND date
  const filtered = useMemo(() => {
    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) return [];
    return trips.filter((t) => {
      if (vehicleId !== "all" && t.vehicleId !== vehicleId) return false;
      if (!t.startTime) return false;
      const d = t.startTime.slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    });
  }, [trips, vehicleId, dateFrom, dateTo]);

  const exportCSV = () => {
    const bom = "\uFEFF";
    const header = "Vozidlo,Začátek,Konec,Odkud,Kam,Vzdálenost (km),Prům. rychlost,Max rychlost\n";
    const rows = filtered.map((t) => {
      const name = vehicles.find((v) => v.id === t.vehicleId)?.name || t.vehicleId;
      return `"${name}","${t.startTime}","${t.endTime}","${t.startLocation}","${t.endLocation}",${t.distance?.toFixed(1)},${t.avgSpeed},${t.maxSpeed}`;
    }).join("\n");
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jizdy-${vehicleId}-${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedVehicle = vehicleId !== "all" ? vehicles.find((v) => v.id === vehicleId) : null;
  const showChart = vehicleId !== "all";
  const days = isValidDate(dateFrom) && isValidDate(dateTo) ? daysBetween(dateFrom, dateTo) : 0;

  const inputClass = "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const errorInputClass = "border-destructive focus:ring-destructive";

  const tripCountLabel = (n: number) =>
    n === 1 ? "1 jízda" : n < 5 ? `${n} jízdy` : `${n} jízd`;

  if (error && trips.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Historie jízd</h1>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Historie jízd</h1>
          <p className="text-sm text-muted-foreground">Přehled jízd vašich vozidel</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Filter className="h-4 w-4 text-muted-foreground mt-6 shrink-0" />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Vozidlo</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputClass}>
              <option value="all">Všechna vozidla</option>
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
              className={`${inputClass} ${dateError && !isValidDate(dateFrom) ? errorInputClass : ""}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Do</label>
            <input
              type="date"
              value={dateTo}
              max={TODAY}
              onChange={(e) => handleDateTo(e.target.value)}
              className={`${inputClass} ${dateError && isValidDate(dateFrom) && !isValidDate(dateTo) ? errorInputClass : ""}`}
            />
          </div>
          {!dateError && loading.trips && (
            <span className="mt-6 text-xs text-muted-foreground animate-pulse">Načítám…</span>
          )}
        </div>

        {/* Date range error / info */}
        {dateError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
        {!dateError && days > 0 && (
          <p className="text-xs text-muted-foreground pl-7">
            Vybrané období: {days} {days === 1 ? "den" : days < 5 ? "dny" : "dní"}
            {" · "}max. 30 dní
          </p>
        )}
      </div>

      {/* Speed Chart — only for a single vehicle */}
      {showChart && !dateError && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">
                Průměrná rychlost podle {binHours === 1 ? "hodiny" : `${binHours}h bloku`}
                {selectedVehicle && (
                  <span className="ml-2 font-normal text-muted-foreground">— {selectedVehicle.name}</span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {days} {days === 1 ? "den" : "dní"} · {binHours}h {binHours === 1 ? "skupiny" : "bloky"} · každý bod = průměr za {binHours}h
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{tripCountLabel(filtered.length)}</span>
          </div>
          <div className="h-56">
            {loading.speedChart ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">Načítám graf…</div>
            ) : speedChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Žádná data pro vybrané období</div>
            ) : (
              <SpeedChart data={speedChart} />
            )}
          </div>
        </div>
      )}

      {/* Trips table */}
      {dateError ? (
        <EmptyState
          icon={<AlertCircle className="h-10 w-10 text-destructive" />}
          title="Neplatné datum"
          description={dateError}
        />
      ) : loading.trips && trips.length === 0 ? (
        <LoadingState message="Načítám jízdy…" rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-10 w-10" />}
          title="Žádné jízdy"
          description={
            vehicleId !== "all"
              ? `Pro "${selectedVehicle?.name ?? vehicleId}" a období ${dateFrom} – ${dateTo} nebyly nalezeny žádné jízdy.`
              : `Pro období ${dateFrom} – ${dateTo} nebyly nalezeny žádné jízdy.`
          }
        />
      ) : (
        <>
          {!showChart && (
            <p className="text-sm text-muted-foreground px-1">{tripCountLabel(filtered.length)}</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Vozidlo</th>
                  <th className="px-4 py-3 font-medium">Začátek</th>
                  <th className="px-4 py-3 font-medium">Odkud → Kam</th>
                  <th className="px-4 py-3 font-medium">Vzdálenost</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Doba</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Prům. / Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((t) => {
                  const vehicleName = vehicles.find((v) => v.id === t.vehicleId)?.name || t.vehicleId;
                  return (
                    <tr key={t.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{vehicleName}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {t.startTime ? new Date(t.startTime).toLocaleString("cs-CZ") : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-xs text-muted-foreground truncate" title={t.startLocation || undefined}>
                          {t.startLocation || `${t.startLat?.toFixed(4)}, ${t.startLng?.toFixed(4)}` || "—"}
                        </div>
                        <div className="text-xs flex items-center gap-1">
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate" title={t.endLocation || undefined}>
                            {t.endLocation || `${t.endLat?.toFixed(4)}, ${t.endLng?.toFixed(4)}` || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {t.distance ? `${t.distance.toFixed(1)} km` : "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground whitespace-nowrap md:table-cell">
                        {t.duration ? `${t.duration} min` : "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground whitespace-nowrap lg:table-cell">
                        {(t.avgSpeed || t.maxSpeed) ? `${t.avgSpeed} / ${t.maxSpeed} km/h` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default TripHistory;
