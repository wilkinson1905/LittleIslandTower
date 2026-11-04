/* ═══════════════════════════════════════════════════════════════════════
   Render loop, capture hooks, debug panel.
   ═══════════════════════════════════════════════════════════════════════ */
const display = document.getElementById('view');
display.width = DW; display.height = DH;
const dctx = display.getContext('2d', { alpha: false });
dctx.imageSmoothingEnabled = false;
const frame = makeCanvas(W, H), fctx = frame.getContext('2d', { alpha: false });
fctx.imageSmoothingEnabled = false;

const dynCanvas = makeCanvas(W, H), dynCtx = dynCanvas.getContext('2d');
const dynImg = dynCtx.createImageData(W, H), dyn = new Uint32Array(dynImg.data.buffer);

function drawClouds(t) {
  const on = FX.clouds;
  fctx.drawImage(LAYER.sky, 0, 0);
  if (!on) return;
  LAYER.clouds.forEach((c, n) => {
    const off = n === 0 ? Math.floor(cyc(t, 1) * 320) : Math.floor(cyc(t, 2) * 320);
    fctx.drawImage(c, -off, 0); fctx.drawImage(c, 320 - off, 0); fctx.drawImage(c, 640 - off, 0);
  });
}

/* Time is an integer tick, reduced to one block before anything reads it. Every
   effect is then a function of the same exact number at t and t + 120, so float
   rounding can never make a loop boundary differ. */
const TICKS = 240;
function renderFrame(time) {
  const tick = Math.round(time * TICKS), k = Math.floor(tick / (LOOP * TICKS));
  const t = (tick - k * LOOP * TICKS) / TICKS;
  WORLD.now = time;
  const st = sampleWorld(t, k);
  drawClouds(t);
  fctx.drawImage(LAYER.base, 0, 0);
  if (LAYER.fire.length) { const f = LAYER.fire[fireLevel(t)]; fctx.drawImage(f.cv, f.x, f.y); }
  dyn.fill(0);
  drawDynamic(t, st);
  dynCtx.putImageData(dynImg, 0, 0);
  fctx.drawImage(dynCanvas, 0, 0);
  const z = CFG.zoom;
  if (z.length === 4 && z.every(Number.isFinite)) dctx.drawImage(frame, z[0], z[1], z[2], z[3], 0, 0, DW, DH);
  else dctx.drawImage(frame, 0, 0, DW, DH);
}

/* ── boot ─────────────────────────────────────────────────────────────── */
const T0 = performance.now();
gameBoot();
buildSky();
paintAll();
computeLight();
bakeLayers();
initDynamic();
gameStart();
const stats = { bake: performance.now() - T0, frameMs: 0, fps: 0, frames: 0 };

function frameHash(t) {
  renderFrame(t);
  const d = fctx.getImageData(0, 0, W, H).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 4) { h ^= d[i] | d[i + 1] << 8 | d[i + 2] << 16; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/* t and t + 120 must be pixel-identical in loop mode, and the frame at every
   block boundary must match in free-running mode. */
function loopCheck() {
  const out = [];
  const prevLoop = CFG.loop;
  CFG.loop = true; blockCache.clear();
  for (const dt of [0, 1 / 60, 13.37, 47.25, 59.5, 88.8, 119.5]) {
    const a = frameHash(dt), b = frameHash(dt + LOOP);
    out.push({ t: dt, a, b, same: a === b });
  }
  CFG.loop = prevLoop; blockCache.clear();
  return out;
}
function boundaryCheck(blocks = 24) {
  const prevLoop = CFG.loop;
  CFG.loop = false; blockCache.clear();
  const ref = frameHash(0), bad = [];
  for (let k = 1; k <= blocks; k++) if (frameHash(k * LOOP) !== ref) bad.push(k);
  CFG.loop = prevLoop; blockCache.clear();
  return { blocks, ref, bad };
}
let clock = CFG.freeze !== null ? CFG.freeze : 0, last = performance.now(), running = CFG.freeze === null;
const dollhouse = {
  renderAt: t => { running = false; clock = t; renderFrame(t); },
  frameHash, loopCheck, boundaryCheck, stats, CFG, FX, FX_INFO, SCRIPT_NAMES,
  play: () => { running = true; last = performance.now(); },
  toggle: () => { running = !running; last = performance.now(); },
  seek: t => { clock = t; if (!running) renderFrame(t); },
  clock: () => clock,
  pose: () => Object.fromEntries(Object.entries(ACTOR).map(([k, a]) => [k, [Math.round(a.x), Math.round(a.y), Math.round(a.z), a.anim]])),
  game: GAME,
  scripts: (seed = 1) => SCRIPT_NAMES.map(n => { const b = compileBlock(n, seed); return [n, ...ACTOR_IDS.map(id => b[id].at(-1).t0)]; }),
  story: storyAt,
  /* every script at a given height and with or without the furniture, for checking lengths and endings */
  scriptsAt: (n, furnished, seed = 1) => {
    const s = storeys, a = OWNED.all;
    storeys = n; OWNED.all = furnished;
    const out = SCRIPT_NAMES.map(name => { const b = compileBlock(name, seed); return [name, ...ACTOR_IDS.map(id => b[id].at(-1).t0)]; });
    storeys = s; OWNED.all = a;
    return out;
  },
  timeline: k => { const b = blockFor(k); return ACTOR_IDS.map(w => w + ': ' + b[w].map(s => `${s.t0.toFixed(1)} ${s.anim}`).join(', ')); },
};
window.dollhouse = dollhouse;

if (CFG.sheet) drawSheet();
else if (CFG.freeze !== null) renderFrame(CFG.freeze);
const stage = document.getElementById('stage');
function layout() { stage.style.setProperty('--u', stage.clientWidth / W + 'px'); }
layout();
window.addEventListener('resize', layout);
if (CFG.debug) togglePanel(true);

window.addEventListener('keydown', e => {
  if (e.target && /INPUT|SELECT/.test(e.target.tagName)) return;
  if (e.key === 'd' || e.key === 'D') togglePanel();
  else if (e.key === ' ') { e.preventDefault(); dollhouse.toggle(); }
  else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen && stage.requestFullscreen(); }
});

function tick(now) {
  requestAnimationFrame(tick);
  if (CFG.sheet || !running) return;
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  clock += dt * CFG.speed;
  gameFrame(dt);
  const t0 = performance.now();
  renderFrame(clock);
  const ms = performance.now() - t0;
  stats.frameMs += (ms - stats.frameMs) * .05;
  stats.fps += ((dt > 0 ? 1 / dt : 60) - stats.fps) * .05;
  stats.frames++;
  updatePanel();
}
requestAnimationFrame(tick);
