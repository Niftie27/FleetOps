// Shared date utilities for TripHistory and Events pages

export const TODAY = new Date().toISOString().slice(0, 10);

// 31 days = longest calendar month (January, March, May, July, August, October, December)
// This ensures "1 month" always works regardless of which month is selected.
export const MAX_RANGE_DAYS = 31;
export const MIN_YEAR = 2020;

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

// Strict validation:
// - Must match YYYY-MM-DD
// - Year must be >= MIN_YEAR (prevents partial typing like 0020, 0202)
// - Must be a real calendar date (no Feb 30)
// - Cannot be in the future
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  if (value > TODAY) return false;
  return true;
}

// Smart bin size for speed chart:
// 1 day → 1h bins, 2 days → 2h, ... capped at 6h for longer ranges
export function calcBinHours(from: string, to: string): number {
  const days = daysBetween(from, to);
  return Math.min(Math.max(1, days), 6);
}

// Validate a pair of dates and return a user-facing error string or null
export function validateDateRange(from: string, to: string): string | null {
  if (!isValidDate(from)) return `"Od" není platné datum (min. rok ${MIN_YEAR})`;
  if (!isValidDate(to)) return `"Do" není platné datum`;
  if (from > to) return `"Od" nesmí být po "Do"`;
  const days = daysBetween(from, to);
  if (days > MAX_RANGE_DAYS) {
    return `Rozsah nesmí přesáhnout 1 měsíc (aktuálně ${days} dní, max. ${MAX_RANGE_DAYS})`;
  }
  return null;
}
