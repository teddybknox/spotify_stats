import { createContext, useContext, useState, type ReactNode } from 'react';
import { TOUCH, useMedia } from '../lib/useMedia';

export interface TipRow {
  color?: string;
  label: string;
  value: string;
}

/** Set by charts on touch screens so the popup can show a close button. */
const TipClose = createContext<(() => void) | null>(null);
export const TipCloseProvider = TipClose.Provider;

export function TipBox({ title, rows, foot }: { title: string; rows: TipRow[]; foot?: ReactNode }) {
  const close = useContext(TipClose);
  return (
    <div className="tip">
      <div className="tip-title">
        <span>{title}</span>
        {close && (
          <button
            className="tip-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        )}
      </div>
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

/**
 * On touch screens the chart popup opens on tap, stays put where you tapped, and has a close button.
 * With a mouse it keeps following the pointer as before.
 */
export function useTapTip() {
  const touch = useMedia(TOUCH);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return {
    chartProps: touch ? { onClick: () => setOpen(true) } : {},
    tooltipProps: touch
      ? {
          trigger: 'click' as const,
          active: open,
          wrapperStyle: { pointerEvents: 'auto' as const, zIndex: 3 },
        }
      : {},
    /** Pass to <TipCloseProvider value={...}> around the chart. */
    close: touch ? close : null,
  };
}
