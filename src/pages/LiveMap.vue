<template>
  <div class="space-y-4">

    <!-- ── Header ──────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Živá mapa</h1>
      <div class="flex items-center gap-4">
        <RefreshInfo :last-updated="store.lastUpdated" :interval-ms="POLL_INTERVAL" />
        <div class="flex gap-1">
          <button
            v-for="opt in FILTER_OPTIONS" :key="opt.key"
            :class="['rounded-full px-4 py-2 font-medium transition-colors',
              store.statusFilter === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
            @click="store.setStatusFilter(opt.key)"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- ── States (shown above map, map div always rendered) ── -->
    <LoadingState
      v-if="store.loading.vehicles && store.vehicles.length === 0"
      :rows="1" message="Načítání pozic vozidel…"
    />
    <ErrorState
      v-else-if="store.errors.vehicles && store.vehicles.length === 0"
      :message="store.errors.vehicles"
      :on-retry="store.loadVehicles"
    />

    <!-- ── Map layout ─────────────────────────────────────── -->
    <!--
      IMPORTANT: the map div must ALWAYS be in the DOM once vehicles exist.
      Never conditionally remove it — Leaflet's instance is tied to the DOM node.
      We show/hide the empty-state overlay on top instead.
    -->
    <div class="relative flex gap-4" :class="{ 'opacity-0 pointer-events-none h-0 overflow-hidden': !hasVehicles }">

      <!-- Leaflet container -->
      <div
        ref="mapEl"
        class="flex-1 overflow-hidden rounded-xl border border-border"
        style="height: calc(100vh - 14rem); min-height: 400px;"
      />

      <!-- Selected vehicle sidebar -->
      <Transition name="slide">
        <div
          v-if="store.selectedVehicle"
          class="w-72 shrink-0 self-start rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <!-- Header: name + close -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{{ store.selectedVehicle.name }}</h3>
              <p v-if="store.selectedVehicle.plate" class="text-muted-foreground">
                {{ store.selectedVehicle.plate }}
              </p>
            </div>
            <button
              class="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Zavřít"
              @click="store.selectVehicle(null)"
            ><X class="h-4 w-4" /></button>
          </div>

          <StatusBadge :status="store.selectedVehicle.status" />

          <!-- Details with icons -->
          <dl class="space-y-2">
            <div class="flex items-center gap-2.5 text-muted-foreground">
              <Gauge class="h-4 w-4 shrink-0" />
              <dd class="font-medium text-foreground">
                {{ store.selectedVehicle.speed > 0 ? `${store.selectedVehicle.speed} km/h` : 'Stojí' }}
              </dd>
            </div>
            <div v-if="store.selectedVehicle.driver" class="flex items-center gap-2.5 text-muted-foreground">
              <User class="h-4 w-4 shrink-0" />
              <dd class="font-medium text-foreground">{{ store.selectedVehicle.driver }}</dd>
            </div>
            <div v-else class="flex items-center gap-2.5 text-muted-foreground">
              <User class="h-4 w-4 shrink-0" />
              <dd>Řidič neznámý</dd>
            </div>
            <div class="flex items-center gap-2.5 text-muted-foreground">
              <Navigation class="h-4 w-4 shrink-0" />
              <dd class="font-mono text-sm tabular-nums">
                {{ store.selectedVehicle.lat.toFixed(5) }}, {{ store.selectedVehicle.lng.toFixed(5) }}
              </dd>
            </div>
            <div class="flex items-center gap-2.5 text-muted-foreground">
              <Clock class="h-4 w-4 shrink-0" />
              <dd>{{ fmtDate(store.selectedVehicle.lastUpdate) }}</dd>
            </div>
            <div v-if="store.selectedVehicle.odometer > 0" class="flex items-center gap-2.5 text-muted-foreground">
              <Milestone class="h-4 w-4 shrink-0" />
              <dd>{{ store.selectedVehicle.odometer.toLocaleString('cs-CZ') }} km</dd>
            </div>
          </dl>

          <!-- Weather -->
          <div class="rounded-lg bg-secondary/60 px-3 py-2.5">
            <p class="mb-1 text-muted-foreground">Počasí v místě vozidla</p>
            <p v-if="vehicleWeather.loading.value" class="animate-pulse text-muted-foreground">Načítám…</p>
            <p v-else-if="vehicleWeather.data.value" class="font-medium">
              {{ vehicleWeather.data.value.icon }}
              {{ vehicleWeather.data.value.temperature }}°C ·
              {{ vehicleWeather.data.value.condition }} · 💨
              {{ vehicleWeather.data.value.windSpeed }} km/h
            </p>
            <p v-else class="text-muted-foreground">Nedostupné</p>
          </div>

          <!-- Actions -->
          <VehicleActions :vehicle-id="store.selectedVehicle.id" variant="sidebar" />

          <!-- Redirect to overview -->
          <button
            class="flex w-full items-center justify-center gap-2 rounded-lg border border-border
                   bg-secondary px-3 py-2.5 text-sm font-medium text-foreground
                   transition-colors hover:bg-secondary/60"
            @click="goToOverview"
          >
            <LayoutDashboard class="h-4 w-4" />
            Zobrazit v přehledu
          </button>
        </div>
      </Transition>
    </div>

    <!-- Empty state shown when no vehicles after load -->
    <EmptyState
      v-if="hasVehicles && displayedVehicles.length === 0"
      title="Žádná vozidla"
      :description="vehiclesWithPos.length === 0
        ? 'Načtená vozidla zatím nemají GPS pozici.'
        : 'Pro vybraný filtr nejsou k dispozici žádná vozidla.'"
    >
      <template #icon><MapPin class="h-10 w-10" /></template>
    </EmptyState>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  X, Gauge, Navigation, Clock, MapPin, User, Milestone, LayoutDashboard,
} from 'lucide-vue-next'
import { useFleetStore, type StatusFilter } from '@/store/fleetStore'
import { usePolling } from '@/composables/usePolling'
import { useWeather } from '@/composables/useWeather'
import StatusBadge    from '@/components/StatusBadge.vue'
import VehicleActions from '@/components/VehicleActions.vue'
import LoadingState   from '@/components/LoadingState.vue'
import ErrorState     from '@/components/ErrorState.vue'
import EmptyState     from '@/components/EmptyState.vue'
import RefreshInfo    from '@/components/RefreshInfo.vue'
import type { Vehicle, VehicleStatus } from '@/types'

