/* ------------------------------------------------------------------
   audio.js  -  every sound is synthesized live with the Web Audio API (no audio files)
   ------------------------------------------------------------------ */

// The sound switch. Remembered between visits.
let sound = store("nb-sound") !== "off";
let ac = null; // the shared AudioContext, created on first use
let lastClick = 0;

// Returns the AudioContext, or null if sound is off or the browser has not allowed audio yet
// (browsers only allow it after the person has touched the page).
function audio() {
  if (!sound) return null;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive)
    return null;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch (e) {
    return null;
  }
}

// A short burst of noise (used for the flap clicks).
function noise(a, secs, type, freq, gain) {
  const len = Math.floor(a.sampleRate * secs),
    b = a.createBuffer(1, len, a.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource();
  s.buffer = b;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  s.connect(f);
  f.connect(g);
  g.connect(a.destination);
  s.start();
}

// One flap click. Rate-limited so 84 tiles flipping do not become a wall of noise.
function click() {
  const a = audio();
  if (!a) return;
  const n = performance.now();
  if (n - lastClick < 35) return;
  lastClick = n;
  try {
    noise(a, 0.012, "highpass", 1800, 0.18);
  } catch (e) {}
}

// Building blocks for the button sounds: a filtered noise burst and a pitched tone.
function nz(a, t, dur, type, f, q, g) {
  const n = Math.max(8, Math.floor(a.sampleRate * dur)),
    b = a.createBuffer(1, n, a.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < n; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = a.createBufferSource();
  s.buffer = b;
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const gn = a.createGain();
  gn.gain.value = g;
  s.connect(fl);
  fl.connect(gn);
  gn.connect(a.destination);
  s.start(t);
}
function tn(a, t, f, f2, dur, g, type) {
  const o = a.createOscillator(),
    gn = a.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(g, t + 0.004);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn);
  gn.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}
/* relay clunk: press down / release */
function thunk() {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime;
    nz(a, t, 0.02, "bandpass", 1400, 3, 0.6);
    tn(a, t, 90, 60, 0.12, 0.35, "triangle");
  } catch (e) {}
}
function tick() {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime;
    nz(a, t, 0.012, "bandpass", 2200, 1, 0.4);
    tn(a, t, 140, 0, 0.03, 0.1);
  } catch (e) {}
}

/* Softer versions for the small back and copy keys: same relay character, higher and about
   half as loud. Press and release are separate sounds: softThunk plays when the key goes down,
   softTick only when it is let go. */
function softThunk() {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime;
    nz(a, t, 0.016, "bandpass", 2000, 2.5, 0.28);
    tn(a, t, 150, 105, 0.07, 0.16, "triangle");
  } catch (e) {}
}
function softTick() {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime;
    nz(a, t, 0.009, "bandpass", 2800, 1, 0.18);
    tn(a, t, 200, 0, 0.02, 0.05);
  } catch (e) {}
}

/* sound switch: detent, two ticks (forced so it also plays when turning sound off) */
function detent(on) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive)
      return;
    const a = ac,
      t = a.currentTime;
    nz(a, t, 0.01, "highpass", 2500, 1, 0.35);
    nz(a, t + 0.05, 0.014, "highpass", on ? 3200 : 2000, 1, 0.5);
    tn(a, t + 0.05, on ? 240 : 170, 0, 0.03, 0.1);
  } catch (e) {}
}
