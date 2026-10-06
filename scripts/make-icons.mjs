// Builds the app icons (favicon, apple-touch, PWA) from one inline SVG mark:
// a gold tuning dial on RANG black.   node scripts/make-icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';

// `pad` shrinks the mark so Android's maskable crop never clips it.
const mark = (pad = 0, radius = 112) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#050607"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)" fill="none" stroke="#ffd45a" stroke-linecap="round">
    <circle cx="256" cy="256" r="150" stroke-width="22" opacity=".28"/>
    <path d="M256 106a150 150 0 0 1 150 150" stroke-width="22"/>
    <circle cx="256" cy="256" r="88" stroke-width="22" opacity=".55"/>
    <circle cx="256" cy="256" r="30" fill="#ffd45a" stroke="none"/>
  </g>
</svg>`;

fs.writeFileSync('app/icon.svg', mark().trim() + '\n');
const png = (svg, size, out) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
await png(mark(0, 0), 180, 'app/apple-icon.png'); // iOS rounds the corners itself
await png(mark(), 192, 'public/icons/icon-192.png');
await png(mark(), 512, 'public/icons/icon-512.png');
await png(mark(0.3, 0), 512, 'public/icons/maskable-512.png');
console.log('icons written');