// ── Fix Leaflet icon paths (Vite breaks defaults) ────────────────────────────
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Poll every 10 s — industry standard for live fleet tracking.
 * GPS units transmit every 5–30 s; polling faster than 10 s has no benefit.
 */
const POLL_INTERVAL = 10_000

const STATUS_COLORS: Record<VehicleStatus, string> = {
  moving:  '#22c55e',
  idle:    '#eab308',
  offline: '#6b7280',
}

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'Vše'      },
  { key: 'moving',  label: 'V pohybu' },
  { key: 'idle',    label: 'Nečinné'  },
  { key: 'offline', label: 'Offline'  },
]

// ── Store + router ───────────────────────────────────────────────────────────

const store  = useFleetStore()
const router = useRouter()

usePolling(store.loadVehicles, POLL_INTERVAL)

// ── Map internals ─────────────────────────────────────────────────────────────

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
const markers = new Map<string, L.Marker>()  // vehicleId → marker
let mapInitialized = false
let boundsSetOnce  = false
let autoFocusDone  = false  // ensures we only auto-focus once per page visit

function posAgeMin(v: Vehicle): number {
  if (!v.lastUpdate) return Infinity
  return (Date.now() - new Date(v.lastUpdate).getTime()) / 60_000
}

function makeIcon(status: VehicleStatus, selected: boolean, stalePos = false): L.DivIcon {
  const size   = selected ? 20 : 14
  const color  = stalePos ? '#94a3b8' : STATUS_COLORS[status]   // grey out stale markers
  const glow   = stalePos ? 'none' : (selected ? `0 0 16px ${color}cc` : `0 0 8px ${color}80`)
  const bpx    = selected ? 3 : 2
  const border = stalePos
    ? `${bpx}px dashed rgba(148,163,184,0.6)`                   // dashed = stale
    : `${bpx}px solid rgba(15,23,42,0.9)`
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:${glow};transition:all 0.25s ease;opacity:${stalePos ? 0.55 : 1};"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function buildPopupHtml(v: Vehicle): string {
  const color  = STATUS_COLORS[v.status]
  const labels: Record<VehicleStatus, string> = { moving: 'V pohybu', idle: 'Nečinné', offline: 'Offline' }
  const speedSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;opacity:.65"><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"/><path d="M20.9 12.9a9 9 0 1 0-1.57 4.48"/></svg>`
  const clockSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;opacity:.65"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
  const userSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;opacity:.65"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`

  return `
    <div style="min-width:180px;font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;color:#e2e8f0">
      <div style="font-size:15px;font-weight:700;margin-bottom:2px">${v.name}</div>
      ${v.plate ? `<div style="font-size:13px;color:#94a3b8;margin-bottom:6px">${v.plate}</div>` : ''}
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:7px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}99;flex-shrink:0"></span>
        <span style="font-weight:500">${labels[v.status]}</span>
      </div>
      <div style="margin-bottom:4px">${speedSvg}<strong>${v.speed > 0 ? v.speed + ' km/h' : 'Stojí'}</strong></div>
      ${v.driver ? `<div style="margin-bottom:4px">${userSvg}${v.driver}</div>` : ''}
      <div style="color:#94a3b8;font-size:12px">${clockSvg}${new Date(v.lastUpdate).toLocaleString('cs-CZ')}</div>
      ${posAgeMin(v) > 5 ? `<div style="margin-top:7px;padding:5px 8px;background:#7c3aed22;border:1px solid #7c3aed55;border-radius:6px;font-size:11px;color:#a78bfa;line-height:1.4">
        ⚠ Poloha neaktuální (GPS Dozor neposílá live souřadnice pro toto vozidlo)
      </div>` : ''}
    </div>
  `
}

