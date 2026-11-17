// scripts/parity.mjs · every block marked LIFTED in src/ must appear in the live FallLegalPaper page byte for byte,
// minus the word `export`. Default: the published page on GitHub; or pass a local path. Exits 1 on any drift.
import { readFileSync } from 'node:fs';
const page = (process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : await (await fetch('https://raw.githubusercontent.com/sjgant80-hub/falllegalpaper/main/index.html')).text()).replace(/\r\n/g, '\n');
const blocks = [];
for (const f of ['engine.js', 'templates.js', 'qa.js', 'document.js']) {
  const s = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const part of s.split('// LIFTED\nexport ').slice(1)) blocks.push({ f, body: part.split(/\n\n(?=\/\/ LIFTED|export )/)[0].trimEnd() });
}
const drift = blocks.filter((b) => !page.includes(b.body)).map((b) => b.f + ': ' + b.body.split('\n')[0].slice(0, 70));
if (blocks.length < 13) { console.error('PARITY: expected at least 13 lifted blocks, found ' + blocks.length); process.exit(1); }
if (drift.length) { console.error('PARITY FAILED: the live page no longer carries:\n  ' + drift.join('\n  ')); process.exit(1); }
console.log('parity: all ' + blocks.length + ' lifted blocks (engine, templates, answers, printable page) are the live page\'s own code, byte for byte');
