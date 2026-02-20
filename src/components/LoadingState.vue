<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />
      {{ message }}
    </div>
    <div v-for="i in rows" :key="i" class="h-14 animate-pulse rounded-xl bg-card" />
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
withDefaults(defineProps<{ message?: string; rows?: number }>(), {
  message: 'Načítání dat…',
  rows: 3,
})
</script>
