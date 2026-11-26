import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card';
import { TipBox } from './ChartTooltip';
import { byYear, type Metric } from '../lib/stats';
import { fmtAxis, fmtHours, fmtInt } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

interface Props {
  plays: Play[];
  onPickYear: (year: number) => void;
  metric: Metric;
}

export default function YearChart({ plays, onPickYear, metric }: Props) {
  const pal = usePalette();
  const data = useMemo(() => byYear(plays), [plays]);
  return (
    <Card title={metric === 'plays' ? 'Plays per year' : 'Hours per year'} subtitle="Click a year to zoom every chart into it.">
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
              tickFormatter={(v: number) => fmtAxis(v, metric)}
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
                      { label: 'Plays', value: fmtInt(p.plays), color: metric === 'plays' ? pal.series[0] : undefined },
                      { label: 'Listened', value: fmtHours(p.hours), color: metric === 'hours' ? pal.series[0] : undefined },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey={metric}
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
