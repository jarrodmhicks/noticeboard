/* ------------------------------------------------------------------
   controls.js  -  the control panel: sense buttons, sound fader, back and copy buttons,
   keyboard shortcuts and haptics
   ------------------------------------------------------------------ */

// Icons for the two ends of the sound fader (static: the icons never change, the knob moves).
const SPK_ON =
  '<span class="spkw"><svg class="spk eng" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg></span>';
const SPK_OFF =
  '<span class="spkw"><svg class="spk eng" viewBox="0 0 24 24" aria-hidden="true"><defs><mask id="spkm" maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28"><rect x="-2" y="-2" width="28" height="28" fill="#fff"/><line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="#000" stroke-width="5" stroke-linecap="round"/></mask></defs><g mask="url(#spkm)"><path d="M11 5 6 9H2v6h4l5 4V5Z"/></g><line x1="3.5" y1="3.5" x2="20.5" y2="20.5"/></svg></span>';

/* Haptics. Android Chrome has navigator.vibrate. iOS has none, but toggling a hidden
   <input type="checkbox" switch> gave a light tap in Safari (iOS 17.4 and later), so we click one.
   It is a best effort: it does nothing in Chrome on iOS, and reportedly Apple closed it in iOS 26.5.
   Both need a prior user gesture; returns whether a buzz was sent. */
let buzzed = false;
function buzz() {
  if (!VIBRATE) return false;
  if (navigator.vibrate) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive)
      return false;
    try {
      return navigator.vibrate(12);
    } catch (e) {
      return false;
    }
  }
  try {
    const l = document.getElementById("hap");
    if (l) {
      l.click();
      return true;
    }
  } catch (e) {}
  return false;
}

/* The six sense buttons.
   The panel is tilted with a 3D transform, and some browsers then deliver clicks unreliably
   to its children. So presses are detected geometrically on pointerdown / pointerup (which
   button's rectangle contains the pointer), and the normal click handler is kept only as a
   fallback for keyboards and screen readers; `handledAt` stops the two from both firing. */
let held = null;
let heldAt = 0;
let handledAt = 0;

// Animate a button down and back up.
function tap(b, ms) {
  b.classList.add("down");
  setTimeout(() => b.classList.remove("down"), ms);
}
function btnAt(x, y) {
  for (const b of document.querySelectorAll(".bt")) {
    const r = b.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
  }
  return null;
}
// Keyboard: 1-5 and R behave like pressing the button.
function pressKey(key) {
  const b = document.querySelector('.bt[data-s="' + key + '"]');
  if (b) tap(b, 170);
  thunk();
  pick(key);
}
function buildButtons() {
  const el = document.getElementById("senses");
  el.innerHTML = BUTTONS.map(
    (b) =>
      '<button class="bt" data-s="' +
      b[0] +
      '" aria-label="' +
      b[1] +
      '">' +
      '<svg class="pic eng" aria-hidden="true"><use href="#i-' +
      b[2] +
      '"/></svg>' +
      '<span class="well"><span class="cap"></span></span></button>',
  ).join("");

  document.addEventListener("pointerdown", (e) => {
    const b = btnAt(e.clientX, e.clientY);
    if (!b) return;
    b.classList.add("down");
    held = b;
    heldAt = performance.now();
    thunk();
    buzzed = buzz();
  });
  const up = (e) => {
    if (!held) return;
    const b = held;
    held = null;
    const hit = e.type === "pointerup" && btnAt(e.clientX, e.clientY) === b;
    // keep the cap down for at least 150 ms so a quick tap still visibly presses
    setTimeout(
      () => b.classList.remove("down"),
      Math.max(0, 150 - (performance.now() - heldAt)),
    );
    if (hit) {
      handledAt = performance.now();
      tick();
      if (!buzzed) buzz();
      pick(b.dataset.s);
    }
  };
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
  el.addEventListener("click", (e) => {
    const b = e.target.closest(".bt");
    if (!b) return;
    if (performance.now() - handledAt < 600) return;
    tap(b, 170);
    thunk();
    buzz();
    pick(b.dataset.s);
  });
}

/* The sound fader: muted speaker, a switch (role="switch" for assistive tech), loud speaker.
   Same geometric trick as the buttons above. */
function renderSound() {
  document.getElementById("sndrow").innerHTML =
    SPK_OFF +
    '<button class="sw" id="snd" role="switch" aria-label="Sound" aria-checked="' +
    sound +
    '"><span class="knob"></span></button>' +
    SPK_ON;
}
function paintSound() {
  const s = document.getElementById("snd");
  if (s) s.setAttribute("aria-checked", String(sound));
}
let sndAt = 0;
function toggleSound() {
  detent(!sound); // plays even when switching sound off, so you hear the switch itself
  sound = !sound;
  store("nb-sound", sound ? "on" : "off");
  paintSound();
}
document.addEventListener("pointerup", (e) => {
  const s = document.getElementById("snd");
  if (!s) return;
  const r = s.getBoundingClientRect();
  if (
    e.clientX >= r.left - 4 &&
    e.clientX <= r.right + 4 &&
    e.clientY >= r.top - 4 &&
    e.clientY <= r.bottom + 4
  ) {
    sndAt = performance.now();
    toggleSound();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#snd") || performance.now() - sndAt < 600) return;
  toggleSound();
});

/* The two soft round keys (back and copy). mkBtn gives a key the same press feel as the
   sense buttons and runs `action` when it is clicked. */
function mkBtn(el, action) {
  let downAt = 0;
  let pressed = false; // true between pointerdown and the release sound
  let buzzedHere = false;
  const release = () => {
    if (!el.classList.contains("down")) return;
    setTimeout(
      () => el.classList.remove("down"),
      Math.max(0, 150 - (performance.now() - downAt)),
    );
  };
  el.addEventListener("pointerdown", () => {
    el.classList.add("down");
    downAt = performance.now();
    pressed = true;
    softThunk(); // heard immediately, and stays alone while the key is held
    buzzedHere = buzz();
  });
  // The release sound plays when the finger lifts (or slides off), not before.
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    el.addEventListener(ev, () => {
      if (pressed) {
        pressed = false;
        softTick();
      }
      release();
    }),
  );
  el.addEventListener("click", () => {
    if (!el.classList.contains("down") && !pressed) {
      // keyboard or assistive-tech click: no pointerdown happened, so press and release here
      el.classList.add("down");
      downAt = performance.now();
      softThunk();
      setTimeout(() => {
        softTick();
        el.classList.remove("down");
      }, 170);
    }
    if (!buzzedHere) buzz();
    buzzedHere = false;
    action();
  });
}

// Copy the link to the current prompt (or the plain site address on the opening board).
async function copyLink() {
  const url = cur ? linkFor(cur) : location.href.split("#")[0];
  try {
    await navigator.clipboard.writeText(url);
    copiedEffect();
  } catch (e) {
    try {
      window.prompt("Copy this link", url);
    } catch (_) {}
  }
}

// Keyboard shortcuts: 1-5 pick a sense, R a random prompt, B (or Backspace, or the left arrow) goes
// back, C copies the link.
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const t = e.target;
  if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  const i = "12345".indexOf(e.key);
  if (i >= 0) pressKey(SENSES[i]);
  else if (e.key === "r" || e.key === "R") pressKey("any");
  else if (/^[bB]$|^Backspace$|^ArrowLeft$/.test(e.key)) {
    e.preventDefault();
    document.getElementById("back").click();
  } else if (e.key === "c" || e.key === "C") document.getElementById("copy").click();
});
