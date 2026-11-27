import { describe, expect, it } from 'vitest';
import { enrich } from './parse';
import { albumKey, applyFilters, topPerPeriod, discovery, topOverTime, dailyTotals, daysBetween, monthsBetween, topBy, weekHourGrid, buildSearchIndex, searchIndex } from './stats';
import type { Kind } from './types';

const H = 3_600_000;
const play = (iso: string, artist: string, track: string, ms = H / 4, kind: Kind = 'music') =>
  enrich({ ts: Date.parse(iso), ms, artist, track, album: `${artist} LP`, kind, skipped: null });

const plays = [
  play('2022-12-31T10:00:00Z', 'Old Band', 'Classic'),
  play('2023-01-01T10:00:00Z', 'A', 'a1', H),
  play('2023-01-01T11:00:00Z', 'A', 'a1', H),
  play('2023-01-03T09:00:00Z', 'B', 'b1'),
  play('2023-01-03T09:10:00Z', 'B', 'b2'),
  play('2023-01-03T09:20:00Z', 'B', 'b2'),
  play('2023-01-04T09:20:00Z', 'C', 'c1', 10_000),
  play('2023-02-04T09:20:00Z', 'Show', 'ep', H, 'podcast'),
];

describe('dates', () => {
  it('lists days and months inclusively', () => {
    expect(daysBetween('2023-02-27', '2023-03-02')).toEqual(['2023-02-27', '2023-02-28', '2023-03-01', '2023-03-02']);
    expect(monthsBetween('2022-11', '2023-02')).toEqual(['2022-11', '2022-12', '2023-01', '2023-02']);
  });
});

describe('applyFilters', () => {
  it('filters by date, kind, minimum length and artist', () => {
    const base = { from: '2023-01-01', to: '2023-12-31', kind: 'music' as Kind, minSeconds: 30, focus: null };
    expect(applyFilters(plays, base)).toHaveLength(5);
    expect(applyFilters(plays, { ...base, minSeconds: 0 })).toHaveLength(6);
    expect(applyFilters(plays, { ...base, focus: { by: 'artist', key: 'B', label: 'B' } })).toHaveLength(3);
    expect(applyFilters(plays, { ...base, kind: 'podcast' })).toHaveLength(1);
    const genres = new Map([['A', { top: 'Rock', sub: 'Rock x' }], ['B', { top: 'Jazz', sub: 'Jazz x' }]]);
    expect(applyFilters(plays, { ...base, focus: { by: 'genre', key: 'Jazz', label: 'Jazz' } }, genres)).toHaveLength(3);
    expect(applyFilters(plays, { ...base, focus: { by: 'album', key: albumKey('B', 'B LP'), label: 'B LP' } })).toHaveLength(3);
  });
});

describe('topBy', () => {
  it('ranks by plays or by time', () => {
    expect(topBy(plays, 'artist', 'plays', 1)[0].label).toBe('B');
    expect(topBy(plays, 'artist', 'hours', 1)[0].label).toBe('A');
    const t = topBy(plays, 'track', 'plays', 2);
    expect(t.map((r) => [r.label, r.sub, r.plays])).toEqual([
      ['a1', 'A', 2],
      ['b2', 'B', 2],
    ]);
  });
});

describe('topBy genre', () => {
  it('groups by artist genre and skips artists without one', () => {
    const genres = new Map([['A', { top: 'Rock', sub: 'Rock x' }], ['B', { top: 'Rock', sub: 'Rock x' }], ['Old Band', { top: 'Jazz', sub: 'Jazz x' }]]);
    const r = topBy(plays, 'genre', 'plays', 5, genres);
    expect(r.map((x) => [x.label, x.plays])).toEqual([
      ['Rock', 5],
      ['Jazz', 1],
    ]);
  });
  it('groups by sub-genre and shows the top-level genre under each', () => {
    const genres = new Map([['A', { top: 'Rock', sub: 'Glam Rock' }], ['B', { top: 'Rock', sub: 'Math Rock' }]]);
    const r = topBy(plays, 'subgenre', 'plays', 5, genres);
    expect(r.every((x) => x.sub === 'Rock')).toBe(true);
    expect(r.map((x) => x.label).sort()).toEqual(['Glam Rock', 'Math Rock']);
  });
});

describe('dailyTotals', () => {
  it('fills empty days with zero before averaging', () => {
    const d = dailyTotals(plays.slice(1, 4), '2023-01-01', '2023-01-03', 2);
    expect(d.map((x) => x.value)).toEqual([2, 0, 0.25]);
    expect(d.map((x) => x.avg)).toEqual([2, 1, 0.125]);
    expect(dailyTotals(plays.slice(1, 4), '2023-01-01', '2023-01-03', 1, 'plays').map((x) => x.value)).toEqual([2, 0, 1]);
  });
});

