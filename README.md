# Spotify listening stats

A small web app that turns the `my_spotify_data.zip` Spotify sends you into charts of your listening history.

Everything runs in the browser: the zip is unpacked and analysed on your own machine and is never uploaded anywhere.

## What it shows

Two switches at the top drive the whole page:

- **Measure by**: plays or listening time.
- **Rank**: artists, tracks, albums or genres. This switches the two main panels: a monthly "top over time" chart
  (top 3 / 5 / 8 plus "Other", as totals or share) and a ranked top 10 / 25 / 50 list.

Click any row in the ranked list to focus every chart on that artist, track, album or genre.

Also on the page: headline numbers, a weekday × hour heatmap in your local time zone, plays or hours per day with a
1 / 7 / 30 / 90-day moving average, totals per year (click a bar to zoom into that year), and new artists discovered
each year.

Filters: a date range (with a preset for each year), music or podcasts, and a minimum play length (30 seconds by
default, like Spotify's own counting).

### Pictures and genres

Spotify's export has no genres or images, so these come from Deezer's public API, which needs no account or key.
Only artist and album names are sent, and answers are cached in the browser. Genres are Deezer's broad categories
(Rock, Pop, Jazz, ...) per artist, taken as the most common genre across that artist's albums, and only your 300
most-played artists are looked up.

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
