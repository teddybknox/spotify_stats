import { useEffect, useState } from 'react';
import { albumSearchUrl, norm, parseGenre, pickGenre, type DzAlbum, type Genre } from './genre-core';

export { norm };

/**
 * Artist photos, album covers and artist genres from Deezer's public search API. It needs no key, and only
 * artist and album names are sent. Deezer doesn't allow cross-origin fetch, so this uses its
 * JSONP mode. Results (including "not found") are cached in localStorage.
 */

type Kind = 'artist' | 'album' | 'genre';
const LS_KEY = 'deezer-cache-v1';
const memory = new Map<string, Promise<string | null>>();
let stored: Record<string, string | null> = {};
try {
  stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
} catch {
  stored = {};
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function remember(key: string, url: string | null) {
  stored[key] = url;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(stored));
    } catch {
      /* storage full or blocked: keep the in-memory cache only */
    }
  }, 500);
}

// Deezer allows about 50 requests per 5 seconds, so keep a small queue.
const MAX_ACTIVE = 4;
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    setTimeout(() => {
      active--;
      waiting.shift()?.();
    }, 150);
  }
}

let counter = 0;
function jsonp(url: string): Promise<{ data?: unknown[] }> {
  return new Promise((resolve, reject) => {
    const name = `__deezer_${Date.now()}_${counter++}`;
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
    w[name] = (d: { data?: unknown[] }) => {
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

/** Drop edition noise so "Hunky Dory (2015 Remaster)" matches "Hunky Dory". */
export function cleanAlbum(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*(remaster|edition|deluxe|expanded|version|anniversary|mono|stereo|bonus)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*(remaster|edition|deluxe|version).*$/i, '')
    .trim();
}

interface DzArtist {
  name: string;
  picture_medium?: string;
}

async function lookup(kind: Kind, artist: string, album: string): Promise<string | null> {
  if (kind === 'genre') {
    // Deezer has no genre on artists, so use the most common genre across their albums.
    const res = await limited(() =>
      jsonp(albumSearchUrl(artist)),
    );
    return pickGenre((res.data ?? []) as DzAlbum[], artist);
  }
  if (kind === 'artist') {
    const res = await limited(() => jsonp(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=10`));
    const hits = (res.data ?? []) as DzArtist[];
    const hit = hits.find((h) => norm(h.name) === norm(artist));
    return hit?.picture_medium ?? null;
  }
  const title = cleanAlbum(album);
  const res = await limited(() =>
    jsonp(`https://api.deezer.com/search/album?q=${encodeURIComponent(`${artist} ${title}`)}&limit=25`),
  );
  const hits = ((res.data ?? []) as DzAlbum[]).filter((h) => h.artist && norm(h.artist.name) === norm(artist));
  const want = norm(title);
  const hit =
    hits.find((h) => norm(cleanAlbum(h.title)) === want) ??
    hits.find((h) => norm(h.title).startsWith(want) || want.startsWith(norm(cleanAlbum(h.title))));
  return hit?.cover_medium ?? null;
}

export function getImage(kind: Kind, artist: string, album = ''): Promise<string | null> {
  const key = `${kind}|${artist}|${album}`;
  if (key in stored) return Promise.resolve(stored[key]);
  let p = memory.get(key);
  if (!p) {
    p = lookup(kind, artist, album).then(
      (url) => {
        remember(key, url);
        return url;
      },
      () => {
        memory.delete(key); // network trouble: allow a retry later, don't cache
        return null;
      },
    );
    memory.set(key, p);
  }
  return p;
}

let shared: Promise<void> | null = null;

/**
 * Load the artist -> genre file published with the site (public/genres.json: Claude's two-level
 * classification, plus Deezer genres for artists added later by the "Update genres" GitHub Action).
 * The file wins over anything this browser looked up on Deezer before.
 */
export function loadSharedGenres(): Promise<void> {
  shared ??= fetch('./genres.json')
    .then((r) => (r.ok ? r.json() : { genres: {} }))
    .then((file: { genres?: Record<string, string | null> }) => {
      for (const [artist, genre] of Object.entries(file.genres ?? {})) {
        const key = `genre|${artist}|`;
        if (genre !== null || !(key in stored)) stored[key] = genre;
      }
    })
    .catch(() => undefined);
  return shared;
}

/**
 * Genres for many artists (most-played first). Artists already known from the shared file or this
 * browser's cache are filled in at once; of the rest, only the first `liveLimit` are looked up on Deezer.
 * Calls onUpdate with the growing map and lookup progress. Returns a cancel function.
 */
export function loadGenres(
  artists: string[],
  liveLimit: number,
  onUpdate: (genres: Map<string, Genre>, done: number, total: number) => void,
): () => void {
  let cancelled = false;
  const genres = new Map<string, Genre>();
  let done = 0;
  let total = 0;
  let pending = false;
  const flush = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      if (!cancelled) onUpdate(new Map(genres), done, total);
    }, 250);
  };
  loadSharedGenres().then(() => {
    if (cancelled) return;
    const missing: string[] = [];
    for (const a of artists) {
      const key = `genre|${a}|`;
      if (key in stored) {
        const g = stored[key];
        if (g) genres.set(a, parseGenre(g));
      } else if (missing.length < liveLimit) missing.push(a);
    }
    total = missing.length;
    flush();
    for (const a of missing) {
      getImage('genre', a).then((g) => {
        if (cancelled) return;
        done++;
        if (g) genres.set(a, parseGenre(g));
        flush();
      });
    }
  });
  return () => {
    cancelled = true;
  };
}

/** undefined while loading, null when there's no picture. */
export function useImage(kind: 'artist' | 'album', artist: string, album = ''): string | null | undefined {
  const key = `${kind}|${artist}|${album}`;
  const [state, setState] = useState<{ key: string; url: string | null | undefined }>(() => ({
    key,
    url: key in stored ? stored[key] : undefined,
  }));
  useEffect(() => {
    let live = true;
    getImage(kind, artist, album).then((url) => live && setState({ key, url }));
    return () => {
      live = false;
    };
  }, [kind, artist, album, key]);
  return state.key === key ? state.url : undefined;
}
