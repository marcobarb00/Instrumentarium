// Trims the HYG star database to naked-eye stars and writes src/data/stars.json.
//
// Usage: node scripts/build-catalogue.mjs path/to/hygdata_v41.csv
// Source: https://github.com/astronexus/HYG-Database (hyg/CURRENT/hygdata_v41.csv)
// Licence of the data: CC BY-SA 4.0, (c) David Nash / astronexus.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAG_LIMIT = 4.5;
const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-catalogue.mjs hygdata_v41.csv'); process.exit(1); }

// Minimal CSV parser that handles quoted fields.
function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}

const lines = readFileSync(src, 'utf8').split(/\r?\n/);
const head = parseLine(lines[0]);
const col = Object.fromEntries(head.map((h, i) => [h, i]));
const stars = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const f = parseLine(lines[i]);
  const mag = parseFloat(f[col.mag]);
  if (!(mag < MAG_LIMIT)) continue;
  if (f[col.proper] === 'Sol') continue;
  const ci = parseFloat(f[col.ci]);
  stars.push([
    f[col.hip] ? +f[col.hip] : 0,          // Hipparcos number (0 if none)
    +(parseFloat(f[col.ra]) * 15).toFixed(5), // RA J2000, degrees
    +parseFloat(f[col.dec]).toFixed(5),       // Dec J2000, degrees
    +mag.toFixed(2),                          // visual magnitude
    Number.isFinite(ci) ? +ci.toFixed(2) : 0.6, // B-V colour index
    f[col.proper] || '',                      // proper name
    f[col.bayer] || f[col.flam] || '',        // Bayer letter or Flamsteed number
    f[col.con] || '',                         // constellation
  ]);
}
stars.sort((a, b) => a[3] - b[3]);
const out = {
  source: 'HYG Database v4.1 (astronexus/HYG-Database), trimmed to mag < ' + MAG_LIMIT,
  license: 'CC BY-SA 4.0',
  epoch: 'J2000',
  fields: ['hip', 'raDeg', 'decDeg', 'mag', 'bv', 'name', 'bayer', 'con'],
  stars,
};
const dest = fileURLToPath(new URL('../src/data/stars.json', import.meta.url));
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${stars.length} stars to ${dest}`);
