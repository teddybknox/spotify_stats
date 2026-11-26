import { useMemo, useState } from 'react';
import FilterBar from './FilterBar';
import StatTiles from './StatTiles';
import TopList from './TopList';
import DailyChart from './DailyChart';
import ArtistsOverTime from './ArtistsOverTime';
import Heatmap from './Heatmap';
import YearChart from './YearChart';
import DiscoveryChart from './DiscoveryChart';
import { applyFilters, summarize, type Filters } from '../lib/stats';
import { fmtDay } from '../lib/format';
import type { ParseResult } from '../lib/types';

interface Props {
  data: ParseResult;
  onReset: () => void;
}

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
    artist: null,
  });

  // Everything except the date range and artist: used where "all time" context matters.
  const kindPlays = useMemo(
    () => plays.filter((p) => p.kind === filters.kind && p.ms >= filters.minSeconds * 1000),
    [plays, filters.kind, filters.minSeconds],
  );
  const filtered = useMemo(() => applyFilters(plays, filters), [plays, filters]);
  const summary = useMemo(() => summarize(filtered, filters.from, filters.to), [filtered, filters.from, filters.to]);
  const isMusic = filters.kind === 'music';
  const pickArtist = (artist: string) => setFilters({ ...filters, artist: filters.artist === artist ? null : artist });
  const yearPlays = useMemo(
    () => (filters.artist ? kindPlays.filter((p) => p.artist === filters.artist) : kindPlays),
    [kindPlays, filters.artist],
  );

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
      />

      <StatTiles s={summary} kind={filters.kind} />

      <div className="grid">
        <DailyChart plays={filtered} from={filters.from} to={filters.to} />
        {!filters.artist && <ArtistsOverTime plays={filtered} from={filters.from} to={filters.to} />}
        {!filters.artist && (
          <TopList
            title={isMusic ? 'Top artists' : 'Top shows'}
            plays={filtered}
            by="artist"
            onPick={pickArtist}
            activeArtist={filters.artist}
          />
        )}
        <TopList title={isMusic ? 'Top tracks' : 'Top episodes'} plays={filtered} by="track" />
        {isMusic && <TopList title="Top albums" plays={filtered} by="album" />}
        <Heatmap plays={filtered} />
        <YearChart
          plays={yearPlays}
          onPickYear={(y) =>
            setFilters({
              ...filters,
              from: `${y}-01-01` < minDay ? minDay : `${y}-01-01`,
              to: `${y}-12-31` > maxDay ? maxDay : `${y}-12-31`,
            })
          }
        />
        {isMusic && !filters.artist && <DiscoveryChart allPlays={kindPlays} from={filters.from} to={filters.to} />}
      </div>

      <footer className="foot muted">
        Your data never leaves this browser tab. Times are shown in your current time zone.
      </footer>
    </div>
  );
}
