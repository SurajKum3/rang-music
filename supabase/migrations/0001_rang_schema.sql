-- RANG data model.
--
-- Nothing in the app reads these tables yet: world configuration lives in
-- worlds/index.ts and the live head-count uses Realtime Presence, which needs
-- no tables at all. This is the schema for analytics and a future
-- admin/editor system. Run it in the Supabase SQL editor or `supabase db push`.

create table if not exists public.worlds (
  slug        text primary key,
  title       text not null,
  subtitle    text not null default '',
  location    text not null default '',
  local_time  text not null default '',
  accent      text,
  available   boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.music_tracks (
  id                uuid primary key default gen_random_uuid(),
  youtube_video_id  text not null unique,
  title             text not null,
  artist            text,
  artwork_url       text,
  created_at        timestamptz not null default now()
);

-- One row per world per playlist. Either a YouTube playlist (playlist id set)
-- or a hand-picked list (rows in world_playlist_tracks).
create table if not exists public.world_playlists (
  id                   uuid primary key default gen_random_uuid(),
  world_slug           text not null references public.worlds(slug) on delete cascade,
  title                text not null,
  youtube_playlist_id  text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);
create index if not exists world_playlists_world_idx on public.world_playlists (world_slug);

create table if not exists public.world_playlist_tracks (
  playlist_id  uuid not null references public.world_playlists(id) on delete cascade,
  track_id     uuid not null references public.music_tracks(id) on delete cascade,
  position     integer not null,
  primary key (playlist_id, track_id),
  unique (playlist_id, position)
);

create table if not exists public.world_moments (
  id          uuid primary key default gen_random_uuid(),
  world_slug  text not null references public.worlds(slug) on delete cascade,
  label       text not null,
  body        text not null,
  trigger     text not null check (trigger in ('mirror','driver','meter','radio','horn','ambient','entry','listen')),
  sort_order  integer not null default 0
);
create index if not exists world_moments_world_idx on public.world_moments (world_slug);

-- Append-only event log. session_id is the same random anonymous ID the
-- client uses for presence; no IP, user agent or account is stored.
create table if not exists public.world_analytics (
  id          bigint generated always as identity primary key,
  world_slug  text not null,
  event       text not null check (char_length(event) <= 40),
  session_id  uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists world_analytics_world_time_idx on public.world_analytics (world_slug, created_at desc);

alter table public.worlds                enable row level security;
alter table public.music_tracks          enable row level security;
alter table public.world_playlists       enable row level security;
alter table public.world_playlist_tracks enable row level security;
alter table public.world_moments         enable row level security;
alter table public.world_analytics       enable row level security;

-- Content is public to read; only the service role (which bypasses RLS) writes.
create policy "public read worlds"          on public.worlds                for select to anon, authenticated using (true);
create policy "public read tracks"          on public.music_tracks          for select to anon, authenticated using (true);
create policy "public read playlists"       on public.world_playlists       for select to anon, authenticated using (true);
create policy "public read playlist tracks" on public.world_playlist_tracks for select to anon, authenticated using (true);
create policy "public read moments"         on public.world_moments         for select to anon, authenticated using (true);

-- Visitors may add events but never read them back.
create policy "anon insert analytics" on public.world_analytics for insert to anon, authenticated with check (true);
