/* ═══════════════════════════════════════
   Debug only (?cat=1): swap the hand-made cat for the one drawn with Codex, to compare them in play.
   Nothing here runs on the plain URL, so the picture there stays the same. That includes pidx:
   it remembers what it finds, so looking these colours up early would shift colours elsewhere.
   ═══════════════════════════════════════ */
const CAT_OLD = Object.assign({}, K);
let catNew = null, catArtOn = false;
function buildCatNew() {
  const palette = ART_CAT.colors.map(pidx), out = {};
  const sprite = ([w, h, ax, ay, data]) => {
    const d = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i++) { const v = parseInt(data[i], 16); if (v) d[i] = palette[v - 1]; }
    return { w, h, d, ax, ay };
  };
  for (const name in ART_CAT.states) {
    const frames = ART_CAT.states[name].map(sprite);
    out[name] = frames.length > 1 ? frames : frames[0];
  }
  out.sitSway = out.sit;     // the tail is part of this drawing: it sways with the frames
  out.sit = out.sitSway[0];
  return out;
}
function useCatArt(on) {
  catArtOn = on;
  if (on && !catNew) catNew = buildCatNew();
  Object.assign(K, on ? catNew : CAT_OLD);
}
function catArtPose(t) {
  SHOT.tail = null;
  if (SHOT.s === K.sit) SHOT.s = K.sitSway[fr(t, 9, 4)];
  SHOT.h = Math.round(SHOT.h * 1.5);
}
