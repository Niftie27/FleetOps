# Fleet Insights — GPS Dozor Dashboard

Moderní dashboard pro sledování flotily vozidel postavený nad GPS Dozor API.

---

## Pro koho je appka a proč

Appka je určena pro **manažery flotil a dispečery** — lidi, kteří denně potřebují vědět, kde jsou jejich vozidla, jak rychle jezdí a jestli nedochází k rizikovému chování za volantem.

GPS Dozor jako takový nabízí surová data. Chyběl ale pohled „na první dobrou" — dashboard, který za 10 sekund řekne: kolik aut je v pohybu, kdo jel dnes nejrychleji a kde se kdo nachází. Přesně to Fleet Insights řeší:

- **Přehled flotily** — okamžitý přehled stavu všech vozidel (pohyb / nečinnost / offline)
- **Živá mapa** — interaktivní mapa s aktuálními pozicemi a filtrem podle stavu
- **Historie jízd** — tabulka jízd s grafem průměrné rychlosti, export do CSV
- **Události** — automaticky detekovaná překročení rychlosti (>110 km/h) a dlouhé jízdy (>300 km)

Bonus: integrace počasí (OpenWeatherMap) a reverzní geokódování adres (Nominatim přes backend proxy, aby nedocházelo ke CORS blokování).

---

## Použité AI nástroje a workflow

Celý vývoj probíhal **AI-first** stylem s Claude (Anthropic):

1. **Architektura** — nejprve jsem s Claude navrhl strukturu projektu: React + Vite + Tailwind, Pinia-style state management přes Context + useReducer, backend proxy v Node.js/Express pro GPS Dozor API (kvůli Basic Auth a CORS).

2. **Iterace po stránkách** — každou stránku (Index, LiveMap, TripHistory, Events) jsem nechal vygenerovat Claude jako celý soubor. Po každém kroku jsem ho feedoval screenshoty a logy z browser console.

3. **Debugging loop** — největší hodnota AI byla v debuggingu. Sdílel jsem screenshot + URL z Network tabu → Claude identifikoval root cause (např. `from=T00:00` způsobené prázdným state, nebo rok `0020` z mid-typing) a opravil celý soubor najednou.

4. **Backend** — `index.js` (Node.js proxy) byl celý navržen a iterován s Claude, včetně Nominatim rate-limit queue (1 req/s), aby nedocházelo k HTTP 429.

---

## Na co jsem narazil a jak jsem to vyřešil

| Problém | Příčina | Řešení |
|---|---|---|
| Prázdná mapa | Import z `mockData.ts` který neexistoval | Oprava importu na `@/types/fleet` |
| Jízdy se nezobrazovaly po výběru vozidla | GPS Dozor nevrací `VehicleCode` v trip recordech | `normalizeTrip(raw, vehicleCode)` — code injektován při fetchi |
| `from=T00:00` → HTTP 400 | `dateFrom` byl prázdný string při inicializaci | Debounce 600ms + validace `isValidDate()` před každým API voláním |
| Rok `0020` → HTTP 400 | Prohlížeč vrací partial string při psaní roku | `isValidDate()` odmítá rok < 2020 |
| Nominatim CORS | Nominatim blokuje requesty z browseru | Backend proxy `/api/geocode/reverse` s rate-limit queue |
| HTTP 429 od Nominatim | Příliš mnoho requestů najednou | Sequential queue s 1100ms zpožděním + in-memory cache |
| Graf X-osy nesouvislý | Chart renderoval jen hodiny s daty | `buildSpeedChart` nyní emituje celou osu 00:00–LastHour s 0 pro prázdné biny |

---

## Co bych udělal jinak nebo přidal s více času

- **Migrace do Vue 3** — projekt byl postaven v Reactu (rychlejší scaffolding přes Vite template), ale Vue je podle zadání plus. Přepis do Vue 3 + Pinia + Composition API by přišel jako druhý krok.
- **Skutečné palivo** — GPS Dozor nemá palivo ve vehicles endpointu; vyžaduje `/sensors/FuelActualVolume` per vozidlo. Nyní zobrazujeme N/A.
- **Trasy jízd na mapě** — Leaflet polylines pro vizualizaci trasy konkrétní jízdy kliknutím na řádek v tabulce.
- **Push notifikace** — WebSocket nebo SSE pro real-time alerting bez nutnosti refreshe.
- **Autentizace** — multi-tenant login místo hardcoded credentials v `.env`.
- **Testy** — Vitest unit testy na `dozorApi.ts` (normalizátory, buildSpeedChart) a Playwright E2E pro hlavní flow.
