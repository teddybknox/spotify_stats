import { useMemo, useState } from 'react';
import Card from './Card';
import { weekHourGrid, type Metric } from '../lib/stats';
import { fmtMeasure } from '../lib/format';
import { rampColor, usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourLabel = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);

export default function Heatmap({ plays, metric }: { plays: Play[]; metric: Metric }) {
  const pal = usePalette();
  const grid = useMemo(() => weekHourGrid(plays, metric), [plays, metric]);
  const max = Math.max(0.0001, ...grid.flat());
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);

  const peak = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 };
    grid.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })));
    return best;
  }, [grid]);

  const readout = hover
    ? `${DAYS[hover.d]}s, ${hourLabel(hover.h)}–${hourLabel((hover.h + 1) % 24)}: ${fmtMeasure(grid[hover.d][hover.h], metric)}`
    : peak.v > 0
      ? `Busiest: ${DAYS[peak.d]}s around ${hourLabel(peak.h)}`
      : 'No listening in this range';

  return (
    <Card title="When you listen" subtitle={`Total ${metric === 'plays' ? 'plays' : 'hours'} by weekday and hour, in your current time zone.`}>
      <div className="heatmap" onMouseLeave={() => setHover(null)}>
        <div className="hm-corner" />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="hm-hour">
            {h % 3 === 0 ? hourLabel(h) : ''}
          </div>
        ))}
        {grid.map((row, d) => (
          <div key={d} className="hm-row">
            <div className="hm-day">{DAYS[d].slice(0, 3)}</div>
            {row.map((v, h) => (
              <div
                key={h}
                className={`hm-cell${hover && hover.d === d && hover.h === h ? ' hot' : ''}`}
                style={{ background: v > 0 ? rampColor(pal, v / max) : undefined }}
                onMouseEnter={() => setHover({ d, h })}
                onClick={() => setHover({ d, h })}
                title={`${DAYS[d]} ${hourLabel(h)}: ${fmtMeasure(v, metric)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="hm-foot">
        <span className="hm-readout">{readout}</span>
        <span className="hm-scale" aria-hidden>
          less
          {pal.ramp.slice(1).map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          more
        </span>
      </div>
    </Card>
  );
}
