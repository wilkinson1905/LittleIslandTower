/* ═══════════════════════════════════════════════════════════════════════
   The tower: a slender hexagonal keep, cut open at the front, under a bell roof.
   On screen the plan is a hexagon 140 wide and 70 deep with clean 1:1 slanted
   sides. s runs screen-right and t runs screen-down from the hexagon's centre.
   ═══════════════════════════════════════════════════════════════════════ */
const HC = 56, HW = 70, HH = 35, STOREY = 100, SLAB = 6, WALLH = STOREY - SLAB, FLOOR_Z = [4, 104, 204];
const TOP_Z = n => FLOOR_Z[n - 1] + WALLH;
const worldAt = (s, t) => [HC + t + s / 2, HC + t - s / 2];
const hexD = (s, t) => Math.max(Math.abs(t) / HH, (Math.abs(s) + Math.abs(t)) / HW);
const hexAt = (x, y) => hexD(x - y, (x + y) / 2 - HC);
const backT = s => Math.abs(s) <= HH ? -HH : -(HW - Math.abs(s));
const scrY = (t, z) => OY + HC + t - z;
const L_WALL = n => 10 * n - 1, L_FLOOR = n => 10 * n, L_BACK = n => 10 * n + 1, L_ONBACK = n => 10 * n + 1.5, L_PILLAR = n => 10 * n + 5;

const grain = (ramp, lv) => (i, j) => {
  const v = hsh(i >> 2, j >> 4, 5);
  if ((j + (hsh(i >> 3, 3) * 9 | 0)) % 9 === 0) return C[ramp + Math.max(0, lv - 1)];
  return C[ramp + clamp(lv + (v < .25 ? -1 : v > .85 ? 1 : 0), 0, 7)];
};
const planks = (w, seg, ramp, lv, salt = 0) => (i, j) => {
  const b = Math.floor(i / w), off = hsh(b, salt) * seg | 0, s = Math.floor((j + off) / seg);
  if (i % w === w - 1 || (j + off) % seg === 0) return C[ramp + Math.max(0, lv - 2)];
  const v = hsh(b, s, salt);
  return C[ramp + clamp(lv + (v < .28 ? -1 : v > .8 ? 1 : 0), 0, 7)];
};
/* cream castle stone: big soft blocks in a running bond */
const stone = (i, k, salt = 0) => {
  const row = Math.floor(k / 6), off = row % 2 ? 5 : 0, u = i + off;
  if (k % 6 === 5 || u % 10 === 9) return C.crm3;
  const v = hsh(Math.floor(u / 10), row, 61 + salt);
  return v < .2 ? C.crm4 : v < .85 ? C.crm5 : C.crm6;
};

