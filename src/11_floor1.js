/* ═══════════════════════════════════════════════════════════════════════
   First floor: the animals' playroom. Mint walls with drifting stars, honey
   boards, toys everywhere.
   ═══════════════════════════════════════════════════════════════════════ */
const Z1 = FLOOR_Z[0];
const paper1Star = (u, v) => {
  const a2 = ((u + (Math.floor(v / 22) % 2) * 11) % 22 + 22) % 22, b = ((v % 22) + 22) % 22;
  if ((a2 === 10 && b >= 8 && b <= 12) || (b === 10 && a2 >= 8 && a2 <= 12)) return C.crm7;
  return (u + v) % 44 < 22 ? C.min6 : C.min5;
};
const wall1 = (u, k) => {
  if (k < 12) return k === 11 ? C.crm7 : k === 0 ? C.hon1 : u % 8 === 0 ? C.hon3 : k % 5 === 1 ? C.hon3 : C.hon4;
  return paper1Star(u, k);
};
storeyShell(1, planks(8, 34, 'hon', 5, 3), wall1);

const WIN1 = archWindow('winF1', -61, Z1 + 16, 16, 34, 1);
/* the open door to the beach */
O('doorF1', [-100, -100, Z1, -99, -99, Z1 + 42], () => {
  const w = 16, h = 42, s0 = 45;
  for (let u = 0; u < w; u++) {
    const s = s0 + u, t = backT(s), [x, y] = worldAt(s, t);
    for (let k = 0; k < h; k++) {
      if (!archShape(u, k, w, h, 0, 0)) continue;
      const inner = archShape(u, k, w, h, 2, 0);
      const col = !inner ? (archShape(u, k, w, h, 1, 0) ? C.crm7 : C.hon3) : k < 6 ? C.cld6 : k < 12 ? C.sea6 : k < 20 ? C.sea5 : k < 30 ? C.azu6 : C.azu5;
      put(OX + s, scrY(t, Z1 + k), col, x | 0, y | 0, Z1 + k, inner ? NEMIT : NBILL);
    }
  }
}, { outline: 0, level: 1, layer: L_WALL(1) + .5 });
O('doorMat', [62, 20, Z1, 76, 32, Z1 + 1], () => {
  top(62, 20, Z1 + 1, 14, 12, (i, j) => (i === 0 || j === 0 || i === 13 || j === 11) ? C.crm7 : (i + j) % 6 < 3 ? C.sea4 : C.sea5);
}, { outline: 0, level: 1, furn: 'doorMat' });

/* the low shelf of picture books along the back wall */
O('toyShelf', [-100, -100, Z1, -99, -99, Z1 + 20], () => {
  frontBox(-32, 34, -29, Z1, 20, 6, bookFace(34, 20, 11, ['sea4', 'pin4', 'amb6', 'lef4', 'crm7', 'ter5', 'pin5', 'sea5']), (u, e) => e === 0 ? C.hon7 : C.hon6);
}, { level: 1, layer: L_BACK(1), outline: .85, furn: 'shelf1' });

/* the big round rug with a sun in its centre */
const RUG1 = { x: 56, y: 58, r: 19 };
O('rugF1', [RUG1.x - RUG1.r, RUG1.y - RUG1.r, Z1, RUG1.x + RUG1.r, RUG1.y + RUG1.r, Z1 + 1], () => {
  const r = RUG1.r;
  top(RUG1.x - r, RUG1.y - r, Z1 + 1, r * 2, r * 2, (i, j) => {
    const dx = i - r + .5, dy = j - r + .5, d = Math.hypot(dx, dy);
    if (d > r) return -1;
    const a = Math.atan2(dy, dx);
    if (d > r - 2) return C.crm7;
    if (d > r - 5) return Math.floor(a * 16 / TAU + 16) % 2 ? C.pin4 : C.pin5;
    if (d > r - 6.5) return C.crm7;
    if (d > 7) return Math.floor(a * 12 / TAU + 12) % 2 ? C.sea5 : C.sea6;
    if (d > 5.5) return C.crm7;
    return d < 3 ? C.amb7 : C.amb6;
  });
}, { outline: 0, level: 1, furn: 'rug1' });

/* a carpeted cat tree by the left pillar */
const CATTREE = { x: 43, y: 85, shelfZ: Z1 + 21, topZ: Z1 + 41 };
O('catTreeBase', [36, 78, Z1, 50, 92, Z1 + 3], () => {
  soft(36, 78, Z1, 14, 14, 3, 'pin', 4);
}, { shadow: 1, level: 1, furn: 'catTree' });
O('catTreePost', [41, 83, Z1 + 3, 46, 88, Z1 + 38], () => {
  fy(41, 87, Z1 + 3, 5, 35, (i, k) => k % 3 === 0 ? C.hon3 : (k + i) % 6 < 3 ? C.hon6 : C.hon5);
  fx(45, 83, Z1 + 3, 4, 35, (j, k) => k % 3 === 0 ? C.hon2 : (k + j) % 6 < 3 ? C.hon5 : C.hon4);
}, { outline: .85, level: 1, furn: 'catTree' });
O('catTreeShelfLow', [34, 80, Z1 + 18, 46, 92, Z1 + 21], () => {
  soft(34, 80, Z1 + 18, 12, 12, 3, 'pin', 5);
}, { level: 1, furn: 'catTree' });
O('catTreeTop', [36, 78, Z1 + 38, 50, 92, Z1 + 42], () => {
  soft(36, 78, Z1 + 38, 14, 14, 4, 'pin', 4);
  top(39, 81, Z1 + 42, 8, 8, (i, j) => (i - 3.5) ** 2 + (j - 3.5) ** 2 < 14 ? (i + j) % 5 === 0 ? C.pin4 : C.pin6 : -1);
}, { level: 1, furn: 'catTree' });

