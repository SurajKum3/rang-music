import type { Metadata } from 'next';
import type { WorldConfig } from '@/engine/world/types';

// One origin for metadataBase, canonicals, sitemap and robots.
// Set NEXT_PUBLIC_SITE_URL in production; on Vercel the production domain is picked up automatically.
const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'https://rang-music-worlds.vercel.app';

export const SITE_URL = origin.replace(/\/+$/, '');
export const SITE_NAME = 'RANG';
export const SITE_TITLE = 'RANG — Music You Can Enter';
export const SITE_DESCRIPTION =
  'Not a playlist — a place. Step into a 2AM auto, the last bus home, a chai tapri, a local saloon or the Mumbai monsoon, and stay for a song.';
export const DEFAULT_OG_IMAGE = '/worlds/auto/og.jpg';

export const absoluteUrl = (path = '/') => `${SITE_URL}${path === '/' ? '' : path}`;

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Music for the road you didn't plan." */
export const worldTagline = (world: WorldConfig) => sentence(world.subtitle);

// openGraph/twitter are replaced, not merged, by child segments — so every page builds the full set here.
export function pageMetadata({
  title,
  socialTitle,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  imageAlt = SITE_TITLE,
}: {
  title: Metadata['title'];
  socialTitle: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_IN',
      url: path,
      title: socialTitle,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}

export function worldMetadata(world: WorldConfig): Metadata {
  const title = `${world.title} — ${SITE_NAME}`;
  return pageMetadata({
    title: { absolute: title },
    socialTitle: title,
    description: worldTagline(world),
    path: `/${world.slug}`,
    image: world.ogImage ?? DEFAULT_OG_IMAGE,
    imageAlt: world.location === world.title ? world.title : `${world.title} — ${world.location}`,
  });
}
