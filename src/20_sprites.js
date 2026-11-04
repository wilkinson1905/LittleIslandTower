/* ═══════════════════════════════════════════════════════════════════════
   Characters. Grids drawn by hand, assembled into poses at start-up.
   Sprite = { w, h, d: palette indices, ax, ay }: (ax, ay) sits on the ground.
   ═══════════════════════════════════════════════════════════════════════ */
function mk(rows, mapStr, ax, ay) {
  const m = pmap(mapStr), h = rows.length, w = Math.max(...rows.map(r => r.length));
  const d = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = m[row[x]];
      if (c !== undefined) d[y * w + x] = PIDX.get(c);
    }
  });
  return { w, h, d, ax: ax === undefined ? w >> 1 : ax, ay: ay === undefined ? h - 1 : ay };
}
function blank(w, h, ax, ay) { return { w, h, d: new Uint8Array(w * h), ax, ay }; }
function stamp(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const v = src.d[y * src.w + x];
    if (!v) continue;
    const X = x + dx, Y = y + dy;
    if (X >= 0 && Y >= 0 && X < dst.w && Y < dst.h) dst.d[Y * dst.w + X] = v;
  }
  return dst;
}
const stack = (parts, mapStr, ax, ay) => mk(parts.flat(), mapStr, ax, ay);
/* cut the empty edges, so a bubble above the sprite sits right on its head */
function trim(s) {
  let x0 = s.w, x1 = -1, y0 = s.h, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.d[y * s.w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const out = blank(x1 - x0 + 1, y1 - y0 + 1, s.ax - x0, s.ay - y0);
  stamp(out, s, -x0, -y0);
  return out;
}
function shear(src, dir) { // dir 1: right side falls along the iso axis; -1: right side rises
  const ex = src.w >> 1;
  const out = blank(src.w, src.h + ex, src.ax, 0);
  for (let x = 0; x < src.w; x++) {
    const off = dir > 0 ? x >> 1 : (src.w - 1 - x) >> 1;
    for (let y = 0; y < src.h; y++) {
      const v = src.d[y * src.w + x];
      if (v) out.d[(y + off) * out.w + x] = v;
    }
  }
  out.ay = src.ay + (dir > 0 ? src.ax >> 1 : (src.w - 1 - src.ax) >> 1);
  return out;
}

/* ── the puppy: honey and cream, long in the barrel, floppy ears, all plume ── */
const DM = 'o:wood1 B:hon6 b:hon5 c:hon7 D:crm7 d:crm6 T:crm7 t:crm5 U:crm7 E:ter5 F:ter6 f:ter7 G:ter7 e:ink0 w:crm7 N:ink0 n:pin4 p:pin5 x:wood2';
const dogHeads = {
  front: mk(['...oooo....', '..oBBBBoo..', '.oEEBBBBBo.', 'oEFEBBwBBo.', 'oEFEBBeBTTo', 'oEFFoBBTTTNo', 'oEfFoTTTTpNo', 'oEFFoooooo..', '.oEfo......', '..oo.......'], DM),
  blink: mk(['...oooo....', '..oBBBBoo..', '.oEEBBBBBo.', 'oEFEBBBBBo.', 'oEFEBBxBTTo', 'oEFFoBBTTTNo', 'oEfFoTTTTpNo', 'oEFFoooooo..', '.oEfo......', '..oo.......'], DM),
  tilt: mk(['..oooo.....', '.oBBBBoo...', 'oEBBBBBBoo.', 'oEEBBwBBBBo', 'oEFEBeBBTTo', '.oEFEoBBTTTo', '.oEfFoTTTTNNo', '.oEFFEoTTTpo.', '..oEfFooooo..', '...ooo.......'], DM),
  sniff: mk(['..oooo.......', '.oBBBBoo.....', 'oEEBBBBBoo...', 'oEFEBBwBBBo..', 'oEFEBBeBBTTo.', 'oEFFoBBTTTTTo', '.oEfFoTTTTTNNo', '.oEFFoooooNo.', '..oEo....oo..', '...o.........'], DM),
  back: mk(['...oooo...', '.ooBBBBoo.', 'oEEBBBBEEo', 'oEFEBcEFEo', 'oEFEBBEFEo', 'oEfFooFfEo', 'oEFFo.oEFo', '.oEo...oEo', '..o.....o.'], DM),
};
const dappleAt = (x, y) => {
  const v = hsh(x >> 1, y >> 1, 702), w = hsh(x, y, 701);
  if (v > .78) return w < .72 ? 'D' : 'd';
  if (v < .12) return 'b';
  return w < .22 ? 'c' : w > .9 ? 'b' : 'B';
};
const DOG = { LEN: 15, H0: 5, X0: 7, Y0: 6, cw: 28, ch: 18, legH: 3 };
const dogLegPhases = [
  [[0, 2], [3, 1], [2, 2], [0, 1]],
  [[1, 2], [2, 2], [1, 2], [1, 2]],
  [[3, 1], [0, 2], [0, 1], [2, 2]],
  [[2, 2], [1, 2], [1, 2], [1, 2]],
  [[1, 2], [1, 2], [1, 2], [1, 2]], // stand
];
/* The barrel comes from one rule set, so the dapple pattern holds still
   across every frame of the trot. */
function dogBody(legPhase, tailPhase, bow = 0) {
  const { LEN, H0, X0, Y0, cw, ch } = DOG;
  const g = Array.from({ length: ch }, () => new Array(cw).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < cw && y < ch) g[y][x] = c; };
  const yb = x => Y0 + Math.round((x - X0) / LEN * bow);
  // feathered plume: broad and silky, wagging by phase
  const wag = [0, 1, 0, -1][tailPhase], plume = [];
  [2, 3, 3, 4, 4, 4, 3, 2].forEach((w, i) => {
    const x = X0 - i, y = Y0 + 1 - Math.round(i * .35) + Math.round(wag * i * .3);
    for (let k = 0; k < w; k++) plume.push([x, y + k, k === 0 ? 'F' : k === w - 1 ? 'G' : i > 3 ? 'G' : 'f']);
  });
  for (const [x, y] of plume) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(x + a, y + b, 'o');
  for (const [x, y, c] of plume) set(x, y, c);
  // legs, set behind the fringe
  const LP = dogLegPhases[legPhase], lx = [X0 + 1, X0 + 4, X0 + LEN - 6, X0 + LEN - 3];
  LP.forEach(([dx, h0], i) => {
    const h = h0 + 1, far = i % 2 === 0, x = lx[i] + dx - 1, y = yb(x) + H0;
    for (let k = 0; k <= h; k++) { set(x - 1, y + k, 'o'); set(x + 2, y + k, 'o'); set(x, y + k, far ? 'T' : 't'); set(x + 1, y + k, far ? 'T' : 't'); }
    set(x - 1, y + h + 1, 'o'); set(x, y + h + 1, 'o'); set(x + 1, y + h + 1, 'o'); set(x + 2, y + h + 1, 'o');
    set(x, y + h, 'U'); set(x + 1, y + h, far ? 't' : 'U');
  });
  // barrel and the long silky fringe along the belly
  for (let x = X0; x < X0 + LEN; x++) {
    const y0 = yb(x), rd = x === X0 || x === X0 + LEN - 1 ? 1 : 0;
    set(x, y0 + rd - 1, 'o');
    for (let y = y0 + rd; y < y0 + H0 - rd; y++) {
      const top_ = y === y0 + rd;
      set(x, y, top_ ? (hsh(x, 5) < .5 ? 'c' : 'F') : y === y0 + H0 - 1 - rd ? 'b' : dappleAt(x, y - y0));
    }
    const fr = hsh(x, 703) < .5 ? 2 : 1;
    for (let k = 0; k < fr; k++) set(x, y0 + H0 - rd + k, k === fr - 1 ? (hsh(x, 704) < .5 ? 'f' : 'F') : 'F');
    set(x, y0 + H0 - rd + fr, 'o');
  }
  for (let y = 1; y < H0 - 1; y++) set(X0 - 1, Y0 + y, 'o');
  return mk(g.map(r => r.join('')), DM, X0 + 7, Y0 + H0 + DOG.legH);
}
function dogFrame(leg, tail, head = 'front', o = {}) {
  const body = dogBody(leg, tail, o.bow || 0);
  const out = blank(body.w + 10, body.h + 8, body.ax + 2, body.ay + 6);
  stamp(out, body, 2, 6);
  const jx = 2 + DOG.X0 + DOG.LEN - 1, jy = 6 + DOG.Y0 + (o.bow || 0);
  stamp(out, dogHeads[head], jx - 4 + (o.hx || 0), jy - 5 + (o.hy || 0));
  return trim(out);
}
const D = {};
D.walk = [0, 1, 2, 3].map(i => dogFrame(i, i, 'front'));
D.stand = [0, 1, 2, 3].map(i => dogFrame(4, i, 'front'));
D.standBlink = dogFrame(4, 0, 'blink');
D.tilt = [0, 1, 2, 3].map(i => dogFrame(4, i, 'tilt', { hy: -1 }));
D.sniff = [0, 1].map(i => dogFrame(4, i, 'sniff', { hy: 3, hx: 1, bow: 1 }));
D.stretch = [dogFrame(4, 1, 'blink', { bow: 2, hy: 2 }), dogFrame(4, 3, 'blink', { bow: 3, hy: 3 })];
/* seen from behind: at a window, or on the ladder */
const dogBack = (n, legs) => mk([
  '...oooo....', '.ooBBBBoo..', 'oEEBBBBEEo.', 'oEFEBcEFEo.', 'oEFEBBEFEo.', 'oEfFBBFfEo.', 'oEFoBBoEFo.', '.oEoBBoEo..',
  '..oBBcBBo..', '.oBBBBBBBo.', n ? '.oBcBBBBBooo' : '.oBcBBBBBo.o', n ? '.oBBBBBcBoGGo' : '.oBBBBBcBooGo', '.oBBBBBBBoFGo', ...legs,
], DM, 5, 11 + legs.length);
D.back = [0, 1].map(n => dogBack(n, ['.oUUoooUUoFo.', '..oo...oo.o..']));
D.walkBack = [
  dogBack(0, ['.oUUoBoBBoFo.', '.oUUo.ooo.o..', '..oo.........']),
  dogBack(1, ['.oUUoooUUoFo.', '..oo...oo.o..', '.............']),
  dogBack(0, ['.oBBoBoUUoFo.', '..ooo.oUUoo..', '.......oo....']),
  dogBack(1, ['.oUUoooUUoFo.', '..oo...oo.o..', '.............']),
];
const dogSit = (head, tail, legs = ['..oBBBTBBBBo.', '..oUUoBBoUUo.', '..oooo..oooo.']) => {
  const headRows = {
    open:  ['....ooooo....', '..ooBBDBBoo..', '.oEBTBBBTBEo.', 'oEFBwBBBwBFEo', 'oEFBeBTBeBFEo', 'oEfBTTTTTBfEo', 'oEFoTTNTToFEo', '.oEooTTTooEo.', '..oo.ooo.oo..'],
    blink: ['....ooooo....', '..ooBBDBBoo..', '.oEBTBBBTBEo.', 'oEFBBBBBBBFEo', 'oEFBxBTBxBFEo', 'oEfBTTTTTBfEo', 'oEFoTTNTToFEo', '.oEooTTTooEo.', '..oo.ooo.oo..'],
    happy: ['....ooooo....', '..ooBBDBBoo..', '.oEBTBBBTBEo.', 'oEFBxBBBxBFEo', 'oEFxBxTxBxFEo', 'oEfBTTTTTBfEo', 'oEFoTTNTToFEo', '.oEooTpToEEo.', '..oo.opo.oo..'],
    tilt:  ['...ooooo.....', '.ooBBDBBoo...', 'oEBBTBBBTBoo.', 'oFEBwBBBwBBEo', '.oFBeBTBeBBFo', '.oEfBTTTTTBfo', '..oEoTTNTToEo', '...ooTTTooFEo', '.....ooo..oo.'],
  }[head];
  const tailRows = [
    ['............oGGo', '...........oFGGo', '..........oFFGo.', '..........oFFo..'],
    ['..............oo', '...........ooGGo', '..........oFFGGo', '..........oFFFo.'],
    ['................', '................', '..........oFFGGo', '..........oFFGGo'],
  ][tail];
  const body = ['...oBBDBBBo..', '..oBBTTTBBBo.', '..oBDBTBBdBo.', ...legs];
  const s = blank(16, 14 + legs.length, 6, 15);
  stamp(s, mk(tailRows, DM, 0, 0), 0, 8);
  stamp(s, mk(body, DM, 0, 0), 0, 9);
  stamp(s, mk(headRows, DM, 0, 0), 0, 1);
  return s;
};
/* trotting toward you: one front paw reaches down, then the other */
D.walkFront = [
  dogSit('open', 0, ['..oBBBTBBBBo.', '..oUUoBBobbo.', '..oUUo.oooo..', '..oooo.......']),
  dogSit('open', 1),
  dogSit('open', 2, ['..oBBBTBBBBo.', '..obboBBoUUo.', '...oooo.oUUo.', '........oooo.']),
  dogSit('open', 1),
];
D.sit = [dogSit('open', 0), dogSit('open', 1), dogSit('open', 2), dogSit('open', 1)];
D.sitBlink = dogSit('blink', 0);
D.sitTilt = [dogSit('tilt', 0), dogSit('tilt', 1), dogSit('tilt', 2), dogSit('tilt', 1)];
D.sitHappy = [dogSit('happy', 0), dogSit('happy', 2)];
const dogCurl = rise => mk([
  rise ? '......oooooooo......' : '....................',
  rise ? '....ooBBDBBcBBoo....' : '......oooooooo......',
  '..ooBBBBBBBBBBDBoo..',
  '.oEEoBBDBBBcBBBBBBo.',
  'oEFFEoBBBBBBBBBdBBBo',
  'oEFfEBxxBBDBBBBBFFGo',
  'oEFFEBBTTTBBBBBFFGGo',
  '.oEEoTTTTNoooooFGGo.',
  '..oo.oooooUUoo.ooo..',
], DM, 9, 8);
D.curl = [dogCurl(0), dogCurl(1)];
const dogFlop = n => { const s = blank(30, 12, 12, 11); stamp(s, mk([
  n ? '.....oooooooooooo..' : '...................',
  n ? '...ooBBcBDBBBdBBo..' : '....oooooooooooo...',
  'oFoBBBDBBBcBBDBBBo.',
  'oFFBBBBdBBBBBBBBBBo',
  '.oBBdBBBBBBBcBBBBBo',
  '..oFFfFFFfFFFFFfFFo',
  '...oooooooooooooUUo',
], DM), 0, 5); stamp(s, dogHeads.blink, 17, 2); return trim(s); };
D.flop = [dogFlop(0), dogFlop(1)];

