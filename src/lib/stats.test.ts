import { describe, expect, it } from 'vitest';
import { enrich } from './parse';
import { albumKey, applyFilters, artistDiscovery, topOverTime, dailyTotals, daysBetween, monthsBetween, topBy, weekHourGrid } from './stats';
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
    const genres = new Map([['A', 'Rock'], ['B', 'Jazz']]);
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
    const genres = new Map([['A', 'Rock'], ['B', 'Rock'], ['Old Band', 'Jazz']]);
    const r = topBy(plays, 'genre', 'plays', 5, genres);
    expect(r.map((x) => [x.label, x.plays])).toEqual([
      ['Rock', 5],
      ['Jazz', 1],
    ]);
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
});

describe('weekHourGrid', () => {
  it('puts each play in its weekday and hour', () => {
    const g = weekHourGrid([plays[1]]); // Sunday 10:00 UTC
    expect(g[6][10]).toBe(1);
  });
});

describe('artistDiscovery', () => {
  it('counts artists heard for the first time each year', () => {
    const r = artistDiscovery(plays.filter((p) => p.kind === 'music'), '2022-01-01', '2023-12-31');
    expect(r).toEqual([
      { year: 2022, newArtists: 1, returningArtists: 0 },
      { year: 2023, newArtists: 3, returningArtists: 0 },
    ]);
  });
});
