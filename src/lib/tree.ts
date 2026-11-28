import type { Play } from './types';
import { HOUR_MS, type GenreMap, type Metric } from './stats';
import { norm } from './genre-core';

export type Level = 'root' | 'genre' | 'subgenre' | 'artist' | 'album' | 'track';
/** The levels below the root, left to right. */
export const LEVELS: Exclude<Level, 'root'>[] = ['genre', 'subgenre', 'artist', 'album', 'track'];

export interface TreeNode {
  id: string;
  name: string;
  /** Artist name, for an album or track when the artist level is hidden. */
  by?: string;
  level: Level;
  depth: number;
  plays: number;
  hours: number;
  parent: TreeNode | null;
  children: TreeNode[];
}

/** Label used for artists whose genre isn't known. */
export const UNSORTED = 'Not classified';
const NO_ALBUM = 'Unknown album';
const SEP = '\u0001';

/** What a play is grouped under at one level: a key that keeps same-named things apart, and what to show. */
function keyAt(p: Play, level: Exclude<Level, 'root'>, genres: GenreMap): [string, string] {
  switch (level) {
    case 'genre': {
      const g = genres.get(p.artist)?.top ?? UNSORTED;
      return [g, g];
    }
    case 'subgenre': {
      const s = genres.get(p.artist)?.sub ?? UNSORTED;
      return [s, s];
    }
    case 'artist':
      return [p.artist, p.artist];
    case 'album': {
      const a = p.album || NO_ALBUM;
      return [p.artist + SEP + a, a];
    }
    case 'track':
      return [p.artist + SEP + p.track, p.track];
  }
}

/**
 * Builds the tree through the chosen levels (any of genre → sub-genre → artist → album → track, in that order),
 * with play counts and hours summed at every node. Skipping a level joins the levels on either side of it.
 */
export function buildTree(plays: Play[], genres: GenreMap, levels: Exclude<Level, 'root'>[] = LEVELS): TreeNode {
  const root: TreeNode = { id: 'root', name: 'All music', level: 'root', depth: 0, plays: 0, hours: 0, parent: null, children: [] };
  const index = new Map<string, TreeNode>();
  const showBy = !levels.includes('artist');
  for (const p of plays) {
    let n = root;
    for (const level of levels) {
      const [key, name] = keyAt(p, level, genres);
      const id = n.id + SEP + key;
      let c = index.get(id);
      if (!c) {
        c = { id, name, level, depth: n.depth + 1, plays: 0, hours: 0, parent: n, children: [] };
        if (showBy && (level === 'album' || level === 'track')) c.by = p.artist;
        index.set(id, c);
        n.children.push(c);
      }
      n = c;
    }
    const h = p.ms / HOUR_MS;
    for (let m: TreeNode | null = n; m; m = m.parent) {
      m.plays++;
      m.hours += h;
    }
  }
  return root;
}

const isGenreLevel = (n: TreeNode) => n.level === 'genre' || n.level === 'subgenre';

/** Children biggest first by the chosen metric. "Not classified" always goes last. */
export function sortedChildren(n: TreeNode, metric: Metric): TreeNode[] {
  return [...n.children].sort(
    (a, b) =>
      Number(a.name === UNSORTED && isGenreLevel(a)) - Number(b.name === UNSORTED && isGenreLevel(b)) ||
      b[metric] - a[metric] ||
      b.plays - a.plays ||
      a.name.localeCompare(b.name),
  );
}

export interface LaidNode {
  node: TreeNode;
  depth: number;
  y: number; // row number, can be fractional for parents centred on their children
}
export interface MoreNode {
  parent: TreeNode;
  depth: number;
  y: number;
  count: number;
  plays: number;
  hours: number;
}
export interface Link {
  from: TreeNode;
  /** Child node id, or `more:<parent id>` for the "+X more" node. */
  to: string;
  value: number;
  /** Offset of this link's start within the parent's bundle, in value units, so siblings stack. */
  offset: number;
  fromY: number;
  toY: number;
  depth: number;
}

export interface Layout {
  nodes: LaidNode[];
  more: MoreNode[];
  links: Link[];
  rows: number;
}

/**
 * Places every visible node: each collapsed node takes its own row, and an open node sits
 * centred on its children. Only the first `limit` children of a node are shown, then a "+X more" row.
 */
