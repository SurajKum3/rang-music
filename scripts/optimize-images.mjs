// npm run optimize-images
//
// Turns each source photo in assets/worlds/<slug>.(jpg|png|webp) into the
// production set under public/worlds/<slug>/:
//
//   hero.avif / hero.webp        full frame, largest rung (<= 1920px wide)
//   hero-<w>.avif / .webp        smaller rungs of the same frame
//   card.avif / card.webp        800px, cropped to at most 4:3 around heroFocus
//   card-480.avif / .webp        phone-sized card
//   og.jpg                       1200x630 share image
//
// and writes worlds/images.generated.ts (widths, blur placeholder, cache
// version) for components/world/WorldImage.tsx. Sources stay out of public/
// so the originals are never shipped.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'assets', 'worlds');
const OUT_DIR = path.join(root, 'public', 'worlds');
const MANIFEST = path.join(root, 'worlds', 'images.generated.ts');

const HERO_WIDTHS = [640, 1024, 1440, 1920];
const CARD_WIDTHS = [480, 800];
const CARD_MAX_RATIO = 3 / 4; // height / width
const OG = { width: 1200, height: 630 };

const AVIF = { hero: { quality: 58, effort: 6 }, card: { quality: 55, effort: 6 } };
const WEBP = { hero: { quality: 80, effort: 6 }, card: { quality: 76, effort: 6 } };

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const pct = (from, to) => `${(100 * (1 - to / from)).toFixed(0)}%`;

/** heroFocus per slug, read from worlds/index.ts so crops follow the config. */
async function readFocus() {
  const text = await readFile(path.join(root, 'worlds', 'index.ts'), 'utf8');
  const focus = {};
  for (const block of text.split(/\n\s*slug:\s*/).slice(1)) {
    const slug = block.match(/^'([^']+)'/)?.[1];
    const m = block.match(/heroFocus:\s*'(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%'/);
    if (slug) focus[slug] = m ? { x: Number(m[1]) / 100, y: Number(m[2]) / 100 } : { x: .5, y: .5 };
  }
  return focus;
}

/**
 * Crop region for a target aspect, placed the way CSS object-position places
 * it — so the same heroFocus keeps the same subject centred after cropping.
 */
function cropRegion(width, height, ratio, focus) {
  if (height / width > ratio) {
    const h = Math.round(width * ratio);
    return { left: 0, top: Math.round((height - h) * focus.y), width, height: h };
  }
  const w = Math.round(height / ratio);
  return { left: Math.round((width - w) * focus.x), top: 0, width: w, height };
}

async function emit(pipeline, file) {
  const { size, width, height } = await pipeline.toFile(file);
  return { file: path.relative(OUT_DIR, file).replaceAll('\\', '/'), size, width, height };
}

