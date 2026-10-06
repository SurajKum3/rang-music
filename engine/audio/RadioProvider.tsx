'use client';

import Script from 'next/script';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { WorldConfig } from '@/engine/world/types';

// The IFrame API ships no types, and half its methods are missing until the
// player is ready, so the player itself stays untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;
type YTEvent = { target: YTPlayer; data: number };
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement | string, options: object) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type CurrentTrack = {
  title: string;
  artist: string;
  youtubeVideoId?: string;
  artwork?: string;
};

/** One entry of the world's queue, as shown in the track list. */
export type PlaylistItem = {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
};

type RadioContextValue = {
  // readiness
  ready: boolean;
  loading: boolean;
  buffering: boolean;
  error: string | null;
  autoplayBlocked: boolean;
  // playback
  playing: boolean;
  trackIndex: number;
  progress: number;
  duration: number;
  currentTime: number;
  // audio
  volume: number;
  muted: boolean;
  track: CurrentTrack | null;
  station: WorldConfig | null;
  ambienceReady: boolean;
  // queue
  playlistItems: PlaylistItem[];
  playlistLoading: boolean;
  // actions
  setStation: (world: WorldConfig) => void;
  initPlayer: () => void;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  next: () => void;
  previous: () => void;
  select: (index: number) => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  crossfadeTo: (index: number) => void;
  /** Fade out the current world's ambience. The music keeps playing. */
  leaveWorld: () => void;
  playSfx: (id: string) => void;
  playLogo: () => void;
  playCue: (cue: 'discover' | 'moment' | 'secret') => void;
};

