/**
 * Looks up the year each album in data/release-queue.txt (one "artist<TAB>album" per line, most-listened
 * first) first came out, on one service: SOURCE=musicbrainz or SOURCE=deezer. Results go to
 * data/releases/<source>.json; scripts/build-releases.ts merges them into public/releases.json when the
 * site is built, preferring MusicBrainz (it knows original release years, Deezer often only has remasters).
 * The "Update release years" Action runs one job per service, each within that service's rate limit.
 * Locally: SOURCE=deezer npx tsx scripts/update-releases.ts
 *
 * Albums the service doesn't know are stored as null so they aren't looked up there again.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { lookupDz, lookupMb, type Source } from '../src/lib/release-core';
import { PARTS_DIR, type Years } from './release-parts';

const QUEUE_FILE = 'data/release-queue.txt';
const SOURCE = (process.env.SOURCE ?? 'deezer') as Source;
const PART_FILE = `${PARTS_DIR}/${SOURCE}.json`;
const lookupOn = SOURCE === 'musicbrainz' ? lookupMb : lookupDz;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Stop and save after this long; whatever is left is picked up next round. */
const BUDGET_MS = Number(process.env.RELEASE_BUDGET_MINUTES ?? 15) * 60_000;
// MusicBrainz asks for at most one request per second and a User-Agent that says who is calling.
const USER_AGENT = 'spotify-stats/1.0 ( https://github.com/teddybknox/spotify_stats )';
const GAP: Record<string, number> = { 'musicbrainz.org': 1100, 'api.deezer.com': 120 };
const lastCall: Record<string, number> = {};

async function getJson(url: string): Promise<unknown> {
  const host = new URL(url).host;
  const wait = (lastCall[host] ?? 0) + (GAP[host] ?? 0) - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall[host] = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (res.status === 503 || res.status === 429) throw new Error(`${host} busy (${res.status})`);
  if (!res.ok) throw new Error(`${host} HTTP ${res.status}`);
  return res.json();
}

async function lookup(artist: string, album: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return { year: await lookupOn(artist, album, getJson) };
    } catch {
      await sleep(3000 * (attempt + 1)); // back off when the service says it's busy
    }
  }
  return undefined; // give up for now; it's retried next round
}

async function main() {
  const mine: Years = existsSync(PART_FILE) ? JSON.parse(readFileSync(PART_FILE, 'utf8')) : {};
  const lines = existsSync(QUEUE_FILE) ? readFileSync(QUEUE_FILE, 'utf8').split('\n').filter((l) => l.includes('\t')) : [];
  const todo = lines
    .map((l) => l.split('\t') as [string, string])
    .filter(([a, b]) => !(mine[a] && b in mine[a]));
  console.log(`${SOURCE}: ${todo.length} albums to look up`);

  const counts = { found: 0, none: 0, failed: 0 };
  const start = Date.now();
  try {
    for (const [i, [artist, album]] of todo.entries()) {
      if (Date.now() - start > BUDGET_MS) break;
      const r = await lookup(artist, album);
      if (!r) counts.failed++;
      else {
        (mine[artist] ??= {})[album] = r.year;
        counts[r.year === null ? 'none' : 'found']++;
      }
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${todo.length}`, JSON.stringify(counts));
    }
  } finally {
    mkdirSync(PARTS_DIR, { recursive: true });
    const sorted = Object.fromEntries(Object.entries(mine).sort(([a], [b]) => a.localeCompare(b)));
    // One artist per line keeps the file's history readable.
    const body = Object.entries(sorted).map(([a, albums]) => `${JSON.stringify(a)}:${JSON.stringify(albums)}`);
    writeFileSync(PART_FILE, `{\n${body.join(',\n')}\n}\n`);
    const done = counts.found + counts.none;
    console.log(`Done: ${JSON.stringify(counts)}; ${todo.length - done} left`);
    writeFileSync(process.env.GITHUB_OUTPUT ?? '/dev/null', `left=${todo.length - done}\nprogress=${done}\n`, { flag: 'a' });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
