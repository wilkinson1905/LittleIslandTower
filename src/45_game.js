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
  bottleEvery: 45,         // while closed: one piece per this many seconds
  bottleCap: 30,           // and no more than this in the bottle
  resumeAfter: 60,         // a hidden tab this long counts as having been closed
  sillPrice: 10,
};
const KINDS = [
  { id: 'blue', value: 1, chance: .72 },
  { id: 'green', value: 2, chance: .23 },
  { id: 'amber', value: 5, chance: .05 },
];
const GOODS = {
  cookie: { name: '貝がらクッキー', type: 'おやつ', price: 5, gain: 1, dur: 5 },
  ice: { name: 'ラムネアイス', type: 'おやつ', price: 12, gain: 2, dur: 6.5 },
  ball: { name: 'ビーチボール', type: 'おもちゃ', price: 8, gain: 2, dur: 8 },
  wheel: { name: 'かざぐるま', type: 'おもちゃ', price: 15, gain: 3, dur: 9 },
};
const ANIMALS = {
  cat: { name: 'ねこ', room: '1階の遊び部屋', gest: ['まりをちょいちょい', 'おなかを見せてごろん'], hint: '最初からいます' },
  pup: { name: 'こいぬ', room: '2階の台所', gest: ['首をかしげる', 'くるくる回る'], hint: '2階ができると来ます' },
  rabbit: { name: 'うさぎ', room: '3階の寝室', gest: ['うれしくて跳ねる', '耳のおていれ'], hint: '3階ができると来ます' },
  dragon: { name: 'ちびドラゴン', room: '2階の台所', gest: ['けむりの輪', 'ふらふら宙返り'], hint: '塔が完成したら、窓辺におやつを' },
  sheep: { name: 'くものひつじ', room: '1階の遊び部屋', gest: ['小さな雨', '小さな虹'], hint: '塔が完成したら、窓辺におやつを' },
  penguin: { name: 'ペンギン', room: '桟橋と砂浜', gest: ['おなかすべり', 'ごきげんダンス'], hint: '塔が完成したら、窓辺におやつを' },
};
const PET_ORDER = ['dragon', 'sheep', 'penguin'];
const newState = () => ({
  v: 1, glass: 0, stash: 0, total: 0, storeys: 1, pets: [],
  aff: { cat: 0, pup: 0, rabbit: 0, sheep: 0, dragon: 0, penguin: 0 },
  beach: [], n: 0, spawnIn: 6, sill: false, played: 0, doneAt: 0, lastSeen: 0, tips: {},
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
  s.stash = cleanNum(o.stash, 0, RULES.bottleCap, 0) | 0;
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
  s.tips = o.tips && typeof o.tips === 'object' ? o.tips : {};
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
  mk(['..ooo..', '.oWaao.', 'oaaaaao', 'oaaabbo', '.oooo..'], 'o:azu2 W:cld7 a:sea6 b:sea4', 3, 3),
  mk(['.oooo..', 'oWaaao.', 'oaaaabo', '.oaabbo', '..oooo.'], 'o:lef1 W:cld7 a:lef6 b:lef4', 3, 3),
  mk(['..ooo..', '.oWaao.', 'oWaaabo', 'oaaabbo', '.oabbo.', '..ooo..'], 'o:hon1 W:cld7 a:amb7 b:amb5', 3, 3),
];
function drawGameGround(t) {
  for (const g of WORLD.beach) {
    const s = SLOTS[g.slot];
    if (!s) continue;
    const k = g.kind, tw = cyc(t, 12 + g.slot % 7, g.slot * .13);
    sblit(GLASS_SPR[k], s.x, s.y);
    if (tw < .1) {
      const big = tw > .03 && tw < .07;
      spx(s.x - 1, s.y - 3, P.cld7);
      if (big) { spx(s.x - 2, s.y - 3, P.cld7); spx(s.x, s.y - 3, P.cld7); spx(s.x - 1, s.y - 4, P.cld7); spx(s.x - 1, s.y - 2, P.cld7); }
    }
  }
  if (WORLD.sillTreat && storeys >= 2) {
    const s = -53, sy = scrY(backT(s) + 2, Z2 + 18);
    sblit(ITEM.dish, OX + s, sy); sblit(ITEM.cookie, OX + s, sy - 2);
  }
}
function drawGameSparks() {
  const S_ = WORLD.sparks, now = WORLD.now;
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
function spark(x, y, col = 'sea6', r = 9, life = .55) {
  if (WORLD.sparks.length < 40) WORLD.sparks.push({ x, y, col, r, life, t0: WORLD.now, seed: WORLD.sparks.length });
}

/* ── the rules: pure state changes, no drawing ───────────────────────── */
function pushWorld() {
  WORLD.pets.dragon = GS.pets.includes('dragon');
  WORLD.pets.sheep = GS.pets.includes('sheep');
  WORLD.pets.penguin = GS.pets.includes('penguin');
  for (const k in GS.aff) WORLD.aff[k] = GS.aff[k];
  WORLD.beach = GS.beach;
  WORLD.sillTreat = GS.sill;
}
function spawnGlass() {
  if (GS.beach.length >= RULES.beachCap || !SLOTS.length) return false;
  const n = GS.n++, used = new Set(GS.beach.map(g => g.slot));
  let slot = hsh(n, 161) * SLOTS.length | 0;
  while (used.has(slot)) slot = (slot + 1) % SLOTS.length;
  const roll = hsh(n, 162);
  GS.beach.push({ slot, kind: roll < KINDS[0].chance ? 0 : roll < KINDS[0].chance + KINDS[1].chance ? 1 : 2 });
  return true;
}
function advance(sec) {
  GS.played += sec;
  GS.spawnIn -= sec;
  while (GS.spawnIn <= 0) { GS.spawnIn += RULES.spawnEvery; spawnGlass(); }
}
function collectAt(index) {
  const g = GS.beach[index];
  if (!g) return 0;
  GS.beach.splice(index, 1);
  const v = KINDS[g.kind].value;
  GS.glass += v; GS.total += v;
  return v;
}
function emptyBottle() {
  const v = GS.stash;
  GS.glass += v; GS.total += v; GS.stash = 0;
  return v;
}
/* what happens while no one was looking */
function settleAbsence(sec) {
  const out = { glass: 0, pet: null };
  if (!(sec > 0)) return out;
  const before = GS.stash;
  GS.stash = Math.min(RULES.bottleCap, GS.stash + Math.floor(sec / RULES.bottleEvery));
  out.glass = GS.stash - before;
  if (GS.sill) {
    const next = PET_ORDER.find(p => !GS.pets.includes(p));
    if (next) { GS.pets.push(next); out.pet = next; }
    GS.sill = false;
  }
  return out;
}
const nextFloorCost = () => RULES.floorCost[GS.storeys + 1] || 0;
const towerDone = () => GS.storeys >= 3;
const allPets = () => PET_ORDER.every(p => GS.pets.includes(p));
function canBuy(id, good) { return present(id) && GS.glass >= GOODS[good].price && !WORLD.react[id]; }
function buyFor(id, good) {
  if (!canBuy(id, good)) return false;
  const g = GOODS[good];
  GS.glass -= g.price;
  GS.aff[id] = Math.min(10, GS.aff[id] + g.gain);
  WORLD.aff[id] = GS.aff[id];
  WORLD.react[id] = { t0: WORLD.now, dur: g.dur, anim: g.type === 'おやつ' ? 'eat' : 'play', item: good };
  return true;
}
function petAnimal(id) {
  if (!present(id) || WORLD.react[id]) return false;
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
const FLOOR_VIEW = { cat: 1, sheep: 1, pup: 2, dragon: 2, rabbit: 3, penguin: 'beach' };

/* ── the screen ───────────────────────────────────────────────────────── */
const UI = {};
const $ = id => document.getElementById(id);
function spriteCanvas(s, scale = 2, u = 1) {
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h;
  const g = c.getContext('2d'), im = g.createImageData(s.w, s.h), d = new Uint32Array(im.data.buffer);
  for (let i = 0; i < s.w * s.h; i++) if (s.d[i]) d[i] = PAL32[s.d[i]];
  g.putImageData(im, 0, 0);
  c.style.width = `calc(var(--u) * ${s.w * scale})`; c.style.height = `calc(var(--u) * ${s.h * scale})`;
  c.className = 'px';
  return c;
}
const FACE = () => ({ cat: K.sit, pup: D.sit[0], rabbit: R.sit, sheep: S.front[0], dragon: Y.sit, penguin: Q.stand });
const ITEM_ICON = () => ({ cookie: ITEM.cookie, ice: ITEM.ice, ball: ITEM.ball[0], wheel: ITEM.wheel[0] });
let toastTimer = 0, cardFor = null, menuOpen = false, growing = false;
function toast(text, sec = 4.5) {
  UI.toast.textContent = text;
  UI.toast.classList.add('on');
  toastTimer = sec;
}
function tip(key, text, sec) {
  if (GS.tips[key]) return;
  GS.tips[key] = 1;
  toast(text, sec);
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
  for (const k of ['glassN', 'bottleBtn', 'bottleN', 'menuBtn', 'floors', 'toast', 'growBtn', 'growLabel', 'growFill', 'faces', 'card', 'menu', 'puff', 'unhide']) UI[k] = $(k);
  $('glassIcon').appendChild(spriteCanvas(GLASS_SPR[0], 2));
  $('bottleIcon').appendChild(spriteCanvas(BOTTLE, 2));
  UI.faceBtns = {};
  const faces = FACE();
  for (const id of ['cat', 'pup', 'rabbit', 'dragon', 'sheep', 'penguin']) {
    const b = document.createElement('button');
    b.className = 'face'; b.setAttribute('aria-label', ANIMALS[id].name);
    const img = spriteCanvas(faces[id], faces[id].w > 13 ? 1.5 : 2);
    const q = document.createElement('span'); q.className = 'qm'; q.textContent = '？';
    b.append(img, q);
    b.onclick = () => {
      if (present(id)) { petAnimal(id); openCard(id); if (FLOOR_VIEW[id] !== CAM.name) setView(FLOOR_VIEW[id]); }
      else toast(`まだ会っていない動物です。${ANIMALS[id].hint}`);
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
  UI.bottleBtn.onclick = () => {
    const v = emptyBottle();
    if (v) { toast(`小びんから ${v} 個のシーグラスを取り出しました`); saveGame(); refreshUI(); }
  };
  UI.menuBtn.onclick = () => { menuOpen = !menuOpen; closeCard(); renderMenu(); };
  UI.unhide.onclick = () => { UI.ui.classList.remove('hide'); };
  display.addEventListener('pointerup', onCanvasTap);
  refreshUI();
}
const BOTTLE = mk(['..oo..', '..cc..', '.oWao.', '.oaao.', 'oWaaao', 'oaabao', 'oaabao', '.oooo.'], 'o:azu2 c:hon4 W:cld7 a:sea6 b:lef6', 3, 7);
function onMainButton() {
  if (growing) return;
  if (!towerDone()) {
    const cost = nextFloorCost();
    if (GS.glass < cost) { toast(`あと ${cost - GS.glass} 個のシーグラスで、${GS.storeys + 1}階を建てられます`); return; }
    growAnimated();
    return;
  }
  if (allPets()) { toast('みんなそろいました。のんびり眺めましょう'); return; }
  if (GS.sill) { toast('おやつを置きました。次に開いたとき、だれか来ているかもしれません'); return; }
  if (GS.glass < RULES.sillPrice) { toast(`窓辺のおやつには ${RULES.sillPrice} 個のシーグラスが必要です`); return; }
  placeSill();
  toast('窓辺におやつを置きました。次に開いたとき、だれか来ているかもしれません', 6);
  setView(2);
  saveGame(); refreshUI();
}
function growAnimated() {
  growing = true;
  closeCard();
  setView('all');
  UI.puff.classList.add('on');
  setTimeout(() => {
    growNow();
    pushWorld();
    for (let i = 0; i < 14; i++) spark(180 + hsh(i, 171) * 120 - 60, 150 + hsh(i, 172) * 280, 'amb7', 16, 1.2);
    UI.puff.classList.remove('on');
    growing = false;
    const n = GS.storeys, who = n === 2 ? 'こいぬ' : 'うさぎ';
    if (n === 3) toast(`3階ができて、${who}がやってきました。塔の完成です。ここからは眺めモードです`, 8);
    else toast(`${n}階ができて、${who}がやってきました`, 6);
    saveGame(); refreshUI();
  }, 650);
}
function closeCard() { cardFor = null; UI.card.classList.remove('on'); }
function openCard(id) {
  cardFor = id; menuOpen = false; renderMenu();
  renderCard();
  UI.card.classList.toggle('top', id === 'penguin');
  UI.card.classList.add('on');
}
function hearts(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<i class="${n >= i * 2 ? 'full' : n === i * 2 - 1 ? 'half' : ''}">♥</i>`;
  return h;
}
function nextGesture(id) {
  const a = GS.aff[id], g = ANIMALS[id].gest;
  if (a >= 8) return `「${g[0]}」と「${g[1]}」を見せてくれます`;
  if (a >= 4) return `「${g[0]}」を覚えました。♥4つで次のしぐさ`;
  return '♥2つで新しいしぐさを覚えます';
}
function renderCard() {
  const id = cardFor;
  if (!id) return;
  const a = ANIMALS[id], c = UI.card, icons = ITEM_ICON();
  c.innerHTML = `<button class="x" aria-label="とじる">×</button>
    <div class="head"><span class="ic"></span><div><b>${a.name}</b><small>${a.room}</small><div class="hearts">${hearts(GS.aff[id])}</div></div></div>
    <p class="note">${nextGesture(id)}</p><div class="goods"></div>`;
  c.querySelector('.ic').appendChild(spriteCanvas(FACE()[id], 2));
  c.querySelector('.x').onclick = closeCard;
  const box = c.querySelector('.goods'), busy = !!WORLD.react[id] && WORLD.react[id].anim !== 'happy';
  for (const key of Object.keys(GOODS)) {
    const g = GOODS[key], b = document.createElement('button');
    b.className = 'good'; b.dataset.good = key;
    const afford = GS.glass >= g.price;
    b.disabled = !afford || busy;
    b.innerHTML = `<span class="gi"></span><span class="gt">${g.name}<small>${g.type} ・ ♥+${g.gain / 2}</small></span><span class="gp ${afford ? '' : 'no'}">${g.price}<small>個</small></span>`;
    b.querySelector('.gi').appendChild(spriteCanvas(icons[key], 2));
    b.onclick = () => {
      delete WORLD.react[id]; // a pat should never block a treat
      if (buyFor(id, key)) { saveGame(); refreshUI(); renderCard(); setTimeout(() => { if (cardFor === id) renderCard(); }, (g.dur + 1) * 1000); }
    };
    box.appendChild(b);
  }
}
function renderMenu() {
  const m = UI.menu;
  m.classList.toggle('on', menuOpen);
  if (!menuOpen) return;
  const min = Math.round(GS.played / 60);
  m.innerHTML = `<button class="x" aria-label="とじる">×</button><h3>夏の塔の箱庭</h3>
    <p class="note">遊んだ時間 ${min} 分 ・ 集めたシーグラス ${GS.total} 個<br>進み具合はこのブラウザの中に自動で保存されます。別の端末には引き継げません。</p>
    <button id="hideBtn" class="wide">文字を隠して眺める</button>
    <button id="resetBtn" class="wide danger">最初からやり直す</button>`;
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
  UI.bottleBtn.hidden = !GS.stash;
  UI.bottleN.textContent = '+' + GS.stash;
  for (const b of UI.floors.children) {
    const v = b.dataset.view;
    b.hidden = v !== 'all' && +v > storeys;
    b.classList.toggle('sel', v === String(CAM.name));
  }
  for (const id in UI.faceBtns) UI.faceBtns[id].classList.toggle('known', present(id));
  let label, frac = 1, ready = true;
  if (!towerDone()) {
    const cost = nextFloorCost();
    label = `${GS.storeys + 1}階を建てる<small>${Math.min(GS.glass, cost)} / ${cost}</small>`;
    frac = Math.min(1, GS.glass / cost); ready = GS.glass >= cost;
  } else if (allPets()) { label = '眺めモード<small>みんなそろいました</small>'; ready = false; }
  else if (GS.sill) { label = '眺めモード<small>次に開くのが楽しみ</small>'; ready = false; }
  else { label = `窓辺におやつ<small>${RULES.sillPrice} 個</small>`; ready = GS.glass >= RULES.sillPrice; }
  UI.growLabel.innerHTML = label;
  UI.growFill.style.width = frac * 100 + '%';
  UI.growBtn.classList.toggle('ready', ready);
  if (cardFor) refreshCardPrices();
}
function refreshCardPrices() {
  const c = UI.card, id = cardFor, busy = !!WORLD.react[id] && WORLD.react[id].anim !== 'happy';
  c.querySelectorAll('.good').forEach(b => {
    const key = b.dataset.good, afford = GS.glass >= GOODS[key].price;
    b.disabled = !afford || busy;
    b.querySelector('.gp').classList.toggle('no', !afford);
  });
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
  for (const id of ACTOR_IDS) {
    if (!present(id)) continue;
    const A = ACTOR[id], d = Math.hypot(A.sx - ix, A.sy - iy) - 3;
    if (d < bd) { bd = d; best = { kind: 'animal', id }; }
  }
  return best;
}
function onCanvasTap(e) {
  if (growing) return;
  if (menuOpen) { menuOpen = false; renderMenu(); return; }
  const [ix, iy] = toInternal(e), hit = hitTest(ix, iy);
  if (!hit) { closeCard(); return; }
  if (hit.kind === 'glass') {
    const s = SLOTS[GS.beach[hit.n].slot], k = GS.beach[hit.n].kind, v = collectAt(hit.n);
    spark(s.x, s.y, ['sea6', 'lef6', 'amb7'][k]);
    floatNumber(s.x, s.y, '+' + v);
    tip('animal', '動物をタップすると、おやつやおもちゃをあげられます', 6);
    saveGame(); refreshUI();
  } else {
    petAnimal(hit.id);
    openCard(hit.id);
    if (FLOOR_VIEW[hit.id] !== CAM.name) setView(FLOOR_VIEW[hit.id]);
    saveGame();
  }
}
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* the store is blocked: the new game just won't persist */ }
  GS = newState();
  for (let i = 0; i < 3; i++) spawnGlass();
  GS.lastSeen = nowMs();
  storeys = 1;
  WORLD.react = {}; WORLD.sparks.length = 0;
  rebake(); pushWorld();
  menuOpen = false; renderMenu(); closeCard(); setView('all');
  toast('波打ち際のシーグラスをタップして集めましょう', 6);
  GS.tips = {};
  saveGame(); refreshUI();
}
/* an absence, whether a closed page or a long-hidden tab */
function comeBack() {
  const sec = (nowMs() - GS.lastSeen) / 1000;
  const r = settleAbsence(sec);
  pushWorld();
  const msg = [];
  if (r.pet) msg.push(`窓辺のおやつにつられて、${ANIMALS[r.pet].name}がやってきました`);
  if (r.glass > 0) msg.push(`留守のあいだに、小びんにシーグラスが ${r.glass} 個たまりました`);
  if (msg.length) toast(msg.join('。'), 7);
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
  if (fresh) { GS.tips = {}; toast('波打ち際のシーグラスをタップして集めましょう', 7); saveGame(); }
  else comeBack();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = nowMs(); saveGame(); }
    else if (hiddenAt && nowMs() - hiddenAt >= RULES.resumeAfter * 1000) comeBack();
  });
  window.addEventListener('pagehide', saveGame);
}
const GAME = {
  state: () => JSON.parse(JSON.stringify(GS)),
  rules: RULES, goods: GOODS,
  advance: sec => { advance(sec); pushWorld(); },
  collectAll: () => { let v = 0; while (GS.beach.length) v += collectAt(0); pushWorld(); if (UI.ui) refreshUI(); return v; },
  give: (id, good) => { GS.glass += GOODS[good].price; delete WORLD.react[id]; return buyFor(id, good); },
  buy: (id, good) => { delete WORLD.react[id]; const ok = buyFor(id, good); delete WORLD.react[id]; if (UI.ui) refreshUI(); return ok; },
  grow: () => { const ok = growNow(); pushWorld(); if (UI.ui) refreshUI(); return ok; },
  sill: placeSill,
  comeBack: sec => { GS.lastSeen = nowMs() - sec * 1000; comeBack(); return JSON.parse(JSON.stringify(GS)); },
  save: saveGame, read: readSave, reset: () => resetGame(),
  slots: () => SLOTS.map(s => [s.x, s.y]),
  hit: hitTest, present, view: () => CAM.name, react: () => Object.keys(WORLD.react),
  actorAt: id => [ACTOR[id].sx, ACTOR[id].sy],
  camera: () => CAM.cur.slice(),
  storeys: () => storeys,
};
