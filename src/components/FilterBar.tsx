import { useState, type ReactNode } from 'react';
import type { Dim, Filters, Unit } from '../lib/stats';
import type { Kind } from '../lib/types';
import { fmtDay, type Measure } from '../lib/format';
import { Segmented } from './Card';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  minDay: string;
  maxDay: string;
  years: number[];
  hasPodcasts: boolean;
  measure: Measure;
  setMeasure: (m: Measure) => void;
  dim: Dim;
  setDim: (d: Dim) => void;
  search?: ReactNode;
  unit: Unit;
  setUnit: (u: Unit) => void;
}

export const DIM_LABELS: Record<Dim, { music: string; podcast: string }> = {
  artist: { music: 'Artists', podcast: 'Shows' },
  track: { music: 'Tracks', podcast: 'Episodes' },
  album: { music: 'Albums', podcast: '' },
  genre: { music: 'Genres', podcast: '' },
  subgenre: { music: 'Sub-genres', podcast: '' },
  decade: { music: 'Decades', podcast: '' },
};

const OPEN_KEY = 'spotify-stats:settings-open';

function initialOpen(): boolean {
  try {
    const saved = localStorage.getItem(OPEN_KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch {
    /* storage unavailable */
  }
  return typeof window === 'undefined' || !window.matchMedia('(max-width: 700px)').matches;
}

function shortDay(day: string): string {
  return fmtDay(day).replace(/^(\w{3})\w* /, '$1 ');
}

function shiftYear(day: string, years: number): string {
  const [y, m, d] = day.split('-');
  return `${Number(y) + years}-${m}-${d}`;
}

export default function FilterBar({ filters, setFilters, minDay, maxDay, years, hasPodcasts, measure, setMeasure, dim, setDim, search, unit, setUnit }: Props) {
  const dims = (Object.keys(DIM_LABELS) as Dim[]).filter((d) => DIM_LABELS[d][filters.kind]);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const clamp = (d: string) => (d < minDay ? minDay : d > maxDay ? maxDay : d);
  const last12From = clamp(shiftYear(maxDay, -1));

  const presets = [
    { label: 'All time', from: minDay, to: maxDay },
    { label: 'Last 12 months', from: last12From, to: maxDay },
    ...[...years].reverse().map((y) => ({ label: String(y), from: clamp(`${y}-01-01`), to: clamp(`${y}-12-31`) })),
  ];

  const [open, setOpen] = useState(initialOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };

  const preset = presets.find((p) => filters.from === p.from && filters.to === p.to);
  const summary = [
    preset ? preset.label : `${shortDay(filters.from)} – ${shortDay(filters.to)}`,
    filters.kind === 'podcast' ? 'Podcasts' : null,
    measure === 'plays' ? 'Plays' : 'Time',
    DIM_LABELS[dim][filters.kind],
    unit === 'month' ? 'By month' : 'By year',
  ]
    .filter(Boolean)
    .join(' · ');

  const focusChip = filters.focus && (
    <button className="chip on removable" onClick={() => set({ focus: null })} aria-label="Clear focus">
      {filters.focus.label} <span aria-hidden>×</span>
    </button>
  );

  const toggleButton = (
    <button className="settings-toggle" onClick={toggle} aria-expanded={open} aria-controls="filter-settings">
      {open ? 'Hide' : 'Settings'}
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={open ? 'up' : ''}>
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (!open) {
    return (
      <div className="filterbar collapsed">
        <div className="filter-collapsed">
          <button className="filter-summary" onClick={toggle} aria-label={`Show settings. Current: ${summary}`}>
            {summary}
          </button>
          {focusChip}
          {toggleButton}
        </div>
      </div>
    );
  }

  return (
    <div className="filterbar" id="filter-settings">
      <div className="filter-top">
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
        {toggleButton}
      </div>
      <div className="filter-row">
        {search}
        <div className="measure">
          <span className="ctl-label">Measure by</span>
          <Segmented
            label="Measure by"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'plays', label: 'Plays' },
              { value: 'hours', label: 'Time' },
            ]}
          />
        </div>
        <div className="measure">
          <span className="ctl-label">Group by</span>
          <Segmented
            label="Group by"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </div>
        <div className="measure rank-ctl">
          <span className="ctl-label">Rank</span>
          <Segmented
            label="Rank"
            value={dim}
            onChange={setDim}
            options={dims.map((d) => ({ value: d, label: DIM_LABELS[d][filters.kind] }))}
          />
        </div>
      </div>
      <div className="filter-row">
        <label>
          <span className="ctl-label">From</span>
          <input
            type="date"
            min={minDay}
            max={filters.to}
            value={filters.from}
            onChange={(e) => e.target.value && set({ from: clamp(e.target.value) })}
          />
        </label>
        <label>
          <span className="ctl-label">To</span>
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
            <span className="ctl-label">Listening to</span>
            <select
              value={filters.kind}
              onChange={(e) => {
                const kind = e.target.value as Kind;
                set({ kind, focus: null });
                if (!DIM_LABELS[dim][kind]) setDim('artist');
              }}
            >
              <option value="music">Music</option>
              <option value="podcast">Podcasts</option>
            </select>
          </label>
        )}
        <label title="Plays shorter than this are ignored. Spotify itself counts a stream after 30 seconds.">
          <span className="ctl-label">Count plays over</span>
          <select value={filters.minSeconds} onChange={(e) => set({ minSeconds: Number(e.target.value) })}>
            <option value={0}>any length</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
          </select>
        </label>
        {focusChip}
      </div>
    </div>
  );
}
