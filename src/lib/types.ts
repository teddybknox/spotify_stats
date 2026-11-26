export type Kind = 'music' | 'podcast';

/** One stream, normalised from any Spotify export format. */
export interface Play {
  /** When the stream ended, epoch ms (Spotify records the end time, in UTC). */
  ts: number;
  /** Milliseconds actually played. */
  ms: number;
  /** Track name, or episode name for podcasts. */
  track: string;
  /** Artist name, or show name for podcasts. */
  artist: string;
  /** Album name ('' when the export doesn't include it). */
  album: string;
  kind: Kind;
  /** null when the export doesn't say. */
  skipped: boolean | null;
  // Derived in the viewer's local time zone:
  day: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  year: number;
  hour: number; // 0-23
  dow: number; // 0 = Monday ... 6 = Sunday
}

export type ExportFormat = 'extended' | 'basic';

export interface ParseResult {
  plays: Play[];
  format: ExportFormat;
  files: string[];
  skippedRecords: number;
}
