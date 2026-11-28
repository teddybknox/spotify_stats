import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';
import { fmtHours, fmtInt } from '../lib/format';
import type { GenreMap, Metric } from '../lib/stats';
import {
  autoExpand,
  buildTree,
  flattenTree,
  layoutTree,
  reveal,
  searchTree,
  type Level,
  type TreeHit,
  type TreeNode,
} from '../lib/tree';
import type { Play } from '../lib/types';

interface Props {
  plays: Play[];
  genres: GenreMap;
  metric: Metric;
  note?: string;
  /** Called once the panel scrolls into view, so genres can start loading. */
  onVisible: () => void;
}

/** Children shown per node before a "+X more" row. */
const LIMIT = 10;
const ROW = 34;
const CHIP = 26;
const GAP = 64;
const PAD = 8;
/** Thickest branch (the trunk leaving "All music"), in pixels. */
const MAX_W = 22;
const WIDTHS = [136, 170, 190, 190, 200, 220];
const XS = WIDTHS.map((_, d) => PAD + WIDTHS.slice(0, d).reduce((s, w) => s + w + GAP, 0));
const LEVEL_NAME: Record<Level, string> = {
  root: 'All',
  genre: 'Genre',
  subgenre: 'Sub-genre',
  artist: 'Artist',
  album: 'Album',
  track: 'Track',
};

const fmtVal = (plays: number, hours: number, metric: Metric) =>
  metric === 'plays' ? fmtInt(plays) : fmtHours(hours);

