// ─── GPS Dozor service ────────────────────────────────────────────────────────
// Responsibility: fetch from GPS Dozor API (via backend proxy) and normalize
// raw API responses into typed domain objects used by the store.
//
// Rules:
//  - No UI imports, no Pinia, no Vue reactivity
//  - All data fetching goes through httpGet() — never raw fetch()
//  - No 'as any' casts — all unknowns handled by typed coercer functions
//  - null vs undefined distinction respected throughout

import { httpGet } from "./http";
import type { FleetEvent, SpeedPoint, Trip, Vehicle, VehicleStatus } from "@/types";

/** Opaque raw API record — all fields unknown until explicitly extracted */
type RawRecord = Record<string, unknown>;

// ─── Groups ───────────────────────────────────────────────────────────────────

async function fetchGroupCodes(): Promise<string[]> {
  const groups = await httpGet<RawRecord[]>("/api/groups");
  return groups
    .map((g) => asString(g.Code) || asString(g.code))
    .filter((code): code is string => code.length > 0);
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function fetchVehicles(): Promise<Vehicle[]> {
  const codes = await fetchGroupCodes();
  if (codes.length === 0) return [];

  // Parallel fetch per group — settled so one failure doesn't block others
  const results = await Promise.allSettled(
    codes.map((code) => httpGet<RawRecord[]>("/api/vehicles", { group: code }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<RawRecord[]> => r.status === "fulfilled")
    .flatMap((r) => r.value.map(normalizeVehicle));
}

export async function fetchVehicleDetail(code: string): Promise<Vehicle> {
  const raw = await httpGet<RawRecord>(`/api/vehicle/${encodeURIComponent(code)}`);
  return normalizeVehicle(raw);
}

// ─── Trips ────────────────────────────────────────────────────────────────────

/**
 * Fetch trip history for a single vehicle (code provided) or all vehicles.
 * GPS Dozor does NOT embed VehicleCode inside trip records, so we inject it
 * during normalization.
 */
export async function fetchTrips(
  vehicleCode: string | undefined,
  from: string,
  to: string
): Promise<Trip[]> {
  const params = { from, to };

  if (vehicleCode) {
    const rows = await httpGet<RawRecord[]>("/api/trips", { code: vehicleCode, ...params });
    return rows.map((r) => normalizeTrip(r, vehicleCode));
  }

  // All vehicles — fetch in parallel
  const vehicles = await fetchVehicles();
  const results = await Promise.allSettled(
    vehicles.map((v) =>
      httpGet<RawRecord[]>("/api/trips", { code: v.code, ...params })
        .then((rows) => rows.map((r) => normalizeTrip(r, v.code)))
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Trip[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Derive events from trip data (speeding + long trips).
 * Accepts pre-fetched vehicle codes from the store to avoid a redundant API call.
 */
export async function fetchEvents(
  vehicleCode: string | undefined,
  from: string,
  to: string,
  allVehicleCodes?: string[]
): Promise<FleetEvent[]> {
  if (vehicleCode) {
    const rows = await httpGet<RawRecord[]>("/api/trips", { code: vehicleCode, from, to });
    return deriveEvents(rows.map((r) => normalizeTrip(r, vehicleCode)));
  }

  // Limit to 3 vehicles to avoid hammering the API
  const codes = (allVehicleCodes ?? []).slice(0, 3);
  if (codes.length === 0) return [];

  const results = await Promise.allSettled(
    codes.map((code) =>
      httpGet<RawRecord[]>("/api/trips", { code, from, to })
        .then((rows) => rows.map((r) => normalizeTrip(r, code)))
    )
  );

  const trips = results
    .filter((r): r is PromiseFulfilledResult<Trip[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  return deriveEvents(trips);
}

// ─── Speed chart ──────────────────────────────────────────────────────────────

export async function fetchSpeedChart(
  vehicleCode: string | undefined,
  from: string,
  to: string,
  binHours: number
): Promise<SpeedPoint[]> {
  if (!vehicleCode) return [];
  const trips = await fetchTrips(vehicleCode, from, to);
  return buildSpeedChart(trips, binHours);
}

// ─── Event derivation ─────────────────────────────────────────────────────────

function deriveEvents(trips: Trip[]): FleetEvent[] {
  const events: FleetEvent[] = [];

  for (const trip of trips) {
    if (!trip.startTime) continue;

    if (trip.maxSpeed > 110) {
      events.push({
        id:          `${trip.vehicleId}-spd-${trip.startTime}`,
        vehicleId:   trip.vehicleId,
        vehicleName: trip.vehicleName,
        driver:      trip.driver,
        type:        "speeding",
        message:     `Max rychlost ${trip.maxSpeed} km/h — ${trip.startLocation || "neznámá poloha"}`,
        timestamp:   trip.startTime,
        severity:    trip.maxSpeed > 130 ? "high" : "medium",
        lat:         trip.startLat,
        lng:         trip.startLng,
      });
    }

    if (trip.distance > 300) {
      events.push({
        id:          `${trip.vehicleId}-long-${trip.startTime}`,
        vehicleId:   trip.vehicleId,
        vehicleName: trip.vehicleName,
        driver:      trip.driver,
        type:        "long_trip",
        message:     `Dlouhá jízda: ${trip.distance.toFixed(0)} km (${trip.startLocation || "?"} → ${trip.endLocation || "?"})`,
        timestamp:   trip.startTime,
        severity:    "low",
        lat:         trip.startLat,
        lng:         trip.startLng,
      });
    }
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Speed chart aggregation ──────────────────────────────────────────────────

/**
 * Aggregate per-trip average speeds into time bins spanning 00:00 → last active hour.
 * Empty bins are filled with speed = 0 so the chart line stays continuous.
 */
function buildSpeedChart(trips: Trip[], binHours: number): SpeedPoint[] {
  const bh = Math.max(1, Math.min(binHours, 12));
  const bins = new Map<number, { sum: number; count: number }>();

  for (const trip of trips) {
    if (!trip.startTime || trip.avgSpeed === 0) continue;
    const hour     = new Date(trip.startTime).getHours();
    const binStart = Math.floor(hour / bh) * bh;
    const prev     = bins.get(binStart) ?? { sum: 0, count: 0 };
    bins.set(binStart, { sum: prev.sum + trip.avgSpeed, count: prev.count + 1 });
  }

  if (bins.size === 0) return [];

  const lastBin = Math.max(...bins.keys());
  const result: SpeedPoint[] = [];

  for (let h = 0; h <= lastBin; h += bh) {
    const entry = bins.get(h);
    result.push({
      time:  `${String(h).padStart(2, "0")}:00`,
      speed: entry ? Math.round(entry.sum / entry.count) : 0,
    });
  }

  return result;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeVehicle(raw: RawRecord): Vehicle {
  const code = asString(raw.Code) || asString(raw.code);
  const pos  = asRecord(raw.LastPosition ?? raw.lastPosition);

  return {
    id:   code,
    code,
    name: asString(raw.Name) || asString(raw.name) || `Vozidlo ${code}`,
    plate: asString(raw.SPZ) || asString(raw.spz) || asString(raw.plate),
    status: deriveStatus(raw),
    speed:  asNumber(raw.Speed) || asNumber(raw.speed),
    lat:    pos ? asNumber(pos.Latitude)  || asNumber(pos.latitude)  : 0,
    lng:    pos ? asNumber(pos.Longitude) || asNumber(pos.longitude) : 0,
    lastUpdate:
      asString(raw.LastPositionTimestamp) ||
      asString(raw.lastPositionTimestamp) ||
      new Date().toISOString(),
    // GPS Dozor: DriverName is present on some plans / vehicle types
    driver:    asString(raw.DriverName) || asString(raw.driverName) || null,
    // Odometer is returned in meters — convert to km
    odometer:  Math.round((asNumber(raw.Odometer) || asNumber(raw.odometer)) / 1000),
    fuelLevel: null,  // Not available in GPS Dozor standard plan
    ignition:  asNumber(raw.Speed) > 0 || asBoolean(raw.ignition),
  };
}

function normalizeTrip(raw: RawRecord, vehicleCode: string): Trip {
  const startTime = asString(raw.StartTime)  || asString(raw.startTime);
  const startPos  = asRecord(raw.StartPosition  ?? raw.startPosition);
  const finishPos = asRecord(raw.FinishPosition ?? raw.finishPosition);

  return {
    id:          `${vehicleCode}-${startTime || String(Date.now())}`,
    vehicleId:   vehicleCode,
    // GPS Dozor does not return VehicleName in trip records — set to code,
    // components resolve the display name from the vehicles list in the store.
    vehicleName: vehicleCode,
    // DriverName is present at trip level — shows who drove this specific trip
    driver:      asString(raw.DriverName) || asString(raw.driverName) || null,
    startTime,
    endTime:        asString(raw.FinishTime)    || asString(raw.endTime),
    startLocation:  asString(raw.StartAddress)  || asString(raw.startAddress),
    endLocation:    asString(raw.FinishAddress)  || asString(raw.finishAddress),
    startLat: startPos  ? asNumber(startPos.Latitude)   || asNumber(startPos.latitude)   : 0,
    startLng: startPos  ? asNumber(startPos.Longitude)  || asNumber(startPos.longitude)  : 0,
    endLat:   finishPos ? asNumber(finishPos.Latitude)  || asNumber(finishPos.latitude)  : 0,
    endLng:   finishPos ? asNumber(finishPos.Longitude) || asNumber(finishPos.longitude) : 0,
    distance: asNumber(raw.TotalDistance) || asNumber(raw.distanceKm),
    duration: parseTripLength(asString(raw.TripLength)) || asNumber(raw.durationMin),
    maxSpeed: asNumber(raw.MaxSpeed)      || asNumber(raw.maxSpeedKph),
    avgSpeed: asNumber(raw.AverageSpeed)  || asNumber(raw.avgSpeedKph),
  };
}

function deriveStatus(raw: RawRecord): VehicleStatus {
  const speed = asNumber(raw.Speed) || asNumber(raw.speed);
  if (speed > 5) return "moving";

  const ts     = asString(raw.LastPositionTimestamp) || asString(raw.lastPositionTimestamp);
  const ageMin = ts ? (Date.now() - new Date(ts).getTime()) / 60_000 : Infinity;
  return ageMin > 30 ? "offline" : "idle";
}

/**
 * Parse GPS Dozor TripLength format "HH:MM" or " HH:MM" into minutes.
 * Returns 0 for any unrecognised format — never throws.
 */
function parseTripLength(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
}

// ─── Type coercers ────────────────────────────────────────────────────────────
// Replace 'as any' casts with explicit, null-safe converters.

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (typeof v === "string") { const n = Number(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function asBoolean(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function asRecord(v: unknown): RawRecord | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as RawRecord)
    : null;
}
