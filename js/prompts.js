/* ------------------------------------------------------------------
   prompts.js  -  loading prompts, choosing one, share links, history and the idle reset
   ------------------------------------------------------------------ */

const bank = {}; // sense -> [{ sense, text, id }]
const decks = {}; // sense -> a shuffled copy being dealt from (so nothing repeats until all are seen)

let cur = null; // the prompt on the board, or null on the opening board
let sel = null; // the sense last chosen
let last = null; // the prompt dealt most recently
let prev = null; // the single previous state, for the back button
let msgT = null; // timer that ends a temporary board message such as LINK COPIED
let idleT = null;

// Read prompts.csv into `bank`. The first row may be a header ("sense,prompt").
async function load() {
  let csv = window.NB_CSV; // the single-file preview build supplies the CSV here
  if (csv === undefined) {
    const r = await fetch(PROMPTS_URL, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    csv = await r.text();
  }
  parseCSV(csv).forEach((row, i) => {
    if (row.length < 2) return;
    let s = row[0].trim().toLowerCase();
    s = ALIAS[s] || s;
    const text = row.slice(1).join(",").trim();
    if (i === 0 && s === "sense") return;
    if (!SENSES.includes(s) || !text) return;
    (bank[s] = bank[s] || []).push({ sense: s, text, id: hid(text) });
  });
}

// All prompts for a sense, or every prompt for the random button.
function pool(key) {
  return key === "any" ? SENSES.flatMap((s) => bank[s] || []) : bank[key] || [];
}
// Deal the next prompt for a sense. Each sense is dealt from a shuffled deck, and a reshuffle
// never starts with the prompt that was just shown.
function draw(key) {
  if (key === "any") {
    // Random: choose a sense in proportion to how many prompts it has, then deal from that sense's
    // deck, so the random button and the sense buttons share one shuffled deck per sense.
    const total = SENSES.reduce((n, s) => n + (bank[s] || []).length, 0);
    let k = Math.floor(Math.random() * total);
    for (const s of SENSES) {
      const n = (bank[s] || []).length;
      if (k < n) {
        key = s;
        break;
      }
      k -= n;
    }
  }
  let d = decks[key];
  if (!d || !d.length) {
    d = decks[key] = shuffle(pool(key).slice());
    if (d.length > 1 && d[d.length - 1] === last) d.unshift(d.pop());
  }
  const p = d.pop();
  last = p;
  return p;
}

/* Share links: #<sense>-<id>, written into the address bar with replaceState so the Back
   button of the browser is not filled with history entries. */
function linkFor(p) {
  return location.href.split("#")[0] + "#" + p.sense + "-" + p.id;
}
function setHash(p) {
  try {
    history.replaceState(
      null,
      "",
      p ? "#" + p.sense + "-" + p.id : location.pathname + location.search,
    );
  } catch (e) {}
}
// Show the prompt named in the address bar. Returns false if there is none (or it is unknown).
function fromHash() {
  const m = /^#([a-z]+)-([a-z0-9]+)$/.exec(location.hash);
  if (!m) return false;
  const p = (bank[ALIAS[m[1]] || m[1]] || []).find((x) => x.id === m[2]);
  if (!p) return false;
  stopAnim();
  clearTimeout(msgT);
  sel = p.sense;
  cur = p;
  show(rowsFor(cur), true);
  poke();
  return true;
}

/* Idle reset: any touch or key restarts the timer; when it runs out the board returns to the
   opening message. */
function poke() {
  clearTimeout(idleT);
  if (!SETTINGS.idleSeconds || !cur) return;
  idleT = setTimeout(idleReset, SETTINGS.idleSeconds * 1000);
}
function resetBoard() {
  stopAnim();
  clearTimeout(msgT);
  prev = null;
  cur = null;
  sel = null;
  setHash(null);
  show(rowsFor(null), false, 0);
}

// A temporary message on the board (for example LINK COPIED), then back to what was showing.
function flash(txt) {
  clearTimeout(msgT);
  show(["# " + txt], false, 0);
  msgT = setTimeout(() => show(rowsFor(cur), false, 0), 1900);
}

// A sense button was pressed: deal a prompt and show it. Remember the state before it.
function pick(key) {
  stopAnim();
  clearTimeout(msgT);
  prev = { cur, sel };
  sel = key;
  cur = draw(key) || null;
  show(rowsFor(cur), false, 0);
  setHash(cur);
  poke();
}
// The back button: return to the state before the last press. Only one step is remembered.
function goBack() {
  if (!prev) return;
  stopAnim();
  clearTimeout(msgT);
  cur = prev.cur;
  sel = prev.sel;
  prev = null;
  show(rowsFor(cur), false, 0);
  setHash(cur);
  poke();
}
