import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox } from './ChartTooltip';
import { dailyTotals, type Metric } from '../lib/stats';
import { fmtAxis, fmtDay, fmtMeasure, fmtMonthShort, niceStep } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

interface Props {
  plays: Play[];
  from: string;
  to: string;
  metric: Metric;
}

export default function DailyChart({ plays, from, to, metric }: Props) {
  const [window, setWindow] = useState(7);
  const pal = usePalette();
  const data = useMemo(() => dailyTotals(plays, from, to, window, metric), [plays, from, to, window, metric]);
  const long = data.length > 400;
  const ticks = useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.avg));
    const step = metric === 'plays' ? Math.max(1, niceStep(max)) : niceStep(max);
    const out: number[] = [0];
    while (out[out.length - 1] < max - 1e-9) out.push(+(out[out.length - 1] + step).toFixed(6));
    if (out.length === 1) out.push(step);
    return out;
  }, [data, metric]);

  return (
    <Card
      wide
      title={metric === 'plays' ? 'Plays per day' : 'Hours listened per day'}
      subtitle={window > 1 ? `${window}-day moving average` : 'Each day on its own'}
      controls={
        <Segmented
          label="Smoothing"
          value={window}
          onChange={setWindow}
          options={[
            { value: 1, label: 'Daily' },
            { value: 7, label: '7 days' },
            { value: 30, label: '30 days' },
            { value: 90, label: '90 days' },
          ]}
        />
      }
    >
      <div className="chart" style={{ height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="day"
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(d: string) => (long ? fmtMonthShort(d.slice(0, 7)) : fmtDay(d).replace(/, \d{4}$/, ''))}
            />
            <YAxis
              stroke={pal.axis}
              tick={{ fontSize: 12, fill: pal.axis }}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={[0, ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={(v: number) => fmtAxis(v, metric)}
            />
            <Tooltip
              cursor={{ stroke: pal.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                const avg = metric === 'plays' ? `${p.avg.toFixed(1)} plays` : fmtMeasure(p.avg, metric);
                return (
                  <TipBox
                    title={fmtDay(p.day)}
                    rows={[
                      ...(window > 1 ? [{ label: `${window}-day average`, value: avg, color: pal.series[0] }] : []),
                      { label: 'That day', value: fmtMeasure(p.value, metric) },
                    ]}
                  />
                );
              }}
            />
            <Line
              type="monotoneX"
              dataKey="avg"
              stroke={pal.series[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
