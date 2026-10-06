# Deploying RANG

RANG is a fully static Next.js site: every page is pre-rendered at build time, and there are no API routes, server actions or database reads. Music comes from YouTube in the visitor's browser; the live head-count comes from Supabase in the visitor's browser. Both are optional for the site to load.

That means deployment is short: push the code, set three environment variables, done. No `vercel.json` is needed — Vercel detects Next.js and its defaults (`npm install`, `next build`) are correct.

## 1. Supabase setup

Supabase powers one thing: the "247 riding" head-count in each world's header, using Realtime Presence. It needs a project, but no tables, no auth and no accounts.

1. Create a project at [supabase.com](https://supabase.com). Any region; pick one near your audience (Mumbai, `ap-south-1`, for India).
2. Open **Project Settings → API keys** and copy:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **publishable** key (`sb_publishable_...`). The legacy `anon` key also works.
3. Leave Realtime at its defaults. Presence on public channels works out of the box. If you have changed **Realtime → Settings**, make sure "Allow public access" is still on.

Never use the **secret** / `service_role` key. It bypasses row-level security, and anything in a `NEXT_PUBLIC_*` variable is downloaded by every visitor. Two guards catch the mistake: `next.config.ts` fails the build, and `lib/supabase/client.ts` refuses to use the key.

**Skipping Supabase is fine.** Leave both variables empty and the header reads "RANG FM LIVE" instead of a number.

**Optional: the database schema.** `supabase/migrations/0001_rang_schema.sql` defines tables for analytics and a future editor. The app does not read them yet. To create them anyway, paste the file into the Supabase **SQL Editor** and run it once. It cannot be run twice as-is: the `create policy` statements fail if the policies already exist.

## 2. YouTube setup

There is nothing to sign up for. RANG uses the YouTube IFrame Player API and YouTube's public oEmbed endpoint, neither of which needs an API key. `YOUTUBE_API_KEY` in `.env.example` is a placeholder for later and is not read by any code.

What does matter is the content each world points at:

- The playlist must be **Public** or **Unlisted**. Private playlists do not load.
- Every video must **allow embedding**. Videos that block it show "Embedding not allowed" and the listener has to skip.
- Videos that are age-restricted or region-blocked will fail for some or all visitors.
- Only use official or licensed uploads, keep the YouTube player attribution visible, and never download, proxy or re-host the audio.

The player loads only after a visitor presses play, so YouTube is never contacted on page load.

## 3. Environment variables

| Variable | Required | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Recommended | The public origin, no trailing slash, e.g. `https://rang.fm`. Used for canonical URLs, share-card images, `sitemap.xml` and `robots.txt`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Supabase publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still read as a fallback. |
| `YOUTUBE_API_KEY` | Not used | Leave unset. |

Two things to know:

- `NEXT_PUBLIC_*` values are **baked into the JavaScript at build time**. Changing one in Vercel does nothing until you redeploy.
- If `NEXT_PUBLIC_SITE_URL` is empty, `lib/site.ts` falls back to Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets for you), and then to `https://rang-music-worlds.vercel.app`. On Vercel you can leave it empty until you add a custom domain.

## 4. Local development

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the values; all are optional locally
npm run dev                  # http://localhost:3000
```

Restart `npm run dev` after editing `.env.local`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run lint` | ESLint with the Next.js rules. |
| `npm run typecheck` | Generates Next's route types, then runs `tsc --noEmit`. |
| `npm run build` | Production build. |
| `npm run check` | `lint`, then `typecheck`, then `build`. Run this before every deploy. |
| `npm run start` | Serves the production build locally, after `npm run build`. |
| `npm run optimize-images` | Rebuilds world photos from `assets/worlds/` (see section 8). |
| `npm run make-icons` | Regenerates the app icons. |

## 5. Vercel deployment

The folder is not a git repository yet, so start there.

**With GitHub (recommended — every push deploys):**

