import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox } from './ChartTooltip';
import { dailyHours } from '../lib/stats';
import { fmtDay, fmtHours, fmtMonthShort } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

export default function DailyChart({ plays, from, to }: { plays: Play[]; from: string; to: string }) {
  const [window, setWindow] = useState(7);
  const pal = usePalette();
  const data = useMemo(() => dailyHours(plays, from, to, window), [plays, from, to, window]);
  const long = data.length > 400;
  const yMax = useMemo(() => {
    const m = Math.max(0, ...data.map((d) => d.avg));
    const step = m > 8 ? 5 : m > 4 ? 2 : m > 2 ? 1 : 0.5;
    return Math.max(step, Math.ceil(m / step) * step);
  }, [data]);
  const ticks = useMemo(() => {
    const step = yMax > 20 ? 10 : yMax > 8 ? 5 : yMax > 4 ? 2 : yMax > 2 ? 1 : 0.5;
    const out: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) out.push(v);
    return out;
  }, [yMax]);

  return (
    <Card
      wide
      title="Hours listened per day"
      subtitle={`${window}-day moving average`}
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
              domain={[0, yMax]}
              ticks={ticks}
              tickFormatter={(v: number) => `${v}h`}
            />
            <Tooltip
              cursor={{ stroke: pal.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TipBox
                    title={fmtDay(p.day)}
                    rows={[
                      ...(window > 1 ? [{ label: `${window}-day average`, value: fmtHours(p.avg), color: pal.series[0] }] : []),
                      { label: 'That day', value: fmtHours(p.hours) },
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
