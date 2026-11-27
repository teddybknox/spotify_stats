import { readFileSync, readdirSync, existsSync } from 'node:fs';

/** artist -> album -> year first released (null = looked up, not found). */
export type Years = Record<string, Record<string, number | null>>;

export const PARTS_DIR = 'data/releases';

/** Every file in data/releases merged. Files are read alphabetically and a later found year wins, so
 * musicbrainz.json overrides deezer.json; null never overrides a year. */
export function readParts(): Years {
  const all: Years = {};
  if (!existsSync(PARTS_DIR)) return all;
  for (const f of readdirSync(PARTS_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const part = JSON.parse(readFileSync(`${PARTS_DIR}/${f}`, 'utf8')) as Years;
    for (const [artist, albums] of Object.entries(part)) {
      const into = (all[artist] ??= {});
      for (const [album, year] of Object.entries(albums)) if (year !== null || !(album in into)) into[album] = year;
    }
  }
  return all;
}
