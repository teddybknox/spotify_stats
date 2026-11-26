import { unzipSync, strFromU8 } from 'fflate';
import type { ExportFormat, Kind, ParseResult, Play } from './types';

/**
 * Spotify has shipped several export layouts over the years:
 *  - Extended streaming history (lifetime): Streaming_History_Audio_*.json, or endsong_*.json in older exports.
 *  - Account data (last ~12 months): StreamingHistory0.json, or StreamingHistory_music_0.json /
 *    StreamingHistory_podcast_0.json in newer exports.
 * Video files are ignored. When a set of files contains extended history, the basic files are dropped
 * because extended history is a superset.
 */
const EXTENDED_RE = /^(Streaming_History_Audio_.*|endsong_\d+)\.json$/i;
const BASIC_RE = /^StreamingHistory(_music|_podcast)?_?\d*\.json$/i;

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function classifyFile(path: string): ExportFormat | null {
  const name = basename(path);
  if (name.startsWith('._') || path.includes('__MACOSX')) return null;
  if (EXTENDED_RE.test(name)) return 'extended';
  if (BASIC_RE.test(name)) return 'basic';
  return null;
}

interface Base {
  ts: number;
  ms: number;
  track: string;
  artist: string;
  album: string;
  kind: Kind;
  skipped: boolean | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromExtended(r: any): Base | null {
  const ts = Date.parse(r.ts);
  const ms = Number(r.ms_played) || 0;
  if (!Number.isFinite(ts)) return null;
  if (r.master_metadata_track_name) {
    return {
      ts,
      ms,
      track: r.master_metadata_track_name,
      artist: r.master_metadata_album_artist_name ?? 'Unknown artist',
      album: r.master_metadata_album_album_name ?? '',
      kind: 'music',
      skipped: typeof r.skipped === 'boolean' ? r.skipped : null,
    };
  }
  if (r.episode_name) {
    return {
      ts,
      ms,
      track: r.episode_name,
      artist: r.episode_show_name ?? 'Unknown show',
      album: r.episode_show_name ?? '',
      kind: 'podcast',
      skipped: typeof r.skipped === 'boolean' ? r.skipped : null,
    };
  }
  return null; // audiobooks, local files without metadata, etc.
}

function fromBasic(r: any): Base | null {
  // "2019-11-14 22:31" is UTC according to Spotify's ReadMe.
  const ts = typeof r.endTime === 'string' ? Date.parse(r.endTime.replace(' ', 'T') + ':00Z') : NaN;
  if (!Number.isFinite(ts)) return null;
  const ms = Number(r.msPlayed) || 0;
  if (r.trackName) {
    return { ts, ms, track: r.trackName, artist: r.artistName ?? 'Unknown artist', album: '', kind: 'music', skipped: null };
  }
  if (r.episodeName) {
    return { ts, ms, track: r.episodeName, artist: r.podcastName ?? 'Unknown show', album: r.podcastName ?? '', kind: 'podcast', skipped: null };
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

export function enrich(b: Base): Play {
  const d = new Date(b.ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return {
    ...b,
    year: y,
    month: `${y}-${pad(m)}`,
    day: `${y}-${pad(m)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    dow: (d.getDay() + 6) % 7,
  };
}

export interface NamedText {
  name: string;
  text: string;
}

/** Turn the JSON files of an export into a list of plays. */
export function parseFiles(files: NamedText[]): ParseResult {
  const ext = files.filter((f) => classifyFile(f.name) === 'extended');
  const basic = files.filter((f) => classifyFile(f.name) === 'basic');
  const format: ExportFormat = ext.length ? 'extended' : 'basic';
  const use = ext.length ? ext : basic;
  if (!use.length) {
    throw new Error(
      "Couldn't find any streaming history in that upload. Expected files named like Streaming_History_Audio_2020.json or StreamingHistory0.json.",
    );
  }
  const convert = format === 'extended' ? fromExtended : fromBasic;
  const seen = new Set<string>();
  const plays: Play[] = [];
  let skippedRecords = 0;
  for (const f of use) {
    let rows: unknown;
    try {
      rows = JSON.parse(f.text);
    } catch {
      throw new Error(`${basename(f.name)} isn't valid JSON.`);
    }
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      const b = convert(r);
      if (!b) {
        skippedRecords++;
        continue;
      }
      // Re-exports and overlapping zips can contain the same stream twice.
      const key = `${b.ts}|${b.ms}|${b.track}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plays.push(enrich(b));
    }
  }
  plays.sort((a, b) => a.ts - b.ts);
  return { plays, format, files: use.map((f) => basename(f.name)).sort(), skippedRecords };
}

/** Accepts the raw bytes of uploaded files: zips are opened, JSON files are read directly. */
export function parseUploads(uploads: { name: string; bytes: Uint8Array }[]): ParseResult {
  const texts: NamedText[] = [];
  for (const u of uploads) {
    if (/\.zip$/i.test(u.name)) {
      const entries = unzipSync(u.bytes, { filter: (f) => classifyFile(f.name) !== null });
      for (const [name, data] of Object.entries(entries)) texts.push({ name, text: strFromU8(data) });
    } else if (classifyFile(u.name)) {
      texts.push({ name: u.name, text: strFromU8(u.bytes) });
    }
  }
  return parseFiles(texts);
}
