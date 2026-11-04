// Runs every completion check on dollhouse.html and exits 1 if one fails: node tools/verify.mjs
// Frame timing comes from headless software rendering, so it is reported but never decides a pass.
import { open } from './drive.mjs';
import { readFileSync } from 'node:fs';

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); };

const html = readFileSync('dollhouse.html', 'utf8');
const refs = html.match(/https?:\/\/[^\s'"]+|<link\b|<img\b|@import|\burl\(|\bfetch\(|XMLHttpRequest|\bimport\(|\bsrc=/g) || [];
check('self-contained', refs.length === 0, refs.length ? refs.slice(0, 5).join(' ') : `no external references, ${(html.length / 1024).toFixed(0)} KB`);

const page = await open('full=1&loop=1');
const loops = await page.evaluate(`(() => { const C = dollhouse.CFG, o = {}; dollhouse.SCRIPT_NAMES.forEach((n, b) => { C.block = b; o[n] = dollhouse.loopCheck().every(x => x.same); }); C.block = 0; return o; })()`);
const bad = Object.keys(loops).filter(k => !loops[k]);
check('120 s loop', !bad.length, bad.length ? `differs in ${bad}` : `pixel-identical at 7 offsets in each of ${Object.keys(loops).length} stories`);

const seeds = await page.evaluate(`(() => { let m = 0; for (let s = 1; s <= 300; s++) for (const r of dollhouse.scripts(s)) m = Math.max(m, ...r.slice(1)); return m; })()`);
check('stories fit the block', seeds <= 120, `longest timeline ${seeds.toFixed(1)} s over 300 seeds`);

const combos = await page.evaluate(`(() => { let m = 0, who = ''; for (const n of [1, 2, 3]) for (const f of [false, true]) for (let s = 1; s <= 60; s++) for (const r of dollhouse.scriptsAt(n, f, s)) { const v = Math.max(...r.slice(1)); if (v > m) { m = v; who = r[0] + ' at ' + n + ' floors'; } } return { m, who }; })()`);
check('stories fit at every height', combos.m <= 120, `longest ${combos.m.toFixed(1)} s (${combos.who}), 3 heights, with and without furniture`);

const boundary = await page.evaluate('dollhouse.boundaryCheck(40)');
check('endless boundaries', !boundary.bad.length, boundary.bad.length ? `blocks ${boundary.bad}` : `${boundary.blocks} boundaries identical`);

const fx = await page.evaluate(`(() => {
  const F = dollhouse.FX, C = dollhouse.CFG, names = dollhouse.SCRIPT_NAMES.length, inert = [];
  for (const [k] of dollhouse.FX_INFO) {
    let hit = false;
    for (let b = 0; b < names && !hit; b++) {
      C.block = b;
      for (let i = 0; i < 240 && !hit; i++) {
        const t = i * .5 + .13; F[k] = true; const a = dollhouse.frameHash(t); F[k] = false; hit = a !== dollhouse.frameHash(t); F[k] = true;
      }
    }
    if (!hit) inert.push(k);
  }
  for (const [k] of dollhouse.FX_INFO) F[k] = false;
  dollhouse.renderAt(50);
  for (const [k] of dollhouse.FX_INFO) F[k] = true;
  C.block = 0;
  return { n: dollhouse.FX_INFO.length, inert };
})()`);
check('micro-animations', fx.n >= 30 && !fx.inert.length, fx.inert.length ? `no visible effect: ${fx.inert}` : `${fx.n} toggles, each changes the picture; all-off renders`);

const SAMPLE = '[47.25, 96.5, 1234.5].map(t => dollhouse.frameHash(t))';
const first = await page.evaluate(SAMPLE);
await page.evaluate(`dollhouse.CFG.loop = false; dollhouse.CFG.seed = 7; dollhouse.renderAt(1)`);
const seven = await page.evaluate('[1, 2, 3, 4, 5, 6, 7, 8].map(k => dollhouse.story(k)).join()');
await page.evaluate('dollhouse.CFG.seed = 1905; 1');
const other = await page.evaluate('[1, 2, 3, 4, 5, 6, 7, 8].map(k => dollhouse.story(k)).join()');
check('seed changes the order', seven !== other, `seed 7: ${seven}`);

await page.send('HeapProfiler.enable');
const heap = async () => { await page.send('HeapProfiler.collectGarbage'); return +((await page.send('Runtime.getHeapUsage')).result.usedSize / 1048576).toFixed(2); };
const seq = [await heap()];
for (let k = 0; k < 300; k += 30) {
  await page.evaluate(`(() => { for (let q = ${k}; q < ${k + 30}; q++) for (let i = 0; i < 40; i++) dollhouse.renderAt(q * 120 + i * 3 + .37); })()`);
  seq.push(await heap());
}
const growth = seq.at(-1) - seq[5];
check('memory', growth < .5, `after collection ${seq[0]} to ${seq.at(-1)} MB over 300 blocks, ${growth.toFixed(2)} MB in the second half`);

const perf = await page.evaluate(`(async () => { const s = performance.now(); let n = 0, tot = 0, max = 0;
  while (performance.now() - s < 8000) { const t = (performance.now() - s) / 1000 * 7, a = performance.now(); dollhouse.renderAt(t); const m = performance.now() - a; tot += m; max = Math.max(max, m); n++; await new Promise(r => setTimeout(r)); }
  return { avg: +(tot / n).toFixed(2), max: +max.toFixed(2), bake: Math.round(dollhouse.stats.bake) }; })()`);
console.log(`INFO  frame cost: ${perf.avg} ms average, ${perf.max} ms worst, start-up bake ${perf.bake} ms (headless, not a real display)`);

check('console', !page.logs.length, page.logs.length ? page.logs.slice(0, 5).join(' | ') : 'no warnings or errors');
page.close();
await new Promise(r => setTimeout(r, 800));

const again = await open('full=1&loop=1');
const second = await again.evaluate(SAMPLE);
again.close();
check('determinism', first.join() === second.join(), `same hashes after a reload: ${first.join() === second.join()}`);

const small = await open('floors=1&loop=1');
const smallLoop = await small.evaluate('dollhouse.loopCheck().every(x => x.same)');
check('loop on a one-floor tower', smallLoop, `${smallLoop}`);
small.close();
await new Promise(r => setTimeout(r, 500));
console.log(results.every(Boolean) ? '\nALL PASS' : '\nFAILED');
process.exit(results.every(Boolean) ? 0 : 1);
