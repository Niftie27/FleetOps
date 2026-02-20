<template>
  <div class="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-muted-foreground">{{ title }}</p>
        <p v-if="loading" class="mt-1 h-9 w-16 animate-pulse rounded-lg bg-secondary" />
        <p v-else :class="['mt-1 text-3xl font-bold', accent || 'text-foreground']">{{ value }}</p>
      </div>
      <div class="rounded-lg bg-secondary p-3">
        <slot name="icon" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  value?: number | string
  accent?: string
  loading?: boolean
}>()
</script>