/* ── the cat: smoky fluff, white bib, amber eyes that see everything ───── */
const CM = 'o:vio1 G:cha7 g:cha6 d:cha5 x:cha4 W:crm7 w:crm5 P:rose6 e:amb6 E:ink1 n:rose5 m:rose3 t:rose5 L:crm3';
const catHead = (eyes, ears = 0) => {
  const earRows = ears === 0 ? ['.o.......o.', 'oGo.....oGo', 'oPGoooooGPo'] : ears === 1 ? ['o........o.', 'oGo.....oGo', 'oPGoooooGPo'] : ['.o........o', 'oGo.....oGo', 'oPGoooooGPo'];
  const eyeRows = {
    open:  ['oGeEGGGeEGo', 'oGeeGnGeeGo'],
    left:  ['oGEeGGGEeGo', 'oGeeGnGeeGo'],
    wide:  ['oGEEGGGEEGo', 'oGEEGnGEEGo'],
    blink: ['oGGGGGGGGGo', 'oGxxGnGxxGo'],
    happy: ['oGxGxGxGxGo', 'oGGGGnGGGGo'],
  }[eyes];
  return [...earRows, 'oGGGdGdGGGo', ...eyeRows, 'dGGGWWWGGGd', '.odWWWWWdo.'];
};
const catBodyFront = (paw = 0) => [
  paw === 1 ? '..oGWWWGoWo' : '..oGWWWGo..',
  paw === 2 ? '.oGdWWWdGoWo' : '.oGdWWWdGo.',
  '.oGdGWGdGo.',
  '.oWWodoWWo.',
  '..oo.o.oo..',
];
const catAt = rows => mk(rows, CM, 5, rows.length - 1);
const K = {};
K.sit = catAt([...catHead('open'), ...catBodyFront()]);
K.sitBlink = catAt([...catHead('blink'), ...catBodyFront()]);
K.sitLeft = catAt([...catHead('left'), ...catBodyFront()]);
K.sitWide = catAt([...catHead('wide'), ...catBodyFront()]);
K.sitHappy = catAt([...catHead('happy'), ...catBodyFront()]);
K.earL = catAt([...catHead('open', 1), ...catBodyFront()]);
K.earR = catAt([...catHead('open', 2), ...catBodyFront()]);
K.bat = [catAt([...catHead('wide'), ...catBodyFront(1)]), catAt([...catHead('wide'), ...catBodyFront(2)])];
K.groom = [
  catAt(['.o.......o.', 'oGo.....oGo', 'oPGoooooGPo', 'oGGGdGdGGGo', 'oGxxGGGxxGo', 'oGGGGnGGGGo', 'dGGGWWWGGWo', '.odWWWWWoWo', '..oGWWWGoo.', '.oGdWWWdGo.', '.oGdGWGdGo.', '.oWWodo.oo.', '..oo.o.....']),
  catAt(['.o.......o.', 'oGo.....oGo', 'oPGoooooGPo', 'oGGGdGdGGGo', 'oGxxGGGxxGo', 'oGGGGnGGGGo', 'dGGGWtWGWWo', '.odWWWWoWo.', '..oGWWWGoo.', '.oGdWWWdGo.', '.oGdGWGdGo.', '.oWWodo.oo.', '..oo.o.....']),
  catAt(['...o.....o.', '..oGo...oGo', '..oPGoooGPo', '.oGGGdGdGGo', '.oGGxxGxxGo', '.oGGGGnGGGo', '.dGGWWtWGWo', '..oWWWWWWWo', '..oGWWWGoo.', '.oGdWWWdGo.', '.oGdGWGdGo.', '.oWWodo.oo.', '..oo.o.....']),
];
K.back = [0, 1, 2].map(e => catAt([
  ...(e === 1 ? ['o........o.', 'oGo.....oGo', 'oGGoooooGGo'] : e === 2 ? ['.o........o', 'oGo.....oGo', 'oGGoooooGGo'] : ['.o.......o.', 'oGo.....oGo', 'oGGoooooGGo']),
  'oGGGGGGGGGo', 'oGGGGGGGGGo', 'oGGGGGGGGgo', 'dgGGGGGGggd', '.odGGGGgdo.', '..oGGGGgo..', '.oGGGGGGgo.', '.oGGGGGggo.', '.oggoooggo.', '..oo...oo..',
]));
const catHeadSide = mk(['..o....o..', '.oGo..oGo.', '.oPGooGPo.', 'oGGdGdGGGo.', 'oGGGGGGeEo.', 'dGGGGGGeeGo', '.oGGGGWWWno', '..odWWWWWo.', '...ooooo...'], CM);
const CATB = { X0: 7, LEN: 11, Y0: 7, H0: 5, cw: 22, ch: 17 };
const catLegs = [[0, 1, 2, 1], [1, 2, 1, 0], [2, 1, 0, 1], [1, 0, 1, 2]];
function catBody(phase, stance = 0) {
  const { X0, LEN, Y0, H0, cw, ch } = CATB;
  const g = Array.from({ length: ch }, () => new Array(cw).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < cw && y < ch) g[y][x] = c; };
  // the tail goes up from the rump and sways; on a jump it streams out behind
  const sway = [0, 1, 0, -1][phase];
  const tail = stance === 2
    ? [[-1, 1], [-2, 1], [-3, 1], [-4, 0], [-5, 0], [-6, 0], [-7, -1]]
    : [[-1, 1], [-2, 0], [-3, -1], [-4, -2], [-4 + sway, -3], [-4 + sway, -4], [-3 + sway * 2, -5]];
  for (const [a, b] of tail) for (const [c, e] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(X0 + a + c, Y0 + b + e, 'o');
  tail.forEach(([a, b], i) => set(X0 + a, Y0 + b, i % 3 === 1 ? 'd' : 'g'));
  // legs: the near pair is lighter, and a leg swinging forward lifts off the ground
  const pp = catLegs[phase], next = catLegs[(phase + 1) % 4];
  const lx = [X0 + 1, X0 + 4, X0 + LEN - 6, X0 + LEN - 2], h = stance === 2 ? 1 : 3;
  lx.forEach((x0, i) => {
    const x = x0 + (stance === 0 ? pp[i] - 1 : i < 2 ? -1 : 1), far = i % 2 === 0;
    const hi = stance === 0 && pp[i] === 1 && next[i] === 2 ? h - 1 : h;
    for (let k = 0; k <= hi; k++) { set(x - 1, Y0 + H0 + k - 1, 'o'); set(x + 1, Y0 + H0 + k - 1, 'o'); set(x, Y0 + H0 + k - 1, k >= hi ? 'W' : far ? 'd' : 'g'); }
    set(x, Y0 + H0 + hi, 'o');
  });
  for (let x = X0; x < X0 + LEN; x++) {
    const rd = x === X0 || x === X0 + LEN - 1 ? 1 : 0;
    set(x, Y0 + rd - 1, hsh(x, 800) < .35 ? '.' : 'o');
    if (hsh(x, 800) < .35) set(x, Y0 + rd, 'o');
    set(x, Y0 + H0 - rd, 'o');
    for (let y = Y0 + rd + (hsh(x, 800) < .35 ? 1 : 0); y < Y0 + H0 - rd; y++) {
      const stripe = (x + (y >> 1)) % 4 === 0 && y < Y0 + 3;
      set(x, y, y === Y0 + H0 - 1 - rd ? 'W' : stripe ? 'd' : y === Y0 + rd ? 'G' : 'g');
    }
  }
  for (let y = 1; y < H0 - 1; y++) set(X0 - 1, Y0 + y, 'o');
  return mk(g.map(r => r.join('')), CM, X0 + 5, Y0 + H0 + 3);
}
function catWalk(phase, stance = 0) {
  const body = catBody(phase, stance);
  const out = blank(body.w + 6, body.h + 4, body.ax, body.ay + 4);
  stamp(out, body, 0, 4);
  stamp(out, catHeadSide, CATB.X0 + CATB.LEN - 5, 4 + CATB.Y0 - 6);
  return trim(out);
}
K.walk = [0, 1, 2, 3].map(i => catWalk(i));
const catFrontLegs = [
  ['.oWWodoGgo.', '.oWWo.ooo..', '..oo.......'],
  ['.oWWodoWWo.', '..oo.o.oo..', '...........'],
  ['.ogGodoWWo.', '..ooo.oWWo.', '.......oo..'],
  ['.oWWodoWWo.', '..oo.o.oo..', '...........'],
];
K.walkFront = catFrontLegs.map(legs => catAt([...catHead('open'), '..oGWWWGo..', '.oGdWWWdGo.', '.oGdGWGdGo.', ...legs]));
const catBackLegs = [
  ['.oggoGoGgo.', '.oggo.ooo..', '..oo.......'],
  ['.oggoooggo.', '..oo...oo..', '...........'],
  ['.oGgoGoggo.', '..ooo.oggo.', '.......oo..'],
  ['.oggoooggo.', '..oo...oo..', '...........'],
];
K.walkBack = catBackLegs.map(legs => catAt(['.o.......o.', 'oGo.....oGo', 'oGGoooooGGo', 'oGGGGGGGGGo', 'oGGGGGGGGGo', 'oGGGGGGGGgo', 'dgGGGGGGggd', '.odGGGGgdo.', '..oGGGGgo..', '.oGGGGGGgo.', '.oGGGGGggo.', ...legs]));
K.leap = catWalk(0, 2);
K.stretch = [
  mk(['...........o...o.', '..........oGo.oGo', 'ooo.......oGGGGGo', 'oGGoo.....oGxGxGo', '.ogGGooooooGGnGGo', '..oGGGdGGGGGWWGo.', '...oGGdGGdGGWWo..', '...oWooWooWWWWo..', '...oo.oo..oooo...'], CM, 8, 8),
  mk(['o..........o...o.', 'oGo.......oGo.oGo', '.oGo......oGGGGGo', '.oGGooo...oGxGxGo', '..ogGGGoooGGGnGGo', '..oGGGdGGGGGWWGo.', '...oGGGdGGdGWWo..', '...oWooWooWWWWWo.', '...oo.oo..ooooo..'], CM, 8, 8),
];
const catCurl = (rise, e) => mk([
  rise ? '.......oooo....' : '...............',
  rise ? '..o.o.oGGdGoo..' : '..o.o..oooo....',
  '.oGoGoodGdGGGo.',
  '.oGPGdGGGGdGGGo',
  'oGGGGGGdGGGdGGo',
  e ? 'oxxGxxGGGdGGGGo' : 'oGeGeGGGGdGGGGo',
  'oGGnGGoGGGGGGgo',
  '.oWWWoGGGGGGgo.',
  '..ooogggddWWoo.',
  '....ooooooo....',
], CM, 7, 9);
K.curl = [catCurl(0, 1), catCurl(1, 1), catCurl(0, 0)];

