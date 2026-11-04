/* ═══════════════════════════════════════════════════════════════════════
   Micro-animation systems. Every one is a closed-form function of time with
   an integer number of cycles in 120 s, reusing fixed typed arrays.
   ═══════════════════════════════════════════════════════════════════════ */
const FX_INFO = [
  ['clouds', '雲'], ['swell', 'うねり'], ['sparkle', '海のきらめき'], ['foam', '波打ち際'], ['ripples', '杭の波紋'],
  ['gulls', 'かもめ'], ['sail', '遠くの帆船'], ['boat', '桟橋の小舟'], ['fishJump', 'はねる魚'], ['shoal', '泳ぐ魚'], ['turtle', '海がめの影'],
  ['jelly', '空のくらげ'], ['shower', '天気雨'], ['rainbow', '虹'], ['palms', 'やしの葉'], ['sunflowers', 'ひまわり'],
  ['grass', '草'], ['butterflies', 'ちょう'], ['bee', 'はち'], ['crab', 'かに'], ['pool', '潮だまり'],
  ['paperBoat', '笹舟'], ['pennant', '尖塔の旗'], ['roofGlint', '屋根の照り'], ['winGlint', '窓の照り'], ['sunPatch', '床の日だまり'],
  ['dust', 'ほこり'], ['chime', '風鈴'], ['ball', '転がるまり'], ['mobile', '星のモビール'], ['flames', '窯の火'],
  ['potSteam', '鍋の湯気'], ['candle', 'ケーキのろうそく'], ['fish', '金魚'], ['lamp', '貝のランプ'], ['book', '浮かぶ本'],
  ['lantern', '星のランタン'], ['prism', '虹のかけら'], ['tail', '猫のしっぽ'], ['zzz', '寝息'], ['actors', '動物'],
];
const FX = {};
FX_INFO.forEach(([k]) => { FX[k] = true; });

const P = {};
for (const k in C) P[k] = PIDX.get(C[k]);
const UPP = new Uint8Array(PAL_RGB.length), DOWNP = new Uint8Array(PAL_RGB.length);
const isExt = new Uint8Array(OBJ.length + 1);

/* Everything the picture needs from the game. The picture is a pure function of
   (time, this), so while none of it changes the 120 s loop holds exactly. */
const WORLD = {
  pets: { dragon: false, sheep: false, penguin: false },
  aff: { cat: 0, pup: 0, rabbit: 0, sheep: 0, dragon: 0, penguin: 0 },
  beach: [],
  presents: [],
  sillTreat: false,
  hunger: { cat: 1, pup: 1, rabbit: 1, sheep: 1, dragon: 1, penguin: 1 },
  roof: 'blue',
  glow: -1,                 // the slot of the piece of glass that has been waiting longest to be noticed
  tap: {},                  // things tapped just now, and when; the picture is untouched while it's empty
  react: {},
  sparks: [],
  now: 0,
};
const present = id => id === 'cat' ? true : id === 'pup' ? storeys >= 2 : id === 'rabbit' ? storeys >= 3 : !!WORLD.pets[id];

/* ── writing pixels ───────────────────────────────────────────────────── */
function spx(sx, sy, pi) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  dyn[sy * W + sx] = PAL32[pi];
}
/* over the outdoors only: sky, sea, roofs, sand */
function ppx(sx, sy, pi) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const i = sy * W + sx;
  if (isExt[gId[i]]) dyn[i] = PAL32[pi];
}
/* over open water and sky only: nothing painted is there */
function seapx(sx, sy, pi) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const i = sy * W + sx;
  if (!gId[i]) dyn[i] = PAL32[pi];
}
/* a palette shift of whatever the base layer holds */
function shiftPx(i, table) {
  const v = baseIdx[i];
  if (v) dyn[i] = PAL32[table[v]];
}
function shiftAt(sx, sy, table) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  shiftPx(sy * W + sx, table);
}
/* a sprite placed on the screen, with nothing in front of it */
function sblit(s, sx, sy, flip = false, gate = spx) {
  const x0 = flip ? sx - (s.w - 1 - s.ax) : sx - s.ax, y0 = sy - s.ay;
  for (let j = 0; j < s.h; j++) for (let c = 0; c < s.w; c++) {
    const v = s.d[j * s.w + c];
    if (v) gate(x0 + (flip ? s.w - 1 - c : c), y0 + j, v);
  }
}

/* ── occlusion: which static objects sit in front of this box? ─────────── */
const frontTag = new Uint32Array(OBJ.length + 2);
let frontGen = 0;
const tmpBox = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
function markFront(x0, y0, z0, x1, y1, z1) {
  tmpBox.x0 = x0; tmpBox.y0 = y0; tmpBox.z0 = z0; tmpBox.x1 = x1; tmpBox.y1 = y1; tmpBox.z1 = z1;
  frontGen++;
  for (let n = 1; n < OBJ.length; n++) if (behindCmp(tmpBox, OBJ[n]) < 0) frontTag[n] = frontGen;
}

/* ── lighting for moving things: same lights, same bands, palette-shift LUTs ─ */
const lutCache = new Map();
const RAMP_OF = [];
for (const name in RAMPS) {
  const members = RAMPS[name].map(h => PIDX.get(hex(h)));
  for (const m of members) RAMP_OF[m] = members;
}
function lutFor(r, g, b, ownRamp) {
  const qr = Math.round(r / LSTEP), qg = Math.round(g / LSTEP), qb = Math.round(b / LSTEP);
  const key = (ownRamp ? 1 << 24 : 0) | qr << 16 | qg << 8 | qb;
  let l = lutCache.get(key);
  if (l) return l;
  l = new Uint32Array(PAL_RGB.length);
  for (let i = 1; i < PAL_RGB.length; i++) {
    const p = PAL_RGB[i], R_ = p[0] * qr * LSTEP, G_ = p[1] * qg * LSTEP, B_ = p[2] * qb * LSTEP;
    if (!ownRamp) { l[i] = PAL32[nearest(R_, G_, B_)]; continue; }
    let best = i, bd = Infinity;
    for (const m of RAMP_OF[i]) {
      const c = PAL_RGB[m], d = (c[0] - R_) ** 2 + (c[1] - G_) ** 2 + (c[2] - B_) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    l[i] = PAL32[best];
  }
  lutCache.set(key, l);
  return l;
}
let fireNow = 1;
const actorLut = (x, y, z, zone) => lightLut(x, y, z, zone || null, .25, 1.06);
function lightLut(x, y, z, zoneForce, chroma = 1, ceil = 9) {
  const zone = zoneForce || roomZone(z), amb = AMBIENT[zone];
  let r = amb[0], g = amb[1], b = amb[2];
  for (const l of LIGHTS) {
    if (!onNow(l) || !l.zone.includes(zone)) continue;
    const dx = l.x - x, dy = l.y - y, dz = l.z - (z + 10), d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= l.rad) continue;
    let a = 1 - d / l.rad; a *= a * l.i * .72;
    if (l.fire) a *= fireNow;
    r += l.r * a; g += l.g * a; b += l.b * a;
  }
  const m = (r + g + b) / 3;
  r = m + (r - m) * chroma; g = m + (g - m) * chroma; b = m + (b - m) * chroma;
  return lutFor(clamp(r, .62, ceil), clamp(g, .56, ceil), clamp(b, .56, ceil), chroma < 1);
}
/* ── sprite blit, respecting what stands in front ─────────────────────── */
function blit(s, x, y, z, flip, lut, ox = 0, oy = 0) {
  const X = Math.round(x), Y = Math.round(y), Z = Math.round(z);
  const px = OX + X - Y + ox, py = OY + ((X + Y) >> 1) - Z + oy;
  const sx0 = flip ? px - (s.w - 1 - s.ax) : px - s.ax, sy0 = py - s.ay;
  for (let j = 0; j < s.h; j++) {
    const sy = sy0 + j;
    if (sy < 0 || sy >= H) continue;
    for (let c = 0; c < s.w; c++) {
      const v = s.d[j * s.w + c];
      if (!v) continue;
      const sx = sx0 + (flip ? s.w - 1 - c : c);
      if (sx < 0 || sx >= W) continue;
      const i = sy * W + sx;
      if (frontTag[gId[i]] === frontGen) continue;
      dyn[i] = lut[v];
    }
  }
}
function lpx(sx, sy, lut, pi) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const i = sy * W + sx;
  if (frontTag[gId[i]] === frontGen) return;
  dyn[i] = lut[pi];
}
const iX = (x, y) => OX + Math.round(x) - Math.round(y);
const iY = (x, y, z) => OY + ((Math.round(x) + Math.round(y)) >> 1) - Math.round(z);
const fr = (t, fps, n) => Math.floor(t * fps) % n;
function fireLevel(t) { return clamp(Math.floor(pnoise(t, 480, 21) * .7 * 4 + pnoise(t, 1080, 22) * .3 * 4), 0, 3); }

function wisps(sx, sy, n, cycles, height, seed, t, c1, c2, amt = 1) {
  for (let i = 0; i < n; i++) {
    const c = (cycles + (i % 5)) * t / LOOP + hsh(i, seed), f = c - Math.floor(c);
    if (hsh(i, Math.floor(c) % (cycles + (i % 5)), seed + 1) > amt) continue;
    const x = sx + Math.sin(f * 6 + i * 2) * (1 + f * 2.5) + (hsh(i, seed + 2) - .5) * 3;
    const y = sy - f * height;
    if (f > .85 && (x + y | 0) % 2) continue;
    spx(x | 0, y | 0, f < .45 ? c1 : c2);
  }
}
function fxZ(sx, sy, t, ph) {
  for (let i = 0; i < 2; i++) {
    const c = cyc(t, 12, ph + i * .5);
    if (c > .8) continue;
    const X = sx + Math.round(Math.sin(c * 6) * 2) + Math.round(c * 5), Y = sy - Math.round(c * 12);
    const pi = c < .5 ? P.cld7 : P.cld5;
    if (c < .35) spx(X, Y, pi);
    else { spx(X, Y, pi); spx(X + 1, Y, pi); spx(X + 1, Y + 1, pi); spx(X, Y + 2, pi); spx(X + 1, Y + 2, pi); }
  }
}