// Called after markers are synced. If a vehicle was pre-selected (navigated
// from another page via Na mapě button), fly to it and open its popup.
// The `autoFocusDone` flag prevents re-triggering on every 10-second poll.
function autoFocusSelected(): void {
  if (autoFocusDone || !map || !store.selectedVehicleId) return
  const id = store.selectedVehicleId
  const v  = store.vehicles.find((x) => x.id === id)
  if (!v?.lat || !v?.lng) return
  autoFocusDone = true
  map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 13), { duration: 0.8 })
  setTimeout(() => { markers.get(id)?.openPopup() }, 900)
}

function initMap(): void {
  if (mapInitialized || !mapEl.value) return
  mapInitialized = true

  map = L.map(mapEl.value, { zoomControl: false }).setView([50.075, 14.44], 7)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // Sync existing vehicles if they loaded before the map was created
  if (store.vehicles.length > 0) syncMarkers(store.vehicles)
}

onMounted(initMap)
onUnmounted(() => { map?.remove(); map = null; mapInitialized = false })

// ── Marker sync ───────────────────────────────────────────────────────────────

function syncMarkers(vehicles: Vehicle[]): void {
  if (!map) return

  const filter = store.statusFilter
  const seen   = new Set<string>()

  for (const v of vehicles) {
    if (!v.lat || !v.lng) continue
    seen.add(v.id)

    const selected  = v.id === store.selectedVehicleId
    const stalePos  = posAgeMin(v) > 5 && v.speed > 0   // moving but position not updating
    const icon      = makeIcon(v.status, selected, stalePos)
    const pos: L.LatLngExpression = [v.lat, v.lng]
    const visible  = filter === 'all' || v.status === filter

    if (markers.has(v.id)) {
      // UPDATE existing marker — move it and refresh popup
      const m = markers.get(v.id)!
      m.setLatLng(pos).setIcon(icon)
      m.getPopup()?.setContent(buildPopupHtml(v))
      if (visible  && !map.hasLayer(m)) m.addTo(map)
      if (!visible && map.hasLayer(m))  m.remove()
    } else {
      // CREATE new marker
      const m = L.marker(pos, { icon })
        .bindPopup(buildPopupHtml(v), { maxWidth: 250 })
      m.on('click', () => { store.selectVehicle(v.id); m.openPopup() })
      if (visible) m.addTo(map)
      markers.set(v.id, m)
    }
  }

  // Remove stale markers
  for (const [id, m] of markers) {
    if (!seen.has(id)) { m.remove(); markers.delete(id) }
  }

  // Fit bounds once on first load
  if (!boundsSetOnce && markers.size > 0) {
    boundsSetOnce = true
    const lls = [...markers.values()]
      .filter((m) => map!.hasLayer(m))
      .map((m) => m.getLatLng())
    if (lls.length === 1)  map.setView(lls[0], 13)
    else if (lls.length > 1) map.fitBounds(L.latLngBounds(lls), { padding: [50, 50], maxZoom: 13 })
  }
}

