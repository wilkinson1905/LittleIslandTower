'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   THE SUMMER TOWER: core
   Pixel toolkit, master palette, isometric painter, depth sort, light bake.
   Every pixel on screen is produced by this file's rules, with no images.
   ═══════════════════════════════════════════════════════════════════════ */
/* Set once per house: FORMAT picks the frame, ox and oy place the world's origin in it.
   A portrait house must be designed to fit: it is not a crop of a landscape one. */
const FORMATS = {
  landscape: { w: 640, h: 360, dw: 1920, dh: 1080, ox: 320, oy: 168 },
  portrait: { w: 360, h: 640, dw: 1080, dh: 1920, ox: 180, oy: 405 },
};
const FORMAT = FORMATS.portrait;
const W = FORMAT.w, H = FORMAT.h, N = W * H, OX = FORMAT.ox, OY = FORMAT.oy, DW = FORMAT.dw, DH = FORMAT.dh, LOOP = 120;

const QS = new URLSearchParams(location.search);
const qNum = (k, d) => { const v = parseFloat(QS.get(k)); return Number.isFinite(v) ? v : d; };
const clamp0 = v => Math.max(0, Math.min(3, v | 0));
const CFG = {
  seed: qNum('seed', 1905) | 0,
  loop: QS.get('loop') === '1',
  block: qNum('block', 0) | 0,
  debug: QS.get('debug') === '1',
  catArt: QS.get('cat') === '1',
  speed: qNum('speed', 1),
  freeze: QS.has('t') ? qNum('t', 0) : null,
  zoom: (QS.get('zoom') || '').split(',').map(Number),
  sheet: QS.has('sheet'),
  floors: clamp0(qNum('floors', 0)),
  full: QS.get('full') === '1',
};

