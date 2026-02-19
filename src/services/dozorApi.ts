import type { FleetEvent, SpeedPoint, Trip, Vehicle } from "@/types/fleet";

type DozorObject = Record<string, unknown>;

const LIVE_DATA_SOURCE = "live" as const;
let _lastDataSource = LIVE_DATA_SOURCE;
export const getDataSource = () => _lastDataSource;

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// ─── HTTP ────────────────────────────────────────────────
async function backendGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${API_BASE}${path}${qs}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  _lastDataSource = LIVE_DATA_SOURCE;
  return res.json() as Promise<T>;
}

// ─── Groups ──────────────────────────────────────────────
export const getGroups = async (): Promise<DozorObject[]> => backendGet("/api/groups");

// ─── Vehicles ────────────────────────────────────────────
export const getVehicles = async (): Promise<Vehicle[]> => {
  const groups = await getGroups();
  const codes = groups.map((g) => str(g.Code) || str(g.code)).filter(Boolean);
  if (codes.length === 0) return [];

  const results = await Promise.allSettled(
    codes.map((code) => backendGet<DozorObject[]>("/api/vehicles", { group: code }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<DozorObject[]> => r.status === "fulfilled")
    .flatMap((r) => r.value.map(normalizeVehicle));
};

// ─── Single vehicle ───────────────────────────────────────
export const getVehicle = async (code: string): Promise<Vehicle> => {
  const raw = await backendGet<DozorObject>(`/api/vehicle/${encodeURIComponent(code)}`);
  return normalizeVehicle(raw);
};

// ─── Trips ────────────────────────────────────────────────
// NOTE: GPS Dozor does NOT return VehicleCode inside trip records.
// vehicleCode is always injected at fetch time.
export const getTripHistory = async (vehicleCode?: string, from?: string, to?: string): Promise<Trip[]> => {
  if (vehicleCode) {
    const rows = await backendGet<DozorObject[]>("/api/trips", compactParams({ code: vehicleCode, from, to }));
    return rows.map((r) => normalizeTrip(r, vehicleCode));
  }

  // All vehicles — fetch in parallel per vehicle
  const vehicles = await getVehicles();
  const codes = vehicles.map((v) => v.code).filter(Boolean);

  const results = await Promise.allSettled(
    codes.map((code) =>
      backendGet<DozorObject[]>("/api/trips", compactParams({ code, from, to }))
        .then((rows) => rows.map((r) => normalizeTrip(r, code)))
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Trip[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
};

// ─── Events ───────────────────────────────────────────────
// Derived from trip data. Accepts pre-fetched vehicle codes to avoid
// calling getVehicles() again (callers pass codes from store).
export const getEvents = async (
  vehicleCode?: string,
  from?: string,
  to?: string,
  allVehicleCodes?: string[]
): Promise<FleetEvent[]> => {
  if (vehicleCode) {
    const rows = await backendGet<DozorObject[]>("/api/trips", compactParams({ code: vehicleCode, from, to }));
    const trips = rows.map((r) => normalizeTrip(r, vehicleCode));
    return deriveEventsFromTrips(trips);
  }

  const codes = allVehicleCodes?.slice(0, 3) ?? [];
  if (codes.length === 0) return [];

  const results = await Promise.allSettled(
    codes.map((code) =>
      backendGet<DozorObject[]>("/api/trips", compactParams({ code, from, to }))
        .then((rows) => rows.map((r) => normalizeTrip(r, code)))
    )
  );
  const allTrips = results
    .filter((r): r is PromiseFulfilledResult<Trip[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  return deriveEventsFromTrips(allTrips);
};

// ─── Speed chart ──────────────────────────────────────────
// Only called for a single vehicle (chart is hidden for "all vehicles").
export const getSpeedChartData = async (
  vehicleCode: string | undefined,
  from?: string,
  to?: string,
  binHours = 1
): Promise<SpeedPoint[]> => {
  if (!vehicleCode) return [];
  const trips = await getTripHistory(vehicleCode, from, to);
  return buildSpeedChart(trips, binHours);
};

// ─── Normalizers ─────────────────────────────────────────

function compactParams(params: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))
  );
}

function normalizeVehicle(raw: DozorObject): Vehicle {
  const code = str(raw.Code) || str(raw.code);
  const lastPos = (raw.LastPosition ?? raw.lastPosition) as DozorObject | undefined;

  return {
    id: code,
    code,
    name: str(raw.Name) || str(raw.name) || `Vozidlo ${code}`,
    plate: str(raw.SPZ) || str(raw.spz) || str(raw.plate),
    status: deriveVehicleStatus(raw),
    speed: num(raw.Speed) || num(raw.speed),
    lat: lastPos ? num(lastPos.Latitude) || num(lastPos.latitude) : 0,
    lng: lastPos ? num(lastPos.Longitude) || num(lastPos.longitude) : 0,
    lastUpdate: str(raw.LastPositionTimestamp) || str(raw.lastPositionTimestamp) || new Date().toISOString(),
    driver: str(raw.DriverName) || str(raw.driverName),
    fuelLevel: num(raw.BatteryPercentage) || num(raw.fuelLevel),
    ignition: num(raw.Speed) > 0 || bool(raw.ignition),
    odometer: Math.round((num(raw.Odometer) || num(raw.odometer)) / 1000),
  };
}

function normalizeTrip(raw: DozorObject, vehicleCode: string): Trip {
  const startTime = str(raw.StartTime) || str(raw.startTime);
  const startPos = (raw.StartPosition ?? raw.startPosition) as DozorObject | undefined;
  const finishPos = (raw.FinishPosition ?? raw.finishPosition) as DozorObject | undefined;

  return {
    id: `${vehicleCode}-${startTime || Date.now()}`,
    vehicleId: vehicleCode,
    vehicleName: str(raw.DriverName) || vehicleCode,
    startTime,
    endTime: str(raw.FinishTime) || str(raw.endTime),
    startLocation: str(raw.StartAddress) || str(raw.startAddress),
    endLocation: str(raw.FinishAddress) || str(raw.finishAddress),
    startLat: startPos ? num(startPos.Latitude) || num(startPos.latitude) : 0,
    startLng: startPos ? num(startPos.Longitude) || num(startPos.longitude) : 0,
    endLat: finishPos ? num(finishPos.Latitude) || num(finishPos.latitude) : 0,
    endLng: finishPos ? num(finishPos.Longitude) || num(finishPos.longitude) : 0,
    distance: num(raw.TotalDistance) || num(raw.distanceKm),
    duration: parseTripLength(str(raw.TripLength)) || num(raw.durationMin),
    maxSpeed: num(raw.MaxSpeed) || num(raw.maxSpeedKph),
    avgSpeed: num(raw.AverageSpeed) || num(raw.avgSpeedKph),
  };
}

function deriveEventsFromTrips(trips: Trip[]): FleetEvent[] {
  const events: FleetEvent[] = [];
  for (const trip of trips) {
    if (!trip.startTime) continue;
    if (trip.maxSpeed > 110) {
      events.push({
        id: `${trip.vehicleId}-spd-${trip.startTime}`,
        vehicleId: trip.vehicleId,
        vehicleName: trip.vehicleName || trip.vehicleId,
        type: "speeding",
        message: `Max rychlost ${trip.maxSpeed} km/h — ${trip.startLocation || "neznámá poloha"}`,
        timestamp: trip.startTime,
        severity: trip.maxSpeed > 130 ? "high" : "medium",
        lat: trip.startLat,
        lng: trip.startLng,
      });
    }
    if (trip.distance > 300) {
      events.push({
        id: `${trip.vehicleId}-long-${trip.startTime}`,
        vehicleId: trip.vehicleId,
        vehicleName: trip.vehicleName || trip.vehicleId,
        type: "long_trip",
        message: `Dlouhá jízda: ${trip.distance.toFixed(0)} km (${trip.startLocation || "?"} → ${trip.endLocation || "?"})`,
        timestamp: trip.startTime,
        severity: "low",
        lat: trip.startLat,
        lng: trip.startLng,
      });
    }
  }
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Status ───────────────────────────────────────────────
function deriveVehicleStatus(raw: DozorObject): Vehicle["status"] {
  const speed = num(raw.Speed) || num(raw.speed);
  if (speed > 5) return "moving";
  const ts = str(raw.LastPositionTimestamp) || str(raw.lastPositionTimestamp);
  if (ts) {
    const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000;
    if (ageMin > 30) return "offline";
  }
  return "idle";
}

// ─── Speed chart ──────────────────────────────────────────
// Groups trip avgSpeed into bins of `binHours` width.
// ALWAYS emits all bins from 00:00 to 23:00 (or last hour with data).
// Empty bins get speed=0 so the x-axis stays continuous.
//
// Why: If binHours=1 and trips only happened at 07:00, 11:00, 18:00,
// the chart should still show a full axis (00:00…23:00) not just 3 points.
// Empty-hour bins show 0 so the shape is readable and the axis makes sense.
function buildSpeedChart(trips: Trip[], binHours: number): SpeedPoint[] {
  const bh = Math.max(1, Math.min(binHours, 12)); // clamp 1–12h

  // Aggregate real data
  const byBin = new Map<number, { sum: number; count: number }>();
  for (const trip of trips) {
    if (!trip.startTime || !trip.avgSpeed) continue;
    const d = new Date(trip.startTime);
    const binStart = Math.floor(d.getHours() / bh) * bh;
    const prev = byBin.get(binStart) ?? { sum: 0, count: 0 };
    byBin.set(binStart, { sum: prev.sum + trip.avgSpeed, count: prev.count + 1 });
  }

  if (byBin.size === 0) return [];

  // Find the last hour that has data so we don't render a huge empty tail
  const maxHourWithData = Math.max(...byBin.keys());
  // Round up to next full bin boundary
  const lastBin = Math.floor(maxHourWithData / bh) * bh;

  // Emit all bins from 00:00 up to lastBin
  const result: SpeedPoint[] = [];
  for (let h = 0; h <= lastBin; h += bh) {
    const entry = byBin.get(h);
    const label = `${String(h).padStart(2, "0")}:00`;
    result.push({
      time: label,
      speed: entry ? Math.round(entry.sum / entry.count) : 0,
    });
  }

  return result;
}

// ─── TripLength parser ────────────────────────────────────
function parseTripLength(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length !== 2) return 0;
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// ─── Primitive helpers ────────────────────────────────────
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}
