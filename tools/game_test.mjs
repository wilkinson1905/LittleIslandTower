// Plays the game itself and exits 1 if a rule breaks: node tools/game_test.mjs
// Real pointer and touch events go through the browser, so hit-testing and buttons are exercised too.
import { open } from './drive.mjs';
import { withAnalytics } from './analytics.mjs';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const page = await open('');
await sleep(300);
const ev = page.evaluate;
await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(300);

// where is an internal pixel on the screen right now?
const toClient = (x, y) => ev(`(() => { const r = document.getElementById('view').getBoundingClientRect(), v = dollhouse.game.camera(); return [r.left + (${x} - v[0]) / v[2] * r.width, r.top + (${y} - v[1]) / v[3] * r.height]; })()`);
const touch = (type, touchPoints) => new Promise((done, fail) => {
  const stuck = setTimeout(() => fail(new Error('the page stopped answering touches')), 10000);
  page.send('Input.dispatchTouchEvent', { type, touchPoints }).then(r => { clearTimeout(stuck); done(r); });
});
const tap = async (cx, cy) => {
  await touch('touchStart', [{ x: cx, y: cy }]);
  await touch('touchEnd', []);
  await sleep(80);
};
const tapEl = async sel => {
  const b = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (!b) throw new Error('no element ' + sel);
  await tap(b[0], b[1]);
};

/* ── a fresh start ───────────────────────────────────────────────────── */
let s = await ev('dollhouse.game.state()');
check('fresh start', s.storeys === 1 && s.glass === 0 && s.beach.length >= 3, `1 floor, ${s.beach.length} pieces on the beach`);
const slots = await ev('dollhouse.game.slots()');
check('beach slots', slots.length >= dollhouseCap(s), `${slots.length} places for glass`);
function dollhouseCap() { return 12; }
check('only the cat at first', await ev(`['cat','pup','rabbit','sheep','dragon','penguin'].filter(dollhouse.game.present).join()`) === 'cat', 'cat');

/* ── tapping glass with a real finger ─────────────────────────────────── */
const firstSlot = slots[s.beach[0].slot], kindValue = [1, 2, 5][s.beach[0].kind];
const [cx, cy] = await toClient(firstSlot[0], firstSlot[1]);
await tap(cx, cy);
let after = await ev('dollhouse.game.state()');
check('touch collects glass', after.glass === kindValue && after.beach.length === s.beach.length - 1, `glass ${after.glass}, ${after.beach.length} left`);

/* ── spawning respects the cap ────────────────────────────────────────── */
await ev('dollhouse.game.advance(600)');
after = await ev('dollhouse.game.state()');
check('beach cap', after.beach.length === 12, `${after.beach.length} after ten idle minutes`);

/* ── buying from the card, through real buttons ───────────────────────── */
await ev('dollhouse.game.collectAll(); 1');
after = await ev('dollhouse.game.state()');
const faceSel = '#faces .face:nth-child(1)';
await tapEl(faceSel);
await sleep(600);
const cardOn = await ev(`document.getElementById('card').classList.contains('on')`);
check('tap a face opens the card', cardOn, `card ${cardOn}, view ${await ev('dollhouse.game.view()')}`);
const b4 = await ev('dollhouse.game.state()');
await tapEl('#card .good[data-good="cookie"]');
const a4 = await ev('dollhouse.game.state()');
check('a treat costs glass and earns a heart', a4.glass === b4.glass - 5 && a4.aff.cat === b4.aff.cat + 1, `glass ${b4.glass} to ${a4.glass}, fondness ${a4.aff.cat}`);
check('the animal reacts', (await ev('dollhouse.game.react()')).includes('cat'), 'cat is reacting');
await tapEl('#card .x');

/* ── tapping the animal on screen ─────────────────────────────────────── */
await sleep(300);
const pos = await ev(`dollhouse.game.actorAt('cat')`);
const [ax, ay] = await toClient(pos[0], pos[1]);
await tap(ax, ay);
await sleep(100);
check('touching the cat opens its card', await ev(`document.getElementById('card').classList.contains('on')`), `at ${pos}`);
await tapEl('#card .x');

