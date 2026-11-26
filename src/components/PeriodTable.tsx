import { useMemo, useState } from 'react';
import Card, { Segmented } from './Card';
import Thumb from './Thumb';
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

export default function PeriodTable({ plays, from, to, metric, showThumbs, onPick, isMusic }: Props) {
  const [unit, setUnit] = useState<Unit>('year');
  const rows = useMemo(() => topPerPeriod(plays, from, to, unit, metric), [plays, from, to, unit, metric]);
  const label = (period: string) => (unit === 'month' ? fmtMonth(period) : period);

  return (
    <Card
      wide
      title={`Top of each ${unit}`}
      subtitle={`Your top ${isMusic ? 'artist, album and track' : 'show and episode'} for every ${unit} in the selected range, by ${
        metric === 'plays' ? 'plays' : 'time'
      }. Click one to focus on it.`}
      controls={
        <Segmented
          label="Period"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'year', label: 'Years' },
            { value: 'month', label: 'Months' },
          ]}
        />
      }
    >
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
    </Card>
  );
}
