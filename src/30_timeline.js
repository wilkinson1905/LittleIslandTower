/* ═══════════════════════════════════════════════════════════════════════
   Behaviour. A block is 120 s long and every animal starts and ends it in its
   own home pose, so any block can follow any other. Each animal keeps to its own
   storey, and its timeline never depends on who else is here yet: arrivals only
   decide who gets drawn.
   ═══════════════════════════════════════════════════════════════════════ */
const ACTOR_IDS = ['cat', 'pup', 'rabbit', 'sheep', 'dragon', 'penguin'];
const HOME = {
  cat: { x: 67, y: 91, z: Z1 + 4 },
  pup: { x: 74, y: 70, z: Z2 },
  rabbit: { x: 75, y: 89, z: Z3 + 4 },
  sheep: { x: 40, y: 60, z: Z1 + 16 },
  dragon: { x: 32, y: 66, z: Z2 + 13 },
  penguin: { x: 170, y: 119, z: 5 },
};
const HOME_ANIM = { cat: 'curl', pup: 'curl', rabbit: 'loaf', sheep: 'float', dragon: 'perch', penguin: 'stand' };
/* where each animal goes to eat or play: clear floor, away from the furniture */
const SPOT = {
  cat: { x: 56, y: 64, z: Z1 },
  pup: { x: 72, y: 54, z: Z2 },
  rabbit: { x: 72, y: 60, z: Z3 },
  sheep: { x: 44, y: 62, z: Z1 + 6 },
  dragon: { x: 72, y: 72, z: Z2 },
  penguin: { x: 140, y: 106, z: 0 },
};

class Track {
  constructor(home) { this.t = 0; this.segs = []; this.p = home; }
  pose(dur, anim, o) {
    this.segs.push({ t0: this.t, t1: this.t + dur, kind: 0, anim, a: this.p, b: this.p, o });
    this.t += dur;
    return this;
  }
  until(T, anim, o) { if (T > this.t) this.pose(T - this.t, anim, o); return this; }
  walk(nodes, speed, anim) {
    for (const n of nodes) {
      const a = this.p, d = Math.hypot(n.x - a.x, n.y - a.y, n.z - a.z) || 1;
      this.segs.push({ t0: this.t, t1: this.t + d / speed, kind: 1, anim, a, b: n });
      this.t += d / speed;
      this.p = n;
    }
    return this;
  }
  hop(n, dur, anim) {
    this.segs.push({ t0: this.t, t1: this.t + dur, kind: 2, anim, a: this.p, b: n });
    this.t += dur;
    this.p = n;
    return this;
  }
}
const at1 = (x, y, dz = 0) => ({ x, y, z: Z1 + dz });
const at2 = (x, y, dz = 0) => ({ x, y, z: Z2 + dz });
const at3 = (x, y, dz = 0) => ({ x, y, z: Z3 + dz });
const atB = (x, y, z = 0) => ({ x, y, z });

