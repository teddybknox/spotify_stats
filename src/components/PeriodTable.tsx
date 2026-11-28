import { useMemo } from 'react';
import Card from './Card';
import Thumb from './Thumb';
import { StorySwitch } from './Share';
import { fmtMeasure, fmtMonth } from '../lib/format';
import { topPerPeriod, type Focus, type Metric, type Ranked, type Unit } from '../lib/stats';
import type { Play } from '../lib/types';

interface Props {
  plays: Play[];
  from: string;
  to: string;
  metric: Metric;
  showThumbs: boolean;
  onPick: (focus: Focus) => void;
  isMusic: boolean;
  unit: Unit;
}

function Cell({
  r,
  kind,
  metric,
  showThumbs,
  onPick,
}: {
  r: Ranked | null;
  kind: 'artist' | 'album' | 'track';
  metric: Metric;
  showThumbs: boolean;
  onPick: (focus: Focus) => void;
}) {
  if (!r) return <td className="pt-empty">–</td>;
  return (
    <td>
      <button className="pt-item" onClick={() => onPick({ by: kind, key: r.key, label: r.label })} title={`Focus on ${r.label}`}>
        {showThumbs &&
          (kind === 'artist' ? (
            <Thumb kind="artist" artist={r.artist} label={r.label} />
          ) : r.album ? (
            <Thumb kind="album" artist={r.artist} album={r.album} label={r.album} />
          ) : null)}
        <span className="pt-text">
          <span className="pt-label">{r.label}</span>
          <span className="pt-sub">
            {r.sub && `${r.sub} · `}
            {fmtMeasure(r[metric], metric)}
          </span>
        </span>
      </button>
    </td>
  );
}

function Art({ r, kind }: { r: Ranked; kind: 'artist' | 'album' | 'track' }) {
  return kind === 'artist' ? (
    <Thumb kind="artist" artist={r.artist} label={r.label} />
  ) : (
    <Thumb kind="album" artist={r.artist} album={r.album} label={r.album || r.label} />
  );
}

/** Story card version: one block per period with full names, laid out to fill a phone-shaped card. */
function StoryPeriods({
  rows,
  label,
  metric,
  isMusic,
  showThumbs,
}: {
  rows: ReturnType<typeof topPerPeriod>;
  label: (p: string) => string;
  metric: Metric;
  isMusic: boolean;
  showThumbs: boolean;
}) {
  const shown = rows.filter((r) => r.artist);
  const kinds = (isMusic ? ['artist', 'album', 'track'] : ['artist', 'track']) as ('artist' | 'album' | 'track')[];
  const noun = { artist: isMusic ? 'Artist' : 'Show', album: 'Album', track: isMusic ? 'Song' : 'Episode' };
  if (!shown.length) return <p className="empty">Nothing in this range.</p>;

  // Many periods: one row each, with the top artist named and the album and song as covers.
  if (shown.length > 8) {
    return (
      <ol className="sp-rows">
        {shown.map((r) => (
          <li key={r.period}>
            <span className="sp-when">
              <strong>{label(r.period)}</strong>
              <span>{fmtMeasure(r[metric], metric)}</span>
            </span>
            {showThumbs && <Art r={r.artist!} kind="artist" />}
            <span className="sp-name">{r.artist!.label}</span>
            {showThumbs && kinds.slice(1).map((k) => (r[k] ? <Art key={k} r={r[k]!} kind={k} /> : <span key={k} className="thumb" />))}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className={`sp-grid${shown.length <= 3 ? ' one' : shown.length > 4 ? ' tight' : ''}`}>
      {shown.map((r) => (
        <section key={r.period} className="sp-block">
          <header>
            <strong>{label(r.period)}</strong>
            <span>{fmtMeasure(r[metric], metric)}</span>
          </header>
          <ul>
            {kinds.map((k) => {
              const it = r[k];
              if (!it) return null;
              return (
                <li key={k}>
                  {showThumbs && <Art r={it} kind={k} />}
                  <span className="sp-text">
                    <span className="sp-label">{it.label}</span>
                    <span className="sp-kind">
                      {noun[k]}
                      {k !== 'artist' && it.sub && ` · ${it.sub}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function PeriodTable({ plays, from, to, metric, showThumbs, onPick, isMusic, unit }: Props) {
  const rows = useMemo(() => topPerPeriod(plays, from, to, unit, metric), [plays, from, to, unit, metric]);
  const label = (period: string) => (unit === 'month' ? fmtMonth(period) : period);

  return (
    <Card
      wide
      title={`Top of each ${unit}`}
      subtitle={`Your top ${isMusic ? 'artist, album and track' : 'show and episode'} for every ${unit} in the selected range, by ${
        metric === 'plays' ? 'plays' : 'time'
      }. Click one to focus on it.`}
    >
      <StorySwitch story={<StoryPeriods rows={rows} label={label} metric={metric} isMusic={isMusic} showThumbs={showThumbs} />}>
      <div className="pt-wrap">
        <table className="pt">
          <thead>
            <tr>
              <th>{unit === 'month' ? 'Month' : 'Year'}</th>
              <th>{isMusic ? 'Top artist' : 'Top show'}</th>
              {isMusic && <th>Top album</th>}
              <th>{isMusic ? 'Top track' : 'Top episode'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <th scope="row">
                  {label(r.period)}
                  <span className="pt-sub">{fmtMeasure(r[metric], metric)}</span>
                </th>
                <Cell r={r.artist} kind="artist" metric={metric} showThumbs={showThumbs} onPick={onPick} />
                {isMusic && <Cell r={r.album} kind="album" metric={metric} showThumbs={showThumbs} onPick={onPick} />}
                <Cell r={r.track} kind="track" metric={metric} showThumbs={showThumbs} onPick={onPick} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </StorySwitch>
    </Card>
  );
}
