import { describe, expect, it } from 'vitest';
import { enrich } from './parse';
import { autoExpand, buildTree, flattenTree, layoutTree, reveal, searchTree, sortedChildren, UNSORTED } from './tree';
import type { GenreMap } from './stats';

const H = 3_600_000;
const play = (artist: string, album: string, track: string, ms = H / 4) =>
  enrich({ ts: Date.parse('2023-01-01T10:00:00Z'), ms, artist, track, album, kind: 'music', skipped: null });

const genres: GenreMap = new Map([
  ['Beatles', { top: 'Rock', sub: 'Classic Rock' }],
  ['Stones', { top: 'Rock', sub: 'Classic Rock' }],
  ['Radiohead', { top: 'Rock', sub: 'Alt Rock' }],
  ['Miles', { top: 'Jazz', sub: 'Cool Jazz' }],
]);
const plays = [
  play('Beatles', 'Abbey Road', 'Something'),
  play('Beatles', 'Abbey Road', 'Something'),
  play('Beatles', 'Help!', 'Yesterday'),
  play('Stones', 'Sticky Fingers', 'Brown Sugar'),
  play('Radiohead', 'OK Computer', 'Airbag', H),
  play('Miles', 'Kind of Blue', 'So What', 3 * H),
  play('Mystery', 'Unknown', 'Tune'),
];

describe('genre tree', () => {
  const root = buildTree(plays, genres);

  it('sums plays and hours at every level', () => {
    expect(root.plays).toBe(7);
    const rock = root.children.find((c) => c.name === 'Rock')!;
    expect(rock.plays).toBe(5);
    expect(rock.hours).toBeCloseTo(2);
    const beatles = rock.children.find((c) => c.name === 'Classic Rock')!.children.find((c) => c.name === 'Beatles')!;
    expect(beatles.children.map((c) => [c.name, c.plays])).toEqual([['Abbey Road', 2], ['Help!', 1]]);
    expect(beatles.children[0].children[0].level).toBe('track');
  });

  it('ranks by the chosen metric, with unclassified last', () => {
    expect(sortedChildren(root, 'plays').map((c) => c.name)).toEqual(['Rock', 'Jazz', UNSORTED]);
    expect(sortedChildren(root, 'hours').map((c) => c.name)).toEqual(['Jazz', 'Rock', UNSORTED]);
  });

  it('lays out open nodes with a "+X more" row past the limit', () => {
    const l = layoutTree(root, new Set(['root']), new Map(), 'plays', 2);
    expect(l.nodes.map((n) => n.node.name)).toEqual(['Rock', 'Jazz', 'All music']);
    expect(l.more).toHaveLength(1);
    expect(l.more[0].count).toBe(1);
    expect(l.rows).toBe(3);
    // Siblings stack inside the parent's bundle.
    expect(l.links.map((k) => k.offset)).toEqual([0, 5, 6]);
  });

  it('reveals a hidden node by opening its ancestors and raising limits', () => {
    const flat = flattenTree(root);
    const hit = searchTree(flat, 'yester', 5);
    expect(hit[0].node.name).toBe('Yesterday');
    expect(hit[0].path).toBe('Rock › Classic Rock › Beatles › Help!');
    const r = reveal(hit[0].node, new Set(['root']), new Map(), 'plays', 1);
    const l = layoutTree(root, r.expanded, r.limits, 'plays', 1);
    expect(l.nodes.some((n) => n.node.name === 'Yesterday')).toBe(true);
  });

  it('auto-expands single-child chains', () => {
    const solo = buildTree([play('Miles', 'Kind of Blue', 'So What')], genres);
    const e = autoExpand(solo, new Set());
    expect(e.size).toBe(6);
  });
});

describe('tree search', () => {
  it('puts the most played whole-word match first', () => {
    const root = buildTree(
      [play('The Beatles', 'Abbey Road', 'Come Together'), play('The Beatles', 'Abbey Road', 'Something'), play('X', 'Beatles For Sale', 'No Reply')],
      new Map(),
    );
    expect(searchTree(flattenTree(root), 'beatles', 5)[0].node.name).toBe('The Beatles');
  });
});

describe('skipping levels', () => {
  it('joins genre straight to artists when sub-genres are skipped', () => {
    const root = buildTree(plays, genres, ['genre', 'artist', 'album', 'track']);
    const rock = root.children.find((c) => c.name === 'Rock')!;
    expect(sortedChildren(rock, 'plays').map((c) => [c.name, c.level])).toEqual([
      ['Beatles', 'artist'],
      ['Radiohead', 'artist'],
      ['Stones', 'artist'],
    ]);
  });

  it('can skip several levels and keeps same-named tracks by different artists apart', () => {
    const root = buildTree([...plays, play('Stones', 'Covers', 'Yesterday')], genres, ['genre', 'track']);
    const rock = root.children.find((c) => c.name === 'Rock')!;
    const yesterdays = rock.children.filter((c) => c.name === 'Yesterday');
    expect(yesterdays.map((c) => c.by).sort()).toEqual(['Beatles', 'Stones']);
    expect(yesterdays[0].children).toEqual([]);
    expect(searchTree(flattenTree(root), 'yesterday', 5)[0].path).toMatch(/^Rock · by /);
  });
});
