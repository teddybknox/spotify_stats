import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toBlob } from 'html-to-image';
import { ForceDark } from '../lib/theme';

/** What every story card says about the current view, set once by the dashboard. */
export interface ShareInfo {
  /** e.g. "2024", "All time", "Mar 3, 2021 – Jun 1, 2022". */
  range: string;
  /** e.g. "by plays", plus the focus if there is one. */
  detail: string;
}
export const ShareContext = createContext<ShareInfo | null>(null);
export const useShareInfo = () => useContext(ShareContext);

/** True inside a story card, so panels can hide hints and buttons. */
export const InStory = createContext(false);

/** Shows `story` inside a story card and `children` everywhere else. */
export function StorySwitch({ story, children }: { story: ReactNode; children: ReactNode }) {
  return <>{useContext(InStory) ? story : children}</>;
}

const SITE = 'teddybknox.github.io/spotify_stats';
/** Saved images are 1080 × 1920, the size of an Instagram story. */
const OUT_W = 1080;
/** Story cards are laid out at this size everywhere, then scaled to fit the screen, so every device saves the same picture. */
const CARD_W = 400;
const CARD_H = (CARD_W * 16) / 9;

function useFitScale() {
  const get = () => Math.min((window.innerWidth - 32) / CARD_W, (window.innerHeight - 110) / CARD_H, 1.6);
  const [k, setK] = useState(get);
  useEffect(() => {
    const on = () => setK(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return k;
}

export function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 10V2M8 2 5 5M8 2l3 3M3.5 8v5.5h9V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fileName(title: string, range: string) {
  return `${title} ${range}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
}

/**
 * A full-screen preview of one panel shaped like an Instagram story (9:16), on a dark background,
 * with a big title, the date range and a small credit line. "Save image" makes a 1080 × 1920 PNG;
 * on phones that can, it opens the share sheet so the picture can go straight to Instagram.
 */
export function StoryOverlay({
  title,
  kicker,
  onClose,
  fit = true,
  children,
}: {
  title: string;
  /** Small line above the title; defaults to the date range. */
  kicker?: string;
  onClose: () => void;
  /** Shrink the content to fit the card (lists and charts); off for layouts made to fit already. */
  fit?: boolean;
  children: ReactNode;
}) {
  const info = useShareInfo();
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [cut, setCut] = useState(false);
  const [busy, setBusy] = useState(false);
  const k = useFitScale();
  const [error, setError] = useState('');

  // Close with Escape; keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Shrink tall content to fit; anything still longer fades out at the bottom.
  useLayoutEffect(() => {
    if (!fit) return;
    const b = body.current;
    const c = inner.current;
    if (!b || !c) return;
    const measure = () => {
      // Tall content shrinks (down to 60%); short content is spread out by CSS instead.
      const s = Math.max(0.6, Math.min(1, b.clientHeight / Math.max(1, c.scrollHeight)));
      setScale(s);
      setCut(c.scrollHeight * s > b.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(c);
    return () => ro.disconnect();
  }, [fit]);

  const save = async () => {
    const el = frame.current;
    if (!el) return;
    setBusy(true);
    setError('');
    try {
      const blob = await toBlob(el, {
        pixelRatio: OUT_W / CARD_W,
        width: CARD_W,
        height: CARD_H,
        skipFonts: true,
        style: { borderRadius: '0', margin: '0', transform: 'none' },
        // Pictures that can't be copied (some image hosts block it) are left blank instead of failing.
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      });
      if (!blob) throw new Error('empty');
      const name = fileName(title, info?.range ?? '');
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.warn('Story image failed', e);
      setError("Couldn't make the image. You can still take a screenshot of the card.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="story-overlay" role="dialog" aria-modal="true" aria-label={`${title} story card`}>
      <ForceDark.Provider value={true}>
        <InStory.Provider value={true}>
          <div className="story-scaler" style={{ width: CARD_W * k, height: CARD_H * k }}>
          <div className="story" ref={frame} style={{ width: CARD_W, height: CARD_H, transform: `scale(${k})` }}>
            <div className="story-in">
            <div className="story-glow" aria-hidden />
            <header className="story-head">
              <div className="story-kicker">{kicker ?? info?.range}</div>
              <h2 className="story-title">{title}</h2>
              {info?.detail && <div className="story-detail">{info.detail}</div>}
            </header>
            <div className={`story-body${cut ? ' cut' : ''}`} ref={body}>
              <div
                className={`story-inner${fit && scale >= 1 ? ' fill' : ''}`}
                ref={inner}
                style={fit && scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%` } : undefined}
              >
                {children}
              </div>
            </div>
            <footer className="story-foot">{SITE}</footer>
            </div>
          </div>
          </div>
        </InStory.Provider>
      </ForceDark.Provider>
      <div className="story-actions">
        <button className="story-btn primary" onClick={save} disabled={busy}>
          <ShareIcon /> {busy ? 'Making image…' : 'Save image'}
        </button>
        <button className="story-btn" onClick={onClose}>
          Close
        </button>
      </div>
      {error && <p className="story-error">{error}</p>}
    </div>,
    document.body,
  );
}
