import { useEffect, useMemo, useState } from 'react';
import FilterBar, { DIM_LABELS } from './FilterBar';
import StatTiles from './StatTiles';
import TopList from './TopList';
import DailyChart from './DailyChart';
import TopOverTime from './TopOverTime';
import Heatmap from './Heatmap';
import YearChart from './YearChart';
import DiscoveryChart from './DiscoveryChart';
import { applyFilters, itemKey, summarize, topBy, type Dim, type Filters, type GenreMap, type Metric } from '../lib/stats';
import { loadGenres } from '../lib/deezer';
import { fmtDay } from '../lib/format';
import type { ParseResult } from '../lib/types';

interface Props {
  data: ParseResult;
  onReset: () => void;
}

/** How many of your most-played artists get a genre lookup. */
const GENRE_ARTISTS = 300;

export default function Dashboard({ data, onReset }: Props) {
  const { plays } = data;
  const minDay = plays[0].day;
  const maxDay = plays[plays.length - 1].day;
  const years = useMemo(() => [...new Set(plays.map((p) => p.year))].sort((a, b) => a - b), [plays]);
  const hasPodcasts = useMemo(() => plays.some((p) => p.kind === 'podcast'), [plays]);

  const [filters, setFilters] = useState<Filters>({
    from: minDay,
    to: maxDay,
    kind: plays.some((p) => p.kind === 'music') ? 'music' : 'podcast',
    minSeconds: 30,
    focus: null,
  });
  const [metric, setMetric] = useState<Metric>('plays');
  const [dim, setDim] = useState<Dim>('artist');

  // Everything except the date range and focus: used where "all time" context matters.
  const kindPlays = useMemo(
    () => plays.filter((p) => p.kind === filters.kind && p.ms >= filters.minSeconds * 1000),
    [plays, filters.kind, filters.minSeconds],
  );

  // Genres are looked up only once someone asks for them.
  const wantGenres = filters.kind === 'music' && (dim === 'genre' || filters.focus?.by === 'genre');
  const genreArtists = useMemo(
    () => (wantGenres ? topBy(kindPlays, 'artist', 'plays', GENRE_ARTISTS).map((r) => r.artist) : []),
    [wantGenres, kindPlays],
  );
  const [genres, setGenres] = useState<GenreMap>(() => new Map());
  const [genresDone, setGenresDone] = useState(0);
  useEffect(() => {
    if (!genreArtists.length) return;
    return loadGenres(genreArtists, (g, done) => {
      setGenres(g);
      setGenresDone(done);
    });
  }, [genreArtists]);

  const filtered = useMemo(() => applyFilters(plays, filters, genres), [plays, filters, genres]);
  const summary = useMemo(() => summarize(filtered, filters.from, filters.to), [filtered, filters.from, filters.to]);

  // The ranking panels ignore a focus on their own dimension, so the other rows stay clickable.
  const rankPlays = useMemo(
    () => (filters.focus?.by === dim ? applyFilters(plays, { ...filters, focus: null }, genres) : filtered),
    [filters, dim, plays, genres, filtered],
  );
  const yearPlays = useMemo(() => {
    const f = filters.focus;
    return f ? kindPlays.filter((p) => itemKey(p, f.by, genres) === f.key) : kindPlays;
  }, [kindPlays, filters.focus, genres]);

  const genreNote = useMemo(() => {
    if (dim !== 'genre') return undefined;
    const known = rankPlays.reduce((n, p) => n + (genres.has(p.artist) ? 1 : 0), 0);
    const pct = rankPlays.length ? Math.round((known / rankPlays.length) * 100) : 0;
    const loading = genresDone < genreArtists.length;
    return loading
      ? `Looking up genres on Deezer… ${genresDone} of ${genreArtists.length} artists. Covers ${pct}% of plays so far.`
      : `Genres come from Deezer, by artist. Known for ${pct}% of plays in this range; the rest are left out.`;
  }, [dim, rankPlays, genres, genresDone, genreArtists.length]);

  const isMusic = filters.kind === 'music';
  const noun = DIM_LABELS[dim][filters.kind].toLowerCase();

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Listening stats</h1>
          <p className="muted">
            {fmtDay(minDay)} to {fmtDay(maxDay)} · {plays.length.toLocaleString()} streams from{' '}
            {data.files.length} file{data.files.length === 1 ? '' : 's'}
            {data.format === 'basic' && ' · account data export (last 12 months only)'}
          </p>
        </div>
        <button className="ghost" onClick={onReset}>
          Load another file
        </button>
      </header>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        minDay={minDay}
        maxDay={maxDay}
        years={years}
        hasPodcasts={hasPodcasts}
        measure={metric}
        setMeasure={setMetric}
        dim={dim}
        setDim={setDim}
      />

      <StatTiles s={summary} kind={filters.kind} />

      <div className="grid">
        <TopOverTime
          plays={filtered}
          from={filters.from}
          to={filters.to}
          metric={metric}
          by={dim}
          noun={noun}
          genres={genres}
          note={genreNote}
        />
        <TopList
          title={`Top ${noun}`}
          plays={rankPlays}
          by={dim}
          metric={metric}
          genres={genres}
          focus={filters.focus}
          onPick={(focus) => setFilters({ ...filters, focus })}
          showThumbs={isMusic}
          note={dim === 'genre' ? genreNote : undefined}
        />
        <Heatmap plays={filtered} metric={metric} />
        <DailyChart plays={filtered} from={filters.from} to={filters.to} metric={metric} />
        <YearChart
          plays={yearPlays}
          metric={metric}
          onPickYear={(y) =>
            setFilters({
              ...filters,
              from: `${y}-01-01` < minDay ? minDay : `${y}-01-01`,
              to: `${y}-12-31` > maxDay ? maxDay : `${y}-12-31`,
            })
          }
        />
        {isMusic && !filters.focus && <DiscoveryChart allPlays={kindPlays} from={filters.from} to={filters.to} />}
      </div>

      <footer className="foot muted">
        Your listening data never leaves this browser tab. Times are shown in your current time zone.
        {isMusic && ' Artist pictures, album covers and genres come from Deezer: only the names are sent to look them up.'}
      </footer>
    </div>
  );
}
