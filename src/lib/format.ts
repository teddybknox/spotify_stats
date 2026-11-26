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