export function layoutTree(
  root: TreeNode,
  expanded: Set<string>,
  limits: Map<string, number>,
  metric: Metric,
  defaultLimit: number,
): Layout {
  const nodes: LaidNode[] = [];
  const more: MoreNode[] = [];
  const links: Link[] = [];
  let row = 0;

  const place = (n: TreeNode): number => {
    if (!expanded.has(n.id) || !n.children.length) {
      const y = row++;
      nodes.push({ node: n, depth: n.depth, y });
      return y;
    }
    const kids = sortedChildren(n, metric);
    const limit = limits.get(n.id) ?? defaultLimit;
    const shown = kids.slice(0, limit);
    const pending: Omit<Link, 'fromY'>[] = [];
    let offset = 0;
    const ys: number[] = [];
    for (const k of shown) {
      const y = place(k);
      ys.push(y);
      pending.push({ from: n, to: k.id, value: k[metric], offset, toY: y, depth: n.depth });
      offset += k[metric];
    }
    const hidden = kids.slice(limit);
    if (hidden.length) {
      const y = row++;
      const plays = hidden.reduce((s, k) => s + k.plays, 0);
      const hours = hidden.reduce((s, k) => s + k.hours, 0);
      more.push({ parent: n, depth: n.depth + 1, y, count: hidden.length, plays, hours });
      ys.push(y);
      const value = metric === 'plays' ? plays : hours;
      pending.push({ from: n, to: 'more:' + n.id, value, offset, toY: y, depth: n.depth });
    }
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    nodes.push({ node: n, depth: n.depth, y });
    for (const l of pending) links.push({ ...l, fromY: y });
    return y;
  };
  place(root);
  return { nodes, more, links, rows: row };
}

/** Opens every ancestor of a node, and raises each parent's limit far enough that the node is shown. */
export function reveal(
  target: TreeNode,
  expanded: Set<string>,
  limits: Map<string, number>,
  metric: Metric,
  defaultLimit: number,
): { expanded: Set<string>; limits: Map<string, number> } {
  const e = new Set(expanded);
  const l = new Map(limits);
  for (let n = target; n.parent; n = n.parent) {
    const p = n.parent;
    e.add(p.id);
    const i = sortedChildren(p, metric).indexOf(n);
    const cur = l.get(p.id) ?? defaultLimit;
    if (i >= cur) l.set(p.id, Math.ceil((i + 1) / defaultLimit) * defaultLimit);
  }
  return { expanded: e, limits: l };
}

export interface TreeHit {
  node: TreeNode;
  /** Where it sits, e.g. "Rock › Classic Rock › The Beatles". */
  path: string;
}

/** Every node below the root, with a normalised name for matching. */
export function flattenTree(root: TreeNode): { node: TreeNode; key: string }[] {
  const out: { node: TreeNode; key: string }[] = [];
  const walk = (n: TreeNode) => {
    for (const c of n.children) {
      out.push({ node: c, key: norm(c.name) });
      walk(c);
    }
  };
  walk(root);
  return out;
}

export function pathOf(n: TreeNode): string {
  const parts: string[] = [];
  for (let p = n.parent; p && p.parent; p = p.parent) parts.unshift(p.name);
  const path = parts.join(' › ');
  return n.by ? (path ? `${path} · by ${n.by}` : `by ${n.by}`) : path;
}

/** Exact names first, then names with a word starting with the query, then any match; most played first within each. */
export function searchTree(flat: { node: TreeNode; key: string }[], q: string, n: number): TreeHit[] {
  const qn = norm(q);
  if (!qn) return [];
  const hits: { node: TreeNode; tier: number }[] = [];
  for (const f of flat) {
    if (f.key === qn) hits.push({ node: f.node, tier: 0 });
    else if (f.key.startsWith(qn) || f.key.includes(' ' + qn)) hits.push({ node: f.node, tier: 1 });
    else if (f.key.includes(qn)) hits.push({ node: f.node, tier: 2 });
  }
  hits.sort((a, b) => a.tier - b.tier || b.node.plays - a.node.plays || a.node.depth - b.node.depth);
  return hits.slice(0, n).map(({ node }) => ({ node, path: pathOf(node) }));
}

/** Opens the root, and keeps opening while a node has just one child (handy when the dashboard is focused on one thing). */
export function autoExpand(root: TreeNode, expanded: Set<string>): Set<string> {
  const e = new Set(expanded);
  let n: TreeNode = root;
  e.add(n.id);
  while (n.children.length === 1) {
    n = n.children[0];
    e.add(n.id);
  }
  return e;
}