/* ── deterministic randomness ─────────────────────────────────────────── */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hsh(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  h = Math.imul(h ^ h >>> 16, 2246822519);
  return ((h ^ h >>> 15) >>> 0) / 4294967296;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

/* Periodic helpers: `n` must be an integer number of cycles per 120 s,
   which is what makes the loop exact. */
const osc = (t, n, ph = 0) => Math.sin(TAU * (n * t / LOOP + ph));
const cyc = (t, n, ph = 0) => { const v = n * t / LOOP + ph; return v - Math.floor(v); };
function pnoise(t, n, seed) { // smooth periodic value noise with n lattice points
  const v = cyc(t, n) * n, i = Math.floor(v), f = v - i;
  return lerp(hsh(i % n, seed), hsh((i + 1) % n, seed), f * f * (3 - 2 * f));
}

/* ── master palette: hue-shifted ramps, dark to light ─────────────────── */
const RAMPS = {
  ink:  ['#08070f', '#0e0c18', '#17131f', '#1f1a28'],
  mid:  ['#0b0d1f', '#11152e', '#181d3d', '#20274d', '#2b3360', '#394374', '#4c5788', '#64709d'],
  vio:  ['#15102a', '#221738', '#2f2147', '#3f2c58', '#54396b', '#6b4b80', '#876394', '#a480ac'],
  cha:  ['#121216', '#1c1b22', '#28262e', '#36333c', '#47434c', '#5c5760', '#756f76', '#918b8e'],
  amb:  ['#3a1a14', '#5a2a18', '#7d3f1a', '#a2591e', '#c67a28', '#e09c3c', '#f2bf5e', '#fbdf8e'],
  wood: ['#24121a', '#351b1e', '#4a2823', '#60362a', '#7a4731', '#95603d', '#b27d4f', '#cf9f6b'],
  crm:  ['#6a4440', '#8e5f52', '#b28068', '#d0a182', '#e5bf9e', '#f2d7b8', '#f9e8cf', '#fff6e4'],
  rose: ['#33172a', '#4f2236', '#703144', '#934454', '#b15d65', '#ca7f7e', '#dfa39b', '#efc8bb'],
  ter:  ['#2e1418', '#4a1e1c', '#6c2b20', '#8f3c26', '#b0522e', '#c96c3c', '#de8d54', '#edb078'],
  sag:  ['#141f20', '#1e2f2a', '#2c4134', '#3d5540', '#54694c', '#6f825e', '#8f9f76', '#b4bd95'],
  tea:  ['#0e2230', '#15354a', '#1f4c5e', '#2f6672', '#468484', '#66a39a', '#8fc2b0', '#bfdfc8'],
  azu:  ['#2f7fd6', '#3f94e4', '#56a9ec', '#6fbcf2', '#8bcdf6', '#a8dcf8', '#c6e9fa', '#e2f5fc'],
  sea:  ['#0b3a6b', '#0f5590', '#1673b3', '#1f92cf', '#3ab2e0', '#66cfe8', '#9ae4ee', '#cdf4f2'],
  cld:  ['#7fa2c8', '#9fbcd9', '#bdd3e6', '#d6e4f0', '#e8f0f6', '#f4f8fa', '#fbfdfd', '#ffffff'],
  lef:  ['#1c4a3a', '#2a6a46', '#3c8a4e', '#58a858', '#7fc468', '#a6da7e', '#cbe99a', '#e8f6bc'],
  pin:  ['#8a4a6a', '#ad6286', '#cc7fa0', '#e29db6', '#f0bccb', '#f8d4dc', '#fce6ea', '#fff4f5'],
  hon:  ['#6a3c20', '#8a5228', '#ab6c34', '#c98a46', '#dfa75e', '#eec27e', '#f6d9a2', '#fcedc8'],
  min:  ['#2f7a6e', '#45977f', '#62b292', '#84c9a8', '#a6dcbc', '#c4eacf', '#dcf4e0', '#f0fbf0'],
  peb:  ['#4d5f78', '#66788f', '#8293a6', '#9fadbb', '#bbc6ce', '#d3dbde', '#e6ebec', '#f4f6f6'],
  sky:  ['#1a2346', '#24325e', '#314677', '#3f5a8a', '#5e82ad', '#8aaecb', '#b9d3e0', '#e2eef0'],
  gld:  ['#ffcf6e', '#ffe9a8', '#fff4c8', '#fffbe8'],
  red:  ['#5c0f1c', '#8a1622', '#b81f2a', '#dc2f32', '#f0483f', '#fa6f5e', '#ff9a85', '#ffc6b6'],
};
const C = {};                    // C.wood4 is packed RGB
const PAL_RGB = [[0, 0, 0]];     // index 0 means transparent
const hex = h => parseInt(h.slice(1), 16);
const PIDX = new Map();
for (const name in RAMPS) RAMPS[name].forEach((h, i) => {
  const v = hex(h); C[name + i] = v;
  PIDX.set(v, PAL_RGB.length);
  PAL_RGB.push([v >> 16 & 255, v >> 8 & 255, v & 255]);
});
const PAL32 = new Uint32Array(PAL_RGB.length);
PAL_RGB.forEach((p, i) => { PAL32[i] = i === 0 ? 0 : (255 << 24 | p[2] << 16 | p[1] << 8 | p[0]) >>> 0; });

const RAMP_RANGE = [null];
for (const name in RAMPS) { const a = RAMP_RANGE.length; RAMPS[name].forEach(() => RAMP_RANGE.push([a, a + RAMPS[name].length - 1])); }
const SNAP = new Uint8Array(32768);
function nearest(r, g, b) {
  r = r > 255 ? 255 : r | 0; g = g > 255 ? 255 : g | 0; b = b > 255 ? 255 : b | 0;
  const key = (r >> 3) << 10 | (g >> 3) << 5 | b >> 3;
  let v = SNAP[key];
  if (v) return v;
  let best = 1, bd = 1e12;
  for (let i = 1; i < PAL_RGB.length; i++) {
    const p = PAL_RGB[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, rm = (p[0] + r) / 2;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return SNAP[key] = best;
}
const RANGE_OF = new Map();
function rampNearest(c, r, g, b) {
  let rg = RANGE_OF.get(c);
  if (!rg) { rg = RAMP_RANGE[nearest(c >> 16 & 255, c >> 8 & 255, c & 255)]; RANGE_OF.set(c, rg); }
  let best = rg[0], bd = 1e12;
  for (let i = rg[0]; i <= rg[1]; i++) {
    const p = PAL_RGB[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
const pidx = rgb => nearest(rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255);
const pal = name => PIDX.get(C[name]);
const lite = (c, f) => {
  const r = Math.min(255, (c >> 16 & 255) * f), g = Math.min(255, (c >> 8 & 255) * f), b = Math.min(255, (c & 255) * f);
  return r << 16 | g << 8 | b;
};
const mix = (a, b, t) => {
  const f = (s) => ((a >> s & 255) + ((b >> s & 255) - (a >> s & 255)) * t) | 0;
  return f(16) << 16 | f(8) << 8 | f(0);
};

const mapCache = new Map();
function pmap(str) { // "a:wood4 b:rose3"
  let m = mapCache.get(str);
  if (m) return m;
  m = {};
  for (const part of str.split(' ')) if (part) m[part[0]] = C[part.slice(2)];
  mapCache.set(str, m);
  return m;
}

/* ── projection ───────────────────────────────────────────────────────── */
const isoX = (x, y) => OX + x - y;
const isoY = (x, y, z) => OY + ((x + y) >> 1) - z;

/* ── painter: writes into a per-object scratch, later merged in depth order ─ */
const tCol = new Int32Array(N), tX = new Int16Array(N), tY = new Int16Array(N), tZ = new Int16Array(N);
const tN = new Uint8Array(N), tStamp = new Uint16Array(N), touched = new Int32Array(N);
let tCount = 0, tCur = 0, paintSerial = 0;
const NTOP = 0, NY = 1, NX = 2, NBILL = 3, NEMIT = 4;

function put(sx, sy, rgb, wx, wy, wz, n) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const i = sy * W + sx;
  if (tStamp[i] !== tCur) { tStamp[i] = tCur; touched[tCount++] = i; }
  tCol[i] = rgb; tX[i] = wx; tY[i] = wy; tZ[i] = wz; tN[i] = n;
}
const val = (c, a, b) => typeof c === 'function' ? c(a, b) : c;

/* Top plane at height z: (i,j) local cells; the world-to-screen map is one-to-one. */
function top(x, y, z, w, d, c, n = NTOP) {
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    const v = val(c, i, j);
    if (v == null || v < 0) continue;
    const X = x + i, Y = y + j;
    put(OX + X - Y, OY + ((X + Y) >> 1) - z, v, X, Y, z, n);
  }
}
/* +y-facing plane at y=Y: i runs screen-right, k runs up. */
function fy(x, Y, z, w, h, c, n = NY) {
  for (let i = 0; i < w; i++) for (let k = 0; k < h; k++) {
    const v = val(c, i, k);
    if (v == null || v < 0) continue;
    const X = x + i;
    put(OX + X - Y, OY + ((X + Y) >> 1) - z - k, v, X, Y, z + k, n);
  }
}
/* +x-facing plane at x=X: j runs screen-left (increasing y), k runs up. */
function fx(X, y, z, d, h, c, n = NX) {
  for (let j = 0; j < d; j++) for (let k = 0; k < h; k++) {
    const v = val(c, j, k);
    if (v == null || v < 0) continue;
    const Y = y + j;
    put(OX + X - Y, OY + ((X + Y) >> 1) - z - k, v, X, Y, z + k, n);
  }
}
/* Solid iso box with lit edges. */
function box(x, y, z, w, d, h, c, o = {}) {
  const e = o.edge === undefined ? 1.18 : o.edge;
  const wrapTop = (i, j) => {
    const v = val(c.t, i, j);
    if (v == null || v < 0) return v;
    return e && (i === w - 1 || j === d - 1) ? lite(v, e) : v;
  };
  const wrapL = (i, k) => {
    const v = val(c.l, i, k);
    if (v == null || v < 0) return v;
    return e && i === w - 1 ? lite(v, 1 + (e - 1) * .6) : v;
  };
  if (h > 0) {
    fy(x, y + d - 1, z, w, h, wrapL);
    fx(x + w - 1, y, z, d - 1, h, c.r);
  }
  top(x, y, z + h, w, d, wrapTop);
}
/* Shorthand: colour triple from a ramp. */
const rb = (ramp, lv) => ({ t: C[ramp + Math.min(7, lv + 2)], l: C[ramp + lv], r: C[ramp + Math.max(0, lv - 1)] });

/* Upholstered box: rounded corners, soft top rim, dark foot. */
function soft(x, y, z, w, d, h, ramp, lv = 4, o = {}) {
  const r = n => C[ramp + clamp(lv + n, 0, 7)];
  const tf = o.top;
  top(x, y, z + h, w, d, (i, j) => {
    const ci = i === 0 || i === w - 1, cj = j === 0 || j === d - 1;
    if (ci && cj) return -1;
    if (tf) { const v = tf(i, j); if (v != null) return v; }
    if (i === w - 1 || j === d - 1) return r(2);
    if (i === w - 2 || j === d - 2) return r(1);
    return r(1);
  });
  fy(x, y + d - 1, z, w, h, (i, k) => {
    if ((i === 0 || i === w - 1) && (k === h - 1 || k === 0)) return -1;
    if (o.left) { const v = o.left(i, k); if (v != null) return v; }
    return k === h - 1 ? r(2) : k === 0 ? r(-2) : k === 1 ? r(-1) : r(0);
  });
  fx(x + w - 1, y, z, d - 1, h, (j, k) => {
    if (j === 0 && (k === h - 1 || k === 0)) return -1;
    if (o.right) { const v = o.right(j, k); if (v != null) return v; }
    return k === h - 1 ? r(1) : k === 0 ? r(-3) : k === 1 ? r(-2) : r(-1);
  });
}
/* Billboard sprite standing at world point: bottom-centre anchored. */
function spr(x, y, z, map, rows, o = {}) {
  const m = pmap(map), h = rows.length, w = rows[0].length;
  const sx0 = OX + x - y - (o.ax === undefined ? w >> 1 : o.ax), sy0 = OY + ((x + y) >> 1) - z - h + 1;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const v = m[rows[r][c]];
    if (v === undefined) continue;
    put(sx0 + c, sy0 + r, v, x, y, z + h - 1 - r, o.n === undefined ? NBILL : o.n);
  }
}
/* Pixel-grid decals laid into wall planes; rows read left to right on screen. */
function decalY(Y, x, ztop, map, rows, n = NY) {
  const m = pmap(map);
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const v = m[row[c]];
      if (v === undefined) continue;
      const X = x + c;
      put(OX + X - Y, OY + ((X + Y) >> 1) - (ztop - r), v, X, Y, ztop - r, n);
    }
  });
}
function decalX(X, yLeft, ztop, map, rows, n = NX) { // yLeft is the screen-left end (larger y)
  const m = pmap(map);
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const v = m[row[c]];
      if (v === undefined) continue;
      const Y = yLeft - c;
      put(OX + X - Y, OY + ((X + Y) >> 1) - (ztop - r), v, X, Y, ztop - r, n);
    }
  });
}
/* Repeating pattern lookup for wall planes; v counts up from the floor. */
function tile(map, rows) {
  const m = pmap(map), h = rows.length, w = rows[0].length;
  return (u, v) => m[rows[(((-v) % h) + h) % h][((u % w) + w) % w]];
}

