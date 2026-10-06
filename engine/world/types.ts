export type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  youtubeVideoId: string;
  artwork?: string;
};

export type HotspotAction = 'mirror' | 'driver' | 'meter' | 'radio' | 'horn' | 'ambient';

export type WorldMoment = {
  id: string;
  label: string;
  text: string;
  trigger: HotspotAction | 'entry' | 'listen';
};

export type Hotspot = {
  id: string;
  label: string;
  icon: string;
  action: HotspotAction;
  position: string;
  detail?: string;
};

export type AudioLayer = {
  id: string;
  src: string;
  volume: number;
  loop?: boolean;
};

export type WorldTheme = {
  accent: string;
  sceneClass: string;
  mood: string;
};

// Supports individual YouTube video tracks OR a YouTube playlist
export type WorldMusic =
  | { type: 'tracks'; tracks: MusicTrack[] }
  | { type: 'youtube-playlist'; playlistId: string; title: string };

export type WorldAmbience = {
  layers: AudioLayer[];
};

export type WorldInteractions = {
  hotspots: Hotspot[];
  dialogue: string[];
  entryText: string;
  signature: string;
  meterLabel?: string;
};

export type WorldCharacter = {
  label: string;
  position: string;
};

export type WorldMetadata = {
  emoji: string;
  eyebrow: string;
  easterEgg: { label: string; text: string };
  available: boolean;
  /** Follows the live head-count in the header, e.g. "riding" -> "247 riding". */
  presenceLabel?: string;
};

export type WorldConfig = {
  slug: string;
  title: string;
  subtitle: string;
  location: string;
  time: string;
  description: string;
  heroImage?: string;
  /** CSS object-position for cropped card art, e.g. '50% 42%'. Defaults to centre. */
  heroFocus?: string;
  thumbnailImage?: string;
  ogImage?: string;
  theme: WorldTheme;
  music: WorldMusic;
  ambience: WorldAmbience;
  interactions: WorldInteractions;
  moments: WorldMoment[];
  character: WorldCharacter;
  metadata: WorldMetadata;
};
