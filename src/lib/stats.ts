import type { Kind, Play } from './types';

export const HOUR_MS = 3_600_000;

export interface Filters {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  kind: Kind;
  minSeconds: number;
  artist: string | null;
}

export function applyFilters(plays: Play[], f: Filters): Play[] {
  const minMs = f.minSeconds * 1000;
  return plays.filter(
    (p) =>
      p.kind === f.kind &&
      p.ms >= minMs &&
      p.day >= f.from &&
      p.day <= f.to &&
      (f.artist === null || p.artist === f.artist),
  );
}

export interface Summary {
  plays: number;
  hours: number;
  artists: number;
  tracks: number;
  days: number;
  activeDays: number;
}

export function summarize(plays: Play[], from: string, to: string): Summary {
  let ms = 0;
  const artists = new Set<string>();
  const tracks = new Set<string>();
  const days = new Set<string>();
  for (const p of plays) {
    ms += p.ms;
    artists.add(p.artist);
    tracks.add(p.artist + '\u0000' + p.track);
    days.add(p.day);
  }
  return {
    plays: plays.length,
    hours: ms / HOUR_MS,
    artists: artists.size,
    tracks: tracks.size,
    days: daysBetween(from, to).length,
    activeDays: days.size,
  };
}

export type Metric = 'plays' | 'hours';

export interface Ranked {
  key: string;
  label: string;
  sub: string;
  plays: number;
  hours: number;
}

export type Grouping = 'artist' | 'track' | 'album';

export function topBy(plays: Play[], by: Grouping, metric: Metric, n: number): Ranked[] {
  const map = new Map<string, Ranked>();
  for (const p of plays) {
    if (by === 'album' && !p.album) continue;
    const key = by === 'artist' ? p.artist : p.artist + '\u0000' + (by === 'track' ? p.track : p.album);
    let r = map.get(key);
    if (!r) {
      r = {
        key,
        label: by === 'artist' ? p.artist : by === 'track' ? p.track : p.album,
        sub: by === 'artist' ? '' : p.artist,
        plays: 0,
        hours: 0,
      };
      map.set(key, r);
    }
    r.plays++;
    r.hours += p.ms / HOUR_MS;
  }
  return [...map.values()]
    .sort((a, b) => b[metric] - a[metric] || b.plays - a.plays || a.label.localeCompare(b.label))
    .slice(0, n);
}

const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
const fmtDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Every calendar day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  const d = parseDay(from);
  const end = parseDay(to);
  while (d <= end) {
    out.push(fmtDay(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ey, em] = to.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${pad(m)}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export interface DailyPoint {
  day: string;
  hours: number;
  avg: number;
}

/**
 * Hours listened per calendar day with a trailing moving average (days with no
 * listening count as zero, which the original R version missed).
 */
export function dailyHours(plays: Play[], from: string, to: string, window: number): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const p of plays) byDay.set(p.day, (byDay.get(p.day) ?? 0) + p.ms / HOUR_MS);
  const days = daysBetween(from, to);
  const vals = days.map((d) => byDay.get(d) ?? 0);
  let run = 0;
  return days.map((day, i) => {
    run += vals[i];
    if (i >= window) run -= vals[i - window];
    const count = Math.min(i + 1, window);
    return { day, hours: vals[i], avg: run / count };
  });
}

export interface StackedResult {
  series: string[]; // top artists in rank order, then 'Other' if any
  rows: Record<string, number | string>[]; // { month, [artist]: hours }
}

/** Monthly hours for the top `n` artists, everyone else folded into "Other". */
export function artistsOverTime(plays: Play[], from: string, to: string, n: number): StackedResult {
  const top = topBy(plays, 'artist', 'hours', n).map((r) => r.label);
  const topSet = new Set(top);
  const months = monthsBetween(from.slice(0, 7), to.slice(0, 7));
  const index = new Map(months.map((m, i) => [m, i]));
  const rows: Record<string, number | string>[] = months.map((month) => {
    const r: Record<string, number | string> = { month };
    for (const a of top) r[a] = 0;
    r.Other = 0;
    return r;
  });
  let hasOther = false;
  for (const p of plays) {
    const i = index.get(p.month);
    if (i === undefined) continue;
    const k = topSet.has(p.artist) ? p.artist : 'Other';
    if (k === 'Other') hasOther = true;
    rows[i][k] = (rows[i][k] as number) + p.ms / HOUR_MS;
  }
  if (!hasOther) for (const r of rows) delete r.Other;
  return { series: hasOther ? [...top, 'Other'] : top, rows };
}

/** 7 x 24 grid of hours (rows Monday..Sunday, columns 0..23 local time). */
export function weekHourGrid(plays: Play[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const p of plays) grid[p.dow][p.hour] += p.ms / HOUR_MS;
  return grid;
}

export interface YearPoint {
  year: number;
  hours: number;
  plays: number;
}

export function byYear(plays: Play[]): YearPoint[] {
  const map = new Map<number, YearPoint>();
  for (const p of plays) {
    let y = map.get(p.year);
    if (!y) map.set(p.year, (y = { year: p.year, hours: 0, plays: 0 }));
    y.hours += p.ms / HOUR_MS;
    y.plays++;
  }
  return [...map.values()].sort((a, b) => a.year - b.year);
}

export interface DiscoveryPoint {
  year: number;
  newArtists: number;
  returningArtists: number;
}

/** For each year: how many artists you heard for the first time ever vs. ones you already knew. */
export function artistDiscovery(allPlays: Play[], from: string, to: string): DiscoveryPoint[] {
  const firstYear = new Map<string, number>();
  for (const p of allPlays) if (!firstYear.has(p.artist)) firstYear.set(p.artist, p.year);
  const perYear = new Map<number, Set<string>>();
  for (const p of allPlays) {
    if (p.day < from || p.day > to) continue;
    let s = perYear.get(p.year);
    if (!s) perYear.set(p.year, (s = new Set()));
    s.add(p.artist);
  }
  return [...perYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, set]) => {
      let n = 0;
      for (const a of set) if (firstYear.get(a) === year) n++;
      return { year, newArtists: n, returningArtists: set.size - n };
    });
}