/* ── painters for a hexagonal plan ────────────────────────────────────── */
/* The three back walls, one screen column at a time. f(s, k, side): side 0 left, 1 back, 2 right. */
function backWalls(Z, h, f) {
  for (let s = -HW; s <= HW; s++) {
    const t = backT(s), [x, y] = worldAt(s, t), side = s < -HH ? 0 : s > HH ? 2 : 1;
    for (let k = 0; k < h; k++) {
      const v = f(s, k, side);
      if (v == null || v < 0) continue;
      put(OX + s, scrY(t, Z + k), v, x | 0, y | 0, Z + k, NBILL);
    }
  }
}
/* A band around the three front faces of the hexagon, scaled by m. f(s, row, side) */
function skirt(z0, h, m, f) {
  const hw = Math.round(HW * m), hh = Math.round(HH * m);
  for (let s = -hw; s <= hw; s++) {
    const t = Math.min(hh, hw - Math.abs(s)), [x, y] = worldAt(s, t), side = s < -hh ? 0 : s > hh ? 2 : 1;
    for (let r = 0; r < h; r++) {
      const v = f(s, r, side);
      if (v == null || v < 0) continue;
      put(OX + s, scrY(t, z0 + r), v, x | 0, y | 0, z0 + r, NBILL);
    }
  }
}
/* A box whose front face looks straight at the viewer, for things along the back wall. */
function frontBox(s0, w, t0, z, h, d, front, topc) {
  for (let u = 0; u < w; u++) {
    const s = s0 + u, [x0, y0] = worldAt(s, t0);
    for (let k = 0; k < h; k++) {
      const v = val(front, u, k);
      if (v == null || v < 0) continue;
      put(OX + s, scrY(t0, z + k), v, x0 | 0, y0 | 0, z + k, NBILL);
    }
    for (let e = 0; e < d; e++) {
      const v = val(topc, u, e);
      if (v == null || v < 0) continue;
      const [x, y] = worldAt(s, t0 - e);
      put(OX + s, scrY(t0 - e, z + h), v, x | 0, y | 0, z + h, NTOP);
    }
  }
}
/* Shelf front with two rows of books of varied widths and heights. */
function bookFace(w, h, seed, cols) {
  const mid = h >> 1, table = [];
  for (let r = 0; r < 2; r++) {
    const row = new Array(w).fill(null);
    let u = 2, n = 0;
    while (u < w - 2) {
      const bw = 2 + (hsh(n, r, seed) * 3 | 0), bh = (r ? h - mid - 2 : mid - 1) - (hsh(n, r, seed + 1) * 3 | 0);
      const co = cols[(hsh(n, r, seed + 2) * cols.length) | 0];
      for (let a = 0; a < bw && u + a < w - 2; a++) row[u + a] = { bh, co, first: a === 0 };
      u += bw; n++;
    }
    table.push(row);
  }
  return (u, k) => {
    if (k === 0 || k === h - 1 || k === mid || u < 2 || u >= w - 2) return k === h - 1 || u === 0 ? C.hon6 : C.hon5;
    const r = k < mid ? 0 : 1, base = r ? mid + 1 : 1, b = table[r][u];
    if (!b || k - base >= b.bh) return C.hon1;
    return b.first ? lite(C[b.co], 1.16) : k - base === b.bh - 1 ? C.crm7 : C[b.co];
  };
}

/* ── windows: arched, bright glass that always shows the summer sky ─────── */
const WINS = [];
function archShape(u, v, w, h, m, foot = m) {
  if (u < m || u >= w - m || v < foot) return false;
  const rad = w / 2, top = h - rad;
  if (v < top) return true;
  const a = (u + .5 - rad) / (rad - m), b = (v + .5 - top) / (rad - m);
  return a * a + b * b <= 1;
}
/* An arched opening in a back wall, starting at column s0. */
function archWindow(name, s0, z0, w, h, level) {
  const win = { name, s0, z0, w, h, level };
  win.isGlass = (u, v) => archShape(u, v, w, h, 2);
  const glass = (u, v) => {
    if (u === (w >> 1) || v === Math.floor(h * .42)) return C.crm7;
    const cloud = Math.hypot((u - w * .34) * .8, (v - h * .3) * 1.4) < w * .2 || Math.hypot((u - w * .55) * .8, (v - h * .24) * 1.4) < w * .16;
    if (cloud) return C.cld7;
    if (v < 3) return C.sea5;
    return v / h > .6 ? C.azu4 : C.azu5;
  };
  win.ob = O(name, [-100, -100, z0, -99, -99, z0 + h], () => {
    for (let u = 0; u < w; u++) {
      const s = s0 + u, t = backT(s), [x, y] = worldAt(s, t);
      for (let v = 0; v < h; v++) {
        if (!archShape(u, v, w, h, 0)) continue;
        const inner = archShape(u, v, w, h, 2);
        const col = inner ? glass(u, v) : archShape(u, v, w, h, 1) ? C.crm7 : C.hon3;
        put(OX + s, scrY(t, z0 + v), col, x | 0, y | 0, z0 + v, inner ? NEMIT : NBILL);
      }
    }
  }, { outline: 0, level, layer: L_WALL(level) + .5 });
  WINS.push(win);
  return win;
}