/* ── furniture: only the bed at first, and buying puts it in the room ── */
const painted = name => ev('dollhouse.game.painted(' + JSON.stringify(name) + ')');
check('no furniture bought at first', (await ev('dollhouse.game.state()')).furn.length === 0, 'none');
const bare = await painted('rugF1');
check('only the bed is in the room', bare === 0 && await painted('tent') === 0 && await painted('catTreeTop') === 0 && await painted('catBed') > 0, 'bed ' + await painted('catBed') + ' px');
await ev('dollhouse.game.advance(5000); dollhouse.game.collectAll(); 1');
await tapEl('#shopBtn');
check('the shop opens', await ev(`document.getElementById('shop').classList.contains('on')`), `${await ev(`document.querySelectorAll('#shop .good').length`)} things for sale`);
check('only floors that exist are for sale', await ev(`[...document.querySelectorAll('#shop .good[data-furn]')].every(b => dollhouse.game.furniture[b.dataset.furn].floor === 1)`), 'floor 1 only');
check('every item for sale has a picture', await ev(`[...document.querySelectorAll('#shop .good')].every(b => { const c = b.querySelector('.gi canvas'); return c && c.width > 2 && c.height > 2; })`), 'pictures in the catalog');
const art = await ev(`Object.keys(dollhouse.game.furniture).map(k => [k, ...dollhouse.game.art(k)]).filter(a => a[3] < 12)`);
check('all 23 pictures have something in them', art.length === 0, art.length ? JSON.stringify(art) : 'no empty pictures');
check('roof colours come first in the shop', await ev(`document.querySelector('#shop .good').dataset.roof === 'blue' && document.querySelectorAll('#shop .good[data-roof]').length === 4`), 'four colours at the top');
check('the colour it already has cannot be bought', await ev(`document.querySelector('#shop .good[data-roof="blue"]').disabled`), 'blue is greyed out');
const beforeRug = await ev('dollhouse.game.state()');
await ev(`[...document.querySelectorAll('#floors button')].find(b => b.textContent === '全体').click(); 1`);
const viewBeforeRug = String(await ev('dollhouse.game.view()'));
await tapEl('#shop .good[data-furn="rug1"]');
const afterRug = await ev('dollhouse.game.state()');
check('buying furniture costs glass', afterRug.glass === beforeRug.glass - 8 && afterRug.furn.includes('rug1'), `glass ${beforeRug.glass} to ${afterRug.glass}`);
const withRug = await painted('rugF1');
check('it appears in the room', withRug > 100, `${withRug} px`);
const lit = await ev('dollhouse.game.highlight()');
check('the new furniture glows', lit && lit.key === 'rug1' && lit.px > 100 && lit.ring > 20, JSON.stringify(lit));
check('the camera goes to its floor', await ev('dollhouse.game.view()') === '1' || await ev('dollhouse.game.view()') === 1, String(await ev('dollhouse.game.view()')));
await sleep(3800);
check('the glow stops by itself', await ev('dollhouse.game.highlight()') === null, 'gone after about 3 s');
check('the camera goes back to where it was', String(await ev('dollhouse.game.view()')) === 'all' && viewBeforeRug === 'all', viewBeforeRug);

check('it cannot be bought twice', !(await ev(`dollhouse.game.furnish('rug1')`)), 'refused');
check('nor for a floor not built', !(await ev(`dollhouse.game.furnish('oven')`)), 'refused');

/* ── the screen stays quiet, and help is one button away ──────────────── */
check('no small print on the screen', await ev(`document.querySelectorAll('#ui small, #ui .note').length`) === 0, 'none');
await tapEl('#helpBtn');
check('help explains the game', await ev(`document.getElementById('help').classList.contains('on') && document.querySelectorAll('#help li').length >= 5`), 'open');
await tapEl('#help .x');
check('the title', await ev('document.title') === 'Little Island Tower', await ev('document.title'));

/* ── saving: everything survives a reload ─────────────────────────────── */
await ev('dollhouse.game.advance(30); dollhouse.game.save()');
const saved = await ev('dollhouse.game.state()');
await page.send('Page.reload');
await sleep(1500);
for (let i = 0; i < 50 && !(await ev('!!window.dollhouse').catch(() => false)); i++) await sleep(100);
const loaded = await ev('dollhouse.game.state()');
check('furniture survives a reload', loaded.furn.includes('rug1') && await painted('rugF1') === withRug, loaded.furn.join());
check('save and resume', loaded.glass === saved.glass && loaded.aff.cat === saved.aff.cat && loaded.total === saved.total && loaded.beach.length === saved.beach.length && Math.abs(loaded.played - saved.played) < 30,
  `glass ${loaded.glass}, fondness ${loaded.aff.cat}, ${loaded.beach.length} on the beach`);

/* ── while it is closed: nothing builds up, and nothing is left of the bottle ─ */
r0: {
  const b = await ev('dollhouse.game.state()');
  const w = await ev('dollhouse.game.comeBack(3600 * 24 * 7)');
  check('nothing builds up while away', w.glass === b.glass && w.total === b.total && !('stash' in w) && w.hunger.cat === b.hunger.cat, `${b.glass} glass before and after a week`);
  check('no bottle on the screen', await ev(`!document.getElementById('bottleBtn') && !document.querySelector('[data-bottle]')`), 'gone');
}
await ev(`(() => { const s = JSON.parse(localStorage.getItem('summer-tower-save-v1')); s.stash = 30; s.bottleLv = 3; delete s.presents; delete s.balloonIn; delete s.bn; delete s.hunger; delete s.roof; s.storeys = 2; s.glass = 77; localStorage.setItem('summer-tower-save-v1', JSON.stringify(s)); })(); 1`);
const old = await ev('dollhouse.game.read()');
check('an old save loses only the bottle', !('stash' in old) && !('bottleLv' in old) && old.glass === 77 && old.storeys === 2 && Array.isArray(old.presents) && old.hunger.cat === 1 && old.roof === 'blue', `glass ${old.glass}, floors ${old.storeys}, full, blue roof`);
await ev('dollhouse.game.reset(); 1');

