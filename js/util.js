/* ------------------------------------------------------------------
   util.js  -  small helpers with no dependencies
   ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// localStorage that never throws (private windows and blocked storage return null).
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) {
    return null;
  }
}

// Short, stable id for a prompt: the first 5 characters of an FNV-1a hash of its text.
// This is what makes share links like #smell-1nz1v keep working when prompts are re-ordered.
// (Editing a prompt's text changes its link.)
function hid(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5);
}

// Fisher-Yates shuffle, in place.
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Minimal CSV parser: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF.
function parseCSV(t) {
  t = t.replace(/^﻿/, "");
  const rows = [];
  let row = [],
    f = "",
    q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}
