import { lookupYear, type ReleaseFile } from './release-core';

/**
 * Album release years. Most come from public/releases.json (filled by the "Update release years"
 * GitHub Action); albums missing from it are looked up live on MusicBrainz (then Deezer), a few at
 * a time, and cached in localStorage. Only artist and album names are sent.
 */

/** artist + '\u0000' + album -> year it first came out. */
export type YearMap = Map<string, number>;

const LS_KEY = 'release-cache-v1';
const sep = '\u0000';
let stored: Record<string, number | null> = {};
try {
  stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
} catch {
  stored = {};
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function remember(key: string, year: number | null) {
  stored[key] = year;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(stored));
    } catch {
      /* storage full or blocked: keep the in-memory cache only */
    }
  }, 500);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Deezer doesn't allow cross-origin fetch, so use its JSONP mode. MusicBrainz allows fetch.
let counter = 0;
function jsonp(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const name = `__release_${Date.now()}_${counter++}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const done = () => {
      clearTimeout(timer);
      delete w[name];
      script.remove();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('timeout'));
    }, 8000);
    w[name] = (d: unknown) => {
      done();
      resolve(d);
    };
    script.src = `${url}&output=jsonp&callback=${name}`;
    script.onerror = () => {
      done();
      reject(new Error('network'));
    };
    document.head.appendChild(script);
  });
}

// MusicBrainz asks for no more than one request per second.
let nextMb = 0;
async function getJson(url: string): Promise<unknown> {
  if (url.includes('api.deezer.com')) return jsonp(url);
  const wait = nextMb - Date.now();
  nextMb = Math.max(nextMb, Date.now()) + 1100;
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
  return res.json();
}

let shared: Promise<void> | null = null;
function loadSharedYears(): Promise<void> {
  shared ??= fetch('./releases.json')
    .then((r) => (r.ok ? r.json() : { years: {} }))
    .then((file: Partial<ReleaseFile>) => {
      for (const [artist, albums] of Object.entries(file.years ?? {})) {
        for (const [album, year] of Object.entries(albums)) {
          const key = artist + sep + album;
          if (!(key in stored) || stored[key] === null) stored[key] = year;
        }
      }
    })
    .catch(() => undefined);
  return shared;
}

/**
 * Release years for many albums (most-played first, as [artist, album]). Albums already known are
 * filled in at once; of the rest, only the first `liveLimit` are looked up, one after another.
 * Calls onUpdate with the growing map and lookup progress. Returns a cancel function.
 */
export function loadReleaseYears(
  albums: [string, string][],
  liveLimit: number,
  onUpdate: (years: YearMap, done: number, total: number) => void,
): () => void {
  let cancelled = false;
  const years: YearMap = new Map();
  let done = 0;
  let total = 0;
  let pending = false;
  const flush = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      if (!cancelled) onUpdate(new Map(years), done, total);
    }, 250);
  };
  loadSharedYears().then(async () => {
    if (cancelled) return;
    const missing: [string, string][] = [];
    for (const [artist, album] of albums) {
      const key = artist + sep + album;
      if (key in stored) {
        const y = stored[key];
        if (y) years.set(key, y);
      } else if (missing.length < liveLimit) missing.push([artist, album]);
    }
    total = missing.length;
    flush();
    for (const [artist, album] of missing) {
      if (cancelled) return;
      const key = artist + sep + album;
      try {
        const { year } = await lookupYear(artist, album, getJson);
        remember(key, year);
        if (year) years.set(key, year);
      } catch {
        /* network trouble: skip for now, don't cache */
      }
      done++;
      flush();
    }
  });
  return () => {
    cancelled = true;
  };
}
