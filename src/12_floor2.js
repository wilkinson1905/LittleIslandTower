/* ═══════════════════════════════════════════════════════════════════════
   Second floor: the treat kitchen. Lemon wallpaper, blue-and-cream checks,
   a brick oven that glows, a table set for a feast.
   ═══════════════════════════════════════════════════════════════════════ */
const Z2 = FLOOR_Z[1];
const paperLemon = (u, v) => {
  const row = Math.floor(v / 12), q = ((u + (row % 2) * 6) % 12 + 12) % 12, w = ((v % 12) + 12) % 12;
  if (q >= 4 && q <= 6 && w >= 4 && w <= 6 && !(q === 4 && w === 6)) return C.amb7;
  if (q === 7 && w === 7) return C.lef5;
  return u % 12 === 0 ? C.crm6 : C.crm7;
};
const wall2 = (u, k) => {
  if (k < 24) { // splash tiles
    if (k === 23) return C.crm7;
    if (k % 6 === 0 || u % 6 === 0) return C.sea6;
    return ((u >> 3) ^ (k >> 3)) & 1 ? C.cld6 : C.cld4;
  }
  return paperLemon(u, k);
};
const floor2 = (i, j) => {
  if (i % 12 === 11 || j % 12 === 11) return C.crm3;
  return ((i / 12) | 0) + ((j / 12) | 0) & 1 ? C.sea6 : C.crm6;
};
storeyShell(2, floor2, wall2);

const WIN2 = archWindow('winF2', -61, Z2 + 18, 16, 32, 2);

/* the counter along the back wall */
const COUNTER_H = 12;
O('counterF2', [-100, -100, Z2, -99, -99, Z2 + COUNTER_H], () => {
  frontBox(-34, 68, -28, Z2, COUNTER_H, 7, (u, k) => {
    if (k < 2) return C.hon1;
    const c = u % 14;
    if (k === COUNTER_H - 1) return C.crm7;
    if (k === COUNTER_H - 2 || k === 2 || c === 0 || c === 13) return C.hon3;
    if ((c === 6 || c === 7) && k === 8) return C.amb7;
    return C.hon4;
  }, (u, e) => e === 0 ? C.crm7 : C.crm6);
}, { level: 2, layer: L_BACK(2), outline: .85, furn: 'counter' });

/* the little brick oven, with a fire behind its door */
const OVEN = { s: -30, w: 26, t: -25, z: Z2 };
O('ovenF2', [-100, -100, Z2, -99, -99, Z2 + 22], () => {
  frontBox(OVEN.s, OVEN.w, OVEN.t, Z2, 20, 10, (i, k) => {
    const d = Math.hypot((i - 12.5) * .8, k - 2);
    if (k >= 1 && d < 9) return d > 7.6 ? C.ter6 : C.ink1;
    const row = k >> 1, off = row % 2 ? 2 : 0;
    if (k === 19) return C.ter7;
    if (k % 2 === 0 && k > 0) return C.ter3;
    if ((i + off) % 4 === 0) return C.ter3;
    return hsh((i + off) >> 2, row, 8) < .5 ? C.ter5 : C.ter6;
  }, (i, e) => (i + e * 3) % 8 === 0 ? C.ter5 : C.ter6);
}, { level: 2, layer: L_ONBACK(2), outline: .82, furn: 'oven' });

/* pots and jars on the worktop, kept low so the floor above doesn't cut them */
O('counterTopF2', [-100, -100, Z2 + COUNTER_H, -99, -99, Z2 + COUNTER_H + 10], () => {
  const at = (s, t, map, rows) => { const [x, y] = worldAt(s, t); spr(Math.round(x), Math.round(y), Z2 + COUNTER_H, map, rows); };
  at(4, -31, 'o:mid1 a:sea3 b:sea2 c:sea5 k:crm7', ['...kk...', '.cccccc.', 'oaaaaabo', 'oaaaaabo', '.oooooo.']);
  at(15, -31, 'o:hon2 a:pin5 b:pin3 c:hon5', ['.ooo.', 'caaac', 'caabc', 'caabc']);
  at(21, -31, 'o:hon2 a:amb6 b:amb4 c:hon5', ['.ooo.', 'caaac', 'caabc', 'caabc', 'caabc']);
  at(27, -31, 'o:hon2 a:lef5 b:lef3 c:hon5', ['.ooo.', 'caaac', 'caabc', 'caabc']);
}, { outline: 0, level: 2, layer: L_ONBACK(2) + .1, furn: 'counter' });

