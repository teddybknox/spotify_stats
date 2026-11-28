import { useEffect, useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox, TipCloseProvider, useTapTip } from './ChartTooltip';
import { topOverTime, type Dim, type GenreMap, type Metric, type Series, type Unit } from '../lib/stats';
import { fmtAxis, fmtMeasure, fmtPeriod, fmtPeriodShort } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

type Mode = 'lines' | 'total' | 'share';

/** Genres and decades read best as separate lines; artists, tracks and albums as a stack. */
const defaultMode = (by: Dim): Mode => (by === 'genre' || by === 'subgenre' || by === 'decade' ? 'lines' : 'total');

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
  const tip = useTapTip();
  const [n, setN] = useState(5);
  const [mode, setMode] = useState<Mode>(() => defaultMode(by));
  // Switching what's ranked goes back to that ranking's default view.
  useEffect(() => setMode(defaultMode(by)), [by]);
  const lines = mode === 'lines';
  const { series, rows } = useMemo(() => topOverTime(plays, from, to, n, metric, by, genres, unit), [plays, from, to, n, metric, by, genres, unit]);

  const data = useMemo(() => {
    if (mode !== 'share') return rows;
    return rows.map((r) => {
      const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
      const out: Record<string, number | string> = { period: r.period };
      for (const x of series) out[x.key] = total ? ((r[x.key] as number) / total) * 100 : 0;
      return out;
    });
  }, [rows, series, mode]);

  const color = (x: Series, i: number) => (x.key === 'Other' ? pal.other : pal.series[i]);
  // Line view leaves out "Other", which would dwarf everything else.
  const shown = useMemo(() => series.map((x, i) => ({ x, i })).filter(({ x }) => !lines || x.key !== 'Other'), [series, lines]);

  return (
    <Card
      wide
      title={`Top ${noun} over time`}
      subtitle={note ?? `${unit === 'month' ? 'Monthly' : 'Yearly'} ${metric === 'plays' ? 'plays' : 'hours'} for your top ${noun} in this range. ${lines ? '' : 'Everything else is grouped as Other.'}`}
      controls={
        <>
          <Segmented
            label="Show as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'lines', label: 'Lines' },
              { value: 'total', label: 'Stacked' },
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
        {shown.map(({ x, i }) => (
          <li key={x.key} title={x.sub ? `${x.label} by ${x.sub}` : x.label}>
            <span className="swatch" style={{ background: color(x, i) }} />
            {x.label}
          </li>
        ))}
      </ul>
      <div className="chart" style={{ height: 300 }}>
        <TipCloseProvider value={tip.close}>
        <ResponsiveContainer>
          <ComposedChart {...tip.chartProps} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              {...tip.tooltipProps}
              cursor={unit === 'month' || lines ? { stroke: pal.axis, strokeDasharray: '3 3' } : { fill: pal.grid, opacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const r = rows.find((x) => x.period === label);
                if (!r) return null;
                const total = series.reduce((s, x) => s + (r[x.key] as number), 0);
                return (
                  <TipBox
                    title={fmtPeriod(String(label))}
                    rows={(lines ? [...shown].sort((a, b) => (r[b.x.key] as number) - (r[a.x.key] as number)) : [...shown].reverse())
                      .map(({ x, i }) => ({
                        label: x.label,
                        color: color(x, i),
                        value:
                          mode === 'share'
                            ? `${total ? Math.round(((r[x.key] as number) / total) * 100) : 0}%`
                            : fmtMeasure(r[x.key] as number, metric),
                      }))}
                    foot={lines ? undefined : `Total ${fmtMeasure(total, metric)}`}
                  />
                );
              }}
            />
            {shown.map(({ x, i }) =>
              lines ? (
                <Line
                  key={x.key}
                  type="monotone"
                  dataKey={x.key}
                  name={x.label}
                  stroke={color(x, i)}
                  strokeWidth={2}
                  dot={unit === 'year' ? { r: 3, fill: color(x, i), strokeWidth: 0 } : false}
                  activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ) : unit === 'month' ? (
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
        </TipCloseProvider>
      </div>
    </Card>
  );
}