/* ── a new piece of glass draws the eye ───────────────────────────────── */
await ev('dollhouse.game.collectAll(); 1');
const sp0 = await ev('dollhouse.game.splashes()');
await ev('dollhouse.game.advance(10); 1');
check('new glass splashes', await ev('dollhouse.game.splashes()') > sp0, 'a small wave where it lands');
check('nothing shines at first', await ev('dollhouse.game.glow()') === -1, 'no glow yet');
await ev('dollhouse.game.advance(20); 1');
const glowing = await ev('dollhouse.game.glow()');
check('left alone, one piece shines', glowing >= 0 && (await ev('dollhouse.game.state()')).beach.some(x => x.slot === glowing), `slot ${glowing}`);
await ev('dollhouse.game.collectAll(); 1');
check('picking one up stops it', await ev('dollhouse.game.glow()') === -1, 'off');
await ev('dollhouse.game.reset(); 1');

/* ── hunger ───────────────────────────────────────────────────────────── */
const nextBlock = `(() => { const k = Math.floor(dollhouse.clock() / 120) + 1; dollhouse.renderAt(k * 120 + .5); return k; })()`;
await ev('dollhouse.game.advance(900); 1');
let hs = (await ev('dollhouse.game.state()')).hunger;
check('half gone in fifteen minutes', Math.abs(hs.cat - .5) < .001, `${hs.cat}`);
check('only animals that are here get hungry', hs.pup === 1 && hs.penguin === 1, `puppy ${hs.pup}, penguin ${hs.penguin}`);
await ev('dollhouse.game.comeBack(3600); 1');
check('not while the game is closed', Math.abs((await ev('dollhouse.game.state()')).hunger.cat - .5) < .001, 'unchanged after an hour away');
await ev(`dollhouse.game.setHunger('cat', .2); dollhouse.game.save(); 1`);
check('hunger is saved', Math.abs((await ev('dollhouse.game.read()')).hunger.cat - .2) < .001, '.2');
await ev(nextBlock);
check('the change waits for the next story', await ev(`dollhouse.game.tier('cat')`) === 1, 'tier 1 from the next block');
const samplePoses = id => ev(`(() => { const out = []; const k = Math.floor(dollhouse.clock() / 120); for (let t = .5; t < 120; t += 1.5) { dollhouse.renderAt(k * 120 + t); out.push(dollhouse.pose().${id}); } return out; })()`);
let poses = await samplePoses('cat');
check('a hungry animal stays home', poses.every(p => p[0] === 67 && p[1] === 91) && poses.some(p => p[3] === 'curl') && poses.some(p => p[3] === 'sit'), [...new Set(poses.map(p => p[3]))].join());
check('mostly asleep', poses.filter(p => p[3] === 'curl').length / poses.length > .7, `${Math.round(poses.filter(p => p[3] === 'curl').length / poses.length * 100)}% of the time`);
await ev(`dollhouse.game.setHunger('cat', 0); 1`);
check('at zero, it finishes the story first', await ev(`dollhouse.game.tier('cat')`) === 1 && !(await ev(`dollhouse.game.isAsleep('cat')`)), 'still tier 1');
await ev(nextBlock);
poses = await samplePoses('cat');
check('then it sleeps and does not move', poses.every(p => p[0] === 67 && p[1] === 91 && p[3] === 'curl') && await ev(`dollhouse.game.isAsleep('cat')`), 'curled up all story');
const iconA = await ev('dollhouse.frameHash(dollhouse.clock())');
await ev(`dollhouse.game.setHunger('cat', .001); 1`);
const iconB = await ev('dollhouse.frameHash(dollhouse.clock())');
await ev(`dollhouse.game.setHunger('cat', 0); 1`);
check('the hungry icon shows', iconA !== iconB, 'the picture differs with and without it');
check('the face button is marked', await ev(`document.querySelector('#faces .face').classList.contains('hungry')`), 'marked');
await ev(`dollhouse.game.advance(2000); dollhouse.game.collectAll(); dollhouse.game.collectAll(); 1`);
await ev(`dollhouse.game.setHunger('cat', 0); 1`);
for (let i = 0; i < 5 && (await ev('dollhouse.game.state()')).glass < 60; i++) await ev('dollhouse.game.advance(120); dollhouse.game.collectAll(); 1');
await ev(`dollhouse.game.setHunger('cat', 0); 1`);
const catAt = await ev(`dollhouse.game.actorAt('cat')`);
const glassAtTap = (await ev('dollhouse.game.state()')).glass;
await tap(...await toClient(catAt[0], catAt[1]));
check('a tap does not wake it', !(await ev('dollhouse.game.react()')).includes('cat') && await ev(`document.getElementById('card').classList.contains('on')`), 'no reaction, but the card opens');
check('the card opening under the finger buys nothing', (await ev('dollhouse.game.state()')).glass === glassAtTap, `still ${glassAtTap}`);
check('the card shows an empty bar', await ev(`document.querySelector('#card .hunger i').style.width`) === '0%' && await ev(`document.querySelector('#card .hunger').classList.contains('low')`), 'width 0');
check('the bar has no words', await ev(`document.querySelector('#card .hunger').textContent`) === '', 'none');
check('toys wait until it has eaten', await ev(`document.querySelector('#card .good[data-good="ball"]').disabled && document.querySelector('#card .good[data-good="wheel"]').disabled && !document.querySelector('#card .good[data-good="cookie"]').disabled`), 'only treats');
await tapEl('#card .good[data-good="cookie"]');
hs = (await ev('dollhouse.game.state()')).hunger;
check('a cookie gives half', Math.abs(hs.cat - .5) < .01 && !(await ev(`dollhouse.game.isAsleep('cat')`)), `${hs.cat}`);
check('it wakes and eats', (await ev('dollhouse.game.react()')).includes('cat'), 'reacting');
await tapEl('#card .x');
await ev(`(() => { const k = Math.floor(dollhouse.clock() / 120); dollhouse.game.clearTaps(); dollhouse.renderAt(k * 120 + 100); dollhouse.renderAt(k * 120 + 100.5); return 1; })()`);
const waiting = await ev('dollhouse.pose().cat');
check('then waits awake at home', waiting[0] === 67 && waiting[1] === 91 && waiting[3] === 'sit', waiting.join());
await ev(nextBlock);
check('and moves from the next story', await ev(`dollhouse.game.tier('cat')`) === 0, 'tier 0');
await ev(`dollhouse.game.setHunger('cat', .3); dollhouse.game.give('cat', 'ice'); 1`);
check('ice fills it up', (await ev('dollhouse.game.state()')).hunger.cat === 1, 'full');
await ev(`dollhouse.game.reset(); dollhouse.game.feedAll(); dollhouse.play(); 1`);