/* the round table, set for a feast */
const TABLE2 = { x: 52, y: 62, r: 13, z: Z2 + 16 };
const tableScr = () => [OX + TABLE2.x - TABLE2.y, OY + ((TABLE2.x + TABLE2.y) >> 1)];
O('tableF2Foot', [47, 57, Z2, 57, 67, Z2 + 13], () => {
  fy(50, 62, Z2 + 2, 4, 11, (i) => i === 0 ? C.hon6 : C.hon3);
  top(46, 57, Z2 + 1, 12, 10, (i, j) => Math.hypot(i - 5.5, (j - 4.5) * 1.2) < 6 ? C.hon3 : -1);
}, { level: 2, furn: 'table' });
O('tableF2', [TABLE2.x - TABLE2.r, TABLE2.y - TABLE2.r, Z2 + 13, TABLE2.x + TABLE2.r, TABLE2.y + TABLE2.r, Z2 + 16], () => {
  const r = TABLE2.r, [sx0, sy0] = tableScr(), rs = Math.round(r * 1.41);
  for (let s = -rs; s <= rs; s++) {
    const arc = Math.sqrt(Math.max(0, rs * rs - s * s)) / 2;
    for (let k = 0; k < 3; k++) put(sx0 + s, Math.round(sy0 + arc - (Z2 + 13 + k)), k === 2 ? C.pin6 : C.pin3, TABLE2.x, TABLE2.y, Z2 + 14, s > 0 ? NX : NY);
  }
  top(TABLE2.x - r, TABLE2.y - r, Z2 + 16, r * 2, r * 2, (i, j) => {
    const d = Math.hypot(i - r + .5, j - r + .5);
    if (d > r) return -1;
    return d > r - 2 ? C.pin5 : C.crm7;
  });
}, { shadow: 0, level: 2, furn: 'table' });
O('tableF2Things', [TABLE2.x - 10, TABLE2.y - 10, Z2 + 16, TABLE2.x + 10, TABLE2.y + 10, Z2 + 26], () => {
  spr(TABLE2.x, TABLE2.y, Z2 + 16, 'o:hon1 w:cld7 c:pin4 d:pin2 r:ter5 a:sea5 b:sea3', [
    '.....r.....', '...ccccc...', '..cwwwwwc..', '..cdcdcdc..', '..ccccccc..', '.aaaaaaaaa.', '.bbbbbbbbb.', '....bbb....',
  ]);
  spr(TABLE2.x - 7, TABLE2.y + 6, Z2 + 16, 'a:amb6 g:lef4 r:ter5 b:sea5 c:sea6', ['.ragr.', 'bccccb', '.bbbb.']);
  spr(TABLE2.x + 8, TABLE2.y - 6, Z2 + 16, 'a:cld7 b:cld5 m:crm6', ['.mm.', 'aaab', 'aaab', 'aaab']);
}, { outline: .75, level: 2, furn: 'table' });

/* two toadstool stools and floor bowls for the animals */
const stool = (name, x, y, furn) => O(name, [x - 6, y - 6, Z2, x + 6, y + 6, Z2 + 11], () => {
  const sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1);
  for (let k = 0; k < 8; k++) for (let s = -3; s <= 3; s++) put(sx0 + s, sy0 - Z2 - k, s > 1 ? C.crm5 : C.crm7, x, y, Z2 + k, NBILL);
  for (let a = -8; a <= 8; a++) for (let b = 0; b <= 6; b++) {
    if ((a * a) / 64 + (b * b) / 36 > 1) continue;
    const spot = hsh((a + 8) >> 2, b >> 1, x) > .78;
    put(sx0 + a, sy0 - Z2 - 7 - b, spot ? C.crm7 : a > 3 ? C.ter4 : C.ter5, x, y, Z2 + 7 + b, NBILL);
  }
}, { outline: .9, shadow: 1, level: 2, furn });
stool('stoolA', 32, 66, 'stoolA'); stool('stoolB', 78, 84, 'stoolB');
const BOWLS = [{ x: 90, y: 60 }, { x: 96, y: 50 }];
BOWLS.forEach((b, n) => O('bowlF2' + n, [b.x - 5, b.y - 4, Z2, b.x + 5, b.y + 4, Z2 + 4], () => {
  const sx0 = OX + b.x - b.y, sy0 = OY + ((b.x + b.y) >> 1) - Z2;
  const co = n ? 'pin' : 'sea';
  for (let s = -6; s <= 6; s++) {
    const a = Math.sqrt(Math.max(0, 36 - s * s)) / 2;
    for (let k = 0; k <= 3; k++) put(sx0 + s, Math.round(sy0 + a - k), C[co + (s > 2 ? 3 : 5)], b.x, b.y, Z2 + k, NBILL);
    for (let y = -a; y <= a; y++) put(sx0 + s, Math.round(sy0 + y - 4), Math.abs(y) > a - 1 ? C[co + 6] : n ? C.hon5 : C.cld7, b.x, b.y, Z2 + 4, NBILL);
  }
}, { outline: .8, level: 2, furn: 'bowls' }));