/* the padded nest the cat naps in */
const CATBED = { x: 67, y: 91, z: Z1 + 4 };
O('catBed', [58, 84, Z1, 76, 98, Z1 + 5], () => {
  soft(58, 84, Z1, 18, 14, 4, 'cld', 5, { top: (i, j) => {
    const d = Math.hypot((i - 8.5) * .9, j - 6.5);
    return d < 5 ? C.pin5 : d < 6 ? C.pin3 : null;
  } });
}, { shadow: 1, level: 1 });

/* the striped play tent: an A-frame whose mouth faces the room */
const TENT = { x: 72, y: 64, z: Z1 };
O('tent', [72, 44, Z1, 93, 65, Z1 + 26], () => {
  const x = 72, w = 20, h = 22, y1 = 64, y0 = 44, cx = 9.5;
  const half = k => (h - k) * (w / 2) / h;
  for (let yy = y0; yy <= y1; yy += .5) for (let k = 0; k <= h; k += .5) {
    const X = x + w - k * (w / 2) / h, band = Math.floor(yy / 5) % 2;
    const col = k < 1 ? C.hon1 : k > h - 1 ? C.crm7 : band ? C.crm5 : C.sea3;
    put(Math.round(OX + X - yy), Math.round(OY + (X + yy) / 2 - Z1 - k), col, X | 0, yy | 0, Z1 + (k | 0), NX);
  }
  fy(x, y1, Z1, w, h + 1, (i, k) => {
    const d = Math.abs(i - cx);
    if (d > half(k)) return -1;
    if (d > half(k) - 1.5) return C.crm7;
    if (d < (13 - k) * .46 && k < 13) return k < 1 ? C.hon1 : C.mid2;
    return Math.floor((i + 40) / 4) % 2 ? C.sea5 : C.crm7;
  });
  spr(x + 10, y1, Z1 + h, 'p:pin3 q:pin5 s:hon2', ['pq...', 'ppq..', 'pq...', 's....', 's....']);
}, { level: 1, furn: 'tent' });

/* the wicker toy basket, full of balls */
const BASKET = { x: 86, y: 80 };
O('ballBasket', [BASKET.x - 7, BASKET.y - 7, Z1, BASKET.x + 7, BASKET.y + 7, Z1 + 14], () => {
  const x = BASKET.x, y = BASKET.y, sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1) - Z1;
  const balls = [[-4, -13, 'pin5'], [1, -14, 'sea5'], [4, -12, 'amb6'], [-1, -11, 'lef5'], [-5, -10, 'crm7'], [5, -10, 'ter6']];
  for (const [bx, by, co] of balls) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b < 6) put(sx0 + bx + a, sy0 + by + b, a + b < -1 ? lite(C[co], 1.14) : a + b > 2 ? lite(C[co], .78) : C[co], x, y, Z1 + 14, NBILL);
  for (let s = -7; s <= 7; s++) {
    const arc = Math.sqrt(Math.max(0, 49 - s * s)) / 2;
    for (let k = 0; k < 10; k++) {
      const co = (s + k * 3 + 90) % 6 < 3 ? C.hon5 : C.hon4;
      put(sx0 + s, Math.round(sy0 + arc - k - 2), k === 9 ? C.hon6 : co, x, y, Z1 + k, s > 0 ? NX : NY);
    }
  }
}, { outline: .8, shadow: 1, level: 1, furn: 'basket' });

/* the wooden blocks, stacked and tumbled */
O('blocksF1', [38, 22, Z1, 54, 36, Z1 + 14], () => {
  box(42, 26, Z1, 7, 7, 7, { t: C.pin5, l: C.pin3, r: C.pin2 });
  box(48, 23, Z1, 6, 6, 6, { t: C.amb7, l: C.amb5, r: C.amb4 });
  box(43, 27, Z1 + 7, 5, 5, 5, { t: C.sea6, l: C.sea4, r: C.sea3 });
}, { level: 1, furn: 'blocks' });

light(70, 88, Z1 + 40, '#fff4d8', .3, 80, 'G');
light(30, 80, Z1 + 42, '#d8f0ff', .35, 60, 'G');
light(70, 30, Z1 + 30, '#dff2ff', .32, 56, 'G');
