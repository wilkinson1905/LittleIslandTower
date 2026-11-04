/* ═══════════════════════════════════════════════════════════════════════
   Third floor: the bedroom nearest the sky. Pale blue walls full of little
   clouds, a pile of a bed, a telescope at the big window.
   ═══════════════════════════════════════════════════════════════════════ */
const Z3 = FLOOR_Z[2];
const paperCloud = (u, v) => {
  const row = Math.floor(v / 18), a = ((u + (row % 2) * 13) % 26 + 26) % 26, b = ((v % 18) + 18) % 18;
  const c = Math.hypot((a - 9) * .6, b - 7) < 3 || Math.hypot((a - 14) * .6, b - 7) < 3.6 || Math.hypot((a - 19) * .6, b - 7) < 2.6;
  if (c && b > 4) return C.cld7;
  return C.azu7;
};
const wall3 = (u, k) => {
  if (k < 10) return k === 9 ? C.crm7 : k === 0 ? C.sea3 : u % 10 === 0 ? C.azu4 : C.azu5;
  return paperCloud(u, k);
};
storeyShell(3, planks(10, 40, 'crm', 5, 5), wall3);

const WIN3A = archWindow('winF3A', 45, Z3 + 14, 16, 36, 3);
const WIN3B = archWindow('winF3B', -61, Z3 + 28, 16, 26, 3);

/* the bookcase along the back wall */
O('bookcaseF3', [-100, -100, Z3, -99, -99, Z3 + 20], () => {
  frontBox(-4, 34, -29, Z3, 20, 6, bookFace(34, 20, 23, ['sea4', 'pin4', 'amb6', 'lef4', 'crm7', 'ter5', 'azu3', 'pin5', 'sea5']), (u, e) => e === 0 ? C.hon7 : C.hon6);
}, { level: 3, layer: L_BACK(3), outline: .85, furn: 'bookcase' });

/* the crescent-moon rug */
const RUG3 = { x: 76, y: 68, r: 17 };
O('rugF3', [RUG3.x - RUG3.r, RUG3.y - RUG3.r, Z3, RUG3.x + RUG3.r, RUG3.y + RUG3.r, Z3 + 1], () => {
  const r = RUG3.r;
  top(RUG3.x - r, RUG3.y - r, Z3 + 1, r * 2, r * 2, (i, j) => {
    const d = Math.hypot(i - r, j - r);
    if (d > r - .5) return -1;
    const moon = Math.hypot(i - r + 3, j - r + 3) < 8.5 && Math.hypot(i - r + 1, j - r + 7) > 7;
    if (moon) return C.amb7;
    if (d > r - 2.5) return C.crm7;
    if (hsh(i >> 1, j >> 1, 5) > .97) return C.crm7;
    return C.azu2;
  });
}, { outline: 0, level: 3, furn: 'rug3' });