/* ── scene registry ───────────────────────────────────────────────────── */
const OBJ = [null];
const NAMED = {};
function O(name, aabb, paint, o = {}) {
  const ob = { name, id: OBJ.length, x0: aabb[0], y0: aabb[1], z0: aabb[2], x1: aabb[3], y1: aabb[4], z1: aabb[5], paint, o };
  OBJ.push(ob);
  NAMED[name] = ob;
  if (o.shadow) SHADOWS.push({ x0: aabb[0], y0: aabb[1], x1: aabb[3], y1: aabb[4], z: aabb[2], level: o.level, only: o.only, furn: o.furn });
  return ob;
}
const SHADOWS = [];
const LIGHTS = [];
function light(x, y, z, hexc, i, rad, zone, o = {}) {
  const v = hex(hexc);
  LIGHTS.push({ x, y, z, r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255, i, rad, zone, fire: !!o.fire, flat: !!o.flat, level: o.level, only: o.only, furn: o.furn });
}

/* AABB ordering: returns -1 if a is behind b, 1 if b is behind a, 0 if unknown. */
function behindCmp(a, b) {
  const ab = a.x1 <= b.x0 || a.y1 <= b.y0 || a.z1 <= b.z0;
  const ba = b.x1 <= a.x0 || b.y1 <= a.y0 || b.z1 <= a.z0;
  if (ab && !ba) return -1;
  if (ba && !ab) return 1;
  return 0;
}
function topoSort(list) {
  const n = list.length, rect = list.map(a => [OX + a.x0 - a.y1, OX + a.x1 - a.y0, OY + ((a.x0 + a.y0) >> 1) - a.z1, OY + ((a.x1 + a.y1) >> 1) - a.z0]);
  const out = list.map(() => []), deg = new Int32Array(n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = rect[i], B = rect[j];
    if (A[1] < B[0] || B[1] < A[0] || A[3] < B[2] || B[3] < A[2]) continue;
    const c = behindCmp(list[i], list[j]);
    if (c < 0) { out[i].push(j); deg[j]++; } else if (c > 0) { out[j].push(i); deg[i]++; }
  }
  const done = new Uint8Array(n), res = [];
  const key = a => a.x0 + a.x1 + a.y0 + a.y1 + a.z0 + a.z1;
  for (let k = 0; k < n; k++) {
    let best = -1, bk = 1e9, fb = -1, fk = 1e9;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const v = key(list[i]);
      if (deg[i] === 0 && v < bk) { bk = v; best = i; }
      if (v < fk) { fk = v; fb = i; }
    }
    if (best < 0) best = fb;  // a cycle: break it at the rearmost object
    done[best] = 1; res.push(list[best]);
    for (const j of out[best]) deg[j]--;
  }
  return res;
}

