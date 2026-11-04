/* ═══════════════════════════════════════════════════════════════════════
   The island: pale sand, a green hem round the keep, palms and sunflowers, a
   parasol waiting for someone, and a jetty. Things that can stand in front of
   the tower carry fg, which paints them after it.
   ═══════════════════════════════════════════════════════════════════════ */
const shoreAt = (X, Y) => shoreF(OX + X - Y, OY + ((X + Y) >> 1));
const isLand = (X, Y) => shoreAt(X, Y) < 1;
const GRASS_F = (X, Y) => (hexAt(X, Y) - 1) * 30 + (hsh(X >> 3, Y >> 3, 17) - .5) * 14;
O('island', [-70, -70, -2, 240, 240, 0], () => {
  top(-70, -70, 0, 310, 310, (i, j) => {
    const X = i - 70, Y = j - 70, f = shoreAt(X, Y);
    if (f >= 1) return -1;
    if (f > .93) return hsh(X >> 1, Y >> 1, 3) < .12 ? C.hon5 : C.hon6;
    if (GRASS_F(X, Y) < 12) {
      const v = hsh(X >> 1, Y >> 1, 5);
      if (hsh(X, Y, 9) > .985) return hsh(X, Y, 2) > .5 ? C.crm7 : C.pin5;
      return (X + Y * 3) % 7 === 0 ? C.lef6 : v < .35 ? C.lef4 : v < .85 ? C.lef5 : C.lef6;
    }
    if (GRASS_F(X, Y) < 15 && hsh(X >> 1, Y >> 1, 4) < .4) return C.lef6;
    const v = hsh(X >> 2, Y >> 2, 11), speck = hsh(X, Y, 13);
    if (speck > .985) return C.hon5;
    if (speck < .012) return C.crm6;
    return v < .4 ? C.hon7 : v < .9 ? C.crm6 : C.hon6;
  }, NTOP);
}, { ext: 1, outline: 0 });

/* the tower's shadow, laid on the ground toward the viewer's right */
O('towerShadow', [0, 0, 0, 160, 130, 1], () => {
  top(0, 0, 0, 160, 130, (X, Y) => {
    let hit = false;
    for (let d = 4; d <= 26 + hsh(Y >> 2, 3) * 5; d += 3) if (hexAt(X - d, Y) <= 1.02) { hit = true; break; }
    if (!hit || !isLand(X, Y)) return -1;
    return GRASS_F(X, Y) < 12 ? (hsh(X >> 1, Y >> 1, 5) < .6 ? C.lef3 : C.lef4) : C.hon6;
  });
}, { ext: 1, outline: 0 });

/* a low stone plinth under the keep */
O('plinth', [0, 0, 0, 112, 112, 2], () => {
  skirt(0, 2, 1.1, (s, r, side) => C['crm' + (side === 0 ? 4 : side === 1 ? 3 : 2)]);
  top(0, 0, 2, 112, 112, (i, j) => { const d = hexAt(i, j); return d > 1.1 ? -1 : d > 1.06 ? C.crm6 : C.crm4; });
}, { ext: 1, outline: 0, layer: 5 });

/* stepping stones from the playroom down to the sea */
O('pathStones', [90, 98, 0, 134, 136, 1], () => {
  for (const [x, y, r] of [[96, 104, 4], [110, 106, 4], [113, 121, 5], [128, 124, 4]]) {
    top(x - r, y - r, 0, r * 2, r * 2, (i, j) => {
      const d = Math.hypot(i - r + .5, j - r + .5);
      return d > r ? -1 : d > r - 1.2 ? C.peb3 : hsh(i >> 1, j >> 1, x) < .5 ? C.peb6 : C.peb5;
    });
  }
}, { ext: 1, outline: 0 });

