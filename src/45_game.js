/* ═══════════════════════════════════════════════════════════════════════
   The game: sea glass, growing the tower, treats and toys, saving. Its state
   lives apart from the picture's clock. The picture only reads WORLD and
   storeys, so anything here can change without touching the 120 s timelines.
   ═══════════════════════════════════════════════════════════════════════ */
const SAVE_KEY = 'summer-tower-save-v1';
const RULES = {
  floorCost: { 2: 120, 3: 300 },
  spawnEvery: 10,          // a new piece of glass, seconds
  beachCap: 12,            // never more than this lying about
  hungerMinutes: 30,       // from full to empty, while the game is open
  roofPrice: 20,
  glowAfter: 15,           // nothing picked up for this long: one piece starts to shine
  repaintAfter: 10,        // hidden this long: the whole picture is drawn again on return
  balloonFirst: 180,       // the first balloon comes early, so it gets noticed
  balloonEvery: [240, 360],  // then one per this many seconds, while the game is open
  balloonCross: 30,        // seconds to cross the sea
  presentCap: 12,
  highlightFor: 3,         // how long a new piece of furniture glows
  resumeAfter: 60,         // a hidden tab this long counts as having been closed
  sillPrice: 10,
};
const KINDS = [
  { id: 'blue', value: 1, chance: .72 },
  { id: 'green', value: 2, chance: .23 },
  { id: 'amber', value: 5, chance: .05 },
];
const GOODS = {
  cookie: { name: '貝がらクッキー', type: 'おやつ', price: 5, gain: 1, dur: 5, fill: .5 },
  ice: { name: 'ラムネアイス', type: 'おやつ', price: 12, gain: 2, dur: 6.5, fill: 1 },
  ball: { name: 'ビーチボール', type: 'おもちゃ', price: 8, gain: 2, dur: 8 },
  wheel: { name: 'かざぐるま', type: 'おもちゃ', price: 15, gain: 3, dur: 9 },
};
const ANIMALS = {
  cat: { name: 'ねこ' }, pup: { name: 'こいぬ' }, rabbit: { name: 'うさぎ' },
  dragon: { name: 'ちびドラゴン' }, sheep: { name: 'くものひつじ' }, penguin: { name: 'ペンギン' },
};
/* Each floor starts with its animal's bed. Everything here is bought, and at: is where the sparkle goes. */
const FURNITURE = {
  doorMat: { floor: 1, name: 'ドアマット', price: 4, at: [69, 26, Z1] },
  blocks: { floor: 1, name: '積み木', price: 6, at: [46, 28, Z1 + 8] },
  chime: { floor: 1, name: '風鈴', price: 6, at: [...worldAt(53, -8), Z1 + 56] },
  rug1: { floor: 1, name: '丸いラグ', price: 8, at: [56, 58, Z1] },
  basket: { floor: 1, name: 'まりのかご', price: 10, at: [86, 80, Z1 + 6] },
  mobile: { floor: 1, name: '星のモビール', price: 10, at: [...worldAt(-6, -9), Z1 + 36] },
  shelf1: { floor: 1, name: '絵本の棚', price: 12, at: [...worldAt(-15, -29), Z1 + 10] },
  tent: { floor: 1, name: 'テント', price: 20, at: [82, 54, Z1 + 10] },
  catTree: { floor: 1, name: 'キャットタワー', price: 25, at: [43, 85, Z1 + 22] },
  bowls: { floor: 2, name: 'ごはん皿', price: 6, at: [93, 55, Z2] },
  stoolA: { floor: 2, name: 'きのこのいす', price: 6, at: [32, 66, Z2 + 6] },
  stoolB: { floor: 2, name: '金魚ばち', price: 12, at: [78, 84, Z2 + 8] },
  counter: { floor: 2, name: '調理台', price: 15, at: [...worldAt(0, -28), Z2 + 8] },
  lemon: { floor: 2, name: 'レモンの木', price: 15, at: [46, 96, Z2 + 20] },
  icebox: { floor: 2, name: '冷蔵庫', price: 18, at: [63, 21, Z2 + 16] },
  table: { floor: 2, name: 'テーブル', price: 20, at: [52, 62, Z2 + 14] },
  oven: { floor: 2, name: 'れんが窯', price: 25, at: [...worldAt(-17, -25), Z2 + 10] },
  lantern: { floor: 3, name: '星のランタン', price: 8, at: [...worldAt(-30, 4), Z3 + 44] },
  rug3: { floor: 3, name: '三日月のラグ', price: 10, at: [76, 68, Z3] },
  lamp: { floor: 3, name: '貝のランプ', price: 12, at: [27, 80, Z3 + 14] },
  bookcase: { floor: 3, name: '本棚', price: 14, at: [...worldAt(13, -29), Z3 + 10] },
  telescope: { floor: 3, name: '望遠鏡', price: 18, at: [74, 26, Z3 + 12] },
  bed3: { floor: 3, name: '大きなベッド', price: 30, at: [36, 62, Z3 + 8] },
};
const FURN_KEYS = Object.keys(FURNITURE);
const PET_ORDER = ['dragon', 'sheep', 'penguin'];
const PRESENT_VALUES = [15, 25, 50];
const ROOF_NAMES = { blue: '青', red: '赤', green: '緑', pink: 'ピンク' };
const newState = () => ({
  v: 1, glass: 0, total: 0, storeys: 1, pets: [],
  aff: { cat: 0, pup: 0, rabbit: 0, sheep: 0, dragon: 0, penguin: 0 },
  hunger: { cat: 1, pup: 1, rabbit: 1, sheep: 1, dragon: 1, penguin: 1 },
  roof: 'blue',
  beach: [], n: 0, spawnIn: 6, sill: false, played: 0, doneAt: 0, lastSeen: 0, furn: [],
  presents: [], balloonIn: RULES.balloonFirst, bn: 0,
});
let GS = newState();
let gameOn = false;
let clockShift = 0;                                  // tests move time; the picture never reads it
const nowMs = () => Date.now() + clockShift;

/* ── save and load: a blocked or corrupt store must never stop the game ── */
function saveGame() {
  if (!gameOn) return false;
  GS.lastSeen = nowMs();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(GS)); return true; } catch (e) { return false; }
}
function cleanNum(v, lo, hi, d) { return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
function readSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  let o;
  try { o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || o.v !== 1) return null;
  const s = newState();
  s.glass = cleanNum(o.glass, 0, 1e7, 0) | 0;
  // an old save's bottle is simply not read: what was in it, and what it cost, are gone
  for (const k in s.hunger) s.hunger[k] = cleanNum(o.hunger && o.hunger[k], 0, 1, 1);
  if (ROOF_NAMES[o.roof]) s.roof = o.roof;
  s.presents = Array.isArray(o.presents) ? o.presents.filter(p => p && Number.isInteger(p.slot) && p.slot >= 0 && p.slot < 60 && PRESENT_VALUES.includes(p.value)).slice(0, RULES.presentCap) : [];
  s.balloonIn = cleanNum(o.balloonIn, 0, RULES.balloonEvery[1], RULES.balloonFirst);
  s.bn = cleanNum(o.bn, 0, 1e9, 0) | 0;
  s.total = cleanNum(o.total, 0, 1e9, 0) | 0;
  s.storeys = cleanNum(o.storeys, 1, 3, 1) | 0;
  s.pets = Array.isArray(o.pets) ? PET_ORDER.filter(p => o.pets.includes(p)) : [];
  for (const k in s.aff) s.aff[k] = cleanNum(o.aff && o.aff[k], 0, 10, 0) | 0;
  s.beach = Array.isArray(o.beach) ? o.beach.filter(g => g && Number.isInteger(g.slot) && g.slot >= 0 && g.slot < 60 && KINDS[g.kind]).slice(0, RULES.beachCap) : [];
  s.n = cleanNum(o.n, 0, 1e9, 0) | 0;
  s.spawnIn = cleanNum(o.spawnIn, 0, RULES.spawnEvery, RULES.spawnEvery);
  s.sill = !!o.sill;
  s.played = cleanNum(o.played, 0, 1e10, 0);
  s.doneAt = cleanNum(o.doneAt, 0, 1e10, 0);
  s.lastSeen = cleanNum(o.lastSeen, 0, 1e15, 0);
  // a save from before furniture could be bought keeps its progress and starts with the beds
  s.furn = Array.isArray(o.furn) ? FURN_KEYS.filter(k => o.furn.includes(k)) : [];
  if (s.pets.includes('dragon') && !s.furn.includes('stoolA')) s.furn.push('stoolA');
  return s;
}

