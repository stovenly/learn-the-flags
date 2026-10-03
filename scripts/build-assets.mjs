// Renders public/icon.svg, public/apple-touch-icon.png and the 1200×630 social preview public/og.png.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const pub = (f) => path.join(ROOT, 'public', f);

const mark = (fg, accent) =>
  `<rect x="5" y="3" width="2.5" height="26" rx="1.25" fill="${fg}"/><path d="M8.5 5h17l-3.5 5.5 3.5 5.5h-17z" fill="${accent}"/>`;

await fs.writeFile(
  pub('icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.p{fill:#17181b}@media(prefers-color-scheme:dark){.p{fill:#ececef}}</style><rect x="5" y="3" width="2.5" height="26" rx="1.25" class="p"/><path d="M8.5 5h17l-3.5 5.5 3.5 5.5h-17z" fill="#3b5bdb"/></svg>\n`,
);

await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f6f6f3"/><g transform="translate(2.5 2.5) scale(0.85)">${mark('#17181b', '#3b5bdb')}</g></svg>`))
  .png()
  .toFile(pub('apple-touch-icon.png'));

const codes = ['jp', 'br', 'ca', 'za', 'kr', 'ch', 'gb', 'in', 'np', 'mx', 'se', 'ke', 'bt', 'us', 'gr', 'tr', 'ar', 'au', 'jm', 'lk'];
const cellW = 150, cellH = 100, gap = 22, cols = 4;
const gx = 1200 - cols * cellW - (cols - 1) * gap - 40;
const composites = [];
for (const [i, code] of codes.entries()) {
  const col = i % cols, row = Math.floor(i / cols);
  const img = sharp(pub(`img/flags/320/${code}.webp`)).resize(cellW, cellH, { fit: 'inside' });
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  composites.push({
    input: data,
    left: Math.round(gx + col * (cellW + gap) + (cellW - info.width) / 2),
    top: Math.round(-20 + row * (cellH + gap) + (cellH - info.height) / 2),
  });
}
const font = `font-family="Segoe UI, Inter, Helvetica, Arial, sans-serif"`;
const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <g transform="translate(64 120) scale(2.4)">${mark('#17181b', '#3b5bdb')}</g>
  <text x="64" y="290" ${font} font-size="64" font-weight="700" fill="#17181b" letter-spacing="-1.5">Learn the</text>
  <text x="64" y="364" ${font} font-size="64" font-weight="700" fill="#17181b" letter-spacing="-1.5">Flags</text>
  <text x="64" y="430" ${font} font-size="26" fill="#6b6d74">Memorize all 195 flags</text>
  <text x="64" y="466" ${font} font-size="26" fill="#6b6d74">of the world, a few</text>
  <text x="64" y="502" ${font} font-size="26" fill="#6b6d74">minutes a day.</text>
</svg>`;
const fade = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f6f6f3" stop-opacity="1"/><stop offset="1" stop-color="#f6f6f3" stop-opacity="0"/></linearGradient></defs><rect x="${gx - 10}" width="140" height="630" fill="url(#g)"/></svg>`;
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f6f6f3' } })
  .composite([...composites, { input: Buffer.from(fade) }, { input: Buffer.from(text) }])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(pub('og.png'));
console.log(`Wrote icon.svg, apple-touch-icon.png, og.png for ${site.siteUrl}`);
