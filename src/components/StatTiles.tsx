import { fmtInt } from '../lib/format';
import type { Summary } from '../lib/stats';

export default function StatTiles({ s, kind }: { s: Summary; kind: 'music' | 'podcast' }) {
  const perDay = s.days ? s.hours / s.days : 0;
  const tiles = [
    { label: 'Hours listened', value: fmtInt(s.hours), note: `${perDay.toFixed(1)} h a day on average` },
    { label: 'Plays', value: fmtInt(s.plays), note: `on ${fmtInt(s.activeDays)} of ${fmtInt(s.days)} days` },
    { label: kind === 'music' ? 'Artists' : 'Shows', value: fmtInt(s.artists), note: '' },
    { label: kind === 'music' ? 'Different tracks' : 'Episodes', value: fmtInt(s.tracks), note: '' },
  ];
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
          {t.note && <div className="tile-note">{t.note}</div>}
        </div>
      ))}
    </div>
  );
}