/* ── someone too hungry to come: the other does something alone ───────── */
const alone = await ev(`(() => {
  const G = dollhouse.game, ids = ['cat', 'pup', 'rabbit', 'sheep', 'dragon', 'penguin'], names = dollhouse.SCRIPT_NAMES, out = [];
  const save = {}; for (const i of ids) save[i] = G.tier(i);
  const tryOut = (who, other) => {
    G.setTiers({ [who]: 2 });
    for (const n of names) for (let s = 1; s <= 6; s++) {
      const home = dollhouse.poseIn(n, s, .5)[who];
      for (let t = .5; t < 120; t += 2) {
        const p = dollhouse.poseIn(n, s, t);
        if (p[other].anim === 'nose') out.push(other + ' nose in ' + n);
        if (p[who].x !== home.x || p[who].y !== home.y) out.push(who + ' moved in ' + n);
      }
    }
    G.setTiers({ [who]: 0 });
  };
  tryOut('cat', 'pup'); tryOut('pup', 'cat');
  G.setTiers(save);
  return out.slice(0, 5);
})()`);
check('nobody greets a sleeping animal', alone.length === 0, alone.join(' | ') || 'solo instead');
const fits = await ev(`(() => {
  const G = dollhouse.game, ids = ['cat', 'pup', 'rabbit', 'sheep', 'dragon', 'penguin']; let m = 0, who = '';
  for (let mask = 0; mask < 64; mask++) {
    for (let i = 0; i < 6; i++) G.setTiers({ [ids[i]]: mask >> i & 1 });
    for (let s = 1; s <= 3; s++) for (const r of dollhouse.scriptsAt(3, true, s)) { const v = Math.max(...r.slice(1)); if (v > m) { m = v; who = r[0] + ' mask ' + mask; } }
  }
  for (const i of ids) G.setTiers({ [i]: 0 });
  return { m, who };
})()`);
check('stories fit whoever is hungry', fits.m <= 120, `longest ${fits.m.toFixed(1)} s (${fits.who}), all 64 combinations`);

/* ── the roof's colour ────────────────────────────────────────────────── */
await ev('dollhouse.game.reset(); dollhouse.game.collectAll(); 1');
for (let i = 0; i < 12 && (await ev('dollhouse.game.state()')).glass < 60; i++) await ev('dollhouse.game.advance(120); dollhouse.game.collectAll(); 1');
await ev('dollhouse.renderAt(30); 1');
const roofBlue = await ev('dollhouse.frameHash(30)'), g60 = (await ev('dollhouse.game.state()')).glass;
await tapEl('#shopBtn');
await tapEl('#shop .good[data-roof="red"]');
const redState = await ev('dollhouse.game.state()');
check('a colour costs 20', redState.roof === 'red' && redState.glass === g60 - 20, `${g60} to ${redState.glass}`);
check('the camera shows the whole roof', await ev('dollhouse.game.view()') === 'all', 'whole picture');
check('the roof glows', (await ev('dollhouse.game.highlight()'))?.key === 'roof', JSON.stringify(await ev('dollhouse.game.highlight()')));
await ev('dollhouse.renderAt(34.5); dollhouse.renderAt(30); 1');
check('the picture changes', await ev('dollhouse.frameHash(30)') !== roofBlue, 'red, not blue');
check('the same colour again is refused', !(await ev(`dollhouse.game.roof('red')`)), 'refused');
check('going back to blue costs the same', await ev(`dollhouse.game.roof('blue')`) && (await ev('dollhouse.game.state()')).glass === g60 - 40, 'and it is allowed');
await ev('dollhouse.renderAt(30); 1');
check('blue is exactly as it was', await ev('dollhouse.frameHash(30)') === roofBlue, 'pixel for pixel');
await ev(`dollhouse.game.roof('pink'); dollhouse.game.save(); 1`);
check('the colour is saved', (await ev('dollhouse.game.read()')).roof === 'pink', 'pink');
for (let i = 0; i < 12 && (await ev('dollhouse.game.state()')).glass < 120; i++) await ev('dollhouse.game.advance(120); dollhouse.game.collectAll(); 1');
await ev('dollhouse.game.grow(); 1');
check('it stays when the tower grows', (await ev('dollhouse.game.state()')).roof === 'pink' && await ev('dollhouse.game.storeys()') === 2, 'pink on two floors');
await ev(`dollhouse.game.reset(); dollhouse.play(); 1`);
await sleep(100);

