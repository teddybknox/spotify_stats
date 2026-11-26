# Spotify listening stats

A small web app that turns the `my_spotify_data.zip` Spotify sends you into charts of your listening history.

Everything runs in the browser: the zip is unpacked and analysed on your own machine and is never uploaded anywhere.

## What it shows

- Headline numbers: hours, plays, artists and tracks for the selected range
- Hours listened per day, with a 1 / 7 / 30 / 90-day moving average
- Top artists over time (monthly, top 3 / 5 / 8 plus "Other"), as hours or share
- Top artists, tracks and albums, ranked by plays or time
- When you listen: weekday × hour heatmap in your local time zone
- Hours per year (click a bar to zoom into that year)
- New artists discovered each year

Filters apply to every chart: a date range (presets for each year), music vs podcasts, a minimum play length
(30 seconds by default, like Spotify's own counting), and an artist focus (click an artist in Top artists).

## Supported exports

- **Extended streaming history** (`Streaming_History_Audio_*.json`, or `endsong_*.json` in older exports): your whole history.
- **Account data** (`StreamingHistory*.json`, `StreamingHistory_music_*.json`, `StreamingHistory_podcast_*.json`): the last year only.

You can drop the zip itself, or pick the JSON files inside it.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build into dist/
```

Stack: Vite + React + TypeScript, Recharts for charts, fflate to unzip in a Web Worker.

## Deploying

`.github/workflows/deploy.yml` builds and publishes the site to GitHub Pages on every push to `main`.
One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

Never commit real listening data: `.gitignore` blocks the usual export file names.
