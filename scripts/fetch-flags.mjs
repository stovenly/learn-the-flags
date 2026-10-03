// Downloads flag images for every file in data/countries into public/img/flags/{320,640}/<code>.webp.
// Existing images are kept; pass --force to re-download, or codes to limit: node scripts/fetch-flags.mjs fr de
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WIDTHS = [320, 640];
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());

const codes = (await fs.readdir(path.join(ROOT, 'data/countries')))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))
  .filter((c) => !only.length || only.includes(c));

const jobs = [];
for (const w of WIDTHS) {
  await fs.mkdir(path.join(ROOT, `public/img/flags/${w}`), { recursive: true });
  for (const code of codes) jobs.push({ code, w, file: path.join(ROOT, `public/img/flags/${w}/${code}.webp`) });
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
    const res = await fetch(`https://flagcdn.com/w${job.w}/${job.code}.webp`);
    if (!res.ok) {
      failed.push(`${job.code}@${job.w} (${res.status})`);
      continue;
    }
    await fs.writeFile(job.file, Buffer.from(await res.arrayBuffer()));
    done++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`Downloaded ${done} image(s).`);
if (failed.length) {
  console.error(`Failed: ${failed.join(', ')}`);
  process.exitCode = 1;
}
