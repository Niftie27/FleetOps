import { ref, watch, type Ref } from "vue";
import { fetchWeather } from "@/services/weatherService";
import type { WeatherData } from "@/types";

export function useWeather(lat: Ref<number>, lng: Ref<number>) {
  const data = ref<WeatherData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    if (!lat.value || !lng.value) return;
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetchWeather(lat.value, lng.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Chyba počasí";
      data.value = null;
    } finally {
      loading.value = false;
    }
  }

  watch([lat, lng], load, { immediate: true });

  return { data, loading, error };
}
