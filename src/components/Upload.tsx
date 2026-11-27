import { useRef, useState } from 'react';
import type { SavedMeta } from '../lib/saved';
import { fmtDay, fmtInt } from '../lib/format';

interface Props {
  onFiles: (files: File[]) => void;
  loading: boolean;
  error: string | null;
  saved: SavedMeta[];
  onOpenSaved: (id: string) => void;
  onForget: (id: string) => void;
}

const fmtSize = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const fmtSaved = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Upload({ onFiles, loading, error, saved, onOpenSaved, onForget }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (files.length) onFiles(files);
  };

  return (
    <main className="upload-page">
      <h1>Your Spotify listening, all of it</h1>
      <p className="lede">
        Drop in the <code>my_spotify_data.zip</code> that Spotify emails you and see your top artists, tracks and
        listening habits over the years.
      </p>

      <div
        className={`dropzone${over ? ' over' : ''}${loading ? ' busy' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !loading && input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!loading) take(e.dataTransfer.files);
        }}
      >
        {loading ? (
          <>
            <div className="spinner" aria-hidden />
            <strong>Reading your history…</strong>
            <span className="muted">This takes a few seconds for a big export.</span>
          </>
        ) : (
          <>
            <strong>Drop your zip here, or click to choose it</strong>
            <span className="muted">You can also pick the JSON files from inside it.</span>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          hidden
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {saved.length > 0 && !loading && (
        <section className="saved" aria-label="Saved in this browser">
          <h2>Open a file saved in this browser</h2>
          <ul>
            {saved.map((s) => (
              <li key={s.id}>
                <button className="saved-open" onClick={() => onOpenSaved(s.id)}>
                  <strong>{s.name}</strong>
                  <span className="muted">
                    {fmtInt(s.plays)} plays, {fmtDay(s.from)} to {fmtDay(s.to)} · {fmtSize(s.bytes)} · saved{' '}
                    {fmtSaved(s.savedAt)}
                  </span>
                </button>
                <button className="ghost" onClick={() => onForget(s.id)} aria-label={`Remove ${s.name} from this browser`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="help">
        <div>
          <h2>Private by design</h2>
          <p>
            Your file is opened right here in your browser and never uploaded to a server. A copy is kept in this
            browser so you can reopen it later, and you can remove it any time.
          </p>
        </div>
        <div>
          <h2>Getting your data</h2>
          <p>
            Open your{' '}
            <a href="https://www.spotify.com/us/account/privacy/" target="_blank" rel="noreferrer">
              Spotify account privacy page
            </a>
            , tick <em>Extended streaming history</em> and request it. Spotify emails a zip within a few weeks. The quicker <em>Account data</em> export works too, but
            it only covers the last year.
          </p>
        </div>
      </section>
    </main>
  );
}