1. Create an empty repository on GitHub, then:
   ```bash
   git init
   git add .
   git commit -m "RANG"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   `.gitignore` already keeps `.env.local`, `node_modules` and `.next` out.
2. On [vercel.com](https://vercel.com): **Add New → Project**, import the repository.
3. Leave the framework preset (Next.js), build command and output directory as detected.
4. Under **Environment Variables**, add the variables from section 3 for the **Production** environment (and **Preview** if you want the head-count on preview links).
5. **Deploy.**

**Without GitHub:**

```bash
npm i -g vercel
vercel          # first run links the project and creates a preview deployment
vercel --prod   # production
```

Add the environment variables in the Vercel dashboard (or `vercel env add`) before the `--prod` deploy.

Commit `package-lock.json`. `package.json` asks for `latest` on Next, React and Framer Motion, so the lock file is the only thing keeping Vercel on the versions that were tested here.

## 6. Custom domain

1. Vercel project → **Settings → Domains** → add the domain.
2. Create the DNS records Vercel shows at your registrar: usually an `A` record for the apex (`rang.fm`) and a `CNAME` for `www`. Vercel issues the HTTPS certificate once DNS resolves.
3. Choose which of apex or `www` is primary; Vercel redirects the other.
4. Set `NEXT_PUBLIC_SITE_URL` to the primary origin (e.g. `https://rang.fm`) and **redeploy**. Until you do, canonicals, share cards and the sitemap still point at the old address.

Nothing needs changing on the Supabase or YouTube side for a new domain.

## 7. Production checks

Before deploying:

```bash
npm run check
```

After deploying, on the live URL:

