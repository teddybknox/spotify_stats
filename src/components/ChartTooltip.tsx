import type { ReactNode } from 'react';

export interface TipRow {
  color?: string;
  label: string;
  value: string;
}

export function TipBox({ title, rows, foot }: { title: string; rows: TipRow[]; foot?: ReactNode }) {
  return (
    <div className="tip">
      <div className="tip-title">{title}</div>
      {rows.map((r) => (
        <div className="tip-row" key={r.label}>
          {r.color && <span className="swatch" style={{ background: r.color }} />}
          <span className="tip-label">{r.label}</span>
          <span className="tip-value">{r.value}</span>
        </div>
      ))}
      {foot && <div className="tip-foot">{foot}</div>}
    </div>
  );
}
