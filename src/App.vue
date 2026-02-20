<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <!-- Logo -->
      <div class="flex h-16 items-center gap-3 border-b border-border px-6">
        <Satellite class="h-6 w-6 text-primary" />
        <span class="text-lg font-bold text-foreground">FleetOps</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 space-y-1 px-3 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          custom
          v-slot="{ navigate, href, isActive }"
        >
          <a
            :href="href"
            @click="navigate"
            :class="[
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            ]"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </a>
        </RouterLink>
      </nav>

      <!-- Footer -->
      <div class="border-t border-border px-6 py-4">
        <p class="text-xs text-muted-foreground">Fleet Insights v1.0</p>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex h-16 items-center gap-4 border-b border-border bg-card px-6">
        <!-- Search -->
        <div class="relative max-w-md flex-1">
          <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="localQuery"
            type="text"
            placeholder="Hledat vozidlo, SPZ, řidiče..."
            class="w-full rounded-lg border border-border bg-secondary py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            @input="onSearch"
          />
        </div>

        <!-- Right side -->
        <div class="ml-auto flex items-center gap-3">
          <FleetWeather />

          <!-- Live API badge -->
          <span class="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
            <span class="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Live API
          </span>

          <!-- Last updated -->
          <span v-if="store.lastUpdated" class="hidden text-xs text-muted-foreground sm:inline">
            Aktualizace: {{ new Date(store.lastUpdated).toLocaleTimeString('cs-CZ') }}
          </span>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-auto p-4 lg:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Satellite, Search, LayoutDashboard, Map, Clock, AlertTriangle } from 'lucide-vue-next'
import { useFleetStore } from '@/store/fleetStore'
import FleetWeather from '@/components/FleetWeather.vue'

const store = useFleetStore()
const localQuery = ref(store.searchQuery)

let debounceTimer: ReturnType<typeof setTimeout>
function onSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => store.setSearchQuery(localQuery.value.trim()), 300)
}

watch(() => store.searchQuery, (v) => { if (v !== localQuery.value) localQuery.value = v })

const navItems = [
  { path: '/',        label: 'Přehled flotily', icon: LayoutDashboard },
  { path: '/map',     label: 'Živá mapa',        icon: Map             },
  { path: '/history', label: 'Historie jízd',    icon: Clock           },
  { path: '/events',  label: 'Události',          icon: AlertTriangle   },
]
</script>
