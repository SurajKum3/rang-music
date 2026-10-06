'use client';

import { useEffect, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';
import { getVisitorId } from './visitor';

// Presence syncs arrive once per join/leave; in a busy world that is far
// more often than the header needs to repaint.
const MIN_UPDATE_MS = 2000;

export const presenceChannel = (slug: string) => `rang:world:${slug}`;

/**
 * Live head-count for one world, or null while presence is unavailable
 * (not configured, still connecting, offline, or errored). Never throws and
 * never suspends — the caller renders its fallback until a number shows up.
 */
export function useWorldPresence(slug: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(null);
    if (!supabaseConfigured) return;

    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let leaving: Promise<unknown> | null = null;
    let generation = 0;
    let timer: number | undefined;
    let lastUpdate = 0;

    const publish = () => {
      timer = undefined;
      if (!channel) return;
      lastUpdate = Date.now();
      // One presence key per visitor, so extra tabs collapse into one entry.
      const total = Object.keys(channel.presenceState()).length;
      setCount(total > 0 ? total : null);
    };

    const onSync = () => {
      if (timer !== undefined) return;
      const wait = MIN_UPDATE_MS - (Date.now() - lastUpdate);
      if (wait <= 0) publish();
      else timer = window.setTimeout(publish, wait);
    };

    const join = async () => {
      if (channel) return;
      const mine = ++generation;
      try {
        client = await getSupabase();
        // A channel still unsubscribing would be handed back by the client
        // under the same topic, so let the previous leave finish first.
        if (leaving) await leaving;
        if (!client || mine !== generation) return;

        const next = client.channel(presenceChannel(slug), { config: { presence: { key: getVisitorId() } } });
        channel = next;
        next
          .on('presence', { event: 'sync' }, onSync)
          .subscribe(status => {
            if (channel !== next) return;
            // Fires again after every reconnect, which re-announces us.
            if (status === 'SUBSCRIBED') void next.track({ world: slug }).catch(() => {});
            else setCount(null);
          });
      } catch {
        setCount(null);
      }
    };

    const leave = () => {
      generation++;
      window.clearTimeout(timer);
      timer = undefined;
      const old = channel;
      channel = null;
      if (!old || !client) return;
      const c = client;
      const done: Promise<unknown> = old.untrack().catch(() => {}).then(() => c.removeChannel(old)).catch(() => {});
      leaving = done;
      void done.then(() => { if (leaving === done) leaving = null; });
    };

    const onPageHide = () => leave();
    // Restored from the back/forward cache: the socket is gone, rejoin.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) void join(); };
    // The socket takes a while to notice a dropped network; stop showing a
    // stale number straight away. Realtime rejoins by itself once back online.
    const onOffline = () => setCount(null);
    // A short blip may never drop the socket, so no fresh sync would arrive.
    const onOnline = () => onSync();

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    void join();

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      leave();
    };
  }, [slug]);

  return count;
}