/* cat, extra poses: the head dips over a dish; on her back, paws in the air */
const nod = (head, body, dy, map, ax) => mk([...head, ...body.slice(dy)], map, ax);
K.eat = [nod(catHead('blink'), catBodyFront(), 1, CM, 5), nod(catHead('blink'), catBodyFront(), 2, CM, 5)];
K.roll = [
  mk(['..oo..oo.......', '.oWWooWWo.ooo..', '.oGWWWWGooGGGo.', 'oPGGGWWWWWWGGGo', 'oGxGxGWWWWWGGgo', 'oGGnGGGWWWGGGgo', '.odWWWGGGGGGgo.', '..ooooooooooo..'], CM, 7, 7),
  mk(['.oo....oo......', 'oWWo..oWWo.ooo.', '.oGWWWWGoooGGGo', 'oPGGGWWWWWWGGGo', 'oGxGxGWWWWWGGgo', 'oGGnGGGWWWGGGgo', '.odWWWGGGGGGgo.', '..ooooooooooo..'], CM, 7, 7),
];

/* ── the rabbit: milk-tea fur, tall ears, a cotton tail ───────────────── */
const RM = 'o:wood1 A:hon6 a:hon5 s:hon4 W:crm7 w:crm5 P:pin6 p:pin4 e:ink1 n:pin3';
const rabEars = ['..oo...oo..', '.oAPo.oPAo.', '.oAPo.oPAo.', '.oAPo.oPAo.', '.oAPo.oPAo.', '..oAoooAo..'];
const rabEarsDown = ['...........', '...........', '.ooo...ooo.', 'oAPPo.oPPAo', '.oAAoooAAo.', '..oAAAAAo..'];
const rabFace = {
  open: ['.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAeAAAAAeAo', 'oAeAAnAAeAo', 'oPAAWWWAAPo', '.ooWWWWWoo.'],
  blink: ['.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAAAAAAAAAo', 'oAssAnAssAo', 'oPAAWWWAAPo', '.ooWWWWWoo.'],
  happy: ['.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAsAsAsAsAo', 'oAAAAnAAAAo', 'oPAAWWWAAPo', '.ooWWWWWoo.'],
  chew: ['.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAAAAAAAAAo', 'oAssAnAssAo', 'oPAWnWnWAPo', '.ooWWWWWoo.'],
};
const rabBody = ['.oAAWWWAAo.', 'oAAaWWWaAAo', 'oAaaWWWaaAo', 'oaWWoaoWWao', '.ooo.o.ooo.'];
const rabFront = (face, ears = rabEars, body = rabBody) => mk([...ears, ...rabFace[face], ...body], RM, 5);
const R = {};
R.sit = rabFront('open');
R.blink = rabFront('blink');
R.happy = rabFront('happy');
R.earsDown = rabFront('blink', rabEarsDown);
R.eat = [nod([...rabEars, ...rabFace.chew], rabBody, 1, RM, 5), nod([...rabEars, ...rabFace.blink], rabBody, 2, RM, 5)];
R.wash = [
  mk([...rabEars, '.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAssAAAssAo', 'oWoAAnAAoWo', 'oPWoWWWoWPo', '.ooWWWWWoo.', ...rabBody], RM, 5),
  mk(['..oo.......', '.oAPo..oo..', '.oAPo.oPAo.', '.oWWo.oPAo.', '.oWWo.oPAo.', '..oAoooAo..', '.oAAAAAAAo.', 'oAAAAAAAAAo', 'oAssAAAssAo', 'oAAAAnAAAAo', 'oPAAWWWAAPo', '.ooWWWWWoo.', ...rabBody], RM, 5),
];
const rabHeadSE = mk(['.oo...oo.', 'oAPo.oPAo', 'oAPo.oPAo', 'oAPo.oPAo', '.oAoooAo.', 'oAAAAAAAo', 'oAeAAAeAo', 'oPAAnAAPo', '.oWWWWWo.', '..ooooo..'], RM);
const rabHeadNE = mk(['.oo...oo.', 'oAAo.oAAo', 'oAAo.oAAo', 'oAAo.oAAo', '.oAoooAo.', 'oAAAAAAAo', 'oAAAAAAAo', 'oAAAAAaAo', '.oaaaaao.', '..ooooo..'], RM);
const rabSide = [
  mk(['...oooooo.....', '..oAAAAAAoo...', '.oAAAAAAAAAo..', 'oWAAaAAAAAAAo.', 'oWAaaaAAAAAAo.', '.ooaaaWWWaaao.', '..oooWWoooWWo.', '....ooo...ooo.'], RM, 8, 7),
  mk(['...oooooo.......', '..oAAAAAAoo.....', '.oAAAAAAAAAoo...', 'oWAAaAAAAAAAAo..', 'oWAaaaAAAAAAAo..', '.oooaaaaaaWWo...', '.oaao.ooooWWWo..', '.oWWo.....oooo..', '.ooo............'], RM, 8, 8),
];
const rabHop = (dir, n) => {
  const sh = shear(rabSide[n], dir === 'SE' ? 1 : -1);
  const out = blank(sh.w + 8, sh.h + 9, sh.ax, sh.ay + 9);
  stamp(out, sh, 0, 9);
  const off = dir === 'SE' ? 10 >> 1 : 3;
  stamp(out, dir === 'SE' ? rabHeadSE : rabHeadNE, 7, 9 + off - 9);
  return out;
};
R.hopSE = [rabHop('SE', 0), rabHop('SE', 1)];
R.hopNE = [rabHop('NE', 0), rabHop('NE', 1)];
R.loaf = [0, 1].map(n => mk([
  n ? '...............' : '...............',
  '.ooo...ooo.....',
  'oAPPo.oPPAo....',
  '.oAAoooAAooooo.',
  '..oAAAAAoAAAAAo',
  n ? '.oAAAAAAAaAAAAo' : '.oAAAAAAAAaAAAo',
  'oAssAnAssAaAAAo',
  'oPAAWWWAAPaaAAo',
  '.ooWWWWWoaaWWao',
  '...oooooooooooo',
], RM, 6, 9));

