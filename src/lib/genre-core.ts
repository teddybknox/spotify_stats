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