- [ ] `/` loads, and each of `/auto`, `/bus`, `/tapri`, `/saloon`, `/monsoon` loads.
- [ ] A made-up path such as `/nope` shows the not-found page **with HTTP status 404**.
- [ ] Press play in a world: music starts, the track title appears, next/previous work.
- [ ] Move to another world: the music follows, the room tone changes.
- [ ] Open a world in two different browsers: the header count goes up. (Two tabs of the same browser count as one visitor.)
- [ ] `/sitemap.xml` and `/robots.txt` list your real domain, not `vercel.app`.
- [ ] Paste a world URL into a chat app or [opengraph.xyz](https://www.opengraph.xyz): the share card shows that world's photo.
- [ ] Test on a real phone. iOS will not start audio without a tap; the "tap to play" state should appear rather than silence.
- [ ] Browser console shows no red errors, and no `[RANG] The Supabase key ... is a secret` warning.

## 8. Adding a world

Everything about a world lives in one object in `worlds/index.ts`. The route, the home card, the sitemap entry, the share card and the presence channel are all derived from it.

1. **Photo.** Put the source image at `assets/worlds/<slug>.jpg` (`.png` and `.webp` also work). At least 1920px wide is ideal. This folder is not shipped.
2. **Config.** Copy an existing entry in `worlds/index.ts` and change:
   - `slug` — lower-case, URL-safe, unique. It becomes the path (`/<slug>`) and must match the photo's file name.
   - `title`, `subtitle`, `location`, `time`, `description`
   - `heroImage: '/worlds/<slug>/hero.webp'`, `ogImage: '/worlds/<slug>/og.jpg'`
   - `heroFocus` — CSS `object-position` (e.g. `'50% 42%'`) for where the subject sits in the photo.
   - `theme.accent`, `theme.sceneClass` (`'scene-<slug>'`), `theme.mood`
   - `music` (section 9), `ambience.layers`, `interactions`, `character`, `metadata`
3. **Generate images.**
   ```bash
   npm run optimize-images
   ```
   This writes `public/worlds/<slug>/` and updates `worlds/images.generated.ts`. Commit both. Re-run it whenever you replace a photo or change a `heroFocus`. A world with no generated images renders with no photo at all.
4. **Scene styling (optional).** Existing worlds tune their colour grade and overlays under `.scene-<slug>` in `app/globals.css`. A new world works without it and just looks ungraded.
5. **Check.** `npm run dev`, open `/<slug>`, then `npm run check`.

Notes:

- The order of the array is the order on the home page and the order swiping moves through.
- The home page mood filters are `LATE NIGHT`, `RAINY` and `CITY`. A world with any other `theme.mood` appears only under `ALL`. Add a filter in `app/Home.tsx` if you need a new one.
- Ambient audio files live in `public/audio/`. Reuse the existing beds or add new ones and reference them in `ambience.layers`.
- To take a world down, remove (or comment out) its entry and redeploy. `metadata.available` is in the type but nothing reads it yet, so setting it to `false` does not hide anything.

## 9. Adding a playlist

Each world's `music` field takes one of two shapes.

**A YouTube playlist** (what all five worlds use):

1. Open the playlist on YouTube. The ID is the part of the URL after `list=`.
2. Set it on the world:
   ```ts
   music: {
     type: 'youtube-playlist',
     playlistId: 'PLxxxxxxxxxxxxxxxx',
     title: '2AM AUTO • RANG FM',
   },
   ```

**A hand-picked list of videos:**

```ts
music: {
  type: 'tracks',
  tracks: [
    { id: 'track-1', title: 'Song Title', artist: 'Artist', youtubeVideoId: 'dQw4w9WgXcQ' },
  ],
},
```

The video ID is the part of a YouTube URL after `v=`. Each `id` must be unique within the world.

Then play it through locally before deploying — the playlist rules in section 2 (public or unlisted, embedding allowed) are the usual reason a new playlist is silent. Editing the playlist on YouTube later needs no redeploy; changing the playlist ID does.

## 10. Troubleshooting

**Build fails with "Refusing to start: NEXT_PUBLIC_… would expose a server secret"**
A `NEXT_PUBLIC_*` variable is named like a secret or holds an `sb_secret_` key. Replace it with the publishable key. If a secret key was ever deployed, rotate it in Supabase.

**Header says "RANG FM LIVE" and never shows a number**
Presence is off or not connecting. Check, in order: both Supabase variables are set for the environment you are looking at; you redeployed after setting them; the key is the publishable one; the Supabase project is not paused (free projects pause after a week idle); Realtime still allows public access.

**Changed an environment variable and nothing happened**
`NEXT_PUBLIC_*` values are fixed at build time. Redeploy.

**Share cards, sitemap or canonicals show the wrong domain**
`NEXT_PUBLIC_SITE_URL` is missing or stale. Set it and redeploy. Chat apps cache share cards, so re-test with a fresh URL (add `?1`).

**No music / "Embedding not allowed" / "Video not found"**
The playlist is private, or that video blocks embedding, is region-locked or was removed. Fix the playlist on YouTube or swap the ID. Ad blockers and privacy extensions that block `youtube.com` also stop the player.

**Music does not start on its own on a phone**
Expected. Mobile browsers block audio until the visitor taps. The UI shows a tap-to-play prompt.

**A new world has no photo, or an old photo keeps showing**
Run `npm run optimize-images` and commit `public/worlds/<slug>/` and `worlds/images.generated.ts`. Photo URLs carry a content hash and are cached for a year, so a changed photo only appears once the regenerated manifest is deployed.

**A new world's URL returns 404**
Only slugs listed in `worlds/index.ts` at build time exist (`dynamicParams = false` in `app/[world]/page.tsx`). Check the slug and redeploy.

**`npm run typecheck` complains about missing `.css` or image types on a fresh clone**
Run it through the script, not bare `tsc`. The script runs `next typegen` first, which creates `next-env.d.ts`.

**`npm audit` reports high-severity issues**
At the time of writing these are all in the ESLint toolchain (development only). `npm audit --omit=dev` reports zero for what actually ships.

**Works locally, fails on Vercel**
Run `npm run check` locally — it runs the same build. Then compare versions: make sure `package-lock.json` is committed, and that the Vercel project's Node.js version (Settings → Build and Deployment) is 20 or newer.