/* ── things that notice a finger: each records where it is as it's drawn ─ */
const CRIT = {};
function crit(key, x, y, r, gate = 0) {
  const c = CRIT[key] || (CRIT[key] = { key, x: 0, y: 0, r: 0, gate: 0 });
  c.x = x; c.y = y; c.r = r; c.gate = gate;
}
/* how long ago it was tapped, or -1; a reaction forgets itself when it's over */
function tapAge(key, dur) {
  const k = WORLD.tap[key];
  if (!k) return -1;
  const e = WORLD.now - k.t0;
  if (e < 0 || e >= dur) { delete WORLD.tap[key]; return -1; }
  return e;
}
const riseFall = u => (u < .35 ? smooth(u / .35) : 1 - smooth((u - .35) / .65));
function rockBlit(s, sx, sy, tilt, gate) {
  const x0 = sx - s.ax, y0 = sy - s.ay, mid = s.w / 2;
  for (let j = 0; j < s.h; j++) for (let c = 0; c < s.w; c++) {
    const v = s.d[j * s.w + c];
    if (v) gate(x0 + c, y0 + j + Math.round((c - mid) * tilt), v);
  }
}
/* ── the sea ──────────────────────────────────────────────────────────── */
const FOAM = { idx: null, f: null, ph: null };
function initFoam() {
  const idx = [], fs = [], ph = [];
  for (let sy = HORIZON + 4; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const f = shoreF(sx, sy);
    if (f < .95 || f > 1.07) continue;
    const i = sy * W + sx;
    idx.push(i); fs.push(f); ph.push(Math.atan2((sy - 471) * 2, sx - 180) / TAU + .5);
  }
  FOAM.idx = Int32Array.from(idx); FOAM.f = Float32Array.from(fs); FOAM.ph = Float32Array.from(ph);
}
function fxFoam(t) {
  const { idx, f, ph } = FOAM, ok = NAMED.island.id;
  for (let n = 0; n < idx.length; n++) {
    const i = idx[n], g = gId[i];
    if (g !== 0 && g !== ok) continue;
    const a = ph[n], w = .5 + .5 * Math.sin(TAU * (8 * t / LOOP + a * 5) + Math.sin(a * 37) * 2);
    const edge = 1.03 - w * .06, d = f[n] - edge;
    if (d > -.007 && d < .006) dyn[i] = PAL32[P.cld7];
    else if (d >= .006 && d < .016 && (i + (i / W | 0)) % 3 === 0) dyn[i] = PAL32[P.sea7];
  }
}
function fxSwell(t) {
  for (let n = 0; n < 70; n++) {
    const y = HORIZON + 8 + (hsh(n, 41) * (H - HORIZON - 10) | 0), near = (y - HORIZON) / (H - HORIZON);
    const speed = 1 + (n % 3), x0 = Math.floor((hsh(n, 42) + cyc(t, speed)) * (W + 40)) % (W + 40) - 20;
    const len = 4 + (hsh(n, 43) * 8 + near * 8 | 0), lift = Math.round(osc(t, 6, hsh(n, 44)) * 1);
    const col = near < .3 ? P.sea6 : hsh(n, 45) < .5 ? P.azu6 : P.sea5;
    for (let k = 0; k < len; k++) seapx(x0 + k, y + lift, col);
  }
}
function fxSparkle(t) {
  for (let n = 0; n < 80; n++) {
    const sx = hsh(n, 51) * W | 0, sy = HORIZON + 6 + (hsh(n, 52) * (H - HORIZON - 8) | 0);
    const c = cyc(t, 18 + (n % 11), hsh(n, 53));
    if (c > .14) continue;
    seapx(sx, sy, P.cld7);
    if (c > .04 && c < .1) { seapx(sx - 1, sy, P.sea7); seapx(sx + 1, sy, P.sea7); seapx(sx, sy - 1, P.sea7); seapx(sx, sy + 1, P.sea7); }
  }
}
function fxRipples(t) {
  const rings = [[210, 112, 0], [210, 125, .33], [186, 138, .66]];
  for (const [x, y, ph] of rings) {
    const sx = iX(x, y), sy = iY(x, y, 0), c = cyc(t, 18, ph), r = 2 + c * 6;
    for (let a = 0; a < 18; a++) {
      if (c > .6 && a % 2) continue;
      seapx(Math.round(sx + Math.cos(a / 18 * TAU) * r), Math.round(sy + Math.sin(a / 18 * TAU) * r * .45), P.sea6);
    }
  }
}
const GULL = [
  mk(['o...o', '.o.o.', '..o..'], 'o:cld7'),
  mk(['.....', 'ooooo', '..o..'], 'o:cld7'),
  mk(['..o..', '.o.o.', 'o...o'], 'o:cld7'),
];
const GULL_KEYS = ['gull0', 'gull1', 'gull2'];
function fxGulls(t) {
  for (let n = 0; n < 3; n++) {
    const c = cyc(t, 2 + (n === 2 ? 1 : 0), n * .37), sx = Math.floor(c * 420) - 30;
    const key = GULL_KEYS[n], e = tapAge(key, 4.5), X = n === 1 ? W - sx : sx;
    const sy = 66 + n * 34 + Math.round(osc(t, 7 + n, n * .2) * 9) - (e < 0 ? 0 : Math.round(riseFall(e / 4.5) * 40));
    sblit(GULL[fr(t, (4 + n) * (e < 0 ? 1 : 3), 3)], X, sy, false, (x, y) => ppx(x, y, P.cld7));
    crit(key, X, sy - 1, 5, 2);
  }
}
const SAILBOAT = mk(['...o....', '...oW...', '...oWW..', '...oWWW.', '...oWWWW', '...o....', 'hhhhhhhh', '.hhhhhh.'], 'o:hon2 W:cld7 h:ter5');
function fxSail(t) {
  const e = tapAge('sail', 10);                 // a burst of speed, then the wind drops until it's back on time
  const dx = e < 0 ? 0 : e < 1.5 ? 28 * smooth(e / 1.5) : 28 * (1 - smooth((e - 1.5) / 8.5));
  const fade = e < 0 ? 0 : Math.max(0, 1 - e / 4);
  const sx = Math.floor(cyc(t, 1, .3) * 400) - 20 + Math.round(dx), sy = HORIZON + 4 + Math.round(osc(t, 8) * .6);
  if (fade) rockBlit(SAILBOAT, sx, sy, Math.sin(e * 5) * .28 * fade, seaVal);
  else sblit(SAILBOAT, sx, sy, false, seaVal);
  crit('sail', sx, sy - 4, 8, 1);
}
function seaVal(x, y, v) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  if (!gId[i]) dyn[i] = PAL32[v];
}
const DINGHY = [
  mk(['......o.......', '...ooooooo....', '.oaaaaaaaaaoo.', 'obbbbbbbbbbbbo', '.occcccccccco.', '..oooooooooo..'], 'o:hon1 a:hon6 b:cld7 c:sea3'),
];
function fxBoat(t) {
  const sx = iX(186, 134), sy = iY(186, 134, 0) + Math.round(osc(t, 10) * 1), e = tapAge('boat', 3.5);
  if (e < 0) sblit(DINGHY[0], sx, sy, osc(t, 2, .1) > .9);
  else {
    const fade = 1 - e / 3.5;
    for (let n = 0; n < 2; n++) {
      const u = (e - n * .5) / 2;
      if (u <= 0 || u >= 1) continue;
      for (let a = 0; a < 28; a++) if (a % 2 || u < .6) seapx(Math.round(sx + Math.cos(a / 28 * TAU) * (9 + u * 16)), Math.round(sy - 2 + Math.sin(a / 28 * TAU) * (4 + u * 7)), P.cld7);
    }
    rockBlit(DINGHY[0], sx, sy + Math.round(Math.sin(e * 7) * 1.5 * fade), Math.sin(e * 6) * .3 * fade, spx);
  }
  crit('boat', sx, sy - 3, 9);
}
const FISHLET = mk(['.oo.o', 'oaaoo', '.oo.o'], 'o:peb3 a:cld7');
function fxFishJump(t) {
  for (let n = 0; n < 3; n++) {
    const c = cyc(t, 4 + n, n * .29);
    if (c > .08) continue;
    const u = c / .08, sx = 30 + hsh(n, 61) * 300 | 0, sy = 568 + hsh(n, 62) * 60 | 0;
    sblit(FISHLET, sx + Math.round(u * 14), sy - Math.round(Math.sin(u * Math.PI) * 11), n % 2 === 1, seaVal);
    if (u > .85 || u < .12) for (let a = 0; a < 6; a++) seapx(sx + (u > .5 ? 14 : 0) + a - 3, sy + (a % 2), P.cld7);
  }
}
function fxTurtle(t) {
  const e = tapAge('turtle', 12);        // dives in a hurry, and comes back up a good while later
  const vis = e < 0 ? 1 : e < 1 ? 1 - e : e < 10 ? 0 : (e - 10) / 2;
  const sx = Math.floor(cyc(t, 1, .1) * 440) - 40 + (e >= 0 && e < 1 ? Math.round(smooth(e) * 22) : 0), sy = 574 + Math.round(osc(t, 3) * 3), fl = e >= 0 && e < 1 ? fr(t, 8, 2) : fr(t, 2, 2);
  crit('turtle', sx, sy, vis > .3 ? 12 : 0, 1);
  if (e >= 0 && e < 1.6) for (let i = 0; i < 8; i++) {
    const c = e * 1.1 - hsh(i, 75) * .5;
    if (c > 0 && c < 1) seapx(sx - 6 + Math.round(hsh(i, 76) * 14), sy + 2 - Math.round(c * 16), P.cld7);
  }
  if (vis <= 0) return;
  const px = (x, y, col) => { if (vis >= 1 || hsh(x - sx, y - sy, 77) < vis) seapx(x, y, col); };
  for (let a = -8; a <= 8; a++) for (let b = -4; b <= 4; b++) if ((a * a) / 64 + (b * b) / 16 < 1) px(sx + a, sy + b, (a + b * 2) % 5 === 0 ? P.azu4 : P.azu3);
  for (let k = 0; k < 4; k++) { px(sx + 6 + k, sy - 4 - k * (fl ? 1 : 0), P.azu3); px(sx + 6 + k, sy + 4 + k * (fl ? 0 : 1), P.azu3); px(sx - 6 - k, sy - 3, P.azu3); px(sx - 6 - k, sy + 3, P.azu3); }
  for (let a = 9; a < 12; a++) for (let b = -1; b <= 1; b++) px(sx + a, sy + b, P.azu3);
}
/* shadows in the shallows, following the shore: centre of its beat, distance from the shore, beats per block, phase */
const SHOAL = [[1.57, 1.34, 3, .1], [2.2, 1.46, 2, .4], [.95, 1.4, 3, .7], [1.2, 1.24, 2, .2], [1.95, 1.26, 3, .55]];
const FISH_KEYS = SHOAL.map((f, n) => 'fish' + n);
const fishX = [0, 0], fishAt = (n, t) => {
  const [a0, f, c, ph] = SHOAL[n], a = a0 + osc(t, c, ph) * .34;
  const r = Math.sqrt(Math.max(.1, f - (Math.sin(a * 3 + 1) * .07 + Math.sin(a * 7 + 2) * .04 + Math.sin(a * 13) * .02)));
  fishX[0] = 180 + SHORE.ru * r * Math.cos(a); fishX[1] = OY + SHORE.cy + SHORE.rv * r * Math.sin(a);
  return fishX;
};
function fxShoal(t) {
  for (let n = 0; n < SHOAL.length; n++) {
    const key = FISH_KEYS[n], e = tapAge(key, 7.5);
    const ahead = fishAt(n, t + .2)[0], at = fishAt(n, t);
    let x = at[0], y = at[1], vis = 1, dir = ahead > x ? 1 : -1, wag = fr(t, 5, 2);
    if (e >= 0) {          // gone in a flash, and back when the coast is clear
      const k = WORLD.tap[key];
      if (e < .8) { const u = e / .8, off = 1 - (1 - u) ** 3; x += k.dx * off; y += k.dy * off; vis = 1 - u * u; dir = k.dx > 0 ? 1 : -1; wag = fr(t, 24, 2); }
      else if (e < 6.5) vis = 0;
      else vis = e - 6.5;
    }
    x = Math.round(x); y = Math.round(y);
    crit(key, x, y, vis > .4 ? 5 : 0, 1);
    if (vis <= 0) continue;
    const px = (a, b, col) => { if (vis >= 1 || hsh(a, b, n, 79) < vis) seapx(x + a * dir, y + b, col); };
    for (let a = -3; a <= 4; a++) { const w = a < -1 || a > 3 ? 0 : 1; for (let b = -w; b <= w; b++) px(a, b, b ? P.azu2 : P.azu1); }
    px(-4, wag ? -1 : 1, P.azu2); px(-5, wag ? -2 : 2, P.azu2); px(-5, wag ? -1 : 1, P.azu2); px(-4, 0, P.azu2);
  }
}
const JELLY_KEYS = ['jelly0', 'jelly1'];
const JELLY = [
  mk(['...ppp...', '.ppWWWpp.', 'pWWWWWWWp', 'pWWWWWWWp', 'ppppppppp', '.p.p.p.p.', '.p.p.p.p.', 'p.p.p.p..', '.p.p.p.p.'], 'p:pin6 W:cld7'),
  mk(['.........', '...ppp...', '.pWWWWWp.', 'pWWWWWWWp', 'ppppppppp', 'p.p.p.p.p', '.p.p.p.p.', '.p.p.p.p.', 'p.p.p.p..'], 'p:pin6 W:cld7'),
];
function fxJelly(t) {
  for (let n = 0; n < 2; n++) {
    const key = JELLY_KEYS[n], e = tapAge(key, 4.5), c = cyc(t, 1, n * .55), sx = 40 + n * 250 + Math.round(osc(t, 3, n * .3) * 16);
    const sy = 210 - Math.floor(c * 230) - (e < 0 ? 0 : Math.round(riseFall(e / 4.5) * 34));
    const s = JELLY[e < 0 ? fr(t, 1 + n, 2) : fr(t, 4, 2)], glows = e >= 0 && e < 1.4;
    sblit(s, sx, sy, n === 1, (x, y, v) => { if (y >= 0 && y < HORIZON && (e >= 0 || (x + y) % 2 === 0)) ppx(x, y, glows ? UPP[v] : v); });
    if (glows) for (let a = 0; a < 10; a++) ppx(sx + Math.round(Math.cos(a / 10 * TAU) * (7 + e * 5)), sy - 4 + Math.round(Math.sin(a / 10 * TAU) * (7 + e * 5)), P.pin5);
    crit(key, sx, sy - 4, sy > 0 && sy < HORIZON + 4 ? 7 : 0, 2);
  }
}
/* ── weather: a sun shower, then a rainbow, on stories that ask for one ─ */
function showerAmount(b, local) {
  if (!b.shower) return 0;
  const [a, z] = b.shower;
  return smooth((local - a) / 3) * (1 - smooth((local - z + 3) / 3));
}
function rainbowAmount(b, local) {
  if (!b.shower) return 0;
  const z = b.shower[1];
  return smooth((local - z + 2) / 5) * (1 - smooth((local - z - 18) / 8));
}
function fxShower(t, b, local) {
  const amt = showerAmount(b, local);
  if (amt <= 0) return;
  const count = Math.floor(170 * amt);
  for (let i = 0; i < count; i++) {
    const c = (90 + (hsh(i, 71) * 40 | 0)) * t / LOOP + hsh(i, 72), f = c - Math.floor(c);
    const y0 = f * (H + 30) - 20 | 0, base = hsh(i, 73) * (W + 60);
    const x0 = (((base - y0 * .12) % (W + 60)) + W + 60) % (W + 60) - 30 | 0;
    const col = i % 3 ? P.cld7 : P.sea7, len = 3 + (i % 3);
    for (let k = 0; k < len; k++) ppx(x0 - (k * .12 | 0), y0 + k, col);
  }
}
const BOW = ['ter6', 'amb6', 'amb7', 'lef6', 'sea6', 'azu5', 'pin5'];
function fxRainbow(t, b, local) {
  const amt = rainbowAmount(b, local);
  if (amt <= 0) return;
  const cx = 180, cy = HORIZON, R0 = 176;
  for (let n = 0; n < BOW.length; n++) {
    const r = R0 - n * 2, pi = P[BOW[n]];
    for (let a = 0; a < 480; a++) {
      const ang = Math.PI * a / 480, sx = Math.round(cx + Math.cos(ang) * r), sy = Math.round(cy - Math.sin(ang) * r * .8);
      if (sy >= HORIZON || sx < 0 || sx >= W) continue;
      // really see-through: the sky shows more and more, and it thins out towards the horizon
      const a8 = Math.round(amt * Math.min(1, (HORIZON - sy) / 26) * 158);
      if (a8 <= 0) continue;
      const v = (PAL32[pi] & 0xffffff | a8 << 24) >>> 0;
      for (let k = 0; k < 2; k++) {
        const y = sy + k;
        if (y < 0 || y >= H) continue;
        const i = y * W + sx;
        if (!gId[i] && !dyn[i]) dyn[i] = v;
      }
    }
  }
}
/* ── the island ───────────────────────────────────────────────────────── */
const FROND = [];
function initFronds() {
  FROND.length = 0;
  for (const p of PALMS) {
    // each frond keeps its own pixels and moves alone; outlines go first so they only show at the edge of the crown
    const parts = new Map(), line = [], fill = [];
    for (const [dx, dy, col, f, u] of frondPixels(p.lean, p.h)) {
      if (!parts.has(f)) parts.set(f, new Map());
      const m = parts.get(f), key = dx * 4096 + dy, old = m.get(key);
      if (!old || u > old.u) m.set(key, { col, u });
    }
    for (const [f, m] of parts) for (const [key, { col, u }] of m) {
      const dx = Math.round(key / 4096), dy = key - dx * 4096;
      fill.push([dx, dy, PIDX.get(col), u, f]);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m.has((dx + a) * 4096 + dy + b)) line.push([dx + a, dy + b, P.lef1, u, f]);
    }
    const all = line.concat(fill);
    FROND.push({
      tx: OX + p.x - p.y + p.lean, ty: OY + ((p.x + p.y) >> 1) - p.h, seed: p.h,
      xs: Int16Array.from(all, a => a[0]), ys: Int16Array.from(all, a => a[1]), cs: Uint8Array.from(all, a => a[2]),
      us: Float32Array.from(all, a => a[3] * a[3]), fs: Uint8Array.from(all, a => a[4]),   // the base of a frond stays put
    });
  }
}
const frondDX = new Float32Array(8), frondDY = new Float32Array(8);
function drawPalms(t, on) {
  for (const f of FROND) {
    for (let k = 0; k < 8; k++) {
      frondDX[k] = on ? osc(t, 4 + k % 2, f.seed * .01 + k * .29) * .9 : 0;
      frondDY[k] = on ? osc(t, 5 + k % 3, f.seed * .03 + k * .41) * 1.6 : 0;
    }
    const { xs, ys, cs, us, fs, tx, ty } = f;
    for (let n = 0; n < xs.length; n++) {
      const u = us[n], k = fs[n], sx = tx + xs[n] + Math.round(frondDX[k] * u), sy = ty + ys[n] + Math.round(frondDY[k] * u);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      dyn[sy * W + sx] = PAL32[cs[n]];
    }
  }
}
const SUNHEAD = mk(['..y.y..', '.yYyYy.', 'yYBbBYy', '.YbbbY.', 'yYBbBYy', '.yYyYy.', '..y.y..'], 'y:amb7 Y:amb5 b:hon1 B:hon2', 3);
function drawSunflowers(t, on) {
  SUNFLOWERS.forEach((s, n) => {
    const dx = on ? Math.round(osc(t, 11, n * .23) * 1) : 0, dy = on ? Math.round(osc(t, 7, n * .4) * .6) : 0;
    sblit(SUNHEAD, iX(s.x, s.y) + dx, iY(s.x, s.y, 10) + dy);
  });
}
const GRASSP = { xs: null };
function initGrass() {
  const list = [], isl = NAMED.island.id;
  for (let n = 0; n < 12000 && list.length < 90; n++) {
    const i = (hsh(n, 81) * N) | 0, g = gId[i];
    if (g !== isl) continue;
    const r = RAMP_OF[baseIdx[i]];
    if (r && r === RAMP_OF[P.lef5]) list.push(i);
  }
  GRASSP.xs = Int32Array.from(list);
}
function fxGrass(t) {
  for (let n = 0; n < GRASSP.xs.length; n++) {
    const i = GRASSP.xs[n], sx = i % W, sy = i / W | 0;
    const w = osc(t, 16, sx * .021 + sy * .013);
    const dx = w > .35 ? 1 : w < -.35 ? -1 : 0;
    spx(sx, sy, P.lef6); spx(sx + dx, sy - 1, P.lef6); spx(sx + dx, sy - 2, P.lef5);
  }
}
const FLUT = [
  mk(['aa.aa', 'abobA'.replace('A', 'a'), '.aoa.', '..o..'], 'a:pin5 b:cld7 o:wood1'),
  mk(['.....', '.aoa.', '.aoa.', '..o..'], 'a:pin4 o:wood1'),
  mk(['aa.aa', 'abobA'.replace('A', 'a'), '.aoa.', '..o..'], 'a:sea4 b:cld7 o:wood1'),
  mk(['.....', '.aoa.', '.aoa.', '..o..'], 'a:sea3 o:wood1'),
];
const BUTTER_KEYS = ['butter0', 'butter1'];
function fxButter(t) {
  for (let n = 0; n < 2; n++) {
    const key = BUTTER_KEYS[n], e = tapAge(key, 3.6), h = e < 0 ? 0 : riseFall(e / 3.6);
    const sx = 290 + Math.round(osc(t, 3 + n, n * .4) * 22 + osc(t, 11, n * .1) * 5 + (e < 0 ? 0 : h * Math.sin(e * 4) * 9));
    const sy = 448 + Math.round(osc(t, 4, n * .3) * 16 + osc(t, 17, n * .2) * 3 - h * 44);
    sblit(FLUT[n * 2 + fr(t, e < 0 ? 8 : 20, 2)], sx, sy);
    crit(key, sx, sy - 2, 4);
  }
}
function fxBee(t) {
  const e = tapAge('bee', 2.6), turn = e < 0 ? 0 : Math.sin(e / 2.6 * Math.PI) * 10;
  const sx = 282 + Math.round(osc(t, 5) * 16 + osc(t, 37, .2) * 3 + (e < 0 ? 0 : Math.cos(e * 14) * turn));
  const sy = 438 + Math.round(osc(t, 7, .4) * 10 + osc(t, 41) * 2 + (e < 0 ? 0 : Math.sin(e * 14) * turn * .7));
  crit('bee', sx, sy, 4);
  spx(sx, sy, P.amb7); spx(sx + 1, sy, P.mid1); if (fr(t, 12, 2)) spx(sx, sy - 1, P.cld7);
}
const CRAB = [
  mk(['o.....o', 'oo.w.oo', '.orrrro', 'o.rrr.o', '.o...o.'], 'o:ter3 r:ter5 w:cld7'),
  mk(['o.....o', 'oo.w.oo', 'orrrro.', '.orrr.o', 'o...o..'], 'o:ter3 r:ter5 w:cld7'),
  mk(['oo...oo', 'oo.w.oo', '.orrro.', 'o.rrr.o', '.o...o.'], 'o:ter3 r:ter5 w:cld7'),
];
/* some animal is pestering the crab: read from the timelines, so the loop stays pure */
function crabTeased(b, local) {
  for (const id of ACTOR_IDS) if (present(id) && findSeg(b[id], local).anim === 'tease') return true;
  return false;
}
function fxCrab(t, b, local) {
  const c = cyc(t, 3), walk = c < .3 ? c / .3 : c < .5 ? 1 : c < .8 ? 1 - (c - .5) / .3 : 0;
  const moving = (c < .3 || (c >= .5 && c < .8)), x = 112 + Math.round(walk * 34), e = tapAge('crab', 4.5);
  if (e >= 0) {          // claws up, off it scuttles, and back it comes when nothing happens
    const run = e < .6 ? 0 : e < 2 ? smooth((e - .6) / 1.4) : 1 - smooth((e - 2) / 2.5), X = x + Math.round(run * WORLD.tap.crab.dir * 30);
    if (e < .6) sblit(CRAB[2], X, 528 - fr(t, 8, 2) * 2);
    else sblit(fr(t, 16, 2) ? CRAB[2] : CRAB[1], X, 528);
    crit('crab', X, 526, 5);
    return;
  }
  crit('crab', x, 526, 5);
  if (!moving && crabTeased(b, local)) sblit(CRAB[fr(t, 5, 2) ? 2 : 0], x, 528 - fr(t, 5, 2));
  else sblit(CRAB[moving ? fr(t, 6, 2) : 0], x, 528);
}
function fxPool(t) {
  const sx = iX(POOL.x, POOL.y), sy = iY(POOL.x, POOL.y, 0), id = NAMED.tidePool.id;
  for (let n = 0; n < 2; n++) {
    const c = cyc(t, 10, n * .5), r = 2 + c * 11;
    for (let a = 0; a < 26; a++) {
      const X = Math.round(sx + Math.cos(a / 26 * TAU) * r * 1.5), Y = Math.round(sy + Math.sin(a / 26 * TAU) * r * .62), i = Y * W + X;
      if (gId[i] === id && RAMP_OF[baseIdx[i]] === RAMP_OF[P.sea5] && a % 3) dyn[i] = PAL32[P.sea7];
    }
  }
}
const PAPER = mk(['..c..', '.ccc.', 'aaaaa', '.bbb.'], 'a:lef6 b:lef4 c:lef5');
function fxPaperBoat(t) {
  sblit(PAPER, iX(POOL.x, POOL.y) + Math.round(osc(t, 2) * 8), iY(POOL.x, POOL.y, 0) + Math.round(osc(t, 3, .3) * 2) + Math.round(osc(t, 16) * .6));
}
function fxPennant(t) {
  const top = TOP_Z(storeys) + 6 + 100, sx = 181, sy0 = OY + 56 - top;
  for (let u = 0; u < 12; u++) {
    const w = Math.round(Math.sin(TAU * (6 * t / LOOP) * 2 + u * .75) * (u / 12) * 2.2);
    const h = Math.round((12 - u) / 3);
    for (let v = -h; v <= h; v++) spx(sx + u, sy0 + w + v, v === -h ? P.pin7 : u > 8 ? P.pin5 : P.pin6);
  }
}
/* ── rooms ────────────────────────────────────────────────────────────── */
const ROOFPX = { list: null, id: -1 };
function initRoof() {
  const id = NAMED['roof' + storeys].id, list = [];
  for (let i = 0; i < N; i++) if (gId[i] === id) list.push(i);
  ROOFPX.list = Int32Array.from(list); ROOFPX.id = id;
}
function fxRoofGlint(t) {
  const c = cyc(t, 3);
  if (c > .3) return;
  const pos = c / .3 * 260, l = ROOFPX.list;
  for (let n = 0; n < l.length; n++) {
    const i = l[n], sx = i % W, sy = i / W | 0, q = sx + sy * .6 - 90 - pos;
    if (q > 0 && q < 5) shiftPx(i, UPP);
  }
}
function fxWinGlint(t) {
  WINS.forEach((w, n) => {
    if (storeys < w.level) return;
    const c = cyc(t, 3, n * .17);
    if (c > .35) return;
    const pos = c / .35 * (w.w + w.h + 8) - 4;
    for (let u = 0; u < w.w; u++) for (let v = 0; v < w.h; v++) {
      if (!w.isGlass(u, v)) continue;
      const q = u + v - pos;
      if (q < 0 || q > 3) continue;
      const s = w.s0 + u;
      shiftAt(OX + s, scrY(backT(s), w.z0 + v), UPP);
    }
  });
}
function fxSunPatch(t) {
  WINS.forEach((w, n) => {
    if (storeys < w.level) return;
    const Z = FLOOR_Z[w.level - 1], sgn = w.s0 < 0 ? 1 : -1, lev = pnoise(t, 6, 91 + n);
    if (lev < .32) return;
    const floorId = NAMED['floor' + w.level].id;
    for (let u = 0; u < w.w; u++) {
      const s = w.s0 + u, tb = backT(s) + 3;
      for (let k = 0; k < 26; k++) {
        const sx = OX + s + sgn * (k >> 1), sy = scrY(tb + k, Z);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const i = sy * W + sx;
        if (gId[i] !== floorId) continue;
        if (u === (w.w >> 1) || k === 11) continue;
        if (lev < .46 && (sx + sy) % 2) continue;
        shiftPx(i, UPP);
      }
    }
  });
}
function fxDust(t) {
  for (let n = 1; n <= storeys; n++) {
    const Z = FLOOR_Z[n - 1];
    for (let i = 0; i < 12; i++) {
      const s = -56 + hsh(i, n, 101) * 112 + osc(t, 2 + (i % 3), hsh(i, n, 102)) * 6;
      const tt = -12 + hsh(i, n, 103) * 34, c = cyc(t, 2 + (i % 2), hsh(i, n, 104));
      const z = 8 + c * 34;
      if (tt - z < -48) continue;
      if (Math.abs(osc(t, 9, hsh(i, n, 105))) < .3) continue;
      spx(OX + Math.round(s), scrY(tt, Z + z) | 0, i % 3 ? P.crm7 : P.amb7);
    }
  }
}
const CHIME_Z = Z1 + 56;
function fxChime(t) {
  const [x, y] = worldAt(53, -8), sx0 = iX(x, y), sy0 = iY(x, y, CHIME_Z);
  const sw = osc(t, 14) * .6 + osc(t, 31, .3) * .7;
  for (let k = 0; k < 3; k++) spx(sx0, sy0 + k, P.hon2);
  for (let a = -2; a <= 2; a++) for (let b = 0; b < 4; b++) if (Math.abs(a) < 2 || b > 0) spx(sx0 + a, sy0 + 3 + b, b === 3 ? P.azu4 : a < 0 ? P.cld7 : P.sea6);
  const dx = Math.round(sw * 2.4);
  for (let k = 0; k < 4; k++) spx(sx0 + Math.round(dx * k / 4), sy0 + 7 + k, P.hon2);
  for (let k = 0; k < 5; k++) { spx(sx0 + dx, sy0 + 11 + k, P.pin6); spx(sx0 + dx + 1, sy0 + 11 + k, P.pin5); }
}
const BALLS = [
  mk(['.ooo.', 'orrwo', 'orwbo', 'owbbo', '.ooo.'], 'o:hon1 r:pin5 w:cld7 b:sea5'),
  mk(['.ooo.', 'owrro', 'obwro', 'obbwo', '.ooo.'], 'o:hon1 r:pin5 w:cld7 b:sea5'),
  mk(['.ooo.', 'obwro', 'obbwo', 'orbbo', '.ooo.'], 'o:hon1 r:pin5 w:cld7 b:sea5'),
];
function fxBall(t) {
  const c = cyc(t, 2), u = c < .2 ? c / .2 : c < .5 ? 1 : c < .7 ? 1 - (c - .5) / .2 : 0;
  const x = 46 + smooth(u) * 22, y = 72, moving = (c < .2 || (c >= .5 && c < .7));
  markFront(x - 2, y - 2, Z1, x + 2, y + 2, Z1 + 5);
  blit(BALLS[moving ? fr(t, 8, 3) : 0], x, y, Z1, false, actorLut(x, y, Z1));
}
const STAR = mk(['..a..', '.aaa.', 'aaaaa', '.aba.', '.a.a.'], 'a:amb7 b:amb5', 2, 0);
function fxMobile(t) {
  const [x, y] = worldAt(-6, -9), sx0 = iX(x, y), sy0 = iY(x, y, Z1 + 42);
  const sw = osc(t, 8) * 2, n = 3;
  for (let k = 0; k < 4; k++) spx(sx0, sy0 + k, P.hon3);
  for (let a = -8; a <= 8; a++) spx(sx0 + a, sy0 + 4 + Math.round(a * sw * .03), P.hon2);
  for (let m = 0; m < n; m++) {
    const off = [-8, 8, 0][m], drop = [5, 8, 11][m], sway = Math.round(osc(t, 10 + m * 3, m * .2) * 1.4);
    for (let k = 0; k < drop; k++) spx(sx0 + off + Math.round(sway * k / drop), sy0 + 5 + k, P.hon3);
    sblit(STAR, sx0 + off + sway, sy0 + 5 + drop, m === 1, m === 2 ? (X, Y, v) => spx(X, Y, v === P.amb7 ? P.pin6 : P.pin4) : m === 1 ? (X, Y, v) => spx(X, Y, v === P.amb7 ? P.sea6 : P.sea4) : spx);
  }
}
const OVENPX = { xs: null, bottom: 0, x0: 0, x1: 0 };
function initOven() {
  OVENPX.xs = null;
  if (storeys < 2 || !own('oven')) return;
  const id = NAMED.ovenF2.id, list = [];
  let bottom = 0, x0 = W, x1 = 0;
  for (let i = 0; i < N; i++) if (gId[i] === id && RAMP_OF[baseIdx[i]] === RAMP_OF[P.ink1]) {
    list.push(i);
    const sx = i % W, sy = i / W | 0;
    if (sy > bottom) bottom = sy;
    if (sx < x0) x0 = sx;
    if (sx > x1) x1 = sx;
  }
  OVENPX.xs = Int32Array.from(list); OVENPX.bottom = bottom; OVENPX.x0 = x0; OVENPX.x1 = x1;
}
let ovenBoost = 0;
function fxFlames(t) {
  const l = OVENPX.xs;
  if (!l) return;
  const { bottom, x0, x1 } = OVENPX, mid = (x0 + x1) / 2, f = fr(t, 12, 8);
  for (let n = 0; n < l.length; n++) {
    const i = l[n], sx = i % W, sy = i / W | 0;
    const body = (1 - Math.abs(sx - mid) / ((x1 - x0) / 2 + 1)) * (5 + ovenBoost * 4);
    const h = body + hsh(sx, f, 111) * 3, up = bottom - sy;
    if (up > h) continue;
    dyn[i] = PAL32[up < h * .35 ? P.amb7 : up < h * .7 ? P.amb5 : P.ter5];
  }
}
function fxPotSteam(t) {
  wisps(OX + 4, scrY(-31, Z2 + 17), 3, 24, 5, 121, t, P.cld7, P.cld5);
}
function fxCandle(t) {
  const sx = iX(TABLE2.x, TABLE2.y), sy = iY(TABLE2.x, TABLE2.y, TABLE2.z) - 8;
  spx(sx, sy, P.cld7); spx(sx, sy - 1, P.cld7);
  const f = fr(t, 9, 3);
  spx(sx, sy - 2, P.amb7); spx(sx + (f === 2 ? 1 : 0), sy - 3, f ? P.amb5 : P.amb7);
  if (f === 1) spx(sx, sy - 4, P.ter6);
}
const BOWL = mk(['..ooooooo..', '.owwWWWwwo.', 'oWWWWWWWWWo', 'owwwwwwwwwo', 'owwwwwwwwwo', 'owwwwwwwwwo', '.owwwwwwwo.', '..ooooooo..'], 'o:azu3 W:cld7 w:sea6', 5, 7);
function fxBowl(t, withFish) {
  const x = 78, y = 84, z = Z2 + 13;
  markFront(x - 3, y - 3, z, x + 3, y + 3, z + 8);
  const lut = actorLut(x, y, z);
  blit(BOWL, x, y, z, false, lut);
  if (!withFish) return;
  const sx = iX(x, y), sy = iY(x, y, z), u = osc(t, 8), ph = cyc(t, 8);
  const dir = ph < .5 ? 1 : -1, fx_ = sx + Math.round(u * 3), fy_ = sy - 3 + Math.round(osc(t, 13) * 1);
  lpx(fx_, fy_, lut, P.ter6); lpx(fx_ + dir, fy_, lut, P.ter6); lpx(fx_ - dir, fy_, lut, P.ter4); lpx(fx_ - dir * 2, fy_ + fr(t, 4, 2), lut, P.amb7);
}
function fxLamp(t) {
  const sx = iX(LAMP3.x, LAMP3.y), sy = iY(LAMP3.x, LAMP3.y, LAMP3.z + 8), lev = .55 + .45 * pnoise(t, 40, 131);
  for (let a = -11; a <= 11; a++) for (let b = -11; b <= 11; b++) {
    const d = Math.hypot(a, b);
    if (d > 11 || d < 5 || hsh(a, b, 132) > lev * (1 - d / 12)) continue;
    shiftAt(sx + a, sy + b, UPP);
  }
}
const FLYBOOK = [
  mk(['oo.....oo', 'oWoo.ooWo', 'oWWWoWWWo', '.ooWWWoo.', '...ooo...'], 'o:ter3 W:cld7'),
  mk(['.........', 'oooo.oooo', 'oWWWoWWWo', 'oWWWWWWWo', '.oooooo..'], 'o:ter3 W:cld7'),
  mk(['.........', '.........', 'oooooooo.', 'oWWWoWWWo', 'oooooooo.'], 'o:ter3 W:cld7'),
];
function fxBook(t) {
  const a = TAU * cyc(t, 2), x = 66 + Math.cos(a) * 11, y = 46 + Math.sin(a) * 11, z = Z3 + 24 + osc(t, 9) * 2;
  const sx = iX(x, y), g = iY(x, y, Z3);
  for (let d = -3; d <= 3; d++) if ((d & 1) === 0) shiftAt(sx + d, g + (d & 2 ? 1 : 0), DOWNP);
  frontGen++;
  blit(FLYBOOK[[0, 1, 2, 1][fr(t, 4, 4)]], x, y, z, cyc(t, 2) > .5, PAL32);
}
function fxLantern(t) {
  const [x, y] = worldAt(-30, 4), sx0 = iX(x, y), sy0 = iY(x, y, Z3 + 58), sw = osc(t, 10) * 2.2;
  for (let k = 0; k < 14; k++) spx(sx0 + Math.round(sw * k / 14), sy0 + k, P.hon3);
  const lit = fr(t, 2, 2);
  const X = sx0 + Math.round(sw), Y = sy0 + 16;
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
    const d = Math.abs(a) + Math.abs(b);
    if (d > 4 && !(Math.abs(a) < 2 || Math.abs(b) < 2)) continue;
    if (d > 5) continue;
    spx(X + a, Y + b, d > 3 ? P.amb4 : lit && d < 2 ? P.cld7 : P.amb7);
  }
}
const PRISM_COL = ['pin6', 'amb7', 'lef6', 'sea6', 'azu5', 'pin5'];
function fxPrism(t) {
  const floorId = NAMED.floor3.id;
  PRISM_COL.forEach((co, n) => {
    const s = 8 + Math.round(osc(t, 3, .1) * 18) + n * 3, tt = 14 + Math.round(osc(t, 2, .4) * 6) + (n & 1);
    const sx = OX + s, sy = scrY(tt, Z3);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) {
      const i = (sy + b) * W + sx + a;
      if (gId[i] === floorId) dyn[i] = PAL32[P[co]];
    }
  });
}
/* ── the animals: map poses to sprites ────────────────────────────────── */
const SHOT = { s: null, flip: false, h: 14, ox: 0, oy: 0, oz: 0 };
function drawCatTail(x, y, z, flip, t, mode, lut) {
  const X = Math.round(x), Y = Math.round(y), Z = Math.round(z);
  const base = { sx: OX + X - Y + (flip ? -4 : 4), sy: OY + ((X + Y) >> 1) - Z - 2 };
  const n = 11, sign = flip ? -1 : 1, a0 = mode === 'window' ? 1.5 : .55, pts = [];
  let px = base.sx, py = base.sy, ang = a0;
  const wave = Math.sin(TAU * (mode === 'window' ? 7 : 5) * t / LOOP) * .9 + Math.sin(TAU * 17 * t / LOOP) * .3;
  const flick = mode === 'window' ? Math.max(0, Math.sin(TAU * 13 * t / LOOP) - .75) * 6 : 0;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    ang += (mode === 'window' ? .06 : -.32) + wave * .16 * f + flick * .1 * f * Math.sin(i + t * 20);
    px += Math.cos(ang) * sign * 1.05; py += (mode === 'window' ? Math.sin(ang) : -Math.sin(ang)) * 1.05;
    pts.push(px, py);
  }
  for (let i = 0; i < n; i++) {
    const a = Math.round(pts[i * 2]), b = Math.round(pts[i * 2 + 1]);
    lpx(a - 1, b, lut, P.vio1); lpx(a + 1, b, lut, P.vio1); lpx(a, b - 1, lut, P.vio1); lpx(a, b + 1, lut, P.vio1);
    if (i > 2 && i < n - 1) { lpx(a + 1, b + 1, lut, P.vio1); lpx(a, b + 2, lut, P.vio1); lpx(a + 1, b - 1, lut, P.vio1); lpx(a - 1, b - 1, lut, P.vio1); }
  }
  for (let i = 0; i < n; i++) {
    const a = Math.round(pts[i * 2]), b = Math.round(pts[i * 2 + 1]), ringed = i % 3 === 1;
    lpx(a, b, lut, ringed ? P.cha5 : P.cha7);
    if (i > 2 && i < n - 1) { lpx(a, b + 1, lut, P.cha6); lpx(a + 1, b, lut, ringed ? P.cha5 : P.cha6); }
  }
}
/* the gesture an animal knows depends on how fond of you it has grown */
function gate(A, idle) {
  const aff = WORLD.aff[A.id];
  if (A.anim === 'g2' && aff < 4) return idle;
  if (A.anim === 'g4' && aff < 8) return idle;
  return A.anim;
}
const blinkAt = (t, n, ph) => cyc(t, n, ph) < .025;
const POSE = {
  cat(A, t) {
    const face = A.face, side = face === 1 || face === 3, an = gate(A, 'sit');
    SHOT.h = 14; SHOT.tail = null;
    const ear = cyc(t, 15, .2), earS = ear < .012 ? 1 : ear > .5 && ear < .512 ? 2 : 0;
    switch (an) {
      case 'walk': SHOT.s = K.walk[fr(t, 10, 4)]; SHOT.flip = side; break;
      case 'leap': case 'land': case 'crouch': SHOT.s = K.leap; SHOT.flip = side; break;
      case 'climb': SHOT.s = K.back[0]; SHOT.ox = fr(t, 10, 2); break;
      case 'gaze': SHOT.s = K.back[earS]; SHOT.tail = 'window'; break;
      case 'nose': SHOT.s = K.walk[0]; SHOT.flip = !!(A.o && A.o.flip); break;
      case 'tease': SHOT.s = A.local % 1 < .25 ? K.bat[0] : A.local % 1 < .5 ? K.bat[1] : K.sitWide; SHOT.flip = true; SHOT.tail = 'sit'; break;
      case 'stretch': SHOT.s = K.stretch[A.local > .6 && A.local < 1.8 ? 1 : 0]; SHOT.flip = true; break;
      case 'groom': SHOT.s = K.groom[A.local % 2.4 < 1.8 ? fr(t, 5, 2) : 2]; SHOT.tail = 'sit'; break;
      case 'window': SHOT.s = K.back[earS]; SHOT.tail = 'window'; break;
      case 'g2': case 'play': {
        const b = A.local % 3;
        SHOT.s = b < .4 ? K.bat[0] : b < .8 ? K.bat[1] : b < 1.2 ? K.bat[0] : K.sitWide;
        SHOT.tail = 'sit'; break;
      }
      case 'g4': SHOT.s = K.roll[fr(t, 3, 2)]; SHOT.h = 8; break;
      case 'eat': SHOT.s = K.eat[fr(t, 4, 2)]; SHOT.tail = 'sit'; break;
      case 'happy': SHOT.s = K.sitHappy; SHOT.tail = 'sit'; SHOT.oz = Math.round(Math.abs(Math.sin(t * 6)) * 2); break;
      case 'curl': SHOT.s = K.curl[Math.sin(TAU * 36 * t / LOOP) > 0 ? 1 : 0]; SHOT.h = 8; if (cyc(t, 12, .4) < .02) SHOT.s = K.curl[2]; SHOT.sleep = true; break;
      default: {
        const b = cyc(t, 24, .05);
        SHOT.s = b < .03 ? K.sitBlink : earS === 1 ? K.earL : earS === 2 ? K.earR : b > .4 && b < .55 ? K.sitLeft : K.sit;
        SHOT.tail = 'sit';
      }
    }
  },
  pup(A, t) {
    const face = A.face, side = face === 1 || face === 3, an = gate(A, 'sitWag');
    const tail = fr(t, 9, 4);
    SHOT.h = 16;
    switch (an) {
      case 'walk': case 'land': SHOT.s = D.walk[fr(t, 13, 4)]; SHOT.flip = side; break;
      case 'stand': SHOT.s = D.stand[fr(t, 7, 4)]; SHOT.flip = true; break;
      case 'stretch': SHOT.s = D.stretch[A.local > .7 && A.local < 1.9 ? 1 : 0]; SHOT.flip = true; break;
      case 'sniff': case 'eat': SHOT.s = D.sniff[fr(t, 5, 2)]; break;
      case 'climb': SHOT.s = D.back[fr(t, 13, 2)]; SHOT.ox = fr(t, 13, 2); break;
      case 'gaze': SHOT.s = D.back[fr(t, 7, 2)]; break;
      case 'nose': SHOT.s = D.stand[fr(t, 7, 4)]; SHOT.flip = !!(A.o && A.o.flip); break;
      case 'tease': case 'bark': SHOT.s = D.stretch[fr(t, 4, 2)]; SHOT.flip = true; SHOT.oz = fr(t, 4, 2) * 2; break;
      case 'g2': SHOT.s = D.sitTilt[tail]; SHOT.flip = A.local % 3 > 1.5; break;
      case 'g4': {
        const q = fr(t, 6, 4);
        SHOT.s = q === 0 || q === 3 ? D.stand[0] : D.walk[1]; SHOT.flip = q >= 2; SHOT.oz = q === 1 || q === 2 ? 2 : 0;
        break;
      }
      case 'happy': case 'play': SHOT.s = D.sitHappy[fr(t, 9, 2)]; SHOT.oz = Math.round(Math.abs(Math.sin(t * 7)) * 3); break;
      case 'curl': SHOT.s = D.curl[Math.sin(TAU * 30 * t / LOOP) > 0 ? 1 : 0]; SHOT.h = 8; SHOT.sleep = true; break;
      default: SHOT.s = blinkAt(t, 20, .35) ? D.sitBlink : D.sit[tail];
    }
  },
  rabbit(A, t) {
    const face = A.face, side = face === 1 || face === 3, an = gate(A, 'sit');
    SHOT.h = 17;
    switch (an) {
      case 'hop': case 'land': {
        const j = Math.abs(Math.sin(Math.PI * 3 * t));
        SHOT.s = (face >= 2 ? R.hopNE : R.hopSE)[j > .35 ? 1 : 0]; SHOT.flip = side; SHOT.oz = A.moving ? Math.round(j * 4) : 0;
        break;
      }
      case 'climb': SHOT.s = R.hopNE[fr(t, 5, 2)]; break;
      case 'gaze': SHOT.s = R.hopNE[0]; break;
      case 'nibble': SHOT.s = R.eat[fr(t, 5, 2)]; break;
      case 'look': SHOT.s = cyc(t, 12, .1) < .2 ? R.earsDown : blinkAt(t, 20) ? R.blink : R.sit; SHOT.flip = A.local % 4 > 2; break;
      case 'g2': { // a binky: straight up and a kick
        const u = A.local % 1.25 / 1.25, j = Math.sin(u * Math.PI);
        SHOT.s = u < .1 || u > .9 ? R.sit : R.hopSE[1]; SHOT.flip = u > .5; SHOT.oz = Math.round(j * 12);
        break;
      }
      case 'g4': SHOT.s = R.wash[fr(t, 3, 2)]; break;
      case 'eat': SHOT.s = R.eat[fr(t, 5, 2)]; break;
      case 'happy': case 'play': SHOT.s = R.happy; SHOT.oz = Math.round(Math.abs(Math.sin(t * 6)) * 5); break;
      case 'loaf': SHOT.s = R.loaf[Math.sin(TAU * 32 * t / LOOP) > 0 ? 1 : 0]; SHOT.h = 9; SHOT.sleep = true; break;
      default: SHOT.s = blinkAt(t, 20, .2) ? R.blink : R.sit;
    }
  },
  sheep(A, t) {
    const side = A.face === 1 || A.face === 3, an = gate(A, 'float'), f = fr(t, 2, 2);
    SHOT.h = 12; SHOT.flip = side; SHOT.oz = Math.round(osc(t, 30, .15) * 1.5); SHOT.floats = true;
    switch (an) {
      case 'drift': SHOT.s = (A.face >= 2 ? S.back : S.front)[f]; break;
      case 'gaze': SHOT.s = S.back[f]; break;
      case 'snooze': SHOT.s = S.blink; SHOT.oz = Math.round(osc(t, 20, .15) * 1); SHOT.sleep = true; break;
      case 'g2': case 'rainy': SHOT.s = S.blink; SHOT.effect = 'rain'; break;
      case 'arc': SHOT.s = S.happy[f]; SHOT.effect = 'bow'; break;
      case 'g4': SHOT.s = S.happy[f]; SHOT.effect = 'bow'; break;
      case 'eat': SHOT.s = S.eat[fr(t, 4, 2)]; break;
      case 'happy': case 'play': SHOT.s = S.happy[fr(t, 4, 2)]; SHOT.oz = Math.round(Math.abs(Math.sin(t * 5)) * 4); break;
      default: SHOT.s = blinkAt(t, 16, .1) ? S.blink : S.front[f];
    }
  },
  dragon(A, t) {
    const side = A.face === 1 || A.face === 3, an = gate(A, 'hover');
    SHOT.h = 14; SHOT.flip = side;
    switch (an) {
      case 'fly': case 'land': SHOT.s = (A.face >= 2 ? Y.back : Y.fly)[fr(t, 8, 4)]; SHOT.floats = true; SHOT.oz = Math.round(osc(t, 60) * 1); break;
      case 'hover': SHOT.s = Y.fly[fr(t, 8, 4)]; SHOT.floats = true; SHOT.oz = Math.round(osc(t, 40) * 2); break;
      case 'gaze': SHOT.s = Y.back[fr(t, 8, 4)]; SHOT.flip = false; SHOT.floats = hexAt(A.x, A.y) >= 1.1; break;
      case 'tease': SHOT.s = Y.puff; SHOT.floats = true; SHOT.effect = 'ring'; SHOT.flip = true; break;
      case 'blow': SHOT.s = Y.puff; SHOT.floats = true; SHOT.effect = 'flame'; SHOT.flip = true; break;
      case 'rainy': SHOT.s = Y.happy[fr(t, 6, 2)]; SHOT.floats = true; SHOT.oz = Math.round(Math.abs(Math.sin(t * 5)) * 3); break;
      case 'light': SHOT.s = Y.back[fr(t, 8, 4)]; SHOT.floats = true; SHOT.flip = false; SHOT.effect = 'breath'; break;
      case 'sleep': SHOT.s = Y.sleep[Math.sin(TAU * 26 * t / LOOP) > 0 ? 1 : 0]; SHOT.h = 8; SHOT.sleep = true; break;
      case 'g2': SHOT.s = Y.puff; SHOT.effect = 'ring'; break;
      case 'g4': { // a wobbly loop: comes back to where it started
        const a = A.u * TAU * 2;
        SHOT.s = Y.fly[fr(t, 10, 4)]; SHOT.ox = Math.round(Math.sin(a) * 12); SHOT.oz = Math.round((1 - Math.cos(a)) * 8); SHOT.floats = true;
        break;
      }
      case 'eat': SHOT.s = Y.eat[fr(t, 4, 2)]; break;
      case 'happy': case 'play': SHOT.s = Y.happy[fr(t, 6, 2)]; SHOT.oz = Math.round(Math.abs(Math.sin(t * 6)) * 4); break;
      default: SHOT.s = blinkAt(t, 20, .3) ? Y.sitBlink : Y.sit;
    }
  },
  penguin(A, t) {
    const face = A.face, side = face === 1 || face === 3;
    let an = gate(A, 'stand');
    if (A.anim === 'g2' && an !== 'g2') an = 'waddle';
    SHOT.h = 14;
    switch (an) {
      case 'waddle': SHOT.s = (A.o && A.o.to ? Q.walk : face >= 2 ? Q.back : Q.walk)[fr(t, 6, 4)]; SHOT.flip = A.o && A.o.to ? true : side; break;
      case 'flap': case 'land': case 'tease': SHOT.s = Q.flap[fr(t, 6, 2)]; break;
      case 'gaze': SHOT.s = Q.back[1]; break;
      case 'peck': SHOT.s = Q.eat[fr(t, 4, 2)]; break;
      case 'g2': SHOT.s = Q.slide[0]; SHOT.flip = true; SHOT.h = 7; break;
      case 'g4': SHOT.s = Q.happy[fr(t, 5, 2)]; SHOT.flip = fr(t, 2, 2) === 1; SHOT.oz = fr(t, 5, 2); break;
      case 'nap': SHOT.s = Q.nap[Math.sin(TAU * 24 * t / LOOP) > 0 ? 1 : 0]; SHOT.sleep = true; break;
      case 'eat': SHOT.s = Q.eat[fr(t, 4, 2)]; break;
      case 'happy': case 'play': SHOT.s = Q.happy[fr(t, 5, 2)]; SHOT.oz = fr(t, 5, 2); break;
      default: SHOT.s = blinkAt(t, 16, .2) ? Q.blink : Q.stand;
    }
  },
};
const HUNGRY = mk([
  '...ooooooo...', '..oWWWWWWWo..', '.oWWWWWWWWWo.',
  'oWWWWWWWWWWWo', 'oWWWWWWWWWWWo', 'oWWWWWWWWWWWo', 'oWWWWWWWWWWWo', 'oWWWWWWWWWWWo',
  '.oWWWWWWWWWo.', '..oWWWWWWWo..', '...ooWWWooo..', '.....oWo.....', '......o......',
], 'o:peb2 W:cld7', 6, 12);
const HEART = mk(['.o.o.', 'oPoPo', 'oPPPo', '.oPo.', '..o..'], 'o:rose2 P:pin6');
function drawHearts(sx, sy, e) {
  for (let i = 0; i < 3; i++) {
    const c = (e * .8 + i * .34) % 1;
    if (e < i * .4) continue;
    sblit(HEART, sx + Math.round(Math.sin(c * 6 + i * 2) * 3) + (i - 1) * 5, sy - Math.round(c * 15));
  }
}
function applyReact(A, time) {
  const R_ = WORLD.react[A.id];
  if (!R_) return null;
  const e = time - R_.t0;
  if (R_.fx === undefined) {
    R_.fx = A.x; R_.fy = A.y; R_.fz = A.z;
    const home = inOwnRoom(A);
    R_.sp = !R_.stay && home ? SPOT[A.id] : { x: A.x, y: A.y, z: A.z };
    R_.moves = !R_.stay && home;
    R_.flat = home || A.z <= 5;                  // somewhere a dish can stand: not a ladder, a roof or a palm
  }
  const end = R_.dur + (R_.stay ? .35 : .6), sp = R_.sp;
  if (e >= end || e < 0) { delete WORLD.react[A.id]; return null; }
  const lead = R_.moves ? .5 : 0;
  if (e < lead) {
    const u = e / lead;
    A.x = lerp(R_.fx, sp.x, u); A.y = lerp(R_.fy, sp.y, u); A.z = lerp(R_.fz, sp.z, u) + Math.sin(u * Math.PI) * 7;
    A.anim = 'land'; A.moving = true; A.face = sp.x >= R_.fx ? 0 : 3;
  } else if (e < R_.dur) {
    A.x = sp.x; A.y = sp.y; A.z = sp.z; A.anim = R_.anim; A.local = e - lead; A.moving = false; A.face = 0; A.o = null;
  } else {
    const u = (e - R_.dur) / (end - R_.dur);
    A.x = lerp(sp.x, A.x, u); A.y = lerp(sp.y, A.y, u); A.z = lerp(sp.z, A.z, u) + Math.sin(u * Math.PI) * 7;
    A.anim = 'land'; A.moving = true;
  }
  return R_;
}
function drawItem(R_, A, t, e) {
  if (e < .45 || !R_.item || !R_.flat) return;
  const sp = R_.sp, floorZ = R_.moves ? FLOOR_OF[A.id] : sp.z;
  const x0 = sp.x + 9, y0 = sp.y + 3;
  if (e > R_.dur - .1) { // put away: a little puff where it stood
    const u = (e - R_.dur + .1) / .6;
    if (u < 1) for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      spx(iX(x0, y0) + Math.round(Math.cos(a) * (2 + u * 6)), iY(x0, y0, floorZ + 3) + Math.round(Math.sin(a) * (1 + u * 3)), u < .5 ? P.cld7 : P.crm5);
    }
    return;
  }
  const lut = actorLut(x0, y0, floorZ);
  markFront(x0 - 4, y0 - 4, floorZ, x0 + 4, y0 + 4, floorZ + 8);
  if (R_.item === 'cookie' || R_.item === 'ice') {
    blit(ITEM.dish, x0, y0, floorZ, false, lut);
    if (e < R_.dur - 1) blit(ITEM[R_.item], x0, y0, floorZ + 2, false, lut);
  } else if (R_.item === 'ball') {
    const dx = Math.round(Math.sin((e - .5) * 3) * 6), j = Math.round(Math.abs(Math.sin((e - .5) * 5)) * 3);
    blit(ITEM.ball[fr(t, 8, 3)], x0 + dx, y0, floorZ + j, false, lut);
  } else blit(ITEM.wheel[fr(t, 6, 2)], x0, y0, floorZ, false, lut);
}
const FLOOR_OF = { cat: Z1, pup: Z2, rabbit: Z3, sheep: Z1, dragon: Z2, penguin: 0 };
const isOutdoors = A => hexAt(A.x, A.y) >= 1 || A.z >= TOP_Z(storeys);
const inOwnRoom = A => A.id !== 'penguin' && !isOutdoors(A) && roomZone(A.z) === roomZone(FLOOR_OF[A.id] + 1);
const drawOrder = [];
function drawActors(t, b, local) {
  drawOrder.length = 0;
  for (const id of ACTOR_IDS) {
    if (!present(id)) continue;
    const A = ACTOR[id];
    sampleActor(A, b[id], local);
    // fed: awake, and waiting at home for the next story
    if (BLOCK_TIER[id] && WORLD.hunger[id] > HUNGER_LOW && A.anim === SLEEP_POSE[id]) A.anim = AWAKE_POSE[id];
    A.react = applyReact(A, WORLD.now);
    drawOrder.push(A);
  }
  drawOrder.sort((a, c) => (a.x + a.y + a.z) - (c.x + c.y + c.z));

  for (const A of drawOrder) {
    SHOT.s = null; SHOT.flip = false; SHOT.h = 14; SHOT.ox = 0; SHOT.oy = 0; SHOT.oz = 0;
    SHOT.tail = null; SHOT.sleep = false; SHOT.floats = false; SHOT.effect = null;
    POSE[A.id](A, t);
    const lut = actorLut(A.x, A.y, A.z, isOutdoors(A) ? 'E' : null);
    const Rx = A.react, e = Rx ? WORLD.now - Rx.t0 : 0;
    if (Rx) drawItem(Rx, A, t, e);
    if (SHOT.floats || A.id === 'sheep') { // a soft shadow says how far off the floor it is
      const outside = hexAt(A.x, A.y) >= 1.1, onRoof = !outside && A.z >= TOP_Z(storeys);
      if (!onRoof) {
        const fz = outside ? 0 : FLOOR_OF[A.id], sx = iX(A.x, A.y), sy = iY(A.x, A.y, fz);
        for (let a = -7; a <= 7; a++) for (let c = -2; c <= 2; c++) if ((a * a) / 49 + (c * c) / 6 < 1) shiftAt(sx + a, sy + c, DOWNP);
      }
    }
    const z = A.z + SHOT.oz;
    markFront(A.x - 3, A.y - 3, z, A.x + 3, A.y + 3, z + SHOT.h);
    if (SHOT.tail && FX.tail) drawCatTail(A.x, A.y, z, SHOT.flip, t, SHOT.tail, lut);
    blit(SHOT.s, A.x, A.y, z, SHOT.flip, lut, SHOT.ox, SHOT.oy);
    const sx = iX(A.x, A.y) + SHOT.ox, sy = iY(A.x, A.y, z);
    A.sx = sx; A.sy = sy - Math.round(SHOT.s.h / 2); A.h = SHOT.s.h;
    if (SHOT.sleep && FX.zzz) fxZ(sx + 3, sy - SHOT.s.h, t, ACTOR_IDS.indexOf(A.id) * .17);
    if (!Rx && BLOCK_TIER[A.id] === 2 && WORLD.hunger[A.id] <= 0) {
      const bx = sx - 6, by = sy - SHOT.s.h - 1 + Math.round(osc(t, 40, ACTOR_IDS.indexOf(A.id) * .17));
      sblit(HUNGRY, bx, by); sblit(ITEM.cookie, bx, by - 4);
    }
    if (SHOT.effect === 'rain') for (let i = 0; i < 9; i++) {
      const c = cyc(t, 60 + i * 3, hsh(i, 141)), yy = sy + 1 + Math.round(c * 14);
      lpx(sx - 7 + Math.round(hsh(i, 142) * 14), yy, lut, P.sea6);
    }
    if (SHOT.effect === 'bow') BOW.forEach((co, n) => {
      const r = 15 - n;
      for (let a = 0; a <= 16; a++) lpx(sx + Math.round(Math.cos(Math.PI * a / 16) * r), sy - SHOT.s.h + 7 - Math.round(Math.sin(Math.PI * a / 16) * r * .7), lut, P[co]);
    });
    if (SHOT.effect === 'ring') {
      const c = cyc(t, 24), r = 1 + c * 5;
      if (c < .8) for (let a = 0; a < 12; a++) spx(sx + Math.round(Math.cos(a / 12 * TAU) * r), sy - 10 - Math.round(c * 16) + Math.round(Math.sin(a / 12 * TAU) * r * .7), c < .4 ? P.cld7 : P.cld5);
    }
    if (SHOT.effect === 'breath') for (let i = 0; i < 6; i++) {
      const c = cyc(t, 60, i / 6);
      spx(sx - Math.round(c * 8), sy - 7 - Math.round(c * 4 * (i % 2 ? 1 : -1)), c < .5 ? P.amb7 : P.ter5);
    }
    /* the sheep's rain reaches it at 4 s, and it's out by 7 */
    if (SHOT.effect === 'flame') {
      const g = A.local < 4 ? smooth(A.local / 1.5) : 1 - smooth((A.local - 4) / 3), len = Math.round(g * 11), f = fr(t, 12, 8);
      for (let k = 0; k < len; k++) {
        const w = Math.round((1 - k / len) * 2.4 + hsh(k, f, 143) * .9);
        for (let v = -w; v <= w; v++) spx(sx - 9 - k, sy - 8 + v, Math.abs(v) < w * .5 && k < len * .55 ? P.amb7 : k < len * .8 ? P.amb5 : P.ter5);
      }
      if (A.local > 4.5) wisps(sx - 13, sy - 10, 5, 48, 12, 144, t, P.cld7, P.cld5);
    }
    if (A.o && A.o.hearts && !Rx) drawHearts(sx + 10, sy - SHOT.s.h - 2, A.local);
    if (Rx && Rx.anim !== 'land' && e > .3) drawHearts(sx, sy - SHOT.s.h - 2, e);
  }
}
/* ── per-frame assembly ───────────────────────────────────────────────── */
const worldState = { block: null, local: 0, k: 0 };
function sampleWorld(t, k) {
  const kk = CFG.loop ? CFG.block : k;
  worldState.local = t; worldState.k = kk;
  worldState.block = blockFor(kk);
  return worldState;
}
function drawDynamic(t, st) {
  const b = st.block, local = st.local;
  ovenBoost = present('dragon') && findSeg(b.dragon, local).anim === 'light' ? 1 : 0;
  // far things first: they keep to the open water and the sky
  if (FX.swell) fxSwell(t);
  if (FX.sparkle) fxSparkle(t);
  if (FX.turtle) fxTurtle(t);
  if (FX.shoal) fxShoal(t);
  if (FX.sail) fxSail(t);
  if (FX.fishJump) fxFishJump(t);
  if (FX.ripples) fxRipples(t);
  if (FX.jelly) fxJelly(t);
  if (FX.rainbow) fxRainbow(t, b, local);
  if (FX.foam) fxFoam(t);
  if (FX.boat) fxBoat(t);
  // on surfaces
  if (FX.roofGlint) fxRoofGlint(t);
  if (FX.winGlint) fxWinGlint(t);
  if (FX.sunPatch) fxSunPatch(t);
  if (FX.grass) fxGrass(t);
  if (FX.pool) fxPool(t);
  if (FX.paperBoat) fxPaperBoat(t);
  if (FX.prism && storeys >= 3 && own('lantern')) fxPrism(t);
  // standing things
  drawGameGround(t);
  drawPalms(t, FX.palms);
  drawSunflowers(t, FX.sunflowers);
  if (FX.crab) fxCrab(t, b, local);
  if (FX.pennant) fxPennant(t);
  if (FX.flames && storeys >= 2) fxFlames(t);
  if (storeys >= 2 && own('stoolB')) fxBowl(t, FX.fish);
  if (FX.candle && storeys >= 2 && own('table')) fxCandle(t);
  if (FX.lamp && storeys >= 3 && own('lamp')) fxLamp(t);
  if (FX.ball && own('basket')) fxBall(t);
  if (FX.actors) drawActors(t, b, local);
  // hanging and flying things pass in front of the animals
  if (FX.chime && own('chime')) fxChime(t);
  if (FX.mobile && own('mobile')) fxMobile(t);
  if (FX.lantern && storeys >= 3 && own('lantern')) fxLantern(t);
  if (FX.book && storeys >= 3 && own('bookcase')) fxBook(t);
  if (FX.potSteam && storeys >= 2 && own('counter')) fxPotSteam(t);
  if (FX.dust) fxDust(t);
  if (FX.butterflies) fxButter(t);
  if (FX.bee) fxBee(t);
  if (FX.gulls) fxGulls(t);
  if (FX.shower) fxShower(t, b, local);
  drawGameSparks(t);
}
function initDynamic() {
  isExt[0] = 1;
  for (let n = 1; n < OBJ.length; n++) isExt[n] = OBJ[n].o.ext ? 1 : 0;
  for (const name in RAMPS) {
    const r = RAMPS[name];
    for (let i = 0; i < r.length; i++) {
      const v = PIDX.get(hex(r[i]));
      UPP[v] = PIDX.get(hex(r[Math.min(r.length - 1, i + 1)]));
      DOWNP[v] = PIDX.get(hex(r[Math.max(0, i - 1)]));
    }
  }
  initFoam();
  initFronds();
  afterBake();
}
/* whatever is read out of the baked picture: redone whenever the tower grows */
function afterBake() {
  initGrass();
  initRoof();
  initOven();
}
/* ── debug panel ──────────────────────────────────────────────────────── */
let panelEl = null, panelStats = null, panelTick = 0, scrubEl = null;
function buildPanel() {
  panelEl = document.getElementById('panel');
  panelEl.innerHTML = '';
  const h = document.createElement('h1'); h.textContent = 'Little Island Tower'; panelEl.appendChild(h);
  panelStats = document.createElement('div'); panelEl.appendChild(panelStats);
  const addRow = (label, el) => { const r = document.createElement('div'); r.className = 'row'; const s = document.createElement('span'); s.textContent = label; r.appendChild(s); r.appendChild(el); panelEl.appendChild(r); return r; };
  const speed = document.createElement('input'); speed.type = 'range'; speed.min = 0; speed.max = 8; speed.step = .05; speed.value = CFG.speed;
  const speedVal = document.createElement('span'); speedVal.textContent = (+CFG.speed).toFixed(2) + 'x';
  speed.oninput = () => { CFG.speed = +speed.value; speedVal.textContent = CFG.speed.toFixed(2) + 'x'; };
  addRow('速さ', speed).appendChild(speedVal);
  scrubEl = document.createElement('input'); scrubEl.type = 'range'; scrubEl.min = 0; scrubEl.max = LOOP; scrubEl.step = .05;
  scrubEl.oninput = () => { window.dollhouse.seek(Math.floor(window.dollhouse.clock() / LOOP) * LOOP + +scrubEl.value); };
  addRow('時刻', scrubEl);
  const seed = document.createElement('input'); seed.type = 'number'; seed.value = CFG.seed;
  seed.onchange = () => { CFG.seed = seed.value | 0; blockCache.clear(); };
  addRow('シード', seed);
  const loop = document.createElement('input'); loop.type = 'checkbox'; loop.checked = CFG.loop;
  loop.onchange = () => { CFG.loop = loop.checked; blockCache.clear(); };
  addRow('120秒ループ', loop);
  const block = document.createElement('select');
  SCRIPT_NAMES.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; if (i === CFG.block) o.selected = true; block.appendChild(o); });
  block.style.cssText = 'background:#0e0c18;color:inherit;border:1px solid #4a2823;font:inherit';
  block.onchange = () => { CFG.block = +block.value; blockCache.clear(); };
  addRow('ストーリー', block);
  const mkBtn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; panelEl.appendChild(b); return b; };
  mkBtn('一時停止 / 再生', () => window.dollhouse.toggle());
  mkBtn('すべて入', () => { FX_INFO.forEach(([k]) => { FX[k] = true; }); syncChecks(); });
  mkBtn('すべて切', () => { FX_INFO.forEach(([k]) => { FX[k] = false; }); syncChecks(); });
  const h2 = document.createElement('h2'); h2.textContent = '動き（' + FX_INFO.length + '）'; panelEl.appendChild(h2);
  const grid = document.createElement('div');
  const checks = {};
  FX_INFO.forEach(([k, label]) => {
    const l = document.createElement('label'), c = document.createElement('input');
    c.type = 'checkbox'; c.checked = FX[k]; c.onchange = () => { FX[k] = c.checked; };
    checks[k] = c; l.appendChild(c); l.appendChild(document.createTextNode(' ' + label)); grid.appendChild(l);
  });
  panelEl.appendChild(grid);
  function syncChecks() { for (const k in checks) checks[k].checked = FX[k]; }
}
function updatePanel() {
  if (!panelEl || panelEl.style.display !== 'block') return;
  if (++panelTick % 12) return;
  const c = window.dollhouse.clock(), st = worldState;
  panelStats.innerHTML = `t ${c.toFixed(1)} s, block ${st.k} (${st.block ? st.block.name : ''})<br>frame ${window.dollhouse.stats.frameMs.toFixed(2)} ms, ${window.dollhouse.stats.fps.toFixed(0)} fps<br>bake ${window.dollhouse.stats.bake.toFixed(0)} ms, ${OBJ.length - 1} objects, LUTs ${lutCache.size}<br><span style="opacity:.7">D パネル / Space 一時停止 / F 全画面</span>`;
  scrubEl.value = c - Math.floor(c / LOOP) * LOOP;
}
function togglePanel(force) {
  if (!panelEl) buildPanel();
  panelEl.style.display = (force === undefined ? panelEl.style.display !== 'block' : force) ? 'block' : 'none';
}
