import { useEffect, useRef } from "react";

/**
 * Calls `callback` immediately and then every `intervalMs` milliseconds.
 * Clears the interval on unmount or when deps change.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCb = useRef(callback);

  // Keep ref current without re-creating interval
  useEffect(() => {
    savedCb.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    // Invoke immediately
    savedCb.current();
    const id = setInterval(() => savedCb.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
