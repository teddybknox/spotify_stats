import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

export default function Card({ title, subtitle, controls, wide, children }: Props) {
  return (
    <section className={`card${wide ? ' wide' : ''}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {controls && <div className="card-controls">{controls}</div>}
      </header>
      {children}
    </section>
  );
}

interface SegProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

/** Small segmented toggle used for metric / count switches. */
export function Segmented<T extends string | number>({ value, options, onChange, label }: SegProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