async function buildWorld(srcFile, slug, focus) {
  const input = await readFile(srcFile);
  const meta = await sharp(input).metadata();
  const outDir = path.join(OUT_DIR, slug);
  await mkdir(outDir, { recursive: true });
  const base = () => sharp(input).rotate();
  const out = [];

  const heroWidths = HERO_WIDTHS.filter((w) => w < meta.width);
  heroWidths.push(Math.min(meta.width, HERO_WIDTHS.at(-1)));
  const heroMax = heroWidths.at(-1);
  for (const w of heroWidths) {
    const name = w === heroMax ? 'hero' : `hero-${w}`;
    out.push(await emit(base().resize({ width: w }).avif(AVIF.hero), path.join(outDir, `${name}.avif`)));
    out.push(await emit(base().resize({ width: w }).webp(WEBP.hero), path.join(outDir, `${name}.webp`)));
  }

  const cardRatio = Math.min(meta.height / meta.width, CARD_MAX_RATIO);
  const cardCrop = cropRegion(meta.width, meta.height, cardRatio, focus);
  const cardWidths = CARD_WIDTHS.filter((w) => w <= cardCrop.width);
  const cardMax = cardWidths.at(-1);
  for (const w of cardWidths) {
    const name = w === cardMax ? 'card' : `card-${w}`;
    out.push(await emit(base().extract(cardCrop).resize({ width: w }).avif(AVIF.card), path.join(outDir, `${name}.avif`)));
    out.push(await emit(base().extract(cardCrop).resize({ width: w }).webp(WEBP.card), path.join(outDir, `${name}.webp`)));
  }

  const ogCrop = cropRegion(meta.width, meta.height, OG.height / OG.width, focus);
  out.push(await emit(
    base().extract(ogCrop).resize(OG.width, OG.height).jpeg({ quality: 82, mozjpeg: true }),
    path.join(outDir, 'og.jpg'),
  ));

  const blur = await base().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();

  return {
    original: { size: (await stat(srcFile)).size, width: meta.width, height: meta.height },
    files: out,
    entry: {
      v: createHash('sha1').update(input).digest('hex').slice(0, 8),
      width: heroMax,
      height: Math.round((heroMax * meta.height) / meta.width),
      hero: heroWidths,
      card: cardWidths,
      cardRatio: Number((1 / cardRatio).toFixed(4)),
      blur: `data:image/webp;base64,${blur.toString('base64')}`,
    },
  };
}

function report(slug, { original, files }) {
  console.log(`\n${slug}  —  original ${original.width}x${original.height}, ${kb(original.size)}`);
  for (const f of files) {
    const name = f.file.padEnd(26);
    const dims = `${f.width}x${f.height}`.padEnd(11);
    console.log(`  ${name}${dims}${kb(f.size).padStart(8)}   ${pct(original.size, f.size).padStart(4)} smaller`);
  }
}

const focus = await readFocus();
const sources = (await readdir(SRC_DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
if (!sources.length) {
  console.error(`No source images in ${path.relative(root, SRC_DIR)}/`);
  process.exit(1);
}

const manifest = {};
let originalTotal = 0;
let primaryTotal = 0;
let allTotal = 0;

for (const file of sources) {
  const slug = path.parse(file).name;
  const result = await buildWorld(path.join(SRC_DIR, file), slug, focus[slug] ?? { x: .5, y: .5 });
  manifest[slug] = result.entry;
  report(slug, result);
  originalTotal += result.original.size;
  primaryTotal += result.files.find((f) => f.file === `${slug}/hero.avif`).size;
  allTotal += result.files.reduce((sum, f) => sum + f.size, 0);
}

await writeFile(
  MANIFEST,
  `// Generated by \`npm run optimize-images\` — do not edit by hand.\n\n` +
  `export type WorldImageSet = {\n` +
  `  /** Content hash of the source photo; appended to URLs so files can be cached forever. */\n` +
  `  v: string;\n` +
  `  /** Pixel size of the largest hero rung. */\n` +
  `  width: number;\n` +
  `  height: number;\n` +
  `  /** Available widths, ascending. The last one is the un-suffixed file. */\n` +
  `  hero: number[];\n` +
  `  card: number[];\n` +
  `  /** width / height of the card crop. */\n` +
  `  cardRatio: number;\n` +
  `  blur: string;\n` +
  `};\n\n` +
  `export const worldImages: Record<string, WorldImageSet> = ${JSON.stringify(manifest, null, 2)};\n`,
);

console.log('\n' + '─'.repeat(64));
console.log(`originals            ${kb(originalTotal).padStart(9)}   (${sources.length} photos, no longer in public/)`);
console.log(`largest hero (avif)  ${kb(primaryTotal).padStart(9)}   ${pct(originalTotal, primaryTotal)} smaller than the originals`);
console.log(`all variants         ${kb(allTotal).padStart(9)}   every size and format, on disk`);
console.log(`manifest             ${path.relative(root, MANIFEST).replaceAll('\\', '/')}`);