/* ── the beach: where glass may lie ───────────────────────────────────── */
const SLOTS = [];
function initSlots() {
  SLOTS.length = 0;
  const isl = NAMED.island.id, clear = (sx, sy) => {
    for (let a = -4; a <= 4; a += 2) for (let b = -3; b <= 3; b += 2) if (gId[(sy + b) * W + sx + a] !== isl) return false;
    return true;
  };
  for (let n = 0; n < 9000 && SLOTS.length < 48; n++) {
    const sx = 14 + hsh(n, 151) * (W - 28) | 0, sy = 396 + hsh(n, 152) * 160 | 0;
    const f = shoreF(sx, sy);
    if (f < .78 || f > .95 || !clear(sx, sy)) continue;
    if (FROND.some(p => Math.hypot(p.tx - sx, p.ty - sy) < 34)) continue;
    if (SLOTS.some(s => Math.hypot(s.x - sx, s.y - sy) < 15)) continue;
    SLOTS.push({ x: sx, y: sy });
  }
}
const GLASS_SPR = [
  mk(['...ooo...', '..oWWao..', '.oWaaaao.', 'oWaaaaabo', 'oaaaaabbo', '.oabbbbo.', '..oooo...'], 'o:sea1 W:cld7 a:sea6 b:sea4', 4, 4),
  mk(['..oooo...', '.oWWaao..', 'oWaaaaao.', 'oWaaaaabo', '.oaaaabbo', '.ooabbbo.', '...oooo..'], 'o:lef1 W:cld7 a:lef6 b:lef4', 4, 4),
  mk(['...ooo...', '..oWWao..', '.oWaaaao.', 'oWaaaaabo', 'oaaaaaabo', 'oaaaabbbo', '.oabbbo..', '..oooo...'], 'o:hon1 W:cld7 a:amb7 b:amb5', 4, 4),
];
/* a star that opens and closes */
function drawCross(x, y, reach, col = P.cld7) {
  spx(x, y, P.cld7);
  for (let k = 1; k <= reach; k++) {
    const c = k === reach ? P.sea7 : col;
    spx(x - k, y, c); spx(x + k, y, c); spx(x, y - k, c); spx(x, y + k, c);
  }
}
/* the sea leaves it there: a small splash where it lands */
const SPLASHES = [];
function drawSplashes(now) {
  for (let n = SPLASHES.length - 1; n >= 0; n--) {
    const p = SPLASHES[n], u = (now - p.t0) / .8;
    if (u >= 1 || u < 0) { SPLASHES.splice(n, 1); continue; }
    const r = 3 + u * 10;
    for (let a = 0; a < 16; a++) if (a % 2 || u < .5) spx(Math.round(p.x + Math.cos(a / 16 * TAU) * r), Math.round(p.y + Math.sin(a / 16 * TAU) * r * .45), P.cld7);
    for (let i = 0; i < 5; i++) spx(p.x - 6 + i * 3, p.y - 2 - Math.round(Math.sin(u * Math.PI) * (5 + (i % 3) * 3)), P.cld7);
  }
}
/* big enough to see from the whole-island camera */
const BALLOON_SPR = (() => {
  const rx = 10, ry = 12, rows = [];
  for (let y = -ry; y <= ry; y++) {
    let row = '';
    for (let x = -rx; x <= rx; x++) {
      const w = rx * (y > 0 ? 1 - y / ry * .28 : 1), d = (x / w) ** 2 + (y / ry) ** 2;
      row += d > 1 ? '.' : d > .8 ? 'o' : Math.hypot(x + 4, y + 5) < 2.4 ? 'W' : x + y > 7 ? 'p' : 'P';
    }
    rows.push(row);
  }
  rows.push('.........ooo.........', '........oPPPo........', '.........ooo.........');
  return mk(rows, 'o:ter3 P:ter6 p:ter5 W:cld7', rx, rows.length - 1);
})();
const PRESENT_SPR = mk([
  '....rr.rr....',
  '.....rrr.....',
  'ooooooroooooo',
  'oBBBBBrBBBBBo',
  'oBBBBBrBBBBbo',
  'oBBBBBrBBBbbo',
  'oBBBBBrBBbbbo',
  'oBBBBBrBbbbbo',
  'ooooooooooooo',
], 'o:rose2 r:amb7 B:pin6 b:pin5', 6, 8);
function drawGameGround(t) {
  for (const p of WORLD.presents) {
    if (FALLING.some(f => f.slot === p.slot)) continue;
    const s = SLOTS[p.slot];
    if (!s) continue;
    const c = cyc(t, 16, p.slot * .13), hop = c < .05 ? Math.round(Math.sin(c / .05 * Math.PI) * 3) : 0;
    sblit(PRESENT_SPR, s.x, s.y - hop);
    if (c > .1 && c < .16) { spx(s.x + 4, s.y - 9, P.cld7); spx(s.x + 3, s.y - 9, P.cld7); spx(s.x + 5, s.y - 9, P.cld7); spx(s.x + 4, s.y - 10, P.cld7); spx(s.x + 4, s.y - 8, P.cld7); }
  }
  drawSplashes(WORLD.now);
  for (const g of WORLD.beach) {
    const s = SLOTS[g.slot];
    if (!s) continue;
    const k = g.kind, tw = cyc(t, 12 + g.slot % 7, g.slot * .13);
    if (g.slot === WORLD.glow) {     // it has been waiting: a slow, wide pulse that's hard to miss
      const p = .5 + .5 * Math.sin(WORLD.now * 4.5), rx = 9 + p * 5, ry = 5 + p * 3, col = k === 2 ? P.amb7 : k === 1 ? P.lef7 : P.sea7;
      for (let a = 0; a < 26; a++) if ((a + (WORLD.now * 6 | 0)) % 2) spx(Math.round(s.x + Math.cos(a / 26 * TAU) * rx), Math.round(s.y - 1 + Math.sin(a / 26 * TAU) * ry), col);
      sblit(GLASS_SPR[k], s.x, s.y - Math.round(p * 2));
      drawCross(s.x - 1, s.y - 4 - Math.round(p * 2), 3 + Math.round(p * 4));
      continue;
    }
    sblit(GLASS_SPR[k], s.x, s.y);
    if (tw < .1) drawCross(s.x - 1, s.y - 3, 1 + Math.round(Math.sin(tw / .1 * Math.PI) * 4));
  }
  if (WORLD.sillTreat && storeys >= 2) {
    const s = -53, sy = scrY(backT(s) + 2, Z2 + 18);
    sblit(ITEM.dish, OX + s, sy); sblit(ITEM.cookie, OX + s, sy - 2);
  }
}
function drawGameSparks() {
  const S_ = WORLD.sparks, now = WORLD.now;
  drawBalloons(now);
  for (let n = S_.length - 1; n >= 0; n--) {
    const p = S_[n], e = now - p.t0;
    if (e < 0) continue;
    if (e > p.life) { S_.splice(n, 1); continue; }
    const u = e / p.life, r = p.r * Math.sqrt(u);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + p.seed;
      spx(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * .7 - u * 5), u < .6 ? P.cld7 : P[p.col]);
    }
  }
}
/* ── the balloon: it belongs to the open game, never to the 120 s picture ── */
let FLOAT = null;                 // the balloon on its way across; a closed page has none
const FALLING = [], LOOSE = [], BURSTS = [];
function balloonAt() {
  if (!FLOAT) return null;
  const u = FLOAT.e / RULES.balloonCross, x = FLOAT.dir > 0 ? -20 + u * 400 : 380 - u * 400;
  return [x + Math.sin(FLOAT.e * .9 + FLOAT.n) * 4, FLOAT.y + Math.sin(FLOAT.e * .6 + FLOAT.n * 2) * 7];
}
function drawBalloonSprite(x, y, withGift) {
  const X = Math.round(x), Y = Math.round(y);
  sblit(BALLOON_SPR, X, Y - 17);
  for (let k = 0; k < 8; k++) spx(X + (k % 4 === 1 ? 1 : 0), Y - 16 + k, P.cld5);
  if (withGift) sblit(PRESENT_SPR, X, Y);
}
function drawBalloons(now) {
  const at = balloonAt();
  if (at) drawBalloonSprite(at[0], at[1], true);
  for (let n = LOOSE.length - 1; n >= 0; n--) {
    const b = LOOSE[n], e = now - b.t0;
    if (e > 2.4 || e < 0) { LOOSE.splice(n, 1); continue; }
    drawBalloonSprite(b.x + Math.sin(e * 3) * 3, b.y - e * e * 34 - e * 12, false);
  }
  for (let n = FALLING.length - 1; n >= 0; n--) {
    const f = FALLING[n], u = (now - f.t0) / .9, s = SLOTS[f.slot];
    if (u >= 1 || u < 0) {
      FALLING.splice(n, 1);
      for (let i = 0; i < 4; i++) spark(s.x + (i - 1.5) * 4, s.y, 'crm7', 6, .4);
      continue;
    }
    sblit(PRESENT_SPR, Math.round(lerp(f.x, s.x, u)), Math.round(lerp(f.y, s.y, u * u)));
  }
  for (let n = BURSTS.length - 1; n >= 0; n--) {
    const b = BURSTS[n], e = now - b.t0;
    if (e > 1.1 || e < 0) { BURSTS.splice(n, 1); continue; }
    for (let i = 0; i < b.count; i++) {
      const a = hsh(i, b.seed, 183) * TAU, v = 22 + hsh(i, b.seed, 184) * 34;
      const x = b.x + Math.cos(a) * v * e, y = b.y - 6 + Math.sin(a) * v * e * .6 - 46 * e + 74 * e * e;
      if (e < .8 || i % 2) sblit(GLASS_SPR[i % 3], Math.round(x), Math.round(y));
    }
  }
}
function spark(x, y, col = 'sea6', r = 9, life = .55) {
  if (WORLD.sparks.length < 40) WORLD.sparks.push({ x, y, col, r, life, t0: WORLD.now, seed: WORLD.sparks.length });
}

