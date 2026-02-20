<template>
  <div class="space-y-3 rounded-xl border border-border bg-card p-4">

    <!-- ── Inputs + presets row ──────────────────────────────── -->
    <div class="flex flex-wrap items-end gap-3">
      <slot name="vehicle-select" />

      <div>
        <label class="mb-1 block text-xs text-muted-foreground">Od</label>
        <input
          type="date" :value="modelFrom" :max="today"
          :class="['input-base', fromInvalid && 'border-destructive focus:ring-destructive']"
          @change="$emit('update:from', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div>
        <label class="mb-1 block text-xs text-muted-foreground">Do</label>
        <input
          type="date" :value="modelTo" :max="today"
          :class="['input-base', toInvalid && 'border-destructive focus:ring-destructive']"
          @change="$emit('update:to', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="flex items-end gap-2">
        <button
          v-for="preset in DATE_PRESETS" :key="preset.label"
          :class="['rounded-full px-4 py-2 text-sm font-medium transition-colors',
            isActivePreset(preset.days)
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground']"
          @click="$emit('preset', preset.days)"
        >{{ preset.label }}</button>
      </div>
    </div>

    <!-- ── Validation error ───────────────────────────────────── -->
    <div v-if="error" class="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle class="h-4 w-4 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- ── Range info ─────────────────────────────────────────── -->
    <p v-else-if="days > 0" class="text-xs text-muted-foreground">
      Vybrané období: {{ days }} {{ pluralDays(days) }} · max. 1 měsíc
    </p>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { DATE_PRESETS, isValidDate, TODAY, daysAgo, oneMonthAgo } from '@/utils/dateUtils'

const props = defineProps<{
  modelFrom: string
  modelTo:   string
  error:     string | null
  days:      number
  loading?:  boolean
}>()

defineEmits<{
  (e: 'update:from', value: string): void
  (e: 'update:to',   value: string): void
  (e: 'preset',      days: number):  void
}>()

const today = TODAY

/**
 * Determines whether a preset button should appear active.
 * days === 0  → Dnes
 * days === -1 → Měsíc (same calendar day last month)
 * days > 0   → N days ago
 */
function isActivePreset(daysBack: number): boolean {
  if (props.modelTo !== TODAY) return false
  if (daysBack === 0)  return props.modelFrom === TODAY
  if (daysBack === -1) return props.modelFrom === oneMonthAgo()
  return props.modelFrom === daysAgo(daysBack)
}

const fromInvalid = computed(() => !isValidDate(props.modelFrom))
const toInvalid   = computed(() =>  isValidDate(props.modelFrom) && !isValidDate(props.modelTo))

function pluralDays(n: number): string {
  return n === 1 ? 'den' : n < 5 ? 'dny' : 'dní'
}
</script>

<style scoped>
.input-base {
  @apply h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground
         focus:outline-none focus:ring-2 focus:ring-ring;
}
</style>
