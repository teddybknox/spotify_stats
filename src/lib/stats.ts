import type { Kind, Play } from './types';

export const HOUR_MS = 3_600_000;

export type Metric = 'plays' | 'hours';

/** How much one play counts for: 1 when counting plays, its length in hours when measuring time. */
export const weight = (p: Play, metric: Metric) => (metric === 'plays' ? 1 : p.ms / HOUR_MS);

export interface Filters {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  kind: Kind;
  minSeconds: number;
  /** When set, every chart only counts plays of this one artist, track, album or genre. */
  focus: Focus | null;
}

export type Dim = 'artist' | 'track' | 'album' | 'genre';

export interface Focus {
  by: Dim;
  key: string;
  label: string;
}

/** Artist name -> genre name. */
export type GenreMap = Map<string, string>;

/** Albums are identified by artist + title, since titles like "Greatest Hits" repeat. */
export const albumKey = (artist: string, album: string) => artist + '\u0000' + album;

/** The key a play falls under for a dimension, or null when it has none (no album, genre not known yet). */
export function itemKey(p: Play, by: Dim, genres?: GenreMap): string | null {
  switch (by) {
    case 'artist':
      return p.artist;
    case 'track':
      return p.artist + '\u0000' + p.track;
    case 'album':
      return p.album ? albumKey(p.artist, p.album) : null;
    case 'genre':
      return genres?.get(p.artist) ?? null;
  }
}

export function applyFilters(plays: Play[], f: Filters, genres?: GenreMap): Play[] {
  const focus = f.focus;
  const minMs = f.minSeconds * 1000;
  return plays.filter(
    (p) =>
      p.kind === f.kind &&
      p.ms >= minMs &&
      p.day >= f.from &&
      p.day <= f.to &&
      (focus === null || itemKey(p, focus.by, genres) === focus.key),
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

export interface Ranked {
  key: string;
  label: string;
  sub: string;
  artist: string;
  album: string;
  plays: number;
  hours: number;
}

export function topBy(plays: Play[], by: Dim, metric: Metric, n: number, genres?: GenreMap): Ranked[] {
  const map = new Map<string, Ranked>();
  for (const p of plays) {
    const key = itemKey(p, by, genres);
    if (key === null) continue;
    let r = map.get(key);
    if (!r) {
      r = {
        key,
        label: by === 'artist' ? p.artist : by === 'track' ? p.track : by === 'album' ? p.album : key,
        sub: by === 'track' || by === 'album' ? p.artist : '',
        artist: p.artist,
        album: p.album,
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
  value: number;
  avg: number;
}

/**
 * Hours (or plays) per calendar day with a trailing moving average (days with no
 * listening count as zero, which the original R version missed).
 */
export function dailyTotals(plays: Play[], from: string, to: string, window: number, metric: Metric = 'hours'): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const p of plays) byDay.set(p.day, (byDay.get(p.day) ?? 0) + weight(p, metric));
  const days = daysBetween(from, to);
  const vals = days.map((d) => byDay.get(d) ?? 0);
  let run = 0;
  return days.map((day, i) => {
    run += vals[i];
    if (i >= window) run -= vals[i - window];
    const count = Math.min(i + 1, window);
    return { day, value: vals[i], avg: run / count };
  });
}

export interface Series {
  key: string; // column name in rows: 's0', 's1', ... or 'Other'
  label: string;
  sub: string;
}

export interface StackedResult {
  series: Series[]; // top items in rank order, then Other if any
  rows: Record<string, number | string>[]; // { month, s0: value, s1: value, ..., Other: value }
}

/** Monthly totals for the top `n` artists, tracks, albums or genres, everything else folded into "Other". */
export function topOverTime(
  plays: Play[],
  from: string,
  to: string,
  n: number,
  metric: Metric = 'hours',
  by: Dim = 'artist',
  genres?: GenreMap,
): StackedResult {
  const top = topBy(plays, by, metric, n, genres);
  const keyOf = new Map(top.map((r, i) => [r.key, `s${i}`]));
  const months = monthsBetween(from.slice(0, 7), to.slice(0, 7));
  const index = new Map(months.map((m, i) => [m, i]));
  const rows: Record<string, number | string>[] = months.map((month) => {
    const r: Record<string, number | string> = { month, Other: 0 };
    for (const k of keyOf.values()) r[k] = 0;
    return r;
  });
  let hasOther = false;
  for (const p of plays) {
    const i = index.get(p.month);
    if (i === undefined) continue;
    const item = itemKey(p, by, genres);
    if (item === null) continue; // no album / unknown genre: left out rather than lumped into Other
    const k = keyOf.get(item) ?? 'Other';
    if (k === 'Other') hasOther = true;
    rows[i][k] = (rows[i][k] as number) + weight(p, metric);
  }
  if (!hasOther) for (const r of rows) delete r.Other;
  const series: Series[] = top.map((r, i) => ({ key: `s${i}`, label: r.label, sub: r.sub }));
  if (hasOther) series.push({ key: 'Other', label: 'Other', sub: '' });
  return { series, rows };
}

/** 7 x 24 grid of hours or plays (rows Monday..Sunday, columns 0..23 local time). */
export function weekHourGrid(plays: Play[], metric: Metric = 'hours'): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const p of plays) grid[p.dow][p.hour] += weight(p, metric);
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
  /** Items heard for the first time ever that year. */
  fresh: number;
  /** Items heard that year that had already been heard in an earlier year. */
  returning: number;
}

/**
 * For each year in range: how many artists (or tracks, albums, genres) you heard for the first time
 * ever, vs. ones you already knew. `allPlays` must cover all time and be sorted by time.
 */
export function discovery(allPlays: Play[], from: string, to: string, by: Dim = 'artist', genres?: GenreMap): DiscoveryPoint[] {
  const firstYear = new Map<string, number>();
  const perYear = new Map<number, Set<string>>();
  for (const p of allPlays) {
    const k = itemKey(p, by, genres);
    if (k === null) continue;
    if (!firstYear.has(k)) firstYear.set(k, p.year);
    if (p.day < from || p.day > to) continue;
    let s = perYear.get(p.year);
    if (!s) perYear.set(p.year, (s = new Set()));
    s.add(k);
  }
  return [...perYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, set]) => {
      let n = 0;
      for (const k of set) if (firstYear.get(k) === year) n++;
      return { year, fresh: n, returning: set.size - n };
    });
}

export type Unit = 'year' | 'month';

export interface PeriodTop {
  period: string; // '2024' or '2024-03'
  plays: number;
  hours: number;
  artist: Ranked | null;
  album: Ranked | null;
  track: Ranked | null;
}

/** The top artist, album and track of every year or month from `from` to `to` (empty periods included). */
export function topPerPeriod(plays: Play[], from: string, to: string, unit: Unit, metric: Metric): PeriodTop[] {
  const periods =
    unit === 'month'
      ? monthsBetween(from.slice(0, 7), to.slice(0, 7))
      : Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, i) => String(Number(from.slice(0, 4)) + i));
  const groups = new Map<string, Play[]>(periods.map((p) => [p, []]));
  for (const p of plays) groups.get(unit === 'month' ? p.month : String(p.year))?.push(p);
  return periods.map((period) => {
    const ps = groups.get(period)!;
    return {
      period,
      plays: ps.length,
      hours: ps.reduce((h, p) => h + p.ms / HOUR_MS, 0),
      artist: topBy(ps, 'artist', metric, 1)[0] ?? null,
      album: topBy(ps, 'album', metric, 1)[0] ?? null,
      track: topBy(ps, 'track', metric, 1)[0] ?? null,
    };
  });
}
