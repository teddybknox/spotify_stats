import { useState, type ReactNode } from 'react';
import { ShareIcon, StoryOverlay, useShareInfo } from './Share';

interface Props {
  title: string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

export default function Card({ title, subtitle, controls, wide, children }: Props) {
  const canShare = useShareInfo() !== null;
  const [sharing, setSharing] = useState(false);
  return (
    <section className={`card${wide ? ' wide' : ''}`}>
      <header className="card-head">
        <div className="card-title">
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {(controls || canShare) && (
          <div className="card-controls">
            {controls}
            {canShare && (
              <button className="share-btn" onClick={() => setSharing(true)} aria-label={`Share ${title} as a story card`} title="Share as a story card">
                <ShareIcon />
                <span>Share</span>
              </button>
            )}
          </div>
        )}
      </header>
      {children}
      {sharing && (
        <StoryOverlay title={title} onClose={() => setSharing(false)}>
          {children}
        </StoryOverlay>
      )}
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