export default function GenreTree({ plays, genres, metric, note, onVisible }: Props) {
  const root = useMemo(() => buildTree(plays, genres), [plays, genres]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['root']));
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map());
  const [hit, setHit] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  useEffect(() => setExpanded((e) => autoExpand(root, e)), [root]);

  const layout = useMemo(() => layoutTree(root, expanded, limits, metric, LIMIT), [root, expanded, limits, metric]);
  const scale = root[metric] > 0 ? MAX_W / root[metric] : 0;

  // The searched node and everything above it are drawn in the accent colour.
  const onPath = useMemo(() => {
    const s = new Set<string>();
    if (!hit) return s;
    const target = layout.nodes.find((l) => l.node.id === hit)?.node;
    for (let n = target; n; n = n.parent ?? undefined) s.add(n.id);
    return s;
  }, [hit, layout]);

  // Start loading genres the first time the panel is on screen.
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        onVisible();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);

  useLayoutEffect(() => {
    if (!scrollTo || !stage.current) return;
    const el = stage.current.querySelector<HTMLElement>(`[data-id="${CSS.escape(scrollTo)}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    setScrollTo(null);
  }, [scrollTo, layout]);

  const toggle = (n: TreeNode) => {
    if (!n.children.length) return;
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      return next;
    });
  };

  const showMore = (parent: TreeNode) =>
    setLimits((l) => new Map(l).set(parent.id, (l.get(parent.id) ?? LIMIT) + LIMIT));

  const find = (n: TreeNode) => {
    const r = reveal(n, expanded, limits, metric, LIMIT);
    setExpanded(r.expanded);
    setLimits(r.limits);
    setHit(n.id);
    setScrollTo(n.id);
  };

  const collapseAll = () => {
    setExpanded(autoExpand(root, new Set()));
    setLimits(new Map());
    setHit(null);
  };

  const width = XS[5] + WIDTHS[5] + PAD;
  const height = Math.max(layout.rows, 1) * ROW + PAD * 2;
  const cy = (y: number) => PAD + y * ROW + ROW / 2;

  return (
    <Card
      wide
      title="Genre tree"
      subtitle={
        note ??
        `Genre → sub-genre → artist → album → track. Click a box to open it. Branch thickness and order follow ${
          metric === 'plays' ? 'plays' : 'time listened'
        }.`
      }
      controls={
        <>
          <TreeSearch root={root} onPick={find} />
          <button className="ghost" onClick={collapseAll}>
            Collapse all
          </button>
        </>
      }
    >
      <div ref={wrap}>
        {root.plays === 0 ? (
          <p className="empty">Nothing in this range.</p>
        ) : (
          <div className="tree-scroll">
            <div className="tree-cols" style={{ width }}>
              {(['genre', 'subgenre', 'artist', 'album', 'track'] as Level[]).map((l, i) => (
                <span key={l} style={{ left: XS[i + 1], width: WIDTHS[i + 1] }}>
                  {LEVEL_NAME[l]}
                </span>
              ))}
            </div>
            <div className="tree-stage" ref={stage} style={{ width, height }}>
              <svg width={width} height={height} aria-hidden>
                {layout.links.map((l) => {
                  const x0 = XS[l.depth] + WIDTHS[l.depth];
                  const x1 = XS[l.depth + 1];
                  const w = Math.max(1, l.value * scale);
                  const bundle = l.from[metric] * scale;
                  const y0 = cy(l.fromY) - bundle / 2 + (l.offset + l.value / 2) * scale;
                  const y1 = cy(l.toY);
                  const mx = (x0 + x1) / 2;
                  return (
                    <path
                      key={l.to}
                      className={`tree-link${onPath.has(l.to) ? ' on' : ''}${l.to.startsWith('more:') ? ' more' : ''}`}
                      d={`M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`}
                      strokeWidth={w}
                    />
                  );
                })}
              </svg>
              {layout.nodes.map(({ node: n, depth, y }) => {
                const open = expanded.has(n.id) && n.children.length > 0;
                const share = n.parent ? n[metric] / n.parent[metric] : 1;
                return (
                  <button
                    key={n.id}
                    data-id={n.id}
                    className={`tree-node${open ? ' open' : ''}${n.children.length ? '' : ' leaf'}${
                      hit === n.id ? ' hit' : onPath.has(n.id) ? ' on' : ''
                    }`}
                    style={{ left: XS[depth], top: cy(y) - CHIP / 2, width: WIDTHS[depth], height: CHIP }}
                    onClick={() => toggle(n)}
                    aria-expanded={n.children.length ? open : undefined}
                    title={`${LEVEL_NAME[n.level]}: ${n.name}\n${fmtInt(n.plays)} plays · ${fmtHours(n.hours)}${
                      n.parent ? `\n${Math.round(share * 100)}% of ${n.parent.name}` : ''
                    }${n.children.length ? `\n${n.children.length} ${n.children.length === 1 ? 'item' : 'items'} inside` : ''}`}
                  >
                    <span className="tree-name">{n.name}</span>
                    <span className="tree-val">{fmtVal(n.plays, n.hours, metric)}</span>
                    {n.children.length > 0 && <span className="tree-caret">{open ? '−' : '+'}</span>}
                  </button>
                );
              })}
              {layout.more.map((m) => (
                <button
                  key={'more:' + m.parent.id}
                  className="tree-node more"
                  style={{ left: XS[m.depth], top: cy(m.y) - CHIP / 2, width: WIDTHS[m.depth], height: CHIP }}
                  onClick={() => showMore(m.parent)}
                  title={`Show ${Math.min(LIMIT, m.count)} more`}
                >
                  <span className="tree-name">+{fmtInt(m.count)} more</span>
                  <span className="tree-val">{fmtVal(m.plays, m.hours, metric)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TreeSearch({ root, onPick }: { root: TreeNode; onPick: (n: TreeNode) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const flat = useMemo(() => flattenTree(root), [root]);
  const results = useMemo<TreeHit[]>(() => searchTree(flat, q, 10), [flat, q]);

  const pick = (h: TreeHit) => {
    onPick(h.node);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="search tree-search">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Find in the tree"
        placeholder="Find in the tree"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setQ('');
            setOpen(false);
          }
        }}
      />
      {open && q.trim() && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((h, i) => (
            <li
              key={h.node.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
            >
              <span className="search-kind">{LEVEL_NAME[h.node.level]}</span>
              <span className="search-label">
                <strong>{h.node.name}</strong>
                {h.path && <span className="muted"> · {h.path}</span>}
              </span>
              <span className="search-plays">{fmtInt(h.node.plays)} plays</span>
            </li>
          ))}
          {!results.length && <li className="search-empty muted">Nothing in the tree matches that.</li>}
        </ul>
      )}
    </div>
  );
}
