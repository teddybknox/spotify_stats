/**
 * Merges data/releases/part-*.json (written by the "Update release years" Action) into
 * public/releases.json, which the app loads. Runs before every dev server start and build.
 */
import { writeFileSync } from 'node:fs';
import { readParts } from './release-parts';
import type { ReleaseFile } from '../src/lib/release-core';

const years = readParts();
const out: ReleaseFile = {
  about: 'Artist -> album -> year first released (null = not found). Built from data/releases by scripts/build-releases.ts.',
  years,
};
writeFileSync('public/releases.json', JSON.stringify(out));
const n = Object.values(years).reduce((s, a) => s + Object.keys(a).length, 0);
console.log(`public/releases.json: ${n} albums`);
