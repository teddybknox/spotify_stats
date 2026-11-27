/**
 * Merges data/releases/musicbrainz.json and deezer.json (written by the "Update release years" Action)
 * into public/releases.json, which the app loads. Runs before every dev server start and build.
 *
 * MusicBrainz knows when an album first came out. Deezer only knows the edition it carries, which for
 * older albums is often a recent reissue (Abbey Road as 2019), so a Deezer year is used only for albums
 * MusicBrainz has looked up and doesn't know. Albums MusicBrainz hasn't reached yet are left out.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PARTS_DIR, type Years } from './release-parts';
import type { ReleaseFile } from '../src/lib/release-core';

const read = (name: string): Years =>
  existsSync(`${PARTS_DIR}/${name}.json`) ? JSON.parse(readFileSync(`${PARTS_DIR}/${name}.json`, 'utf8')) : {};
const mb = read('musicbrainz');
const dz = read('deezer');

const years: Years = {};
let fromDz = 0;
for (const [artist, albums] of Object.entries(mb)) {
  for (const [album, year] of Object.entries(albums)) {
    const y = year ?? dz[artist]?.[album] ?? null;
    if (year === null && y !== null) fromDz++;
    (years[artist] ??= {})[album] = y;
  }
}
const out: ReleaseFile = {
  about: 'Artist -> album -> year first released (null = not found). Built from data/releases by scripts/build-releases.ts.',
  years,
};
writeFileSync('public/releases.json', JSON.stringify(out));
const n = Object.values(years).reduce((s, a) => s + Object.keys(a).length, 0);
console.log(`public/releases.json: ${n} albums (${fromDz} with a Deezer year)`);
