<template>
  <div class="space-y-6">

    <!-- ── Header ──────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Historie jízd</h1>
        <p class="text-muted-foreground">Přehled jízd vašich vozidel</p>
      </div>
      <button
        :disabled="filtered.length === 0"
        class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium
               text-primary-foreground transition-colors hover:bg-primary/90
               disabled:cursor-not-allowed disabled:opacity-50"
        @click="exportCsv"
      >
        <Download class="h-4 w-4" /> Export CSV
      </button>
    </div>

    <!-- ── Filters ───────────────────────────────────────────── -->
    <DateRangeFilter
      :model-from="dateFrom" :model-to="dateTo"
      :error="dateError" :days="days" :loading="store.loading.trips"
      @update:from="setFrom" @update:to="setTo" @preset="applyPreset"
    >
      <template #vehicle-select>
        <div>
          <label class="mb-1 block text-muted-foreground">Vozidlo</label>
          <select v-model="selectedVehicleId" class="input-base w-48">
            <option value="">Všechna vozidla</option>
            <option v-for="v in store.vehicles" :key="v.id" :value="v.id">
              {{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
            </option>
          </select>
        </div>
      </template>
    </DateRangeFilter>

    <!-- ── Speed chart ─────────────────────────────────────── -->
    <div v-if="showChart" class="rounded-xl border border-border bg-card p-5">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <p class="font-semibold">
            Průměrná rychlost
            <span v-if="selectedVehicle" class="font-normal text-muted-foreground">
              — {{ selectedVehicle.name }}
            </span>
          </p>
          <p class="text-muted-foreground">
            {{ days }} {{ pluralDays(days) }} · skupiny po {{ binHours }}h
          </p>
        </div>
        <span class="text-muted-foreground">{{ pluralTrips(filtered.length) }}</span>
      </div>
      <div class="h-56">
        <p v-if="store.loading.speedChart"
           class="flex h-full items-center justify-center animate-pulse text-muted-foreground">
          Načítám graf…
        </p>
        <p v-else-if="store.speedChart.length === 0"
           class="flex h-full items-center justify-center text-muted-foreground">
          Žádná data pro vybrané období
        </p>
        <SpeedChart v-else :data="store.speedChart" />
      </div>
    </div>

    <!-- ── States ────────────────────────────────────────────── -->
    <ErrorState
      v-if="store.errors.trips && store.trips.length === 0"
      :message="store.errors.trips" :on-retry="retry"
    />
    <EmptyState v-else-if="dateError" title="Neplatné datum" :description="dateError">
      <template #icon><AlertCircle class="h-10 w-10 text-destructive" /></template>
    </EmptyState>
    <LoadingState v-else-if="store.loading.trips" :rows="5" />
    <EmptyState v-else-if="filtered.length === 0" title="Žádné jízdy" :description="emptyDescription">
      <template #icon><Clock class="h-10 w-10" /></template>
    </EmptyState>

    <!-- ── Trips table ────────────────────────────────────────── -->
    <template v-else>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <p class="text-muted-foreground">{{ pluralTrips(searchFiltered.length) }}</p>
          <button
            v-if="isSortActive"
            class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs
                   font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            @click="resetSort"
          >
            <RotateCcw class="h-3 w-3" />
            Resetovat řazení
          </button>
        </div>
        <div class="relative w-64">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="localSearch" type="text" placeholder="Hledat v jízdách…"
            class="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-3
                   text-foreground placeholder:text-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-border bg-card">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <th class="px-5 py-3">
                <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('vehicleId')">
                  Vozidlo
                  <ArrowUp      v-if="sortKey === 'vehicleId' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                  <ArrowDown    v-else-if="sortKey === 'vehicleId' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                  <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                </button>
              </th>
              <th class="px-5 py-3">
                <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('startTime')">
                  Začátek
                  <ArrowUp      v-if="sortKey === 'startTime' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                  <ArrowDown    v-else-if="sortKey === 'startTime' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                  <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                </button>
              </th>
              <th class="px-5 py-3">Odkud → Kam</th>
              <th class="px-5 py-3">
                <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('distance')">
                  Vzdálenost
                  <ArrowUp      v-if="sortKey === 'distance' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                  <ArrowDown    v-else-if="sortKey === 'distance' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                  <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                </button>
              </th>
              <th class="hidden px-5 py-3 md:table-cell">
                <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('duration')">
                  Doba
                  <ArrowUp      v-if="sortKey === 'duration' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                  <ArrowDown    v-else-if="sortKey === 'duration' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                  <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                </button>
              </th>
              <th class="hidden px-5 py-3 lg:table-cell">
                <span class="flex items-center gap-1">
                  <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('avgSpeed')">
                    Prům.
                    <ArrowUp      v-if="sortKey === 'avgSpeed' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                    <ArrowDown    v-else-if="sortKey === 'avgSpeed' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                    <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                  </button>
                  <span class="opacity-40">/</span>
                  <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('maxSpeed')">
                    Max
                    <ArrowUp      v-if="sortKey === 'maxSpeed' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                    <ArrowDown    v-else-if="sortKey === 'maxSpeed' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                    <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
                  </button>
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            <tr
              v-for="trip in sortedFiltered" :key="trip.id"
              class="cursor-pointer transition-colors hover:bg-secondary/40"
              @click="openDrawer(trip.vehicleId, trip.driver)"
            >
              <!-- Vozidlo: name + optional driver LEFT, buttons RIGHT -->
              <td class="px-5 py-4">
                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-semibold">{{ vehicleName(trip.vehicleId) }}</div>
                    <div v-if="trip.driver" class="text-muted-foreground">{{ trip.driver }}</div>
                  </div>
                  <div class="shrink-0" @click.stop>
                    <VehicleActions :vehicle-id="trip.vehicleId" variant="trip-row" />
                  </div>
                </div>
              </td>
              <td class="px-5 py-4 text-muted-foreground whitespace-nowrap">
                {{ fmtDate(trip.startTime) }}
              </td>
              <td class="max-w-xs px-5 py-4">
                <div class="truncate text-muted-foreground" :title="trip.startLocation">
                  {{ trip.startLocation || coordFallback(trip.startLat, trip.startLng) }}
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-muted-foreground">→</span>
                  <span class="truncate" :title="trip.endLocation">
                    {{ trip.endLocation || coordFallback(trip.endLat, trip.endLng) }}
                  </span>
                </div>
              </td>
              <td class="px-5 py-4 font-semibold whitespace-nowrap">
                {{ trip.distance ? `${trip.distance.toFixed(1)} km` : '—' }}
              </td>
              <td class="hidden px-5 py-4 text-muted-foreground whitespace-nowrap md:table-cell">
                {{ trip.duration ? `${trip.duration} min` : '—' }}
              </td>
              <td class="hidden px-5 py-4 text-muted-foreground whitespace-nowrap lg:table-cell">
                {{ (trip.avgSpeed || trip.maxSpeed) ? `${trip.avgSpeed} / ${trip.maxSpeed} km/h` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="sortedFiltered.length === 0 && localSearch"
           class="py-10 text-center text-muted-foreground">
          Žádné jízdy neodpovídají hledání „{{ localSearch }}"
        </p>
      </div>
    </template>

  </div>

  <!-- Vehicle detail drawer -->
  <VehicleDrawer :vehicle="drawerVehicle" @close="closeDrawer" />

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Download, Clock, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw } from 'lucide-vue-next'
import { useFleetStore } from '@/store/fleetStore'
import { useDateRange } from '@/composables/useDateRange'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import VehicleActions  from '@/components/VehicleActions.vue'
import VehicleDrawer   from '@/components/VehicleDrawer.vue'
import SpeedChart      from '@/components/SpeedChart.vue'
import LoadingState    from '@/components/LoadingState.vue'
import ErrorState      from '@/components/ErrorState.vue'
import EmptyState      from '@/components/EmptyState.vue'
import type { Vehicle } from '@/types'

const store = useFleetStore()

if (store.vehicles.length === 0) store.loadVehicles()

// ── Sort state ────────────────────────────────────────────────────────────────

type TripSortKey = 'vehicleId' | 'startTime' | 'distance' | 'duration' | 'avgSpeed' | 'maxSpeed'
type SortDir = 'asc' | 'desc'

const sortKey = ref<TripSortKey>('startTime')
const sortDir = ref<SortDir>('desc')   // newest first by default

function setSort(col: TripSortKey) {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col
    sortDir.value = col === 'startTime' ? 'desc' : 'asc'
  }
}

function resetSort() {
  sortKey.value = 'startTime'
  sortDir.value = 'desc'
}

const isSortActive = computed(() => sortKey.value !== 'startTime' || sortDir.value !== 'desc')

// ── Handle "Historie" button navigation from other pages ─────────────────────
// Any Historie button sets store.historyVehicleId. On mount (and when vehicles
// load if they weren't ready yet), we pick it up, pre-select the vehicle in the
// dropdown, apply the Měsíc preset, then clear the signal.
function applyHistoryNavigation(): void {
  const id = store.historyVehicleId
  if (!id) return
  if (store.vehicles.length === 0) return  // wait for vehicles to load
  // Apply preset FIRST so the selectedVehicleId watcher fires with correct dates
  applyPreset(-1)                          // -1 = Měsíc (one month back → today)
  selectedVehicleId.value = id
  store.clearHistoryVehicle()
}

onMounted(applyHistoryNavigation)

watch(() => store.vehicles.length, applyHistoryNavigation)

const selectedVehicleId = ref('')
const localSearch       = ref('')

// Header search → pre-select vehicle dropdown
watch(() => store.searchQuery, (q) => {
  const lower = q.trim().toLowerCase()
  if (!lower) return
  const match = store.vehicles.find((v) =>
    v.name.toLowerCase().includes(lower) ||
    v.plate.toLowerCase().replace(/\s/g, '').includes(lower.replace(/\s/g, '')) ||
    (v.driver?.toLowerCase().includes(lower) ?? false)
  )
  if (match) selectedVehicleId.value = match.id
})

const {
  dateFrom, dateTo, dateError, isValid, days, binHours,
  apiFrom, apiTo, setFrom, setTo, applyPreset, resetToSafeDefaults,
} = useDateRange({
  onValidChange(from, to, bin) {
    const code = selectedVehicleId.value || undefined
    store.loadTrips(code, from, to)
    if (code) store.loadSpeedChart(code, from, to, bin)
  },
})

watch(selectedVehicleId, () => {
  if (!isValid.value) return
  const code = selectedVehicleId.value || undefined
  store.loadTrips(code, apiFrom.value, apiTo.value)
  if (code) store.loadSpeedChart(code, apiFrom.value, apiTo.value, binHours.value)
  else store.speedChart = []
})

const selectedVehicle = computed(() =>
  store.vehicles.find((v) => v.id === selectedVehicleId.value) ?? null
)
const showChart = computed(() => Boolean(selectedVehicleId.value))

const filtered = computed(() => {
  if (!isValid.value) return []
  return store.trips.filter((t) => {
    if (selectedVehicleId.value && t.vehicleId !== selectedVehicleId.value) return false
    const d = t.startTime?.slice(0, 10) ?? ''
    return d >= dateFrom.value && d <= dateTo.value
  })
})

const searchFiltered = computed(() => {
  const q = localSearch.value.trim().toLowerCase()
  if (!q) return filtered.value
  return filtered.value.filter((t) =>
    vehicleName(t.vehicleId).toLowerCase().includes(q) ||
    t.startLocation?.toLowerCase().includes(q) ||
    t.endLocation?.toLowerCase().includes(q)
  )
})

const sortedFiltered = computed(() => {
  const arr = [...searchFiltered.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return arr.sort((a, b) => {
    switch (sortKey.value) {
      case 'vehicleId': return dir * vehicleName(a.vehicleId).localeCompare(vehicleName(b.vehicleId), 'cs')
      case 'startTime': return dir * (a.startTime ?? '').localeCompare(b.startTime ?? '')
      case 'distance':  return dir * ((a.distance ?? 0) - (b.distance ?? 0))
      case 'duration':  return dir * ((a.duration ?? 0) - (b.duration ?? 0))
      case 'avgSpeed':  return dir * ((a.avgSpeed ?? 0) - (b.avgSpeed ?? 0))
      case 'maxSpeed':  return dir * ((a.maxSpeed ?? 0) - (b.maxSpeed ?? 0))
      default:          return 0
    }
  })
})

const emptyDescription = computed(() =>
  selectedVehicle.value
    ? `Pro "${selectedVehicle.value.name}" a ${dateFrom.value}–${dateTo.value} nebyly nalezeny žádné jízdy.`
    : `Pro ${dateFrom.value}–${dateTo.value} nebyly nalezeny žádné jízdy.`
)

// ── Drawer ───────────────────────────────────────────────────────────────────

const drawerVehicle = ref<Vehicle | null>(null)

function openDrawer(vehicleId: string, driverHint?: string): void {
  const v = store.vehicles.find((x) => x.id === vehicleId)
  if (!v) return
  // Enrich driver from trip data when the vehicles list API doesn't include it
  drawerVehicle.value = driverHint && !v.driver ? { ...v, driver: driverHint } : v
}

function closeDrawer(): void { drawerVehicle.value = null }

function retry(): void {
  resetToSafeDefaults()
  store.loadTrips(selectedVehicleId.value || undefined, apiFrom.value, apiTo.value)
}

function exportCsv(): void {
  const BOM    = '\uFEFF'
  const header = 'Vozidlo,Řidič,Začátek,Konec,Odkud,Kam,Vzdálenost (km),Prům. rychlost,Max rychlost\n'
  const rows   = filtered.value.map((t) =>
    `"${vehicleName(t.vehicleId)}","${t.driver ?? ''}","${t.startTime}","${t.endTime}","${t.startLocation}","${t.endLocation}",${t.distance?.toFixed(1)},${t.avgSpeed},${t.maxSpeed}`
  ).join('\n')
  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), {
    href:     url,
    download: `jizdy-${selectedVehicleId.value || 'vsechna'}-${dateFrom.value}_${dateTo.value}.csv`,
  }).click()
  URL.revokeObjectURL(url)
}

function vehicleName(id: string): string {
  return store.vehicles.find((v) => v.id === id)?.name ?? id
}
function fmtDate(iso: string): string   { return iso ? new Date(iso).toLocaleString('cs-CZ') : '—' }
function coordFallback(lat: number, lng: number): string {
  return lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '—'
}
function pluralTrips(n: number): string { return n === 1 ? '1 jízda' : n < 5 ? `${n} jízdy` : `${n} jízd` }
function pluralDays(n: number):  string { return n === 1 ? 'den' : n < 5 ? 'dny' : 'dní' }
</script>

<style scoped>
.input-base {
  @apply h-10 rounded-lg border border-border bg-secondary px-3 text-foreground
         focus:outline-none focus:ring-2 focus:ring-ring;
}
</style>
