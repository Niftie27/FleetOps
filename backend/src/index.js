import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const TIMEOUT_MS = Number(process.env.DOZOR_TIMEOUT_MS || 15000);

const requiredEnv = ["DOZOR_BASE_URL", "DOZOR_USER", "DOZOR_PASS"];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(`[startup] Missing environment variables: ${missing.join(", ")}`);
}

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(express.json());

app.use((req, _res, next) => {
  const startedAt = Date.now();
  const originalSend = _res.send.bind(_res);
  _res.send = (body) => {
    console.info(`${req.method} ${req.originalUrl} -> ${_res.statusCode} (${Date.now() - startedAt}ms)`);
    return originalSend(body);
  };
  next();
});

// ─── GPS Dozor proxy ─────────────────────────────────────

function toDozorUrl(path, query = {}) {
  const base = process.env.DOZOR_BASE_URL;
  const url = new URL(`${base}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function dozorFetch(path, query = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const auth = Buffer.from(`${process.env.DOZOR_USER}:${process.env.DOZOR_PASS}`).toString("base64");
    const res = await fetch(toDozorUrl(path, query), {
      method: "GET",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await res.json() : await res.text();
    return { status: res.status, body };
  } catch (error) {
    if (error.name === "AbortError") {
      return { status: 504, body: { error: "Upstream timeout", timeoutMs: TIMEOUT_MS } };
    }
    return { status: 502, body: { error: "Upstream request failed", details: String(error) } };
  } finally {
    clearTimeout(timeout);
  }
}

function passthrough(handler) {
  return async (req, res) => {
    const { status, body } = await handler(req);
    res.status(status).json(body);
  };
}

// ─── Trip response cache ─────────────────────────────────────────────────────
// GPS Dozor rate-limits concurrent trip requests. Cache responses for 5 minutes
// so: (a) sequential enrichment doesn't re-hit the API on hot reload, and
// (b) repeat visits to Historie/Události serve instantly from cache.

const tripCache = new Map(); // key → { body, expiresAt }
const TRIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function tripCacheKey(code, from, to) {
  return `${code}|${from}|${to}`;
}

async function dozorFetchTrips(code, from, to) {
  const key = tripCacheKey(code, from, to);
  const cached = tripCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return { status: 200, body: cached.body, fromCache: true };
  }
  const result = await dozorFetch(
    `/vehicle/${encodeURIComponent(code)}/trips`,
    { from, to }
  );
  if (result.status === 200) {
    tripCache.set(key, { body: result.body, expiresAt: Date.now() + TRIP_CACHE_TTL_MS });
  }
  return result;
}

app.get("/api/vehicles", passthrough(async (req) =>
  dozorFetch(`/vehicles/group/${encodeURIComponent(String(req.query.group || ""))}`)
));
app.get("/api/vehicle/:code", passthrough(async (req) =>
  dozorFetch(`/vehicle/${encodeURIComponent(req.params.code)}`)
));
app.get("/api/history", passthrough(async (req) =>
  dozorFetch(`/vehicles/history/${encodeURIComponent(String(req.query.codes || ""))}`, {
    from: req.query.from,
    to: req.query.to,
  })
));
app.get("/api/groups", passthrough(async () => dozorFetch("/groups")));
app.get("/api/trips", passthrough(async (req) =>
  dozorFetchTrips(
    String(req.query.code || ""),
    String(req.query.from || ""),
    String(req.query.to   || "")
  )
));

// ─── Nominatim reverse geocode proxy with rate limiter ───
// Nominatim policy: max 1 request/second.
// We queue requests and process one per second.

const geocodeCache = new Map();

// Simple sequential queue — resolves one Nominatim call per 1100ms
const nominatimQueue = [];
let nominatimBusy = false;

function processNominatimQueue() {
  if (nominatimBusy || nominatimQueue.length === 0) return;
  nominatimBusy = true;
  const { lat, lng, resolve } = nominatimQueue.shift();

  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;

  fetchFromNominatim(lat, lng)
    .then((address) => {
      geocodeCache.set(key, address);
      resolve({ address });
    })
    .catch(() => {
      const fallback = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
      geocodeCache.set(key, fallback);
      resolve({ address: fallback, fallback: true });
    })
    .finally(() => {
      // Wait 1100ms before next request to stay within Nominatim policy
      setTimeout(() => {
        nominatimBusy = false;
        processNominatimQueue();
      }, 1100);
    });
}

async function fetchFromNominatim(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=16&accept-language=cs`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "FleetInsights/1.0 (fleet-dashboard-proxy)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  const a = data.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.neighbourhood ?? "";
  const houseNumber = a.house_number ?? "";
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
  const parts = [];
  if (city) parts.push(city);
  if (street) parts.push(street + (houseNumber ? ` ${houseNumber}` : ""));
  return parts.length > 0 ? parts.join(", ") : data.display_name ?? `${lat}, ${lng}`;
}

app.get("/api/geocode/reverse", (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;

  // Serve from cache immediately
  if (geocodeCache.has(key)) {
    return res.json({ address: geocodeCache.get(key), cached: true });
  }

  // Queue the request — respond when it's processed
  nominatimQueue.push({
    lat, lng,
    resolve: (result) => res.json(result),
  });
  processNominatimQueue();
});

app.get("/health", (_req, res) => res.json({ ok: true, queueLength: nominatimQueue.length }));

app.listen(PORT, () => {
  console.info(`FleetOps backend listening on http://localhost:${PORT}`);
});
