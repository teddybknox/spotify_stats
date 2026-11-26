import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  loading: boolean;
  error: string | null;
}

export default function Upload({ onFiles, loading, error }: Props) {
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="help">
        <div>
          <h2>Private by design</h2>
          <p>
            Your file is opened right here in your browser. Nothing is uploaded to a server, and nothing is saved
            once you close the tab.
          </p>
        </div>
        <div>
          <h2>Getting your data</h2>
          <p>
            On spotify.com go to <em>Account → Account privacy</em>, tick <em>Extended streaming history</em> and
            request it. Spotify emails a zip within a few weeks. The quicker <em>Account data</em> export works too, but
            it only covers the last year.
          </p>
        </div>
      </section>
    </main>
  );
}
