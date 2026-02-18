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
    const duration = Date.now() - startedAt;
    console.info(`${req.method} ${req.originalUrl} -> ${_res.statusCode} (${duration}ms)`);
    return originalSend(body);
  };
  next();
});

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
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
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

app.get(
  "/api/groups",
  passthrough(async () => dozorFetch("/groups"))
);

app.get(
  "/api/vehicles",
  passthrough(async (req) => dozorFetch(`/vehicles/group/${encodeURIComponent(String(req.query.group || ""))}`))
);

app.get(
  "/api/vehicle/:code",
  passthrough(async (req) => dozorFetch(`/vehicle/${encodeURIComponent(req.params.code)}`))
);

app.get(
  "/api/history",
  passthrough(async (req) =>
    dozorFetch(`/vehicles/history/${encodeURIComponent(String(req.query.codes || ""))}`, {
      from: req.query.from,
      to: req.query.to,
    })
  )
);

app.get(
  "/api/trips",
  passthrough(async (req) =>
    dozorFetch(`/vehicle/${encodeURIComponent(String(req.query.code || ""))}/trips`, {
      from: req.query.from,
      to: req.query.to,
    })
  )
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.info(`FleetOps backend listening on http://localhost:${PORT}`);
});