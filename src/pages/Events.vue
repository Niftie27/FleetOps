<template>
  <div class="space-y-6">

    <!-- ── Header ──────────────────────────────────────────── -->
    <div>
      <h1 class="text-2xl font-bold">Události a upozornění</h1>
      <p class="text-muted-foreground">Překročení rychlosti a dlouhé jízdy — odvozeno z dat jízd</p>
    </div>

    <!-- ── Filters ───────────────────────────────────────────── -->
    <DateRangeFilter
      :model-from="dateFrom" :model-to="dateTo"
      :error="dateError" :days="days" :loading="store.loading.events"
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

    <!-- ── Type filter pills (same style as status filter in FleetOverview) -->
    <div v-if="allEvents.length > 0" class="flex flex-wrap items-center gap-2">
      <button
        :class="['rounded-full px-4 py-2 font-medium transition-colors',
          typeFilter === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
        @click="typeFilter = null"
      >
        Vše
        <span class="ml-1.5 tabular-nums opacity-70">{{ allEvents.length }}</span>
      </button>
      <button
        :class="['flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors',
          typeFilter === 'speeding'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
        @click="typeFilter = typeFilter === 'speeding' ? null : 'speeding'"
      >
        <AlertTriangle class="h-4 w-4 text-yellow-400" />
        Překročení rychlosti
        <span class="ml-1.5 tabular-nums opacity-70">{{ speedingCount }}</span>
      </button>
      <button
        :class="['flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors',
          typeFilter === 'long_trip'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
        @click="typeFilter = typeFilter === 'long_trip' ? null : 'long_trip'"
      >
        <Info class="h-4 w-4 text-primary" />
        Dlouhé jízdy
        <span class="ml-1.5 tabular-nums opacity-70">{{ longTripCount }}</span>
      </button>
    </div>

    <!-- ── States ────────────────────────────────────────────── -->
    <ErrorState
      v-if="store.errors.events && store.events.length === 0"
      :message="store.errors.events" :on-retry="retry"
    />
    <EmptyState v-else-if="dateError" title="Neplatné datum" :description="dateError">
      <template #icon><AlertCircle class="h-10 w-10 text-destructive" /></template>
    </EmptyState>
    <LoadingState v-else-if="store.loading.events" :rows="3" />
    <EmptyState
      v-else-if="filtered.length === 0"
      title="Žádné události"
      :description="`Pro ${dateFrom} – ${dateTo} nebyly nalezeny žádné události.`"
    >
      <template #icon><Bell class="h-10 w-10" /></template>
    </EmptyState>

    <!-- ── Event list ─────────────────────────────────────────── -->
    <div v-else class="space-y-2">
      <div
        v-for="event in filtered" :key="event.id"
        class="flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-card p-5
               transition-colors hover:bg-secondary/30"
        @click="openDrawer(event.vehicleId)"
      >
        <!-- Severity icon -->
        <div :class="['mt-0.5 shrink-0 rounded-lg p-2', SEVERITY[event.severity].bg]">
          <component :is="SEVERITY[event.severity].icon"
                     :class="['h-4 w-4', SEVERITY[event.severity].text]" />
        </div>

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <!-- Vehicle name + severity badge + action buttons -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold">{{ vehicleName(event.vehicleId) }}</span>
            <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 font-medium',
              SEVERITY[event.severity].bg, SEVERITY[event.severity].text]">
              {{ SEVERITY[event.severity].label }}
            </span>
            <div @click.stop>
              <VehicleActions :vehicle-id="event.vehicleId" variant="event-row" />
            </div>
          </div>
          <!-- Event message -->
          <p class="mt-1 leading-snug text-muted-foreground">{{ event.message }}</p>
        </div>

        <!-- Timestamp -->
        <span class="shrink-0 whitespace-nowrap text-muted-foreground">
          {{ fmtDate(event.timestamp) }}
        </span>
      </div>
    </div>

  </div>

  <!-- Vehicle detail drawer -->
  <VehicleDrawer :vehicle="drawerVehicle" @close="closeDrawer" />

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-vue-next'
import { useFleetStore } from '@/store/fleetStore'
import { useDateRange } from '@/composables/useDateRange'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import VehicleActions  from '@/components/VehicleActions.vue'
import VehicleDrawer   from '@/components/VehicleDrawer.vue'
import LoadingState    from '@/components/LoadingState.vue'
import ErrorState      from '@/components/ErrorState.vue'
import EmptyState      from '@/components/EmptyState.vue'
import type { EventSeverity } from '@/types'
import type { Vehicle } from '@/types'

