import { onMounted, onUnmounted } from "vue";

export function usePolling(fn: () => Promise<void> | void, intervalMs: number): void {
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(async () => {
    await fn();
    timer = setInterval(fn, intervalMs);
  });

  onUnmounted(() => {
    if (timer !== null) clearInterval(timer);
  });
}