/* a plump icebox by the right-hand wall */
O('icebox', [56, 14, Z2, 70, 28, Z2 + 34], () => {
  soft(56, 14, Z2, 14, 14, 34, 'cld', 5, {
    left: (i, k) => (k === 22 ? C.cld1 : (i === 2 && k > 24 && k < 31) || (i === 2 && k > 8 && k < 18) ? C.amb6 : null),
    right: (j, k) => (k === 22 ? C.cld0 : null),
  });
  spr(63, 28, Z2 + 13, 'a:pin4 b:sea5 c:amb6 d:lef5', ['a.b', '...', 'c.d']);
}, { shadow: 1, level: 2, furn: 'icebox' });

/* a lemon tree in a pot, by the left pillar */
O('lemonTree', [38, 90, Z2, 54, 102, Z2 + 44], () => {
  const x = 46, y = 96, sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1) - Z2;
  for (let s = -5; s <= 5; s++) {
    const a = Math.sqrt(Math.max(0, 25 - s * s)) / 2;
    for (let k = 0; k < 8; k++) put(sx0 + s, Math.round(sy0 + a - k), k === 7 ? C.ter7 : s > 2 ? C.ter4 : C.ter6, x, y, Z2 + k, s > 0 ? NX : NY);
    for (let u = -a; u <= a; u++) put(sx0 + s, Math.round(sy0 + u - 8), C.hon1, x, y, Z2 + 8, NTOP);
  }
  for (let k = 8; k < 20; k++) { put(sx0, sy0 - k, C.hon3, x, y, Z2 + k, NBILL); put(sx0 + 1, sy0 - k, C.hon2, x, y, Z2 + k, NBILL); }
  for (let a = -11; a <= 11; a++) for (let b = -10; b <= 11; b++) {
    if (a * a + b * b > 118 - hsh(a >> 1, b >> 1, 3) * 30) continue;
    const v = hsh(a >> 1, b >> 1, 7), lit = a + b < -6 ? 2 : a + b > 8 ? 0 : 1;
    let col = C['lef' + (3 + lit + (v > .7 ? 1 : 0))];
    if (hsh(a >> 2, b >> 2, 8) > .85 && (a & 3) < 2 && (b & 3) < 2) col = C.amb7;
    put(sx0 + a, sy0 - 29 + b, col, x, y, Z2 + 29, NBILL);
  }
}, { outline: .85, shadow: 1, level: 2, furn: 'lemon' });

/* the puppy's own round mat: the one thing on this floor from the first */
O('pupMat', [62, 58, Z2, 86, 82, Z2 + 1], () => {
  top(62, 58, Z2 + 1, 24, 24, (i, j) => {
    const d = Math.hypot(i - 11.5, j - 11.5);
    if (d > 11.5) return -1;
    return d > 10 ? C.ter4 : d > 8.5 ? C.crm7 : (Math.floor(d) % 3 === 0 ? C.ter5 : C.ter6);
  });
}, { outline: 0, level: 2 });

light(TABLE2.x, TABLE2.y, Z2 + 60, '#fff0c8', .34, 70, 'B');
light(30, 80, Z2 + 44, '#dcefff', .3, 56, 'B');
light(worldAt(OVEN.s + 13, OVEN.t + 4)[0], worldAt(OVEN.s + 13, OVEN.t + 4)[1], Z2 + 8, '#ff9848', 1.05, 42, 'B', { fire: 1, level: 2, furn: 'oven' });
