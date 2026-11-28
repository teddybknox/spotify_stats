import { useCallback, useEffect, useMemo, useState } from 'react';
import FilterBar, { DIM_LABELS } from './FilterBar';
import SearchBox from './SearchBox';
import StatTiles from './StatTiles';
import TopList from './TopList';
import DailyChart from './DailyChart';
import TopOverTime from './TopOverTime';
import Heatmap from './Heatmap';
import DiscoveryChart from './DiscoveryChart';
import PeriodTable from './PeriodTable';
import GenreTree from './GenreTree';
import SummaryCard from './SummaryCard';
import { ShareContext, type ShareInfo } from './Share';
import { albumKey, applyFilters, buildSearchIndex, isGenreDim, itemKey, summarize, topBy, type Dim, type Filters, type GenreMap, type Metric, type Unit } from '../lib/stats';
import { loadGenres } from '../lib/deezer';
import { loadReleaseYears, type YearMap } from '../lib/releases';
import { fmtDay } from '../lib/format';
import type { ParseResult } from '../lib/types';

interface Props {
  data: ParseResult;
  onReset: () => void;
}

/** How many of your most-played artists missing from the shared genre file get a live lookup. */
const LIVE_GENRE_LOOKUPS = 300;
/** Same for albums missing from the shared release-year file (MusicBrainz allows one lookup a second). */
const LIVE_RELEASE_LOOKUPS = 120;

export default function Dashboard({ data, onReset }: Props) {
  const rawPlays = data.plays;
  const [dim, setDim] = useState<Dim>('artist');
  const [focusBy, setFocusBy] = useState<Dim | null>(null);
  const [searching, setSearching] = useState(false);
  const [treeSeen, setTreeSeen] = useState(false);
  const onTreeVisible = useCallback(() => setTreeSeen(true), []);
  const [summarySeen, setSummarySeen] = useState(false);

  // Release years are looked up only once someone asks for decades; each play then carries its album's year.
  const wantDecades = dim === 'decade' || focusBy === 'decade' || searching;
  const decadeAlbums = useMemo(() => {
    if (!wantDecades) return [];
    const ms = new Map<string, [string, string, number]>();
    for (const p of rawPlays) {
      if (p.kind !== 'music' || !p.album) continue;
      const k = albumKey(p.artist, p.album);
      const e = ms.get(k);
      if (e) e[2] += p.ms;
      else ms.set(k, [p.artist, p.album, p.ms]);
    }
    return [...ms.values()].sort((a, b) => b[2] - a[2]).map(([a, b]) => [a, b] as [string, string]);
  }, [wantDecades, rawPlays]);
  const [releaseYears, setReleaseYears] = useState<YearMap>(() => new Map());
  const [releaseProgress, setReleaseProgress] = useState({ done: 0, total: -1 });
  useEffect(() => {
    if (!decadeAlbums.length) return;
    return loadReleaseYears(decadeAlbums, LIVE_RELEASE_LOOKUPS, (y, done, total) => {
      setReleaseYears(y);
      setReleaseProgress({ done, total });
    });
  }, [decadeAlbums]);
  const plays = useMemo(
    () =>
      releaseYears.size
        ? rawPlays.map((p) => {
            const y = p.album ? releaseYears.get(albumKey(p.artist, p.album)) : undefined;
            return y ? { ...p, released: y } : p;
          })
        : rawPlays,
    [rawPlays, releaseYears],
  );

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
  useEffect(() => setFocusBy(filters.focus?.by ?? null), [filters.focus]);
  const [unit, setUnit] = useState<Unit>('month');

  // Everything except the date range and focus: used where "all time" context matters.
  const kindPlays = useMemo(
    () => plays.filter((p) => p.kind === filters.kind && p.ms >= filters.minSeconds * 1000),
    [plays, filters.kind, filters.minSeconds],
  );

  // Genres are looked up only once someone asks for them.
  const wantGenres =
    filters.kind === 'music' && (isGenreDim(dim) || (filters.focus !== null && isGenreDim(filters.focus.by)) || searching || treeSeen || summarySeen);
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

  const decadeNote = useMemo(() => {
    if (dim !== 'decade') return undefined;
    const withAlbum = rankPlays.reduce((n, p) => n + (p.album ? 1 : 0), 0);
    if (!withAlbum) return "This export doesn't include album names, so release years can't be looked up.";
    const known = rankPlays.reduce((n, p) => n + (p.released ? 1 : 0), 0);
    const pct = rankPlays.length ? Math.round((known / rankPlays.length) * 100) : 0;
    const { done, total } = releaseProgress;
    if (total < 0) return 'Loading release years…';
    return done < total
      ? `Looking up release years… ${done} of ${total} albums. Covers ${pct}% of plays so far.`
      : `Decade the album first came out, from MusicBrainz. Known for ${pct}% of plays in this range; the rest are left out. Compilations count by their own release year.`;
  }, [dim, rankPlays, releaseProgress]);
  const treeNote = useMemo(() => {
    const { done, total } = genreProgress;
    if (total < 0) return 'Loading genres…';
    if (done < total) return `Looking up genres… ${done} of ${total} artists.`;
    return undefined;
  }, [genreProgress]);
  const dimNote = isGenreDim(viewDim) ? genreNote : decadeNote;

  const isMusic = filters.kind === 'music';

  // What the story cards say about the current view.
  const range = useMemo(() => {
    const { from, to } = filters;
    if (from === minDay && to === maxDay) return 'All time';
    const y = from.slice(0, 4);
    if (to.slice(0, 4) === y && (from === `${y}-01-01` || from === minDay) && (to === `${y}-12-31` || to === maxDay)) return y;
    const short = (d: string) => fmtDay(d).replace(/^(\w{3})\w* /, '$1 ');
    return `${short(from)} – ${short(to)}`;
  }, [filters, minDay, maxDay]);
  const share = useMemo<ShareInfo>(
    () => ({
      range,
      detail: [
        metric === 'plays' ? 'By plays' : 'By time listened',
        filters.kind === 'podcast' ? 'Podcasts' : null,
        filters.focus ? `Only ${filters.focus.label}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
    [range, metric, filters.kind, filters.focus],
  );
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
        <div className="topbar-actions">
          <ShareContext.Provider value={share}>
            <SummaryCard
              plays={filtered}
              genres={genres}
              metric={metric}
              kind={filters.kind}
              range={range}
              onOpen={() => setSummarySeen(true)}
            />
          </ShareContext.Provider>
          <button className="ghost" onClick={onReset}>
            Load another file
          </button>
        </div>
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

      <ShareContext.Provider value={share}>
      <div className="grid">
        <TopOverTime
          plays={filtered}
          from={filters.from}
          to={filters.to}
          metric={metric}
          by={viewDim}
          noun={nounIn}
          genres={genres}
          note={dimNote}
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
          note={dimNote}
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
        {isMusic && (
          <GenreTree plays={filtered} genres={genres} metric={metric} note={treeNote} onVisible={onTreeVisible} />
        )}
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
      </ShareContext.Provider>

      <footer className="foot muted">
        Your listening data never leaves this browser tab. Times are shown in your current time zone.
        {isMusic && ' Artist pictures and album covers come from Deezer, and release years from MusicBrainz (else Deezer): only the names are sent to look them up. Genres were classified by Claude.'}
      </footer>
    </div>
  );
}
