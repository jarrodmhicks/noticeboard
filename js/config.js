/* ------------------------------------------------------------------
   config.js  -  everything you are likely to want to change
   ------------------------------------------------------------------ */

// Where the prompts live (a CSV with the columns: sense,prompt).
const PROMPTS_URL = "prompts.csv";

// Settings that change how the board behaves.
const SETTINGS = {
  // Return to the opening board after this many seconds without a press. 0 = never.
  idleSeconds: 180,
  // Extra swatch tiles around a prompt: "off", "rule", "tab", "frame", "spine", "spineR" or "corners"
  // (see ACCENTS in board.js).
  accent: "off",
};

// Buzz the phone briefly when a button is pressed.
const VIBRATE = true;

// The board is a grid of COLS x ROWS flip tiles.
const COLS = 14;
const ROWS = 6;

// Characters a tile can show, in the order the flaps cycle through them.
const CH = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.?!,'";

// What the board says when nothing is selected. One string per row; '' leaves the row empty.
const OPENING_BOARD = ["YOUR SENSES", "ARE ALWAYS", "ON.", "", "NOTICE THEM."];

// The rainbow stripe at the left of the opening board. Row r gets the color of RAINBOW[r].
// (In a row string, the letters a-f stand for these six colored tiles, see board.js.)
const STRIP = "abcdef";
const RAINBOW = ["hearing", "smell", "taste", "touch", "vision", "any"];

// The five senses, and alternative spellings accepted in prompts.csv.
const SENSES = ["hearing", "smell", "taste", "touch", "vision"];
const ALIAS = { sight: "vision" };

// The six buttons: [data-s value, accessible name, icon id in the sprite in index.html].
// 'any' is the random button.
const BUTTONS = [
  ["hearing", "Hearing", "ear"],
  ["smell", "Smell", "nose"],
  ["taste", "Taste", "tongue"],
  ["touch", "Touch", "hand"],
  ["vision", "Vision", "eye"],
  ["any", "Random", "dice"],
];

// The panel is drawn tilted back. Keep these two in sync with --tilt and --lip in css/base.css.
const TILT_DEG = 16;
const LIP_UNITS = 10;
