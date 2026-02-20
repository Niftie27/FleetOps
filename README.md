# FleetOps — GPS Dozor Dashboard

## Pro koho je appka a proč

Pro **manažery flotil a dispečery** — lidi, kteří potřebují vědět, kde jsou jejich vozidla, kdo je řídí, jak rychle jezdí a jestli nedochází k rizikovému chování. GPS Dozor vrací surová data; chyběl pohled „na první dobrou". FleetOps ho přináší na čtyřech obrazovkách: **Přehled flotily** (KPI karty, tabulka se řazením), **Živá mapa** (Leaflet, detekce zastaralé GPS polohy, počasí), **Historie jízd** (graf rychlosti, export CSV) a **Události** (překročení rychlosti >110 km/h, dlouhé jízdy >300 km).

Využité GPS Dozor endpointy: `GET /groups`, `GET /vehicles/group/{code}`, `GET /vehicle/{code}/trips`. Bonus: Open-Meteo (počasí bez API klíče) a Nominatim přes backend proxy (geokódování adres).

## Použité AI nástroje a workflow

Vývoj probíhal **AI-first** s více nástroji v sérii:

1. **Lovable** — rychlý MVP prototyp v Reactu, export do GitHub repozitáře.
2. **Codex** — editoval 15 souborů najednou. Diff jsem zkopíroval do **ChatGPT** a procházeli jsme ho step-by-step. Narazil jsem na mix `PascalCase` a `camelCase` v názvech komponent — první větší problém, který ChatGPT nerozlousknul.
3. **Claude** — celý projekt + Codex diff + část konverzace z ChatGPT jsem hodil do Claude s kontextem. Claude identifikoval pascalCase/camelCase konflikt a opravil ho. Během práce s Claudem se smazala celá konverzace a musel jsem začít znovu.
4. **Migrace React → Vue 3** — provedena s Claude; datová vrstva (`dozorApi.ts`, `dateUtils.ts`) přešla beze změn, komponenty přepsány do Composition API + Pinia.

## Na co jsem narazil a jak jsem to vyřešil

| Problém | Root cause | Řešení |
|---|---|---|
| `PascalCase` vs `camelCase` v importech komponent | Codex + ChatGPT vygenerovaly nekonzistentní názvy souborů | Claude identifikoval systémově a opravil všechny importy najednou |
| Migrace React → Vue 3 | Lovable scaffoldoval v Reactu, zadání preferuje Vue | Přepis komponent do Composition API + Pinia; datová vrstva přešla beze změn |
| `from=T00:00` → HTTP 400 | `dateFrom` byl prázdný string `""` při inicializaci stránky | Debounce 600ms + `isValidDate()` před každým API voláním |
| Rok `0020` → HTTP 400 | Prohlížeč vrací partial string při psaní roku do date inputu | `isValidDate()` odmítá rok < 2020 |
| Nominatim CORS | Browser nemůže volat Nominatim přímo — chybí CORS hlavičky | Backend proxy `/api/geocode/reverse` na Express serveru |
| HTTP 429 od Nominatim | Příliš mnoho paralelních geocoding requestů | Sequential queue s 1100ms zpožděním + in-memory cache adres |
| Graf rychlosti — X-osa s mezerami | Chart renderoval jen hodiny, ve kterých byla data | `buildSpeedChart()` emituje celou osu 00:00 → last hour, prázdné biny = 0 |
| Jméno řidiče chybí v Přehledu a Živé mapě | `DriverName` není ve vehicles endpointu, vrací ho jen trips endpoint | Background enrichment po startu: sekvenční fetch trips pro každé vozidlo, výsledky v permanentní `driverCache` Map která přežívá polling |
| Nečinná vozidla stále bez jména řidiče | Enrichment fetchoval jen 7 dní, idle auta nejezdí | Rozšířeno na 1 měsíc; jedno vozidlo = jeden request (ochrana před rate limitingem GPS Dozor) |
| Sidebar a navigační prokliky nefungovaly | Komponenty nebyly propojené přes Pinia store | `highlightVehicleId`, `historyVehicleId`, `eventsVehicleId` ve store; stránky reagují na hodnotu při mountu |
| Vozidla „V pohybu" se nehýbou na mapě | GPS Dozor aktualizuje `Speed` živě, ale `LastPosition` throttluje per-vozidlo — souřadnice mohou být hodiny staré | Detekce: `posAgeMin > 5 && speed > 0` → šedý přerušovaný marker + varování v popupu |
| Retry smyčka v Událostech | `retry` callback zachytil nevalidní `dateFrom` ze stale closure | Reset na safe defaults před novým fetchem |
| Řazení tabulek nefungovalo | `SortTh` jako inline Vue sub-component nezdědil `class` atributy (fallthrough attrs bug) | Odstraněn sub-component, řazení implementováno přímo inline `<button>` v každém `<th>` |

## Co bych udělal jinak nebo přidal

Začít rovnou ve **Vue 3** místo Reactu — migrace zabrala zbytečný čas. S více času: trasy jízd jako Leaflet polylines, Google Maps link ze souřadnic, WebSocket pro real-time alerting, Vitest unit testy na `dozorApi.ts`, znázorněnit trasy kudy auto jelo na mapě, stupeň opotřebení, dopravní informace. Napadá mě toho hodně.

---

## Jak spustit lokálně

Nainstaluj **Node.js ≥ 18** z [nodejs.org](https://nodejs.org).

```
git clone https://github.com/Niftie27/FleetOps
cd FleetOps
```

Přejmenuj `.env.example` jako `.env` v kořeni projektu:

```
cp .env.example .env
```

Přejmenuj `.env.example` jako `.env` ve složce `backend/` a vyplň `DOZOR_USER` a `DOZOR_PASS` (přihlašovací jméno a heslo z [GPS Dozor API dokumentace](https://www.gpsdozor.cz/documentation/api)):

```
cd backend
cp .env.example .env
```

Otevři soubor `backend/.env` a vyplň:

```
DOZOR_USER=tvoje-uzivatelske-jmeno
DOZOR_PASS=tvoje-heslo
```

Spusť backend (zůstaň ve složce `backend/`):

```
npm install
npm run dev
```

Otevři nový terminál a spusť frontend (v kořeni projektu `FleetOps/`):

```
cd FleetOps
npm install
npm run dev
```

Otevři **http://localhost:8080**
