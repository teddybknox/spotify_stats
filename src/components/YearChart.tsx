import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card';
import { TipBox } from './ChartTooltip';
import { byYear } from '../lib/stats';
import { fmtHours, fmtInt } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

interface Props {
  plays: Play[];
  onPickYear: (year: number) => void;
}

export default function YearChart({ plays, onPickYear }: Props) {
  const pal = usePalette();
  const data = useMemo(() => byYear(plays), [plays]);
  return (
    <Card title="Hours per year" subtitle="Click a year to zoom every chart into it.">
      <div className="chart" style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="year" stroke={pal.axis} tick={{ fontSize: 12, fill: pal.axis }} tickLine={false} />
            <YAxis
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => `${fmtInt(v)}h`}
            />
            <Tooltip
              cursor={{ fill: pal.grid, opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TipBox
                    title={String(p.year)}
                    rows={[
                      { label: 'Listened', value: fmtHours(p.hours), color: pal.series[0] },
                      { label: 'Plays', value: fmtInt(p.plays) },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="hours"
              fill={pal.series[0]}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d) => onPickYear((d.payload as { year: number }).year)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
