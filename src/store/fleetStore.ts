// ─── Fleet store ─────────────────────────────────────────────────────────────
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { FleetEvent, SpeedPoint, Trip, Vehicle, VehicleStatus } from "@/types";
import { fetchVehicles, fetchTrips, fetchEvents, fetchSpeedChart } from "@/services/dozorApi";
import { oneMonthAgo, toApiFrom, toApiTo } from "@/utils/dateUtils";

export type StatusFilter = "all" | VehicleStatus;

export const useFleetStore = defineStore("fleet", () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const vehicles    = ref<Vehicle[]>([]);
  const trips       = ref<Trip[]>([]);
  const events      = ref<FleetEvent[]>([]);
  const speedChart  = ref<SpeedPoint[]>([]);
  const lastUpdated = ref<string | null>(null);

  const selectedVehicleId  = ref<string | null>(null);
  const highlightVehicleId = ref<string | null>(null);
  const historyVehicleId   = ref<string | null>(null);
  const eventsVehicleId    = ref<string | null>(null);

  const statusFilter = ref<StatusFilter>("all");
  const searchQuery  = ref("");

  const loading = ref({
    vehicles:   false,
    trips:      false,
    events:     false,
    speedChart: false,
  });

  const errors = ref({
    vehicles: null as string | null,
    trips:    null as string | null,
    events:   null as string | null,
  });

  // ─── Driver cache ────────────────────────────────────────────────────────────
  // Permanent Map of vehicleId → driverName. Never cleared. Accumulated from
  // every data source (enrichment, trips, events). reapplyDriverNames() reads
  // exclusively from here — NOT from trips.value which gets replaced on every
  // loadTrips() call, erasing other vehicles' cached data.
  const driverCache = new Map<string, string>();
  let driverEnrichmentDone = false;

  /** Add any new vehicleId→driver mappings to the permanent cache. */
  function cacheDrivers(items: Array<{ vehicleId: string; driver: string | null }>): void {
    for (const item of items) {
      if (item.driver && !driverCache.has(item.vehicleId)) {
        driverCache.set(item.vehicleId, item.driver);
      }
    }
  }

  /** Patch vehicle.driver from the permanent cache for any vehicle still showing null. */
  function reapplyDriverNames(): void {
    for (const v of vehicles.value) {
      if (!v.driver) {
        const cached = driverCache.get(v.id);
        if (cached) v.driver = cached;
      }
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  const selectedVehicle = computed(
    () => vehicles.value.find((v) => v.id === selectedVehicleId.value) ?? null
  );

  const vehicleCounts = computed(() => ({
    total:   vehicles.value.length,
    moving:  vehicles.value.filter((v) => v.status === "moving").length,
    idle:    vehicles.value.filter((v) => v.status === "idle").length,
    offline: vehicles.value.filter((v) => v.status === "offline").length,
  }));

  const allVehicleCodes = computed(() =>
    vehicles.value.map((v) => v.code).filter(Boolean)
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function loadVehicles(): Promise<void> {
    loading.value.vehicles = true;
    errors.value.vehicles  = null;
    try {
      vehicles.value = await fetchVehicles();
      lastUpdated.value = new Date().toISOString();
      // Always re-apply from permanent cache so 10-second polls never lose names
      reapplyDriverNames();
      // First load only: fetch trips per vehicle to populate the driver cache.
      // Awaited so names are ready before loadVehicles() returns to the caller.
      if (!driverEnrichmentDone) {
        driverEnrichmentDone = true;
        await enrichDriverNames();
      }
    } catch (e) {
      errors.value.vehicles = toErrorMsg(e, "Chyba při načítání vozidel");
    } finally {
      loading.value.vehicles = false;
    }
  }

  /**
   * Silent background enrichment: fetches trips individually for each vehicle
   * that is already in vehicles.value — NO redundant fetchVehicles() call inside.
   *
   * The old approach called fetchTrips(undefined, ...) which internally called
   * fetchVehicles() again and then fired ALL vehicle trip requests in parallel.
   * Under moderate fleet sizes this saturated the proxy, causing some vehicles
   * (often idle ones, which happen to be processed last) to be silently dropped
   * by Promise.allSettled, leaving them permanently absent from the cache.
   *
   * This version processes vehicles in sequential batches of 3 so the proxy is
   * never overwhelmed, and every vehicle gets a guaranteed attempt.
   * Populates driverCache only — never touches trips.value, loading, or errors.
   */
  /**
   * Sequential enrichment — one vehicle at a time, no parallel requests.
   * GPS Dozor rate-limits concurrent trip fetches; batching caused silent
   * failures where some vehicles never got cached. Sequential is slower on
   * first load but 100% reliable: every vehicle gets its own dedicated request.
   * reapplyDriverNames() is called after EACH vehicle so names appear
   * progressively in the UI rather than all at once at the very end.
   */
  async function enrichDriverNames(): Promise<void> {
    const from  = toApiFrom(oneMonthAgo());
    const to    = toApiTo(new Date().toISOString().slice(0, 10));
    const codes = vehicles.value.map((v) => v.code).filter(Boolean);

    for (const code of codes) {
      try {
        const vehicleTrips = await fetchTrips(code, from, to);
        cacheDrivers(vehicleTrips);
        reapplyDriverNames(); // update UI progressively as each vehicle resolves
      } catch {
        // silently skip — this vehicle stays "Řidič neznámý" for now
      }
    }
  }

  async function loadTrips(
    vehicleCode: string | undefined,
    from: string,
    to: string
  ): Promise<void> {
    loading.value.trips = true;
    errors.value.trips  = null;
    try {
      trips.value = await fetchTrips(vehicleCode, from, to);
      cacheDrivers(trips.value);
      reapplyDriverNames();
    } catch (e) {
      errors.value.trips = toErrorMsg(e, "Chyba při načítání jízd");
    } finally {
      loading.value.trips = false;
    }
  }

  async function loadEvents(
    vehicleCode: string | undefined,
    from: string,
    to: string
  ): Promise<void> {
    loading.value.events = true;
    errors.value.events  = null;
    try {
      events.value = await fetchEvents(
        vehicleCode,
        from,
        to,
        vehicleCode ? undefined : allVehicleCodes.value
      );
      cacheDrivers(events.value);
      reapplyDriverNames();
    } catch (e) {
      errors.value.events = toErrorMsg(e, "Chyba při načítání událostí");
    } finally {
      loading.value.events = false;
    }
  }

  async function loadSpeedChart(
    vehicleCode: string,
    from: string,
    to: string,
    binHours: number
  ): Promise<void> {
    speedChart.value         = [];
    loading.value.speedChart = true;
    try {
      speedChart.value = await fetchSpeedChart(vehicleCode, from, to, binHours);
    } catch {
      speedChart.value = [];
    } finally {
      loading.value.speedChart = false;
    }
  }

  function selectVehicle(id: string | null): void {
    selectedVehicleId.value = id;
  }

  function highlightVehicle(id: string): void {
    highlightVehicleId.value = id;
    statusFilter.value = "all";
    searchQuery.value  = "";
  }

  function clearHighlight(): void {
    highlightVehicleId.value = null;
  }

  function navigateToHistory(id: string): void {
    historyVehicleId.value = id;
  }

  function clearHistoryVehicle(): void {
    historyVehicleId.value = null;
  }

  function navigateToEvents(id: string): void {
    eventsVehicleId.value = id;
  }

  function clearEventsVehicle(): void {
    eventsVehicleId.value = null;
  }

  function setStatusFilter(filter: StatusFilter): void {
    statusFilter.value = filter;
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query;
  }

  return {
    vehicles, trips, events, speedChart, lastUpdated,
    selectedVehicleId, highlightVehicleId, historyVehicleId, eventsVehicleId,
    statusFilter, searchQuery, loading, errors,
    selectedVehicle, vehicleCounts, allVehicleCodes,
    loadVehicles, loadTrips, loadEvents, loadSpeedChart,
    selectVehicle, highlightVehicle, clearHighlight,
    navigateToHistory, clearHistoryVehicle,
    navigateToEvents, clearEventsVehicle,
    setStatusFilter, setSearchQuery,
  };
});

function toErrorMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
