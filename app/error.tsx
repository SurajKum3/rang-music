'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="app notFoundPage">
      <div className="notFoundCard">
        <div className="identityMark"><span>R</span><b>RANG</b><small>1.0</small></div>
        <p className="eyebrow">RADIO STATIC</p>
        <h1>THE SIGNAL DROPPED.</h1>
        <p>Give it another second, then tune back in.</p>
        <div className="errorActions">
          <button className="primaryButton" onClick={() => reset()}>TUNE BACK IN →</button>
          {/* A full page load on purpose: it throws away whatever state crashed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="secondaryButton" href="/">GO HOME</a>
        </div>
      </div>
    </main>
  );
}
