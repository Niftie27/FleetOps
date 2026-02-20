import { ref, computed, watch, onUnmounted } from "vue";
import {
  TODAY, daysAgo, oneMonthAgo, isValidDate, validateDateRange,
  calcBinHours, daysBetween, toApiFrom, toApiTo, DATE_PRESETS,
} from "@/utils/dateUtils";

export { DATE_PRESETS };

interface UseDateRangeOptions {
  defaultFrom?: string;
  defaultTo?: string;
  onValidChange?: (from: string, to: string, binHours: number) => void;
  debounceMs?: number;
}

export function useDateRange(options: UseDateRangeOptions = {}) {
  const {
    defaultFrom = daysAgo(6),
    defaultTo = TODAY,
    onValidChange,
    debounceMs = 600,
  } = options;

  const dateFrom = ref(defaultFrom);
  const dateTo = ref(defaultTo);

  const dateError = computed(() => validateDateRange(dateFrom.value, dateTo.value));
  const isValid = computed(() => dateError.value === null);
  const days = computed(() => daysBetween(dateFrom.value, dateTo.value));
  const binHours = computed(() => calcBinHours(dateFrom.value, dateTo.value));

  function setFrom(value: string): void {
    dateFrom.value = value;
    if (isValidDate(value) && isValidDate(dateTo.value) && value > dateTo.value) {
      dateTo.value = value;
    }
  }

  function setTo(value: string): void {
    dateTo.value = value;
    if (isValidDate(value) && isValidDate(dateFrom.value) && value < dateFrom.value) {
      dateFrom.value = value;
    }
  }

  /**
   * Preset logic:
   *   days === 0  → today only (Dnes)
   *   days === -1 → same calendar day last month (Měsíc) — e.g. Feb 19 → Jan 19
   *   days > 0   → daysAgo(days) → today, so days:6 → 7 inclusive days (7 dní)
   */
  function applyPreset(daysBack: number): void {
    dateTo.value = TODAY;
    if (daysBack === 0) {
      dateFrom.value = TODAY;
    } else if (daysBack === -1) {
      dateFrom.value = oneMonthAgo();
    } else {
      dateFrom.value = daysAgo(daysBack);
    }
  }

  function resetToSafeDefaults(): void {
    if (!isValidDate(dateFrom.value)) dateFrom.value = defaultFrom;
    if (!isValidDate(dateTo.value)) dateTo.value = defaultTo;
  }

  const apiFrom = computed(() => toApiFrom(dateFrom.value));
  const apiTo = computed(() => toApiTo(dateTo.value));

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function clearDebounce(): void {
    if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null; }
  }

  if (onValidChange) {
    watch([dateFrom, dateTo], () => {
      clearDebounce();
      if (!isValid.value) return;
      debounceTimer = setTimeout(() => {
        onValidChange(apiFrom.value, apiTo.value, binHours.value);
      }, debounceMs);
    });
  }

  onUnmounted(clearDebounce);

  return {
    dateFrom, dateTo, dateError, isValid, days, binHours,
    apiFrom, apiTo, setFrom, setTo, applyPreset, resetToSafeDefaults, TODAY,
  };
}
