import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';
import { fmtHours, fmtInt } from '../lib/format';
import type { GenreMap, Metric } from '../lib/stats';
import {
  autoExpand,
  buildTree,
  flattenTree,
  layoutTree,
  LEVELS,
  reveal,
  searchTree,
  type Level,
  type TreeHit,
  sortedChildren,
  type TreeNode,
} from '../lib/tree';
import { NARROW, useMedia } from '../lib/useMedia';
import { InStory, StorySwitch } from './Share';
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
/** Rows shown per list on phones before "Show more". */
const PHONE_LIMIT = 20;
const CHIP = 26;
const GAP = 64;
const PAD = 8;
/** Thickest branch (the trunk leaving "All music"), in pixels. */
const MAX_W = 22;
const WIDTH: Record<Level, number> = { root: 136, genre: 170, subgenre: 190, artist: 190, album: 200, track: 220 };
/** Albums and tracks also show their artist when the artist level is hidden, so they get more room. */
const BY_EXTRA = 70;
type Shown = Exclude<Level, 'root'>;
const LEVEL_NAME: Record<Level, string> = {
  root: 'All',
  genre: 'Genre',
  subgenre: 'Sub-genre',
  artist: 'Artist',
  album: 'Album',
  track: 'Track',
};

const PLURAL: Record<Level, string> = {
  root: 'All',
  genre: 'Genres',
  subgenre: 'Sub-genres',
  artist: 'Artists',
  album: 'Albums',
  track: 'Tracks',
};

/** Node ids join names with a control character, which isn't allowed in saved story images; this makes them safe for the page. */
const domId = (id: string) => encodeURIComponent(id);

const fmtVal = (plays: number, hours: number, metric: Metric) =>
  metric === 'plays' ? fmtInt(plays) : fmtHours(hours);

