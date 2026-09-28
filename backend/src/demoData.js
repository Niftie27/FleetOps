// ─── Demo data generator ──────────────────────────────────────────────────────
// Synthetic fleet used ONLY when DEMO_MODE=true. The real GPS Dozor vehicle and
// all upstream calls are untouched — these records are appended to the real ones.
//
// Everything here conforms to the documented GPS Dozor JSON schema (endpoints #2
// and #5) so the frontend's existing normalizers handle it with zero changes:
//   - vehicle: Code, Name, SPZ, Speed, LastPosition{Latitude,Longitude} (strings),
//              LastPositionTimestamp (UTC "…Z"), Odometer (metres), …
//   - trip:    StartTime/FinishTime (naive local, no TZ — as the real API returns),
//              StartPosition/FinishPosition, StartAddress/FinishAddress,
//              TripLength "HH:MM", TotalDistance (km), MaxSpeed, AverageSpeed,
//              DriverName.
//
// Design rules honoured (per request):
//   - Codes are prefixed "DEMO-" so the frontend can tag them visibly as demo.
//   - Positions & routes sit on real Czech roads/cities (D1, D5, D11, D46 …),
//     never in fields or water.
//   - Timestamps are generated relative to now so stale-data detection works:
//     3 vehicles moving (fresh), 2 idle (recent), 1 offline (deliberately stale).

const DEMO_PREFIX = "DEMO-";

// Each vehicle: current position (on a real road) + a set of trip "legs" between
// real Czech towns with realistic road distances/speeds. Order matters — the
// first demo vehicles also feed the "all vehicles" events view.
const VEHICLES = [
  {
    code: `${DEMO_PREFIX}SCANIA-R500`, name: "Scania R500", spz: "2S1 9042",
    driver: "Novák, Petr", odometerKm: 384210, status: "moving", speed: 87,
    current: { lat: 49.5416, lng: 15.3595 }, // D1, Humpolec
    legs: [
      { from: ["Praha, Chodov", 50.0300, 14.5100], to: ["Humpolec", 49.5416, 15.3595], km: 88,  avg: 76, max: 98 },
      { from: ["Humpolec", 49.5416, 15.3595],       to: ["Brno", 49.1951, 16.6068],     km: 122, avg: 82, max: 129 }, // speeding
      { from: ["Brno", 49.1951, 16.6068],           to: ["Velké Meziříčí", 49.3550, 16.0125], km: 57, avg: 69, max: 101 },
    ],
  },
  {
    code: `${DEMO_PREFIX}VOLVO-FH16`, name: "Volvo FH16", spz: "4V9 1230",
    driver: "Dvořák, Jan", odometerKm: 512980, status: "moving", speed: 92,
    current: { lat: 49.7425, lng: 13.5947 }, // D5, Rokycany
    legs: [
      { from: ["Praha, Zličín", 50.0580, 14.2870], to: ["Plzeň", 49.7384, 13.3736], km: 92,  avg: 78, max: 104 },
      { from: ["Praha, Zličín", 50.0580, 14.2870], to: ["Ostrava", 49.8209, 18.2625], km: 358, avg: 84, max: 118 }, // long trip + speeding
      { from: ["Plzeň", 49.7384, 13.3736],         to: ["Rozvadov", 49.6680, 12.5560], km: 62, avg: 71, max: 96 },
    ],
  },
  {
    code: `${DEMO_PREFIX}DAF-XF`, name: "DAF XF", spz: "6D4 7781",
    driver: "Svoboda, Tomáš", odometerKm: 267540, status: "moving", speed: 81,
    current: { lat: 50.1425, lng: 15.1189 }, // D11, Poděbrady
    legs: [
      { from: ["Praha, Horní Počernice", 50.1090, 14.6000], to: ["Hradec Králové", 50.2103, 15.8327], km: 96, avg: 79, max: 116 }, // speeding
      { from: ["Hradec Králové", 50.2103, 15.8327],         to: ["Poděbrady", 50.1425, 15.1189],       km: 52, avg: 68, max: 92 },
    ],
  },
  {
    code: `${DEMO_PREFIX}MB-ACTROS`, name: "Mercedes-Benz Actros", spz: "1M8 5527",
    driver: "Procházka, Martin", odometerKm: 198320, status: "idle", speed: 0,
    current: { lat: 49.1951, lng: 16.6068 }, // Brno depot
    legs: [
      { from: ["Brno", 49.1951, 16.6068],   to: ["Jihlava", 49.3961, 15.5912], km: 96, avg: 74, max: 99 },
      { from: ["Jihlava", 49.3961, 15.5912], to: ["Olomouc", 49.5938, 17.2509], km: 128, avg: 80, max: 121 }, // speeding
    ],
  },
  {
    code: `${DEMO_PREFIX}IVECO-SWAY`, name: "Iveco S-Way", spz: "3I2 6640",
    driver: "Kučera, Josef", odometerKm: 143870, status: "idle", speed: 0,
    current: { lat: 49.8209, lng: 18.2625 }, // Ostrava
    legs: [
      { from: ["Ostrava", 49.8209, 18.2625], to: ["Olomouc", 49.5938, 17.2509], km: 98, avg: 76, max: 103 },
      { from: ["Olomouc", 49.5938, 17.2509], to: ["Brno", 49.1951, 16.6068],     km: 78, avg: 72, max: 95 },
    ],
  },
  {
    code: `${DEMO_PREFIX}RENAULT-T`, name: "Renault T", spz: "5R3 8814",
    driver: "Veselý, David", odometerKm: 421650, status: "offline", speed: 0,
    current: { lat: 49.7250, lng: 13.3200 }, // Plzeň outskirts (stale)
    legs: [
      { from: ["Plzeň", 49.7384, 13.3736], to: ["Beroun", 49.9639, 14.0722], km: 63, avg: 70, max: 94 },
      { from: ["Beroun", 49.9639, 14.0722], to: ["Praha, Zličín", 50.0580, 14.2870], km: 32, avg: 58, max: 88 },
    ],
  },
];

