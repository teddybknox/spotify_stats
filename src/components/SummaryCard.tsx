import { useMemo, useState } from 'react';
import Thumb from './Thumb';
import { ShareIcon, StoryOverlay } from './Share';
import { fmtInt } from '../lib/format';
import { HOUR_MS, topBy, type GenreMap, type Metric, type Ranked } from '../lib/stats';
import type { Kind, Play } from '../lib/types';

interface Props {
  plays: Play[];
  genres: GenreMap;
  metric: Metric;
  kind: Kind;
  range: string;
  /** Called when the card opens, so genres start loading. */
  onOpen: () => void;
}

function Top3({ label, rows, sub }: { label: string; rows: Ranked[]; sub?: boolean }) {
  return (
    <div className="wr-list">
      <div className="wr-label">{label}</div>
      {rows.length ? (
        <ol>
          {rows.map((r, i) => (
            <li key={r.key}>
              <span className="wr-n">{i + 1}</span>
              <span className="wr-text">
                <span className="wr-name">{r.label}</span>
                {sub && r.sub && <span className="wr-by">{r.sub}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="wr-none">Not known yet</p>
      )}
    </div>
  );
}

/** "Share summary" button and the Wrapped-style story card it opens. */
export default function SummaryCard({ plays, genres, metric, kind, range, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const music = kind === 'music';

  const d = useMemo(() => {
    if (!open) return null;
    const artists = new Set<string>();
    const tracks = new Set<string>();
    let ms = 0;
    for (const p of plays) {
      ms += p.ms;
      artists.add(p.artist);
      tracks.add(p.artist + '\u0000' + p.track);
    }
    return {
      minutes: Math.round((ms / HOUR_MS) * 60),
      artists: artists.size,
      tracks: tracks.size,
      topArtists: topBy(plays, 'artist', metric, 3),
      topAlbums: music ? topBy(plays, 'album', metric, 3) : [],
      topTracks: topBy(plays, 'track', metric, 3),
      topSubs: music ? topBy(plays, 'subgenre', metric, 3, genres) : [],
    };
  }, [open, plays, metric, genres, music]);

  const title = range === 'All time' ? 'My all-time listening' : /^\d{4}$/.test(range) ? `My ${range} in music` : 'My listening';
  const artist = d?.topArtists[0];
  const album = d?.topAlbums[0];

  return (
    <>
      <button
        className="share-summary"
        onClick={() => {
          onOpen();
          setOpen(true);
        }}
        disabled={!plays.length}
      >
        <ShareIcon /> Share summary
      </button>
      {open && d && (
        <StoryOverlay title={title} onClose={() => setOpen(false)} fit={false}>
          <div className="wrapped">
            <div className="wr-grid">
              <div>
                {artist && (
                  <div className="wr-art round">
                    <Thumb kind="artist" artist={artist.artist} label={artist.label} />
                  </div>
                )}
                <Top3 label={music ? 'Top artists' : 'Top shows'} rows={d.topArtists} />
              </div>
              {music && (
                <div>
                  {album && (
                    <div className="wr-art">
                      <Thumb kind="album" artist={album.artist} album={album.label} label={album.label} />
                    </div>
                  )}
                  <Top3 label="Top albums" rows={d.topAlbums} sub />
                </div>
              )}
              <Top3 label={music ? 'Top songs' : 'Top episodes'} rows={d.topTracks} sub />
              {music && <Top3 label="Top sub-genres" rows={d.topSubs} />}
            </div>
            <div className="wr-stats">
              <div>
                <div className="wr-big">{fmtInt(d.minutes)}</div>
                <div className="wr-label">minutes listened</div>
              </div>
              <div>
                <div className="wr-big">{fmtInt(d.artists)}</div>
                <div className="wr-label">{music ? 'artists' : 'shows'}</div>
              </div>
              <div>
                <div className="wr-big">{fmtInt(d.tracks)}</div>
                <div className="wr-label">{music ? 'songs' : 'episodes'}</div>
              </div>
            </div>
          </div>
        </StoryOverlay>
      )}
    </>
  );
}
