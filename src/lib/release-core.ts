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
  return full === want || full.includes(want) || credits.some((c) => norm(c.name) === want || norm(c.artist?.name ?? '') === want);
}

/** Earliest first-release year among this artist's release groups with this title. */
export function pickMbYear(groups: MbReleaseGroup[], artist: string, album: string): number | null {
  const byArtist = groups.filter((g) => creditMatches(g, artist) && yearOf(g['first-release-date']) !== null);
  for (const loose of [false, true]) {
    const years = byArtist.filter((g) => titlesMatch(album, g.title, loose)).map((g) => yearOf(g['first-release-date'])!);
    if (years.length) return Math.min(...years);
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

export function pickDzAlbum(hits: DzAlbumHit[], artist: string, album: string): DzAlbumHit | null {
  const mine = hits.filter((h) => h.artist && norm(h.artist.name) === norm(artist));
  return mine.find((h) => titlesMatch(album, h.title, false)) ?? mine.find((h) => titlesMatch(album, h.title, true)) ?? null;
}

class ServiceError extends Error {}

/**
 * The year an album first came out, or null when neither service knows it.
 * Throws on network trouble or rate limiting, so the caller can retry later instead of storing "unknown".
 */
export async function lookupYear(
  artist: string,
  album: string,
  getJson: GetJson,
): Promise<{ year: number | null; source: 'musicbrainz' | 'deezer' | null }> {
  const mb = (await getJson(mbSearchUrl(artist, album))) as { 'release-groups'?: MbReleaseGroup[]; error?: string };
  if (mb.error) throw new ServiceError(`MusicBrainz: ${mb.error}`);
  const year = pickMbYear(mb['release-groups'] ?? [], artist, album);
  if (year !== null) return { year, source: 'musicbrainz' };

  const search = (await getJson(dzSearchUrl(artist, album))) as { data?: DzAlbumHit[]; error?: { code?: number } };
  if (search.error) throw new ServiceError(`Deezer error ${search.error.code}`);
  const hit = pickDzAlbum(search.data ?? [], artist, album);
  if (!hit) return { year: null, source: null };
  const full = (await getJson(dzAlbumUrl(hit.id))) as { release_date?: string; error?: { code?: number } };
  if (full.error) throw new ServiceError(`Deezer error ${full.error.code}`);
  const y = yearOf(full.release_date);
  return { year: y, source: y === null ? null : 'deezer' };
}

/** The shared file: artist -> album -> year (null = looked up, not found). */
export interface ReleaseFile {
  about: string;
  years: Record<string, Record<string, number | null>>;
}
