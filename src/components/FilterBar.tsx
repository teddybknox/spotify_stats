import type { Filters } from '../lib/stats';
import type { Kind } from '../lib/types';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  minDay: string;
  maxDay: string;
  years: number[];
  hasPodcasts: boolean;
}

function shiftYear(day: string, years: number): string {
  const [y, m, d] = day.split('-');
  return `${Number(y) + years}-${m}-${d}`;
}

export default function FilterBar({ filters, setFilters, minDay, maxDay, years, hasPodcasts }: Props) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const clamp = (d: string) => (d < minDay ? minDay : d > maxDay ? maxDay : d);
  const last12From = clamp(shiftYear(maxDay, -1));

  const presets = [
    { label: 'All time', from: minDay, to: maxDay },
    { label: 'Last 12 months', from: last12From, to: maxDay },
    ...[...years].reverse().map((y) => ({ label: String(y), from: clamp(`${y}-01-01`), to: clamp(`${y}-12-31`) })),
  ];

  return (
    <div className="filterbar">
      <div className="chips" role="group" aria-label="Date range">
        {presets.map((p) => (
          <button
            key={p.label}
            className={`chip${filters.from === p.from && filters.to === p.to ? ' on' : ''}`}
            onClick={() => set({ from: p.from, to: p.to })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <label>
          From
          <input
            type="date"
            min={minDay}
            max={filters.to}
            value={filters.from}
            onChange={(e) => e.target.value && set({ from: clamp(e.target.value) })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            min={filters.from}
            max={maxDay}
            value={filters.to}
            onChange={(e) => e.target.value && set({ to: clamp(e.target.value) })}
          />
        </label>
        {hasPodcasts && (
          <label>
            Show
            <select value={filters.kind} onChange={(e) => set({ kind: e.target.value as Kind, artist: null })}>
              <option value="music">Music</option>
              <option value="podcast">Podcasts</option>
            </select>
          </label>
        )}
        <label title="Plays shorter than this are ignored. Spotify itself counts a stream after 30 seconds.">
          Count plays over
          <select value={filters.minSeconds} onChange={(e) => set({ minSeconds: Number(e.target.value) })}>
            <option value={0}>any length</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
          </select>
        </label>
        {filters.artist && (
          <button className="chip on removable" onClick={() => set({ artist: null })} aria-label="Clear artist filter">
            {filters.artist} <span aria-hidden>×</span>
          </button>
        )}
      </div>
    </div>
  );
}
