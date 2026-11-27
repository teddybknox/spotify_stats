import { useId, useMemo, useRef, useState } from 'react';
import { searchIndex, type Dim, type Focus, type SearchItem } from '../lib/stats';
import { fmtInt } from '../lib/format';
import type { Kind } from '../lib/types';
import { DIM_LABELS } from './FilterBar';

interface Props {
  index: SearchItem[];
  kind: Kind;
  onPick: (f: Focus) => void;
  /** Called the first time the box is used, so genres can start loading. */
  onActivate: () => void;
  genresLoading: boolean;
}

const singular = (by: Dim, kind: Kind) => DIM_LABELS[by][kind].replace(/s$/, '');

export default function SearchBox({ index, kind, onPick, onActivate, genresLoading }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchIndex(index, q, 8), [index, q]);

  const pick = (r: SearchItem) => {
    onPick({ by: r.by, key: r.key, label: r.label });
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  const placeholder = kind === 'music' ? 'Search artists, tracks, albums, genres, decades' : 'Search shows and episodes';

  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder}
        placeholder={placeholder}
        value={q}
        onFocus={() => {
          onActivate();
          setOpen(true);
        }}
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
          {results.map((r, i) => (
            <li
              key={`${r.by}|${r.key}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              <span className="search-kind">{singular(r.by, kind)}</span>
              <span className="search-label">
                <strong>{r.label}</strong>
                {r.sub && <span className="muted"> · {r.sub}</span>}
              </span>
              <span className="search-plays">{fmtInt(r.plays)} plays</span>
            </li>
          ))}
          {!results.length && <li className="search-empty muted">Nothing in your history matches that.</li>}
          {kind === 'music' && genresLoading && <li className="search-empty muted">Genres are still loading…</li>}
        </ul>
      )}
    </div>
  );
}
