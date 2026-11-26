import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { Segmented } from './Card';
import { TipBox } from './ChartTooltip';
import { artistsOverTime } from '../lib/stats';
import { fmtHours, fmtMonth, fmtMonthShort } from '../lib/format';
import { usePalette } from '../lib/theme';
import type { Play } from '../lib/types';

type Mode = 'hours' | 'share';

export default function ArtistsOverTime({ plays, from, to }: { plays: Play[]; from: string; to: string }) {
  const pal = usePalette();
  const [n, setN] = useState(5);
  const [mode, setMode] = useState<Mode>('hours');
  const { series, rows } = useMemo(() => artistsOverTime(plays, from, to, n), [plays, from, to, n]);

  const data = useMemo(() => {
    if (mode === 'hours') return rows;
    return rows.map((r) => {
      const total = series.reduce((s, k) => s + (r[k] as number), 0);
      const out: Record<string, number | string> = { month: r.month };
      for (const k of series) out[k] = total ? ((r[k] as number) / total) * 100 : 0;
      return out;
    });
  }, [rows, series, mode]);

  const color = (k: string, i: number) => (k === 'Other' ? pal.other : pal.series[i]);

  return (
    <Card
      wide
      title="Top artists over time"
      subtitle="Monthly listening for your top artists in this range. Everyone else is grouped as Other."
      controls={
        <>
          <Segmented
            label="Show as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'hours', label: 'Hours' },
              { value: 'share', label: 'Share' },
            ]}
          />
          <Segmented
            label="Artists"
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
        {series.map((k, i) => (
          <li key={k}>
            <span className="swatch" style={{ background: color(k, i) }} />
            {k}
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
              tickFormatter={(v: number) => (mode === 'share' ? `${v}%` : `${v}h`)}
            />
            <Tooltip
              cursor={{ stroke: pal.axis, strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const r = rows.find((x) => x.month === label);
                if (!r) return null;
                const total = series.reduce((s, k) => s + (r[k] as number), 0);
                return (
                  <TipBox
                    title={fmtMonth(String(label))}
                    rows={[...series]
                      .map((k, i) => ({ k, i }))
                      .reverse()
                      .map(({ k, i }) => ({
                        label: k,
                        color: color(k, i),
                        value:
                          mode === 'share'
                            ? `${total ? Math.round(((r[k] as number) / total) * 100) : 0}%`
                            : fmtHours(r[k] as number),
                      }))}
                    foot={`Total ${fmtHours(total)}`}
                  />
                );
              }}
            />
            {series.map((k, i) => (
              <Area
                key={k}
                type="linear"
                dataKey={k}
                stackId="1"
                stroke={pal.surface}
                strokeWidth={1}
                fill={color(k, i)}
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