/* ── the cloud sheep: a piece of summer sky with a small dark face ─────── */
const SM = 'o:azu2 c:cld7 C:cld6 d:cld5 D:cld4 F:mid2 G:mid1 e:cld7 n:pin5 L:mid2 s:mid4';
const sheepTop = ['.....ooo..ooo....', '...oocccoocccoo..', '..occcccccccccco.', '.occcccccCcccccco', 'occcCccccccccCcco'];
const sheepFace = {
  open: ['occcccFFFFFccccco', '.occcFeFFFeFccco.', 'occccFFFnFFFcccco', 'occccdFFFFFdcccco'],
  blink: ['occcccFFFFFccccco', '.occcFFFFFFFccco.', 'occccFsFnFsFcccco', 'occccdFFFFFdcccco'],
  happy: ['occcccFFFFFccccco', '.occcFsFFFsFccco.', 'occccFFFnFFFcccco', 'occccdFFFFFdcccco'],
};
const sheepBack = ['occcccccCcccccccco', '.oCccccccccccCco.', 'occcccCcccccccco', 'occcccccccccCccco'];
const sheepFeet = [
  ['.occcdddddddccco.', '..odddcddddcddo..', '...oodoooodoo....', '....oLo..oLo.....', '....ooo..ooo.....'],
  ['.occcdddddddccco.', '..odddcddddcddo..', '...oodoooodoo....', '.....oLo.oLo.....', '.....ooo.ooo.....'],
];
const sheep = (mid, f = 0) => mk([...sheepTop, ...mid, ...sheepFeet[f]], SM, 8);
const S = {};
S.front = [sheep(sheepFace.open, 0), sheep(sheepFace.open, 1)];
S.blink = sheep(sheepFace.blink);
S.happy = [sheep(sheepFace.happy, 0), sheep(sheepFace.happy, 1)];
S.back = [sheep(sheepBack, 0), sheep(sheepBack, 1)];
S.eat = [sheep(sheepFace.blink, 0), sheep(sheepFace.happy, 1)];

