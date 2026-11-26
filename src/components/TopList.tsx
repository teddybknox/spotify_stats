import { useMemo, useState } from 'react';
import Card, { Segmented } from './Card';
import { fmtHours, fmtInt } from '../lib/format';
import { topBy, type Grouping, type Metric } from '../lib/stats';
import type { Play } from '../lib/types';

interface Props {
  title: string;
  plays: Play[];
  by: Grouping;
  /** When set, rows are clickable and pick an artist filter. */
  onPick?: (artist: string) => void;
  activeArtist?: string | null;
}

export default function TopList({ title, plays, by, onPick, activeArtist }: Props) {
  const [metric, setMetric] = useState<Metric>('plays');
  const [n, setN] = useState(10);
  const rows = useMemo(() => topBy(plays, by, metric, n), [plays, by, metric, n]);
  const max = rows.length ? rows[0][metric] : 1;

  return (
    <Card
      title={title}
      subtitle={onPick ? 'Click an artist to focus every chart on them.' : undefined}
      controls={
        <>
          <Segmented
            label="Rank by"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'plays', label: 'Plays' },
              { value: 'hours', label: 'Time' },
            ]}
          />
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
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="empty">Nothing in this range.</p>
      ) : (
        <ol className="toplist">
          {rows.map((r, i) => {
            const main = metric === 'plays' ? `${fmtInt(r.plays)} plays` : fmtHours(r.hours);
            const other = metric === 'plays' ? fmtHours(r.hours) : `${fmtInt(r.plays)} plays`;
            const clickable = Boolean(onPick);
            const content = (
              <>
                <span className="rank">{i + 1}</span>
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
              </>
            );
            return (
              <li key={r.key}>
                {clickable ? (
                  <button
                    className={`row${activeArtist === r.label ? ' active' : ''}`}
                    onClick={() => onPick!(r.label)}
                    title={`Focus on ${r.label}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="row">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
