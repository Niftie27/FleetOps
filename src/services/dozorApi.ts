import {
  vehicles as mockVehicles,
  trips as mockTrips,
  events as mockEvents,
  speedChartData as mockSpeedChart,
  type Vehicle,
  type Trip,
  type FleetEvent,
} from "@/data/mockData";

const FUNCTION_NAME = "dozor-proxy";

async function proxyGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params
    ? "?" + new URLSearchParams(params).toString()
    : "";

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}${path}${qs}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`dozor-proxy ${path} error [${res.status}]:`, body);
    throw new Error(`API error ${res.status}`);
  }

  return res.json();
}

export const isConfigured = () => {
  // With edge functions the credentials are server-side,
  // so the proxy is always "configured" when Cloud is enabled
  return Boolean(import.meta.env.VITE_SUPABASE_URL);
};

// ─── Groups ─────────────────────────────────────────────
export const getGroups = async () => {
  try {
    return await proxyGet<any[]>("/groups");
  } catch (e) {
    console.warn("getGroups failed, falling back to mock:", e);
    return [];
  }
};

// ─── Vehicles ───────────────────────────────────────────
export const getVehicles = async (group?: string): Promise<Vehicle[]> => {
  if (!group) {
    // Without a group code we fall back to mock data for now
    return mockVehicles;
  }
  try {
    const raw = await proxyGet<any[]>("/vehicles", { group });
    return raw.map(normalizeVehicle);
  } catch (e) {
    console.warn("getVehicles failed, falling back to mock:", e);
    return mockVehicles;
  }
};

// ─── Live positions (uses vehicle list) ─────────────────
export const getLivePositions = async () => {
  const vehicles = await getVehicles();
  return vehicles.map((v) => ({
    vehicleId: v.id,
    lat: v.lat,
    lng: v.lng,
    speedKph: v.speed,
    status: v.status,
    timestamp: v.lastUpdate,
  }));
};

// ─── Trip history ───────────────────────────────────────
export const getTripHistory = async (
  code?: string,
  from?: string,
  to?: string
): Promise<Trip[]> => {
  if (!code) return mockTrips;
  try {
    const params: Record<string, string> = { code };
    if (from) params.from = from;
    if (to) params.to = to;
    const raw = await proxyGet<any[]>("/trips", params);
    return raw.map(normalizeTrip);
  } catch (e) {
    console.warn("getTripHistory failed, falling back to mock:", e);
    return mockTrips;
  }
};

// ─── Events (kept as mock — API doesn't have an events endpoint) ─
export const getEvents = async (): Promise<FleetEvent[]> => {
  return mockEvents;
};

// ─── Speed chart (mock) ─────────────────────────────────
export const getSpeedChartData = async () => {
  return mockSpeedChart;
};

// ─── Normalizers ────────────────────────────────────────
function normalizeVehicle(raw: any): Vehicle {
  return {
    id: String(raw.code ?? raw.id ?? ""),
    name: raw.name ?? raw.title ?? "",
    plate: raw.plate ?? raw.licensePlate ?? "",
    status: deriveStatus(raw),
    speed: Number(raw.speed ?? raw.speedKph ?? 0),
    lat: Number(raw.lat ?? raw.latitude ?? 0),
    lng: Number(raw.lng ?? raw.longitude ?? 0),
    lastUpdate: raw.timestamp ?? raw.lastUpdate ?? new Date().toISOString(),
    driver: raw.driver ?? "",
    fuelLevel: Number(raw.fuelLevel ?? raw.fuel ?? 0),
    ignition: Boolean(raw.ignition ?? raw.acc ?? false),
    odometer: Number(raw.odometer ?? raw.mileage ?? 0),
  };
}

function normalizeTrip(raw: any): Trip {
  return {
    id: String(raw.id ?? Math.random()),
    vehicleId: String(raw.vehicleCode ?? raw.vehicleId ?? ""),
    vehicleName: raw.vehicleName ?? "",
    startTime: raw.startTime ?? raw.from ?? "",
    endTime: raw.endTime ?? raw.to ?? "",
    startLocation: raw.startLocation ?? raw.startAddress ?? "",
    endLocation: raw.endLocation ?? raw.endAddress ?? "",
    distance: Number(raw.distanceKm ?? raw.distance ?? 0),
    duration: Number(raw.durationMin ?? raw.duration ?? 0),
    maxSpeed: Number(raw.maxSpeedKph ?? raw.maxSpeed ?? 0),
    avgSpeed: Number(raw.avgSpeedKph ?? raw.avgSpeed ?? 0),
  };
}

function deriveStatus(raw: any): Vehicle["status"] {
  if (raw.status) {
    const s = String(raw.status).toLowerCase();
    if (s === "moving" || s === "drive") return "moving";
    if (s === "idle" || s === "stop") return "idle";
    return "offline";
  }
  if (Number(raw.speed ?? 0) > 0) return "moving";
  if (raw.ignition || raw.acc) return "idle";
  return "offline";
}