/* ── the cat: bed, rug, window, the top of the cat tree ───────────────── */
const CATV = 18, catFront = at1(67, 80);
const catOff = T => T.hop(catFront, .4, 'leap');
const catOn = T => T.hop(HOME.cat, .4, 'leap');
const catToRug = T => T.walk([at1(67, 58), at1(56, 58)], CATV, 'walk');
const catFromRug = T => T.walk([at1(67, 58), catFront], CATV, 'walk');
const catToWin = T => T.walk([at1(68, 58), at1(68, 30), at1(74, 22)], CATV, 'walk');
const catFromWin = T => T.walk([at1(68, 30), at1(68, 58), at1(56, 58)], CATV, 'walk');
const catClimb = T => {
  T.walk([at1(50, 58), at1(50, 74)], CATV, 'walk');
  T.pose(.5, 'crouch').hop(at1(40, 86, 21), .55, 'leap').pose(.6, 'sit').hop(at1(43, 85, 42), .55, 'leap');
};
const catDescend = T => {
  T.hop(at1(40, 86, 21), .5, 'leap').pose(.4, 'sit').hop(at1(50, 74), .5, 'leap');
  T.walk([at1(50, 58), at1(56, 58)], CATV, 'walk');
};
const CAT = {
  show(T) {
    T.pose(7, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catToRug(T);
    T.pose(3, 'sit').pose(6, 'g2').pose(1, 'sit'); catToWin(T); T.pose(16, 'window'); catFromWin(T);
    T.pose(5, 'g4'); catClimb(T); T.pose(15, 'sit').pose(6, 'groom').pose(2, 'sit'); catDescend(T);
    T.pose(2, 'sit'); catFromRug(T); catOn(T);
  },
  play(T, r) {
    T.pose(6 + r() * 8, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catToRug(T);
    T.pose(9, 'g2').pose(3, 'sit').pose(6, 'groom').pose(5, 'g4').pose(2, 'sit'); catFromRug(T); catOn(T);
  },
  perch(T, r) {
    T.pose(14 + r() * 10, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catToRug(T);
    catClimb(T); T.pose(26 + r() * 10, 'sit').pose(6, 'groom').pose(1, 'sit'); catDescend(T); catFromRug(T); catOn(T);
  },
  watch(T, r) {
    T.pose(8 + r() * 6, 'curl').pose(1, 'sit'); catOff(T); catToRug(T); catToWin(T);
    T.pose(44 + r() * 10, 'window'); catFromWin(T); catFromRug(T); catOn(T);
  },
  rest(T, r) { T.pose(40 + r() * 20, 'curl').pose(1, 'sit').pose(7, 'groom').pose(2, 'sit'); },
};

/* ── the puppy: never sits still for long ─────────────────────────────── */
const PUPV = 21;
const PUP = {
  show(T) {
    T.pose(5, 'curl').pose(1.2, 'stand').pose(2.4, 'stretch').pose(.6, 'stand');
    T.walk([at2(74, 42), at2(50, 42)], PUPV, 'walk').pose(4, 'sniff').pose(5, 'sitWag').pose(4, 'g2');
    T.walk([at2(84, 42), at2(84, 58)], PUPV, 'walk').pose(5, 'sniff').pose(5, 'g4').pose(6, 'sitWag');
    T.walk([at2(84, 42), at2(74, 42), at2(74, 62), at2(62, 84)], PUPV, 'walk').pose(8, 'sitWag');
    T.walk([at2(74, 84), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  play(T, r) {
    T.pose(4 + r() * 6, 'curl').pose(1.2, 'stand').pose(.6, 'stretch');
    for (let n = 0; n < 3; n++) T.walk([at2(74, 42), at2(84, 42), at2(84, 62), at2(74, 62)], PUPV + 4, 'walk').pose(2.4, 'g4');
    T.pose(6, 'sitWag').walk([at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  beg(T, r) {
    T.pose(16 + r() * 8, 'curl').pose(1.2, 'stand');
    T.walk([at2(74, 42), at2(50, 42)], PUPV, 'walk').pose(3, 'sniff').pose(12, 'sitWag').pose(3, 'g2').pose(6, 'sitWag');
    T.walk([at2(74, 42), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  bowls(T, r) {
    T.pose(8 + r() * 8, 'curl').pose(1.2, 'stand');
    T.walk([at2(74, 58), at2(84, 58)], PUPV, 'walk').pose(8, 'sniff').pose(8, 'sitWag');
    T.walk([at2(74, 58), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  rest(T, r) { T.pose(44 + r() * 20, 'curl').pose(1.2, 'stand').pose(2.4, 'stretch').pose(.6, 'stand').pose(10, 'sitWag'); },
};

/* ── the rabbit: basket, rug, and the big bed when no one is looking ──── */
const RABV = 13, rabDoor = at3(75, 78);
const rabOff = T => T.hop(rabDoor, .45, 'hop');
const rabOn = T => T.hop(HOME.rabbit, .45, 'hop');
const rabToBed = T => T.walk([at3(75, 62), at3(58, 62)], RABV, 'hop').hop(at3(44, 62, 10), .55, 'hop');
const rabFromBed = T => T.hop(at3(58, 62), .5, 'hop').walk([at3(75, 62), rabDoor], RABV, 'hop');
const RAB = {
  show(T) {
    T.pose(9, 'loaf').pose(1.4, 'sit'); rabOff(T);
    T.walk([at3(75, 62)], RABV, 'hop').pose(3, 'sit').pose(5, 'g2').pose(1, 'sit');
    T.walk([at3(62, 62), at3(62, 36)], RABV, 'hop').pose(9, 'look').walk([at3(62, 62)], RABV, 'hop');
    T.walk([at3(58, 62)], RABV, 'hop').hop(at3(44, 62, 10), .55, 'hop');
    T.pose(3, 'sit').pose(16, 'loaf').pose(5, 'g4').pose(1, 'sit'); rabFromBed(T); rabOn(T);
  },
  bed(T, r) {
    T.pose(12 + r() * 10, 'loaf').pose(1.4, 'sit'); rabOff(T); rabToBed(T);
    T.pose(2, 'sit').pose(40 + r() * 10, 'loaf').pose(5, 'g4').pose(1, 'sit'); rabFromBed(T); rabOn(T);
  },
  rug(T, r) {
    T.pose(6 + r() * 10, 'loaf').pose(1.4, 'sit'); rabOff(T);
    T.walk([at3(75, 62)], RABV, 'hop');
    for (let n = 0; n < 3; n++) T.pose(5, 'sit').pose(4, 'g2').pose(3, 'g4');
    T.walk([rabDoor], RABV, 'hop'); rabOn(T);
  },
  rest(T, r) { T.pose(36 + r() * 20, 'loaf').pose(2, 'sit').pose(5, 'g4').pose(2, 'sit'); },
};

/* ── the cloud sheep: drifts about the playroom, in no hurry ─────────── */
const SHV = 7;
const SHEEP = {
  show(T) {
    T.pose(8, 'float').walk([at1(68, 60, 22), at1(68, 75, 16)], SHV, 'drift').pose(6, 'g2').pose(1, 'float');
    T.walk([at1(40, 75, 22), at1(40, 60, 16)], SHV, 'drift').pose(5, 'g4').pose(10, 'snooze').pose(2, 'float');
  },
  drift(T, r) {
    T.pose(5 + r() * 8, 'float');
    for (let n = 0; n < 2; n++) T.walk([at1(68, 60, 18 + r() * 8), at1(68, 75, 16), at1(40, 75, 18 + r() * 8), at1(40, 60, 16)], SHV, 'drift').pose(2 + r() * 3, 'float');
  },
  rain(T, r) { T.pose(10 + r() * 10, 'float').pose(9, 'g2').pose(16, 'snooze').pose(2, 'float'); },
  rest(T, r) { T.pose(14 + r() * 10, 'float').pose(30 + r() * 20, 'snooze').pose(2, 'float'); },
};

/* ── the little dragon: minds the oven; flies badly, and often ────────── */
const DRV = 14, ovenFront = at2(34, 51, 9);
const dragonToOven = T => T.walk([at2(32, 58, 16), ovenFront], DRV, 'fly');
const dragonHome = T => T.walk([at2(32, 58, 16), HOME.dragon], DRV, 'fly');
const DRAGON = {
  show(T) {
    T.pose(10, 'perch'); dragonToOven(T); T.pose(5, 'light').pose(2, 'hover');
    T.walk([at2(34, 42, 18), at2(74, 42, 18), at2(74, 84, 18), at2(34, 84, 18)], DRV, 'fly').pose(6, 'g2');
    T.walk([at2(34, 66, 18)], DRV, 'fly').pose(5, 'g4').hop(HOME.dragon, .5, 'fly').pose(24, 'sleep').pose(2, 'perch');
  },
  oven(T, r) {
    T.pose(12 + r() * 12, 'perch'); dragonToOven(T); T.pose(5, 'light').pose(3, 'hover'); dragonHome(T);
    T.pose(5, 'perch').pose(5, 'g2').pose(14, 'sleep').pose(2, 'perch');
  },
  loop(T, r) {
    T.pose(8 + r() * 12, 'perch').walk([at2(32, 66, 24), at2(34, 84, 18)], DRV, 'fly').pose(5, 'g4');
    T.walk([at2(74, 84, 18), at2(74, 42, 18), at2(34, 42, 18)], DRV, 'fly').pose(5, 'g2').walk([at2(32, 58, 18), HOME.dragon], DRV, 'fly').pose(2, 'perch');
  },
  rest(T, r) { T.pose(10 + r() * 8, 'perch').pose(44 + r() * 20, 'sleep').pose(2, 'perch'); },
};

/* ── the penguin: paces the jetty, then the sand, with great seriousness ─ */
const PGV = 7, deckEnd = atB(154, 119, 5), sand = atB(146, 119, 0);
const pgOff = T => T.walk([deckEnd], PGV + 2, 'waddle').hop(sand, .5, 'flap');
const pgOn = T => T.hop(deckEnd, .55, 'flap').walk([HOME.penguin], PGV + 2, 'waddle');
const PENGUIN = {
  show(T) {
    T.pose(6, 'stand').pose(3, 'flap'); pgOff(T);
    T.walk([atB(146, 92), atB(130, 92)], PGV, 'waddle').pose(5, 'g4').pose(3, 'stand');
    T.walk([atB(146, 92)], PGV, 'waddle').pose(1, 'flap').pose(3.5, 'g2', { to: sand });
    T.p = sand; T.pose(3, 'stand'); pgOn(T);
  },
  beach(T, r) {
    T.pose(10 + r() * 10, 'stand'); pgOff(T);
    T.walk([atB(146, 100), atB(132, 100)], PGV, 'waddle').pose(10 + r() * 10, 'stand').pose(4, 'flap');
    T.walk([atB(146, 100), sand], PGV, 'waddle'); pgOn(T);
  },
  rest(T, r) { T.pose(24 + r() * 16, 'stand').pose(30 + r() * 10, 'nap').pose(3, 'flap'); },
};

const SCRIPTS = {
  /* everyone's best moment in one loop */
  showcase: { cat: CAT.show, pup: PUP.show, rabbit: RAB.show, sheep: SHEEP.show, dragon: DRAGON.show, penguin: PENGUIN.show, shower: [58, 74] },
  play: { cat: CAT.play, pup: PUP.play, rabbit: RAB.rug, sheep: SHEEP.drift, dragon: DRAGON.loop, penguin: PENGUIN.beach },
  perch: { cat: CAT.perch, pup: PUP.bowls, rabbit: RAB.bed, sheep: SHEEP.rain, dragon: DRAGON.oven, penguin: PENGUIN.rest },
  snack: { cat: CAT.rest, pup: PUP.beg, rabbit: RAB.bed, sheep: SHEEP.drift, dragon: DRAGON.oven, penguin: PENGUIN.beach },
  /* a sun shower: the sky keeps shining and the cat goes to the window */
  shower: { cat: CAT.watch, pup: PUP.bowls, rabbit: RAB.rest, sheep: SHEEP.rain, dragon: DRAGON.rest, penguin: PENGUIN.beach, shower: [30, 52] },
  /* the tower simply breathes */
  quiet: { cat: CAT.rest, pup: PUP.rest, rabbit: RAB.rest, sheep: SHEEP.rest, dragon: DRAGON.rest, penguin: PENGUIN.rest },
};
const SCRIPT_NAMES = Object.keys(SCRIPTS);
const SCRIPT_WEIGHTS = [['showcase', 1], ['play', 2], ['perch', 2], ['snack', 2], ['shower', 2], ['quiet', 3]];

/* face: 0 SE, 1 SW, 2 NE, 3 NW. Poses keep the facing of the walk before them. */
function assignFaces(segs) {
  let face = 0;
  for (const s of segs) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    if (dx || dy) face = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 3) : (dy >= 0 ? 1 : 2);
    s.face = face;
  }
}
function compileBlock(name, seed) {
  const r = mulberry(seed), def = SCRIPTS[name], b = { name };
  for (const id of ACTOR_IDS) {
    const T = new Track(HOME[id]);
    def[id](T, r);
    const home = HOME[id];
    if (T.t > LOOP) console.warn(`script ${name}: ${id} runs ${T.t.toFixed(1)}s`);
    if (T.p.x !== home.x || T.p.y !== home.y || T.p.z !== home.z) console.warn(`script ${name}: ${id} ends away from home`);
    T.until(LOOP + 1, HOME_ANIM[id]);
    assignFaces(T.segs);
    b[id] = T.segs;
  }
  b.shower = def.shower || null;
  return b;
}
/* The endless order is a seeded shuffle of a weighted deck, a pure function of the
   block number. Each deck ends on 'quiet' and no deck opens on it, so a story never
   plays twice running, even across decks. The first deck opens with the showcase. */
const DECK = SCRIPT_WEIGHTS.flatMap(([nm, w]) => Array(w).fill(nm));
function storyAt(k) {
  const d = Math.floor(k / DECK.length), i = k - d * DECK.length;
  const r = mulberry(Math.imul(CFG.seed, 131) + d * 7919), rest = DECK.slice();
  rest.splice(rest.indexOf('quiet'), 1);
  let ok = false;
  while (!ok) {
    for (let n = rest.length - 1; n > 0; n--) {
      const m = r() * (n + 1) | 0, v = rest[n];
      rest[n] = rest[m]; rest[m] = v;
    }
    if (d === 0) { const s = rest.indexOf('showcase'), v = rest[0]; rest[0] = 'showcase'; rest[s] = v; }
    ok = rest[0] !== 'quiet' && rest[rest.length - 1] !== 'quiet' && rest.every((nm, n) => n === 0 || nm !== rest[n - 1]);
  }
  return i < rest.length ? rest[i] : 'quiet';
}
const blockCache = new Map();
function blockFor(k) {
  const key = (CFG.loop ? 'L' : 'F') + CFG.seed + ':' + k;
  let b = blockCache.get(key);
  if (b) return b;
  const name = CFG.loop ? SCRIPT_NAMES[((k % SCRIPT_NAMES.length) + SCRIPT_NAMES.length) % SCRIPT_NAMES.length] : storyAt(k);
  b = compileBlock(name, Math.imul(CFG.seed, 31) + k * 977);
  if (blockCache.size >= 2) blockCache.delete(blockCache.keys().next().value); // never grows past two
  blockCache.set(key, b);
  return b;
}
function findSeg(segs, t) {
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (segs[m].t1 <= t) lo = m + 1; else hi = m; }
  return segs[lo];
}
const ACTOR = {};
ACTOR_IDS.forEach(id => { ACTOR[id] = { id, x: 0, y: 0, z: 0, anim: '', face: 0, u: 0, local: 0, moving: false, o: null, sx: 0, sy: 0, h: 14 }; });
function sampleActor(A, segs, t) {
  const s = findSeg(segs, t);
  const u = clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0), 0, 1);
  A.anim = s.anim; A.o = s.o; A.u = u; A.local = t - s.t0; A.face = s.face;
  if (s.kind === 0) {
    A.x = s.a.x; A.y = s.a.y; A.z = s.a.z; A.moving = false;
    if (s.o && s.o.to) { // a belly slide: a pose with somewhere to get to
      A.x = lerp(s.a.x, s.o.to.x, u * u); A.y = lerp(s.a.y, s.o.to.y, u * u); A.z = lerp(s.a.z, s.o.to.z, u); A.moving = true;
    }
    return;
  }
  A.x = lerp(s.a.x, s.b.x, u); A.y = lerp(s.a.y, s.b.y, u);
  A.moving = true;
  if (s.kind === 2) A.z = lerp(s.a.z, s.b.z, u) + Math.sin(u * Math.PI) * Math.max(6, Math.abs(s.b.z - s.a.z) * .9);
  else A.z = lerp(s.a.z, s.b.z, u);
}
