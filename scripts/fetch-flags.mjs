// Downloads flag images for every file in data/flags/<set>/ into public/img/flags/{320,640}/<code>.webp: from Wikimedia
// Commons when the file names an "image", else from flagcdn.com by code.
// Existing images are kept; pass --force to re-download, or codes to limit: node scripts/fetch-flags.mjs fr us-tx
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const WIDTHS = [320, 640];
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());
const UA = { 'User-Agent': 'learn-the-flags-build/1.0 (https://github.com/stovenly/learn-the-flags)' };

const entries = [];
for (const set of await fs.readdir(path.join(ROOT, 'data/flags'))) {
  for (const f of (await fs.readdir(path.join(ROOT, 'data/flags', set))).filter((f) => f.endsWith('.json'))) {
    const c = JSON.parse(await fs.readFile(path.join(ROOT, 'data/flags', set, f), 'utf8'));
    if (!only.length || only.includes(c.code)) entries.push(c);
  }
}

const jobs = [];
for (const w of WIDTHS) {
  await fs.mkdir(path.join(ROOT, `public/img/flags/${w}`), { recursive: true });
  for (const c of entries) jobs.push({ c, w, file: path.join(ROOT, `public/img/flags/${w}/${c.code}.webp`) });
}

async function download(c, w) {
  if (!c.image) {
    const res = await fetch(`https://flagcdn.com/w${w}/${c.code}.webp`);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : res.status;
  }
  const url = `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(c.image)}&width=${w}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return res.status;
    return sharp(Buffer.from(await res.arrayBuffer())).resize({ width: w }).webp({ quality: 88 }).toBuffer();
  }
  return 429;
}

let done = 0;
const failed = [];
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    if (!force) {
      try {
        await fs.access(job.file);
        continue;
      } catch {}
    }
    const data = await download(job.c, job.w);
    if (!Buffer.isBuffer(data)) {
      failed.push(`${job.c.code}@${job.w} (${data})`);
      continue;
    }
    await fs.writeFile(job.file, data);
    done++;
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`Downloaded ${done} image(s).`);
if (failed.length) {
  console.error(`Failed: ${failed.join(', ')}`);
  process.exitCode = 1;
}
