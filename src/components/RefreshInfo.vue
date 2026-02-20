<template>
  <div class="flex items-center gap-3 text-xs text-muted-foreground">
    <span class="flex items-center gap-1">
      <Clock class="h-3 w-3" />
      {{ timeAgo }}
    </span>
    <span class="text-border">|</span>
    <span class="flex items-center gap-1">
      <RefreshCw class="h-3 w-3" />
      {{ secondsLeft }}s
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Clock, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{ lastUpdated: string | null; intervalMs: number }>()

const secondsLeft = ref(Math.floor(props.intervalMs / 1000))
let timer: ReturnType<typeof setInterval>

function restart() {
  clearInterval(timer)
  secondsLeft.value = Math.floor(props.intervalMs / 1000)
  timer = setInterval(() => {
    secondsLeft.value = secondsLeft.value <= 1
      ? Math.floor(props.intervalMs / 1000)
      : secondsLeft.value - 1
  }, 1000)
}

watch(() => props.lastUpdated, restart)
onMounted(restart)
onUnmounted(() => clearInterval(timer))

const timeAgo = computed(() =>
  props.lastUpdated
    ? new Date(props.lastUpdated).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
)
</script>