/* ── the little dragon: leaf green, cream belly, wings too small to matter ─ */
const DGM = 'o:lef1 G:lef5 g:lef4 h:lef3 B:crm7 b:crm5 W:pin6 w:pin4 S:amb7 s:amb5 e:ink1 E:cld7 n:lef2';
const drHead = {
  open: ['...S.....S...', '...So...oS...', '..oGGoooGGo..', '.oGGGGGGGGGo.', '.oGeGGGGGeGo.', '.oGeGGGGGeGo.', '.oGGGnGnGGGo.', '..oBBBBBBBo..', '...oooooo....'],
  blink: ['...S.....S...', '...So...oS...', '..oGGoooGGo..', '.oGGGGGGGGGo.', '.oGGGGGGGGGo.', '.ohhGGGGGhho.', '.oGGGnGnGGGo.', '..oBBBBBBBo..', '...oooooo....'],
  happy: ['...S.....S...', '...So...oS...', '..oGGoooGGo..', '.oGGGGGGGGGo.', '.ohGhGGGhGho.', '.oGGGGGGGGGo.', '.oGGGnGnGGGo.', '..oBBWWWBBo..', '...oooooo....'],
  puff: ['...S.....S...', '...So...oS...', '..oGGoooGGo..', '.oGGGGGGGGGo.', '.oGeGGGGGeGo.', '.oGeGGGGGeGo.', '.oGGGnGnGGGo.', '..oBBooOBBo..', '...oooooo....'],
};
const drBody = ['..oGBBBBBGo..', '.oGGBBBBBGGo.', '.ooGBBBBBGoo.', '..ohBBBBBho..', '..oooooooo...'];
const DGP = DGM + ' O:ter4';
const drWing = [
  ['oo...............oo', 'oWo.............oWo', 'oWWo...........oWWo', '.oWWo.........oWWo.', '..ooo.........ooo..'],
  ['...................', 'ooo.............ooo', 'oWWWo.........oWWWo', '.oWWWo.......oWWWo.', '..ooo.........ooo..'],
  ['...................', '...................', '..oo...........oo..', '.oWWo.........oWWo.', 'oWWo...........oWWo'],
];
const drTail = ['..............', '..............', '.oo...........', 'oSGo..........', 'oGGo..........', '.oGGoo........', '..ooGGoo......'];
const dragon = (head, wing = 1, body = drBody) => {
  const s = blank(21, 19, 9, 18);
  stamp(s, mk(drTail, DGP, 0, 0), 12, 11);
  stamp(s, mk(drWing[wing], DGP, 0, 0), 0, 9);
  stamp(s, mk(drHead[head], DGP, 0, 0), 3, 4);
  stamp(s, mk(body, DGP, 0, 0), 3, 13);
  return s;
};
const Y = {};
Y.fly = [0, 1, 2, 1].map(w => dragon('open', w));
Y.flyBlink = dragon('blink', 1);
Y.sit = dragon('open', 2);
Y.sitBlink = dragon('blink', 2);
Y.happy = [dragon('happy', 0), dragon('happy', 2)];
Y.puff = dragon('puff', 2);
Y.eat = [dragon('blink', 2), dragon('happy', 2)];
Y.back = [0, 1, 2, 1].map(w => {
  const s = blank(21, 19, 9, 18);
  stamp(s, mk(['...S.....S...', '...So...oS...', '..oGGoooGGo..', '.oGGGGGGGGGo.', '.oGGGGGGGGGo.', '.oGGGGGGGGGo.', '.ogGGGGGGGgo.', '..oggggggggo.', '...oooooo....'], DGP, 0, 0), 3, 4);
  stamp(s, mk(['..oGGGSGGGo..', '.oGGGGGGGGGo.', '.ooGGGSGGGoo.', '..ogGGGGGgo..', '..oooooooo...'], DGP, 0, 0), 3, 13);
  stamp(s, mk(drWing[w], DGP, 0, 0), 0, 9);
  return s;
});
Y.sleep = [0, 1].map(n => mk([
  n ? '...S....ooo....' : '...............',
  n ? '...So.ooGGGoo..' : '...S...oooo....',
  '..oGGooGGGGGGo.',
  '.oGGGGGoGGGGGGo',
  '.ohhGGhhoGGSGGo',
  '.oGGnGnGGoGGGGo',
  '..oBBBBBoGGGSGo',
  '...oooooooooooo',
], DGP, 7, 7));