/* ── one storey: back walls, the corner pillars and the floor slab ───── */
function storeyShell(n, floorFn, wallFn) {
  const Z = FLOOR_Z[n - 1], edge = n === 1 ? 4 : SLAB;
  O(`walls${n}`, [-100, -100, Z, -99, -99, Z + WALLH], () => {
    backWalls(Z, WALLH, (s, k, side) => {
      const v = wallFn(s + HW, k);
      if (v == null || v < 0) return v;
      return lite(v, side === 0 ? 1 : side === 1 ? .95 : .9);
    });
  }, { level: n, layer: L_WALL(n), outline: 0 });
  O(`floor${n}`, [3, 3, Z - edge, 110, 110, Z], () => {
    const m = 1.03;
    skirt(Z - edge, edge, m, (s, r, side) => {
      const lv = side === 0 ? 6 : side === 1 ? 5 : 4;
      if (r === edge - 1) return C.crm7;
      if (r === edge - 2 && n > 1) return C.sea2;
      return r === 0 ? C['crm' + (lv - 3)] : C['crm' + lv];
    });
    top(0, 0, Z, 112, 112, (i, j) => {
      const d = hexAt(i, j);
      if (d > m) return -1;
      return d > 1 ? C.crm7 : floorFn(i, j);
    });
  }, { level: n, layer: L_FLOOR(n), ext: 0, outline: 0 });
  // the walls' cut ends: a short stretch of outer wall on each side of the opening
  const pillar = (name, s0, s1, shade) => O(name + n, [3, 3, Z, 110, 110, Z + WALLH], () => {
    for (let s = s0; s <= s1; s++) {
      const t = HW - Math.abs(s), [x, y] = worldAt(s, t), isCut = Math.abs(s) === 62;
      for (let k = 0; k < WALLH; k++) {
        const under = k > WALLH - 4;
        let col = stone(s + 70, k + Z, n);
        if (isCut) col = C.crm7;
        col = lite(col, under ? shade * .8 : shade);
        put(OX + s, scrY(t, Z + k), col, x | 0, y | 0, Z + k, NBILL);
      }
    }
  }, { level: n, layer: L_PILLAR(n), ext: 1, outline: .85 });
  pillar('pillarL', -70, -62, 1.04);
  pillar('pillarR', 62, 70, .9);
}