/* ── the rules: pure state changes, no drawing ───────────────────────── */
function pushWorld() {
  OWNED.set = new Set(GS.furn);
  WORLD.pets.dragon = GS.pets.includes('dragon');
  WORLD.pets.sheep = GS.pets.includes('sheep');
  WORLD.pets.penguin = GS.pets.includes('penguin');
  for (const k in GS.aff) WORLD.aff[k] = GS.aff[k];
  WORLD.beach = GS.beach;
  WORLD.presents = GS.presents;
  WORLD.sillTreat = GS.sill;
  WORLD.hunger = GS.hunger;
  WORLD.roof = GS.roof;
}
function spawnGlass() {
  if (GS.beach.length >= RULES.beachCap || !SLOTS.length) return false;
  const n = GS.n++, used = new Set([...GS.beach, ...GS.presents].map(g => g.slot));
  let slot = hsh(n, 161) * SLOTS.length | 0;
  while (used.has(slot)) slot = (slot + 1) % SLOTS.length;
  const roll = hsh(n, 162);
  GS.beach.push({ slot, kind: roll < KINDS[0].chance ? 0 : roll < KINDS[0].chance + KINDS[1].chance ? 1 : 2 });
  if (SPLASHES.length >= RULES.beachCap) SPLASHES.shift();
  SPLASHES.push({ x: SLOTS[slot].x, y: SLOTS[slot].y, t0: WORLD.now });
  return true;
}
let unpicked = 0;       // seconds since anything was picked up; only for the shine, so it isn't saved
function advance(sec) {
  GS.played += sec;
  for (const id of ACTOR_IDS) if (present(id)) GS.hunger[id] = Math.max(0, GS.hunger[id] - sec / (RULES.hungerMinutes * 60));
  unpicked += sec;
  WORLD.glow = unpicked >= RULES.glowAfter && GS.beach.length ? GS.beach[0].slot : -1;
  GS.spawnIn -= sec;
  while (GS.spawnIn <= 0) { GS.spawnIn += RULES.spawnEvery; spawnGlass(); }
  if (FLOAT && (FLOAT.e += sec) >= RULES.balloonCross) FLOAT = null;   // missed: it's gone
  GS.balloonIn -= sec;
  while (GS.balloonIn <= 0) {
    launchBalloon();
    GS.balloonIn += lerp(RULES.balloonEvery[0], RULES.balloonEvery[1], hsh(GS.bn, 185));
  }
}
function launchBalloon() {
  const n = GS.bn++;
  if (GS.presents.length >= RULES.presentCap || FLOAT) return;
  // low enough over the water to stay in view from every floor's camera
  FLOAT = { n, e: 0, dir: hsh(n, 180) < .5 ? 1 : -1, y: 345 + hsh(n, 181) * 40 };
}
/* the present drops to the nearest free spot of sand that's on the screen */
function catchBalloon() {
  const at = balloonAt();
  if (!at) return false;
  const n = FLOAT.n, v = CAM.to, used = new Set([...GS.beach, ...GS.presents].map(g => g.slot));
  const shown = s => s.x > v[0] + 8 && s.x < v[0] + v[2] - 8 && s.y > v[1] + 10 && s.y < v[1] + v[3] * .86;
  let best = -1, bd = Infinity, inView = false;
  SLOTS.forEach((s, i) => {
    if (used.has(i)) return;
    const seen = shown(s), d = Math.hypot(s.x - at[0], s.y - at[1]);
    if ((seen && !inView) || (seen === inView && d < bd)) { best = i; bd = d; inView = seen; }
  });
  if (best < 0) return false;
  const roll = hsh(n, 182), value = roll < .4 ? 15 : roll < .84 ? 25 : 50;
  GS.presents.push({ slot: best, value });
  FLOAT = null;
  FALLING.push({ slot: best, x: at[0], y: at[1], t0: WORLD.now });
  LOOSE.push({ x: at[0], y: at[1], t0: WORLD.now });
  spark(at[0], at[1], 'amb7', 12, .6);
  if (!inView) setView('all');
  return true;
}
function openPresent(index) {
  const p = GS.presents[index];
  if (!p) return 0;
  GS.presents.splice(index, 1);
  GS.glass += p.value; GS.total += p.value;
  return p.value;
}
function collectAt(index) {
  const g = GS.beach[index];
  if (!g) return 0;
  GS.beach.splice(index, 1);
  const v = KINDS[g.kind].value;
  GS.glass += v; GS.total += v;
  unpicked = 0; WORLD.glow = -1;
  return v;
}
/* what happens while no one was looking */
function settleAbsence(sec) {
  const out = { pet: null };
  if (!(sec > 0)) return out;
  if (GS.sill) {
    const next = PET_ORDER.find(p => !GS.pets.includes(p));
    if (next) {
      GS.pets.push(next); out.pet = next;
      // the dragon brings the stool it perches on, if there isn't one yet
      if (next === 'dragon' && !GS.furn.includes('stoolA')) { GS.furn.push('stoolA'); out.rebake = true; }
    }
    GS.sill = false;
  }
  return out;
}
const nextFloorCost = () => RULES.floorCost[GS.storeys + 1] || 0;
const towerDone = () => GS.storeys >= 3;
const allPets = () => PET_ORDER.every(p => GS.pets.includes(p));
/* really out for the count, not just on its way home on an empty stomach */
const isAsleep = id => GS.hunger[id] <= 0 && BLOCK_TIER[id] === 2;
const canFeedOnly = (id, good) => GS.hunger[id] <= 0 && !GOODS[good].fill;   // no toys until it has eaten
function canBuy(id, good) { return present(id) && GS.glass >= GOODS[good].price && !WORLD.react[id] && !canFeedOnly(id, good); }
function buyFor(id, good) {
  if (!canBuy(id, good)) return false;
  const g = GOODS[good];
  GS.glass -= g.price;
  GS.aff[id] = Math.min(10, GS.aff[id] + g.gain);
  WORLD.aff[id] = GS.aff[id];
  if (g.fill) GS.hunger[id] = Math.min(1, GS.hunger[id] + g.fill);
  WORLD.react[id] = { t0: WORLD.now, dur: g.dur, anim: g.type === 'おやつ' ? 'eat' : 'play', item: good };
  return true;
}
function petAnimal(id) {
  if (!present(id) || WORLD.react[id] || isAsleep(id)) return false;   // a pat doesn't wake a hungry animal
  WORLD.react[id] = { t0: WORLD.now, dur: 1.5, anim: 'happy', stay: true };
  return true;
}
function placeSill() {
  if (!towerDone() || GS.sill || allPets() || GS.glass < RULES.sillPrice) return false;
  GS.glass -= RULES.sillPrice; GS.sill = true; WORLD.sillTreat = true;
  return true;
}
function rebake() {
  paintAll(); computeLight(); bakeLayers(); afterBake();
}
const canFurnish = key => { const f = FURNITURE[key]; return !!f && f.floor <= GS.storeys && !GS.furn.includes(key) && GS.glass >= f.price; };
const furnitureLeft = () => FURN_KEYS.filter(k => FURNITURE[k].floor <= GS.storeys && !GS.furn.includes(k));
function furnish(key) {
  if (!canFurnish(key)) return false;
  GS.glass -= FURNITURE[key].price;
  GS.furn.push(key);
  pushWorld();
  rebake();
  return true;
}
/* ── the roof's colour ────────────────────────────────────────────────── */
const canRoof = color => !!ROOF_NAMES[color] && color !== GS.roof && GS.glass >= RULES.roofPrice;
function changeRoof(color) {
  if (!canRoof(color)) return false;
  GS.glass -= RULES.roofPrice;
  GS.roof = color;
  pushWorld();
  rebake();
  return true;
}
function placeRoof(color) {
  if (!changeRoof(color)) return;
  closeSheets();
  setView('all');
  startHighlight('roof');
  const top = OY + 56 - TOP_Z(storeys);
  for (let i = 0; i < 12; i++) spark(180 + hsh(i, 175) * 110 - 55, top - hsh(i, 176) * 90, 'amb7', 13, 1);
  saveGame(); refreshUI();
}
/* the shop's small picture: the same bell, from the same curve */
const ROOF_MINI = {};
function roofMini(color) {
  if (ROOF_MINI[color]) return ROOF_MINI[color];
  const [ramp, d] = ROOF_RAMPS[color], lv = n => ramp + clamp(n + d, 0, 7), rows = [], tall = 30, hw = 17;
  for (let j = 0; j < tall; j++) {
    const h = 104 * (1 - j / (tall - 1)), w = Math.max(.5, hw * roofR(h));
    let row = '';
    for (let x = -hw; x <= hw; x++) {
      if (Math.abs(x) > w) { row += '.'; continue; }
      if (h >= 77 && h <= 81) { row += 'g'; continue; }
      row += Math.abs(x) > w - 1 ? 'o' : x < -w * .35 ? 'c' : x > w * .4 ? 'a' : 'b';
    }
    rows.push(row);
  }
  return ROOF_MINI[color] = mk(rows, `o:${lv(0)} a:${lv(2)} b:${lv(3)} c:${lv(5)} g:amb7`, hw, tall - 1);
}
/* ── the furniture's picture: the room's own art, cut out ───────────────── */
const ART = {};
/* parts that only exist on the moving layer */
const MOVING_ART = {
  chime: t => fxChime(t), mobile: t => fxMobile(t), lantern: t => fxLantern(t),
  stoolB: () => sblit(BOWL, iX(78, 84), iY(78, 84, Z2 + 13)),
};
const SWAYS = new Set(['chime', 'mobile', 'lantern']);
function furnitureArt(key) {
  if (ART[key]) return ART[key];
  const px = new Map();
  for (const ob of paintOrder(OBJ.slice(1).filter(ob => ob.o.furn === key))) {
    tCur = ++paintSerial; tCount = 0;
    ob.paint(ob);
    const outl = ob.o.outline === undefined ? .7 : ob.o.outline;
    for (let k = 0; k < tCount; k++) {
      const i = touched[k], edge = outl && ((i < W || tStamp[i - W] !== tCur) || (i >= N - W || tStamp[i + W] !== tCur) || tStamp[i - 1] !== tCur || tStamp[i + 1] !== tCur);
      const c = edge && tN[i] !== NEMIT ? lite(tCol[i], outl) : tCol[i];
      px.set(i, PAL32[nearest(c >> 16 & 255, c >> 8 & 255, c & 255)]);
    }
  }
  if (MOVING_ART[key]) {       // between frames: the next frame clears this anyway
    dyn.fill(0);
    MOVING_ART[key](0);
    for (let i = 0; i < N; i++) if (dyn[i]) px.set(i, dyn[i]);
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const i of px.keys()) { const sx = i % W, sy = i / W | 0; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = new Uint32Array(w * h);
  for (const [i, v] of px) d[((i / W | 0) - y0) * w + i % W - x0] = v;
  return ART[key] = { w, h, d, n: px.size };
}
function artCanvas(a, box = 46) {
  const c = document.createElement('canvas');
  c.width = a.w; c.height = a.h;
  const g = c.getContext('2d'), im = g.createImageData(a.w, a.h);
  new Uint32Array(im.data.buffer).set(a.d);
  g.putImageData(im, 0, 0);
  // small things are shown bigger, big things shrink to fit
  let s = Math.min(2, box / Math.max(a.w, a.h));
  if (s > 1) s = Math.floor(s * 2) / 2;
  c.style.width = `calc(var(--u) * ${a.w * s})`; c.style.height = `calc(var(--u) * ${a.h * s})`;
  c.className = 'px';
  return c;
}

/* ── a new piece of furniture glows, once ─────────────────────────────── */
let HILITE = null;
const hiMask = new Uint8Array(N);
function ringOf(list) {
  const ring = [], ring2 = [];
  for (const i of list) hiMask[i] = 1;
  for (const i of list) for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && !hiMask[j]) { hiMask[j] = 2; ring.push(j); }
  for (const i of ring) for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && !hiMask[j]) { hiMask[j] = 3; ring2.push(j); }
  for (const i of list) hiMask[i] = 0;
  for (const i of ring) hiMask[i] = 0;
  for (const i of ring2) hiMask[i] = 0;
  return { ring, ring2 };
}
function movingPixels(key, t) {
  const list = [];
  dyn.fill(0);
  MOVING_ART[key](t);
  for (let i = 0; i < N; i++) if (dyn[i]) list.push(i);
  return list;
}
function startHighlight(key) {
  const list = [], roofId = key === 'roof' ? NAMED['roof' + storeys].id : -1;
  for (let i = 0; i < N; i++) { const id = gId[i]; if (id && (id === roofId || OBJ[id].o.furn === key)) list.push(i); }
  const moving = MOVING_ART[key] ? movingPixels(key, 0) : [];
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const l of [list, moving]) for (const i of l) { const sx = i % W, sy = i / W | 0; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const pad = SWAYS.has(key) ? 6 : 1;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, cut = makeCanvas(w, h), g = cut.getContext('2d'), im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer);
  for (const i of list) d[((i / W | 0) - y0) * w + i % W - x0] = PAL32[baseIdx[i]];
  g.putImageData(im, 0, 0);
  HILITE = { key, t0: WORLD.now, cut, x: x0, y: y0, w, h, list, ...(SWAYS.has(key) ? {} : ringOf(list.concat(moving))) };
}
function drawHighlight(t) {
  const L = HILITE;
  if (!L) return;
  const e = WORLD.now - L.t0, on = RULES.highlightFor;
  if (e < 0 || e >= on + .4) { HILITE = null; return; }
  const a = Math.min(1, e / .3) * (1 - smooth((e - on) / .4));
  fctx.fillStyle = '#16204a';
  fctx.globalAlpha = .42 * a;
  fctx.fillRect(0, 0, W, H);
  fctx.globalAlpha = a;
  fctx.drawImage(L.cut, L.x, L.y);
  fctx.drawImage(dynCanvas, L.x, L.y, L.w, L.h, L.x, L.y, L.w, L.h);   // whatever's in front stays in front
  const { ring, ring2 } = SWAYS.has(L.key) ? ringOf(movingPixels(L.key, t)) : L;
  const pulse = .68 + .32 * Math.sin(e * 6);
  fctx.fillStyle = '#ffe27a';
  fctx.globalAlpha = a * pulse;
  for (const i of ring) fctx.fillRect(i % W, i / W | 0, 1, 1);
  fctx.globalAlpha = a * pulse * .4;
  for (const i of ring2) fctx.fillRect(i % W, i / W | 0, 1, 1);
  fctx.globalAlpha = 1;
}
function growNow() {
  const cost = nextFloorCost();
  if (!cost || GS.glass < cost) return false;
  GS.glass -= cost;
  GS.storeys++;
  storeys = GS.storeys;
  if (towerDone() && !GS.doneAt) GS.doneAt = GS.played;
  rebake();
  return true;
}