/* ── the penguin: visitor from somewhere colder, unbothered by it ──────── */
const PM = 'o:mid1 K:mid3 k:mid2 W:cld7 w:cld5 Y:amb6 y:amb4 e:ink0 E:cld7 s:mid1 p:pin5';
const pgHead = {
  open: ['...ooooo...', '..oKKKKKo..', '.oKKKKKKKo.', '.oKEKKKEKo.', '.oKeKKKeKo.', '.oKKYYYKKo.'],
  blink: ['...ooooo...', '..oKKKKKo..', '.oKKKKKKKo.', '.oKKKKKKKo.', '.ossKKKsso.', '.oKKYYYKKo.'],
  happy: ['...ooooo...', '..oKKKKKo..', '.oKKKKKKKo.', '.oEKEKEKEo.', '.oKKKKKKKo.', '.oKKYYYKKo.'],
};
const pgBody = {
  rest: ['oKKWWWWWKKo', 'oKkWWWWWkKo', 'okKWWWWWKko', 'okoWWWWWoko', '.ooWWWWWoo.', '..owWWWwo..'],
  up: ['oo.WWWWW.oo', 'okoWWWWWoko', '.okWWWWWko.', '..oWWWWWo..', '..oWWWWWo..', '..owWWWwo..'],
};
const pgFeet = [['..YYoooYY..', '..yyo.oyy..'], ['..YYoooyy..', '..yyo.ooo..'], ['..yyoooYY..', '..ooo.oyy..']];
const pgBackBody = ['oKKKKKKKKKo', 'oKkKKKKKkKo', 'okKKKKKKKko', 'okoKKKKKoko', '.ooKKKKKoo.', '..okKKKko..'];
const pgBackHead = ['...ooooo...', '..oKKKKKo..', '.oKKKKKKKo.', '.oKKKKKKKo.', '.oKKKKKKKo.', '.okKKKKKko.'];
const pg = (head, body, feet, map = PM) => mk([...head, ...body, ...feet], map, 5);
const leanRows = (rows, dir) => rows.map((r, i) => dir > 0 ? (i < rows.length >> 1 ? '.' + r : r + '.') : (i < rows.length >> 1 ? r + '.' : '.' + r));
const Q = {};
Q.stand = pg(pgHead.open, pgBody.rest, pgFeet[0]);
Q.blink = pg(pgHead.blink, pgBody.rest, pgFeet[0]);
Q.happy = [pg(pgHead.happy, pgBody.up, pgFeet[0]), pg(pgHead.happy, pgBody.rest, pgFeet[0])];
Q.eat = [pg(pgHead.blink, pgBody.rest, pgFeet[0]), pg(pgHead.happy, pgBody.rest, pgFeet[0])];
Q.flap = [pg(pgHead.open, pgBody.up, pgFeet[0]), pg(pgHead.open, pgBody.rest, pgFeet[0])];
Q.walk = [mk(leanRows([...pgHead.open, ...pgBody.rest], 1).concat(pgFeet[1]), PM, 5), pg(pgHead.open, pgBody.rest, pgFeet[0]), mk(leanRows([...pgHead.open, ...pgBody.rest], -1).concat(pgFeet[2]), PM, 5), pg(pgHead.open, pgBody.rest, pgFeet[0])];
Q.back = [mk(leanRows([...pgBackHead, ...pgBackBody], 1).concat(pgFeet[1]), PM, 5), pg(pgBackHead, pgBackBody, pgFeet[0]), mk(leanRows([...pgBackHead, ...pgBackBody], -1).concat(pgFeet[2]), PM, 5), pg(pgBackHead, pgBackBody, pgFeet[0])];
Q.slide = [shear(mk(['....oooooooooo...', '..ooKKKKKKKKKKoo.', '.oKKKKKKKKKKKKKYo', 'ooKKWWWWWWWKEKKYY', 'YoowWWWWWWWKeKKo.', '.Yoo oooooooooo..'.replace(' ', '.')], PM, 8, 5), 1)];
Q.nap = [0, 1].map(n => mk([...(n ? ['...........'] : []), ...pgHead.blink.slice(n ? 0 : 0), ...pgBody.rest.slice(n ? 1 : 0), ...pgFeet[0]], PM, 5));