/* ── the bell roof: sits right on the walls, flares at the eaves, sweeps up to a bulb ── */
const ROOF_PROFILE = [
  [0, 1.05], [2, 1.02], [6, 1.0], [12, .95], [18, .86], [23, .73], [27, .56], [31, .42], [37, .3], [44, .21], [50, .165],
  [54, .185], [58, .24], [62, .27], [66, .25], [70, .19], [74, .1], [77, .06], [78, .1], [80, .1], [81, .05], [90, .035], [104, .02],
];
const roofR = h => {
  const P = ROOF_PROFILE;
  for (let i = 1; i < P.length; i++) if (h <= P[i][0]) return lerp(P[i - 1][1], P[i][1], (h - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
  return P[P.length - 1][1];
};
/* the colour the roof was bought in: which ramp, and how far along it, so each reads as itself */
const ROOF_RAMPS = { blue: ['sea', 0], red: ['red', 0], green: ['lef', 0], pink: ['pin', -1] };
const roofCol = lv => { const [r, d] = ROOF_RAMPS[WORLD.roof]; return C[r + clamp(lv + d, 0, 7)]; };
function bellRoof(n) {
  const Zb = TOP_Z(n), BANDS = [6, 7, 27, 28, 50, 51];
  O('roof' + n, [3, 3, Zb, 110, 110, Zb + 120], () => {
    // the moulded cornice the roof rests on
    skirt(Zb, 6, 1.05, (s, r, side) => {
      const lv = side === 0 ? 6 : side === 1 ? 5 : 4;
      return r === 0 ? C['crm' + (lv - 3)] : r === 3 ? roofCol(2) : r > 3 ? C.crm7 : C['crm' + lv];
    });
    const z0 = Zb + 6;
    for (let h = 0; h <= 104; h++) {
      const m = roofR(h), hw = HW * m, hh = HH * m, dr = m - roofR(h + 1);
      const gold = h >= 77 && h <= 81;
      for (let t = Math.ceil(-hh); t <= hh; t++) for (let s = Math.ceil(-hw); s <= hw; s++) {
        if (Math.abs(s) + Math.abs(t) > hw) continue;
        const m1 = Math.abs(t) / (hh || 1), m2 = (Math.abs(s) + Math.abs(t)) / (hw || 1), flat = m1 >= m2;
        const a = flat ? s / (hh || 1) : t / (hh || 1);
        let lv = flat ? (t >= 0 ? 4 : 5) : s < 0 ? 5 : 3;
        const ribs = Math.max(1, Math.round(5 * m));
        if (m > .3) {
          const f = ((a + 1) * ribs) % 1;
          if (f < .22) lv -= 1;
        }
        if (Math.abs(m1 - m2) < .045 / Math.max(m, .3)) lv += 2;
        if (dr > .03) lv += .5;
        if (BANDS.includes(h)) lv -= 1;
        // the bulb catches the sun on its upper left
        if (h > 50 && h < 76 && s < -hw * .25 && t < hh * .5) lv += 1;
        const [x, y] = worldAt(s, t);
        const col = gold ? (s < 0 ? C.amb7 : C.amb5) : roofCol(clamp(Math.round(lv), 0, 7));
        put(OX + s, scrY(t, z0 + h), col, x | 0, y | 0, z0 + h, NBILL);
      }
    }
    // the little gold ball at the very top
    const yb = scrY(0, z0 + 106);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b < 6) put(OX + a, yb + b, a + b < 0 ? C.amb7 : C.amb5, HC, HC, z0 + 106, NBILL);
  }, { only: n, layer: 95, ext: 1, outline: .86 });
}
for (let n = 1; n <= 3; n++) bellRoof(n);

/* ── sky and sea, baked once behind everything ────────────────────────── */
const SHORE = { cy: 66, ru: 160, rv: 78 };
function shoreF(sx, sy) { // below 1 is land, in screen space so the coast looks organic
  const u = (sx - OX) / SHORE.ru, v = (sy - OY - SHORE.cy) / SHORE.rv, a = Math.atan2(v, u);
  return u * u + v * v + Math.sin(a * 3 + 1) * .07 + Math.sin(a * 7 + 2) * .04 + Math.sin(a * 13) * .02;
}
const HORIZON = 212;
function buildSky() {
  const cv = makeCanvas(W, H), cx = cv.getContext('2d'), img = cx.createImageData(W, H), d = new Uint32Array(img.data.buffer);
  const th = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const skyStops = [1, 2, 3, 4, 5, 6, 7].map(i => pal('azu' + i));
  for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
    const k = clamp(Math.floor(Math.pow(y / HORIZON, 1.25) * skyStops.length + (th(x, y) - .5) * .7), 0, skyStops.length - 1);
    d[y * W + x] = PAL32[skyStops[k]];
  }
  // the far bank along the horizon, pale with distance, then the great towers in front
  const far = [];
  for (let i = 0; i < 10; i++) far.push({ x: -14 + i * 43 + hsh(i, 5) * 16, base: HORIZON, h: 14 + hsh(i, 6) * 22, w: 24 + hsh(i, 7) * 14, lean: 0, seed: 200 + i });
  paintCumulus(d, W, HORIZON, far, 3, true);
  const B = HORIZON - 7;
  paintCumulus(d, W, HORIZON, [
    { x: 64, base: B, h: 162, w: 66, lean: 14, seed: 11 }, { x: 8, base: B, h: 106, w: 52, lean: -6, seed: 12 },
    { x: 132, base: B, h: 88, w: 50, lean: 10, seed: 13 }, { x: 176, base: B + 2, h: 42, w: 34, lean: 2, seed: 14 },
    { x: 314, base: B, h: 120, w: 58, lean: -8, seed: 15 }, { x: 366, base: B, h: 78, w: 46, lean: 4, seed: 16 },
    { x: 254, base: B + 1, h: 56, w: 40, lean: -6, seed: 17 },
  ], 5, false);
  // sea: pale at the horizon, deep offshore, turquoise over the shallows
  const seaLv = [6, 5, 4, 3, 3, 2];
  for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) {
    const f = shoreF(x, y), off = clamp((y - HORIZON) / 90, 0, 1);
    let lv;
    const dth = (th(x, y) - .5) * .09;
    if (f + dth < 1.12) lv = 7;
    else if (f + dth < 1.34) lv = 6;
    else if (f + dth < 1.68) lv = 5;
    else if (f + dth < 2.3) lv = 4;
    else lv = y > 560 + (th(x, y) - .5) * 12 ? 2 : 3;
    if (off < 1) lv = Math.max(lv, Math.round(lerp(6, 3, off) + (th(x, y) - .5) * .9));
    let col = pal('sea' + lv);
    // long swell lines and dabs of light
    if ((y + (hsh(x >> 5, y >> 3, 7) * 6 | 0)) % 9 === 0 && hsh(x >> 3, y, 3) > .42 && lv < 7) col = pal('sea' + Math.min(7, lv + 1));
    d[y * W + x] = PAL32[col];
  }
  // horizon line: a bright hair of light
  for (let x = 0; x < W; x++) d[HORIZON * W + x] = PAL32[pal('cld6')];
  cx.putImageData(img, 0, 0);
  LAYER.sky = cv;

  // small fair-weather clouds that drift across; they stay clear of the 320 wrap seam
  LAYER.clouds = [0, 1].map(n => {
    const cw = 320, c = makeCanvas(cw, H), ct = c.getContext('2d'), im = ct.createImageData(cw, H), dd = new Uint32Array(im.data.buffer);
    const r = mulberry(n ? 91 : 53), list = [], count = n ? 4 : 2;
    for (let i = 0; i < count; i++) {
      list.push({ x: 40 + (i + .5) / count * 240 + (r() - .5) * 30, base: n ? 26 + r() * 38 : 118 + r() * 40, h: n ? 7 + r() * 4 : 12 + r() * 6, w: n ? 13 + r() * 7 : 24 + r() * 8, lean: 0, seed: 300 + n * 10 + i });
    }
    paintCumulus(dd, cw, HORIZON, list, 2, false);
    ct.putImageData(im, 0, 0);
    return c;
  });
}

