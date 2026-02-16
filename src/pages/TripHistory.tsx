import { useState, useEffect, useMemo } from "react";
import { type Vehicle, type Trip } from "@/data/mockData";
import { getVehicles, getTripHistory, getSpeedChartData } from "@/services/dozorApi";
import { Download, Filter } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Filler,
} from "chart.js";
import { Line as LineChart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler);

const TripHistory = () => {
  const [vehicleId, setVehicleId] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-02-15");
  const [dateTo, setDateTo] = useState("2026-02-16");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [speedChartData, setSpeedChartData] = useState<{ time: string; speed: number }[]>([]);

  useEffect(() => {
    getVehicles().then(setVehicles);
    getTripHistory().then(setTrips);
    getSpeedChartData().then(setSpeedChartData);
  }, []);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      if (vehicleId !== "all" && t.vehicleId !== vehicleId) return false;
      const d = t.startTime.slice(0, 10);
      if (d < dateFrom || d > dateTo) return false;
      return true;
    });
  }, [vehicleId, dateFrom, dateTo]);

  const exportCSV = () => {
    const header = "Vozidlo,Začátek,Konec,Odkud,Kam,Vzdálenost (km),Prům. rychlost,Max rychlost\n";
    const rows = filtered
      .map(
        (t) =>
          `${t.vehicleName},${t.startTime},${t.endTime},${t.startLocation},${t.endLocation},${t.distance},${t.avgSpeed},${t.maxSpeed}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historie-jizd.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass =
    "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const inputClass = selectClass;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historie jízd</h1>
          <p className="text-sm text-muted-foreground">
            Přehled jízd vašich vozidel
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
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
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Do</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Speed chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Rychlost v průběhu dne (ukázková data)
        </h3>
        <div className="h-72">
          <LineChart
            data={{
              labels: (speedChartData ?? []).map((d) => d.time),
              datasets: [
                {
                  label: "Rychlost (km/h)",
                  data: (speedChartData ?? []).map((d) => d.speed),
                  borderColor: "hsl(199,89%,48%)",
                  backgroundColor: "hsla(199,89%,48%,0.1)",
                  fill: true,
                  tension: 0.3,
                  pointRadius: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  ticks: { color: "hsl(215,20%,65%)" },
                  grid: { color: "hsl(217,33%,25%)" },
                },
                x: {
                  ticks: { color: "hsl(215,20%,65%)" },
                  grid: { color: "hsl(217,33%,25%)" },
                },
              },
              plugins: {
                tooltip: {
                  backgroundColor: "hsl(217,33%,17%)",
                  borderColor: "hsl(217,33%,25%)",
                  borderWidth: 1,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Trips table */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
          Žádné jízdy pro vybrané filtry
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Vozidlo</th>
                <th className="px-4 py-3 font-medium">Začátek</th>
                <th className="px-4 py-3 font-medium">Odkud → Kam</th>
                <th className="px-4 py-3 font-medium">Vzdálenost</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Doba</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Prům. / Max</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border/50 hover:bg-secondary/50"
                >
                  <td className="px-4 py-3 font-medium">{t.vehicleName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.startTime).toLocaleString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{t.startLocation}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    {t.endLocation}
                  </td>
                  <td className="px-4 py-3">{t.distance} km</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {t.duration} min
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {t.avgSpeed} / {t.maxSpeed} km/h
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

export default TripHistory;
