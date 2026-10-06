'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { worlds } from '@/worlds';
import type { WorldConfig } from '@/engine/world/types';
import { useRadio } from '@/engine/audio/RadioProvider';
import WorldImage from '@/components/world/WorldImage';
import s from './home.module.css';

const moods: { label: string; filter: (w: WorldConfig) => boolean }[] = [
  { label: 'ALL',        filter: () => true },
  { label: 'LATE NIGHT', filter: (w) => w.theme.mood === 'LATE NIGHT' },
  { label: 'RAINY',      filter: (w) => w.theme.mood === 'RAINY' },
  { label: 'CITY',       filter: (w) => w.theme.mood === 'CITY' },
];

// Staggered entrance, done in CSS so the hero is readable before hydration.
const step = (i: number) => ({ '--i': i }) as React.CSSProperties;

export default function Home() {
  const radio = useRadio();
  const [mood, setMood] = useState('ALL');
  const [lastWorld, setLastWorld] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rang:last-world');
    if (saved) setLastWorld(saved);
  }, []);

  const filtered = useMemo(
    () => worlds.filter(moods.find((m) => m.label === mood)?.filter ?? (() => true)),
    [mood],
  );
  const featured = worlds.find((w) => w.slug === lastWorld) ?? worlds[0];
  const remember = (slug: string) => localStorage.setItem('rang:last-world', slug);
  // A couple of worlds use their title as the location — don't print it twice.
  const stamp = (w: WorldConfig) => (w.location === w.title ? w.time : `${w.location} · ${w.time}`);

  // One pass of the ticker, duplicated so the marquee loops seamlessly.
  const tickerRun = (
    <span>
      {worlds.map((w) => (
        <span key={w.slug}>
          <b>{w.title}</b> <i>·</i> {stamp(w)}
        </span>
      ))}
    </span>
  );

  return (
    <main className={s.page}>
      <div className={s.ambient} aria-hidden="true"><i /><i /><i /></div>
      <div className={s.grain} aria-hidden="true" />

      <div className={s.shell}>
        <header className={s.top}>
          <Link href="/" className={s.wordmark}>RAN<span>G</span></Link>
          <span className={s.tagline}>MUSIC YOU CAN ENTER</span>
          <div className={s.onAir} data-live={radio.playing}>
            <i /> <b>{radio.playing ? 'ON AIR' : 'STANDBY'}</b>
          </div>
        </header>

        <section className={s.hero}>
          {featured.heroImage && (
            <div className={s.heroMedia} aria-hidden="true">
              <WorldImage
                slug={featured.slug}
                kind="hero"
                alt=""
                priority
                sizes="(max-width: 760px) 100vw, 1240px"
                focus={featured.heroFocus ?? '50% 45%'}
              />
            </div>
          )}
          <div className={s.heroVeil} aria-hidden="true" />
          <div className={s.heroSweep} aria-hidden="true" />

          <div className={s.heroInner}>
            <p className={`${s.eyebrow} ${s.rise}`} style={step(0)}>
              FIVE WORLDS · ONE RADIO · BETA
            </p>
            <h1 className={s.rise} style={step(1)}>
              Where are you<br /><em>listening from?</em>
            </h1>
            <p className={`${s.lede} ${s.rise}`} style={step(2)}>
              Not a playlist — a place. Pick one, put your headphones on, and stay for a song.
            </p>
            <div className={`${s.ctaRow} ${s.rise}`} style={step(3)}>
              <Link href={`/${featured.slug}`} className={s.primaryCta} onClick={() => remember(featured.slug)}>
                {lastWorld ? 'Back to' : 'Start with'} {featured.title}
                <small>ENTER →</small>
              </Link>
              <a href="#worlds" className={s.ghostCta}>Browse all {worlds.length} worlds ↓</a>
            </div>
          </div>

          <div className={s.heroBadge}>
            <small>{lastWorld ? 'CONTINUE LISTENING' : 'NOW FEATURING'}</small>
            <b>{featured.title}</b>
            <span>{stamp(featured)}</span>
          </div>
        </section>

        <div className={s.ticker} aria-hidden="true">
          <div className={s.tickerTrack}>{tickerRun}{tickerRun}</div>
        </div>
      </div>

      <section className={s.shelf} id="worlds">
        <div className={s.shelfHead}>
          <div>
            <p className={s.eyebrow}>CHOOSE A PLACE</p>
            <h2>Tonight&rsquo;s worlds</h2>
            <p>Every world has its own sound, its own hour, its own weather.</p>
          </div>
          <div className={s.chips}>
            {moods.map((m) => (
              <button key={m.label} data-active={mood === m.label} onClick={() => setMood(m.label)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.grid}>
          {filtered.map((w, i) => (
            <motion.div
              key={w.slug}
              layout
              className={`${s.cell} ${s.rise} ${i === 0 && filtered.length >= 4 ? s.wide : ''}`}
              style={{ '--card-accent': w.theme.accent, '--i': i } as React.CSSProperties}
            >
              <Link href={`/${w.slug}`} className={s.card} onClick={() => remember(w.slug)}>
                <div className={s.media}>
                  {w.heroImage && (
                    <WorldImage
                      slug={w.slug}
                      kind="card"
                      alt={`${w.title} — ${w.location}`}
                      sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 420px"
                      focus={w.heroFocus}
                    />
                  )}
                  <span className={s.mediaTint} />
                  <span className={s.mediaShade} />
                  <span className={s.moodChip}><i />{w.theme.mood}</span>
                </div>
                <div className={s.body}>
                  <span className={s.kicker}>{w.slug === lastWorld ? 'PICK UP WHERE YOU LEFT OFF' : 'FEATURED WORLD'}</span>
                  <h3>{w.title}</h3>
                  <p>{w.subtitle}</p>
                  <p className={s.blurb}>{w.description}</p>
                  <div className={s.foot}>
                    <span>{stamp(w)}</span>
                    <span className={s.go}>→</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className={s.foot2}>
        <span>ONE RADIO · MANY PLACES</span>
        <span><b>BETA</b> · 2026</span>
      </footer>
    </main>
  );
}
