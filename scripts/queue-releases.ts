/**
 * Adds every album in one or more Spotify extended-history exports (zips, folders or JSON files) to
 * data/release-queue.txt, most-listened first, skipping albums already in public/releases.json.
 * Only artist and album names are written. Usage: npx tsx scripts/queue-releases.ts my_spotify_data.zip
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import type { ReleaseFile } from '../src/lib/release-core';

const RELEASES_FILE = 'public/releases.json';
const QUEUE_FILE = 'data/release-queue.txt';

interface Rec {
  ms_played?: number;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
}

function* jsonTexts(path: string): Generator<string> {
  if (statSync(path).isDirectory()) {
    for (const f of readdirSync(path)) yield* jsonTexts(join(path, f));
  } else if (path.endsWith('.zip')) {
    const files = unzipSync(readFileSync(path), { filter: (f) => /Streaming_History_Audio.*\.json$/.test(f.name) });
    for (const data of Object.values(files)) yield strFromU8(data);
  } else if (/Streaming_History_Audio.*\.json$/.test(path)) {
    yield readFileSync(path, 'utf8');
  }
}

const file: ReleaseFile = existsSync(RELEASES_FILE) ? JSON.parse(readFileSync(RELEASES_FILE, 'utf8')) : { about: '', years: {} };
const ms = new Map<string, number>();
for (const path of process.argv.slice(2)) {
  for (const text of jsonTexts(path)) {
    for (const r of JSON.parse(text) as Rec[]) {
      const artist = r.master_metadata_album_artist_name;
      const album = r.master_metadata_album_album_name;
      if (!artist || !album || artist.includes('\t') || album.includes('\t')) continue;
      const line = `${artist}\t${album}`;
      ms.set(line, (ms.get(line) ?? 0) + (r.ms_played ?? 0));
    }
  }
}
const queued = existsSync(QUEUE_FILE) ? readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean) : [];
const fresh = [...ms.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([line]) => line)
  .filter((line) => {
    const [artist, album] = line.split('\t');
    return !(file.years[artist] && album in file.years[artist]);
  });
const all = [...new Set([...queued, ...fresh])];
writeFileSync(QUEUE_FILE, all.length ? all.join('\n') + '\n' : '');
console.log(`${fresh.length} albums found, ${all.length} now queued`);