/* ── G-buffer and bake ────────────────────────────────────────────────── */
const gCol = new Int32Array(N).fill(-1), gX = new Int16Array(N), gY = new Int16Array(N), gZ = new Int16Array(N);
const gN = new Uint8Array(N), gId = new Uint16Array(N);
const sL = new Float32Array(N * 3), fL = new Float32Array(N * 3);
const baseIdx = new Uint8Array(N);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const LSTEP = 0.11, LDITHER = 0.24;
const AMBIENT = { G: [.98, .97, .95], B: [.98, .97, .94], A: [.97, .97, .99], E: [1.02, 1.01, 1] };

const roomZone = z => z < 104 ? 'G' : z < 204 ? 'B' : 'A';
function zoneOf(ob, z) {
  if (ob.o.ext) return 'E';
  if (ob.o.zone) return ob.o.zone;
  return roomZone(z);
}
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* How many storeys the tower has now. Objects with o.level appear from that storey on;
   objects with o.only exist at exactly that storey, like the roof; objects with o.furn
   appear once that piece of furniture has been bought. */
let storeys = 1;
const OWNED = { all: true, set: new Set() };
const own = key => OWNED.all || OWNED.set.has(key);
const onNow = o => (o.level === undefined || storeys >= o.level) && (o.only === undefined || storeys === o.only) && (o.furn === undefined || own(o.furn));
/* painted storey by storey: the plan isn't axis-aligned, so boxes alone can't order the walls */
function paintOrder(list) {
  const layerOf = o => o.layer !== undefined ? o.layer : o.fg ? 100 : o.level !== undefined ? 10 * o.level + 2 : 0;
  const groups = new Map();
  for (const ob of list) {
    const l = layerOf(ob.o);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(ob);
  }
  return [...groups.keys()].sort((a, b) => a - b).flatMap(l => topoSort(groups.get(l)));
}
function paintAll() {
  gCol.fill(-1); gId.fill(0); gN.fill(0);
  for (const ob of paintOrder(OBJ.slice(1).filter(ob => onNow(ob.o)))) {
    tCur = ++paintSerial; tCount = 0;
    ob.paint(ob);
    const outl = ob.o.outline === undefined ? .7 : ob.o.outline;
    if (outl) {
      for (let k = 0; k < tCount; k++) {
        const i = touched[k], cu = tStamp;
        const edge = (i < W || cu[i - W] !== tCur) || (i >= N - W || cu[i + W] !== tCur) || cu[i - 1] !== tCur || cu[i + 1] !== tCur;
        if (edge && tN[i] !== NEMIT) tCol[i] = lite(tCol[i], outl);
      }
    }
    for (let k = 0; k < tCount; k++) {
      const i = touched[k];
      gCol[i] = tCol[i]; gX[i] = tX[i]; gY[i] = tY[i]; gZ[i] = tZ[i]; gN[i] = tN[i]; gId[i] = ob.id;
    }
  }
}

