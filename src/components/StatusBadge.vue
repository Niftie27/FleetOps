<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full font-medium',
    size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
    config.className]">
    <span :class="['h-1.5 w-1.5 rounded-full', dotClass]" />
    {{ config.label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: 'moving' | 'idle' | 'offline'; size?: 'sm' | 'md' }>()

const statusConfig = {
  moving: { label: 'V pohybu', className: 'bg-green-500/15 text-green-400' },
  idle:   { label: 'Nečinné',  className: 'bg-yellow-500/15 text-yellow-400' },
  offline:{ label: 'Offline',  className: 'bg-neutral-500/15 text-neutral-400' },
}

const config = computed(() => statusConfig[props.status] ?? statusConfig.offline)
const dotClass = computed(() => ({
  moving:  'bg-green-400 animate-pulse',
  idle:    'bg-yellow-400',
  offline: 'bg-neutral-500',
}[props.status]))
</script>