/* ── camera ───────────────────────────────────────────────────────────── */
const VIEWS = {
  all: [0, 0, 360, 640],
  1: [90, 320, 180, 320],
  2: [90, 235, 180, 320],
  3: [90, 135, 180, 320],
  beach: [110, 320, 180, 320],
};
const CAM = { cur: [0, 0, 360, 640], to: [0, 0, 360, 640], name: 'all' };
function setView(name) { CAM.name = name; CAM.to = VIEWS[name]; refreshUI(); }
function stepCamera(dt) {
  let moved = false;
  for (let i = 0; i < 4; i++) {
    const d = CAM.to[i] - CAM.cur[i];
    if (Math.abs(d) < .5) { if (d) moved = true; CAM.cur[i] = CAM.to[i]; continue; }
    CAM.cur[i] += d * Math.min(1, dt * 9); moved = true;
  }
  if (moved || CFG.zoom.length !== 4) CFG.zoom = CAM.cur.map(v => v);
}
/* the room it's in, the beach it's on, or the whole picture if it has gone up a palm or onto the roof */
function viewFor(id) {
  const A = ACTOR[id];
  if (!isOutdoors(A)) return roomZone(A.z) === 'G' ? 1 : roomZone(A.z) === 'B' ? 2 : 3;
  return A.z <= 5 && A.x > 110 ? 'beach' : 'all';
}
function lookAt(id) {
  const v = viewFor(id);
  if (v !== CAM.name && (CAM.name !== 'all' || v !== 'beach')) setView(v);
}

