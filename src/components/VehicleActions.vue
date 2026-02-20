<!--
  VehicleActions — unified action buttons.
  variant="drawer"   → FleetOverview sidebar: Na mapě + Historie + Události (full-width 3-col)
  variant="sidebar"  → LiveMap card: Historie + Události only (full-width 2-col, no Na mapě)
  variant="row"      → FleetOverview table: Na mapě + Historie + Události icon-only inline
  variant="trip-row" → TripHistory table: Na mapě + Události + Přehled icon-only inline
  variant="event-row"→ Events list: Na mapě + Historie + Přehled icon-only inline
-->
<template>
  <!-- Full-width drawer: 3 columns -->
  <div v-if="variant === 'drawer'" class="grid grid-cols-3 gap-2">
    <RouterLink to="/map"     :class="btn" @click="goMap"><Map class="h-4 w-4" /><span>Na mapě</span></RouterLink>
    <RouterLink to="/history" :class="btn" @click="goHistory"><Clock class="h-4 w-4" /><span>Historie</span></RouterLink>
    <RouterLink to="/events"  :class="btn" @click="goEvents"><AlertTriangle class="h-4 w-4" /><span>Události</span></RouterLink>
  </div>

  <!-- Full-width sidebar: 2 columns (no Na mapě — already on the map) -->
  <div v-else-if="variant === 'sidebar'" class="grid grid-cols-2 gap-2">
    <RouterLink to="/history" :class="btn" @click="goHistory"><Clock class="h-4 w-4" /><span>Historie</span></RouterLink>
    <RouterLink to="/events"  :class="btn" @click="goEvents"><AlertTriangle class="h-4 w-4" /><span>Události</span></RouterLink>
  </div>

  <!-- Inline icon-only: FleetOverview rows — Na mapě + Historie + Události -->
  <div v-else-if="variant === 'row'" class="flex items-center gap-1">
    <RouterLink to="/map"     :class="rowBtn" @click="goMap"     title="Na mapě"><Map class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/history" :class="rowBtn" @click="goHistory" title="Historie jízd"><Clock class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/events"  :class="rowBtn" @click="goEvents"  title="Události"><AlertTriangle class="h-3.5 w-3.5" /></RouterLink>
  </div>

  <!-- Inline icon-only: TripHistory rows — Na mapě + Události + Přehled -->
  <div v-else-if="variant === 'trip-row'" class="flex items-center gap-1">
    <RouterLink to="/map"    :class="rowBtn" @click="goMap"      title="Na mapě"><Map class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/events" :class="rowBtn" @click="goEvents"   title="Události"><AlertTriangle class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/"       :class="rowBtn" @click="goOverview" title="Zobrazit v přehledu"><LayoutDashboard class="h-3.5 w-3.5" /></RouterLink>
  </div>

  <!-- Inline icon-only: Events rows — Na mapě + Historie + Přehled -->
  <div v-else-if="variant === 'event-row'" class="flex items-center gap-1">
    <RouterLink to="/map"     :class="rowBtn" @click="goMap"      title="Na mapě"><Map class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/history" :class="rowBtn" @click="goHistory"  title="Historie jízd"><Clock class="h-3.5 w-3.5" /></RouterLink>
    <RouterLink to="/"        :class="rowBtn" @click="goOverview" title="Zobrazit v přehledu"><LayoutDashboard class="h-3.5 w-3.5" /></RouterLink>
  </div>
</template>

<script setup lang="ts">
import { Map, Clock, AlertTriangle, LayoutDashboard } from 'lucide-vue-next'
import { useFleetStore } from '@/store/fleetStore'

const props = withDefaults(
  defineProps<{
    vehicleId: string
    variant?: 'drawer' | 'sidebar' | 'row' | 'trip-row' | 'event-row'
  }>(),
  { variant: 'drawer' }
)

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useFleetStore()

/** Na mapě — select vehicle so LiveMap flies to it and opens popup */
function goMap() {
  store.selectVehicle(props.vehicleId)
  emit('close')
}

/** Historie — signals TripHistory to pre-select this vehicle and apply Měsíc preset. */
function goHistory() {
  store.navigateToHistory(props.vehicleId)
  emit('close')
}

/** Události — signals Events to pre-select this vehicle and apply Měsíc preset. */
function goEvents() {
  store.navigateToEvents(props.vehicleId)
  emit('close')
}

/** Zobrazit v přehledu — navigates to FleetOverview and opens the vehicle drawer. */
function goOverview() {
  store.highlightVehicle(props.vehicleId)
  emit('close')
}

// All full-width buttons: same bordered secondary style
const btn = [
  'flex flex-col items-center justify-center gap-1.5 rounded-lg',
  'border border-border bg-secondary text-foreground',
  'px-2 py-2.5 text-xs font-medium',
  'transition-colors hover:bg-secondary/60',
].join(' ')

// All inline icon-only buttons: same small bordered square
const rowBtn = [
  'flex items-center justify-center rounded-md p-1.5',
  'border border-border text-muted-foreground',
  'transition-colors hover:bg-secondary hover:text-foreground',
].join(' ')
</script>