describe('topOverTime', () => {
  it('keeps the top artists and folds the rest into Other', () => {
    const r = topOverTime(plays.filter((p) => p.kind === 'music'), '2022-12-01', '2023-01-31', 1);
    expect(r.series.map((x) => x.label)).toEqual(['A', 'Other']);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1].s0).toBe(2);
    expect(r.rows[0].Other).toBe(0.25);
    const byPlays = topOverTime(plays.filter((p) => p.kind === 'music'), '2022-12-01', '2023-01-31', 1, 'plays');
    expect(byPlays.series[0].label).toBe('B');
    const albums = topOverTime(plays.filter((p) => p.kind === 'music'), '2022-12-01', '2023-01-31', 1, 'hours', 'album');
    expect(albums.series[0]).toMatchObject({ label: 'A LP', sub: 'A' });
  });
  it('groups by year', () => {
    const r = topOverTime(plays.filter((p) => p.kind === 'music'), '2022-12-01', '2023-01-31', 1, 'hours', 'artist', undefined, 'year');
    expect(r.rows.map((x) => x.period)).toEqual(['2022', '2023']);
    expect(r.rows[1].s0).toBe(2);
  });
});

describe('weekHourGrid', () => {
  it('puts each play in its weekday and hour', () => {
    const g = weekHourGrid([plays[1]]); // Sunday 10:00 UTC
    expect(g[6][10]).toBe(1);
  });
});

describe('discovery', () => {
  it('counts artists heard for the first time each year', () => {
    const r = discovery(plays.filter((p) => p.kind === 'music'), '2022-01-01', '2023-12-31');
    expect(r).toEqual([
      { period: '2022', fresh: 1, returning: 0 },
      { period: '2023', fresh: 3, returning: 0 },
    ]);
    const genres = new Map([['Old Band', { top: 'Rock', sub: 'Rock x' }], ['A', { top: 'Rock', sub: 'Rock x' }], ['B', { top: 'Jazz', sub: 'Jazz x' }]]);
    expect(discovery(plays.filter((p) => p.kind === 'music'), '2022-01-01', '2023-12-31', 'genre', genres)).toEqual([
      { period: '2022', fresh: 1, returning: 0 },
      { period: '2023', fresh: 1, returning: 1 },
    ]);
  });
  it('counts by month, including empty months', () => {
    const r = discovery(plays.filter((p) => p.kind === 'music'), '2022-12-01', '2023-02-28', 'artist', undefined, 'month');
    expect(r.map((x) => x.period)).toEqual(['2022-12', '2023-01', '2023-02']);
    expect(r[2]).toEqual({ period: '2023-02', fresh: 0, returning: 0 });
  });
});

describe('topPerPeriod', () => {
  it('finds the top artist, album and track of each month, including empty months', () => {
    const music = plays.filter((p) => p.kind === 'music');
    const r = topPerPeriod(music, '2022-12-01', '2023-02-28', 'month', 'plays');
    expect(r.map((x) => x.period)).toEqual(['2022-12', '2023-01', '2023-02']);
    expect(r[1].artist?.label).toBe('B');
    expect(r[1].track).toMatchObject({ label: 'a1', sub: 'A', plays: 2 }); // tie with b2, broken alphabetically
    expect(r[1].album?.label).toBe('B LP');
    expect(r[2]).toMatchObject({ plays: 0, artist: null, album: null, track: null });
    const years = topPerPeriod(music, '2022-06-01', '2023-06-01', 'year', 'hours');
    expect(years.map((x) => [x.period, x.artist?.label])).toEqual([
      ['2022', 'Old Band'],
      ['2023', 'A'],
    ]);
  });
});

describe('search', () => {
  const mk = (artist: string, track: string, album: string, n: number) =>
    Array.from({ length: n }, () => ({ ...play('2024-01-01T00:00:00Z', artist, track), album }));
  const all = [...mk('Beyoncé', 'Halo', 'I Am... Sasha Fierce', 3), ...mk('Halsey', 'Without Me', 'Manic', 5)];
  const index = buildSearchIndex(all, ['artist', 'track', 'album']);

  it('ignores accents and case', () => {
    expect(searchIndex(index, 'beyonce')[0]).toMatchObject({ by: 'artist', label: 'Beyoncé' });
  });
  it('puts exact and prefix matches before more-played partial matches', () => {
    const r = searchIndex(index, 'halo');
    expect(r[0]).toMatchObject({ by: 'track', label: 'Halo' });
  });
  it('matches a track by its artist too', () => {
    expect(searchIndex(index, 'without halsey').map((r) => r.label)).toEqual(['Without Me']);
  });
  it('only returns items that are in the data', () => {
    expect(searchIndex(index, 'taylor')).toEqual([]);
  });
});

describe('topBy decade', () => {
  it('groups by album release decade and skips albums without a year', () => {
    const years: Record<string, number> = { A: 1977, B: 1971, 'Old Band': 2004 };
    const withYears = plays.map((p) => (years[p.artist] ? { ...p, released: years[p.artist] } : p));
    const r = topBy(withYears, 'decade', 'plays', 5);
    expect(r.map((x) => [x.label, x.plays])).toEqual([
      ['1970s', 5],
      ['2000s', 1],
    ]);
  });
});
