/**
 * Adds the world's most-listened Spotify artists to data/genre-queue.txt, so the "Update genres" job
 * looks them up too. Source: kworb.net's ranking of artists by Spotify monthly listeners
 * (2,500 per page). Usage: npx tsx scripts/queue-top-artists.ts 10000
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GENRES_FILE = 'public/genres.json';
const QUEUE_FILE = 'data/genre-queue.txt';
const PER_PAGE = 2500;

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export function parseListenersPage(html: string): string[] {
  return [...html.matchAll(/<a href="artist\/[^"]+">([^<]+)<\/a>/g)].map((m) => decode(m[1]).trim());
}

async function main() {
  const want = Number(process.argv[2] ?? 10000);
  const names: string[] = [];
  for (let page = 1; names.length < want; page++) {
    const url = `https://kworb.net/spotify/listeners${page === 1 ? '' : page}.html`;
    const res = await fetch(url);
    if (!res.ok) break;
    const found = parseListenersPage(await res.text());
    if (!found.length) break;
    names.push(...found);
    console.log(`${url}: ${found.length} artists`);
    if (found.length < PER_PAGE) break;
  }
  const top = names.slice(0, want);
  const known = existsSync(GENRES_FILE) ? JSON.parse(readFileSync(GENRES_FILE, 'utf8')).genres ?? {} : {};
  const queue = existsSync(QUEUE_FILE) ? readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean) : [];
  const inQueue = new Set(queue);
  const add = top.filter((a) => !(a in known) && !inQueue.has(a) && (inQueue.add(a), true));
  writeFileSync(QUEUE_FILE, [...queue, ...add].join('\n') + '\n');
  console.log(`Top ${top.length} artists: ${add.length} added to the queue, the rest were already known or queued`);
}

if (process.argv[1]?.endsWith('queue-top-artists.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
