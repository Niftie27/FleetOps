import type { FleetEvent, SpeedPoint, Trip, Vehicle } from "@/types/fleet";

type DozorObject = Record<string, unknown>;

const LIVE_DATA_SOURCE = "live" as const;
let _lastDataSource = LIVE_DATA_SOURCE;
export const getDataSource = () => _lastDataSource;

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

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

export const getGroups = async (): Promise<DozorObject[]> => backendGet("/api/groups");

// ─── Vehicles ───────────────────────────────────────────
export const getVehicles = async (): Promise<Vehicle[]> => {
  const groups = await getGroups();
  const codes = groups
    .map((g) => str(g.code) || str(g.groupCode) || str(g.id))
    .filter(Boolean);

  const perGroup = await Promise.all(
    codes.map((code) => backendGet<DozorObject[]>("/api/vehicles", { group: code }))
  );
  return perGroup.flat().map(normalizeVehicle);
};

// ─── Live positions ─────────────────────────────────────
export const getVehicle = async (code: string): Promise<Vehicle> => {
  const raw = await backendGet<DozorObject>(`/api/vehicle/${encodeURIComponent(code)}`);
  return normalizeVehicle(raw);
};

// ─── Trip history ───────────────────────────────────────
export const getTripHistory = async (code?: string, from?: string, to?: string): Promise<Trip[]> => {
  if (code) {
    const rows = await backendGet<DozorObject[]>("/api/trips", compactParams({ code, from, to }));
    return rows.map(normalizeTrip);
  }

  const vehicles = await getVehicles();
  const codes = vehicles.map((v) => v.code).filter(Boolean);
  const allTrips = await Promise.all(
    codes.map((vehicleCode) => backendGet<DozorObject[]>("/api/trips", compactParams({ code: vehicleCode, from, to })))
  );
  return allTrips.flat().map(normalizeTrip);
};

// ─── Events ─────────────────────────────────────────────
export const getEvents = async (vehicleCode?: string, from?: string, to?: string): Promise<FleetEvent[]> => {
  const vehicles = await getVehicles();
  const codes = vehicleCode ? [vehicleCode] : vehicles.map((v) => v.code).filter(Boolean);
  if (codes.length === 0) return [];

  const historyRows = await backendGet<DozorObject[]>("/api/history", compactParams({ codes: codes.join(","), from, to }));
  return historyRows
    .filter((row) => row.event || row.eventType || row.message)
    .map((row, idx) => normalizeEvent(row, vehicles, idx));
};

// ─── Speed chart ────────────────────────────────────────
export const getSpeedChartData = async (code?: string, from?: string, to?: string): Promise<SpeedPoint[]> => {
  const trips = await getTripHistory(code, from, to);
  return buildSpeedChart(trips);
};

// ─── Normalizers ────────────────────────────────────────
function compactParams(params: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v));
}

function normalizeVehicle(raw: DozorObject): Vehicle {
  const code = str(raw.code) || str(raw.id);
  return {
    id: code,
    code,
    name: str(raw.name) || str(raw.title) || `Vehicle ${code}`,
    plate: str(raw.plate) || str(raw.licensePlate),

    status: deriveStatus(raw),
    speed: num(raw.speed) || num(raw.speedKph),
    lat: num(raw.lat) || num(raw.latitude) || num(raw.gpsLat),
    lng: num(raw.lng) || num(raw.longitude) || num(raw.gpsLng),
    lastUpdate: str(raw.timestamp) || str(raw.lastUpdate) || new Date().toISOString(),
    driver: str(raw.driver) || str(raw.driverName),
    fuelLevel: num(raw.fuelLevel) || num(raw.fuel),
    ignition: bool(raw.ignition) || bool(raw.acc),
    odometer: num(raw.odometer) || num(raw.mileage),
  };
}