/* each frond is an arc of leaflets; the list is shared with the sway effect */
function frondPixels(lean, h, seed = lean + h) {
  const out = [], n = 8;
  for (let f = 0; f < n; f++) {
    const a = (f + .5) / n * TAU + hsh(f, seed) * .3, len = 19 + hsh(f, seed, 2) * 7;
    const cosA = Math.cos(a), sinA = Math.sin(a) * .62;
    for (let s = 0; s <= len; s++) {
      const u = s / len, droop = 12 * u * u - 5 * u;
      const px = cosA * s, py = sinA * s + droop;
      const width = (1 - u) * 3.4 + .5;
      for (let w = -width; w <= width; w++) {
        const cut = Math.floor(s + Math.abs(w)) % 3 === 2 && Math.abs(w) > .8;
        if (cut) continue;
        const lit = sinA < 0 ? (w < 0 ? 'lef5' : 'lef4') : (w < 0 ? 'lef3' : 'lef2');
        out.push([Math.round(px), Math.round(py + w), C[Math.abs(w) < .6 ? 'lef6' : lit]]);
      }
    }
  }
  return out;
}
function palm(name, x, y, h, lean) {
  O(name, [x - 18, y - 18, 0, x + 18, y + 18, h + 18], () => {
    const sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1);
    for (let k = 0; k < h; k++) {
      const off = Math.round(lean * Math.pow(k / h, 1.7));
      const seg = (k >> 2) % 2;
      for (let s = -2; s <= 2; s++) put(sx0 + off + s, sy0 - k, s > 0 ? (seg ? C.hon2 : C.hon3) : seg ? C.hon4 : C.hon5, x, y, k, NBILL);
    }
    const tx = sx0 + lean, ty = sy0 - h;
    for (const [a, b] of [[-3, 1], [2, 2], [0, 3]]) for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) if (u * u + v * v < 6) put(tx + a + u, ty + b + v, u + v < 0 ? C.hon3 : C.hon1, x, y, h, NBILL);
  }, { ext: 1, outline: .86, fg: 1 });
}
const PALMS = [{ x: 10, y: 120, h: 66, lean: -7 }, { x: 121, y: 9, h: 58, lean: 6 }, { x: 36, y: 154, h: 40, lean: 5 }];
PALMS.forEach((p, n) => palm('palm' + n, p.x, p.y, p.h, p.lean));

/* a row of sunflowers along the tower's flank */
const SUNFLOWERS = [{ x: 120, y: 50 }, { x: 118, y: 34 }, { x: 137, y: 47 }, { x: 128, y: 72 }];
for (const [n, s] of SUNFLOWERS.entries()) {
  O('sunStem' + n, [s.x - 4, s.y - 4, 0, s.x + 4, s.y + 4, 24], () => {
    fy(s.x, s.y, 0, 1, 11, C.lef2);
    spr(s.x, s.y, 3, 'a:lef4 b:lef3', ['aa...', 'baaa.', '..baa'], { ax: 0 });
    spr(s.x, s.y, 6, 'a:lef5 b:lef3', ['...aa', '.aaab', 'aab..'], { ax: 4 });
  }, { ext: 1, outline: 0, fg: 1 });
}

/* the blue parasol and a striped lounger */
const PARASOL = { x: 102, y: 142 };
O('parasolShade', [PARASOL.x - 19, PARASOL.y - 15, 0, PARASOL.x + 19, PARASOL.y + 15, 1], () => {
  top(PARASOL.x - 19, PARASOL.y - 15, 0, 38, 30, (i, j) => Math.hypot((i - 19) * .9, j - 15) < 15 ? C.hon6 : -1);
}, { ext: 1, outline: 0 });
O('lounger', [62, 134, 0, 78, 164, 14], () => {
  const stripe = (i) => (i >> 2) % 2 ? C.pin6 : C.crm7, x = 63, y = 138;
  fy(x, y + 22, 0, 14, 4, (i, k) => (i < 2 || i > 11) ? C.hon3 : -1);
  fy(x, y, 0, 14, 4, (i, k) => (i < 2 || i > 11) ? C.hon2 : -1);
  top(x, y, 4, 14, 24, (i, j) => stripe(i));
  fy(x, y + 23, 3, 14, 1, (i) => stripe(i) === C.crm7 ? C.crm5 : C.pin4);
  fx(x + 13, y, 3, 24, 1, () => C.hon3);
  fy(x, y, 5, 14, 9, (i, k) => k === 8 ? C.crm7 : stripe(i));
}, { ext: 1, outline: .86, fg: 1 });
O('parasol', [PARASOL.x - 16, PARASOL.y - 16, 0, PARASOL.x + 16, PARASOL.y + 16, 46], () => {
  const x = PARASOL.x, y = PARASOL.y, sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1);
  for (let k = 0; k < 24; k++) { put(sx0, sy0 - k, C.crm7, x, y, k, NBILL); put(sx0 + 1, sy0 - k, C.crm4, x, y, k, NBILL); }
  for (let s = -20; s <= 20; s++) {
    const edge = Math.sqrt(Math.max(0, 1 - (s * s) / 400));
    const peak = 12 * edge, low = -5 * edge;
    const seg = Math.floor((s + 40) / 7) % 2;
    for (let r = low; r <= peak; r++) {
      const lv = r < low + 1.2 ? 7 : seg ? (s > 6 ? 3 : 4) : (s > 6 ? 5 : 6);
      put(sx0 + s, Math.round(sy0 - 23 - r), seg ? C['sea' + Math.min(lv, 7)] : (lv === 7 ? C.cld7 : s > 6 ? C.cld3 : C.cld6), x, y, 24, NBILL);
    }
  }
}, { ext: 1, outline: .9, fg: 1 });

