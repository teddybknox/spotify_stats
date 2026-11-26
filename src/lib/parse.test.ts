import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { classifyFile, parseFiles, parseUploads } from './parse';

const ext = (o: Record<string, unknown>) => ({
  ts: '2023-03-05T14:30:00Z',
  ms_played: 200000,
  master_metadata_track_name: 'Song A',
  master_metadata_album_artist_name: 'Artist 1',
  master_metadata_album_album_name: 'Album X',
  episode_name: null,
  episode_show_name: null,
  skipped: false,
  ...o,
});

describe('classifyFile', () => {
  it('recognises every export layout', () => {
    expect(classifyFile('Spotify Extended Streaming History/Streaming_History_Audio_2014-2020_0.json')).toBe('extended');
    expect(classifyFile('MyData/endsong_3.json')).toBe('extended');
    expect(classifyFile('MyData/StreamingHistory0.json')).toBe('basic');
    expect(classifyFile('Spotify Account Data/StreamingHistory_music_0.json')).toBe('basic');
    expect(classifyFile('Spotify Account Data/StreamingHistory_podcast_1.json')).toBe('basic');
    expect(classifyFile('Streaming_History_Video_2019-2024.json')).toBeNull();
    expect(classifyFile('MyData/Playlist1.json')).toBeNull();
    expect(classifyFile('__MACOSX/MyData/._endsong_0.json')).toBeNull();
  });
});

describe('parseFiles', () => {
  it('parses extended history, music and podcasts, and drops duplicates', () => {
    const rows = [
      ext({}),
      ext({}), // duplicate
      ext({ ts: '2023-03-06T01:00:00Z', master_metadata_track_name: null, episode_name: 'Ep 1', episode_show_name: 'Show' }),
      ext({ master_metadata_track_name: null }), // nothing to show
    ];
    const r = parseFiles([{ name: 'Streaming_History_Audio_2023_0.json', text: JSON.stringify(rows) }]);
    expect(r.format).toBe('extended');
    expect(r.plays).toHaveLength(2);
    expect(r.skippedRecords).toBe(1);
    expect(r.plays[0]).toMatchObject({ track: 'Song A', artist: 'Artist 1', album: 'Album X', kind: 'music', day: '2023-03-05', hour: 14, dow: 6 });
    expect(r.plays[1]).toMatchObject({ track: 'Ep 1', artist: 'Show', kind: 'podcast' });
  });

  it('parses the basic account-data format as UTC', () => {
    const rows = [{ endTime: '2019-11-14 22:31', artistName: 'Eric Clapton', trackName: 'Layla', msPlayed: 35434 }];
    const r = parseFiles([{ name: 'MyData/StreamingHistory0.json', text: JSON.stringify(rows) }]);
    expect(r.format).toBe('basic');
    expect(r.plays[0]).toMatchObject({ artist: 'Eric Clapton', track: 'Layla', ms: 35434, day: '2019-11-14', hour: 22, skipped: null });
  });

  it('prefers extended history when both kinds are present', () => {
    const r = parseFiles([
      { name: 'endsong_0.json', text: JSON.stringify([ext({})]) },
      { name: 'StreamingHistory0.json', text: JSON.stringify([{ endTime: '2019-11-14 22:31', artistName: 'B', trackName: 'C', msPlayed: 1 }]) },
    ]);
    expect(r.format).toBe('extended');
    expect(r.files).toEqual(['endsong_0.json']);
  });

  it('explains when nothing usable is found', () => {
    expect(() => parseFiles([{ name: 'Playlist1.json', text: '[]' }])).toThrow(/Couldn't find any streaming history/);
  });
});

describe('parseUploads', () => {
  it('reads streaming history out of a zip', () => {
    const zip = zipSync({
      'Spotify Extended Streaming History/Streaming_History_Audio_2023_0.json': strToU8(JSON.stringify([ext({})])),
      'Spotify Extended Streaming History/ReadMeFirst.pdf': strToU8('pdf'),
    });
    const r = parseUploads([{ name: 'my_spotify_data.zip', bytes: zip }]);
    expect(r.plays).toHaveLength(1);
  });
});