/* ── things that come and go ──────────────────────────────────────────── */
const IM = 'o:hon1 a:hon6 b:hon5 c:hon4 d:ter3 e:crm7 f:crm5 g:pin6 h:pin4 s:sea6 S:sea4 r:ter5 y:amb7 Y:amb5 m:lef5 w:hon3 O:mid1';
const ITEM = {
  cookie: mk(['..ooooo..', '.oaabaao.', 'oaadabdao', 'oabaaaabo', 'oaadaabao', '.ocbcbco.', '..ooooo..'], IM),
  ice: mk(['..oo..', '.ogggo', 'oggegO'.replace('O', 'o'), 'ohggho', '.oooo.', '.oabo.', '.oabo.', '.oabo.', '..oo..'], IM, 3),
  ball: [
    mk(['..oooo..', '.ogggeo.', 'ogggesSo', 'oggesSSo', 'ogesSSSo', 'oyesSSSo', '.oysSSo.', '..oooo..'], IM),
    mk(['..oooo..', '.oeyyyo.', 'oSeyyyyo', 'oSSeyyyo', 'oSSSegyo', 'oSSSegao'.replace('a', 'g'), '.oSSego.', '..oooo..'], IM),
    mk(['..oooo..', '.oSSseo.', 'oSSsegyo', 'oSsegggo', 'osegggyo', 'oegggyyo', '.oggyyo.', '..oooo..'], IM),
  ],
  wheel: [
    mk(['...oo...', '..ogo.o.', '.oggoosо'.replace('о', 'o'), '.oooOsso'.replace('O', 'r'), 'oyyro...', 'oyyoo...', '.o.w....', '...w....', '...w....', '...w....'], IM, 3, 9),
    mk(['.oo...o.', 'osso.ogo', '.ossogg.', '..oorgo.', '.oyyoo..', 'oyyo.ooo', '.oo.w...', '....w...', '....w...', '....w...'], IM, 4, 9),
  ],
  dish: mk(['.ooooooo.', 'oeeeeeeeo', 'ofeeeeefo', '.ooooooo.'], IM, 4, 3),
};

