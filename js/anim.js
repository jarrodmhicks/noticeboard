/* ------------------------------------------------------------------
   anim.js  -  full-board animations: the idle stripes and the "link copied" ripple
   ------------------------------------------------------------------

   An animation is a list of SCENES. A scene is a full board (one token per tile, see paint() in
   board.js) plus how to get there. To change scenes, every tile that differs does what a real
   split-flap does: it spins through a run of characters (or, for a color, through the rainbow)
   and then stops on its target. Tiles start at different moments (`delay`) and spin different
   numbers of times (`spins`), so the board settles in a wave, a sweep, a spiral or a scatter.
   When every tile has landed, the scene holds for a moment, then the next one begins:
   spin, stop, spin, stop. */

let animId = 0; // bumped to cancel whatever is playing
let animating = false;

const blankGrid = () => new Array(ROWS * COLS).fill(" ");
// Rainbow color number i (wraps around): red, orange, yellow, green, blue, purple.
const hue = (i, strength) =>
  "sw:" + RAINBOW[((Math.round(i) % 6) + 6) % 6] + (strength ? ":" + strength : "");
const inGrid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const put = (g, r, c, tok) => {
  if (inGrid(r, c)) g[r * COLS + c] = tok;
};
// Write `str` into row r starting at column c0 (characters the tiles cannot show are skipped).
function putText(g, r, c0, str) {
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch !== " " && CH.includes(ch)) put(g, r, c0 + i, ch);
  }
}
const putCentered = (g, r, str) => putText(g, r, Math.floor((COLS - str.length) / 2), str);

// The sequence of tokens a tile flips through to land on `target`, `k` flips in all.
// Letters: the characters just before the target on the flap drum. Colors: the rainbow.
function spinSeq(target, k) {
  const seq = [];
  const idx = CH.indexOf(target);
  if (idx >= 0) {
    for (let j = k - 1; j >= 0; j--) seq.push(CH[(idx - j + CH.length * 2) % CH.length]);
  } else {
    const m = target.match(/^(?:sw|ink):(\w+)/);
    const base = Math.max(0, RAINBOW.indexOf(m ? m[1] : "any"));
    for (let j = k - 1; j > 0; j--) seq.push("sw:" + RAINBOW[(base - j + 60) % 6]);
    seq.push(target);
  }
  return seq;
}

// Send one tile to `target`: wait `delay` ms, spin through `spins` flips, stop.
async function spinTo(t, target, delay, spins, id) {
  const gen = ++t.tok; // cancels anything older on this tile
  if (reduce) {
    setTile(t, target);
    return;
  }
  if (t.cur === target) return;
  await sleep(delay);
  if (id !== animId || gen !== t.tok) return;
  for (const tok of spinSeq(target, Math.max(1, Math.round(spins)))) {
    if (id !== animId || gen !== t.tok) return;
    await flip(t, tok, gen);
  }
}

// Play scenes in order. Each scene is { grid, delay(r,c) -> ms, spins(r,c) -> count, hold -> ms }.
// Resolves true if it ran to the end, false if it was cancelled (by stopAnim) on the way.
async function playScenes(scenes) {
  const id = ++animId;
  animating = true;
  for (const s of scenes) {
    if (id !== animId) return false;
    const jobs = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const d = (s.delay ? s.delay(r, c) : 0) + Math.random() * 40;
        const k = s.spins ? s.spins(r, c) : 4;
        jobs.push(spinTo(tiles[r * COLS + c], s.grid[r * COLS + c], d, k, id));
      }
    await Promise.all(jobs);
    if (id !== animId) return false;
    await sleep(s.hold === undefined ? 450 : s.hold);
  }
  if (id !== animId) return false;
  animating = false;
  return true;
}
function stopAnim() {
  animId++;
  animating = false;
}

// Build a grid from a function (r, c) -> token.
const gridOf = (fn) => {
  const g = blankGrid();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g[r * COLS + c] = fn(r, c) || " ";
  return g;
};
const scene = (grid, delay, spins, hold) => ({ grid, delay, spins, hold });

/* ============ idle: the stripes ============ */

// Row r is the color of the rainbow column's tile in that row (red at the top). The stripes drop in
// from the top, then pull back one row at a time (red first), toward the rainbow column on the
// left, which stays. animateAndReset() then flips the opening message in.
function stripes() {
  const full = gridOf((r) => hue(r));
  const left = gridOf((r, c) => (c === 0 ? hue(r) : " "));
  return [
    scene(full, (r, c) => r * 220 + c * 12, (r, c) => 4 + (c % 3), 600),
    scene(left, (r, c) => r * 260 + (COLS - 1 - c) * 30, () => 3, 250),
  ];
}

/* Play the stripes, then return to the opening board. Used by the idle timer. The state is
   cleared first so the address bar and the back key do not hold on to the old prompt. */
async function idleReset() {
  clearTimeout(msgT);
  clearTimeout(idleT);
  prev = null;
  cur = null;
  sel = null;
  setHash(null);
  if (!reduce && !(await playScenes(stripes()))) return; // interrupted: whoever interrupted takes over
  show(rowsFor(null), false, 0);
}

/* ============ "link copied" ============ */

// LINK and COPIED on two lines, each centered. COPIED (6) starts at column 4 and LINK (4) at
// column 5, so LINK sits above "OPIE".
const HOLD = 1500; // how long the message stays up
const cdist = (r, c) => Math.hypot((c - (COLS - 1) / 2) / 1.6, r - (ROWS - 1) / 2);

// Rings of color ripple out from the center, then the message ripples in over them.
function copiedEffect() {
  if (reduce) {
    flash("LINK COPIED");
    return;
  }
  const msg = blankGrid();
  putCentered(msg, 2, "LINK");
  putCentered(msg, 3, "COPIED");
  const rings = gridOf((r, c) => hue(Math.floor(cdist(r, c) * 1.5)));
  clearTimeout(msgT);
  playScenes([
    scene(rings, (r, c) => cdist(r, c) * 110, () => 4, 250),
    scene(msg, (r, c) => cdist(r, c) * 90, () => 3, HOLD),
  ]).then((done) => {
    if (done) show(rowsFor(cur), false, 0);
  });
}
