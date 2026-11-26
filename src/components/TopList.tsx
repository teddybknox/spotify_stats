import { useMemo, useState } from 'react';
import Card, { Segmented } from './Card';
import Thumb from './Thumb';
import { fmtHours, fmtInt } from '../lib/format';
import { topBy, type Dim, type Focus, type GenreMap, type Metric, type Ranked } from '../lib/stats';
import type { Play } from '../lib/types';

interface Props {
  title: string;
  plays: Play[];
  by: Dim;
  metric: Metric;
  genres?: GenreMap;
  /** Clicking a row focuses every chart on it; clicking it again clears the focus. */
  onPick: (focus: Focus | null) => void;
  focus: Focus | null;
  showThumbs: boolean;
  note?: string;
}

function RowThumb({ by, r }: { by: Dim; r: Ranked }) {
  if (by === 'artist') return <Thumb kind="artist" artist={r.artist} label={r.label} />;
  if (by === 'genre' || !r.album) return null;
  return <Thumb kind="album" artist={r.artist} album={r.album} label={r.album} />;
}

export default function TopList({ title, plays, by, metric, genres, onPick, focus, showThumbs, note }: Props) {
  const [n, setN] = useState(10);
  const rows = useMemo(() => topBy(plays, by, metric, n, genres), [plays, by, metric, n, genres]);
  const max = rows.length ? rows[0][metric] : 1;
  const thumbs = showThumbs && by !== 'genre';

  return (
    <Card
      title={title}
      subtitle={note ?? 'Click a row to focus every chart on it.'}
      controls={
        <Segmented
          label="How many"
          value={n}
          onChange={setN}
          options={[
            { value: 10, label: '10' },
            { value: 25, label: '25' },
            { value: 50, label: '50' },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="empty">Nothing in this range.</p>
      ) : (
        <ol className="toplist">
          {rows.map((r, i) => {
            const main = metric === 'plays' ? `${fmtInt(r.plays)} plays` : fmtHours(r.hours);
            const other = metric === 'plays' ? fmtHours(r.hours) : `${fmtInt(r.plays)} plays`;
            const active = focus?.by === by && focus.key === r.key;
            return (
              <li key={r.key}>
                <button
                  className={`row${thumbs ? ' with-thumb' : ''}${active ? ' active' : ''}`}
                  onClick={() => onPick(active ? null : { by, key: r.key, label: r.label })}
                  title={active ? 'Show everything again' : `Focus on ${r.label}`}
                  aria-pressed={active}
                >
                  <span className="rank">{i + 1}</span>
                  {thumbs && <RowThumb by={by} r={r} />}
                  <span className="name">
                    <span className="label" title={r.label}>
                      {r.label}
                    </span>
                    {r.sub && <span className="sub">{r.sub}</span>}
                    <span className="bar-track" aria-hidden>
                      <span className="bar" style={{ width: `${Math.max(1, (r[metric] / max) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="value">
                    {main}
                    <span className="sub">{other}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