/* ── cumulus ─────────────────────────────────────────────────────────────
   Each tower is grown as billows on billows into one height field, which is then
   warped and lit as a single surface, so no separate round puff ever shows. */
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hsh(ix, iy, s), hsh(ix + 1, iy, s), u), lerp(hsh(ix, iy + 1, s), hsh(ix + 1, iy + 1, s), u), v);
}
function paintCumulus(out, w, h, towers, minLv, pale) {
  const pad = 24, bw = w + pad * 2, bh = h + pad, N2 = bw * bh;
  const F = new Float32Array(N2), own = new Int16Array(N2).fill(-1);
  const stamp = (px, py, r, pz, n, base) => {
    const x0 = Math.max(0, Math.floor(px - r + pad)), x1 = Math.min(bw - 1, Math.ceil(px + r + pad));
    const y0 = Math.max(0, Math.floor(py - r + pad)), y1 = Math.min(bh - 1, Math.ceil(py + r + pad), Math.floor(base + pad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - pad - px, dy = (y - pad - py) * 1.1, dd = dx * dx + dy * dy;
      if (dd >= r * r) continue;
      const v = pz + Math.sqrt(r * r - dd), i = y * bw + x;
      if (v > F[i]) { F[i] = v; own[i] = n; }
    }
  };
  towers.forEach((t, n) => {
    const r = mulberry(t.seed), lobes = Math.round(9 + t.h / 7), ph = r() * 6;
    const billow = (cx, cy, rad, pz, depth) => {
      stamp(cx, cy, rad, pz, n, t.base);
      if (depth === 0 || rad < 2.2) return;
      const rim = 3 + (rad / 5 | 0), face = 2 + (rad / 7 | 0);
      for (let i = 0; i < rim; i++) { // bumps around the upper edge, which make the outline
        const a = lerp(-Math.PI * 1.12, Math.PI * .12, r()), rc = rad * (.26 + r() * .24);
        billow(cx + Math.cos(a) * rad * .8, cy + Math.sin(a) * rad * .8, rc, pz + rad * .25, depth - 1);
      }
      for (let i = 0; i < face; i++) { // bumps across the face, which make the shading
        const a = r() * TAU, q = Math.sqrt(r()) * rad * .75, rc = rad * (.24 + r() * .2);
        const px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q;
        billow(px, py, rc, pz + Math.sqrt(Math.max(0, rad * rad - q * q)) * .72, depth - 1);
      }
    };
    for (let i = 0; i < lobes; i++) {
      const v = (i + .5) / lobes, half = t.w * Math.pow(1 - v, .55) * (.72 + .28 * Math.sin(v * 9 + ph));
      const rad = lerp(t.w * .44, t.w * .2, v) * (.8 + r() * .45);
      billow(t.x + t.lean * v + (r() * 2 - 1) * half, t.base - v * t.h, rad, rad * .5 + r() * 8, 2);
    }
  });
  // warp the whole field so the billows lose their perfect curves, then soften it for lighting
  const G = new Float32Array(N2), own2 = new Int16Array(N2).fill(-1);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const wx = (vnoise(x / 23, y / 23, 3) - .5) * 15 + (vnoise(x / 8, y / 8, 4) - .5) * 5;
    const wy = (vnoise(x / 23, y / 23, 5) - .5) * 11 + (vnoise(x / 8, y / 8, 6) - .5) * 4;
    const sx = clamp(Math.round(x + wx), 0, bw - 1), sy = clamp(Math.round(y + wy), 0, bh - 1), i = sy * bw + sx;
    G[y * bw + x] = F[i]; own2[y * bw + x] = own[i];
  }
  const blur = (src, rad) => {
    const a = new Float32Array(N2), b = new Float32Array(N2), span = rad * 2 + 1;
    for (let y = 0; y < bh; y++) {
      let s = 0;
      for (let x = -rad; x <= rad; x++) s += src[y * bw + clamp(x, 0, bw - 1)];
      for (let x = 0; x < bw; x++) { a[y * bw + x] = s / span; s += src[y * bw + clamp(x + rad + 1, 0, bw - 1)] - src[y * bw + clamp(x - rad, 0, bw - 1)]; }
    }
    for (let x = 0; x < bw; x++) {
      let s = 0;
      for (let y = -rad; y <= rad; y++) s += a[clamp(y, 0, bh - 1) * bw + x];
      for (let y = 0; y < bh; y++) { b[y * bw + x] = s / span; s += a[clamp(y + rad + 1, 0, bh - 1) * bw + x] - a[clamp(y - rad, 0, bh - 1) * bw + x]; }
    }
    return b;
  };
  const S = blur(G, 1), wide = blur(G, 7), lv = new Int8Array(N2);
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
    const i = y * bw + x, n = own2[i];
    if (n < 0 || G[i] <= 0) continue;
    const t = towers[n], gx = (S[i + 1] - S[i - 1]) * .5, gy = (S[i + bw] - S[i - bw]) * .5;
    const lit = (.6 * gx + .72 * gy + .34) / Math.sqrt(gx * gx + gy * gy + 1);
    const cav = clamp((S[i] - wide[i]) / 6, -1, 1);
    const up = t.base - (y - pad), low = 1 - clamp(up / Math.min(46, t.h * .55), 0, 1);
    const grain = (vnoise(x / 3.5, y / 3.5, 8) - .5) * .1;
    const tone = lit * .7 + .3 + cav * .3 - low * low * .62 + grain + (BAYER[(y & 3) * 4 + (x & 3)] - .5) * .05;
    lv[i] = tone > .74 ? 7 : tone > .6 ? 6 : tone > .47 ? 5 : tone > .35 ? 4 : tone > .23 ? 3 : tone > .1 ? 2 : 1;
  }
  // tidy lone pixels so the shading reads as hand-placed clusters
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + pad) * bw + x + pad;
    let k = lv[i];
    if (!k) continue;
    const cnt = new Int8Array(9);
    for (const j of [i - 1, i + 1, i - bw, i + bw]) if (j >= 0 && j < N2) cnt[lv[j]]++;
    let best = k, bc = cnt[k];
    if (bc === 0) for (let c = 1; c < 8; c++) if (cnt[c] > bc || (bc && cnt[c] === bc && Math.abs(c - k) < Math.abs(best - k))) { bc = cnt[c]; best = c; }
    k = pale ? Math.min(7, 4 + Math.round(best * .45)) : Math.max(minLv > 2 ? 1 : minLv, best);
    out[y * w + x] = PAL32[pal('cld' + k)];
  }
}
