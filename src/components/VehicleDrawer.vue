<!-- ─── VehicleDrawer ────────────────────────────────────────────────────────
  Slide-in detail panel — identical layout to FleetOverview drawer.
  Used by: TripHistory, Events.
  Props: vehicle (Vehicle | null), emits: close
──────────────────────────────────────────────────────────────────────────── -->
<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="vehicle"
        class="fixed inset-0 z-50 flex"
        @click.self="$emit('close')"
      >
        <div class="ml-auto flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl">

          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <p class="text-lg font-bold">{{ vehicle.name }}</p>
              <p class="text-muted-foreground">{{ vehicle.plate }}</p>
            </div>
            <button
              class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              @click="$emit('close')"
            ><X class="h-5 w-5" /></button>
          </div>

          <!-- Body -->
          <div class="flex-1 space-y-5 overflow-y-auto p-6">

            <!-- Status -->
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Stav</span>
              <StatusBadge :status="vehicle.status" size="md" />
            </div>

            <!-- Driver -->
            <div class="flex items-center gap-2.5">
              <User class="h-4 w-4 shrink-0 text-muted-foreground" />
              <span class="font-medium">{{ vehicle.driver || 'Řidič neznámý' }}</span>
            </div>

            <div class="h-px bg-border" />

            <!-- Stat tiles 2×2 — exact same structure as FleetOverview -->
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl border border-border bg-secondary p-4">
                <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Gauge class="h-4 w-4" /> Rychlost
                </p>
                <p class="text-xl font-bold">{{ vehicle.speed > 0 ? `${vehicle.speed} km/h` : '0 km/h' }}</p>
              </div>
              <div class="rounded-xl border border-border bg-secondary p-4">
                <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Milestone class="h-4 w-4" /> Odometr
                </p>
                <p class="text-xl font-bold">
                  {{ vehicle.odometer > 0 ? vehicle.odometer.toLocaleString('cs-CZ') + ' km' : '—' }}
                </p>
              </div>
              <div class="rounded-xl border border-border bg-secondary p-4">
                <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Zap class="h-4 w-4" /> Zapalování
                </p>
                <p class="text-xl font-bold" :class="ignitionOn ? 'text-green-400' : 'text-muted-foreground'">
                  {{ ignitionOn ? 'Zapnuto' : 'Vypnuto' }}
                </p>
              </div>
              <div class="rounded-xl border border-border bg-secondary p-4">
                <p class="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Fuel class="h-4 w-4" /> Palivo
                </p>
                <p class="text-xl font-bold">{{ vehicle.fuelLevel != null ? vehicle.fuelLevel + '%' : '—' }}</p>
              </div>
            </div>

            <!-- Navigation buttons -->
            <VehicleActions :vehicle-id="vehicle.id" variant="drawer" @close="$emit('close')" />

            <!-- Zobrazit v přehledu -->
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-border
                     bg-secondary px-3 py-2.5 text-sm font-medium text-foreground
                     transition-colors hover:bg-secondary/60"
              @click="goToOverview"
            >
              <LayoutDashboard class="h-4 w-4" />
              Zobrazit v přehledu
            </button>

            <div class="h-px bg-border" />

            <!-- Info list -->
            <dl class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <dt class="flex items-center gap-1.5 text-muted-foreground">
                  <Clock class="h-4 w-4" /> Poslední aktualizace
                </dt>
                <dd class="font-medium">{{ fmtDate(vehicle.lastUpdate) }}</dd>
              </div>
              <div v-if="vehicle.lat && vehicle.lng" class="flex items-center justify-between gap-2">
                <dt class="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin class="h-4 w-4" /> Pozice (GPS)
                </dt>
                <dd class="font-mono">{{ vehicle.lat.toFixed(5) }}, {{ vehicle.lng.toFixed(5) }}</dd>
              </div>
            </dl>

            

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, Gauge, Zap, Fuel, User, Milestone, MapPin, Clock, LayoutDashboard } from 'lucide-vue-next'
import StatusBadge    from '@/components/StatusBadge.vue'
import { useFleetStore } from '@/store/fleetStore'
import VehicleActions from '@/components/VehicleActions.vue'
import type { Vehicle } from '@/types'

const props = defineProps<{ vehicle: Vehicle | null }>()
defineEmits<{ (e: 'close'): void }>()

const ignitionOn = computed(() => {
  if (!props.vehicle) return false
  return typeof props.vehicle.ignition === 'boolean'
    ? props.vehicle.ignition
    : props.vehicle.speed > 0
})

function fmtDate(iso: string): string {
  return iso ? new Date(iso).toLocaleString('cs-CZ') : '—'
}

const store  = useFleetStore()
const router = useRouter()

function goToOverview(): void {
  if (!props.vehicle) return
  store.highlightVehicle(props.vehicle.id)
  router.push('/')
}
</script>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from,  .drawer-leave-to      { opacity: 0; }
</style>