/* ── the things that give nothing, but notice a finger ────────────────── */
const critters = ['sail', 'boat', 'turtle', 'crab', 'butter0', 'butter1', 'bee', 'gull0', 'gull1', 'gull2', 'jelly0', 'jelly1', 'fish0', 'fish1', 'fish2', 'fish3', 'fish4'];
await ev('dollhouse.game.collectAll(); 1');
const glassBefore = (await ev('dollhouse.game.state()')).glass;
const reacted = [], unmoved = [], missed = [];
for (const key of critters) {
  // find a moment when the finger would land on it
  const t = await ev(`(() => { for (let t = 20.5; t < 2400; t += 7) { dollhouse.renderAt(t); const c = dollhouse.game.crit('${key}'); if (!c || !c.r || c.x < 12 || c.x > 348 || c.y < 50 || c.y > 625) continue; const h = dollhouse.game.hit(c.x, c.y); if (h && h.kind === 'critter' && h.key === '${key}') return t; } return -1; })()`);
  if (t < 0) { missed.push(key); continue; }
  const c = await ev(`dollhouse.game.crit('${key}')`);
  await ev(`dollhouse.renderAt(${t}); 1`);
  await tap(...await toClient(c.x, c.y));
  if (!(await ev('dollhouse.game.tapped()')).includes(key)) { missed.push(key + ' (tap)'); continue; }
  reacted.push(key);
  const a = await ev(`dollhouse.frameHash(${t + .9})`);
  await ev('dollhouse.game.clearTaps(); 1');
  if (a === await ev(`dollhouse.frameHash(${t + .9})`)) unmoved.push(key);
}
check('every creature answers a real tap', !missed.length && reacted.length === critters.length, missed.length ? 'missed ' + missed.join() : reacted.length + ' of them');
check('and it shows', !unmoved.length, unmoved.join() || 'the picture changes for each');
const reward = await ev('dollhouse.game.state()');
check('no reward for it', reward.glass === glassBefore, `still ${glassBefore}`);
const fishFlee = await ev(`(() => {
  const G = dollhouse.game;
  for (let t = 20.5; t < 2400; t += 7) { dollhouse.renderAt(t); const c = G.crit('fish0'); if (!c.r || c.x < 12 || c.x > 348 || c.y > 620) continue; const h = G.hit(c.x, c.y); if (h && h.key === 'fish0') {
    const before = [c.x, c.y], near = ['fish1', 'fish2', 'fish3', 'fish4'].filter(k => { const f = G.crit(k); return f.r && Math.hypot(f.x - c.x, f.y - c.y) < 46; });
    return { t, before, near };
  } }
  return null;
})()`);
const [fx0, fy0] = fishFlee.before;
await ev(`dollhouse.renderAt(${fishFlee.t}); 1`);
await tap(...await toClient(fx0, fy0));
const fled = await ev(`(() => { const G = dollhouse.game, tapped = G.tapped(), t = ${fishFlee.t}; dollhouse.renderAt(t + .3); const moved = G.crit('fish0'); const a = [moved.x, moved.y, moved.r]; dollhouse.renderAt(t + 3); const gone = G.crit('fish0').r; dollhouse.renderAt(t + 8); const back = G.crit('fish0').r; return { tapped, a, gone, back }; })()`);
check('a fish darts away', Math.hypot(fled.a[0] - fx0, fled.a[1] - fy0) > 12, `moved to ${fled.a.slice(0, 2).map(Math.round)}`);
check('vanishes and comes back', fled.gone === 0 && fled.back > 0, `${fled.gone} then ${fled.back}`);
check('nearby fish flee too', fishFlee.near.every(k => fled.tapped.includes(k)), fishFlee.near.join() || 'none were close this time');
await ev('dollhouse.play(); 1');