const BY_CODE = new Map(VEHICLES.map((v) => [v.code, v]));

const DAY_MS = 86_400_000;

function pad(n) { return String(n).padStart(2, "0"); }

/** UTC ISO with trailing Z — matches LastPositionTimestamp format. */
function isoZ(ms) { return new Date(ms).toISOString().slice(0, 19) + "Z"; }

/** Naive local "YYYY-MM-DDTHH:MM:SS" — matches trip StartTime/FinishTime. */
function fmtNaive(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hhmm(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function isDemoCode(code) {
  return typeof code === "string" && code.startsWith(DEMO_PREFIX);
}

/** Build one vehicle record in GPS Dozor endpoint-#2 schema. */
function buildVehicle(cfg) {
  const now = Date.now();
  const ts =
    cfg.status === "offline" ? isoZ(now - 150 * 60_000) : // ~2.5 h ago → offline
    cfg.status === "idle"    ? isoZ(now - 9 * 60_000)   : // ~9 min ago → idle
                               isoZ(now - 8_000);         // fresh → moving
  return {
    Code: cfg.code,
    GroupCode: "SAGU",
    BranchId: null,
    BranchName: "",
    Name: cfg.name,
    SPZ: cfg.spz,
    BatteryPercentage: 0,
    Speed: cfg.status === "moving" ? cfg.speed : 0,
    LastPosition: {
      Latitude: cfg.current.lat.toFixed(6),
      Longitude: cfg.current.lng.toFixed(6),
    },
    IsActive: true,
    LastPositionTimestamp: ts,
    Odometer: cfg.odometerKm * 1000, // API returns metres; frontend /1000 → km
    RefuelingCards: [],
  };
}

export function getDemoVehicles() {
  return VEHICLES.map(buildVehicle);
}

export function getDemoVehicleDetail(code) {
  const cfg = BY_CODE.get(code);
  return cfg ? buildVehicle(cfg) : null;
}

/** Expand a vehicle's legs across the last ~16 days, filtered to [from,to]. */
export function getDemoTrips(code, fromStr, toStr) {
  const cfg = BY_CODE.get(code);
  if (!cfg) return [];

  const fromT = Date.parse(fromStr);
  const toT = Date.parse(toStr);
  const now = Date.now();
  const trips = [];

  for (let d = 0; d < 16; d++) {
    // Alternate: full leg set on even days, a single rotating leg on odd days.
    const legs = d % 2 === 0 ? cfg.legs : [cfg.legs[d % cfg.legs.length]];
    let hour = 7;
    legs.forEach((leg, i) => {
      const start = new Date(now - d * DAY_MS);
      start.setHours(hour, (i * 17) % 60, 0, 0);
      const durMin = Math.max(1, Math.round((leg.km / leg.avg) * 60));
      const finish = new Date(start.getTime() + durMin * 60_000);
      hour += Math.ceil(durMin / 60) + 1;

      const st = start.getTime();
      if (Number.isNaN(fromT) || Number.isNaN(toT) || st < fromT || st > toT) return;

      const [fp, fLat, fLng] = leg.from;
      const [tp, tLat, tLng] = leg.to;
      trips.push({
        AverageSpeed: leg.avg,
        MaxSpeed: leg.max,
        TripType: false,
        StartTime: fmtNaive(start),
        FinishTime: fmtNaive(finish),
        StartPosition: { Latitude: fLat.toFixed(6), Longitude: fLng.toFixed(6) },
        FinishPosition: { Latitude: tLat.toFixed(6), Longitude: tLng.toFixed(6) },
        StartAddress: `${fp}, CZ`,
        FinishAddress: `${tp}, CZ`,
        TripLength: hhmm(durMin),
        TripWaitingTime: "00:00",
        TotalDistance: leg.km,
        DriverName: cfg.driver,
      });
    });
  }

  // Newest first, matching how the real endpoint is consumed.
  return trips.sort((a, b) => (a.StartTime < b.StartTime ? 1 : -1));
}
