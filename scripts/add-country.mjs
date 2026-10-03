// Creates data/flags/sovereign/<code>.json skeletons with base facts. Never overwrites an existing file.
// Usage: node scripts/add-country.mjs            (all UN members and observers)
//        node scripts/add-country.mjs fr de       (specific ISO 3166-1 alpha-2 codes)
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'data/flags/sovereign');

const OBSERVERS = ['VA', 'PS'];

const countries = await (await fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json')).json();
const wb = await (await fetch('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=2024&per_page=400')).json();
const population = Object.fromEntries(wb[1].filter((r) => r.value).map((r) => [r.countryiso3code, r.value]));

let codes = process.argv.slice(2).map((c) => c.toUpperCase());
if (!codes.length) {
  codes = countries
    .filter((c) => c.unMember || OBSERVERS.includes(c.cca2))
    .map((c) => c.cca2);
}

await fs.mkdir(OUT, { recursive: true });
let created = 0;
for (const code of codes) {
  const file = path.join(OUT, `${code.toLowerCase()}.json`);
  try {
    await fs.access(file);
    continue;
  } catch {}
  const c = countries.find((x) => x.cca2 === code);
  if (!c) {
    console.warn(`No source data for ${code}; create ${file} by hand.`);
    continue;
  }
  const status = OBSERVERS.includes(code) ? 'un-observer' : 'un-member';
  const entry = {
    code: code.toLowerCase(),
    isoNumeric: c.ccn3 ?? '',
    name: c.name.common,
    officialName: c.name.official,
    localNames: Object.entries(c.name.native ?? {}).map(([k, v]) => ({ language: c.languages?.[k] ?? k, name: v.common, romanized: '' })),
    aliases: [],
    status,
    capital: c.capital?.join(', ') ?? '',
    region: c.region,
    subregion: c.subregion ?? '',
    population: population[c.cca3] ?? null,
    area: c.area ?? null,
    languages: Object.values(c.languages ?? {}),
    currencies: Object.entries(c.currencies ?? {}).map(([code, x]) => ({ name: x.name, code, symbol: x.symbol ?? '' })),
    demonym: c.demonyms?.eng?.m ?? '',
    latlng: c.latlng ?? [],
    flag: { description: '', adopted: '', colors: [], symbolism: '' },
    hook: '',
    lookalikes: [],
    trivia: [],
  };
  await fs.writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  created++;
}
console.log(`Created ${created} file(s) in data/countries.`);
