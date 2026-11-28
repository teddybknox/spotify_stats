import { useEffect, useState } from 'react';

/** True while the CSS media query matches; follows changes such as rotating a phone. */
export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return on;
}

/** Phones and tablets: no mouse to hover with. */
export const TOUCH = '(hover: none)';
/** Phone-width screens. */
export const NARROW = '(max-width: 600px)';
