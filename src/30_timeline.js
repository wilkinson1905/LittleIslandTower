/* ═══════════════════════════════════════════════════════════════════════
   Behaviour. A block is 120 s long and every animal starts and ends it in its
   own home pose, so any block can follow any other. Animals leave their floors
   by the long ladder or the open front of the tower. A timeline depends on the
   storeys, the furniture and who else is here, all read once when the block is
   compiled, so two animals can meet at an agreed moment or carry on alone.
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
/* where each animal goes to eat or play in its own room: clear floor, away from the furniture */
const SPOT = {
  cat: { x: 56, y: 64, z: Z1 },
  pup: { x: 72, y: 54, z: Z2 },
  rabbit: { x: 72, y: 60, z: Z3 },
  sheep: { x: 44, y: 62, z: Z1 + 6 },
  dragon: { x: 72, y: 72, z: Z2 },
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

/* ── the outdoors: places every animal shares ─────────────────────────── */
const CLIMB = 26;
const lad = z => ({ x: LAD.x, y: LAD.y, z });
const entry = z => ({ x: 39, y: 95, z });        // the floor beside the ladder, on any storey
const FOOT = atB(34, 104), FRONT = atB(86, 106), SAND = atB(146, 119), PIER = atB(154, 119, 5), TO_FOOT = atB(60, 118);
/* the crab rests at its right end at 12-20 s and every 40 s after, at its left end at 32-40 s and every 40 s after */
const CRAB_R = atB(116, 134), CRAB_L = atB(99, 151);
/* two animals at the same time and place, if both are here */
const both = (a, b) => present(a) && present(b);
/* A shower: it starts, it ends, and at leave everyone heads home from the rainbow. */
const RAIN_DAY = { start: 28, end: 68, leave: 94 }, RAIN_SHOW = { start: 42, end: 82, leave: 104 };
const WET = { pet: .15, dragon: .8 };      // how likely each is to be out in it
/* The tower hides the middle of the rainbow, so it's watched from off to one side: never in front of or behind the tower. */
const JET_CAT = atB(210, 114, 5), JET_PUP = atB(194, 118, 5), PG_BOW = atB(58, 140), RAB_EAST = atB(142, 62), SH_BOW = atB(150, 70, 44), DR_BOW = atB(190, 104, 34);
const PG_SHADE = atB(98, 128);             // under the parasol, behind where the crab walks
const NOSE_CAT = atB(104, 122), NOSE_PUP = atB(118, 108);
/* round the open sand, one after the other */
const LAP = [atB(110, 100), atB(140, 96), atB(150, 118), atB(118, 128)], CHASEV = 36;
const lapFrom = (n, dir) => [1, 2, 3, 4].map(k => LAP[(n + k * dir + 8) % 4]);
const roofBase = () => TOP_Z(storeys) + 6;
const rf = (s, t, h) => { const [x, y] = worldAt(s, t); return { x, y, z: roofBase() + h }; };
const ROOF_WAY = () => [rf(-42, 18, 16), rf(-16, 24, 23)];
const ladderDown = (T, z) => { T.hop(lad(z), .4, 'land').walk([lad(1)], CLIMB, 'climb').hop(FOOT, .35, 'land'); };
const ladderUp = (T, z) => { T.hop(lad(1), .35, 'land').walk([lad(z)], CLIMB, 'climb').hop(entry(z), .4, 'land'); };
const toRoof = (T, z, seat, v, anim) => {
  T.hop(lad(z), .4, 'land').walk([lad(roofBase() + 2)], CLIMB, 'climb').hop(rf(-60, 7, 4), .45, 'land').walk([...ROOF_WAY(), seat], v, anim);
};
const fromRoof = (T, z, v, anim) => {
  T.walk([...ROOF_WAY().reverse(), rf(-60, 7, 4)], v, anim).hop(lad(roofBase() + 2), .45, 'land').walk([lad(z)], CLIMB, 'climb').hop(entry(z), .4, 'land');
};
/* a palm's trunk leans on screen, so its centre has to be worked out at each height */
const trunk = (p, f) => { const off = Math.round(p.lean * Math.pow(f, 1.7)); return { x: p.x + off / 2, y: p.y - off / 2, z: p.h * f }; };
const trunkUp = p => [trunk(p, .33), trunk(p, .66), trunk(p, 1)];
const trunkDown = p => [trunk(p, .66), trunk(p, .33), trunk(p, 0)];

/* ── the cat: bed, rug, window, cat tree, and everywhere outside ──────── */
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
const catOut = T => T.walk([at1(77, 84), at1(78, 96)], CATV, 'walk').hop(FRONT, .5, 'land');
const catIn = T => T.hop(at1(78, 96), .5, 'land').walk([at1(77, 84), catFront], CATV, 'walk');
const catToLadder = T => T.walk([at1(54, 76), at1(54, 95), entry(Z1)], CATV, 'walk');
const catFromLadder = T => T.walk([at1(54, 95), at1(54, 76), catFront], CATV, 'walk');
const CAT_PALM = PALMS[2], CAT_PALM_ROUTE = [atB(66, 124), atB(46, 146), trunk(CAT_PALM, 0)];
const CATR = CATV + 12;
const catToJetty = T => T.walk([atB(130, 112), SAND], CATV, 'walk').hop(PIER, .4, 'land').walk([JET_CAT], CATV, 'walk');
const catFromJetty = T => { T.walk([PIER], CATV, 'walk').hop(SAND, .4, 'land').walk([atB(130, 112), FRONT], CATV, 'walk'); catIn(T); catOn(T); };
/* up the ladder to the puppy's floor */
const catToPup = T => { catToLadder(T); T.hop(lad(Z1), .4, 'land').walk([lad(Z2)], CLIMB, 'climb').hop(entry(Z2), .4, 'land').walk([at2(56, 88), at2(54, 82)], CATV, 'walk'); };
/* out on the sand when it starts: runs for the door, or sits it out; afterwards the door or the jetty */
function catCaught(T, r, ctx, day, always) {
  const { start: S, end: E, leave } = day, stays = r() < WET.pet, pick = r() < .5, duo = present('pup') && ctx.duoOut, out = always || stays || duo || pick;
  T.until(S + 1, 'sit');
  if (stays) T.until(E - 1, 'sit');
  else {
    T.walk([FRONT], CATR, 'walk').hop(at1(78, 96), .4, 'land').walk([at1(77, 84), at1(68, 58), at1(68, 30), at1(74, 22)], CATR, 'walk').until(E - 1, 'window');
    if (out) T.walk([at1(68, 30), at1(68, 58), at1(77, 84), at1(78, 96)], CATV, 'walk').hop(FRONT, .5, 'land');
  }
  if (out) {
    catToJetty(T);
    if (duo) T.until(E + 14, 'gaze').pose(3, 'gaze', { hearts: 1 });
    T.until(leave, 'gaze');
    catFromJetty(T);
    return;
  }
  T.until(leave, 'window').walk([at1(68, 30), at1(68, 58), catFront], CATV, 'walk'); catOn(T);
}
const CAT = {
  /* the first thing anyone sees: the crab, then a shower, then the rainbow */
  show(T, r, ctx) {
    T.pose(2, 'curl').pose(.8, 'sit'); catOff(T); catOut(T);
    T.walk([CRAB_R], CATV, 'walk').until(12, 'sit').until(20, 'tease').until(26, 'sit');
    T.walk([CRAB_L], CATV, 'walk').until(32, 'sit').until(40, 'tease');
    catCaught(T, r, ctx, RAIN_SHOW, true);
  },
  /* after the puppy, or the other way round */
  chase(T, r) {
    T.pose(2 + r() * 3, 'curl').pose(.8, 'sit'); catOff(T); catOut(T);
    T.walk([LAP[0]], CATV, 'walk').until(20, 'sit');
    for (let n = 0; n < 3; n++) T.walk(lapFrom(0, 1), CHASEV, 'walk');
    T.pose(2, 'sit');
    for (let n = 0; n < 2; n++) T.walk(lapFrom(0, -1), CHASEV, 'walk');
    T.pose(3, 'sit').pose(5, 'groom').pose(1, 'sit').walk([FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
  play(T, r) {
    if (present('pup')) { CAT.chase(T, r); return; }
    T.pose(6 + r() * 8, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catToRug(T);
    T.pose(9, 'g2').pose(3, 'sit').pose(6, 'groom').pose(5, 'g4').pose(2, 'sit'); catFromRug(T); catOn(T);
  },
  perch(T, r, ctx) {
    if (ctx.nap && present('pup')) { T.until(30, 'curl').pose(4, 'curl', { hearts: 1 }).until(84, 'curl').pose(1, 'sit').pose(6, 'groom').pose(2, 'sit'); return; }
    T.pose(14 + r() * 10, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catToRug(T);
    if (own('catTree')) { catClimb(T); T.pose(26 + r() * 10, 'sit').pose(6, 'groom').pose(1, 'sit'); catDescend(T); }
    else T.pose(14, 'sit').pose(6, 'groom').pose(1, 'sit');
    catFromRug(T); catOn(T);
  },
  rest(T, r) { T.pose(40 + r() * 20, 'curl').pose(1, 'sit').pose(7, 'groom').pose(2, 'sit'); },
  /* up to the puppy's floor to say hello */
  visit(T, r) {
    T.pose(16 + r() * 6, 'curl').pose(1, 'sit'); catOff(T); catToPup(T);
    T.until(40, 'sit').pose(5, 'nose', { hearts: 1 }).pose(2, 'sit');
    T.walk([at2(56, 88), entry(Z2)], CATV, 'walk').hop(lad(Z2), .4, 'land').walk([lad(Z1)], CLIMB, 'climb').hop(entry(Z1), .4, 'land');
    catFromLadder(T); catOn(T);
  },
  /* fetches the puppy, and they go and bother the crab together */
  invite(T) {
    T.pose(.6, 'curl').pose(.6, 'sit'); catOff(T); catToPup(T);
    T.until(12, 'sit').pose(3, 'nose', { hearts: 1 });
    T.walk([at2(56, 88), entry(Z2)], CATV + 6, 'walk'); ladderDown(T, Z2);
    T.walk([TO_FOOT, CRAB_L], CATV + 6, 'walk').until(32, 'sit').until(40, 'tease');
    T.hop(atB(108, 142), .45, 'land').pose(1.2, 'sit');
    T.walk([CRAB_R], CATV, 'walk').until(52, 'sit').until(60, 'tease').until(63, 'sit');
    T.walk([FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
  crab(T, r) {
    if (present('pup')) { CAT.invite(T); return; }
    T.pose(1 + r() * 2, 'curl').pose(.8, 'sit'); catOff(T); catOut(T);
    T.walk([CRAB_R], CATV, 'walk').until(12, 'sit').until(20, 'tease').until(26, 'sit');
    T.walk([CRAB_L], CATV, 'walk').until(32, 'sit').until(40, 'tease');
    T.hop(atB(108, 142), .45, 'land').pose(2, 'sit').pose(5, 'groom').pose(1, 'sit');
    T.walk([FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
  boat(T, r) {
    T.pose(5 + r() * 5, 'curl').pose(1, 'sit'); catOff(T); catOut(T);
    catToJetty(T);
    if (present('pup')) T.until(36, 'gaze').pose(3, 'gaze', { hearts: 1 }).until(56 + r() * 6, 'gaze');
    else T.pose(36 + r() * 6, 'gaze');
    T.pose(4, 'groom'); catFromJetty(T);
  },
  /* out on the sand, and the first drops catch it there */
  rainbow(T, r, ctx) {
    T.pose(3 + r() * 3, 'curl').pose(.8, 'sit'); catOff(T); catOut(T);
    T.walk([atB(118, 116)], CATV, 'walk').pose(3, 'sit').pose(4, 'groom');
    catCaught(T, r, ctx, RAIN_DAY);
  },
  palm(T, r) {
    T.pose(6 + r() * 6, 'curl').pose(1, 'sit'); catOff(T); catOut(T);
    T.walk(CAT_PALM_ROUTE, CATV, 'walk').pose(.5, 'crouch').walk(trunkUp(CAT_PALM), 22, 'climb');
    T.pose(20 + r() * 8, 'sit').pose(5, 'groom').pose(14, 'gaze').pose(1, 'sit');
    T.walk(trunkDown(CAT_PALM), 26, 'climb').walk([atB(46, 146), atB(66, 124), FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
  roof(T, r) {
    T.pose(3 + r() * 4, 'curl').pose(1, 'sit'); catOff(T); catToLadder(T);
    toRoof(T, Z1, present('pup') ? rf(-14, 14, 30) : rf(-6, 14, 31), CATV, 'walk');
    if (present('pup')) T.until(42, 'sit').pose(14, 'gaze').pose(4, 'groom').pose(1, 'sit');
    else T.pose(24 + r() * 8, 'sit').pose(6, 'groom').pose(12, 'gaze').pose(1, 'sit');
    fromRoof(T, Z1, CATV, 'walk'); catFromLadder(T); catOn(T);
  },
  /* meets the puppy on the sand: noses, then a lie down */
  greet(T, r) {
    T.pose(3 + r() * 3, 'curl').pose(1, 'sit'); catOff(T); catOut(T);
    T.walk([NOSE_CAT], CATV, 'walk').until(26, 'sit').pose(5, 'nose', { hearts: 1 }).pose(2, 'sit');
    T.walk([atB(82, 136)], CATV, 'walk').hop(atB(70, 150, 5), .6, 'land').pose(1, 'sit');
    T.pose(30 + r() * 10, 'curl').pose(1, 'sit').pose(2.4, 'stretch').hop(atB(82, 136), .6, 'land');
    T.walk([FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
  lounge(T, r) {
    if (present('pup')) { CAT.greet(T, r); return; }
    T.pose(5 + r() * 6, 'curl').pose(1, 'sit').pose(2.4, 'stretch'); catOff(T); catOut(T);
    T.walk([atB(82, 136)], CATV, 'walk').hop(atB(70, 150, 5), .6, 'land').pose(1, 'sit');
    T.pose(36 + r() * 12, 'curl').pose(1, 'sit').pose(2.4, 'stretch').hop(atB(82, 136), .6, 'land');
    T.walk([FRONT], CATV, 'walk'); catIn(T); catOn(T);
  },
};

/* ── the puppy: never sits still for long ─────────────────────────────── */
const PUPV = 21, PUPR = PUPV + 4;
const pupToLadder = T => T.walk([at2(66, 80), at2(56, 88), at2(42, 88), entry(Z2)], PUPR, 'walk');
const pupFromLadder = T => T.walk([at2(42, 88), at2(56, 88), at2(66, 80), at2(74, 70)], PUPR, 'walk').pose(.8, 'stand');
const pupDown = T => { pupToLadder(T); ladderDown(T, Z2); };
const pupUp = T => { T.walk([FOOT], PUPR, 'walk'); ladderUp(T, Z2); pupFromLadder(T); };
const PUP_SAND = atB(96, 124), PUP_WIN = at2(28, 78);
const pupToJetty = T => T.walk([TO_FOOT, atB(130, 112), SAND], PUPR, 'walk').hop(PIER, .4, 'land').walk([JET_PUP], PUPR, 'walk');
const pupFromJetty = T => { T.walk([PIER], PUPR, 'walk').hop(SAND, .4, 'land').walk([atB(130, 112), TO_FOOT], PUPR, 'walk'); pupUp(T); };
function pupCaught(T, r, ctx, day) {
  const { start: S, end: E, leave } = day, stays = r() < WET.pet, pick = r() < .5, out = stays || ctx.duoOut || pick;
  T.until(S + 1, 'sitWag');
  if (stays) T.until(E - 1, 'sitWag');
  else {
    T.walk([TO_FOOT, FOOT], PUPR + 10, 'walk'); ladderUp(T, Z2);
    T.walk([PUP_WIN], PUPV, 'walk').until(E - 1, 'gaze');
    if (out) { T.walk([entry(Z2)], PUPV, 'walk'); ladderDown(T, Z2); }
  }
  if (out) { pupToJetty(T); T.until(leave, 'gaze'); pupFromJetty(T); return; }
  T.until(leave, 'gaze').walk([entry(Z2)], PUPV, 'walk'); pupFromLadder(T);
}
const PUP = {
  show(T, r, ctx) {
    T.pose(5, 'curl').pose(1.2, 'stand').pose(2.4, 'stretch').pose(.6, 'stand');
    T.walk([at2(74, 42), at2(50, 42)], PUPV, 'walk').pose(4, 'sniff').pose(3, 'sitWag');
    T.walk([at2(74, 42), at2(74, 70)], PUPV, 'walk'); pupDown(T);
    T.walk([TO_FOOT, PUP_SAND], PUPR, 'walk');
    pupCaught(T, r, ctx, RAIN_SHOW);
  },
  /* the cat is always here too: from the door of the loop, one length behind it */
  play(T, r) {
    T.pose(2 + r() * 2, 'curl').pose(1.2, 'stand'); pupDown(T);
    T.walk([TO_FOOT, atB(96, 118), LAP[3]], PUPR, 'walk').until(20, 'sitWag');
    for (let n = 0; n < 3; n++) T.walk(lapFrom(3, 1), CHASEV, 'walk');
    T.pose(2, 'bark');
    for (let n = 0; n < 2; n++) T.walk(lapFrom(3, -1), CHASEV, 'walk');
    T.pose(3, 'bark').pose(6, 'sitWag').walk([atB(96, 118), TO_FOOT], PUPR, 'walk'); pupUp(T);
  },
  /* down to the cat's bed, for a nap against it */
  nap(T, r) {
    T.pose(4 + r() * 4, 'curl').pose(1.2, 'stand'); pupToLadder(T);
    T.hop(lad(Z2), .4, 'land').walk([lad(Z1)], CLIMB, 'climb').hop(entry(Z1), .4, 'land').walk([at1(54, 95), at1(55, 90)], PUPR, 'walk');
    T.until(84, 'curl').pose(1.2, 'stand').walk([at1(54, 95), entry(Z1)], PUPR, 'walk');
    T.hop(lad(Z1), .4, 'land').walk([lad(Z2)], CLIMB, 'climb').hop(entry(Z2), .4, 'land'); pupFromLadder(T);
  },
  /* the cat comes up to say hello */
  visited(T) {
    T.until(38, 'curl').pose(1.2, 'stand').until(40, 'stand').pose(5, 'nose', { flip: true }).pose(4, 'sitWag');
    T.walk([at2(74, 42), at2(50, 42)], PUPV, 'walk').pose(3, 'sniff').pose(8, 'sitWag');
    T.walk([at2(74, 42), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  beg(T, r) {
    T.pose(16 + r() * 8, 'curl').pose(1.2, 'stand');
    T.walk([at2(74, 42), at2(50, 42)], PUPV, 'walk').pose(3, 'sniff').pose(12, 'sitWag').pose(3, 'g2').pose(6, 'sitWag');
    T.walk([at2(74, 42), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  bowls(T, r) {
    T.pose(8 + r() * 8, 'curl').pose(1.2, 'stand');
    T.walk([at2(74, 58), at2(84, 58)], PUPV, 'walk').pose(own('bowls') ? 8 : 3, 'sniff').pose(8, 'sitWag');
    T.walk([at2(74, 58), at2(74, 70)], PUPV, 'walk').pose(.8, 'stand');
  },
  rest(T, r) {
    if (present('sheep')) T.until(30, 'curl').pose(4, 'curl', { hearts: 1 }).until(80, 'curl');   // the sheep comes to sleep beside it
    else T.pose(44 + r() * 20, 'curl');
    T.pose(1.2, 'stand').pose(2.4, 'stretch').pose(.6, 'stand').pose(10, 'sitWag');
  },
  /* the cat comes for it, and off they go to the crab */
  crab(T) {
    T.until(10.5, 'curl').pose(1.5, 'stand').pose(3, 'nose', { flip: true });
    pupToLadder(T); ladderDown(T, Z2);
    T.walk([TO_FOOT, atB(112, 140)], PUPR, 'walk').until(32, 'sitWag').until(40, 'tease').pose(1.5, 'stand');
    T.walk([atB(128, 118)], PUPR, 'walk').until(52, 'sitWag').until(60, 'tease').pose(1.5, 'stand').pose(3, 'sitWag');
    T.walk([TO_FOOT], PUPR, 'walk'); pupUp(T);
  },
  boat(T, r) {
    T.pose(6 + r() * 6, 'curl').pose(1.2, 'stand'); pupDown(T);
    pupToJetty(T);
    T.until(36, 'gaze').pose(16 + r() * 8, 'gaze').pose(5, 'sitWag');
    pupFromJetty(T);
  },
  rainbow(T, r, ctx) {
    T.pose(2 + r() * 3, 'curl').pose(1.2, 'stand'); pupDown(T);
    T.walk([TO_FOOT, PUP_SAND], PUPR, 'walk').pose(3, 'sniff');
    pupCaught(T, r, ctx, RAIN_DAY);
  },
  /* the cat is up the palm; it would like to climb as well, and can't */
  palm(T, r) {
    T.pose(8 + r() * 6, 'curl').pose(1.2, 'stand'); pupDown(T);
    T.walk([TO_FOOT, atB(46, 146)], PUPR, 'walk').pose(3, 'sniff').pose(7, 'bark').pose(4, 'sitWag');
    T.walk([atB(60, 138), atB(46, 146)], PUPR, 'walk').pose(6, 'bark').pose(3, 'sitWag');
    T.walk([TO_FOOT], PUPR, 'walk'); pupUp(T);
  },
  /* meets the cat on the sand */
  beach(T, r) {
    T.pose(3 + r() * 4, 'curl').pose(1.2, 'stand'); pupDown(T);
    T.walk([TO_FOOT, atB(92, 100), NOSE_PUP], PUPR, 'walk').until(26, 'sitWag').pose(5, 'nose', { flip: true }).pose(2, 'g4');
    T.walk([atB(122, 106)], PUPR, 'walk').pose(4, 'sniff').pose(3, 'sitWag');
    T.walk([atB(100, 150)], PUPR, 'walk').pose(10 + r() * 6, 'sitWag').walk([atB(58, 120)], PUPR, 'walk').pose(5, 'sniff');
    pupUp(T);
  },
  roof(T, r) {
    T.pose(14 + r() * 8, 'curl').pose(1.2, 'stand'); pupToLadder(T);
    toRoof(T, Z2, rf(12, 18, 27), PUPV, 'walk');
    T.until(42, 'sitWag').pose(3, 'gaze', { hearts: 1 }).pose(11, 'gaze').pose(4, 'sitWag');
    fromRoof(T, Z2, PUPV, 'walk'); pupFromLadder(T);
  },
};

/* ── the rabbit: basket, rug, the big bed, and the sky just above ─────── */
const RABV = 13, RABR = RABV + 4, rabDoor = at3(75, 78);
const rabOff = T => T.hop(rabDoor, .45, 'hop');
const rabOn = T => T.hop(HOME.rabbit, .45, 'hop');
const rabToBed = T => T.walk([at3(75, 62), at3(58, 62)], RABV, 'hop').hop(at3(44, 62, 10), .55, 'hop');
const rabFromBed = T => T.hop(at3(58, 62), .5, 'hop').walk([at3(75, 62), rabDoor], RABV, 'hop');
const rabToLadder = T => { rabOff(T); T.walk([at3(60, 80), at3(42, 90), entry(Z3)], RABR, 'hop'); };
const rabFromLadder = T => { T.walk([at3(42, 90), at3(60, 80), rabDoor], RABR, 'hop'); rabOn(T); };
const RAB_SEAT = () => rf(-26, 18, 24);
const RAB_WIN = at3(27, 76), RAB_FLOWER = atB(126, 60), RABG = RABV + 7;
const rabToFlowers = T => { rabToLadder(T); ladderDown(T, Z3); T.walk([TO_FOOT, atB(108, 108), RAB_FLOWER], RABG, 'hop'); };
function rabCaught(T, r, day) {
  const { start: S, end: E, leave } = day, stays = r() < WET.pet, out = r() < .5, way = [atB(108, 108), TO_FOOT, FOOT];
  T.until(S + 1, 'nibble');
  if (stays) {  // stays among the flowers, then finds a clear view of the sky
    T.until(E - 1, 'nibble').walk([RAB_EAST], RABV, 'hop').until(Math.min(leave, 100), 'gaze');
    T.walk(way, RABG, 'hop'); ladderUp(T, Z3); rabFromLadder(T);
    return;
  }
  T.walk(way, RABG + 6, 'hop'); ladderUp(T, Z3);
  T.walk([RAB_WIN], RABV, 'hop').until(E - 1, 'gaze');
  if (out) {
    T.walk([entry(Z3)], RABV, 'hop'); toRoof(T, Z3, RAB_SEAT(), RABR, 'hop');
    T.until(leave, 'gaze').pose(1, 'sit'); fromRoof(T, Z3, RABR, 'hop');
  } else T.until(leave, 'gaze').walk([entry(Z3)], RABV, 'hop');
  rabFromLadder(T);
}
const RAB = {
  show(T, r) {
    T.pose(5, 'loaf').pose(1.4, 'sit'); rabToFlowers(T);
    rabCaught(T, r, RAIN_SHOW);
  },
  /* down the ladder to sleep against the cat */
  nap(T, r) {
    T.pose(3 + r() * 3, 'loaf').pose(1.4, 'sit'); rabToLadder(T);
    T.hop(lad(Z3), .4, 'land').walk([lad(Z1)], CLIMB, 'climb').hop(entry(Z1), .4, 'land').walk([at1(54, 95), at1(56, 92)], RABR, 'hop');
    T.until(84, 'loaf').pose(1.4, 'sit').walk([at1(54, 95), entry(Z1)], RABR, 'hop');
    T.hop(lad(Z1), .4, 'land').walk([lad(Z3)], CLIMB, 'climb').hop(entry(Z3), .4, 'land'); rabFromLadder(T);
  },
  bed(T, r) {
    T.pose(12 + r() * 10, 'loaf').pose(1.4, 'sit'); rabOff(T);
    if (own('bed3')) { rabToBed(T); T.pose(2, 'sit').pose(40 + r() * 10, 'loaf').pose(5, 'g4').pose(1, 'sit'); rabFromBed(T); }
    else T.walk([at3(75, 62)], RABV, 'hop').pose(8, 'look').pose(5, 'g4').walk([rabDoor], RABV, 'hop');
    rabOn(T);
  },
  rug(T, r) {
    T.pose(6 + r() * 10, 'loaf').pose(1.4, 'sit'); rabOff(T);
    T.walk([at3(75, 62)], RABV, 'hop');
    for (let n = 0; n < 3; n++) T.pose(5, 'sit').pose(4, 'g2').pose(3, 'g4');
    T.walk([rabDoor], RABV, 'hop'); rabOn(T);
  },
  rest(T, r) { T.pose(36 + r() * 20, 'loaf').pose(2, 'sit').pose(5, 'g4').pose(2, 'sit'); },
  roof(T, r) {
    T.pose(6 + r() * 6, 'loaf').pose(1.4, 'sit'); rabToLadder(T); toRoof(T, Z3, RAB_SEAT(), RABR, 'hop');
    T.pose(34 + r() * 8, 'gaze').pose(4, 'g4').pose(1, 'sit');
    fromRoof(T, Z3, RABR, 'hop'); rabFromLadder(T);
  },
  rainbow(T, r) {
    T.pose(2 + r() * 2, 'loaf').pose(1.4, 'sit'); rabToFlowers(T);
    rabCaught(T, r, RAIN_DAY);
  },
  /* all the way down, to nibble among the sunflowers */
  flowers(T, r) {
    T.pose(4 + r() * 6, 'loaf').pose(1.4, 'sit'); rabToLadder(T); ladderDown(T, Z3);
    const v = RABV + 7;
    T.walk([TO_FOOT, atB(108, 108), atB(126, 60)], v, 'hop').pose(2, 'sit').pose(7, 'nibble').pose(3, 'look');
    T.walk([atB(124, 40)], v, 'hop').pose(6, 'nibble').pose(3, 'sit');
    T.walk([atB(108, 108), TO_FOOT, FOOT], v, 'hop'); ladderUp(T, Z3); rabFromLadder(T);
  },
};

/* ── the cloud sheep: drifts about, in no hurry, and sometimes with the clouds ─ */
const SHV = 7, SHR = SHV + 5;
const shOut = T => T.walk([at1(68, 75, 18), at1(84, 100, 24), atB(104, 118, 44)], SHR, 'drift');
const shIn = T => T.walk([at1(84, 100, 24), at1(68, 75, 18), at1(40, 60, 16)], SHR, 'drift');
const SH_WIN = at1(26, 68, 20), SH_FLOWER = atB(124, 58, 40);
function sheepCaught(T, r, day) {
  const { start: S, end: E, leave } = day, stays = r() < WET.pet, out = r() < .5;
  T.until(S + 1, 'rainy');
  if (stays) T.until(E - 1, 'rainy').walk([SH_BOW], SHR, 'drift');
  else {
    T.walk([atB(104, 118, 44), at1(84, 100, 24), at1(68, 75, 18), SH_WIN], SHR + 6, 'drift').until(E - 1, 'gaze');
    if (!out) { T.until(leave, 'gaze').walk([HOME.sheep], SHV, 'drift'); return; }
    shOut(T); T.walk([SH_BOW], SHR, 'drift');
  }
  T.until(leave, 'arc').pose(1, 'float').walk([atB(104, 118, 44)], SHR, 'drift'); shIn(T);
}
const SHEEP = {
  show(T, r) { T.pose(4 + r() * 6, 'float'); shOut(T); T.walk([SH_FLOWER], SHR, 'drift'); sheepCaught(T, r, RAIN_SHOW); },
  drift(T, r) {
    T.pose(5 + r() * 8, 'float');
    for (let n = 0; n < 2; n++) T.walk([at1(68, 60, 18 + r() * 8), at1(68, 75, 16), at1(40, 75, 18 + r() * 8), at1(40, 60, 16)], SHV, 'drift').pose(2 + r() * 3, 'float');
  },
  rain(T, r) { T.pose(10 + r() * 10, 'float').pose(9, 'g2').pose(16, 'snooze').pose(2, 'float'); },
  rest(T, r) {
    if (present('pup')) {   // up to the puppy's floor, for a sleep beside it
      T.pose(6 + r() * 2, 'float'); shOut(T);
      T.walk([atB(100, 100, 118), at2(86, 68, 10)], SHR, 'drift').until(80, 'snooze').pose(1, 'float');
      T.walk([atB(100, 100, 118), atB(104, 118, 44)], SHR, 'drift'); shIn(T);
      return;
    }
    T.pose(14 + r() * 10, 'float').pose(30 + r() * 20, 'snooze').pose(2, 'float');
  },
  /* puts out the dragon's flame */
  douse(T, r) {
    T.pose(4 + r() * 4, 'float'); shOut(T);
    T.walk([atB(146, 110, 30)], SHR, 'drift').until(44, 'float').pose(6, 'rainy').pose(5, 'happy').pose(1, 'float');
    T.walk([atB(104, 118, 44)], SHR, 'drift'); shIn(T);
  },
  /* waters the sunflowers */
  sunny(T, r) {
    T.pose(6 + r() * 6, 'float'); shOut(T);
    T.walk([atB(124, 58, 40)], SHR, 'drift').pose(12, 'rainy').pose(6, 'float').walk([atB(132, 42, 40)], SHV, 'drift').pose(8, 'rainy');
    T.walk([atB(104, 118, 44)], SHR, 'drift'); shIn(T);
  },
  /* goes up to be a cloud for a while */
  sky(T, r) {
    T.pose(4 + r() * 6, 'float'); shOut(T);
    T.walk([atB(118, 140, Math.min(300, roofBase() + 30))], SHR, 'drift').pose(14 + r() * 6, 'snooze').pose(4, 'float');
    T.walk([atB(104, 118, 44)], SHR, 'drift'); shIn(T);
  },
  /* over the flowers when it starts; maybe a small rainbow of its own under the big one */
  arc(T, r) {
    T.pose(4 + r() * 4, 'float'); shOut(T); T.walk([SH_FLOWER], SHR, 'drift');
    sheepCaught(T, r, RAIN_DAY);
  },
};

/* ── the little dragon: minds the oven; flies badly, and often ────────── */
const DRV = 14, DRR = DRV + 7, ovenFront = at2(34, 51, 9), DR_GATE = atB(98, 112, 90);
const dragonToOven = T => T.walk([at2(32, 58, 16), ovenFront], DRV, 'fly');
const dragonHome = T => T.walk([at2(32, 58, 16), HOME.dragon], DRV, 'fly');
const drOut = T => T.walk([at2(60, 84, 18), DR_GATE], DRR, 'fly');
const drIn = T => T.walk([DR_GATE, at2(60, 84, 18), HOME.dragon], DRR, 'fly');
const atCrown = p => { const c = trunk(p, 1); return { x: c.x, y: c.y, z: c.z + 2 }; };
const DR_WIN = at2(24, 68, 20);
/* it likes the rain: out it goes, nearly always, and dances in it */
function dragonRain(T, r, day) {
  const { start: S, end: E, leave } = day, out = r() < WET.dragon, after = r() < .5;
  T.until(S, 'perch');
  if (out) {
    drOut(T); T.walk([atB(140, 120, 44)], DRR, 'fly');
    T.pose(5, 'rainy').walk([atB(160, 104, 54), atB(150, 136, 40)], DRV, 'fly').pose(5, 'rainy').walk([atB(140, 120, 44)], DRV, 'fly').until(E - 1, 'rainy');
  } else {
    T.walk([DR_WIN], DRV, 'fly').until(E - 1, 'gaze');
    if (!after) { T.until(leave, 'gaze').walk([HOME.dragon], DRV, 'fly'); return; }
    drOut(T);
  }
  T.walk([DR_BOW], DRR, 'fly').until(leave, 'gaze').pose(1, 'hover');
  T.walk([DR_GATE], DRR, 'fly'); drIn(T);
}
const DRAGON = {
  show(T, r) { dragonRain(T, r, RAIN_SHOW); },
  /* a small flame on the sand, until the sheep comes over */
  fire(T, r) {
    T.pose(14 + r() * 4, 'perch'); drOut(T);
    T.walk([atB(160, 110, 14)], DRR, 'fly').until(40, 'hover').pose(10, 'blow').pose(5, 'happy', { hearts: 1 }).pose(1, 'hover');
    T.walk([DR_GATE], DRR, 'fly'); drIn(T);
  },
  oven(T, r) {
    T.pose(12 + r() * 12, 'perch');
    if (own('oven')) { dragonToOven(T); T.pose(5, 'light').pose(3, 'hover'); dragonHome(T); }
    T.pose(5, 'perch').pose(5, 'g2').pose(14, 'sleep').pose(2, 'perch');
  },
  loop(T, r) {
    T.pose(8 + r() * 12, 'perch').walk([at2(32, 66, 24), at2(34, 84, 18)], DRV, 'fly').pose(5, 'g4');
    T.walk([at2(74, 84, 18), at2(74, 42, 18), at2(34, 42, 18)], DRV, 'fly').pose(5, 'g2').walk([at2(32, 58, 18), HOME.dragon], DRV, 'fly').pose(2, 'perch');
  },
  rest(T, r) { T.pose(10 + r() * 8, 'perch').pose(44 + r() * 20, 'sleep').pose(2, 'perch'); },
  crab(T, r) {
    T.pose(36 + r() * 10, 'perch'); drOut(T);
    T.walk([atB(150, 130, 70), atB(120, 136, 18)], DRR, 'fly').until(92, 'hover').until(100, 'tease').pose(1, 'hover');
    T.walk([DR_GATE], DRR, 'fly'); drIn(T);
  },
  /* sits in the crown of the tall palm */
  palm(T, r) {
    T.pose(10 + r() * 10, 'perch'); drOut(T);
    T.walk([atCrown(PALMS[0])], DRR, 'fly').pose(30 + r() * 8, 'perch').pose(5, 'g2').pose(1, 'hover');
    T.walk([DR_GATE], DRR, 'fly'); drIn(T);
  },
  roof(T, r) {
    T.pose(8 + r() * 10, 'perch'); drOut(T);
    T.walk([atB(100, 110, roofBase() + 30), rf(6, 10, 37)], DRR, 'fly').pose(30 + r() * 8, 'perch').pose(8, 'sleep').pose(3, 'perch');
    T.walk([atB(100, 110, roofBase() + 30), DR_GATE], DRR, 'fly'); drIn(T);
  },
  boat(T, r) {
    T.pose(8 + r() * 8, 'perch'); drOut(T);
    T.walk([atB(190, 104, 34)], DRR, 'fly').pose(32 + r() * 8, 'gaze').pose(5, 'g4');
    T.walk([DR_GATE], DRR, 'fly'); drIn(T);
  },
  rainbow(T, r) { dragonRain(T, r, RAIN_DAY); },
};

/* ── the penguin: paces the jetty, then the sand, with great seriousness ─ */
const PGV = 7, deckEnd = atB(154, 119, 5), sand = atB(146, 119, 0);
const pgOff = T => T.walk([deckEnd], PGV + 2, 'waddle').hop(sand, .5, 'flap');
const pgOn = T => T.hop(deckEnd, .55, 'flap').walk([HOME.penguin], PGV + 2, 'waddle');
/* no room to run to: it waits under the parasol, then walks round for a clear view */
function penguinRain(T, day) {
  const { start: S, end: E, leave } = day, gap = atB(60, 128);
  T.until(S, 'stand'); pgOff(T);
  T.walk([PG_SHADE], PGV + 6, 'waddle').until(E - 1, 'stand').pose(2, 'flap');
  T.walk([gap, PG_BOW], PGV + 2, 'waddle').until(leave, 'gaze').pose(2, 'flap');
  T.walk([gap, sand], PGV + 3, 'waddle'); pgOn(T);
}
const PENGUIN = {
  show(T) { penguinRain(T, RAIN_SHOW); },
  beach(T, r) {
    T.pose(10 + r() * 10, 'stand'); pgOff(T);
    T.walk([atB(146, 100), atB(132, 100)], PGV, 'waddle').pose(10 + r() * 10, 'stand').pose(4, 'flap');
    T.walk([atB(146, 100), sand], PGV, 'waddle'); pgOn(T);
  },
  slide(T) {
    T.pose(6, 'stand').pose(3, 'flap'); pgOff(T);
    T.walk([atB(146, 92), atB(130, 92)], PGV, 'waddle').pose(5, 'g4').pose(3, 'stand');
    T.walk([atB(146, 92)], PGV, 'waddle').pose(1, 'flap').pose(3.5, 'g2', { to: sand });
    T.p = sand; T.pose(3, 'stand'); pgOn(T);
  },
  rest(T, r) { T.pose(24 + r() * 16, 'stand').pose(30 + r() * 10, 'nap').pose(3, 'flap'); },
  crab(T, r) {
    T.pose(36 + r() * 8, 'stand'); pgOff(T);
    T.walk([atB(120, 135), CRAB_L], PGV + 2, 'waddle').until(72, 'stand').until(80, 'tease').pose(1.5, 'flap');
    T.walk([atB(120, 135), sand], PGV + 2, 'waddle'); pgOn(T);
  },
  jetty(T, r) {
    T.pose(8 + r() * 8, 'stand').walk([atB(172, 124, 5)], PGV, 'waddle');
    T.pose(34 + r() * 8, 'gaze').pose(3, 'flap').pose(4, 'g4').walk([HOME.penguin], PGV, 'waddle');
  },
  pool(T, r) {
    T.pose(6 + r() * 6, 'stand'); pgOff(T);
    T.walk([atB(110, 122), atB(56, 124)], PGV + 3, 'waddle').pose(6, 'peck').pose(8, 'stand').pose(6, 'peck').pose(2, 'flap');
    T.walk([atB(110, 122), sand], PGV + 3, 'waddle'); pgOn(T);
  },
  rainbow(T) { penguinRain(T, RAIN_DAY); },
};

const SCRIPTS = {
  /* everyone's best moment in one loop */
  showcase: { cat: CAT.show, pup: PUP.show, rabbit: RAB.show, sheep: SHEEP.show, dragon: DRAGON.show, penguin: PENGUIN.show, shower: [RAIN_SHOW.start, RAIN_SHOW.end] },
  /* everyone has a go at the crab, one at a time */
  crab: { cat: CAT.crab, pup: PUP.crab, rabbit: RAB.rug, sheep: SHEEP.sunny, dragon: DRAGON.crab, penguin: PENGUIN.crab },
  /* a sail on the horizon: the jetty fills up */
  boat: { cat: CAT.boat, pup: PUP.boat, rabbit: RAB.roof, sheep: SHEEP.drift, dragon: DRAGON.boat, penguin: PENGUIN.jetty },
  /* a sun shower: everyone runs for it, except the dragon; then a rainbow */
  rainbow: { cat: CAT.rainbow, pup: PUP.rainbow, rabbit: RAB.rainbow, sheep: SHEEP.arc, dragon: DRAGON.rainbow, penguin: PENGUIN.rainbow, shower: [RAIN_DAY.start, RAIN_DAY.end] },
  palm: { cat: CAT.palm, pup: PUP.palm, rabbit: RAB.flowers, sheep: SHEEP.rain, dragon: DRAGON.palm, penguin: PENGUIN.pool },
  roof: { cat: CAT.roof, pup: PUP.roof, rabbit: RAB.bed, sheep: SHEEP.sky, dragon: DRAGON.roof, penguin: PENGUIN.rest },
  beach: { cat: CAT.lounge, pup: PUP.beach, rabbit: RAB.flowers, sheep: SHEEP.sunny, dragon: DRAGON.loop, penguin: PENGUIN.slide },
  play: { cat: CAT.play, pup: PUP.play, rabbit: RAB.rug, sheep: SHEEP.drift, dragon: DRAGON.loop, penguin: PENGUIN.jetty },
  /* a nap against the cat, or the cat up its tree */
  perch: {
    cat: CAT.perch,
    pup: (T, r, ctx) => (ctx.nap && !present('rabbit') ? PUP.nap(T, r) : PUP.bowls(T, r)),
    rabbit: (T, r, ctx) => (ctx.nap ? RAB.nap(T, r) : RAB.bed(T, r)),
    sheep: SHEEP.rain, dragon: DRAGON.oven, penguin: PENGUIN.rest,
  },
  /* the dragon's flame and the sheep's rain; without them, the cat calls on the puppy */
  snack: {
    cat: (T, r) => (present('pup') && !both('dragon', 'sheep') ? CAT.visit(T, r) : CAT.rest(T, r)),
    pup: (T, r) => (both('dragon', 'sheep') ? PUP.beg(T, r) : PUP.visited(T)),
    rabbit: RAB.bed,
    sheep: (T, r) => (both('dragon', 'sheep') ? SHEEP.douse(T, r) : SHEEP.drift(T, r)),
    dragon: (T, r) => (both('dragon', 'sheep') ? DRAGON.fire(T, r) : DRAGON.oven(T, r)),
    penguin: PENGUIN.pool,
  },
  /* the tower simply breathes */
  quiet: { cat: CAT.rest, pup: PUP.rest, rabbit: RAB.rest, sheep: SHEEP.rest, dragon: DRAGON.rest, penguin: PENGUIN.rest },
};
const SCRIPT_NAMES = Object.keys(SCRIPTS);
const SCRIPT_WEIGHTS = [['showcase', 1], ['crab', 2], ['boat', 2], ['rainbow', 2], ['palm', 2], ['roof', 2], ['beach', 2], ['play', 1], ['perch', 1], ['snack', 1], ['quiet', 1]];

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
  // decided once for the whole block, so two animals agree
  const ctx = { duoOut: r() < .7, nap: r() < .5 || !own('catTree') };
  for (const id of ACTOR_IDS) {
    const T = new Track(HOME[id]);
    def[id](T, r, ctx);
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
  // furniture is left out on purpose: a purchase changes the next block, not the one playing.
  // who is here is in: it only changes when the tower grows or the page has been away.
  const key = (CFG.loop ? 'L' : 'F') + CFG.seed + ':' + storeys + ':' + (WORLD.pets.dragon ? 1 : 0) + (WORLD.pets.sheep ? 1 : 0) + (WORLD.pets.penguin ? 1 : 0) + ':' + k;
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
