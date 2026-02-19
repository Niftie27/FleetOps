# Fleet Insights — GPS Dozor Dashboard

Moderní dashboard pro sledování flotily vozidel postavený nad GPS Dozor API.

---

## Pro koho je appka a proč

Appka je určena pro **manažery flotil a dispečery** — lidi, kteří denně potřebují vědět, kde jsou jejich vozidla, jak rychle jezdí a jestli nedochází k rizikovému chování za volantem.

GPS Dozor jako takový nabízí surová data přes API. Chyběl ale pohled „na první dobrou" — dashboard, který za 10 sekund řekne: kolik aut je v pohybu, kdo jel dnes nejrychleji a kde se kdo nachází. Fleet Insights to řeší na čtyřech obrazovkách:

- **Přehled flotily** — KPI karty (v pohybu / nečinné / offline), tabulka se stavem všech vozidel
- **Živá mapa** — interaktivní mapa s aktuálními pozicemi, filtr podle stavu, počasí v místě vozidla
- **Historie jízd** — tabulka jízd s grafem průměrné rychlosti, filtr vozidla + datumu, export CSV
- **Události** — automaticky detekovaná překročení rychlosti (>110 km/h) a dlouhé jízdy (>300 km)

Bonus: počasí přes **Open-Meteo API** (bez API klíče) a adresní geokódování přes **Nominatim** (backend proxy kvůli CORS a rate limitům).

### Použité API endpointy

| Endpoint | Kde se používá |
|---|---|
| `GET /groups` | Inicializace — zjištění kódů skupin vozidel |
| `GET /vehicles/group/{code}` | Přehled flotily, živá mapa — seznam vozidel se stavem a pozicí |
| `GET /vehicle/{code}/trips` | Historie jízd, Události — seznam jízd s adresami a statistikami |
| `GET /vehicle/{code}` | Detail vozidla (VehicleDetail stránka) |
| `GET /vehicles/history/{codes}` | Připraveno v backendu, zatím nevyužito (bylo by pro heatmapu) |

**Celkem: 4 aktivně využívané GPS Dozor endpointy + 2 externí API (Open-Meteo, Nominatim).**

---

## Použité AI nástroje a workflow

Celý vývoj probíhal **AI-first** stylem primárně s **Claude (Anthropic)**, doplněno průběžným testováním v prohlížeči.

**Jak workflow vypadal v praxi:**

1. **Architektura** — s Claude jsem navrhl strukturu: Vite + React (pro rychlý scaffolding) + Tailwind, state management přes Context + useReducer (Pinia-like pattern), Node.js/Express backend proxy pro GPS Dozor API (kvůli Basic Auth a CORS).

2. **Iterace po stránkách** — každou stránku (Přehled, Živá mapa, Historie jízd, Události) jsem nechal vygenerovat jako kompletní soubor. Po každém buildu jsem feedoval Claude screenshot + obsah Network / Console tabu z DevTools.

3. **Debugging loop** — největší hodnota AI byla v debuggingu. Pattern: screenshot → Claude identifikuje root cause → opraví celý soubor → nasadit → ověřit. Příklady: `from=T00:00` (prázdný state), rok `0020` (mid-typing v date input), Nominatim CORS, stale chart po změně vozidla.

4. **Backend** — `index.js` celý s Claude, včetně Nominatim rate-limit queue (1 req/1100ms) a in-memory cache.

---

## Na co jsem narazil a jak jsem to vyřešil

| Problém | Root cause | Řešení |
|---|---|---|
| Prázdná mapa při startu | Import z neexistujícího `mockData.ts` | Oprava importu na správný typ |
| Jízdy chybí po výběru vozidla | GPS Dozor **nevrací** `VehicleCode` v trip recordech | `vehicleCode` injektován do `normalizeTrip()` při fetchi |
| `from=T00:00` → HTTP 400 | `dateFrom` byl prázdný string `""` při inicializaci | Debounce 600ms + `isValidDate()` před každým API voláním |
| Rok `0020` → HTTP 400 | Prohlížeč vrací partial string při psaní roku | `isValidDate()` odmítá rok < 2020 |
| Nominatim CORS 900× chyb | Browser nemůže volat Nominatim (chybí CORS headers) | Backend proxy `/api/geocode/reverse` s Nominatim na server-side |
| HTTP 429 od Nominatim | Příliš mnoho requestů najednou | Sequential queue s 1100ms zpožděním + in-memory cache |
| Graf X-osy s 3 body místo 24 | Chart renderoval jen hodiny s daty | `buildSpeedChart()` emituje celou osu 00:00→last hour, prázdné biny = 0 |
| Stale chart po změně vozidla | `speedChart` state se nečistil před novým fetchem | `CLEAR_SPEED_CHART` action před async voláním |
| "Zkusit znovu" smyčka | `retry` callback zachytil nevalidní `dateFrom` ze stale closure | Retry resetuje data na safe defaults pokud jsou aktuální neplatná |

---

## Co bych udělal jinak nebo přidal s více času

- **Vue 3 + Pinia** — projekt byl postaven v Reactu kvůli rychlosti scaffoldingu, ale Vue je podle zadání plus. Refactoring do Vue 3 Composition API + Pinia by byl přirozený druhý krok — datová vrstva (`dozorApi.ts`, `dateUtils.ts`) je framework-agnostická a přejde beze změn.
- **Skutečné palivo** — GPS Dozor nemá palivo ve vehicles endpointu; vyžaduje `/sensors/FuelActualVolume` per vozidlo zvlášť. Nyní zobrazujeme N/A.
- **Trasy jízd na mapě** — Leaflet polylines pro vizualizaci trasy kliknutím na řádek v tabulce.
- **Heatmapa aktivity** — využít `GET /vehicles/history/{codes}` pro vizualizaci nejfrekventovanějších tras.
- **WebSocket / SSE** — real-time alerting bez polling.
- **Multi-tenant autentizace** — přihlášení k vlastnímu GPS Dozor účtu místo pevných credentials v `.env`.
- **Testy** — Vitest unit testy na `dozorApi.ts` (normalizátory, buildSpeedChart) a Playwright E2E pro kritické flows.
