// Plays the game itself and exits 1 if a rule breaks: node tools/game_test.mjs
// Real pointer and touch events go through the browser, so hit-testing and buttons are exercised too.
import { open } from './drive.mjs';

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
const tap = async (cx, cy) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
check('only floors that exist are for sale', await ev(`[...document.querySelectorAll('#shop .good')].every(b => dollhouse.game.furniture[b.dataset.furn].floor === 1)`), 'floor 1 only');
const beforeRug = await ev('dollhouse.game.state()');
await tapEl('#shop .good[data-furn="rug1"]');
const afterRug = await ev('dollhouse.game.state()');
check('buying furniture costs glass', afterRug.glass === beforeRug.glass - 8 && afterRug.furn.includes('rug1'), `glass ${beforeRug.glass} to ${afterRug.glass}`);
const withRug = await painted('rugF1');
check('it appears in the room', withRug > 100, `${withRug} px`);
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

/* ── while it is closed ───────────────────────────────────────────────── */
const st0 = (await ev('dollhouse.game.state()')).stash;
let r = await ev('dollhouse.game.comeBack(45 * 10)');
check('absence fills the bottle', r.stash === st0 + 10, `ten bottle periods gives ${r.stash}`);
r = await ev('dollhouse.game.comeBack(3600 * 24 * 7)');
check('the bottle has a small cap', r.stash === 30, `a week away gives ${r.stash}`);
r = await ev('dollhouse.game.comeBack(-5000)');
check('a clock turned back gives nothing', r.stash === 30, `${r.stash}`);
const g0 = r.glass;
await tapEl('#bottleBtn');
r = await ev('dollhouse.game.state()');
check('opening the bottle', r.glass === g0 + 30 && r.stash === 0, `${g0} to ${r.glass}`);

/* ── a bad save must not break the game ───────────────────────────────── */
await ev(`localStorage.setItem('summer-tower-save-v1', '{"v":1,"glass":"lots","storeys":99,"beach":[{"slot":999,"kind":8}],"aff":{"cat":-4}}'); 1`);
const cleaned = await ev('dollhouse.game.read()');
check('a corrupt save is cleaned', cleaned.glass === 0 && cleaned.storeys === 3 && cleaned.beach.length === 0 && cleaned.aff.cat === 0, JSON.stringify({ g: cleaned.glass, s: cleaned.storeys }));
await ev(`localStorage.setItem('summer-tower-save-v1', 'not json'); 1`);
check('an unreadable save is ignored', await ev('dollhouse.game.read()') === null, 'null');

/* ── start to finish, simulated: how long does the tower take? ────────── */
const play = (name, every, spendShare) => ev(`(() => {
  const G = dollhouse.game;
  G.reset();
  let spent = 0, t = 0, floor2 = 0, floor3 = 0, last = 0;
  const animals = ['cat', 'pup', 'rabbit'], goods = ['cookie', 'ball', 'ice', 'wheel'];
  let turn = 0;
  while (t < 4 * 3600) {
    G.advance(1); t++;
    if (t - last >= ${every}) {
      last = t;
      G.collectAll();
      let s = G.state();
      // spend part of what comes in on the animals, as a player does between floors
      while (s.total * ${spendShare} > spent) {
        const who = animals[turn % animals.length], good = goods[turn % goods.length];
        turn++;
        if (!G.present(who) || s.aff[who] >= 10) { if (turn > 3000) break; if (animals.every(a => !G.present(a) || s.aff[a] >= 10)) break; continue; }
        const price = G.goods[good].price;
        if (s.glass < price) break;
        G.buy(who, good);
        spent += price;
        s = G.state();
      }
      if (G.grow()) { if (G.storeys() === 2) floor2 = t; if (G.storeys() === 3) { floor3 = t; break; } }
      // the rest of the share goes on furniture, cheapest first
      for (const key of G.left()) {
        s = G.state();
        if (s.total * ${spendShare} <= spent || s.glass < G.furniture[key].price) break;
        if (G.furnish(key)) spent += G.furniture[key].price;
      }
    }
  }
  return { name: ${JSON.stringify(name)}, floor2: +(floor2 / 60).toFixed(1), floor3: +(floor3 / 60).toFixed(1), spent, s: G.state() };
})()`);
const fast = await play('collects constantly, buys nothing', 5, 0);
const usual = await play('collects often, spends a third on animals and furniture', 8, .33);
const slow = await play('checks back every minute, spends a third', 60, .33);
for (const p of [fast, usual, slow]) console.log(`INFO  ${p.name}: floor 2 at ${p.floor2} min, floor 3 at ${p.floor3} min, spent ${p.spent}`);
check('about an hour', usual.floor3 >= 50 && usual.floor3 <= 72, `the usual player finishes at ${usual.floor3} min`);
check('rabbit arrives with the top floor', await ev(`dollhouse.game.present('rabbit')`), 'present');
check('the picture grew', await ev('dollhouse.game.storeys()') === 3, '3 floors');
check('finish recorded', slow.s.doneAt > 0, `at ${(slow.s.doneAt / 60).toFixed(1)} min of play`);

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
for (let i = 0; i < 30 && (await ev('dollhouse.game.state()')).glass < 50; i++) await ev('dollhouse.game.advance(200); dollhouse.game.collectAll(); 1');
await tapEl('#growBtn');
await sleep(1100);
check('the build button grows the tower', await ev('dollhouse.game.storeys()') === 2 && await ev(`dollhouse.game.present('pup')`), 'floor 2 and the puppy');
for (let i = 0; i < 60 && (await ev('dollhouse.game.state()')).glass < 320; i++) await ev('dollhouse.game.advance(200); dollhouse.game.collectAll(); 1');
await tapEl('#growBtn');
await sleep(1100);
check('and again', await ev('dollhouse.game.storeys()') === 3 && await ev(`dollhouse.game.present('rabbit')`), 'floor 3 and the rabbit');
/* ── all the outings: every animal gets where it should ───────────────── */
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
console.log(results.every(Boolean) ? '\nALL PASS' : '\nFAILED');
process.exit(results.every(Boolean) ? 0 : 1);
