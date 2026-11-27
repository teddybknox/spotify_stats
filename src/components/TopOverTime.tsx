import { useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox } from './ChartTooltip';
import { topOverTime, type Dim, type GenreMap, type Metric, type Series, type Unit } from '../lib/stats';
import { fmtAxis, fmtMeasure, fmtPeriod, fmtPeriodShort } from '../lib/format';
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
  unit: Unit;
}

export default function TopOverTime({ plays, from, to, metric, by, noun, genres, note, unit }: Props) {
  const pal = usePalette();
  const [n, setN] = useState(5);
  const [mode, setMode] = useState<Mode>('total');
  const { series, rows } = useMemo(() => topOverTime(plays, from, to, n, metric, by, genres, unit), [plays, from, to, n, metric, by, genres, unit]);

  const data = useMemo(() => {
    if (mode === 'total') return rows;
    return rows.map((r) => {
      const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
      const out: Record<string, number | string> = { period: r.period };
      for (const x of series) out[x.key] = total ? ((r[x.key] as number) / total) * 100 : 0;
      return out;
    });
  }, [rows, series, mode]);

  const color = (x: Series, i: number) => (x.key === 'Other' ? pal.other : pal.series[i]);

  return (
    <Card
      wide
      title={`Top ${noun} over time`}
      subtitle={note ?? `${unit === 'month' ? 'Monthly' : 'Yearly'} ${metric === 'plays' ? 'plays' : 'hours'} for your top ${noun} in this range. Everything else is grouped as Other.`}
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
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="period"
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              minTickGap={unit === 'month' ? 30 : 4}
              tickFormatter={fmtPeriodShort}
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
              cursor={unit === 'month' ? { stroke: pal.axis, strokeDasharray: '3 3' } : { fill: pal.grid, opacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const r = rows.find((x) => x.period === label);
                if (!r) return null;
                const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
                return (
                  <TipBox
                    title={fmtPeriod(String(label))}
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
            {series.map((x, i) =>
              unit === 'month' ? (
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
              ) : (
                <Bar
                  key={x.key}
                  dataKey={x.key}
                  name={x.label}
                  stackId="1"
                  fill={color(x, i)}
                  stroke={pal.surface}
                  strokeWidth={1}
                  maxBarSize={56}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
