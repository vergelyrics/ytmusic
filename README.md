# YouTube Music Clone

A full YouTube Music clone powered by your deployed worker API at `https://yt-music-api.vergelyrics.workers.dev/`.

## Features

- 🏠 Home page with carousels (songs, albums, artists, playlists)
- 🔍 Search with live suggestions + categorized results
- 🎨 Artist pages with immersive header
- 💿 Album & playlist pages with track lists
- ▶️ YouTube IFrame player (plays actual audio)
- 📋 Queue, Related, Lyrics panel
- 🎵 Full mini-player + expanded player
- 🔗 Shareable URL routing: `/artist/:id`, `/album/:id`, `/playlist/:id`

## URL Examples

```
/                              → Home
/search?q=taylor+swift         → Search results
/artist/UCa9Y57gfeY0Zro_noHRVrnw  → Artist page
/album/MPREb_...               → Album page
/playlist/RDCLAK5uy_...        → Playlist / Radio mix
```

## Deploy to Cloudflare Pages

### Option A — GitHub + Cloudflare Pages (recommended)

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → **Create a project** → **Connect to Git**

3. Select your repo. Use these build settings:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/` (root, or leave blank)

4. Click **Save and Deploy**. Your site will be live at `https://YOUR_PROJECT.pages.dev`.

### Option B — Direct upload

1. Zip all files in this folder.
2. In Cloudflare Pages → **Create a project** → **Direct upload** → upload the zip.

## File Structure

```
/
├── index.html          ← Main app shell
├── src/
│   ├── styles.css      ← All styles (YouTube Music design)
│   └── app.js          ← Router, API calls, player logic
├── _redirects          ← SPA routing (/* → /index.html)
├── _headers            ← Security headers
└── README.md
```

## Notes

- Audio is played via YouTube IFrame API using the video ID from your worker's `/stream` endpoint.
- The YouTube IFrame is hidden — only the custom player UI is visible.
- All navigation is client-side SPA routing with `history.pushState`.
