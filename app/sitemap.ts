import type { MetadataRoute } from 'next';
import { worlds } from '@/worlds';
import { DEFAULT_OG_IMAGE, absoluteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1, images: [absoluteUrl(DEFAULT_OG_IMAGE)] },
    ...worlds.map(world => ({
      url: absoluteUrl(`/${world.slug}`),
      changeFrequency: 'monthly' as const,
      priority: .8,
      images: world.ogImage ? [absoluteUrl(world.ogImage)] : undefined,
    })),
  ];
}