/* the great big bed, its head to the left under the little window */
const BED3 = { x: 20, y: 50, w: 32, d: 24, z: Z3 + 10 };
const quilt3 = (i, j) => {
  const a = i >> 2, b = j >> 2;
  if (i % 8 === 0 || j % 8 === 0) return C.crm7;
  const v = hsh(i >> 3, j >> 3, 4);
  const co = v < .25 ? C.sea5 : v < .45 ? C.pin5 : v < .6 ? C.amb7 : v < .8 ? C.azu5 : C.lef6;
  return (a + b) % 2 ? co : lite(co, .94);
};
O('bedF3', [20, 50, Z3, 52, 74, Z3 + 11], () => {
  box(20, 50, Z3, 32, 24, 4, { t: C.hon4, l: C.hon3, r: C.hon2 });
  top(20, 50, Z3 + 10, 9, 24, C.cld7);
  top(29, 50, Z3 + 10, 23, 24, quilt3);
  fy(20, 73, Z3 + 3, 32, 7, (i, k) => k < 1 ? C.crm7 : i < 9 ? C.cld5 : quilt3(i, k * 2));
  fx(51, 50, Z3 + 3, 24, 7, (j, k) => k < 1 ? C.crm5 : lite(quilt3(j, k * 2), .86));
}, { shadow: 1, level: 3, furn: 'bed3' });
O('bedPillows', [21, 51, Z3 + 10, 30, 73, Z3 + 17], () => {
  soft(21, 51, Z3 + 10, 8, 10, 4, 'cld', 6);
  soft(21, 62, Z3 + 10, 8, 10, 5, 'pin', 5);
}, { level: 3, furn: 'bed3' });
O('bedHead', [18, 49, Z3, 20, 75, Z3 + 24], () => {
  fx(19, 49, Z3, 26, 24, (j, k) => {
    const peak = 20 + Math.sin((j / 25) * Math.PI) * 4;
    if (k > peak) return -1;
    if (k > peak - 2) return C.hon6;
    return (j + 2) % 8 < 1 ? C.hon3 : C.hon4;
  });
}, { outline: .85, level: 3, furn: 'bed3' });

/* telescope on a tripod, aimed out of the big window */
O('telescope', [68, 20, Z3, 80, 32, Z3 + 26], () => {
  spr(74, 26, Z3, 'o:hon1 a:hon4', [
    '.....o.....', '.....o.....', '....ooo....', '....oao....', '...oa.ao...', '...o...o...', '..oa...ao..', '..o.....o..', '.oa.....ao.', '.o.......o.',
  ]);
  spr(74, 26, Z3 + 10, 'o:mid1 a:amb6 b:amb4 c:amb7 d:sea2', [
    '...........oo', '........oocco', '.....ooccaabo', '..ooccaaabbo.', 'ooccaaabdoo..', 'oaaabdoo.....', '.oodoo.......',
  ], { ax: 6 });
}, { outline: 0, level: 3, furn: 'telescope' });

/* the bedside table and its shell lamp */
const LAMP3 = { x: 27, y: 80, z: Z3 + 16 };
O('nightstand', [22, 76, Z3, 32, 84, Z3 + 14], () => {
  box(22, 76, Z3, 10, 8, 14, { t: grain('hon', 6), l: (i, k) => (k === 7 || i === 0 || i === 9 || k === 13 || k === 0) ? C.hon5 : (i === 5 && (k === 4 || k === 10)) ? C.amb7 : C.hon4, r: C.hon3 });
}, { shadow: 1, level: 3, furn: 'lamp' });
O('shellLamp', [23, 77, Z3 + 14, 31, 83, Z3 + 30], () => {
  spr(LAMP3.x, LAMP3.y, Z3 + 14, 'c:pin6 d:pin4 e:gld1 f:gld2 g:amb7 s:hon4', [
    '...eeee...', '..effffe..', '.effffffe.', 'gefffffffg', 'geeeeeeeeg', '....ss....', '....ss....', '...cddc...', '..cddddc..',
  ], { n: NEMIT });
}, { outline: 0, level: 3, furn: 'lamp' });

/* the rabbit's own small basket */
const RABBITBED = { x: 75, y: 89, z: Z3 + 4 };
O('rabbitBed', [66, 82, Z3, 84, 96, Z3 + 5], () => {
  soft(66, 82, Z3, 18, 14, 4, 'hon', 5, { top: (i, j) => {
    const d = Math.hypot((i - 8.5) * .9, j - 6.5);
    return d < 5 ? C.lef6 : d < 6 ? C.lef4 : null;
  } });
}, { shadow: 1, level: 3 });

light(27, 80, Z3 + 26, '#ffe6b0', .5, 40, 'A', { furn: 'lamp' });
light(84, 24, Z3 + 42, '#dff4ff', .45, 74, 'A');
light(66, 84, Z3 + 42, '#fff2dc', .22, 74, 'A');
