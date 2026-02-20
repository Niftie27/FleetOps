<template>
  <span v-if="loading" class="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
    Počasí…
  </span>
  <span v-else-if="data" class="hidden items-center gap-2 rounded-lg bg-secondary/80 px-3 py-2 text-sm text-muted-foreground sm:inline-flex">
    <span class="text-base">{{ data.icon }}</span>
    <span class="text-sm font-bold text-foreground">{{ data.temperature }}°C</span>
    <span class="text-muted-foreground/50">·</span>
    <span>{{ data.condition }}</span>
    <span class="text-muted-foreground/50">·</span>
    <span>💨 {{ data.windSpeed }} km/h</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFleetStore } from '@/store/fleetStore'
import { useWeather } from '@/composables/useWeather'

const PRAGUE = { lat: 50.075, lng: 14.44 }

const store = useFleetStore()

const coords = computed(() => {
  const active = store.vehicles.filter((v: any) => v.lat && v.lng)
  if (!active.length) return PRAGUE
  return {
    lat: active.reduce((s: number, v: any) => s + v.lat, 0) / active.length,
    lng: active.reduce((s: number, v: any) => s + v.lng, 0) / active.length,
  }
})

const { data, loading } = useWeather(
  computed(() => coords.value.lat),
  computed(() => coords.value.lng)
)
</script>