export default function GenreTree({ plays, genres, metric, note, onVisible }: Props) {
  const [shown, setShown] = useState<Set<Shown>>(() => new Set(LEVELS));
  const levels = useMemo(() => LEVELS.filter((l) => shown.has(l)), [shown]);
  const levelsKey = levels.join();
  const root = useMemo(() => buildTree(plays, genres, levels), [plays, genres, levels]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['root']));
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map());
  const [hit, setHit] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const narrow = useMedia(NARROW);
  // Phones show one level at a time: the ids from the root down to the list being shown.
  const [path, setPath] = useState<string[]>([]);
  const [phoneLimits, setPhoneLimits] = useState<Map<string, number>>(() => new Map());
  // New data keeps what's open; a different set of levels starts again from the top.
  const lastLevels = useRef(levelsKey);
  useEffect(() => {
    if (lastLevels.current !== levelsKey) {
      lastLevels.current = levelsKey;
      setLimits(new Map());
      setHit(null);
      setPath([]);
      setPhoneLimits(new Map());
      setExpanded(autoExpand(root, new Set()));
    } else setExpanded((e) => autoExpand(root, e));
  }, [root, levelsKey]);

  const toggleLevel = (l: Shown) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(l)) {
        if (next.size > 1) next.delete(l);
      } else next.add(l);
      return next;
    });

  // Column positions for the levels being shown.
  const { WIDTHS, XS } = useMemo(() => {
    const byArtist = !levels.includes('artist');
    const WIDTHS = (['root', ...levels] as Level[]).map(
      (l) => WIDTH[l] + (byArtist && (l === 'album' || l === 'track') ? BY_EXTRA : 0),
    );
    const XS = WIDTHS.map((_, d) => PAD + WIDTHS.slice(0, d).reduce((s, w) => s + w + GAP, 0));
    return { WIDTHS, XS };
  }, [levels]);
  const last = levels.length;

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
    if (!scrollTo) return;
    // The first match is the panel itself (a story card copy, if open, comes later in the page).
    const el = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(domId(scrollTo))}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    setScrollTo(null);
  }, [scrollTo, layout, path]);

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
    if (narrow) {
      const ids: string[] = [];
      for (let p = n.parent; p && p.parent; p = p.parent) ids.unshift(p.id);
      setPath(ids);
      if (n.parent) {
        const i = sortedChildren(n.parent, metric).indexOf(n);
        const id = n.parent.id;
        setPhoneLimits((l) => new Map(l).set(id, Math.max(l.get(id) ?? PHONE_LIMIT, Math.ceil((i + 1) / PHONE_LIMIT) * PHONE_LIMIT)));
      }
      setHit(n.id);
      setScrollTo(n.id);
      return;
    }
    const r = reveal(n, expanded, limits, metric, LIMIT);
    setExpanded(r.expanded);
    setLimits(r.limits);
    setHit(n.id);
    setScrollTo(n.id);
  };

  const collapseAll = () => {
    setPath([]);
    setExpanded(autoExpand(root, new Set()));
    setLimits(new Map());
    setHit(null);
  };

  const width = XS[last] + WIDTHS[last] + PAD;
  const height = Math.max(layout.rows, 1) * ROW + PAD * 2;
  const cy = (y: number) => PAD + y * ROW + ROW / 2;

  const phoneTree = (
          <PhoneTree
            root={root}
            path={path}
            setPath={setPath}
            metric={metric}
            hit={hit}
            limits={phoneLimits}
            showMore={(id) => setPhoneLimits((l) => new Map(l).set(id, (l.get(id) ?? PHONE_LIMIT) + PHONE_LIMIT))}
          />
  );

  return (
    <Card
      wide
      title="Genre tree"
      subtitle={
        note ??
        `${levels.map((l) => LEVEL_NAME[l]).join(' → ')}. ${narrow ? 'Tap a row to open it.' : 'Click a box to open it.'} ${narrow ? 'Bars and order' : 'Branch'} ${narrow ? '' : 'thickness and order '}follow ${
          metric === 'plays' ? 'plays' : 'time listened'
        }.`
      }
      controls={
        <>
          <TreeSearch root={root} onPick={find} />
          <button className="ghost" onClick={collapseAll}>
            {narrow ? 'Back to top' : 'Collapse all'}
          </button>
        </>
      }
    >
      <div ref={wrap}>
        <div className="tree-levels" role="group" aria-label="Levels to show">
          <span className="muted">Levels</span>
          {LEVELS.map((l) => {
            const on = shown.has(l);
            return (
              <button
                key={l}
                className={`chip${on ? ' on' : ''}`}
                aria-pressed={on}
                disabled={on && shown.size === 1}
                onClick={() => toggleLevel(l)}
                title={on ? `Skip the ${LEVEL_NAME[l].toLowerCase()} level` : `Show the ${LEVEL_NAME[l].toLowerCase()} level`}
              >
                {LEVEL_NAME[l]}
              </button>
            );
          })}
        </div>
        {root.plays === 0 ? (
          <p className="empty">Nothing in this range.</p>
        ) : narrow ? (
          phoneTree
        ) : (
          <StorySwitch story={phoneTree}>
          <div className="tree-scroll">
            <div className="tree-cols" style={{ width }}>
              {levels.map((l, i) => (
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
                    data-id={domId(n.id)}
                    className={`tree-node${open ? ' open' : ''}${n.children.length ? '' : ' leaf'}${
                      hit === n.id ? ' hit' : onPath.has(n.id) ? ' on' : ''
                    }`}
                    style={{ left: XS[depth], top: cy(y) - CHIP / 2, width: WIDTHS[depth], height: CHIP }}
                    onClick={() => toggle(n)}
                    aria-expanded={n.children.length ? open : undefined}
                    title={`${LEVEL_NAME[n.level]}: ${n.name}${n.by ? ` by ${n.by}` : ''}\n${fmtInt(n.plays)} plays · ${fmtHours(n.hours)}${
                      n.parent ? `\n${Math.round(share * 100)}% of ${n.parent.name}` : ''
                    }${n.children.length ? `\n${n.children.length} ${n.children.length === 1 ? 'item' : 'items'} inside` : ''}`}
                  >
                    <span className="tree-name">
                      {n.name}
                      {n.by && <span className="tree-by"> · {n.by}</span>}
                    </span>
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
          </StorySwitch>
        )}
      </div>
    </Card>
  );
}

interface PhoneProps {
  root: TreeNode;
  path: string[];
  setPath: (p: string[]) => void;
  metric: Metric;
  hit: string | null;
  limits: Map<string, number>;
  showMore: (id: string) => void;
}

/** One level at a time, like folders: tap a row to open it, Back or the trail above to go up. */
function PhoneTree({ root, path, setPath, metric, hit, limits, showMore }: PhoneProps) {
  // Follow the path as far as it still exists (new data or filters can remove a branch).
  const trail: TreeNode[] = [root];
  for (const id of path) {
    const next = trail[trail.length - 1].children.find((c) => c.id === id);
    if (!next) break;
    trail.push(next);
  }
  const cur = trail[trail.length - 1];
  const kids = useMemo(() => sortedChildren(cur, metric), [cur, metric]);
  // A story card shows the top 10 only.
  const story = useContext(InStory);
  const limit = story ? 10 : (limits.get(cur.id) ?? PHONE_LIMIT);
  const top = kids[0]?.[metric] || 1;
  const childLevel = kids[0]?.level;
  const ids = trail.slice(1).map((n) => n.id);
  const crumbs = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = crumbs.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [cur.id]);

  return (
    <div className="ptree">
      <nav className="ptree-nav" aria-label="Where you are in the tree">
        <button className="ptree-back" onClick={() => setPath(ids.slice(0, -1))} disabled={trail.length === 1} aria-label="Back up one level">
          ‹ Back
        </button>
        <ol className="ptree-crumbs" ref={crumbs}>
          {trail.map((n, i) => (
            <li key={n.id}>
              {i < trail.length - 1 ? (
                <button onClick={() => setPath(ids.slice(0, i))}>{n.name}</button>
              ) : (
                <span aria-current="location">{n.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="ptree-head">
        <span>
          {fmtInt(kids.length)} {childLevel ? (kids.length === 1 ? LEVEL_NAME[childLevel] : PLURAL[childLevel]).toLowerCase() : 'items'}
        </span>
        <span>
          {metric === 'plays' ? `${fmtInt(cur.plays)} plays` : fmtHours(cur.hours)}
          {cur.parent && ` · ${Math.round((cur[metric] / (cur.parent[metric] || 1)) * 100)}% of ${cur.parent.name}`}
        </span>
      </div>
      <ul className="ptree-list">
        {kids.slice(0, limit).map((c) => {
          const share = cur[metric] ? c[metric] / cur[metric] : 0;
          const open = c.children.length > 0;
          return (
            <li key={c.id}>
              <button
                data-id={domId(c.id)}
                className={`ptree-row${hit === c.id ? ' hit' : ''}`}
                disabled={!open}
                onClick={() => setPath([...ids, c.id])}
              >
                <span className="ptree-text">
                  <span className="ptree-name">{c.name}</span>
                  {c.by && <span className="ptree-sub">{c.by}</span>}
                  <span className="bar-track">
                    <span className="bar" style={{ width: `${Math.max(1, (c[metric] / top) * 100)}%` }} />
                  </span>
                </span>
                <span className="ptree-val">
                  {fmtVal(c.plays, c.hours, metric)}
                  <small>{share >= 0.01 ? `${Math.round(share * 100)}%` : '<1%'}</small>
                </span>
                <span className="ptree-chev" aria-hidden>
                  {open ? '›' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {kids.length > limit && (
        <button className="ghost ptree-more" onClick={() => showMore(cur.id)}>
          Show {fmtInt(Math.min(PHONE_LIMIT, kids.length - limit))} more of {fmtInt(kids.length - limit)}
        </button>
      )}
    </div>
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
