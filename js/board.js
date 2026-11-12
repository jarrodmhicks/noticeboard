/* ------------------------------------------------------------------
   board.js  -  the split-flap board: tiles, the flip animation, and word wrapping
   ------------------------------------------------------------------ */

const board = document.getElementById("board");
const tiles = []; // COLS x ROWS tile elements, row by row
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A "token" is what a half-tile displays: one character, or 'sw:<sense>' for a colored swatch.
function paint(h, tok) {
  const sp = h.firstChild;
  if (tok.length > 3 && tok.slice(0, 3) === "sw:") {
    sp.textContent = " ";
    h.style.background = "var(--c-" + tok.slice(3) + ")";
  } else {
    sp.textContent = tok;
    h.style.background = "";
  }
}

// One half of a tile (class 'u' = upper half, 'd' = lower half; 'f' marks a moving flap).
function half(c, tok) {
  const d = document.createElement("div");
  d.className = "h " + c;
  d.appendChild(document.createElement("span"));
  paint(d, tok);
  return d;
}

// Create the empty grid.
function build() {
  board.style.setProperty("--cols", COLS);
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div");
    row.className = "r";
    for (let c = 0; c < COLS; c++) {
      const t = document.createElement("div");
      t.className = "t";
      t.up = half("u", " ");
      t.dn = half("d", " ");
      t.append(t.up, t.dn);
      t.cur = " ";
      t.tok = 0;
      row.appendChild(t);
      tiles.push(t);
    }
    board.appendChild(row);
  }
}

// Jump a tile straight to a token, no animation.
function setTile(t, tok) {
  t.tok++;
  paint(t.up, tok);
  paint(t.dn, tok);
  t.cur = tok;
}

// Flip a tile once, from what it shows now to token n.
// The upper half of the tile already shows the NEW character behind the moving flap.
// A flap showing the OLD character falls forward (0 -> -90deg), then a flap showing the NEW one
// swings down into place (90 -> 0deg). Each phase is 55 ms. `tok` is the tile's generation counter:
// if a newer target arrives mid-flip, the old flip notices and stops.
function flip(t, n, tok) {
  return new Promise((res) => {
    const old = t.cur,
      D = 55;
    paint(t.up, n);
    const ft = half("u f", old);
    t.appendChild(ft);
    click();
    const a = ft.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }],
      { duration: D, easing: "ease-in", fill: "forwards" },
    );
    a.onfinish = () => {
      ft.remove();
      if (tok !== t.tok) {
        res();
        return;
      }
      const fb = half("d f", n);
      t.appendChild(fb);
      const b = fb.animate(
        [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }],
        { duration: D, easing: "ease-out" },
      );
      b.onfinish = () => {
        fb.remove();
        if (tok === t.tok) {
          paint(t.dn, n);
          t.cur = n;
        }
        res();
      };
    };
  });
}

// Send a tile to its target after `delay` ms, the way a real board does: cycle through the
// characters in between (2 to 7 extra flips) and land on the target.
async function run(t, target, delay) {
  const tok = ++t.tok;
  if (reduce) {
    setTile(t, target);
    return;
  }
  await sleep(delay);
  if (tok !== t.tok || t.cur === target) return;
  let idx = CH.indexOf(target);
  if (idx < 0) idx = Math.floor(Math.random() * CH.length);
  const k = 2 + Math.floor(Math.random() * 6);
  for (let j = k - 1; j >= 0; j--) {
    if (tok !== t.tok) return;
    await flip(t, CH[(idx - j + CH.length * 2) % CH.length], tok);
  }
  if (tok === t.tok && t.cur !== target) await flip(t, target, tok);
}

// Greedy word wrap into lines of at most W characters. Also normalizes the text to what the
// tiles can show (upper case, curly quotes to straight, unsupported characters to spaces).
function wrap(text, W) {
  W = W || COLS;
  const words = text
    .replace(/[‘’]/g, "'")
    .toUpperCase()
    .replace(/[^A-Z0-9 :.\-?!,']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let c = "";
  for (let w of words) {
    while (w.length > W) {
      if (c) {
        lines.push(c);
        c = "";
      }
      lines.push(w.slice(0, W));
      w = w.slice(W);
    }
    if (!c) c = w;
    else if ((c + " " + w).length <= W) c += " " + w;
    else {
      lines.push(c);
      c = w;
    }
  }
  if (c) lines.push(c);
  return lines;
}

// Turn something to show into ROWS strings of text.
//   null           -> the opening board
//   {sense, text}  -> row 1: swatch tile, blank tile, sense name; then (if it fits) a blank row; then the prompt
// In a row string, '#' means "the swatch of the current sense", and (on the opening board only)
// the letters a-f mean the six rainbow stripe tiles.
function rowsFor(item) {
  if (!item) {
    return Array.from(
      { length: ROWS },
      (_, r) => STRIP[r] + " " + (OPENING_BOARD[r] || ""),
    );
  }
  const lines = wrap(item.text, COLS);
  const blank = lines.length <= ROWS - 2;
  let rows = ["# " + item.sense.toUpperCase()].concat(blank ? [""] : [], lines);
  if (rows.length > ROWS) {
    rows = rows.slice(0, ROWS);
    console.warn("Prompt too long for the board:", item.text);
  }
  return Array.from({ length: ROWS }, (_, r) => rows[r] || "");
}

function tokenFor(ch) {
  if (ch === "#" && cur && cur.sense) return "sw:" + cur.sense;
  if (!cur && ch !== " " && STRIP.includes(ch))
    return "sw:" + RAINBOW[STRIP.indexOf(ch)];
  return CH.includes(ch) ? ch : " ";
}

// Put rows on the board. Normally each tile flips after a delay that grows with its column and
// row, so the change ripples across the board from top-left. `instant` skips the animation.
// `extra` adds a delay (ms) to every tile.
function show(rows, instant, extra) {
  const spoken = [];
  for (let r = 0; r < ROWS; r++) {
    const s = (rows[r] || "").padEnd(COLS, " ").slice(0, COLS);
    // The same text for screen readers (swatches carry no text).
    spoken.push(
      s
        .replace("#", " ")
        .replace(cur ? /$^/ : /[a-f]/g, " ")
        .trim(),
    );
    for (let c = 0; c < COLS; c++) {
      const tile = tiles[r * COLS + c];
      const tok = tokenFor(s[c]);
      if (instant) setTile(tile, tok);
      else run(tile, tok, (extra || 0) + c * 22 + r * 60 + Math.random() * 60);
    }
  }
  document.getElementById("live").textContent = spoken
    .filter(Boolean)
    .join(" ");
}
