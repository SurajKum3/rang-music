'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { WorldConfig, HotspotAction } from '@/engine/world/types';
import { useRadio, formatPlayerTime } from '@/engine/audio/RadioProvider';
import { worlds } from '@/worlds';
import { useWorldPresence } from '@/lib/presence/useWorldPresence';
import WorldImage, { coverSizes } from './WorldImage';

const clamp = (v:number,min:number,max:number) => Math.min(max, Math.max(min,v));
const storageKey = (world: WorldConfig) => `rang:world:${world.slug}`;
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
type SavedState = { meter: number; soundOn: boolean; ambientFocus: boolean };

export default function WorldExperience({ world, onExit }: { world: WorldConfig; onExit: () => void }) {
  const router = useRouter();
  const radio = useRadio();
  const [saved] = useState<SavedState>(() => {
    if (typeof window === 'undefined') return { meter: 87, soundOn: true, ambientFocus: false };
    try { return { meter: 87, soundOn: true, ambientFocus: false, ...JSON.parse(sessionStorage.getItem(storageKey(world)) || '{}') }; } catch { return { meter: 87, soundOn: true, ambientFocus: false }; }
  });
  const [meter, setMeter] = useState(saved.meter);
  const [dialogue, setDialogue] = useState<string|null>(null);
  const [radioOpen, setRadioOpen] = useState(false);
  const radioOpenRef = useRef(false);
  const [mirror, setMirror] = useState(false);
  const [soundOn, setSoundOn] = useState(saved.soundOn);
  const [pulse, setPulse] = useState(false);
  const online = useWorldPresence(world.slug);
  const [ambientFocus, setAmbientFocus] = useState(saved.ambientFocus);
  const [shareOpen, setShareOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [burst, setBurst] = useState<HotspotAction | null>(null);
  const [entry, setEntry] = useState<'intro'|'ready'|'entered'>('intro');
  const cursorRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const [actionText, setActionText] = useState<string | null>(null);
  const [focusPulse, setFocusPulse] = useState(false);
  const [momentsFound, setMomentsFound] = useState<string[]>([]);
  const [actorPulse, setActorPulse] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  // Seeded with the world's own time so server and client render the same
  // markup; the real clock takes over in the effect below.
  const [realTime, setRealTime] = useState(world.time);

  const track = radio.track;
  const eyebrowLocation = world.metadata.eyebrow.split(' • ')[0];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // The provider's actions are stable; the radio object itself changes every tick.
  const { setStation, leaveWorld, play, pause, playCue, playLogo } = radio;
  const saveKey = storageKey(world);
  useEffect(() => { setStation(world); }, [setStation, world]);
  useEffect(() => { sessionStorage.setItem(saveKey, JSON.stringify({ meter, soundOn, ambientFocus })); }, [saveKey, meter, soundOn, ambientFocus]);
  useEffect(() => { localStorage.setItem('rang:last-world', world.slug); }, [world.slug]);
  useEffect(() => {
    const update = () => setRealTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    setEntry('intro');
    setMomentsFound([]);
    setSecretOpen(false);
    const timer = window.setTimeout(() => setEntry('ready'), 1450);
    return () => window.clearTimeout(timer);
  }, [world.slug]);

  useEffect(() => { radioOpenRef.current = radioOpen; }, [radioOpen]);

  // setTimeout that dies with the world, so nothing fires after you leave it.
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(id => window.clearTimeout(id)); timers.clear(); };
  }, []);
  // The room tone belongs to the room; the radio follows you out.
  useEffect(() => () => leaveWorld(), [leaveWorld]);

  const show = useCallback((text:string, ms=1600) => { setDialogue(text); later(()=>setDialogue(null),ms); }, [later]);
  const flash = useCallback((action: HotspotAction) => { setBurst(action); later(()=>setBurst(null),850); }, [later]);
  const announce = useCallback((text:string, ms=1050) => { setActionText(text); later(()=>setActionText(null), ms); }, [later]);
  const toggle = useCallback(async () => { if(radio.playing) pause(); else await play(); }, [play, pause, radio.playing]);

  // Opening the queue also boots the player, so the song list can load
  // before anything is playing.
  const openQueue = useCallback((open?: boolean) => {
    const next = open ?? !radioOpenRef.current;
    setRadioOpen(next);
    if (next && !radio.ready && !radio.loading) radio.initPlayer();
  }, [radio]);

  const enterWorld = useCallback(() => {
    setEntry('entered');
    playLogo();
    playCue('discover');
    announce(`${world.title} • LIVE`, 1200);
    if (!radio.playing && !radio.ready && !radio.loading) {
      show('TAP ▶ TO TURN ON RANG FM', 2000);
    } else if (!radio.playing) {
      show('PRESS PLAY WHEN YOU’RE READY', 1500);
    }
  }, [announce, playCue, radio.playing, playLogo, radio.ready, radio.loading, show, world.title]);

  const triggerMoment = useCallback((trigger: HotspotAction | 'entry' | 'listen') => {
    const next = world.moments.find(m => m.trigger === trigger && !momentsFound.includes(m.id));
    if (!next) return false;
    setMomentsFound(found => [...found, next.id]);
    playCue('moment');
    announce(next.label, 1150);
    show(next.text, 2800);
    setActorPulse(true);
    later(() => setActorPulse(false), 1000);
    if (momentsFound.length + 1 === world.moments.length) {
      later(() => { setSecretOpen(true); playCue('secret'); announce('SECRET FOUND', 1600); }, 1050);
    }
    return true;
  }, [announce, later, momentsFound, playCue, show, world.moments]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    // Moved straight on the element, once per frame: no re-render, no layout.
    let frame = 0, x = 0, y = 0;
    const paint = () => {
      frame = 0;
      const el = cursorRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      el.classList.add('active');
    };
    const move = (e: MouseEvent) => { x = e.clientX; y = e.clientY; if (!frame) frame = requestAnimationFrame(paint); };
    window.addEventListener('mousemove', move, {passive:true});
    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(frame); };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' '){ e.preventDefault(); void toggle(); }
      if (e.key.toLowerCase() === 'n') radio.next();
      if (e.key.toLowerCase() === 'p') radio.previous();
      if (e.key.toLowerCase() === 'r') openQueue();
      if (e.key.toLowerCase() === 'm') { setSoundOn(v=>!v); radio.toggleMute(); }
      if (e.key === 'Escape') { setSwitcherOpen(false); setShareOpen(false); setRadioOpen(false); setMirror(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [openQueue, radio, toggle]);

  // Swipe left/right to change world. Deliberately strict: it must start on
  // the scene itself (not a control, slider or open panel), stay away from the
  // screen edges the OS uses for back/forward, and be clearly horizontal.
  useEffect(() => {
    let startX = 0, startY = 0, armed = false;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as Element | null;
      armed = e.touches.length === 1 && !!t
        && t.clientX > 28 && t.clientX < window.innerWidth - 28
        && !target?.closest('button, a, input, [role="slider"], .player, .volume, .radioPanel, .switcherOverlay, .shareCardOverlay, .entryOverlay, .mirrorOverlay, .secretOverlay');
      if (t) { startX = t.clientX; startY = t.clientY; }
    };
    const up = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const idx = worlds.findIndex(w => w.slug === world.slug);
      const next = worlds[(idx + (dx < 0 ? 1 : -1) + worlds.length) % worlds.length];
      if (next) router.push(`/${next.slug}`);
    };
    const cancel = () => { armed = false; };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [router, world.slug]);

  const action = (kind: HotspotAction) => {
    flash(kind);
    if(kind==='mirror') { setMirror(v=>!v); triggerMoment('mirror'); }
    if(kind==='driver'){ show(pick(world.interactions.dialogue),2200); announce(world.interactions.signature); triggerMoment('driver'); }
    if(kind==='meter') { setMeter(v=>v+1); show(world.interactions.meterLabel ?? 'meter + ₹1',1300); triggerMoment('meter'); }
    if(kind==='radio') { openQueue(); announce('RANG FM'); }
    if(kind==='horn'){ radio.playSfx('horn'); void radio.play(); setPulse(true); announce(world.interactions.signature, 900); show(world.interactions.signature,1100); triggerMoment('horn'); later(()=>setPulse(false),1100); }
    if(kind==='ambient'){ setAmbientFocus(v=>!v); setFocusPulse(true); announce(ambientFocus ? 'BACK TO THE CITY' : 'LISTEN CLOSER'); show(world.description,1800); triggerMoment('ambient'); later(()=>setFocusPulse(false),1100); }
  };

  const seekFromClientX = useCallback((el: HTMLElement, clientX: number) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || radio.duration <= 0) return;
    radio.seek(((clamp(clientX - rect.left, 0, rect.width)) / rect.width) * radio.duration);
  }, [radio]);

  const onScrubDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (radio.duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekFromClientX(e.currentTarget, e.clientX);
  }, [radio.duration, seekFromClientX]);

  const onScrubMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    seekFromClientX(e.currentTarget, e.clientX);
  }, [scrubbing, seekFromClientX]);

  const onScrubUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setScrubbing(false);
  }, [scrubbing]);

  const onScrubKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (radio.duration <= 0) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === 'ArrowRight') { e.preventDefault(); radio.seek(radio.currentTime + step); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); radio.seek(radio.currentTime - step); }
    if (e.key === 'Home') { e.preventDefault(); radio.seek(0); }
    if (e.key === 'End') { e.preventDefault(); radio.seek(radio.duration - 1); }
  }, [radio]);

  const share = async () => {
    const url = window.location.href;
    try { if(navigator.share) await navigator.share({title:`${world.title} — RANG`,text:world.subtitle,url}); else { await navigator.clipboard.writeText(url); show('LINK COPIED',1200); } }
    catch { /* user dismissed share */ }
  };

  const currentTimeStr = formatPlayerTime(radio.currentTime);
  const durationStr = radio.duration > 0 ? formatPlayerTime(radio.duration) : '--:--';
  const energy = radio.playing ? (Math.sin(radio.progress * 0.4) + 1) / 2 : 0.08;

  // Status message shown in player area
  const playerStatus = useMemo(() => {
    if (radio.error) return radio.error;
    if (radio.autoplayBlocked) return 'TAP ▶ TO PLAY';
    if (radio.loading) return 'LOADING RANG FM…';
    if (radio.buffering) return 'BUFFERING…';
    if (!radio.ready && !radio.loading) return null; // show tune-in button
    return null;
  }, [radio.error, radio.autoplayBlocked, radio.loading, radio.buffering, radio.ready]);

  const musicTitle = world.music.type === 'youtube-playlist' ? world.music.title : world.title;
  const songCount = world.music.type === 'youtube-playlist' ? radio.playlistItems.length : world.music.tracks.length;

  return <main className={`app world${entry !== 'entered' ? ' entry-state' : ''}`} style={{'--accent':world.theme.accent,'--energy':energy} as React.CSSProperties}>
    <div className={`worldScene ${world.theme.sceneClass} ${radio.playing?'isPlaying':''} ${pulse?'hornPulse':''} ${ambientFocus?'ambientFocus':''} ${burst?`event-${burst}`:''}`}>
      {!prefersReducedMotion && <div ref={cursorRef} className="rangCursor" aria-hidden="true"><span/></div>}
      <div className={`worldGrain ${focusPulse?'focusPulse':''}`} aria-hidden="true"/>
      <div className="lightSweep" aria-hidden="true"/>
      {world.heroImage && <div className="sceneArt" aria-hidden="true"><WorldImage slug={world.slug} kind="hero" alt="" priority sizes={coverSizes(world.slug)}/></div>}
      <div className="sceneLayer sceneLayerOne"/><div className="sceneLayer sceneLayerTwo"/>
      <div className="sceneVignette"/><div className="colorGrade" aria-hidden="true"/><div className="rainOverlay"/><div className="trafficGlow"/>
      <div className="soundWave" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="ambientParticles" aria-hidden="true">{Array.from({length:prefersReducedMotion?6:24},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
      <div className="sceneStamp">{world.metadata.emoji} {world.title}</div>
      {entry==='entered' && !!world.character.label && <div className={`actorPresence ${actorPulse?'actorPulse':''} ${world.character.position}`}><span className="actorOrb"/><b>{world.character.label}</b></div>}
      {entry==='entered' && world.moments.length > 0 && <div className="momentRail"><span>MOMENTS</span>{world.moments.map(m=><i key={m.id} className={momentsFound.includes(m.id)?'found':''} title={momentsFound.includes(m.id)?m.label:'undiscovered moment'}/>)}</div>}
      {entry==='entered' && world.interactions.hotspots.map(h=><button key={h.id} className={`hotspot ${h.position}`} onClick={()=>action(h.action)}><span>{h.icon}</span>{h.label}{h.action==='meter'&&<b>₹{String(meter).padStart(3,'0')}</b>}</button>)}
      <AnimatePresence>{mirror&&<motion.div className="mirrorOverlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><div className="mirrorStory"><small>{world.location} • {realTime}</small><strong>{world.interactions.hotspots.find(h=>h.action==='mirror')?.detail ?? 'the city keeps moving.'}</strong><button onClick={()=>setMirror(false)}>BACK TO THE WORLD</button></div></motion.div>}</AnimatePresence>
      <AnimatePresence>{secretOpen&&<motion.div className="secretOverlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="secretCard" initial={{y:18,scale:.96}} animate={{y:0,scale:1}}><span className="secretKicker">EASTER EGG • {world.metadata.easterEgg.label}</span><div className="secretSeal">✦</div><h3>{world.metadata.easterEgg.text}</h3><p>You found the hidden detail in {world.title}.</p><button onClick={()=>setSecretOpen(false)}>KEEP LISTENING</button></motion.div></motion.div>} </AnimatePresence>
      <AnimatePresence>{entry!=='entered'&&<motion.div className="entryOverlay" initial={{opacity:1}} exit={{opacity:0}}><div className="entryBackdrop"/><div className="entryCardLarge"><span className="entryLogo">RANG</span><small>{world.location} • {realTime}</small><div className="entryEmoji">{world.metadata.emoji}</div><h1>{world.title}</h1><p>{entry==='intro' ? world.interactions.entryText : world.subtitle}</p><div className="entryProgress"><i className={entry==='ready'?'done':''}/></div>{/* Always in the layout, so the card doesn't jump when it appears. */}<button className="enterButton" onClick={enterWorld} disabled={entry!=='ready'} aria-hidden={entry!=='ready'} style={{opacity:entry==='ready'?1:0,transition:'opacity .35s ease'}}>ENTER WORLD <span>→</span></button><span className="entryHint">MUSIC YOU CAN ENTER</span></div></motion.div>}</AnimatePresence>
    </div>

    <div className="worldHUD"><header className="worldTop"><button className="logo mini" onClick={onExit}>RANG</button><button className="locationPill" aria-label={`${world.title} — switch world`} onClick={()=>setSwitcherOpen(true)}>{world.metadata.emoji} {world.title}⌄</button><div className="worldStatus"><span className="liveDot">●</span> {online === null ? 'RANG FM LIVE' : `${online.toLocaleString('en-IN')} ${world.metadata.presenceLabel ?? 'listening'}`} <span className="time">• {realTime}</span></div><button className="share" aria-label="Share this world" onClick={()=>setShareOpen(true)}>↗</button></header>
      <div className="worldTitle"><span>{eyebrowLocation} • {realTime}</span><h2>{world.title}</h2><p>{world.subtitle}</p></div>
      <AnimatePresence>{dialogue&&<motion.div className="bubble" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}>{dialogue}</motion.div>}</AnimatePresence>
      <AnimatePresence>{actionText&&<motion.div className="actionTicker" initial={{opacity:0,y:10,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6}}>{actionText}</motion.div>}</AnimatePresence>
      <div className="player">
        <div className="trackThumb">{world.metadata.emoji}</div>
        <div className="track">
          <b>{track?.title ?? (radio.loading ? 'Loading…' : musicTitle)}</b>
          <span>{track?.artist ?? (world.music.type === 'youtube-playlist' ? 'RANG FM PLAYLIST' : '')}</span>
        </div>
        <button className="playerControl" onClick={()=>radio.previous()} title="Previous (P)" aria-label="Previous song">|◀</button>
        <button className="playButton" onClick={()=>void toggle()} title="Play/Pause (Space)" aria-label={radio.playing ? 'Pause' : 'Play'}>
          {radio.playing ? '❚❚' : radio.loading ? '…' : '▶'}
        </button>
        <button className="playerControl" onClick={()=>radio.next()} title="Next (N)" aria-label="Next song">▶|</button>
        <button className="playerControl" onClick={()=>openQueue()} title="Song list (R)" aria-label="Song list">☰</button>
        <button className="playerControl" aria-label={soundOn&&!radio.muted?'Mute':'Unmute'} onClick={()=>{setSoundOn(v=>!v);radio.toggleMute()}}>{soundOn&&!radio.muted?'\u{1F50A}':'\u{1F507}'}</button>
        <div
          className={`progress${radio.duration>0?' seekable':''}${scrubbing?' scrubbing':''}`}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.floor(radio.duration))}
          aria-valuenow={Math.floor(radio.currentTime)}
          aria-valuetext={`${currentTimeStr} of ${durationStr}`}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          onKeyDown={onScrubKey}
        ><i style={{width:`${radio.progress}%`}}/></div>
        <div className="timeRow"><span>{currentTimeStr}</span><span>{durationStr}</span></div>
      </div>
      <div className="volume"><span>VOL</span><input type="range" aria-label="Volume" min="0" max="100" value={radio.volume} onChange={e=>radio.setVolume(Number(e.target.value))}/></div>

      {/* Tune-in CTA — shown before player is initialized */}
      {!radio.ready && !radio.loading && !radio.error && !radio.autoplayBlocked && (
        <button className="soundPrompt tuneIn" onClick={()=>{ radio.initPlayer(); void radio.play(); }}>
          ♪ TURN ON RANG FM
        </button>
      )}
      {playerStatus && (
        <div className={`soundPrompt${radio.error ? ' error' : ''}`}>
          {playerStatus}
          {radio.error && <button onClick={()=>radio.next()} style={{marginLeft:'0.5em'}}>SKIP →</button>}
        </div>
      )}

      <AnimatePresence>{radioOpen&&<motion.aside className="radioPanel" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}>
        <div className="panelHeader"><small>RANG FM • {world.music.type === 'youtube-playlist' ? 'PLAYLIST' : 'CROSSFADE ON'}</small><button onClick={()=>setRadioOpen(false)}>×</button></div>
        <h3>{realTime} • {world.title}</h3>
        <p>Listening from {world.location}</p>
        {world.music.type === 'tracks' ? (
          <div className="radioList trackScroll">
            {world.music.tracks.map((t,i)=>(
              <button key={t.youtubeVideoId+i} className={i===radio.trackIndex?'selected':''} onClick={()=>radio.select(i)}>
                <span>{String(i+1).padStart(2,'0')}</span>
                <div><b>{t.title}</b><small>{t.artist}</small></div>
                <i>{i===radio.trackIndex&&radio.playing?'▶':'↗'}</i>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="playlistInfo">
              <div className="playlistName">{world.music.title}</div>
              {track && <div className="nowPlaying"><small>NOW PLAYING</small><b>{track.title}</b><span>{track.artist}</span></div>}
            </div>
            <div className="listHeader">
              <small>ALL SONGS{songCount ? ` • ${songCount}` : ''}</small>
              {radio.playlistLoading && <em>loading titles…</em>}
            </div>
            <div className="radioList trackScroll">
              {radio.playlistItems.map((t,i)=>(
                <button key={t.videoId+i} className={i===radio.trackIndex?'selected':''} onClick={()=>radio.select(i)}>
                  <span>{String(i+1).padStart(2,'0')}</span>
                  <div><b>{t.title || `Track ${i+1}`}</b><small>{t.artist || 'RANG FM'}</small></div>
                  <i>{i===radio.trackIndex&&radio.playing?'▶':'↗'}</i>
                </button>
              ))}
              {!radio.playlistItems.length && (
                <p className="listNote">
                  {radio.error ? radio.error
                    : radio.loading || radio.playlistLoading ? 'Tuning in…'
                    : 'Turn on RANG FM to load tonight’s songs.'}
                </p>
              )}
            </div>
          </>
        )}
        <div className="radioActions">
          <button onClick={()=>void radio.play()}>PLAY</button>
          <button onClick={()=>radio.previous()}>◀ PREV</button>
          <button onClick={()=>radio.next()}>NEXT ▶</button>
          <button onClick={()=>setShareOpen(true)}>SHARE WORLD</button>
        </div>
        <div className="sourceNote">Music plays via YouTube. Only use officially licensed recordings.</div>
      </motion.aside>}</AnimatePresence>

      <AnimatePresence>{switcherOpen&&<motion.div className="switcherOverlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.aside className="switcherPanel" initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',stiffness:280,damping:28}}><div className="panelHeader"><small>RANG WORLDS • {worlds.length} LIVE</small><button onClick={()=>setSwitcherOpen(false)}>×</button></div><h3>Where next?</h3><p>Keep the radio playing. Change the place.</p><div className="switcherList">{worlds.map(w=><button key={w.slug} className={w.slug===world.slug?'current':''} onClick={()=>{setSwitcherOpen(false);router.push(`/${w.slug}`)}}><span>{w.metadata.emoji}</span><div><b>{w.title}</b><small>{w.location} • {w.time}</small></div><i>→</i></button>)}</div></motion.aside></motion.div>}</AnimatePresence>
      <AnimatePresence>{shareOpen&&<motion.div className="shareCardOverlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="shareCard" initial={{y:24,scale:.96}} animate={{y:0,scale:1}}><span className="shareKicker">RANG • MUSIC YOU CAN ENTER</span><div className="shareEmoji">{world.metadata.emoji}</div><h3>{world.title}</h3><p>{world.subtitle}</p><small>{world.location} • {realTime}</small><div className="shareCardActions"><button onClick={()=>void share()}>COPY / SHARE</button><button onClick={()=>setShareOpen(false)}>CLOSE</button></div></motion.div></motion.div>}</AnimatePresence>
    </div>
  </main>;
}
