import { useEffect, useMemo, useState } from 'react';
import FilterBar, { DIM_LABELS } from './FilterBar';
import SearchBox from './SearchBox';
import StatTiles from './StatTiles';
import TopList from './TopList';
import DailyChart from './DailyChart';
import TopOverTime from './TopOverTime';
import Heatmap from './Heatmap';
import DiscoveryChart from './DiscoveryChart';
import PeriodTable from './PeriodTable';
import { applyFilters, buildSearchIndex, isGenreDim, itemKey, summarize, topBy, type Dim, type Filters, type GenreMap, type Metric, type Unit } from '../lib/stats';
import { loadGenres } from '../lib/deezer';
import { fmtDay } from '../lib/format';
import type { ParseResult } from '../lib/types';

interface Props {
  data: ParseResult;
  onReset: () => void;
}

/** How many of your most-played artists missing from the shared genre file get a live lookup. */
const LIVE_GENRE_LOOKUPS = 300;

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
  const [unit, setUnit] = useState<Unit>('month');

  // Everything except the date range and focus: used where "all time" context matters.
  const kindPlays = useMemo(
    () => plays.filter((p) => p.kind === filters.kind && p.ms >= filters.minSeconds * 1000),
    [plays, filters.kind, filters.minSeconds],
  );

  // Genres are looked up only once someone asks for them.
  const [searching, setSearching] = useState(false);
  const wantGenres =
    filters.kind === 'music' && (isGenreDim(dim) || (filters.focus !== null && isGenreDim(filters.focus.by)) || searching);
  const genreArtists = useMemo(
    () => (wantGenres ? topBy(kindPlays, 'artist', 'plays', Infinity).map((r) => r.artist) : []),
    [wantGenres, kindPlays],
  );
  const [genres, setGenres] = useState<GenreMap>(() => new Map());
  const [genreProgress, setGenreProgress] = useState({ done: 0, total: -1 });
  useEffect(() => {
    if (!genreArtists.length) return;
    return loadGenres(genreArtists, LIVE_GENRE_LOOKUPS, (g, done, total) => {
      setGenres(g);
      setGenreProgress({ done, total });
    });
  }, [genreArtists]);

  // Search covers everything in this export (all dates), not just the selected range.
  const searchIdx = useMemo(() => {
    if (!searching) return [];
    const dims = (Object.keys(DIM_LABELS) as Dim[]).filter((d) => DIM_LABELS[d][filters.kind]);
    return buildSearchIndex(kindPlays, dims, genres);
  }, [searching, kindPlays, filters.kind, genres]);

  // Drill-down: focusing one genre turns the genre panels into its sub-genres.
  const focus = filters.focus;
  const drill = dim === 'genre' && focus !== null && isGenreDim(focus.by);
  const viewDim: Dim = drill ? 'subgenre' : dim;
  const subToTop = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of genres.values()) m.set(g.sub, g.top);
    return m;
  }, [genres]);
  const drillTop = drill ? (focus.by === 'genre' ? focus.key : subToTop.get(focus.key)) : undefined;

  const filtered = useMemo(() => applyFilters(plays, filters, genres), [plays, filters, genres]);
  const summary = useMemo(() => summarize(filtered, filters.from, filters.to), [filtered, filters.from, filters.to]);

  // The ranking panels ignore a focus on their own dimension, so the other rows stay clickable.
  // When drilled into a sub-genre, its siblings in the same top-level genre stay listed.
  const rankPlays = useMemo(() => {
    if (focus?.by === 'subgenre' && isGenreDim(viewDim)) {
      const top = subToTop.get(focus.key);
      return applyFilters(plays, { ...filters, focus: top ? { by: 'genre', key: top, label: top } : null }, genres);
    }
    return focus?.by === viewDim ? applyFilters(plays, { ...filters, focus: null }, genres) : filtered;
  }, [filters, focus, viewDim, plays, genres, filtered, subToTop]);
  const yearPlays = useMemo(() => {
    const f = filters.focus;
    return f ? kindPlays.filter((p) => itemKey(p, f.by, genres) === f.key) : kindPlays;
  }, [kindPlays, filters.focus, genres]);

  const genreNote = useMemo(() => {
    if (!isGenreDim(viewDim)) return undefined;
    const known = rankPlays.reduce((n, p) => n + (genres.has(p.artist) ? 1 : 0), 0);
    const pct = rankPlays.length ? Math.round((known / rankPlays.length) * 100) : 0;
    const { done, total } = genreProgress;
    if (total < 0) return 'Loading genres…';
    return done < total
      ? `Looking up genres on Deezer… ${done} of ${total} artists. Covers ${pct}% of plays so far.`
      : `Each artist's genre was classified by Claude. Known for ${pct}% of plays in this range; the rest are left out.${
          viewDim === 'genre' ? ' Click a genre to see its sub-genres.' : ''
        }`;
  }, [viewDim, rankPlays, genres, genreProgress]);

  const isMusic = filters.kind === 'music';
  const noun = DIM_LABELS[viewDim][filters.kind].toLowerCase();
  const nounIn = drillTop ? `${noun} in ${drillTop}` : noun;

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
        unit={unit}
        setUnit={setUnit}
        search={
          <SearchBox
            index={searchIdx}
            kind={filters.kind}
            onPick={(focus) => setFilters({ ...filters, focus })}
            onActivate={() => setSearching(true)}
            genresLoading={wantGenres && genreProgress.total >= 0 && genreProgress.done < genreProgress.total}
          />
        }
      />

      <StatTiles s={summary} kind={filters.kind} />

      <div className="grid">
        <TopOverTime
          plays={filtered}
          from={filters.from}
          to={filters.to}
          metric={metric}
          by={viewDim}
          noun={nounIn}
          genres={genres}
          note={genreNote}
          unit={unit}
        />
        <TopList
          title={`Top ${nounIn}`}
          plays={rankPlays}
          by={viewDim}
          metric={metric}
          genres={genres}
          focus={filters.focus}
          onPick={(focus) => setFilters({ ...filters, focus })}
          showThumbs={isMusic}
          note={genreNote}
        />
        <Heatmap plays={filtered} metric={metric} />
        <DailyChart plays={filtered} from={filters.from} to={filters.to} metric={metric} />
        <DiscoveryChart
          allPlays={filters.focus && filters.focus.by !== viewDim ? yearPlays : kindPlays}
          from={filters.from}
          to={filters.to}
          by={viewDim}
          noun={nounIn}
          genres={genres}
          unit={unit}
        />
        <PeriodTable
          plays={filtered}
          from={filters.from}
          to={filters.to}
          metric={metric}
          showThumbs={isMusic}
          isMusic={isMusic}
          unit={unit}
          onPick={(focus) => setFilters({ ...filters, focus })}
        />
      </div>

      <footer className="foot muted">
        Your listening data never leaves this browser tab. Times are shown in your current time zone.
        {isMusic && ' Artist pictures and album covers come from Deezer: only the names are sent to look them up. Genres were classified by Claude.'}
      </footer>
    </div>
  );
}