// Re-sync on every vehicle update (polled every 10 s)
watch(() => [...store.vehicles], () => {
  if (!map && mapEl.value) initMap()
  syncMarkers(store.vehicles)
  autoFocusSelected()
}, { deep: true })

// Re-sync when filter changes
watch(() => store.statusFilter, () => syncMarkers(store.vehicles))

// ── Fly to selected vehicle ───────────────────────────────────────────────────

watch(() => store.selectedVehicleId, (id) => {
  if (!map) return

  // Update icon highlights on all markers
  for (const [vid, m] of markers) {
    const v = store.vehicles.find((x) => x.id === vid)
    if (v) m.setIcon(makeIcon(v.status, vid === id))
  }

  if (!id) { autoFocusDone = false; return }
  const v = store.vehicles.find((x) => x.id === id)
  if (v?.lat && v?.lng) {
    map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 13), { duration: 0.8 })
    setTimeout(() => { markers.get(id)?.openPopup() }, 900)
  }
})

// ── Global search → select matching vehicle ────────────────────────────────────

watch(() => store.searchQuery, (q) => {
  if (!q.trim()) return
  const lower = q.toLowerCase()
  const match = store.vehicles.find((v) =>
    v.name.toLowerCase().includes(lower) ||
    v.plate.toLowerCase().replace(/\s/g, '').includes(lower.replace(/\s/g, '')) ||
    (v.driver?.toLowerCase().includes(lower) ?? false)
  )
  if (match) store.selectVehicle(match.id)
})

// ── Navigation ────────────────────────────────────────────────────────────────

function goToOverview(): void {
  if (store.selectedVehicle) {
    store.highlightVehicle(store.selectedVehicle.id)
    router.push('/')
  }
}

// ── Weather ───────────────────────────────────────────────────────────────────

const selectedLat    = computed(() => store.selectedVehicle?.lat ?? 0)
const selectedLng    = computed(() => store.selectedVehicle?.lng ?? 0)
const vehicleWeather = useWeather(selectedLat, selectedLng)

// ── Derived ───────────────────────────────────────────────────────────────────

const hasVehicles = computed(() => store.vehicles.length > 0 || store.loading.vehicles)

const vehiclesWithPos = computed(() =>
  store.vehicles.filter((v) => v.lat !== 0 && v.lng !== 0)
)

const displayedVehicles = computed(() =>
  store.statusFilter === 'all'
    ? vehiclesWithPos.value
    : vehiclesWithPos.value.filter((v) => v.status === store.statusFilter)
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return iso ? new Date(iso).toLocaleString('cs-CZ') : '—'
}
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.slide-enter-from,  .slide-leave-to      { opacity: 0; transform: translateX(12px); }
</style>
