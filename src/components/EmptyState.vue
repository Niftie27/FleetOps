<template>
  <div class="flex h-60 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center">
    <div class="mb-3 text-muted-foreground">
      <slot name="icon"><Inbox class="h-10 w-10" /></slot>
    </div>
    <p class="text-lg font-medium">{{ title }}</p>
    <p class="mt-1 max-w-sm text-sm text-muted-foreground">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
defineProps<{ title: string; description: string }>()
</script>
