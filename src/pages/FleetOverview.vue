<template>
  <div class="space-y-6">

    <!-- ── Header ────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Přehled flotily</h1>
        <p class="text-muted-foreground">Stav vašich vozidel v reálném čase</p>
      </div>
      <RefreshInfo :last-updated="store.lastUpdated" :interval-ms="POLL_INTERVAL" />
    </div>

    <!-- ── KPI cards ─────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KPICard
        v-for="kpi in kpiCards" :key="kpi.title"
        :title="kpi.title" :value="kpi.value"
        :loading="store.loading.vehicles && !store.vehicles.length"
      >
        <template #icon>
          <component :is="kpi.icon" :class="['h-5 w-5', kpi.color]" />
        </template>
      </KPICard>
    </div>

    <!-- ── Status filter + reset ─────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="opt in FILTER_OPTIONS" :key="opt.key"
        :class="['rounded-full px-4 py-2 font-medium transition-colors',
          store.statusFilter === opt.key
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
        @click="store.setStatusFilter(opt.key)"
      >
        {{ opt.label }}
        <span class="ml-1.5 tabular-nums opacity-70">{{ store.vehicleCounts[opt.countKey] }}</span>
      </button>

      <!-- Reset button — only visible when any filter/sort is active -->
      <button
        v-if="store.statusFilter !== 'all' || sortKey !== 'name' || sortDir !== 'asc'"
        class="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 font-medium
               text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        @click="resetFilters"
      >
        <RotateCcw class="h-3.5 w-3.5" />
        Resetovat filtry
      </button>
    </div>

    <!-- ── States ────────────────────────────────────────────── -->
    <ErrorState
      v-if="store.errors.vehicles && !store.vehicles.length"
      :message="store.errors.vehicles"
      :on-retry="store.loadVehicles"
    />
    <LoadingState v-else-if="store.loading.vehicles && !store.vehicles.length" :rows="5" />
    <EmptyState v-else-if="!sorted.length" title="Žádná vozidla" :description="emptyDescription">
      <template #icon><Car class="h-10 w-10" /></template>
    </EmptyState>

    <!-- ── Vehicle table ─────────────────────────────────────── -->
    <div v-else class="overflow-x-auto rounded-xl border border-border bg-card">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <th class="px-5 py-3">
              <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('name')">
                Vozidlo
                <ArrowUp      v-if="sortKey === 'name' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                <ArrowDown    v-else-if="sortKey === 'name' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
              </button>
            </th>
            <th class="px-5 py-3">Stav</th>
            <th class="hidden px-5 py-3 sm:table-cell">
              <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('speed')">
                Rychlost
                <ArrowUp      v-if="sortKey === 'speed' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                <ArrowDown    v-else-if="sortKey === 'speed' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
              </button>
            </th>
            <th class="hidden px-5 py-3 md:table-cell">
              <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('driver')">
                Řidič
                <ArrowUp      v-if="sortKey === 'driver' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                <ArrowDown    v-else-if="sortKey === 'driver' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
              </button>
            </th>
            <th class="hidden px-5 py-3 lg:table-cell">
              <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('odometer')">
                Odometr
                <ArrowUp      v-if="sortKey === 'odometer' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                <ArrowDown    v-else-if="sortKey === 'odometer' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
              </button>
            </th>
            <th class="px-5 py-3">
              <button class="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors" @click="setSort('lastUpdate')">
                Poslední záznam
                <ArrowUp      v-if="sortKey === 'lastUpdate' && sortDir === 'asc'"  class="h-3.5 w-3.5 shrink-0" />
                <ArrowDown    v-else-if="sortKey === 'lastUpdate' && sortDir === 'desc'" class="h-3.5 w-3.5 shrink-0" />
                <ArrowUpDown  v-else class="h-3.5 w-3.5 shrink-0 opacity-30" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/50">
          <tr
            v-for="vehicle in sorted" :key="vehicle.id"
            class="cursor-pointer transition-colors hover:bg-secondary/40"
            @click="openDetail(vehicle)"
          >
            <td class="px-5 py-4">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-semibold">{{ vehicle.name }}</div>
                  <div v-if="vehicle.plate" class="text-muted-foreground">{{ vehicle.plate }}</div>
                </div>
                <div class="shrink-0" @click.stop>
                  <VehicleActions :vehicle-id="vehicle.id" variant="row" />
                </div>
              </div>
            </td>
            <td class="px-5 py-4">
              <StatusBadge :status="vehicle.status" />
            </td>
            <td class="hidden px-5 py-4 tabular-nums sm:table-cell">
              {{ vehicle.speed > 0 ? `${vehicle.speed} km/h` : '—' }}
            </td>
            <td class="hidden px-5 py-4 text-muted-foreground md:table-cell">
              {{ vehicle.driver || '—' }}
            </td>
            <td class="hidden px-5 py-4 tabular-nums text-muted-foreground lg:table-cell">
              {{ vehicle.odometer > 0 ? vehicle.odometer.toLocaleString('cs-CZ') + ' km' : '—' }}
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-muted-foreground">
              {{ fmtDate(vehicle.lastUpdate) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Detail drawer ─────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="selected" class="fixed inset-0 z-50 flex" @click.self="closeDetail">
          <div class="ml-auto flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl">

            <!-- Drawer header -->
            <div class="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <p class="text-lg font-bold">{{ selected.name }}</p>
                <p class="text-muted-foreground">{{ selected.plate }}</p>
              </div>
              <button
                class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                @click="closeDetail"
              ><X class="h-5 w-5" /></button>
            </div>

            <!-- Drawer body -->
            <div class="flex-1 space-y-5 overflow-y-auto p-6">

              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Stav</span>
                <StatusBadge :status="selected.status" size="md" />
              </div>

              <div class="flex items-center gap-2.5">
                <User class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="font-medium">{{ selected.driver || 'Řidič neznámý' }}</span>
              </div>

              <div class="h-px bg-border" />

              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-xl border border-border bg-secondary p-4">
                  <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Gauge class="h-4 w-4" /> Rychlost
                  </p>
                  <p class="text-xl font-bold">{{ selected.speed > 0 ? `${selected.speed} km/h` : '0 km/h' }}</p>
                </div>
                <div class="rounded-xl border border-border bg-secondary p-4">
                  <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Milestone class="h-4 w-4" /> Odometr
                  </p>
                  <p class="text-xl font-bold">
                    {{ selected.odometer > 0 ? selected.odometer.toLocaleString('cs-CZ') + ' km' : '—' }}
                  </p>
                </div>
                <div class="rounded-xl border border-border bg-secondary p-4">
                  <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Zap class="h-4 w-4" /> Zapalování
                  </p>
                  <p class="text-xl font-bold" :class="ignitionOn(selected) ? 'text-green-400' : 'text-muted-foreground'">
                    {{ ignitionOn(selected) ? 'Zapnuto' : 'Vypnuto' }}
                  </p>
                </div>
                <div class="rounded-xl border border-border bg-secondary p-4">
                  <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Fuel class="h-4 w-4" /> Palivo
                  </p>
                  <p class="text-xl font-bold">{{ selected.fuelLevel != null ? selected.fuelLevel + '%' : '—' }}</p>
                </div>
              </div>

              <VehicleActions :vehicle-id="selected.id" variant="drawer" @close="closeDetail" />

              <div class="h-px bg-border" />

              <dl class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <dt class="flex items-center gap-1.5 text-muted-foreground">
                    <Clock class="h-4 w-4" /> Poslední aktualizace
                  </dt>
                  <dd class="font-medium">{{ fmtDate(selected.lastUpdate) }}</dd>
                </div>
                <div v-if="selected.lat && selected.lng" class="flex items-center justify-between gap-2">
                  <dt class="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin class="h-4 w-4" /> Pozice (GPS)
                  </dt>
                  <dd class="font-mono">{{ selected.lat.toFixed(5) }}, {{ selected.lng.toFixed(5) }}</dd>
                </div>
              </dl>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Car, Activity, PauseCircle, WifiOff,
  X, Clock, MapPin, Gauge, Zap, Fuel, User, Milestone, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw,
} from 'lucide-vue-next'
import { useFleetStore, type StatusFilter } from '@/store/fleetStore'
import { usePolling } from '@/composables/usePolling'
import KPICard        from '@/components/KPICard.vue'
import StatusBadge    from '@/components/StatusBadge.vue'
import VehicleActions from '@/components/VehicleActions.vue'
import LoadingState   from '@/components/LoadingState.vue'
import ErrorState     from '@/components/ErrorState.vue'
import EmptyState     from '@/components/EmptyState.vue'
import RefreshInfo    from '@/components/RefreshInfo.vue'
import type { Vehicle } from '@/types'

// ── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 10_000

const FILTER_OPTIONS = [
  { key: 'all'     as StatusFilter, label: 'Vše',      countKey: 'total'   as const },
  { key: 'moving'  as StatusFilter, label: 'V pohybu', countKey: 'moving'  as const },
  { key: 'idle'    as StatusFilter, label: 'Nečinné',  countKey: 'idle'    as const },
  { key: 'offline' as StatusFilter, label: 'Offline',  countKey: 'offline' as const },
]

// ── Store + polling ──────────────────────────────────────────────────────────

const store = useFleetStore()
usePolling(store.loadVehicles, POLL_INTERVAL)

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'speed' | 'driver' | 'odometer' | 'lastUpdate'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('name')
const sortDir = ref<SortDir>('asc')

function setSort(col: SortKey) {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col
    sortDir.value = 'asc'
  }
}

