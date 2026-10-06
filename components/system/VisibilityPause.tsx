'use client';

import { useEffect } from 'react';

/**
 * Marks <html> while the tab is in the background so globals.css can pause
 * every CSS animation (`html[data-tab-hidden]`). Renders nothing.
 */
export default function VisibilityPause() {
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-tab-hidden', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return null;
}
