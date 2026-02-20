export const TODAY: string = new Date().toISOString().slice(0, 10);

/**
 * Max range: 32 days covers any same-calendar-day month span
 * (Jan 19 → Feb 19 = 32 days inclusive in a 31-day month like January).
 * Feb 19 → Mar 19 = 29 days inclusive. All safe under 32.
 */
export const MAX_RANGE_DAYS = 32;
export const MIN_YEAR = 2020;

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Same calendar day, one month back.
 * Feb 19 → Jan 19. Mar 31 → Feb 28 (clamped to last day of month).
 * Uses LOCAL date arithmetic, not UTC, to avoid timezone drift.
 */
export function oneMonthAgo(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();        // 0-based
  const year = now.getFullYear();

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear  = month === 0 ? year - 1 : year;

  // Last day of prevMonth
  const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfPrevMonth);

  const result = new Date(prevYear, prevMonth, clampedDay);
  // Format as YYYY-MM-DD in local time (not UTC)
  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, '0');
  const d2 = String(result.getDate()).padStart(2, '0');
  return `${y}-${m}-${d2}`;
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return value <= TODAY;
}

export function calcBinHours(from: string, to: string): number {
  const days = daysBetween(from, to);
  return Math.min(Math.max(1, days), 6);
}

export function validateDateRange(from: string, to: string): string | null {
  if (!isValidDate(from)) return `"Od" není platné datum (min. rok ${MIN_YEAR})`;
  if (!isValidDate(to)) return `"Do" není platné datum`;
  if (from > to) return `"Od" nesmí být po "Do"`;
  const days = daysBetween(from, to);
  if (days > MAX_RANGE_DAYS) {
    return `Rozsah nesmí přesáhnout 1 měsíc (aktuálně ${days} dní)`;
  }
  return null;
}

export function toApiFrom(date: string): string { return `${date}T00:00`; }
export function toApiTo(date: string): string { return `${date}T23:59`; }

// Preset days values:
//  0  → Dnes: from=today, to=today
//  6  → 7 dní: daysAgo(6) → today = 7 days inclusive
// -1  → Měsíc: oneMonthAgo() → today (same calendar day last month)
export const DATE_PRESETS = [
  { label: "Dnes",  days: 0  },
  { label: "7 dní", days: 6  },
  { label: "Měsíc", days: -1 },
] as const;
