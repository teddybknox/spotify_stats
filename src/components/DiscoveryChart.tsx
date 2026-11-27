import { useMemo } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card';
import { TipBox } from './ChartTooltip';
import { discovery, type Dim, type GenreMap, type Unit } from '../lib/stats';
import { fmtInt, fmtPeriod, fmtPeriodShort } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

interface Props {
  /** Plays across all time (so "first heard" is truly the first time). */
  allPlays: Play[];
  from: string;
  to: string;
  by: Dim;
  /** Plural name, e.g. "artists". */
  noun: string;
  genres?: GenreMap;
  unit: Unit;
}

export default function DiscoveryChart({ allPlays, from, to, by, noun, genres, unit }: Props) {
  const pal = usePalette();
  const data = useMemo(() => discovery(allPlays, from, to, by, genres, unit), [allPlays, from, to, by, genres, unit]);
  const layers = [
    { key: 'fresh', label: 'New to you', color: pal.series[0] },
    { key: 'returning', label: 'Already knew', color: pal.other },
  ] as const;
  return (
    <Card
      wide
      title={`New ${noun} each ${unit}`}
      subtitle={`${noun[0].toUpperCase() + noun.slice(1)} you played for the first time ever, next to ones you already knew.`}
    >
      <ul className="legend">
        {layers.map((l) => (
          <li key={l.key}>
            <span className="swatch" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ul>
      <div className="chart" style={{ height: 232 }}>
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
            <YAxis stroke={pal.axis} tick={{ fontSize: 12, fill: pal.axis }} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
            <Tooltip
              cursor={unit === 'month' ? { stroke: pal.axis, strokeDasharray: '3 3' } : { fill: pal.grid, opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TipBox
                    title={fmtPeriod(p.period)}
                    rows={layers.map((l) => ({ label: l.label, value: fmtInt(p[l.key]), color: l.color }))}
                  />
                );
              }}
            />
            {layers.map((l, i) =>
              unit === 'month' ? (
                <Area
                  key={l.key}
                  type="linear"
                  dataKey={l.key}
                  stackId="a"
                  fill={l.color}
                  fillOpacity={1}
                  stroke={pal.surface}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              ) : (
                <Bar
                  key={l.key}
                  dataKey={l.key}
                  stackId="a"
                  fill={l.color}
                  radius={i === layers.length - 1 ? [4, 4, 0, 0] : undefined}
                  maxBarSize={48}
                  isAnimationActive={false}
                  stroke={pal.surface}
                  strokeWidth={1}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