const store = useFleetStore()

if (store.vehicles.length === 0) store.loadVehicles()

// ── Handle "Události" button navigation from other pages ─────────────────────
// Any Události button sets store.eventsVehicleId. On mount (and when vehicles
// load if they weren't ready yet), we pick it up, pre-select the vehicle in the
// dropdown, apply the Měsíc preset, then clear the signal.
function applyEventsNavigation(): void {
  const id = store.eventsVehicleId
  if (!id) return
  if (store.vehicles.length === 0) return  // wait for vehicles to load
  // Apply preset FIRST so the selectedVehicleId watcher fires with correct dates
  applyPreset(-1)                          // -1 = Měsíc (one month back → today)
  selectedVehicleId.value = id
  store.clearEventsVehicle()
}

onMounted(applyEventsNavigation)

watch(() => store.vehicles.length, applyEventsNavigation)

const selectedVehicleId = ref('')
const typeFilter = ref<'speeding' | 'long_trip' | null>(null)

// Header search → pre-select vehicle; clear search → reset to all
watch(() => store.searchQuery, (q) => {
  const lower = q.trim().toLowerCase()
  if (!lower) {
    if (selectedVehicleId.value) selectedVehicleId.value = ''
    return
  }
  const match = store.vehicles.find((v) =>
    v.name.toLowerCase().includes(lower) ||
    v.plate.toLowerCase().replace(/\s/g, '').includes(lower.replace(/\s/g, ''))
  )
  if (match && match.id !== selectedVehicleId.value) selectedVehicleId.value = match.id
})

const {
  dateFrom, dateTo, dateError, isValid, days,
  apiFrom, apiTo, setFrom, setTo, applyPreset, resetToSafeDefaults,
} = useDateRange({ onValidChange: load })

watch(selectedVehicleId, () => { if (isValid.value) load(apiFrom.value, apiTo.value) })

watch(() => store.vehicles.length, (len) => {
  if (len > 0 && isValid.value && store.events.length === 0) load(apiFrom.value, apiTo.value)
}, { immediate: true })

function load(from: string, to: string): void {
  store.loadEvents(selectedVehicleId.value || undefined, from, to)
}

// ── Drawer ───────────────────────────────────────────────────────────────────

const drawerVehicle = ref<Vehicle | null>(null)

function openDrawer(vehicleId: string): void {
  const v = store.vehicles.find((x) => x.id === vehicleId)
  if (v) drawerVehicle.value = v
}

function closeDrawer(): void { drawerVehicle.value = null }

function retry(): void {
  resetToSafeDefaults()
  load(apiFrom.value, apiTo.value)
}

// All events matching date + vehicle (used for chip counts)
const allEvents = computed(() => {
  if (!isValid.value) return []
  const q = store.searchQuery.trim().toLowerCase()
  return store.events.filter((e) => {
    if (!e.timestamp) return false
    const d = e.timestamp.slice(0, 10)
    if (d < dateFrom.value || d > dateTo.value) return false
    if (q) {
      return (
        vehicleName(e.vehicleId).toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q)
      )
    }
    return true
  })
})

// filtered = allEvents further narrowed by active type chip
const filtered = computed(() => {
  if (!typeFilter.value) return allEvents.value
  return allEvents.value.filter((e) => e.type === typeFilter.value)
})

const speedingCount = computed(() => allEvents.value.filter((e) => e.type === 'speeding').length)
const longTripCount = computed(() => allEvents.value.filter((e) => e.type === 'long_trip').length)

type SeverityConfig = { icon: typeof AlertTriangle; bg: string; text: string; label: string }

const SEVERITY: Record<EventSeverity, SeverityConfig> = {
  high:   { icon: AlertTriangle, bg: 'bg-destructive/10', text: 'text-destructive', label: 'Vysoká' },
  medium: { icon: AlertCircle,   bg: 'bg-yellow-400/10',  text: 'text-yellow-400',  label: 'Střední' },
  low:    { icon: Info,          bg: 'bg-primary/10',     text: 'text-primary',     label: 'Nízká'  },
}

function vehicleName(id: string): string { return store.vehicles.find((v) => v.id === id)?.name ?? id }
function fmtDate(iso: string):    string { return iso ? new Date(iso).toLocaleString('cs-CZ') : '—' }
</script>

<style scoped>
.input-base {
  @apply h-10 rounded-lg border border-border bg-secondary px-3 text-foreground
         focus:outline-none focus:ring-2 focus:ring-ring;
}
</style>
