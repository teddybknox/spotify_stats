import { useState } from 'react';
import { useImage } from '../lib/deezer';

interface Props {
  kind: 'artist' | 'album';
  artist: string;
  album?: string;
  label: string;
}

/** Artist photo (round) or album cover (square), with the first letter as a fallback. */
export default function Thumb({ kind, artist, album = '', label }: Props) {
  const url = useImage(kind, artist, album);
  const [broken, setBroken] = useState(false);
  const letter = (label.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
  return (
    <span className={`thumb ${kind}${url === undefined ? ' loading' : ''}`} aria-hidden>
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        url !== undefined && <span className="thumb-letter">{letter}</span>
      )}
    </span>
  );
}