function resetFilters() {
  store.setStatusFilter('all')
  sortKey.value = 'name'
  sortDir.value = 'asc'
}

// ── Filtering + sorting ───────────────────────────────────────────────────────

const filtered = computed<Vehicle[]>(() => {
  const byStatus = store.statusFilter === 'all'
    ? store.vehicles
    : store.vehicles.filter((v) => v.status === store.statusFilter)

  const q = store.searchQuery.trim().toLowerCase()
  if (!q) return byStatus

  return byStatus.filter((v) =>
    v.name.toLowerCase().includes(q) ||
    v.plate.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
    (v.driver?.toLowerCase().includes(q) ?? false)
  )
})

const sorted = computed<Vehicle[]>(() => {
  const arr = [...filtered.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return arr.sort((a, b) => {
    switch (sortKey.value) {
      case 'name':       return dir * a.name.localeCompare(b.name, 'cs')
      case 'speed':      return dir * (a.speed - b.speed)
      case 'driver':     return dir * (a.driver ?? '').localeCompare(b.driver ?? '', 'cs')
      case 'odometer':   return dir * (a.odometer - b.odometer)
      case 'lastUpdate': return dir * a.lastUpdate.localeCompare(b.lastUpdate)
      default:           return 0
    }
  })
})

// ── Drawer ────────────────────────────────────────────────────────────────────

const selected = ref<Vehicle | null>(null)

function openDetail(v: Vehicle): void { selected.value = v }
function closeDetail():          void { selected.value = null }

watch(() => store.highlightVehicleId, (id) => {
  if (!id) return
  const v = store.vehicles.find((x) => x.id === id)
  if (v) { openDetail(v); store.clearHighlight() }
}, { immediate: true })

watch(() => store.vehicles, () => {
  const id = store.highlightVehicleId
  if (!id) return
  const v = store.vehicles.find((x) => x.id === id)
  if (v) { openDetail(v); store.clearHighlight() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyDescription = computed(() =>
  store.searchQuery
    ? `Žádná vozidla neodpovídají hledání: "${store.searchQuery}"`
    : 'Flotila je prázdná.'
)

function ignitionOn(v: Vehicle): boolean {
  return typeof v.ignition === 'boolean' ? v.ignition : v.speed > 0
}

function fmtDate(iso: string): string {
  return iso ? new Date(iso).toLocaleString('cs-CZ') : '—'
}

const kpiCards = computed(() => [
  { title: 'Celkem vozidel', value: store.vehicleCounts.total,   icon: Car,         color: 'text-primary'     },
  { title: 'V pohybu',       value: store.vehicleCounts.moving,  icon: Activity,    color: 'text-green-400'  },
  { title: 'Nečinné',        value: store.vehicleCounts.idle,    icon: PauseCircle, color: 'text-yellow-400' },
  { title: 'Offline',        value: store.vehicleCounts.offline, icon: WifiOff,     color: 'text-neutral-400'},
])
</script>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from,  .drawer-leave-to      { opacity: 0; }
</style>
