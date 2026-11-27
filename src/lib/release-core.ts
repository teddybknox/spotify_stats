/**
 * Release-year logic shared by the app and scripts/update-releases.ts, so both pick the same year.
 * No browser APIs in here.
 *
 * Spotify's export has no release dates, so an album's year is looked up by artist + album name:
 * first on MusicBrainz, whose "release groups" bundle every reissue of an album and carry the date
 * it first came out (so a 2015 remaster still counts as 1971); then on Deezer if MusicBrainz has nothing.
 */
import { norm } from './genre-core';

export type GetJson = (url: string) => Promise<unknown>;

/** Drop edition noise and single/EP tags so "Hunky Dory (2015 Remaster)" matches "Hunky Dory". */
export function cleanTitle(title: string): string {
  return title
    .replace(
      /\s*[([][^)\]]*(remaster|edition|deluxe|expanded|version|anniversary|mono|stereo|bonus|reissue|feat\.|with )[^)\]]*[)\]]/gi,
      '',
    )
    .replace(/\s+-\s+.*(remaster|edition|deluxe|version|anniversary|reissue).*$/i, '')
    .replace(/\s*[-(]?\s*\b(EP|Single)\)?\s*$/i, '')
    .trim();
}

const titleKey = (t: string) => norm(cleanTitle(t));

function titlesMatch(spotify: string, other: string, loose: boolean): boolean {
  const a = titleKey(spotify);
  const b = titleKey(other);
  if (!a || !b) return false;
  if (a === b) return true;
  return loose && (a.startsWith(b + ' ') || b.startsWith(a + ' '));
}

const yearOf = (date: string | undefined): number | null => {
  const y = Number(date?.slice(0, 4));
  return y >= 1900 && y <= 2100 ? y : null;
};

/** Year the decade label is shown for, e.g. 1977 -> "1970s". */
export const decadeOf = (year: number) => `${Math.floor(year / 10) * 10}s`;

// ---------- MusicBrainz ----------

export interface MbReleaseGroup {
  title: string;
  score?: number;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'artist-credit'?: { name: string; joinphrase?: string; artist?: { name: string } }[];
}

const lucene = (s: string) => '"' + s.replace(/[\\"]/g, '\\$&') + '"';

export const mbSearchUrl = (artist: string, album: string) =>
  'https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=25&query=' +
  encodeURIComponent(`releasegroup:${lucene(cleanTitle(album) || album)} AND artist:${lucene(artist)}`);

function creditMatches(rg: MbReleaseGroup, artist: string): boolean {
  const want = norm(artist);
  const credits = rg['artist-credit'] ?? [];
  const full = norm(credits.map((c) => c.name + (c.joinphrase ?? '')).join(''));
  if (!want || !full) return false;
  // "Vince Guaraldi" on MusicBrainz vs "Vince Guaraldi Trio" on Spotify, or joint credits like "JAY-Z & Kanye West".
  const inside = (a: string, b: string) => ` ${b} `.includes(` ${a} `);
  return inside(want, full) || inside(full, want) || credits.some((c) => norm(c.name) === want || norm(c.artist?.name ?? '') === want);
}

/** Proper albums and EPs before singles, compilations, live albums and soundtracks that share the title. */
const rank = (g: MbReleaseGroup) => {
  const type = g['primary-type'] ?? '';
  const studio = (type === 'Album' || type === 'EP') && !(g['secondary-types'] ?? []).length;
  return studio ? 0 : type === 'Album' || type === 'EP' ? 1 : 2;
};

/** Earliest first-release year among this artist's release groups with this title. */
export function pickMbYear(groups: MbReleaseGroup[], artist: string, album: string): number | null {
  const byArtist = groups.filter((g) => creditMatches(g, artist) && yearOf(g['first-release-date']) !== null);
  for (const loose of [false, true]) {
    const hits = byArtist.filter((g) => titlesMatch(album, g.title, loose));
    if (!hits.length) continue;
    const best = Math.min(...hits.map(rank));
    return Math.min(...hits.filter((g) => rank(g) === best).map((g) => yearOf(g['first-release-date'])!));
  }
  return null;
}

// ---------- Deezer (fallback) ----------

export interface DzAlbumHit {
  id: number;
  title: string;
  artist?: { name: string };
}

export const dzSearchUrl = (artist: string, album: string) =>
  `https://api.deezer.com/search/album?q=${encodeURIComponent(`${artist} ${cleanTitle(album) || album}`)}&limit=25`;
export const dzAlbumUrl = (id: number) => `https://api.deezer.com/album/${id}?`;

/** This artist's Deezer albums with this title (exact title matches, else close ones), up to `n`. */
export function pickDzAlbums(hits: DzAlbumHit[], artist: string, album: string, n = 3): DzAlbumHit[] {
  const mine = hits.filter((h) => h.artist && norm(h.artist.name) === norm(artist));
  const exact = mine.filter((h) => titlesMatch(album, h.title, false));
  return (exact.length ? exact : mine.filter((h) => titlesMatch(album, h.title, true))).slice(0, n);
}

class ServiceError extends Error {}
export type Source = 'musicbrainz' | 'deezer';

/** MusicBrainz: the year the album's release group first came out. Throws on network trouble or rate limiting. */
export async function lookupMb(artist: string, album: string, getJson: GetJson): Promise<number | null> {
  const mb = (await getJson(mbSearchUrl(artist, album))) as { 'release-groups'?: MbReleaseGroup[]; error?: string };
  if (mb.error) throw new ServiceError(`MusicBrainz: ${mb.error}`);
  return pickMbYear(mb['release-groups'] ?? [], artist, album);
}

/**
 * Deezer: the earliest release date among this artist's editions of the album on Deezer. Deezer often
 * only has a remaster, so this can be later than the original; MusicBrainz years take priority.
 */
export async function lookupDz(artist: string, album: string, getJson: GetJson): Promise<number | null> {
  const search = (await getJson(dzSearchUrl(artist, album))) as { data?: DzAlbumHit[]; error?: { code?: number } };
  if (search.error) throw new ServiceError(`Deezer error ${search.error.code}`);
  let best: number | null = null;
  for (const hit of pickDzAlbums(search.data ?? [], artist, album)) {
    const full = (await getJson(dzAlbumUrl(hit.id))) as { release_date?: string; error?: { code?: number } };
    if (full.error) throw new ServiceError(`Deezer error ${full.error.code}`);
    const y = yearOf(full.release_date);
    if (y !== null && (best === null || y < best)) best = y;
  }
  return best;
}

/**
 * The year an album first came out (MusicBrainz, else Deezer), or null when neither knows it.
 * Throws on network trouble or rate limiting, so the caller can retry later instead of storing "unknown".
 */
export async function lookupYear(artist: string, album: string, getJson: GetJson): Promise<{ year: number | null; source: Source | null }> {
  const mb = await lookupMb(artist, album, getJson);
  if (mb !== null) return { year: mb, source: 'musicbrainz' };
  const dz = await lookupDz(artist, album, getJson);
  return { year: dz, source: dz === null ? null : 'deezer' };
}

/** The shared file: artist -> album -> year (null = looked up, not found). */
export interface ReleaseFile {
  about: string;
  years: Record<string, Record<string, number | null>>;
}
