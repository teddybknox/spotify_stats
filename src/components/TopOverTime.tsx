import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox } from './ChartTooltip';
import { topOverTime, type Dim, type GenreMap, type Metric, type Series } from '../lib/stats';
import { fmtAxis, fmtMeasure, fmtMonth, fmtMonthShort } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

type Mode = 'total' | 'share';

interface Props {
  plays: Play[];
  from: string;
  to: string;
  metric: Metric;
  by: Dim;
  /** Plural name shown in titles, e.g. "artists". */
  noun: string;
  genres?: GenreMap;
  note?: string;
}

export default function TopOverTime({ plays, from, to, metric, by, noun, genres, note }: Props) {
  const pal = usePalette();
  const [n, setN] = useState(5);
  const [mode, setMode] = useState<Mode>('total');
  const { series, rows } = useMemo(() => topOverTime(plays, from, to, n, metric, by, genres), [plays, from, to, n, metric, by, genres]);

  const data = useMemo(() => {
    if (mode === 'total') return rows;
    return rows.map((r) => {
      const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
      const out: Record<string, number | string> = { month: r.month };
      for (const x of series) out[x.key] = total ? ((r[x.key] as number) / total) * 100 : 0;
      return out;
    });
  }, [rows, series, mode]);

  const color = (x: Series, i: number) => (x.key === 'Other' ? pal.other : pal.series[i]);

  return (
    <Card
      wide
      title={`Top ${noun} over time`}
      subtitle={note ?? `Monthly ${metric === 'plays' ? 'plays' : 'hours'} for your top ${noun} in this range. Everything else is grouped as Other.`}
      controls={
        <>
          <Segmented
            label="Show as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'total', label: metric === 'plays' ? 'Plays' : 'Hours' },
              { value: 'share', label: 'Share' },
            ]}
          />
          <Segmented
            label={`Number of ${noun}`}
            value={n}
            onChange={setN}
            options={[
              { value: 3, label: 'Top 3' },
              { value: 5, label: 'Top 5' },
              { value: 8, label: 'Top 8' },
            ]}
          />
        </>
      }
    >
      <ul className="legend">
        {series.map((x, i) => (
          <li key={x.key} title={x.sub ? `${x.label} by ${x.sub}` : x.label}>
            <span className="swatch" style={{ background: color(x, i) }} />
            {x.label}
          </li>
        ))}
      </ul>
      <div className="chart" style={{ height: 300 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="month"
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              minTickGap={30}
              tickFormatter={fmtMonthShort}
            />
            <YAxis
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={mode === 'share' ? [0, 100] : [0, 'auto']}
              tickFormatter={(v: number) => (mode === 'share' ? `${v}%` : fmtAxis(v, metric))}
            />
            <Tooltip
              cursor={{ stroke: pal.axis, strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const r = rows.find((x) => x.month === label);
                if (!r) return null;
                const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
                return (
                  <TipBox
                    title={fmtMonth(String(label))}
                    rows={series
                      .map((x, i) => ({ x, i }))
                      .reverse()
                      .map(({ x, i }) => ({
                        label: x.label,
                        color: color(x, i),
                        value:
                          mode === 'share'
                            ? `${total ? Math.round(((r[x.key] as number) / total) * 100) : 0}%`
                            : fmtMeasure(r[x.key] as number, metric),
                      }))}
                    foot={`Total ${fmtMeasure(total, metric)}`}
                  />
                );
              }}
            />
            {series.map((x, i) => (
              <Area
                key={x.key}
                type="linear"
                dataKey={x.key}
                name={x.label}
                stackId="1"
                stroke={pal.surface}
                strokeWidth={1}
                fill={color(x, i)}
                fillOpacity={1}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