function normalizeTrip(raw: DozorObject): Trip {
  const code = str(raw.vehicleCode) || str(raw.code) || str(raw.vehicleId);
  const startTime = str(raw.startTime) || str(raw.from);
  return {
    id: str(raw.id) || `${code || "trip"}-${startTime || Date.now()}`,
    vehicleId: code,
    vehicleName: str(raw.vehicleName) || str(raw.name),
    startTime,
    endTime: str(raw.endTime) || str(raw.to),
    startLocation: str(raw.startLocation) || str(raw.startAddress),
    endLocation: str(raw.endLocation) || str(raw.endAddress),
    startLat: num(raw.startLat) || num(raw.startLatitude) || num(raw.fromLat),
    startLng: num(raw.startLng) || num(raw.startLongitude) || num(raw.fromLng),
    endLat: num(raw.endLat) || num(raw.endLatitude) || num(raw.toLat),
    endLng: num(raw.endLng) || num(raw.endLongitude) || num(raw.toLng),
    distance: num(raw.distanceKm) || num(raw.distance),
    duration: num(raw.durationMin) || num(raw.duration),
    maxSpeed: num(raw.maxSpeedKph) || num(raw.maxSpeed),
    avgSpeed: num(raw.avgSpeedKph) || num(raw.avgSpeed),
  };
}

function normalizeEvent(raw: DozorObject, vehicles: Vehicle[], idx: number): FleetEvent {
  const code = str(raw.vehicleCode) || str(raw.code) || str(raw.vehicleId);
  const vehicle = vehicles.find((v) => v.code === code || v.id === code);
  return {
    id: str(raw.id) || `${code}-${idx}`,
    vehicleId: code,
    vehicleName: str(raw.vehicleName) || vehicle?.name || code,
    type: str(raw.eventType) || str(raw.event) || "event",
    message: str(raw.message) || str(raw.description) || str(raw.eventType) || "Event",
    timestamp: str(raw.timestamp) || str(raw.time) || new Date().toISOString(),
    severity: deriveSeverity(raw),
    lat: num(raw.lat) || num(raw.latitude),
    lng: num(raw.lng) || num(raw.longitude),
  };
}

function normalizeEvent(raw: DozorObject, vehicles: Vehicle[], idx: number): FleetEvent {
  const code = str(raw.vehicleCode) || str(raw.code) || str(raw.vehicleId);
  const vehicle = vehicles.find((v) => v.code === code || v.id === code);
  return {
    id: str(raw.id) || `${code}-${idx}`,
    vehicleId: code,
    vehicleName: str(raw.vehicleName) || vehicle?.name || code,
    type: str(raw.eventType) || str(raw.event) || "event",
    message: str(raw.message) || str(raw.description) || str(raw.eventType) || "Event",
    timestamp: str(raw.timestamp) || str(raw.time) || new Date().toISOString(),
    severity: deriveSeverity(raw),
    lat: num(raw.lat) || num(raw.latitude),
    lng: num(raw.lng) || num(raw.longitude),
  };
}

function deriveStatus(raw: DozorObject): Vehicle["status"] {
  const status = str(raw.status).toLowerCase();
  if (["moving", "drive", "driving"].includes(status)) return "moving";
  if (["idle", "stop", "stopped"].includes(status)) return "idle";
  if (status) return "offline";
  if (num(raw.speed) > 0) return "moving";
  if (bool(raw.ignition) || bool(raw.acc)) return "idle";
  return "offline";
}

function deriveSeverity(raw: DozorObject): FleetEvent["severity"] {
  const value = (str(raw.severity) || str(raw.level) || str(raw.priority)).toLowerCase();
  if (["high", "critical", "3"].includes(value)) return "high";
  if (["medium", "warning", "2"].includes(value)) return "medium";
  return "low";
}

function buildSpeedChart(trips: Trip[]): SpeedPoint[] {
  const byHour = new Map<string, { sum: number; count: number }>();
  for (const trip of trips) {
    if (!trip.startTime) continue;
    const key = new Date(trip.startTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    const prev = byHour.get(key) ?? { sum: 0, count: 0 };
    byHour.set(key, { sum: prev.sum + trip.avgSpeed, count: prev.count + 1 });
  }

  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, agg]) => ({ time, speed: Math.round(agg.sum / agg.count) }));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0;
}

function bool(v: unknown): boolean {
  return typeof v === "boolean" ? v : v === "true" || v === 1 || v === "1";
}