const RadioContext = createContext<RadioContextValue | null>(null);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
// Short enough to feel instant, long enough to never click.
const AMBIENCE_IN_MS = 600;
const AMBIENCE_OUT_MS = 450;
const AMBIENCE_PAUSE_MS = 160;
const MUSIC_OUT_MS = 280;
const MUSIC_IN_MS = 420;
// First sign the listener is actually here; see setupAmbience.
const WARM_EVENTS = ['pointerdown', 'keydown'] as const;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [station, setStationState] = useState<WorldConfig | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(78);
  const [muted, setMuted] = useState(false);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [track, setTrack] = useState<CurrentTrack | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [scriptRequested, setScriptRequested] = useState(false);
  const [ytApiReady, setYtApiReady] = useState(false);

  const playerRef = useRef<YTPlayer>(null);
  const playerInitRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const fadeTimer = useRef<number | null>(null);
  const upFadeTimer = useRef<number | null>(null);
  const timeIntervalRef = useRef<number | null>(null);
  const stationRef = useRef<WorldConfig | null>(null);
  const trackIndexRef = useRef(0);
  const volumeRef = useRef(78);
  const playingRef = useRef(false);
  const mutedRef = useRef(false);
  const ambienceRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playlistIdsRef = useRef<string[]>([]);
  const metaCacheRef = useRef<Map<string, PlaylistItem>>(new Map());
  const metaRunRef = useRef(0);
  const pendingSelectRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimesRef = useRef(0);
  const fadesRef = useRef<Map<HTMLAudioElement, number>>(new Map());
  const timersRef = useRef<Set<number>>(new Set());
  const warmListenerRef = useRef<(() => void) | null>(null);
  const onFirstGesture = useCallback(function handler() {
    WARM_EVENTS.forEach(type => window.removeEventListener(type, handler));
    warmListenerRef.current?.();
  }, []);

  /** setTimeout that is cancelled if the provider unmounts first. */
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
  }, []);

  useEffect(() => { stationRef.current = station; }, [station]);
  useEffect(() => { trackIndexRef.current = trackIndex; }, [trackIndex]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ── Ambience ──────────────────────────────────────────────────────────────

  const layerVolume = useCallback((id: string) => {
    const layer = stationRef.current?.ambience.layers.find(l => l.id === id);
    return clamp((layer?.volume ?? 0) * (mutedRef.current ? 0 : volumeRef.current / 100), 0, 1);
  }, []);

  /**
   * Ramp an element's volume. `to` is read every tick, so a fade still lands
   * on the right level if the listener moves the slider or mutes meanwhile.
   */
  const fadeAudio = useCallback((audio: HTMLAudioElement, to: () => number, ms: number, done?: () => void) => {
    const running = fadesRef.current.get(audio);
    if (running) window.clearInterval(running);
    const from = audio.volume;
    const start = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / ms);
      audio.volume = clamp(from + (to() - from) * k, 0, 1);
      if (k < 1) return;
      window.clearInterval(id);
      fadesRef.current.delete(audio);
      done?.();
    }, 16);
    fadesRef.current.set(audio, id);
  }, []);

  const releaseAudio = useCallback((audio: HTMLAudioElement) => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load(); // drops the buffered file and any in-flight request
  }, []);

  const applyAmbienceVolume = useCallback(() => {
    ambienceRef.current.forEach((audio, id) => {
      // A running fade reads the new level by itself.
      if (!fadesRef.current.has(audio)) audio.volume = layerVolume(id);
    });
  }, [layerVolume]);

  const stopAmbience = useCallback((fadeMs = AMBIENCE_OUT_MS) => {
    ambienceRef.current.forEach(audio => {
      if (audio.paused || fadeMs <= 0) {
        const running = fadesRef.current.get(audio);
        if (running) { window.clearInterval(running); fadesRef.current.delete(audio); }
        releaseAudio(audio);
      } else {
        fadeAudio(audio, () => 0, fadeMs, () => releaseAudio(audio));
      }
    });
    ambienceRef.current = new Map();
    setAmbienceReady(false);
  }, [fadeAudio, releaseAudio]);

  const removeWarmListener = useCallback(() => {
    WARM_EVENTS.forEach(type => window.removeEventListener(type, onFirstGesture));
    warmListenerRef.current = null;
  }, [onFirstGesture]);

  const setupAmbience = useCallback((world: WorldConfig) => {
    stopAmbience();
    if (!world.ambience.layers.length) { setAmbienceReady(true); return; }
    const next = new Map<string, HTMLAudioElement>();
    world.ambience.layers.forEach(layer => {
      const audio = new Audio(layer.src);
      audio.loop = Boolean(layer.loop);
      // Fetched by warm() below, or by play() if the listener gets there first.
      audio.preload = 'none';
      audio.volume = 0;
      next.set(layer.id, audio);
    });
    ambienceRef.current = next;
    setAmbienceReady(true);

    // The beds are a couple of MB of audio. Nothing is fetched on page load:
    // the first tap or key press (in practice, ENTER WORLD) starts the
    // download, so a visitor who only glances at the page pays nothing.
    const warm = () => {
      warmListenerRef.current = null;
      if (ambienceRef.current !== next) return; // a newer world took over
      // On Data Saver or a slow link, leave it to play() to fetch each bed
      // when it is actually needed.
      const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (net?.saveData || /(^|-)[23]g$/.test(net?.effectiveType ?? '')) return;
      next.forEach(a => {
        if (a.paused && a.readyState === 0) { a.preload = 'auto'; a.load(); }
      });
    };
    removeWarmListener();
    warmListenerRef.current = warm;
    WARM_EVENTS.forEach(type => window.addEventListener(type, onFirstGesture, { passive: true }));
  }, [onFirstGesture, removeWarmListener, stopAmbience]);

  /** Fade the looping beds in. One-shots (the horn) only play through playSfx. */
  const startAmbience = useCallback(() => {
    stationRef.current?.ambience.layers.forEach(layer => {
      if (!layer.loop) return;
      const audio = ambienceRef.current.get(layer.id);
      if (!audio) return;
      const fading = fadesRef.current.has(audio);
      if (!audio.paused && !fading) return; // already up
      if (audio.paused) { audio.volume = 0; void audio.play().catch(() => undefined); }
      fadeAudio(audio, () => layerVolume(layer.id), AMBIENCE_IN_MS);
    });
  }, [fadeAudio, layerVolume]);

  const pauseAmbience = useCallback(() => {
    ambienceRef.current.forEach(audio => {
      if (!audio.paused) fadeAudio(audio, () => 0, AMBIENCE_PAUSE_MS, () => audio.pause());
    });
  }, [fadeAudio]);

  const leaveWorld = useCallback(() => stopAmbience(), [stopAmbience]);

  // ── Time polling ──────────────────────────────────────────────────────────

  const startTimePolling = useCallback(() => {
    if (timeIntervalRef.current) window.clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = window.setInterval(() => {
      // Nobody can see the seek bar in a background tab.
      if (!playerRef.current || document.hidden) return;
      try {
        const t = playerRef.current.getCurrentTime?.() ?? 0;
        const d = playerRef.current.getDuration?.() ?? 0;
        setCurrentTime(t);
        setDuration(d);
        if (d > 0) setProgress((t / d) * 100);
      } catch {}
    }, 500);
  }, []);

  const stopTimePolling = useCallback(() => {
    if (timeIntervalRef.current) { window.clearInterval(timeIntervalRef.current); timeIntervalRef.current = null; }
  }, []);

  // ── Playlist queue ────────────────────────────────────────────────────────
  // The IFrame API hands us the video ids of a playlist but not their titles,
  // so each id is resolved through YouTube's public oEmbed endpoint (no key,
  // CORS-enabled) and cached for the session.

  const META_KEY = 'rang:yt:meta';

  const readMetaCache = useCallback(() => {
    if (metaCacheRef.current.size) return;
    try {
      const raw = JSON.parse(sessionStorage.getItem(META_KEY) || '{}');
      Object.entries(raw).forEach(([id, v]) => metaCacheRef.current.set(id, v as PlaylistItem));
    } catch {}
  }, []);

  const writeMetaCache = useCallback(() => {
    try {
      sessionStorage.setItem(META_KEY, JSON.stringify(Object.fromEntries(metaCacheRef.current)));
    } catch {}
  }, []);

  const fetchMeta = useCallback(async (videoId: string): Promise<PlaylistItem> => {
    const cached = metaCacheRef.current.get(videoId);
    if (cached) return cached;
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const item: PlaylistItem = {
        videoId,
        title: data.title || '',
        artist: data.author_name || '',
        thumbnail: data.thumbnail_url,
      };
      metaCacheRef.current.set(videoId, item);
      return item;
    } catch {
      // Unavailable or region-blocked — still listed, still selectable.
      return { videoId, title: '', artist: '' };
    }
  }, []);

  /** Read the player's queue and fill in titles, a few requests at a time. */
  const syncPlaylist = useCallback(async (force = false) => {
    const p = playerRef.current;
    if (!p?.getPlaylist) return;
    let ids: string[] = [];
    try { ids = p.getPlaylist() || []; } catch { return; }
    if (!ids.length) return;
    if (!force && ids.join() === playlistIdsRef.current.join()) return;

    playlistIdsRef.current = ids;
    readMetaCache();
    const run = ++metaRunRef.current;
    setPlaylistItems(ids.map(id => metaCacheRef.current.get(id) ?? { videoId: id, title: '', artist: '' }));
    if (ids.every(id => metaCacheRef.current.has(id))) return;

    setPlaylistLoading(true);
    const BATCH = 6;
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      const resolved = await Promise.all(slice.map(fetchMeta));
      if (run !== metaRunRef.current) return; // a newer world took over
      setPlaylistItems(prev => {
        const next = [...prev];
        resolved.forEach((item, j) => { next[i + j] = item; });
        return next;
      });
    }
    if (run !== metaRunRef.current) return;
    writeMetaCache();
    setPlaylistLoading(false);
  }, [fetchMeta, readMetaCache, writeMetaCache]);

  /** The queue appears a beat after loadPlaylist(), so poll briefly. */
  const schedulePlaylistSync = useCallback(() => {
    [250, 800, 1800, 3500].forEach(ms => later(() => void syncPlaylist(), ms));
  }, [later, syncPlaylist]);

  // ── Track info from player (playlist mode) ────────────────────────────────

  const refreshTrackInfo = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const data = playerRef.current.getVideoData?.();
      if (data?.title) {
        setTrack({ title: data.title, artist: data.author || '', youtubeVideoId: data.video_id });
      }
      const idx = playerRef.current.getPlaylistIndex?.();
      if (typeof idx === 'number' && idx >= 0) {
        setTrackIndex(idx);
        trackIndexRef.current = idx;
      }
    } catch {}
  }, []);

  // ── Music fades ───────────────────────────────────────────────────────────

  const clearMusicFades = useCallback(() => {
    if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
    if (upFadeTimer.current) { window.clearInterval(upFadeTimer.current); upFadeTimer.current = null; }
  }, []);

  const musicFadeOut = useCallback((done: () => void) => {
    clearMusicFades();
    let v = mutedRef.current ? 0 : volumeRef.current;
    const stepDown = Math.max(1, v / (MUSIC_OUT_MS / 40));
    fadeTimer.current = window.setInterval(() => {
      v = Math.max(0, v - stepDown);
      playerRef.current?.setVolume?.(v);
      if (v > 0) return;
      if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
      done();
    }, 40);
  }, [clearMusicFades]);

  /** Bring the player back up to the listener's level after a faded switch. */
  const musicFadeIn = useCallback(() => {
    if (fadeTimer.current || upFadeTimer.current) return; // a fade already owns the volume
    const target = () => (mutedRef.current ? 0 : volumeRef.current);
    let v = 0;
    try { v = playerRef.current?.getVolume?.() ?? target(); } catch { v = target(); }
    if (v >= target()) return;
    const stepUp = Math.max(1, (target() - v) / (MUSIC_IN_MS / 40));
    upFadeTimer.current = window.setInterval(() => {
      v = Math.min(target(), v + stepUp);
      playerRef.current?.setVolume?.(v);
      if (v < target()) return;
      if (upFadeTimer.current) { window.clearInterval(upFadeTimer.current); upFadeTimer.current = null; }
    }, 40);
  }, []);

  // ── YouTube player constructor ────────────────────────────────────────────

  const createPlayer = useCallback(() => {
    if (playerInitRef.current) return;
    const el = document.getElementById('rang-global-youtube');
    if (!el || !window.YT?.Player) return;
    playerInitRef.current = true;

    const world = stationRef.current;
    const isPlaylist = world?.music.type === 'youtube-playlist';

    const playerVars: Record<string, unknown> = {
      playsinline: 1, controls: 1, rel: 0, modestbranding: 1,
      origin: window.location.origin,
    };

    if (isPlaylist && world?.music.type === 'youtube-playlist') {
      playerVars.listType = 'playlist';
      playerVars.list = world.music.playlistId;
    }

    const initialVideoId = (!isPlaylist && world?.music.type === 'tracks')
      ? (world.music.tracks[trackIndexRef.current]?.youtubeVideoId ?? '')
      : undefined;

    playerRef.current = new window.YT.Player(el, {
      width: 200, height: 112,
      ...(initialVideoId ? { videoId: initialVideoId } : {}),
      playerVars,
      events: {
        onReady: (e: YTEvent) => {
          setLoading(false);
          setReady(true);
          e.target.setVolume(mutedRef.current ? 0 : volumeRef.current);
          refreshTrackInfo();
          schedulePlaylistSync();
          if (pendingSelectRef.current !== null) {
            const idx = pendingSelectRef.current;
            pendingSelectRef.current = null;
            e.target.playVideoAt?.(idx);
            startAmbience();
            setPlaying(true);
          } else if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            e.target.playVideo();
            startAmbience();
            setPlaying(true);
          }
        },
        onStateChange: (e: YTEvent) => {
          // YT states: UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
          if (e.data === 1) {
            setPlaying(true); setBuffering(false);
            setAutoplayBlocked(false); setError(null);
            startAmbience(); startTimePolling(); refreshTrackInfo();
            musicFadeIn();
            void syncPlaylist();
          }
          if (e.data === 2) { setPlaying(false); stopTimePolling(); }
          if (e.data === 3) { setBuffering(true); }
          if (e.data === 0) {
            // track ended — advance
            const w = stationRef.current;
            if (!w || !playerRef.current) return;
            if (w.music.type === 'youtube-playlist') {
              playerRef.current.nextVideo?.();
            } else {
              const next = (trackIndexRef.current + 1) % w.music.tracks.length;
              playerRef.current.loadVideoById(w.music.tracks[next].youtubeVideoId);
              setTrackIndex(next); trackIndexRef.current = next;
              const t = w.music.tracks[next];
              setTrack({ title: t.title, artist: t.artist ?? '', youtubeVideoId: t.youtubeVideoId });
              playerRef.current.setVolume(mutedRef.current ? 0 : volumeRef.current);
              playerRef.current.playVideo();
            }
          }
          if (e.data === 5) { refreshTrackInfo(); void syncPlaylist(); }
        },
        onError: (e: YTEvent) => {
          setLoading(false); setBuffering(false); setPlaying(false);
          const msgs: Record<number, string> = {
            2: 'Invalid video.', 5: 'HTML5 player error.',
            100: 'Video not found.', 101: 'Embedding not allowed.', 150: 'Embedding not allowed.',
          };
          setError(msgs[e.data] ??'Playback error. Try next track.');
        },
        onAutoplayBlocked: () => {
          setAutoplayBlocked(true); setPlaying(false); setLoading(false);
          pendingPlayRef.current = false;
        },
      },
    });
  }, [musicFadeIn, refreshTrackInfo, schedulePlaylistSync, startAmbience, startTimePolling, stopTimePolling, syncPlaylist]);

  useEffect(() => {
    if (ytApiReady) createPlayer();
  }, [ytApiReady, createPlayer]);

  const handleYtScriptLoad = useCallback(() => {
    if (window.YT?.Player) { setYtApiReady(true); return; }
    window.onYouTubeIframeAPIReady = () => setYtApiReady(true);
  }, []);

  // ── Lazy init ─────────────────────────────────────────────────────────────

  const initPlayer = useCallback(() => {
    if (playerInitRef.current || scriptRequested) return;
    setScriptRequested(true);
    setLoading(true);
    if (window.YT?.Player) setYtApiReady(true);
  }, [scriptRequested]);

  // ── Persist preferences ───────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rang:radio') || '{}');
      if (typeof saved.volume === 'number') setVolumeState(clamp(saved.volume, 0, 100));
      if (typeof saved.muted === 'boolean') setMuted(saved.muted);
    } catch {}
    const timers = timersRef.current;
    const fades = fadesRef.current;
    return () => {
      clearMusicFades();
      stopTimePolling();
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
      removeWarmListener();
      playerRef.current?.destroy?.();
      stopAmbience(0);
      // Beds that were still fading out when we were torn down.
      fades.forEach((id, audio) => { window.clearInterval(id); releaseAudio(audio); });
      fades.clear();
      void audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('rang:radio', JSON.stringify({ volume, muted }));
    playerRef.current?.setVolume?.(muted ? 0 : volume);
    applyAmbienceVolume();
  }, [volume, muted, applyAmbienceVolume]);

  // ── World switching ───────────────────────────────────────────────────────

  const setStation = useCallback((world: WorldConfig) => {
    const same = stationRef.current?.slug === world.slug;
    setStationState(world);
    stationRef.current = world;
    if (same) {
      // Back in the world we left: the music never stopped, the room tone did.
      if (!ambienceRef.current.size && world.ambience.layers.length) {
        setupAmbience(world);
        if (playingRef.current) later(startAmbience, 80);
      }
      return;
    }

    setProgress(0); setCurrentTime(0); setDuration(0); setError(null);
    setupAmbience(world);
    if (playingRef.current) later(startAmbience, 80);

    if (!playerRef.current) {
      // Player not yet created — set up initial track info if tracks mode
      if (world.music.type === 'tracks') {
        let idx = 0;
        try { idx = Number(localStorage.getItem(`rang:radio:${world.slug}:track`) || 0); } catch {}
        idx = Number.isFinite(idx) ? idx % Math.max(1, world.music.tracks.length) : 0;
        setTrackIndex(idx); trackIndexRef.current = idx;
        const t = world.music.tracks[idx];
        if (t) setTrack({ title: t.title, artist: t.artist ?? '', youtubeVideoId: t.youtubeVideoId, artwork: t.artwork });
      } else {
        setTrack(null); setTrackIndex(0); trackIndexRef.current = 0;
        playlistIdsRef.current = []; setPlaylistItems([]);
      }
      return;
    }

    if (world.music.type === 'youtube-playlist') {
      setTrack(null); setTrackIndex(0); trackIndexRef.current = 0;
      playlistIdsRef.current = []; setPlaylistItems([]);
      const load = () => {
        // Whichever world is current by the time the fade-out finishes.
        const w = stationRef.current;
        if (!playerRef.current || w?.music.type !== 'youtube-playlist') return;
        playerRef.current.loadPlaylist?.({ listType: 'playlist', list: w.music.playlistId, index: 0, startSeconds: 0 });
        schedulePlaylistSync();
      };
      // Dip the old station out instead of cutting it; the PLAYING event
      // of the new one brings the volume back up.
      if (playingRef.current) musicFadeOut(load);
      else { clearMusicFades(); playerRef.current.setVolume?.(mutedRef.current ? 0 : volumeRef.current); load(); }
    } else {
      let idx = 0;
      try { idx = Number(localStorage.getItem(`rang:radio:${world.slug}:track`) || 0); } catch {}
      idx = Number.isFinite(idx) ? idx % Math.max(1, world.music.tracks.length) : 0;
      setTrackIndex(idx); trackIndexRef.current = idx;
      const t = world.music.tracks[idx];
      if (t) setTrack({ title: t.title, artist: t.artist ?? '', youtubeVideoId: t.youtubeVideoId, artwork: t.artwork });
      playerRef.current.loadVideoById(t?.youtubeVideoId ?? '');
      playerRef.current.setVolume?.(mutedRef.current ? 0 : volumeRef.current);
    }
  }, [clearMusicFades, later, musicFadeOut, schedulePlaylistSync, setupAmbience, startAmbience]);

  // ── Playback controls ─────────────────────────────────────────────────────

  const play = useCallback(async () => {
    if (!playerInitRef.current) {
      pendingPlayRef.current = true;
      initPlayer();
      return;
    }
    if (!playerRef.current) return;
    if (!fadeTimer.current && !upFadeTimer.current) playerRef.current.setVolume(mutedRef.current ? 0 : volumeRef.current);
    playerRef.current.playVideo();
    startAmbience();
    setPlaying(true);
    setAutoplayBlocked(false);
  }, [initPlayer, startAmbience]);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo?.();
    pauseAmbience();
    setPlaying(false);
    stopTimePolling();
  }, [pauseAmbience, stopTimePolling]);

  const toggle = useCallback(async () => { if (playingRef.current) pause(); else await play(); }, [pause, play]);

  // Crossfade for tracks mode; direct jump for playlist mode
  const crossfadeTo = useCallback((index: number) => {
    const world = stationRef.current;
    if (!playerRef.current || !world) return;
    if (world.music.type === 'youtube-playlist') {
      playerRef.current.playVideoAt?.(index);
      return;
    }
    if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
    if (upFadeTimer.current) { window.clearInterval(upFadeTimer.current); upFadeTimer.current = null; }
    const tracks = world.music.tracks; // captured before setInterval loses narrowing
    const nextIdx = ((index % tracks.length) + tracks.length) % tracks.length;
    if (!playingRef.current) {
      setTrackIndex(nextIdx); trackIndexRef.current = nextIdx;
      const t = tracks[nextIdx];
      if (t) setTrack({ title: t.title, artist: t.artist ?? '', youtubeVideoId: t.youtubeVideoId });
      playerRef.current.loadVideoById(t?.youtubeVideoId ?? '');
      return;
    }
    let v = mutedRef.current ? 0 : volumeRef.current;
    fadeTimer.current = window.setInterval(() => {
      v = Math.max(0, v - 10);
      playerRef.current?.setVolume?.(v);
      if (v <= 0) {
        if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
        setTrackIndex(nextIdx); trackIndexRef.current = nextIdx;
        const t = tracks[nextIdx];
        if (t) setTrack({ title: t.title, artist: t.artist ?? '', youtubeVideoId: t.youtubeVideoId });
        playerRef.current.loadVideoById(t?.youtubeVideoId ?? '');
        playerRef.current.setVolume?.(0);
        playerRef.current.playVideo?.();
        let up = 0;
        upFadeTimer.current = window.setInterval(() => {
          up = Math.min(mutedRef.current ? 0 : volumeRef.current, up + 10);
          playerRef.current?.setVolume?.(up);
          if (up >= (mutedRef.current ? 0 : volumeRef.current)) {
            if (upFadeTimer.current) { window.clearInterval(upFadeTimer.current); upFadeTimer.current = null; }
          }
        }, 45);
      }
    }, 45);
  }, []);

  const next = useCallback(() => {
    const world = stationRef.current;
    if (!playerRef.current || !world) return;
    if (world.music.type === 'youtube-playlist') { playerRef.current.nextVideo?.(); }
    else { crossfadeTo(trackIndexRef.current + 1); }
  }, [crossfadeTo]);

  const previous = useCallback(() => {
    const world = stationRef.current;
    if (!playerRef.current || !world) return;
    if (world.music.type === 'youtube-playlist') { playerRef.current.previousVideo?.(); }
    else { crossfadeTo(trackIndexRef.current - 1); }
  }, [crossfadeTo]);

  const select = useCallback((index: number) => {
    // Picking a song from the list is also a request to play it.
    if (!playerInitRef.current || !playerRef.current) {
      pendingSelectRef.current = index;
      initPlayer();
      return;
    }
    const world = stationRef.current;
    if (world?.music.type === 'youtube-playlist') {
      playerRef.current.setVolume?.(mutedRef.current ? 0 : volumeRef.current);
      playerRef.current.playVideoAt?.(index);
      setTrackIndex(index); trackIndexRef.current = index;
      startAmbience();
      setPlaying(true);
      setAutoplayBlocked(false);
      return;
    }
    crossfadeTo(index);
    if (!playingRef.current) void play();
  }, [crossfadeTo, initPlayer, play, startAmbience]);

  const seek = useCallback((seconds: number) => {
    const p = playerRef.current;
    if (!p?.seekTo) return;
    let d = duration;
    try { d = p.getDuration?.() || duration; } catch {}
    if (!(d > 0)) return;
    const t = clamp(seconds, 0, d);
    p.seekTo(t, true);
    setCurrentTime(t);
    setProgress((t / d) * 100);
  }, [duration]);

  const setVolume = useCallback((value: number) => setVolumeState(clamp(value, 0, 100)), []);
  useEffect(() => { applyAmbienceVolume(); }, [volume, muted, applyAmbienceVolume]);
  const toggleMute = useCallback(() => setMuted(v => !v), []);

  // Persist track index for tracks-mode worlds
  useEffect(() => {
    if (station?.music.type === 'tracks') {
      localStorage.setItem(`rang:radio:${station.slug}:track`, String(trackIndex));
    }
  }, [station, trackIndex]);

  // ── SFX / Audio cues ──────────────────────────────────────────────────────

  // One AudioContext for every chime. It is created on the first cue (always
  // inside a user gesture), suspended while silent and closed on unmount.
  const chime = useCallback((o: {
    freqs: readonly number[]; step: number; wave: (i: number) => OscillatorType;
    peak: number; noteTail: number; stopAfter: number; level: number; tail: number;
  }) => {
    if (typeof window === 'undefined' || mutedRef.current || o.level <= 0) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx: AudioContext = (audioCtxRef.current ??= new AudioCtx());
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime + 0.02;
      const master = ctx.createGain();
      master.gain.setValueAtTime(o.level, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + o.tail);
      master.connect(ctx.destination);

      let live = o.freqs.length;
      chimesRef.current++;
      o.freqs.forEach((freq, i) => {
        const at = now + i * o.step;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = o.wave(i);
        osc.frequency.setValueAtTime(freq, at);
        // Every note starts and ends at silence, so nothing clicks.
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(o.peak, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + o.noteTail);
        osc.connect(gain); gain.connect(master);
        osc.onended = () => {
          osc.disconnect(); gain.disconnect();
          if (--live > 0) return;
          master.disconnect();
          if (--chimesRef.current === 0 && audioCtxRef.current === ctx) void ctx.suspend().catch(() => undefined);
        };
        osc.start(at); osc.stop(now + o.stopAfter);
      });
    } catch {}
  }, []);

  const playLogo = useCallback(() => {
    chime({
      freqs: [261.63, 329.63, 392.0, 523.25], step: 0.055, wave: i => (i === 3 ? 'triangle' : 'sine'),
      peak: 0.55, noteTail: 0.9, stopAfter: 1.05, level: Math.min(0.09, volumeRef.current / 1000), tail: 1.15,
    });
  }, [chime]);

  const playSfx = useCallback((id: string) => {
    const audio = ambienceRef.current.get(id);
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = layerVolume(id);
    void audio.play().catch(() => undefined);
  }, [layerVolume]);

  const playCue = useCallback((cue: 'discover' | 'moment' | 'secret') => {
    const patterns = { discover: [392, 523.25], moment: [329.63, 392, 493.88], secret: [523.25, 659.25, 783.99, 1046.5] } as const;
    const secret = cue === 'secret';
    chime({
      freqs: patterns[cue], step: 0.09, wave: () => (secret ? 'triangle' : 'sine'),
      peak: 0.35, noteTail: secret ? 1.05 : 0.55, stopAfter: secret ? 1.25 : 0.8,
      level: Math.min(0.055, volumeRef.current / 1500), tail: secret ? 1.4 : 0.8,
    });
  }, [chime]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <RadioContext.Provider value={{
      ready, loading, buffering, error, autoplayBlocked,
      playing, trackIndex, progress, duration, currentTime,
      volume, muted, track, station, ambienceReady,
      playlistItems, playlistLoading,
      setStation, initPlayer, play, pause, toggle,
      next, previous, select, seek, setVolume, toggleMute, crossfadeTo,
      leaveWorld, playSfx, playLogo, playCue,
    }}>
      {children}
      {scriptRequested && (
        <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive" onLoad={handleYtScriptLoad} />
      )}
      <div className="globalRadioDock" aria-hidden="true">
        <div id="rang-global-youtube" />
        {station && (
          <div className="dockLabel">
            <span>RANG FM</span>
            <b>{playing ? 'LIVE' : loading ? 'LOADING' : buffering ? 'BUFFERING' : 'PAUSED'}</b>
          </div>
        )}
      </div>
    </RadioContext.Provider>
  );
}

// fmt is exported for use in WorldExperience
export { fmt as formatPlayerTime };

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside RadioProvider');
  return ctx;
}
