# RANG Alpha 1.0

**Music has a place. Enter it.**

RANG is a mobile-first interactive music-world prototype: one persistent radio, five places, ambient audio, interactive hotspots, narrative moments, secrets, and shareable routes.

## Worlds

- `/auto` — 2AM AUTO
- `/bus` — LAST BUS HOME
- `/tapri` — TAPRI AT 11:47
- `/saloon` — LOCAL SALOON
- `/monsoon` — MUMBAI MONSOON

## Alpha 1.0 production shell

- Dynamic world routes with `notFound()` handling instead of silently falling back to Auto.
- Route-specific metadata and Open Graph metadata.
- Loading state and route-level error recovery UI.
- Web app manifest, sitemap and robots metadata.
- Persistent RANG FM state and world-specific ambience.
- Keyboard + touch navigation.
- World moments and Easter eggs.
- Responsive five-world home feed.
- Reduced-motion support.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Live head-count (Supabase Realtime Presence)

Each world header shows how many visitors are in that world right now — "247 riding", "183 on board", and so on. It needs a Supabase project but no tables and no accounts.

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API keys). Use the publishable key (or the legacy anon key) — never the secret / service_role key.
3. Restart `npm run dev`.

Without those variables, or whenever the connection drops, the header reads "RANG FM LIVE" instead. One channel per world (`rang:world:<slug>`), one anonymous random ID per browser so extra tabs are not counted twice.

`supabase/migrations/0001_rang_schema.sql` holds the schema for analytics and a future editor. The app does not read it yet; world configuration stays in `worlds/index.ts`.

## Environment variables and secrets

All configuration comes from environment variables; `.env.example` is the template and `.env.local` (git-ignored) holds real values.

- `NEXT_PUBLIC_*` variables are compiled into the JavaScript every visitor downloads. Only the site URL, the Supabase URL and the Supabase **publishable** key belong there.
- Server secrets (the Supabase secret / service_role key, a future `YOUTUBE_API_KEY`, any private API key) must have no `NEXT_PUBLIC_` prefix and may only be read in server code.
- Two guards back this up: `next.config.ts` stops the build if a `NEXT_PUBLIC_*` variable is named like a secret, and `lib/supabase/client.ts` refuses to use a service_role key in the browser.

## Production music note

The prototype uses the YouTube IFrame Player API for the demo tracks rather than bundling commercial recordings. Replace demo IDs with music you are licensed to use, or retain a compliant embed integration before public launch.

Set `NEXT_PUBLIC_SITE_URL` in production so sitemap/robots use the deployed origin.

## Verification

```bash
npm run check   # lint, typecheck, production build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Supabase, environment variables, Vercel and custom-domain setup.