/* ── sprite sheet for review ──────────────────────────────────────────── */
function drawSheet() {
  const items = [
    K.sit, K.sitBlink, K.sitHappy, ...K.bat, ...K.groom, K.back[0], ...K.walk, ...K.walkFront, ...K.walkBack, K.leap, K.stretch[0], ...K.curl.slice(0, 2), ...K.eat, ...K.roll,
    ...D.walk, ...D.walkFront, ...D.walkBack, ...D.back, D.stand[0], D.tilt[0], D.sniff[0], D.stretch[0], ...D.flop, D.sit[0], D.sitBlink, D.sitTilt[0], D.sitHappy[0], ...D.curl,
    R.sit, R.blink, R.happy, R.earsDown, ...R.eat, ...R.wash, ...R.hopSE, ...R.hopNE, ...R.loaf,
    ...S.front, S.blink, S.happy[0], S.back[0],
    Y.fly[0], Y.fly[1], Y.fly[2], Y.flyBlink, Y.sit, Y.happy[0], Y.puff, Y.back[0], ...Y.sleep,
    Q.stand, Q.blink, ...Q.happy, Q.flap[0], ...Q.walk.slice(0, 3), ...Q.back.slice(0, 3), Q.slide[0], ...Q.nap,
    ITEM.cookie, ITEM.ice, ...ITEM.ball, ...ITEM.wheel, ITEM.dish,
  ];
  dctx.fillStyle = '#d9c9a8'; dctx.fillRect(0, 0, DW, DH);
  const Sc = 4; let x = 10, y = 10, rowH = 0;
  for (const s of items) {
    if (x + s.w * Sc > DW - 10) { x = 10; y += rowH + 10; rowH = 0; }
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + i];
      if (!v) continue;
      const p = PAL_RGB[v];
      dctx.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`;
      dctx.fillRect(x + i * Sc, y + j * Sc, Sc, Sc);
    }
    x += s.w * Sc + 10; rowH = Math.max(rowH, s.h * Sc);
  }
}