function computeLight() {
  const zones = { G: [], B: [], A: [], E: [] };
  for (const l of LIGHTS) if (onNow(l)) for (const z of l.zone) zones[z].push(l);
  sL.fill(0); fL.fill(0);
  const shadows = SHADOWS.filter(s => onNow(s));
  for (let i = 0; i < N; i++) {
    if (gCol[i] < 0 || gN[i] === NEMIT) continue;
    const ob = OBJ[gId[i]], x = gX[i], y = gY[i], z = gZ[i], n = gN[i];
    const zone = zoneOf(ob, z), amb = AMBIENT[zone];
    let r = amb[0], g = amb[1], b = amb[2], fr = 0, fg = 0, fb = 0;
    const nx = n === NX ? 1 : n === NBILL ? .45 : 0, ny = n === NY ? 1 : n === NBILL ? .45 : 0, nz = n === NTOP ? 1 : n === NBILL ? .75 : 0;
    for (const l of zones[zone]) {
      const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= l.rad) continue;
      let a = 1 - d / l.rad; a *= a;
      if (!l.flat) a *= d > .5 ? clamp((dx * nx + dy * ny + dz * nz) / d * .62 + .48, .12, 1) : 1;
      a *= l.i;
      if (l.fire) { fr += l.r * a; fg += l.g * a; fb += l.b * a; }
      else { r += l.r * a; g += l.g * a; b += l.b * a; }
    }
    // contact shadows under furniture, thrown slightly toward the viewer
    let ao = 1;
    if (n === NTOP && !ob.o.ext) {
      for (const s of shadows) {
        if (Math.abs(z - s.z) > 1) continue;
        const ex = x < s.x0 ? s.x0 - x : x >= s.x1 ? x - s.x1 + 1 : 0;
        const ey = y < s.y0 ? s.y0 - y : y >= s.y1 ? y - s.y1 + 1 : 0;
        const bx = x < s.x0 ? ex * 2.2 : ex, by = y < s.y0 ? ey * 2.2 : ey;
        const dd = Math.max(bx, by);
        if (dd < 5) ao = Math.min(ao, lerp(.8, 1, dd / 5));
      }
    }
    if ((n === NX || n === NY) && !ob.o.ext && ob.o.wall) {
      const lv = ob.o.floorZ || 0, up = z - lv;
      if (up < 5) ao *= lerp(.72, 1, up / 5);
      const cornerD = n === NY ? x - (ob.o.cornerAt || 0) : y - (ob.o.cornerAt || 0);
      if (cornerD >= 0 && cornerD < 8) ao *= lerp(.8, 1, cornerD / 8);
    }
    // the room deepens toward the back corner, away from the open front
    if (!ob.o.ext) ao *= lerp(.93, 1, clamp((x + y - 42) / 70, 0, 1));
    sL[i * 3] = r * ao; sL[i * 3 + 1] = g * ao; sL[i * 3 + 2] = b * ao;
    fL[i * 3] = fr * ao; fL[i * 3 + 1] = fg * ao; fL[i * 3 + 2] = fb * ao;
  }
}

