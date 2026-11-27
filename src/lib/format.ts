export const fmtInt = (n: number) => Math.round(n).toLocaleString();

export function fmtHours(h: number): string {
  if (h >= 100) return `${fmtInt(h)} h`;
  if (h >= 1) return `${h.toFixed(1)} h`;
  return `${Math.round(h * 60)} min`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function fmtMonthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? String(y) : `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}

export type Measure = 'plays' | 'hours';

/** A value in the chosen measure, written out for a tooltip or list. */
export function fmtMeasure(v: number, m: Measure): string {
  return m === 'plays' ? `${fmtInt(v)} play${Math.round(v) === 1 ? '' : 's'}` : fmtHours(v);
}

/** Short axis label for a value in the chosen measure. */
export function fmtAxis(v: number, m: Measure): string {
  if (m === 'hours') return Number.isInteger(v) ? `${fmtInt(v)}h` : `${v}h`;
  return v >= 10000 ? `${Math.round(v / 1000)}k` : fmtInt(v);
}

/** A round tick step (1, 2 or 5 × 10^n) giving about four ticks up to `max`. */
export function niceStep(max: number): number {
  const raw = Math.max(max, 1e-6) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** '2024' stays as is; '2024-03' becomes 'Mar 2024'. */
export const fmtPeriod = (p: string) => (p.length === 7 ? fmtMonth(p) : p);
/** Axis label: '2024', or "Mar '24" (January shows the year). */
export const fmtPeriodShort = (p: string) => (p.length === 7 ? fmtMonthShort(p) : p);