/* ── the screen ───────────────────────────────────────────────────────── */
const UI = {};
const $ = id => document.getElementById(id);
function paintSprite(c, s) {
  const g = c.getContext('2d'), im = g.createImageData(s.w, s.h), d = new Uint32Array(im.data.buffer);
  for (let i = 0; i < s.w * s.h; i++) if (s.d[i]) d[i] = PAL32[s.d[i]];
  g.putImageData(im, 0, 0);
}
function spriteCanvas(s, scale = 2, u = 1) {
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h;
  paintSprite(c, s);
  c.style.width = `calc(var(--u) * ${s.w * scale})`; c.style.height = `calc(var(--u) * ${s.h * scale})`;
  c.className = 'px';
  return c;
}
const FACE = () => ({ cat: K.sit, pup: D.sit[0], rabbit: R.sit, sheep: S.front[0], dragon: Y.sit, penguin: Q.stand });
const ITEM_ICON = () => ({ cookie: ITEM.cookie, ice: ITEM.ice, ball: ITEM.ball[0], wheel: ITEM.wheel[0] });
let toastTimer = 0, cardFor = null, menuOpen = false, shopOpen = false, helpOpen = false, growing = false;
function toast(text, sec = 4.5) {
  UI.toast.textContent = text;
  UI.toast.classList.add('on');
  toastTimer = sec;
}
function floatNumber(ix, iy, text) {
  const e = document.createElement('div');
  e.className = 'float'; e.textContent = text;
  const v = CAM.cur;
  e.style.left = (ix - v[0]) / v[2] * 100 + '%';
  e.style.top = (iy - v[1]) / v[3] * 100 + '%';
  UI.ui.appendChild(e);
  setTimeout(() => e.remove(), 900);
}
function buildUI() {
  UI.ui = $('ui'); UI.ui.hidden = false;
  for (const k of ['glassN', 'reloadBox', 'consent', 'shopBtn', 'helpBtn', 'menuBtn', 'floors', 'toast', 'growBtn', 'growLabel', 'growFill', 'faces', 'card', 'shop', 'help', 'menu', 'puff', 'unhide']) UI[k] = $(k);
  const keep = (s, scale) => { const c = spriteCanvas(s, scale); UI.icons.push([c, s]); return c; };
  UI.icons = [];
  $('glassIcon').appendChild(keep(GLASS_SPR[0], 2));
  UI.faceBtns = {};
  const faces = FACE();
  for (const id of ['cat', 'pup', 'rabbit', 'dragon', 'sheep', 'penguin']) {
    const b = document.createElement('button');
    b.className = 'face'; b.setAttribute('aria-label', ANIMALS[id].name);
    const img = keep(faces[id], faces[id].w > 13 ? 1.5 : 2);
    const q = document.createElement('span'); q.className = 'qm'; q.textContent = '？';
    const hg = document.createElement('span'); hg.className = 'hg'; hg.appendChild(keep(ITEM.cookie, 1));
    b.append(img, q, hg);
    b.onclick = () => {
      if (present(id)) { petAnimal(id); lookAt(id); openCard(id); }
    };
    UI.faces.appendChild(b); UI.faceBtns[id] = b;
  }
  for (const v of ['3', '2', '1', 'all']) {
    const b = document.createElement('button');
    b.textContent = v === 'all' ? '全体' : v + '階';
    b.dataset.view = v;
    b.onclick = () => setView(v);
    UI.floors.appendChild(b);
  }
  UI.growBtn.onclick = onMainButton;
  UI.shopBtn.onclick = () => { const on = !shopOpen; closeSheets(); shopOpen = on; renderShop(); };
  UI.helpBtn.onclick = () => { const on = !helpOpen; closeSheets(); helpOpen = on; renderHelp(); };
  UI.menuBtn.onclick = () => { const on = !menuOpen; closeSheets(); menuOpen = on; renderMenu(); };
  UI.unhide.onclick = () => { UI.ui.classList.remove('hide'); };
  // not pointerup: a card opened then would be under the finger when the click arrives, and buy whatever's there
  display.addEventListener('click', onCanvasTap);
  refreshUI();
}
function onMainButton() {
  if (growing) return;
  if (!towerDone()) {
    if (GS.glass >= nextFloorCost()) growAnimated();
    return;
  }
  if (!placeSill()) return;
  setView(2);
  saveGame(); refreshUI();
}
function growAnimated() {
  growing = true;
  closeSheets();
  setView('all');
  UI.puff.classList.add('on');
  setTimeout(() => {
    growNow();
    pushWorld();
    for (let i = 0; i < 14; i++) spark(180 + hsh(i, 171) * 120 - 60, 150 + hsh(i, 172) * 280, 'amb7', 16, 1.2);
    UI.puff.classList.remove('on');
    growing = false;
    toast(GS.storeys === 3 ? '塔が完成！ うさぎがやってきました' : 'こいぬがやってきました', 5);
    saveGame(); refreshUI();
  }, 650);
}
function closeCard() { cardFor = null; UI.card.classList.remove('on'); }
function closeSheets() {
  closeCard();
  menuOpen = shopOpen = helpOpen = false;
  renderMenu(); renderShop(); renderHelp();
}
function openCard(id) {
  closeSheets();
  cardFor = id;
  renderCard();
  // keep the sheet off the animal: it goes on top when the animal is low on the screen
  const v = CAM.to;
  UI.card.classList.toggle('top', (ACTOR[id].sy - v[1]) / v[3] > .5);
  UI.card.classList.add('on');
}
function hearts(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<i class="${n >= i * 2 ? 'full' : n === i * 2 - 1 ? 'half' : ''}">♥</i>`;
  return h;
}
function renderCard() {
  const id = cardFor;
  if (!id) return;
  const a = ANIMALS[id], c = UI.card, icons = ITEM_ICON();
  c.innerHTML = `<button class="x" aria-label="とじる">×</button>
    <div class="head"><span class="ic"></span><div><b>${a.name}</b><div class="hearts">${hearts(GS.aff[id])}</div><div class="hunger"><i></i></div></div></div>
    <div class="goods"></div>`;
  c.querySelector('.ic').appendChild(spriteCanvas(FACE()[id], 2));
  c.querySelector('.x').onclick = closeCard;
  showHunger();
  const box = c.querySelector('.goods'), busy = !!WORLD.react[id] && WORLD.react[id].anim !== 'happy';
  for (const key of Object.keys(GOODS)) {
    const g = GOODS[key], b = document.createElement('button');
    b.className = 'good'; b.dataset.good = key;
    const afford = GS.glass >= g.price;
    b.disabled = !afford || busy || canFeedOnly(id, key);
    b.innerHTML = `<span class="gi"></span><span class="gt">${g.name}</span><span class="gp ${afford ? '' : 'no'}">${g.price}</span>`;
    b.querySelector('.gi').appendChild(spriteCanvas(icons[key], 2));
    b.onclick = () => {
      delete WORLD.react[id]; // a pat should never block a treat
      if (buyFor(id, key)) { saveGame(); refreshUI(); renderCard(); setTimeout(() => { if (cardFor === id) renderCard(); }, (g.dur + 1) * 1000); }
    };
    box.appendChild(b);
  }
}
/* no words: a bar under the hearts */
function showHunger() {
  const box = UI.card.querySelector('.hunger');
  if (!box || !cardFor) return;
  const h = GS.hunger[cardFor];
  box.firstChild.style.width = h * 100 + '%';
  box.classList.toggle('low', h <= HUNGER_LOW);
}
function renderShop() {
  const m = UI.shop;
  m.classList.toggle('on', shopOpen);
  if (!shopOpen) return;
  m.innerHTML = '<button class="x" aria-label="とじる">×</button>';
  m.querySelector('.x').onclick = closeSheets;
  const picture = (b, canvas, name, price) => {
    b.className = 'good pic'; b.disabled = GS.glass < price;
    b.innerHTML = `<span class="gi"></span><span class="gc"><span class="gt">${name}</span><span class="gp ${GS.glass >= price ? '' : 'no'}">${price}</span></span>`;
    b.querySelector('.gi').appendChild(canvas);
  };
  const roofHead = document.createElement('h3'); roofHead.textContent = '屋根の色';
  const roofBox = document.createElement('div'); roofBox.className = 'goods';
  for (const color in ROOF_NAMES) {
    const b = document.createElement('button');
    picture(b, spriteCanvas(roofMini(color), 1), ROOF_NAMES[color], RULES.roofPrice);
    b.dataset.roof = color;
    if (color === GS.roof) { b.disabled = true; b.querySelector('.gp').textContent = '✓'; }
    b.onclick = () => placeRoof(color);
    roofBox.appendChild(b);
  }
  m.append(roofHead, roofBox);
  const left = furnitureLeft();
  for (let n = 1; n <= GS.storeys; n++) {
    const keys = left.filter(k => FURNITURE[k].floor === n);
    if (!keys.length) continue;
    const h = document.createElement('h3'); h.textContent = n + '階';
    const box = document.createElement('div'); box.className = 'goods';
    for (const key of keys) {
      const f = FURNITURE[key], b = document.createElement('button');
      picture(b, artCanvas(furnitureArt(key)), f.name, f.price);
      b.dataset.furn = key;
      b.onclick = () => placeFurniture(key);
      box.appendChild(b);
    }
    m.append(h, box);
  }
}
function placeFurniture(key) {
  if (!furnish(key)) return;
  const f = FURNITURE[key], sx = iX(f.at[0], f.at[1]), sy = iY(f.at[0], f.at[1], f.at[2]);
  closeSheets();
  setView(f.floor);
  startHighlight(key);
  for (let i = 0; i < 7; i++) spark(sx + hsh(i, 173) * 24 - 12, sy + hsh(i, 174) * 18 - 9, 'amb7', 11, .9);
  // whoever lives on this floor comes over to see
  for (const id of ACTOR_IDS) if (present(id) && inOwnRoom(ACTOR[id]) && FLOOR_OF[id] === FLOOR_Z[f.floor - 1]) petAnimal(id);
  saveGame(); refreshUI();
}
const HELP = [
  '波打ち際に光るシーグラスをタップして集めます。',
  '集めたシーグラスで塔を建て増しします。階が増えると動物がやってきます。',
  '「おみせ」で家具を買うと、部屋に置かれます。動物たちも使います。屋根の色も何度でも変えられます。',
  'プレゼント付きの風船が流れてきたら、タップしましょう。浜に落ちたプレゼントを開くと、シーグラスがたくさん出てきます。',
  '動物をタップすると、おやつやおもちゃをあげられます。なつくと新しいしぐさを見せてくれます。',
  'おなかがすくと、動物はあまり動かなくなり、やがて眠ってしまいます。おやつをあげると元気になります。',
  '船や海がめ、カニ、虫、かもめ、くらげ、魚もタップしてみましょう。',
  '動物たちは、はしごで屋根や浜辺にも出かけます。',
  '3階まで建ったら、窓辺におやつを置きましょう。次に開いたとき、新しい動物が来ているかもしれません。',
  '進み具合はこのブラウザの中に自動で保存されます。',
];
function renderHelp() {
  const m = UI.help;
  m.classList.toggle('on', helpOpen);
  if (!helpOpen) return;
  m.innerHTML = `<button class="x" aria-label="とじる">×</button><h3>遊び方</h3><ul>${HELP.concat(analytics() ? ['同意していただいた場合だけ、訪問数を数えるために Google Analytics を使います。メニューから変更できます。'] : []).map(s => `<li>${s}</li>`).join('')}</ul>`;
  m.querySelector('.x').onclick = closeSheets;
}
function renderMenu() {
  const m = UI.menu;
  m.classList.toggle('on', menuOpen);
  if (!menuOpen) return;
  m.innerHTML = `<button class="x" aria-label="とじる">×</button><h3>Little Island Tower</h3>
    <button id="hideBtn" class="wide">文字を隠して眺める</button>
    ${analytics() ? `<button id="gaBtn" class="wide">訪問数の計測：${readConsent() === 'yes' ? 'オン' : 'オフ'}</button>` : ''}
    <button id="resetBtn" class="wide danger">最初からやり直す</button>`;
  const ga = m.querySelector('#gaBtn');
  if (ga) ga.onclick = () => setConsent(readConsent() !== 'yes');
  m.querySelector('.x').onclick = () => { menuOpen = false; renderMenu(); };
  m.querySelector('#hideBtn').onclick = () => { menuOpen = false; renderMenu(); UI.ui.classList.add('hide'); };
  const r = m.querySelector('#resetBtn');
  r.onclick = () => {
    if (r.dataset.armed) { resetGame(); return; }
    r.dataset.armed = '1'; r.textContent = '本当にやり直す（もう一度押す）';
  };
}
function refreshUI() {
  if (!UI.ui) return;
  UI.glassN.textContent = GS.glass;
  if (shopOpen) renderShop();
  for (const b of UI.floors.children) {
    const v = b.dataset.view;
    b.hidden = v !== 'all' && +v > storeys;
    b.classList.toggle('sel', v === String(CAM.name));
  }
  for (const id in UI.faceBtns) {
    UI.faceBtns[id].classList.toggle('known', present(id));
    UI.faceBtns[id].classList.toggle('hungry', present(id) && GS.hunger[id] <= 0);
  }
  let label = '', frac = 1, ready = true;
  if (!towerDone()) {
    const cost = nextFloorCost();
    label = `${GS.storeys + 1}階 ${Math.min(GS.glass, cost)}/${cost}`;
    frac = Math.min(1, GS.glass / cost); ready = GS.glass >= cost;
  } else if (!allPets() && !GS.sill) { label = `おやつ ${RULES.sillPrice}`; ready = GS.glass >= RULES.sillPrice; }
  UI.growBtn.hidden = !label;
  UI.growLabel.textContent = label;
  UI.growFill.style.width = frac * 100 + '%';
  UI.growBtn.classList.toggle('ready', ready);
  if (cardFor) refreshCardPrices();
}
function refreshCardPrices() {
  const c = UI.card, id = cardFor, busy = !!WORLD.react[id] && WORLD.react[id].anim !== 'happy';
  c.querySelectorAll('.good').forEach(b => {
    const key = b.dataset.good, afford = GS.glass >= GOODS[key].price;
    b.disabled = !afford || busy || canFeedOnly(id, key);
    b.querySelector('.gp').classList.toggle('no', !afford);
  });
  showHunger();
}
function toInternal(e) {
  const r = display.getBoundingClientRect(), v = CAM.cur;
  return [(e.clientX - r.left) / r.width * v[2] + v[0], (e.clientY - r.top) / r.height * v[3] + v[1]];
}
/* whatever is nearest to the finger wins; fingers are wide, so the reach is generous */
function hitTest(ix, iy) {
  const reach = 14 * CAM.cur[2] / 360 + 5;
  let best = null, bd = reach;
  GS.beach.forEach((g, n) => {
    const s = SLOTS[g.slot];
    if (!s) return;
    const d = Math.hypot(s.x - ix, s.y - iy);
    if (d < bd) { bd = d; best = { kind: 'glass', n }; }
  });
  GS.presents.forEach((p, n) => {
    const s = SLOTS[p.slot];
    if (!s || FALLING.some(f => f.slot === p.slot)) return;
    const d = Math.hypot(s.x - ix, s.y - 3 - iy) - 3;
    if (d < bd) { bd = d; best = { kind: 'present', n }; }
  });
  const flying = balloonAt();
  if (flying) {
    const d = Math.hypot(flying[0] - ix, flying[1] - 22 - iy) - 18;   // it's tall, and moving: forgive a near miss
    if (d < bd) { bd = d; best = { kind: 'balloon' }; }
  }
  for (const id of ACTOR_IDS) {
    if (!present(id)) continue;
    const A = ACTOR[id], d = Math.hypot(A.sx - ix, A.sy - iy) - 3;
    if (d < bd) { bd = d; best = { kind: 'animal', id }; }
  }
  return best || hitCritter(ix, iy, reach);
}
/* the things that give nothing: only if the finger found nothing else */
function hitCritter(ix, iy, reach) {
  let best = null, bd = reach;
  for (const key in CRIT) {
    const c = CRIT[key];
    if (!c.r) continue;
    const sx = Math.round(c.x), sy = Math.round(c.y);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const g = gId[sy * W + sx];
    if ((c.gate === 1 && g) || (c.gate === 2 && !isExt[g])) continue;  // behind the tower or a roof
    const d = Math.hypot(c.x - ix, c.y - iy) - c.r;
    if (d < bd) { bd = d; best = { kind: 'critter', key }; }
  }
  return best;
}
function tapCritter(key, ix, iy) {
  if (WORLD.tap[key]) return;
  const c = CRIT[key], t0 = WORLD.now;
  if (!key.startsWith('fish')) { WORLD.tap[key] = { t0, dir: c.x >= ix ? 1 : -1 }; return; }
  for (const k of FISH_KEYS) {        // everyone close by takes the hint
    const f = CRIT[k];
    if (!f || !f.r || WORLD.tap[k] || (k !== key && Math.hypot(f.x - c.x, f.y - c.y) > 46)) continue;
    const a = Math.atan2(f.y - iy, f.x - ix);
    WORLD.tap[k] = { t0, dx: Math.cos(a) * 64, dy: Math.sin(a) * 40 };
  }
}
function onCanvasTap(e) {
  if (growing) return;
  if (menuOpen || shopOpen || helpOpen) { closeSheets(); return; }
  const [ix, iy] = toInternal(e), hit = hitTest(ix, iy);
  if (!hit) { closeCard(); return; }
  if (hit.kind === 'critter') {
    closeCard();
    tapCritter(hit.key, ix, iy);
  } else if (hit.kind === 'balloon') {
    if (catchBalloon()) { saveGame(); refreshUI(); }
  } else if (hit.kind === 'present') {
    const s = SLOTS[GS.presents[hit.n].slot], v = openPresent(hit.n);
    BURSTS.push({ x: s.x, y: s.y, count: Math.min(16, 6 + (v >> 2)), seed: GS.n + v, t0: WORLD.now });
    for (let i = 0; i < 5; i++) spark(s.x + (i - 2) * 5, s.y - 3, ['sea6', 'lef6', 'amb7'][i % 3], 12, .7);
    floatNumber(s.x, s.y - 8, '+' + v);
    saveGame(); refreshUI();
  } else if (hit.kind === 'glass') {
    const s = SLOTS[GS.beach[hit.n].slot], k = GS.beach[hit.n].kind, v = collectAt(hit.n);
    spark(s.x, s.y, ['sea6', 'lef6', 'amb7'][k]);
    floatNumber(s.x, s.y, '+' + v);
    saveGame(); refreshUI();
  } else {
    petAnimal(hit.id);
    lookAt(hit.id);
    openCard(hit.id);
    saveGame();
  }
}
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* the store is blocked: the new game just won't persist */ }
  GS = newState();
  FLOAT = null; HILITE = null;
  FALLING.length = LOOSE.length = BURSTS.length = SPLASHES.length = 0;
  WORLD.tap = {}; WORLD.glow = -1; unpicked = 0;
  for (let i = 0; i < 3; i++) spawnGlass();
  GS.lastSeen = nowMs();
  storeys = 1;
  WORLD.react = {}; WORLD.sparks.length = 0;
  pushWorld(); rebake();
  closeSheets(); setView('all');
  saveGame(); refreshUI();
}
/* ── coming back from the background ──────────────────────────────────────
   A phone's browser may throw away a canvas's pixels while the page is hidden.
   What's redrawn every frame survives; what was baked once (sky, tower, island) doesn't. */
const PICTURE = { bad: false, repaints: 0, timer: 0 };
function pictureOk() {
  if (PICTURE.bad) return false;
  try {
    const base = LAYER.base.getContext('2d').getImageData(0, 0, W, H).data, sky = LAYER.sky.getContext('2d').getImageData(0, 0, W, H).data;
    for (let i = 0; i < N; i += 997) {
      const j = i * 4;
      if (sky[j + 3] !== 255) return false;
      const v = baseIdx[i], p = PAL_RGB[v];
      if (v && (base[j + 3] !== 255 || base[j] !== p[0] || base[j + 1] !== p[1] || base[j + 2] !== p[2])) return false;
    }
    for (const g of [dctx, fctx]) {
      const c = g.getImageData(g === dctx ? DW >> 1 : W >> 1, 0, 1, 1).data;
      if (c[0] + c[1] + c[2] === 0) return false;     // nothing here is ever pure black
    }
    return true;
  } catch (e) { return false; }
}
function restorePicture() {
  PICTURE.repaints++;
  HILITE = null;
  fctx.imageSmoothingEnabled = dctx.imageSmoothingEnabled = false;
  buildSky();
  rebake();
  layout();
  for (const [c, s] of UI.icons) paintSprite(c, s);
  if (cardFor) renderCard();
  if (shopOpen) renderShop();
}
function showReload(on) { UI.reloadBox.classList.toggle('on', on); }
function settlePicture(tries) {
  renderFrame(clock);
  if (pictureOk()) { showReload(false); return; }
  if (!tries) { showReload(true); return; }
  // the browser may still be getting its canvases back
  clearTimeout(PICTURE.timer);
  PICTURE.timer = setTimeout(() => { restorePicture(); settlePicture(tries - 1); }, 1000);
}
function returnToPage(sec) {
  if (sec >= RULES.repaintAfter || !pictureOk()) restorePicture();
  settlePicture(1);
}
/* ── counting visits, only for those who agreed; only the public page has any of this ── */
const CONSENT_KEY = 'summer-tower-analytics';
const analytics = () => window.__analytics || null;
function readConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
function setConsent(yes) {
  try { localStorage.setItem(CONSENT_KEY, yes ? 'yes' : 'no'); } catch (e) { /* blocked: it asks again next time */ }
  UI.consent.classList.remove('on');
  try { if (yes) analytics().start(); else analytics().stop(); } catch (e) { /* the game doesn't depend on it */ }
  renderMenu(); renderHelp();
}
function startAnalytics() {
  if (!analytics()) return;
  const said = readConsent();
  if (said === 'yes') { try { analytics().start(); } catch (e) { /* the game doesn't depend on it */ } return; }
  if (said) return;
  UI.consent.innerHTML = `<p>訪問数を数えるために、Google Analytics（Cookie を使います）を使ってもよいですか？</p>
    <div class="goods"><button class="wide" id="gaYes">いいよ</button><button class="wide" id="gaNo">使わない</button></div>`;
  UI.consent.querySelector('#gaYes').onclick = () => setConsent(true);
  UI.consent.querySelector('#gaNo').onclick = () => setConsent(false);
  UI.consent.classList.add('on');
}
/* an absence, whether a closed page or a long-hidden tab */
function comeBack() {
  const sec = (nowMs() - GS.lastSeen) / 1000;
  const r = settleAbsence(sec);
  pushWorld();
  if (r.rebake) rebake();
  if (r.pet) toast(`${ANIMALS[r.pet].name}がやってきました`, 5);
  saveGame(); refreshUI();
}
let saveEvery = 5;
function gameFrame(dt) {
  if (!gameOn) return;
  advance(dt);
  stepCamera(dt);
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) UI.toast.classList.remove('on');
  if ((saveEvery -= dt) <= 0) { saveEvery = 5; saveGame(); refreshUI(); }
}
function gameBoot() {
  gameOn = !(CFG.full || CFG.floors || CFG.sheet || CFG.loop);
  OWNED.all = !gameOn;
  if (!gameOn) {
    storeys = CFG.full ? 3 : CFG.floors || 1;
    if (CFG.full) { WORLD.pets.dragon = WORLD.pets.sheep = WORLD.pets.penguin = true; for (const k in WORLD.aff) WORLD.aff[k] = 10; }
    return;
  }
  const saved = readSave();
  GS = saved || newState();
  storeys = GS.storeys;
  pushWorld();
}
/* runs once the first bake has told us where the sand is */
function gameStart() {
  if (!gameOn) return;
  initSlots();
  const fresh = !GS.lastSeen;
  if (fresh) {
    for (let i = 0; i < 3; i++) spawnGlass();
    GS.lastSeen = nowMs();
  }
  pushWorld();
  buildUI();
  if (fresh) saveGame();
  else comeBack();
  startAnalytics();
  $('reloadBtn').onclick = () => { saveGame(); location.reload(); };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = nowMs(); saveGame(); return; }
    const away = hiddenAt ? (nowMs() - hiddenAt) / 1000 : 0;
    hiddenAt = 0;
    returnToPage(away);
    if (away >= RULES.resumeAfter) comeBack();
  });
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('pageshow', e => { if (e.persisted) returnToPage(RULES.repaintAfter); });
  document.addEventListener('resume', () => returnToPage(RULES.repaintAfter));
  for (const c of [display, frame, dynCanvas]) c.addEventListener('contextrestored', () => { if (!document.hidden) returnToPage(RULES.repaintAfter); });
}
const GAME = {
  state: () => JSON.parse(JSON.stringify(GS)),
  rules: RULES, goods: GOODS, furniture: FURNITURE,
  furnish: key => { const ok = furnish(key); if (UI.ui) refreshUI(); return ok; },
  left: furnitureLeft,
  painted: name => { const id = NAMED[name].id; let n = 0; for (let i = 0; i < N; i++) if (gId[i] === id) n++; return n; },
  advance: sec => { advance(sec); pushWorld(); },
  collectAll: () => { let v = 0; while (GS.beach.length) v += collectAt(0); pushWorld(); if (UI.ui) refreshUI(); return v; },
  give: (id, good) => { GS.glass += GOODS[good].price; delete WORLD.react[id]; return buyFor(id, good); },
  buy: (id, good) => { delete WORLD.react[id]; const ok = buyFor(id, good); delete WORLD.react[id]; if (UI.ui) refreshUI(); return ok; },
  grow: () => { const ok = growNow(); pushWorld(); if (UI.ui) refreshUI(); return ok; },
  sill: placeSill,
  roof: color => { const ok = changeRoof(color); if (UI.ui) refreshUI(); return ok; },
  setHunger: (id, v) => { GS.hunger[id] = v; if (UI.ui) refreshUI(); },
  feedAll: () => { for (const k in GS.hunger) GS.hunger[k] = 1; },
  isAsleep, tier: id => BLOCK_TIER[id], setTiers: o => { Object.assign(BLOCK_TIER, o); },
  crit: key => CRIT[key] && { ...CRIT[key] }, tapped: () => Object.keys(WORLD.tap), clearTaps: () => { WORLD.tap = {}; },
  glow: () => WORLD.glow, splashes: () => SPLASHES.length,
  breakPicture: () => { for (const c of [LAYER.base, LAYER.sky]) c.getContext('2d').clearRect(0, 0, W, H); fctx.fillStyle = '#000'; fctx.fillRect(0, 0, W, H); },
  pictureOk, returnToPage, repaints: () => PICTURE.repaints, forceBadPicture: on => { PICTURE.bad = on; },
  shiftClock: sec => { clockShift += sec * 1000; },
  balloon: () => { const b = balloonAt(); return b && [b[0], b[1] - 22]; },
  launch: launchBalloon,
  catchBalloon,
  openPresents: () => { let v = 0; while (GS.presents.length) v += openPresent(0); if (UI.ui) refreshUI(); return v; },
  art: key => { const a = furnitureArt(key); return [a.w, a.h, a.n]; },
  highlight: () => HILITE && { key: HILITE.key, px: HILITE.list.length, ring: HILITE.ring ? HILITE.ring.length : -1 },
  comeBack: sec => { GS.lastSeen = nowMs() - sec * 1000; comeBack(); return JSON.parse(JSON.stringify(GS)); },
  save: saveGame, read: readSave, reset: () => resetGame(),
  slots: () => SLOTS.map(s => [s.x, s.y]),
  hit: hitTest, present, view: () => CAM.name, react: () => Object.keys(WORLD.react),
  actorAt: id => [ACTOR[id].sx, ACTOR[id].sy],
  camera: () => CAM.cur.slice(),
  storeys: () => storeys,
};