function shadeIdx(i, fire) {
  const c = gCol[i], r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
  if (gN[i] === NEMIT) return nearest(r, g, b);
  const sx = i % W, sy = (i / W) | 0;
  const th = .5 + (BAYER[(sy & 3) * 4 + (sx & 3)] - .5) * LDITHER;
  const j = i * 3;
  const lr = sL[j] + fire * fL[j], lg = sL[j + 1] + fire * fL[j + 1], lb = sL[j + 2] + fire * fL[j + 2];
  const l = (lr + lg + lb) / 3 || .001, q = Math.floor(l / LSTEP + th) * LSTEP;
  return rampNearest(c, r * lr / l * q, g * lg / l * q, b * lb / l * q);
}

const FIRE_LEVELS = [.74, .9, 1.06, 1.22];
const LAYER = { base: null, fire: [] };

function bakeLayers() {
  const base = makeCanvas(W, H), bc = base.getContext('2d');
  const img = bc.createImageData(W, H), d = new Uint32Array(img.data.buffer);
  baseIdx.fill(0);
  for (let i = 0; i < N; i++) {
    if (gCol[i] < 0) continue;
    const idx = shadeIdx(i, FIRE_LEVELS[1]);
    baseIdx[i] = idx; d[i] = PAL32[idx];
  }
  bc.putImageData(img, 0, 0);
  LAYER.base = base;
  LAYER.fire.length = 0;
  // fire variants: only the pixels the hearth actually reaches, cropped
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  const fp = [];
  for (let i = 0; i < N; i++) {
    if (gCol[i] < 0 || gN[i] === NEMIT) continue;
    if (fL[i * 3] + fL[i * 3 + 1] + fL[i * 3 + 2] > .006) {
      fp.push(i);
      const sx = i % W, sy = (i / W) | 0;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
  }
  if (!fp.length) return;
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  for (const lv of FIRE_LEVELS) {
    const cv = makeCanvas(fw, fh), cx = cv.getContext('2d');
    const im = cx.createImageData(fw, fh), dd = new Uint32Array(im.data.buffer);
    for (const i of fp) dd[((i / W | 0) - y0) * fw + (i % W) - x0] = PAL32[shadeIdx(i, lv)];
    cx.putImageData(im, 0, 0);
    LAYER.fire.push({ cv, x: x0, y: y0 });
  }
}
