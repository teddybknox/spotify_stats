import type { Kind, Play } from './types';
import { decadeOf } from './release-core';

export const HOUR_MS = 3_600_000;

export type Metric = 'plays' | 'hours';

/** How much one play counts for: 1 when counting plays, its length in hours when measuring time. */
export const weight = (p: Play, metric: Metric) => (metric === 'plays' ? 1 : p.ms / HOUR_MS);

export interface Filters {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  kind: Kind;
  minSeconds: number;
  /** When set, every chart only counts plays of this one artist, track, album, genre or decade. */
  focus: Focus | null;
}

export type Dim = 'artist' | 'track' | 'album' | 'genre' | 'decade';

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
    case 'decade':
      return p.released ? decadeOf(p.released) : null;
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

export type Unit = 'year' | 'month';

/** Every year ('2024') or month ('2024-03') from `from` to `to` (days), inclusive. */
export function periodsBetween(from: string, to: string, unit: Unit): string[] {
  if (unit === 'month') return monthsBetween(from.slice(0, 7), to.slice(0, 7));
  const a = Number(from.slice(0, 4));
  const b = Number(to.slice(0, 4));
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => String(a + i));
}

export const periodOf = (p: Play, unit: Unit) => (unit === 'month' ? p.month : String(p.year));

export interface StackedResult {
  series: Series[]; // top items in rank order, then Other if any
  rows: Record<string, number | string>[]; // { period, s0: value, s1: value, ..., Other: value }
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
  unit: Unit = 'month',
): StackedResult {
  const top = topBy(plays, by, metric, n, genres);
  const keyOf = new Map(top.map((r, i) => [r.key, `s${i}`]));
  const periods = periodsBetween(from, to, unit);
  const index = new Map(periods.map((m, i) => [m, i]));
  const rows: Record<string, number | string>[] = periods.map((period) => {
    const r: Record<string, number | string> = { period, Other: 0 };
    for (const k of keyOf.values()) r[k] = 0;
    return r;
  });
  let hasOther = false;
  for (const p of plays) {
    const i = index.get(periodOf(p, unit));
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

export interface DiscoveryPoint {
  period: string;
  /** Items heard for the first time ever in that year or month. */
  fresh: number;
  /** Items heard then that had already been heard before. */
  returning: number;
}

/**
 * For each year in range: how many artists (or tracks, albums, genres) you heard for the first time
 * ever, vs. ones you already knew. `allPlays` must cover all time and be sorted by time.
 */
export function discovery(
  allPlays: Play[],
  from: string,
  to: string,
  by: Dim = 'artist',
  genres?: GenreMap,
  unit: Unit = 'year',
): DiscoveryPoint[] {
  const first = new Map<string, string>();
  const per = new Map<string, Set<string>>(periodsBetween(from, to, unit).map((x) => [x, new Set()]));
  for (const p of allPlays) {
    const k = itemKey(p, by, genres);
    if (k === null) continue;
    const period = periodOf(p, unit);
    if (!first.has(k)) first.set(k, period);
    if (p.day < from || p.day > to) continue;
    per.get(period)?.add(k);
  }
  return [...per.entries()].map(([period, set]) => {
    let n = 0;
    for (const k of set) if (first.get(k) === period) n++;
    return { period, fresh: n, returning: set.size - n };
  });
}

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
  const periods = periodsBetween(from, to, unit);
  const groups = new Map<string, Play[]>(periods.map((p) => [p, []]));
  for (const p of plays) groups.get(periodOf(p, unit))?.push(p);
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

export interface SearchItem extends Ranked {
  by: Dim;
  /** Folded label (and artist, for tracks and albums) used for matching. */
  text: string;
  /** text plus the folded artist, so "song artist" queries match. */
  hay: string;
}

/** Lower case, accents dropped, spaces collapsed; keeps non-Latin scripts intact. */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Everything that can be searched for: each artist, track, album (and genre, when known) in these plays. */
export function buildSearchIndex(plays: Play[], dims: Dim[], genres?: GenreMap): SearchItem[] {
  return dims.flatMap((by) =>
    topBy(plays, by, 'plays', Infinity, genres).map((r) => ({ ...r, by, text: fold(r.label), hay: fold(r.sub ? `${r.label} ${r.sub}` : r.label) })),
  );
}

/**
 * Best matches for a query: whole-name matches first, then names that start with it, then a word that
 * starts with it, then anywhere in the name. Ties go to the most played. Every word of the query must appear.
 */
export function searchIndex(index: SearchItem[], query: string, n = 8): SearchItem[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of index) {
    const t = item.text;
    if (!words.every((w) => item.hay.includes(w))) continue;
    const score = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(' ' + q) ? 2 : t.includes(q) ? 3 : 4;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || b.item.plays - a.item.plays)
    .slice(0, n)
    .map((s) => s.item);
}
