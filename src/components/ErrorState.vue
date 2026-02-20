<template>
  <div class="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-8 text-center">
    <AlertTriangle class="mb-3 h-10 w-10 text-destructive" />
    <p class="text-lg font-medium">Chyba při načítání</p>
    <p class="mt-1 max-w-md text-sm text-muted-foreground">{{ message }}</p>
    <button
      v-if="onRetry"
      @click="onRetry"
      class="mt-4 flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
    >
      <RefreshCw class="h-4 w-4" />
      Zkusit znovu
    </button>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'
defineProps<{ message: string; onRetry?: () => void }>()
</script>
