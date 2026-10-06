import type { WorldConfig } from '@/engine/world/types';

/**
 * HOW TO ADD A SONG (tracks mode)
 * --------------------------------
 * 1. Open YouTube and find the official/licensed video.
 * 2. Copy the video ID from the URL (the part after ?v=).
 * 3. Add an entry to a world's music.tracks array:
 *    { id: 'unique-id', title: 'Song Title', artist: 'Artist Name', youtubeVideoId: 'VIDEO_ID' }
 * 4. Test playback.
 *
 * HOW TO USE A PLAYLIST (youtube-playlist mode)
 * -----------------------------------------------
 * 1. Open YouTube, go to the playlist.
 * 2. Copy the playlist ID from the URL (the part after ?list=).
 * 3. Set music: { type: 'youtube-playlist', playlistId: 'PLAYLIST_ID', title: 'Playlist Name' }
 * 4. Test playback.
 *
 * COMPLIANCE NOTE
 * ----------------
 * Do not download, proxy, or re-host YouTube audio.
 * Keep YouTube attribution visible where required.
 * Only use officially uploaded / licensed videos.
 */

export const worlds: WorldConfig[] = [
  {
    slug: 'auto',
    title: '2AM AUTO',
    subtitle: "music for the road you didn't plan.",
    location: 'MUMBAI',
    time: '02:13 AM',
    description: 'the city moves at a different pace at 2am. no rush. just the road.',
    heroImage: '/worlds/auto/hero.webp',
    ogImage: '/worlds/auto/og.jpg',
    heroFocus: '50% 44%',
    theme: { accent: '#ffd45a', sceneClass: 'scene-auto', mood: 'LATE NIGHT' },
    music: {
      type: 'youtube-playlist',
      playlistId: 'PLq-bT4s33RYADNkcClDkLPovaKJx0HTDM',
      title: '2AM AUTO • RANG FM',
    },
    ambience: {
      layers: [
        { id: 'engine', src: '/audio/engine-idle.wav', volume: .22, loop: true },
        { id: 'rain', src: '/audio/rain-bed.wav', volume: .16, loop: true },
        { id: 'traffic', src: '/audio/traffic-bed.wav', volume: .10, loop: true },
        { id: 'horn', src: '/audio/horn.wav', volume: 1, loop: false },
      ],
    },
    interactions: {
      hotspots: [],
      dialogue: ['Kidhar jaana hai?', 'Meter se chalega.', 'Signal pe rukna padega.', 'Bhai, seedha?', 'Aaj traffic bahut hai.'],
      entryText: 'finding your ride…',
      signature: 'PON PON',
    },
    moments: [],
    character: { label: 'DRIVER', position: 'actorDriver' },
    metadata: {
      emoji: '\u{1F6FA}',
      eyebrow: 'MUMBAI • 02:13 AM',
      easterEgg: { label: 'LATE FARE', text: 'Meter 088. 2:13 AM. No destination saved.' },
      available: true,
      presenceLabel: 'riding',
    },
  },
  {
    slug: 'bus',
    title: 'LAST BUS HOME',
    subtitle: 'headphones on. city lights outside.',
    location: 'DELHI',
    time: '11:48 PM',
    description: 'this is the last bus home. after this, only headlights and silence.',
    heroImage: '/worlds/bus/hero.webp',
    ogImage: '/worlds/bus/og.jpg',
    heroFocus: '50% 42%',
    theme: { accent: '#7cc7ff', sceneClass: 'scene-bus', mood: 'CITY' },
    music: {
      type: 'youtube-playlist',
      playlistId: 'PL0umg_TNpoZTTdZVIi5tfX69pRmoMFGna',
      title: 'LAST BUS HOME • RANG FM',
    },
    ambience: {
      layers: [
        { id: 'rain', src: '/audio/rain-bed.wav', volume: .09, loop: true },
        { id: 'traffic', src: '/audio/traffic-bed.wav', volume: .08, loop: true },
      ],
    },
    interactions: {
      hotspots: [],
      dialogue: ['Agla stop?', 'Ticket le lo.', 'Bhai, peeche jagah hai.', 'Last bus hai.'],
      entryText: 'doors closing…',
      signature: 'NEXT STOP',
    },
    moments: [],
    character: { label: 'CONDUCTOR', position: 'actorDriver' },
    metadata: {
      emoji: '\u{1F68C}',
      eyebrow: 'DELHI • 11:48 PM',
      easterEgg: { label: 'TICKET #11', text: 'Keep the ticket. It is dated tonight.' },
      available: true,
      presenceLabel: 'on board',
    },
  },
  {
    slug: 'tapri',
    title: 'TAPRI AT 11:47',
    subtitle: 'chai, smoke, one more song.',
    location: 'TAPRI',
    time: '11:47 PM',
    description: 'steam rises from the glass. someone hums the chorus. the kettle keeps time.',
    heroImage: '/worlds/tapri/hero.webp',
    ogImage: '/worlds/tapri/og.jpg',
    heroFocus: '50% 50%',
    theme: { accent: '#ffad66', sceneClass: 'scene-tapri', mood: 'LATE NIGHT' },
    music: {
      type: 'youtube-playlist',
      playlistId: 'PLVwbgC8mRDea4xoSwC0ZNMiIr8OHiaFog',
      title: 'TAPRI AT 11:47 • RANG FM',
    },
    ambience: {
      layers: [
        { id: 'rain', src: '/audio/rain-bed.wav', volume: .12, loop: true },
      ],
    },
    interactions: {
      hotspots: [],
      dialogue: ['Ek cutting?', 'Biscuit bhi le lo.', 'Bhaiya, adrak wali?', 'Bas do minute.'],
      entryText: 'chai is almost ready…',
      signature: 'EK CUTTING',
      meterLabel: '₹20 • CUTTING CHAI',
    },
    moments: [],
    character: { label: 'CHAI WALA', position: 'actorDriver' },
    metadata: {
      emoji: '☕',
      eyebrow: 'NORTH INDIA • 11:47 PM',
      easterEgg: { label: 'BISCUIT', text: 'There is always one Parle-G packet left behind.' },
      available: true,
      presenceLabel: 'at the tapri',
    },
  },
  {
    slug: 'saloon',
    title: 'LOCAL SALOON',
    subtitle: 'one trim. three songs. no rush.',
    location: 'LOCAL SALOON',
    time: '08:36 PM',
    description: "the old mirror doesn't judge. the tube light hums along to the radio.",
    heroImage: '/worlds/saloon/hero.webp',
    ogImage: '/worlds/saloon/og.jpg',
    heroFocus: '50% 55%',
    theme: { accent: '#ef8cff', sceneClass: 'scene-saloon', mood: 'CHILL' },
    music: {
      type: 'youtube-playlist',
      playlistId: 'PLl2jQn4j1xPhjPgjze0Ks19_z7gT7Eq1l',
      title: 'LOCAL SALOON • RANG FM',
    },
    ambience: {
      layers: [
        { id: 'traffic', src: '/audio/traffic-bed.wav', volume: .05, loop: true },
      ],
    },
    interactions: {
      hotspots: [],
      dialogue: ['Kitna short?', 'Side se fade?', 'Bas thoda trim.', 'Hero jaisa kar dein?'],
      entryText: 'the fan is already spinning…',
      signature: 'SIDE SE FADE?',
    },
    moments: [],
    character: { label: 'BARBER', position: 'actorDriver' },
    metadata: {
      emoji: '\u{1F488}',
      eyebrow: 'OLD CITY • 08:36 PM',
      easterEgg: { label: 'POSTER', text: 'One old movie poster has a date from before you were born.' },
      available: true,
      presenceLabel: 'inside',
    },
  },
  {
    slug: 'monsoon',
    title: 'MUMBAI MONSOON',
    subtitle: 'the whole city sounds softer in rain.',
    location: 'MUMBAI',
    time: '06:22 PM',
    description: 'mumbai sounds softer in the rain. lower, slower, wetter.',
    heroImage: '/worlds/monsoon/hero.webp',
    ogImage: '/worlds/monsoon/og.jpg',
    heroFocus: '50% 45%',
    theme: { accent: '#8fe7ff', sceneClass: 'scene-monsoon', mood: 'RAINY' },
    music: {
      type: 'youtube-playlist',
      playlistId: 'PLNF75JxIUuudtR4lJXlDq4xoZGb73ATrG',
      title: 'MUMBAI MONSOON • RANG FM',
    },
    ambience: {
      layers: [
        { id: 'rain', src: '/audio/rain-bed.wav', volume: .20, loop: true },
        { id: 'traffic', src: '/audio/traffic-bed.wav', volume: .07, loop: true },
      ],
    },
    interactions: {
      hotspots: [],
      dialogue: ['Aaj full baarish.', 'Rickshaw milega?', 'Chalo, bheegte hain.', 'Road dekho.'],
      entryText: 'rain finding the pavement…',
      signature: 'LISTEN TO THIS',
    },
    moments: [],
    character: { label: '', position: 'actorDriver' },
    metadata: {
      emoji: '\u{1F327}️',
      eyebrow: 'MUMBAI • 06:22 PM',
      easterEgg: { label: 'LIGHTHOUSE', text: 'Look toward the far light. It blinks three times, then disappears.' },
      available: true,
      presenceLabel: 'in the rain',
    },
  },
];

export const getWorld = (slug: string) => worlds.find(world => world.slug === slug) ?? worlds[0];
