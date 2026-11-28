import { createContext, useContext, useEffect, useState } from 'react';

// Validated categorical palette (fixed order; never cycled) and sequential blue ramp.
const LIGHT = {
  series: ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'],
  other: '#b8b8b8',
  ramp: ['#e6f0fb', '#cce3fd', '#9dc8f7', '#6aabf1', '#338ced', '#2370cd', '#1757ac', '#0e3d7e'],
  grid: '#e6e6e6',
  axis: '#666666',
  text: '#191919',
  surface: '#ffffff',
};
const DARK: typeof LIGHT = {
  series: ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'],
  other: '#5c5c5c',
  ramp: ['#1a2533', '#0e3d7e', '#0f4a96', '#1757ac', '#2370cd', '#338ced', '#6aabf1', '#b6d5f8'],
  grid: '#2e2e2e',
  axis: '#9c9c9c',
  text: '#efefef',
  surface: '#1f1f1f',
};
export type Palette = typeof LIGHT;

const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Dark when the page is explicitly themed dark, or follows a dark OS setting. */
function isDark(): boolean {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return mq().matches;
}

/** Story cards are always dark, whatever the page theme. */
export const ForceDark = createContext(false);

export function usePalette(): Palette {
  const forced = useContext(ForceDark);
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const m = mq();
    const on = () => setDark(isDark());
    m.addEventListener('change', on);
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      m.removeEventListener('change', on);
      obs.disconnect();
    };
  }, []);
  return forced || dark ? DARK : LIGHT;
}

/** Pick a ramp step for a value in [0, 1]. */
export function rampColor(p: Palette, t: number): string {
  const i = Math.min(p.ramp.length - 1, Math.max(0, Math.round(t * (p.ramp.length - 1))));
  return p.ramp[i];
}