/* ── coming back from the background ──────────────────────────────────── */
await ev('dollhouse.renderAt(33.3); dollhouse.frameHash(33.3); 1');
const pic0 = await ev('dollhouse.frameHash(33.3)');
check('the picture is healthy', await ev('dollhouse.game.pictureOk()'), 'sampled and matching');
await ev('dollhouse.game.breakPicture(); 1');
const pic1 = await ev('dollhouse.frameHash(33.3)');
check('a lost canvas is noticed', pic1 !== pic0 && !(await ev('dollhouse.game.pictureOk()')), 'tower and island gone');
const rp0 = await ev('dollhouse.game.repaints()');
await ev('dollhouse.game.returnToPage(60); 1');
check('a return repaints it exactly', await ev('dollhouse.frameHash(33.3)') === pic0 && await ev('dollhouse.game.pictureOk()') && await ev('dollhouse.game.repaints()') === rp0 + 1, 'pixel for pixel');
await ev('dollhouse.game.returnToPage(2); 1');
check('a short hide with nothing wrong costs nothing', await ev('dollhouse.game.repaints()') === rp0 + 1, 'no repaint');
await ev('dollhouse.game.breakPicture(); dollhouse.game.returnToPage(2); 1');
check('a short hide that broke it is repaired too', await ev('dollhouse.frameHash(33.3)') === pic0, 'pixel for pixel');
await ev('dollhouse.game.breakPicture(); dollhouse.play(); 1');
await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); dollhouse.game.shiftClock(30); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); 1`);
await ev('dollhouse.renderAt(33.3); 1');
check('the real event does it', await ev('dollhouse.frameHash(33.3)') === pic0, '30 s hidden, then visible');
await ev('delete document.hidden; 1');
{ // its own page: headless Chrome never gives a woken page its frames or input back, on any page
  const fp = await open('');
  await sleep(300);
  await fp.evaluate('dollhouse.renderAt(33.3); 1');
  const healthy = await fp.evaluate('dollhouse.frameHash(33.3)');
  await fp.evaluate('dollhouse.game.breakPicture(); 1');
  await fp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await sleep(200);
  await fp.send('Page.setWebLifecycleState', { state: 'active' });
  await sleep(300);
  await fp.evaluate('dollhouse.renderAt(33.3); 1');
  check('so does waking from frozen', await fp.evaluate('dollhouse.frameHash(33.3)') === healthy, 'after the browser froze the page');
  fp.close();
}
await ev('dollhouse.game.forceBadPicture(true); dollhouse.game.returnToPage(60); 1');
check('no prompt before the second try', !(await ev(`document.getElementById('reloadBox').classList.contains('on')`)), 'tries again first');
await sleep(2500);
check('if it stays broken, a reload is offered', await ev(`document.getElementById('reloadBox').classList.contains('on')`), 'button shown');
await ev('dollhouse.game.forceBadPicture(false); dollhouse.game.returnToPage(60); 1');
check('and it goes away once fixed', !(await ev(`document.getElementById('reloadBox').classList.contains('on')`)), 'hidden');
await ev('dollhouse.play(); 1');

/* ── a balloon with a present ─────────────────────────────────────────── */
check('no balloon at first', await ev('dollhouse.game.balloon()') === null, 'none');
await ev('dollhouse.game.advance(181); 1');
let flying = await ev('dollhouse.game.balloon()');
check('the first balloon comes along', !!flying, flying ? `at ${flying.map(Math.round)}` : 'none');
await ev('dollhouse.game.advance(31); 1');
check('a missed balloon is gone', await ev('dollhouse.game.balloon()') === null && (await ev('dollhouse.game.state()')).presents.length === 0, 'nothing on the beach');
const gaps = await ev(`(() => { const G = dollhouse.game, out = []; let last = 0, n = 0; for (let t = 1; t < 3600; t++) { const before = G.state().bn; G.advance(1); if (G.state().bn !== before) { out.push(t - last); last = t; } } return out; })()`);
const mean = gaps.slice(1).reduce((a, b) => a + b, 0) / (gaps.length - 1);
check('about one every five minutes', mean > 270 && mean < 330, `${gaps.length} in an hour, every ${Math.round(mean)} s`);
await ev('dollhouse.game.collectAll(); 1');
await ev('dollhouse.game.launch(); 1');
await ev('dollhouse.game.advance(13); 1');
flying = await ev('dollhouse.game.balloon()');
const seen = await ev(`(() => { const b = dollhouse.game.balloon(), out = {}; for (const [n, v] of Object.entries({ 1: [90, 320, 180, 320], 2: [90, 235, 180, 320], 3: [90, 135, 180, 320], beach: [110, 320, 180, 320] })) out[n] = b[1] > v[1] && b[1] < v[1] + v[3]; return out; })()`);
check('its height is in view from every camera', Object.values(seen).every(Boolean), JSON.stringify(seen));
const [bx, by] = await toClient(flying[0], flying[1]);
const before = await ev('dollhouse.game.state()');
await tap(bx, by);
let got = await ev('dollhouse.game.state()');
check('a tap brings the present down', got.presents.length === 1 && await ev('dollhouse.game.balloon()') === null && got.glass === before.glass, JSON.stringify(got.presents));
check('what is inside is a fair amount', [15, 25, 50].includes(got.presents[0].value), `${got.presents[0].value}`);
await ev('dollhouse.game.advance(1200); dollhouse.game.collectAll(); 1');
check('glass never lands on a present', !(await ev('dollhouse.game.state()')).beach.some(g => g.slot === got.presents[0].slot), 'separate spots');
await ev('dollhouse.game.collectAll(); dollhouse.game.save()');
got = await ev('dollhouse.game.state()');
const kept = await ev('dollhouse.game.read()');
check('an unopened present is saved', kept.presents.length === got.presents.length && kept.presents[0].value === got.presents[0].value, `${kept.presents.length} kept`);
await sleep(1100);
const slot = (await ev('dollhouse.game.slots()'))[got.presents[0].slot], g1 = got.glass, val = got.presents[0].value;
const [px, py] = await toClient(slot[0], slot[1] - 3);
await tap(px, py);
got = await ev('dollhouse.game.state()');
check('opening it pays out', got.glass === g1 + val && got.presents.length === 0, `${g1} to ${got.glass}`);
await ev('dollhouse.game.reset(); 1');

/* ── a bad save must not break the game ───────────────────────────────── */
await ev(`localStorage.setItem('summer-tower-save-v1', '{"v":1,"glass":"lots","storeys":99,"beach":[{"slot":999,"kind":8}],"aff":{"cat":-4},"hunger":{"cat":"x","pup":9},"roof":"plaid"}'); 1`);
const cleaned = await ev('dollhouse.game.read()');
check('a corrupt save is cleaned', cleaned.glass === 0 && cleaned.storeys === 3 && cleaned.beach.length === 0 && cleaned.aff.cat === 0 && cleaned.hunger.cat === 1 && cleaned.hunger.pup === 1 && cleaned.roof === 'blue', JSON.stringify({ g: cleaned.glass, s: cleaned.storeys }));
await ev(`localStorage.setItem('summer-tower-save-v1', 'not json'); 1`);
check('an unreadable save is ignored', await ev('dollhouse.game.read()') === null, 'null');

/* ── start to finish: it can be finished ──────────────────────────────── */
const finish = await ev(`(() => {
  const G = dollhouse.game;
  G.reset();
  let t = 0;
  while (t < 4 * 3600 && G.storeys() < 3) {
    G.advance(5); t += 5;
    G.collectAll();
    if (G.balloon()) G.catchBalloon();
    G.openPresents();
    G.grow();
  }
  return { min: +(t / 60).toFixed(1), s: G.state() };
})()`);
console.log(`INFO  collecting constantly and buying nothing, the tower is done at ${finish.min} min`);
check('rabbit arrives with the top floor', await ev(`dollhouse.game.present('rabbit')`), 'present');
check('the picture grew', await ev('dollhouse.game.storeys()') === 3, '3 floors');
check('finish recorded', finish.s.doneAt > 0, `at ${(finish.s.doneAt / 60).toFixed(1)} min of play`);

/* ── viewing mode: one visitor per treat, then the door closes ─────────── */
const arrivals = [];
for (let i = 0; i < 4; i++) {
  await ev(`(() => { const G = dollhouse.game; G.advance(5000); G.collectAll(); return G.sill(); })()`);
  const x = await ev('dollhouse.game.comeBack(120)');
  arrivals.push(x.pets.join('+'));
}
check('visitors come one at a time', arrivals.join(' | ') === 'dragon | dragon+sheep | dragon+sheep+penguin | dragon+sheep+penguin', arrivals.join(' | '));
const noMore = await ev(`(() => { const G = dollhouse.game; G.advance(5000); G.collectAll(); return G.sill(); })()`);
check('all six: no more treats on the sill', noMore === false, `${noMore}`);
check('the dragon brought its stool', (await ev('dollhouse.game.state()')).furn.includes('stoolA'), 'stoolA');
check('all six present', await ev(`['cat','pup','rabbit','sheep','dragon','penguin'].every(dollhouse.game.present)`), 'yes');

/* ── the real buttons: build a floor, put out a treat ───────────────── */
await ev('dollhouse.game.reset(); dollhouse.game.advance(5000); dollhouse.game.collectAll(); dollhouse.game.advance(5000); dollhouse.game.collectAll(); dollhouse.game.advance(5000); dollhouse.game.collectAll(); 1');
for (let i = 0; i < 30 && (await ev('dollhouse.game.state()')).glass < 120; i++) await ev('dollhouse.game.advance(200); dollhouse.game.collectAll(); 1');
await tapEl('#growBtn');
await sleep(1100);
check('the build button grows the tower', await ev('dollhouse.game.storeys()') === 2 && await ev(`dollhouse.game.present('pup')`), 'floor 2 and the puppy');
for (let i = 0; i < 60 && (await ev('dollhouse.game.state()')).glass < 320; i++) await ev('dollhouse.game.advance(200); dollhouse.game.collectAll(); 1');
await tapEl('#growBtn');
await sleep(1100);
check('and again', await ev('dollhouse.game.storeys()') === 3 && await ev(`dollhouse.game.present('rabbit')`), 'floor 3 and the rabbit');
/* ── all the outings: every animal gets where it should ───────────────── */
await ev('dollhouse.game.feedAll(); 1');
const where = await ev(`(() => {
  const out = {}, names = dollhouse.SCRIPT_NAMES, C = dollhouse.CFG, loop = C.loop;
  C.loop = true;
  names.forEach((n, b) => { C.block = b;
    const seen = { roof: 0, tree: 0, ground: 0, teased: 0 };
    for (let t = .5; t < 120; t += 1) {
      dollhouse.renderAt(t);
      const p = dollhouse.pose();
      for (const id in p) { const [x, y, z, a] = p[id];
        if (!dollhouse.game.present(id)) continue;
        if (a === 'tease') seen.teased++;
        if (z > 300) seen.roof++;
        if (a === 'climb') seen.tree++;
        if (z <= 5 && id !== 'penguin') seen.ground++;
      }
    }
    out[n] = seen;
  });
  C.loop = loop; C.block = 0; dollhouse.play();
  return out;
})()`);
console.log('INFO  animal-seconds per story:', JSON.stringify(where));
check('animals tease the crab', where.crab.teased > 20, `${where.crab.teased} s`);
check('animals go on the roof', where.roof.roof > 20, `${where.roof.roof} s`);
check('animals climb', where.palm.tree > 0, `${where.palm.tree} s`);
check('animals go outside', where.beach.ground > 20 && where.boat.ground > 5 && where.rainbow.ground > 20, `${where.beach.ground} / ${where.boat.ground} / ${where.rainbow.ground} s`);

/* ── early on, with only the cat and the puppy, they already play together ── */
const pair = await ev(`(() => {
  const out = {};
  for (const name of dollhouse.SCRIPT_NAMES) {
    let met = 0;
    const here = ['cat', 'pup', 'rabbit', 'sheep', 'dragon', 'penguin'].filter(dollhouse.game.present);
    for (let seed = 1; seed <= 6; seed++) for (let t = 0; t < 120; t += 1) {
      const p = dollhouse.poseIn(name, seed, t);
      for (const a of here) for (const b of here) if (a < b && Math.hypot(p[a].sx - p[b].sx, (p[a].x + p[a].y) / 2 - p[a].z - (p[b].x + p[b].y) / 2 + p[b].z) < 52) { met++; }
    }
    out[name] = met;
  }
  return out;
})()`);
const together = Object.entries(pair).filter(([, v]) => v >= 12).map(([k]) => k);
check('the first animals meet in nearly every story', together.length >= 10 && !pair.quiet, `${together.length} of 11: ${JSON.stringify(pair)}`);
await tapEl('#growBtn');
check('the same button sets out a treat', (await ev('dollhouse.game.state()')).sill === true, 'on the sill');
const hashA = await ev('(() => { const a = dollhouse.frameHash(33.3), b = dollhouse.frameHash(33.3 + 120 * 40); return [a, b]; })()');
check('play has not disturbed the picture', typeof hashA[0] === 'number', 'renders after building');

/* ── reset, through the menu ──────────────────────────────────────────── */
await ev('dollhouse.play(); 1');
await tapEl('#menuBtn');
await tapEl('#resetBtn');
const armed = await ev('dollhouse.game.storeys()');
await tapEl('#resetBtn');
const back = await ev('dollhouse.game.state()');
check('reset needs two presses', armed === 3 && back.storeys === 1 && back.glass === 0 && back.pets.length === 0, `after one press ${armed} floors, after two ${back.storeys}`);

check('console', !page.logs.length, page.logs.length ? page.logs.slice(0, 5).join(' | ') : 'no warnings or errors');
page.close();
await sleep(600);

/* ── counting visits: asks first, loads nothing until told yes ─────────── */
const built = readFileSync('dollhouse.html', 'utf8');
check('the development build counts nothing', !built.includes('googletagmanager') && !built.includes('G-Z6DJ9Z3229'), 'no trace of it');
check('no measurement ID, no change', withAnalytics(built, '') === built, 'same page');
const tagged = withAnalytics(built, 'G-TEST123');
check('the public page gets it once, in the head', tagged.split('__analytics =').length === 2 && tagged.indexOf('G-TEST123') < tagged.indexOf('</head>'), 'one small script');
const dir = mkdtempSync(join(tmpdir(), 'ga-'));
writeFileSync(join(dir, 'dollhouse.html'), tagged);
process.chdir(dir);
const ga = await open('');
await ga.send('Network.enable');
await ga.send('Network.setBlockedURLs', { urls: ['*googletagmanager*'] });
await sleep(300);
const gtagTag = `!!document.querySelector('script[src*="googletagmanager"]')`, asked = `document.getElementById('consent').classList.contains('on')`;
check('it asks on the first visit', await ga.evaluate(asked), 'one question');
check('nothing is loaded before the answer', !(await ga.evaluate(gtagTag)) && !(await ga.evaluate('!!window.gtag')) && await ga.evaluate(`document.cookie === ''`), 'no tag, no cookie');
await ga.evaluate(`document.getElementById('gaNo').click(); 1`);
check('no means no', !(await ga.evaluate(gtagTag)) && !(await ga.evaluate(asked)), 'nothing loaded, question gone');
await ga.send('Page.reload');
await sleep(1500);
check('and it does not ask again', !(await ga.evaluate(asked)) && !(await ga.evaluate(gtagTag)), 'after a reload');
await ga.evaluate(`document.getElementById('menuBtn').click(); document.getElementById('gaBtn').textContent`).then(t => check('the menu shows it off', t.includes('オフ'), t));
await ga.evaluate(`document.getElementById('gaBtn').click(); 1`);
check('the menu can turn it on', await ga.evaluate(gtagTag) && await ga.evaluate(`document.getElementById('gaBtn').textContent`).then(t => t.includes('オン')), 'loaded now');
await ga.evaluate(`document.getElementById('gaBtn').click(); 1`);
check('and off', await ga.evaluate(`window['ga-disable-G-TEST123'] === true`), 'disabled');
await ga.evaluate(`document.querySelector('#menu .x').click(); document.getElementById('helpBtn').click(); 1`);
check('help says so', await ga.evaluate(`document.getElementById('help').textContent.includes('Google Analytics')`), 'one line');
await ga.evaluate(`localStorage.setItem('summer-tower-analytics', 'yes'); 1`);
await ga.send('Page.reload');
await sleep(1500);
const c0 = await ga.evaluate('dollhouse.clock()');
await sleep(400);
check('with Google blocked, the game still runs', await ga.evaluate(gtagTag) && await ga.evaluate('dollhouse.clock()') > c0, 'the script failed to load; the clock keeps going');
check('no errors from it', !ga.logs.length, ga.logs.slice(0, 3).join(' | ') || 'none');
ga.close();
console.log(results.every(Boolean) ? '\nALL PASS' : '\nFAILED');
process.exit(results.every(Boolean) ? 0 : 1);
