import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card';
import { TipBox } from './ChartTooltip';
import { artistDiscovery } from '../lib/stats';
import { fmtInt } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

interface Props {
  /** Plays across all time (so "first heard" is truly the first time). */
  allPlays: Play[];
  from: string;
  to: string;
}

export default function DiscoveryChart({ allPlays, from, to }: Props) {
  const pal = usePalette();
  const data = useMemo(() => artistDiscovery(allPlays, from, to), [allPlays, from, to]);
  return (
    <Card title="New artists each year" subtitle="Artists you played for the first time ever, next to ones you already knew.">
      <ul className="legend">
        <li>
          <span className="swatch" style={{ background: pal.series[0] }} />
          New to you
        </li>
        <li>
          <span className="swatch" style={{ background: pal.other }} />
          Already knew
        </li>
      </ul>
      <div className="chart" style={{ height: 232 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="year" stroke={pal.axis} tick={{ fontSize: 12, fill: pal.axis }} tickLine={false} />
            <YAxis stroke={pal.axis} tick={{ fontSize: 12, fill: pal.axis }} tickLine={false} axisLine={false} width={56} />
            <Tooltip
              cursor={{ fill: pal.grid, opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TipBox
                    title={String(p.year)}
                    rows={[
                      { label: 'New to you', value: fmtInt(p.newArtists), color: pal.series[0] },
                      { label: 'Already knew', value: fmtInt(p.returningArtists), color: pal.other },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="newArtists" stackId="a" fill={pal.series[0]} maxBarSize={48} isAnimationActive={false} stroke={pal.surface} strokeWidth={1} />
            <Bar
              dataKey="returningArtists"
              stackId="a"
              fill={pal.other}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
              stroke={pal.surface}
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
