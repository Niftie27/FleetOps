# Deployment

Aktuální doporučený deployment:

- **Frontend**: Vercel
- **Backend**: Railway (`backend/`)

## 1. Railway backend

V repu je nově připravený root [`Dockerfile`](./Dockerfile), takže když na Railway vybereš repository `Niftie27/FleetOps`, Railway použije Docker build a nasadí **jen backend** ze složky `backend/`.

To znamená:

1. Vyber repository `Niftie27/FleetOps`.
2. Railway najde root `Dockerfile`.
3. Do image se zkopíruje jen `backend/package*.json` a `backend/src`.
4. Spustí se backend přes `npm start`.

V [`backend/railway.json`](./backend/railway.json) navíc zůstává Railway config pro případ, že bys přece jen chtěl service vést přes `Root Directory = /backend`:

- `startCommand: npm start`
- `healthcheckPath: /health`
- `watchPatterns: /backend/**` pro backend-only redeploye

Nastav environment variables:

```env
DOZOR_BASE_URL=https://a1.gpsguard.eu/api/v1
DOZOR_USER=...
DOZOR_PASS=...
DOZOR_TIMEOUT_MS=15000
CORS_ORIGIN=http://localhost:8080,http://localhost:5173,https://*.vercel.app
```

Pokud později přidáš vlastní doménu na Vercelu, přidej ji do `CORS_ORIGIN`, např.:

```env
CORS_ORIGIN=http://localhost:8080,http://localhost:5173,https://*.vercel.app,https://fleetops.example.com
```

Start command:

```bash
npm start
```

Healthcheck endpoint:

```text
/health
```

Po prvním deployi v Railway ještě otevři `Settings -> Networking` a klikni na `Generate Domain`, aby backend dostal veřejnou URL.

Jak si ověřit, že běží opravdu backend a ne frontend:

1. V deploy logu uvidíš Docker build z root `Dockerfile`.
2. Po otevření `https://...up.railway.app/health` dostaneš JSON z Express backendu.
3. Frontend by na Railway URL vůbec neměl renderovat HTML appky, protože image obsahuje jen backend.

## 2. Vercel frontend

Ve Vercelu nasaď root projektu a nastav:

```env
VITE_BACKEND_URL=https://your-service.up.railway.app
```

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Součástí repa je `vercel.json`, který řeší deep-linking pro Vue Router history mode, takže URL jako `/map` nebo `/history` fungují i po refreshi.

## 3. Co po deployi ověřit

1. Railway vrací `200 OK` na `/health`.
2. Vercel načte dashboard bez CORS chyby.
3. Refresh na `/map`, `/history` a `/events` vrátí znovu appku místo 404.
4. Requesty z frontendu míří na Railway URL a vrací data z `/api/groups`, `/api/vehicles` a `/api/trips`.
