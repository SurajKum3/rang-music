import { worldImages } from '@/worlds/images.generated';

type Props = {
  slug: string;
  /** 'hero' is the full frame; 'card' is the smaller 4:3-capped crop. */
  kind: 'hero' | 'card';
  /** Rendered width per breakpoint — this is what keeps phones off the big files. */
  sizes: string;
  alt: string;
  /** Only for the one image that is the page's above-the-fold hero. */
  priority?: boolean;
  /** CSS object-position, e.g. '50% 42%'. */
  focus?: string;
  className?: string;
};

/**
 * A world photo that fills its positioned parent. Serves the pre-built files
 * from `npm run optimize-images` — AVIF first, WebP as the fallback — so
 * nothing is resized or encoded at request time.
 */
export default function WorldImage({ slug, kind, sizes, alt, priority = false, focus = '50% 50%', className }: Props) {
  const set = worldImages[slug];
  if (!set) return null;

  const widths = set[kind];
  const largest = widths[widths.length - 1];
  const url = (w: number, ext: string) => `/worlds/${slug}/${w === largest ? kind : `${kind}-${w}`}.${ext}?v=${set.v}`;
  const srcSet = (ext: string) => widths.map((w) => `${url(w, ext)} ${w}w`).join(', ');
  const ratio = kind === 'hero' ? set.width / set.height : set.cardRatio;

  return (
    <picture style={{ display: 'contents' }}>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
      <img
        src={url(largest, 'webp')}
        alt={alt}
        width={largest}
        height={Math.round(largest / ratio)}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: focus,
          // Blur-up: a 16px preview shows until the real file paints over it.
          backgroundImage: `url(${set.blur})`,
          backgroundSize: 'cover',
          backgroundPosition: focus,
        }}
      />
    </picture>
  );
}

/** `sizes` for a photo that covers the whole viewport, whatever its shape. */
export function coverSizes(slug: string) {
  const set = worldImages[slug];
  if (!set) return '100vw';
  // A landscape photo covering a portrait screen is drawn wider than the screen.
  const drawn = `max(100vw, 100vh * ${(set.width / set.height).toFixed(3)})`;
  // Phones report 3x density; under the scene's grade and grain 2x is
  // indistinguishable, and it keeps them a rung lower.
  return `(max-width: 760px) calc(${drawn} * .67), ${drawn}`;
}