/* the tide pool, with a ring of pebbles */
const POOL = { x: 40, y: 122, rx: 12, ry: 9 };
O('tidePool', [POOL.x - POOL.rx - 2, POOL.y - POOL.ry - 2, 0, POOL.x + POOL.rx + 2, POOL.y + POOL.ry + 2, 1], () => {
  const a = POOL.rx + 2, b = POOL.ry + 2;
  top(POOL.x - a, POOL.y - b, 0, a * 2, b * 2, (i, j) => {
    const q = Math.hypot((i - a + .5) / POOL.rx, (j - b + .5) / POOL.ry);
    if (q > 1.18) return -1;
    if (q > 1) return hsh(i >> 1, j >> 1, 7) < .5 ? C.peb6 : C.peb4;
    return q > .8 ? C.sea6 : q > .4 ? C.sea5 : C.sea4;
  });
}, { ext: 1, outline: 0 });

/* rocks and shells */
O('rocksA', [150, 60, 0, 170, 80, 10], () => {
  for (const [x, y, r, h] of [[158, 70, 9, 10], [166, 64, 5, 6]]) {
    const sx0 = OX + x - y, sy0 = OY + ((x + y) >> 1);
    for (let s = -r * 2; s <= r * 2; s++) {
      const e = Math.sqrt(Math.max(0, 1 - (s * s) / (4 * r * r)));
      for (let k = -e * r * .5; k <= e * h; k++) {
        const v = hsh((s + 40) >> 2, Math.floor(k) >> 1, 3);
        put(sx0 + s, Math.round(sy0 - k), s > r ? C.peb3 : v < .5 ? C.peb4 : C.peb5, x, y, Math.max(0, k), NBILL);
      }
    }
  }
}, { ext: 1, outline: .75, fg: 1 });
O('shells', [20, 100, 0, 150, 200, 3], () => {
  spr(70, 176, 0, 'a:pin6 b:pin4', ['.a.', 'aba', 'bab']);
  spr(140, 148, 0, 'a:crm7 b:crm4', ['aab', 'aba']);
  spr(58, 180, 0, 'a:amb7 b:amb5', ['.ab', 'aab']);
  spr(150, 108, 0, 'a:pin7 b:pin5', ['.a.', 'aba']);
}, { ext: 1, outline: 0 });

/* the jetty stepping out into the blue */
const JETTY = { x: 160, y: 118, len: 48 };
O('jetty', [150, 112, -4, 214, 128, 5], () => {
  top(152, 112, 5, 60, 14, (i, j) => {
    if (i % 7 === 6) return C.hon2;
    if (j === 0 || j === 13) return C.hon3;
    return hsh(i >> 3, j >> 2, 5) < .5 ? C.hon6 : C.hon5;
  });
  fy(152, 125, 0, 60, 5, (i, k) => k === 4 ? C.hon4 : (i % 14 === 3) ? C.hon3 : i % 14 < 3 ? C.hon2 : -1);
  fx(211, 112, 0, 13, 5, (j, k) => k === 4 ? C.hon3 : j % 12 < 2 ? C.hon2 : -1);
}, { ext: 1, outline: .8 });
O('jettyPosts', [206, 110, 0, 214, 130, 14], () => {
  fy(210, 112, 0, 2, 12, (i) => i ? C.hon2 : C.hon4);
  fy(210, 125, 0, 2, 12, (i) => i ? C.hon2 : C.hon4);
}, { ext: 1, outline: 0 });

/* a sign in the sand */
O('sign', [120, 96, 0, 132, 102, 18], () => {
  fy(125, 99, 0, 2, 12, (i) => i ? C.hon3 : C.hon5);
  spr(126, 99, 10, 'o:hon1 a:hon6 b:hon5 c:hon2', ['oooooooooo', 'oaaaaaaaao', 'oaccaacaao', 'oaaaaaaabo', 'oooooooooo'], { ax: 5 });
}, { ext: 1, outline: 0, fg: 1 });

light(120, 40, 60, '#fff2c0', .06, 200, 'E', { flat: 1 });
