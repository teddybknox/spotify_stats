/**
 * Genre logic shared by the app and the scripts/update-genres.ts job, so both pick the same genre.
 * No browser APIs in here.
 */

export interface DzAlbum {
  title: string;
  cover_medium?: string;
  genre_id?: number;
  artist?: { name: string };
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Deezer's top-level genres (from https://api.deezer.com/genre), so no extra request is needed.
export const GENRES: Record<number, string> = {
  132: 'Pop',
  116: 'Rap/Hip Hop',
  122: 'Reggaeton',
  152: 'Rock',
  113: 'Dance',
  165: 'R&B',
  85: 'Alternative',
  186: 'Christian',
  106: 'Electro',
  466: 'Folk',
  144: 'Reggae',
  129: 'Jazz',
  84: 'Country',
  67: 'Salsa',
  65: 'Traditional Mexicano',
  98: 'Classical',
  173: 'Films/Games',
  464: 'Metal',
  169: 'Soul & Funk',
  2: 'African Music',
  12: 'Arabic Music',
  16: 'Asian Music',
  153: 'Blues',
  75: 'Brazilian Music',
  71: 'Cumbia',
  81: 'Indian Music',
  95: 'Kids',
  197: 'Latin Music',
};

/**
 * An artist's genre: the most common Deezer genre across their albums in an album search for their
 * name. Albums by other artists with similar names are ignored.
 */
export function pickGenre(albums: DzAlbum[], artist: string): string | null {
  const counts = new Map<string, number>();
  for (const h of albums) {
    if (!h.artist || norm(h.artist.name) !== norm(artist)) continue;
    const g = h.genre_id !== undefined ? GENRES[h.genre_id] : undefined;
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [g, c] of counts) if (best === null || c > counts.get(best)!) best = g;
  return best;
}

export const albumSearchUrl = (q: string) => `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=25`;

/** An artist's genre in two levels, e.g. { top: 'Jazz', sub: 'Hard Bop' }. */
export interface Genre {
  top: string;
  sub: string;
}

/** Closest top-level genre for each Deezer genre, used only for artists Claude hasn't classified. */
const DEEZER_TO_TOP: Record<string, string> = {
  Pop: 'Pop',
  'Rap/Hip Hop': 'Hip-Hop',
  Alternative: 'Rock',
  Rock: 'Rock',
  Metal: 'Metal',
  Jazz: 'Jazz',
  Blues: 'Blues',
  Electro: 'Electronic',
  Dance: 'Electronic',
  'R&B': 'R&B & Soul',
  'Soul & Funk': 'R&B & Soul',
  Country: 'Country',
  Folk: 'Folk',
  Classical: 'Classical',
  'Films/Games': 'Soundtrack',
  Christian: 'Gospel & Christian',
  Reggae: 'Reggae & Caribbean',
  Reggaeton: 'Latin',
  'Latin Music': 'Latin',
  'Brazilian Music': 'Latin',
  Salsa: 'Latin',
  Cumbia: 'Latin',
  'Traditional Mexicano': 'Latin',
  'Asian Music': 'World',
  'Indian Music': 'World',
  'African Music': 'World',
  'Arabic Music': 'World',
  Kids: 'Other',
};

/**
 * Read one value from the genre file or cache: "Top|Sub" from Claude's classification, or a bare
 * Deezer genre name (from a live lookup), which is filed under the closest top-level genre.
 */
export function parseGenre(value: string): Genre {
  const bar = value.indexOf('|');
  if (bar >= 0) return { top: value.slice(0, bar), sub: value.slice(bar + 1) };
  const top = DEEZER_TO_TOP[value] ?? 'Other';
  return { top, sub: `${top} (unsorted)` };
}
