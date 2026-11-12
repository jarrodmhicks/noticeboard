/* ------------------------------------------------------------------
   cable.js  -  the tabletop effect and the cable between board and panel
   ------------------------------------------------------------------ */

const panel = document.getElementById("panel");
const table = document.getElementById("table");

// The panel is rotated back with CSS (rotateX), which does not change its layout box. Work out
// how tall it actually looks on screen and size its container to match, so nothing overlaps
// and no gap is left under it. All sizes are in "units" (1 unit = stack width / 648).
function fitTable() {
  const u = document.getElementById("stack").clientWidth / 648;
  const th = (TILT_DEG * Math.PI) / 180;
  const lip = LIP_UNITS * u;
  const perspective = 1300 * u;
  const h = panel.offsetHeight;
  const apparent = (h * Math.cos(th)) / (1 - (h * Math.sin(th)) / perspective);
  table.style.height = Math.ceil(apparent + lip * Math.cos(th) + 6 * u) + "px";
}

// Draw the cable as SVG: a thick dark curve from the board's bottom-left plug down to the port
// on the panel's left side, with a faint highlight line along it.
function drawWires() {
  const svg = document.getElementById("wires");
  const rig = document.getElementById("rig");
  const port = document.getElementById("port");
  const rr = rig.getBoundingClientRect();
  const W = rr.width;
  const H = rr.height;
  svg.innerHTML = "";
  if (!W || !H) return;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  const k = W / 648; // one unit in pixels
  const pr = port.getBoundingClientRect();
  const x0 = pr.left + pr.width / 2 - rr.left; // cable end at the panel port
  const y0 = pr.top + pr.height / 2 - rr.top;
  const framePad =
    parseFloat(
      getComputedStyle(document.getElementById("frame")).paddingLeft,
    ) || 20;
  const x1 = framePad * 0.75; // cable end at the board's bottom-left corner

  // A cubic curve that leaves the port sideways, then curls up into the board.
  const hook = Math.max(26 * k, Math.abs(x1 - x0) + 14 * k);
  const d =
    "M" +
    x0 +
    "," +
    y0 +
    " C" +
    (x0 - hook) +
    "," +
    y0 +
    " " +
    x1 +
    "," +
    y0 * 0.55 +
    " " +
    x1 +
    ",0";

  svg.innerHTML =
    '<path d="' +
    d +
    '" fill="none" stroke="#2b2b29" stroke-width="' +
    4.5 * k +
    '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' +
    d +
    '" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="' +
    1.2 * k +
    '" stroke-linecap="round" transform="translate(' +
    -k +
    ',0)"/>' +
    // the two plugs
    '<rect x="' +
    (x1 - 7 * k) +
    '" y="' +
    -1 * k +
    '" width="' +
    14 * k +
    '" height="' +
    7 * k +
    '" rx="' +
    2 * k +
    '" fill="#0c0c0c"/>' +
    '<rect x="' +
    (x0 - 6 * k) +
    '" y="' +
    (y0 - 4 * k) +
    '" width="' +
    8 * k +
    '" height="' +
    8 * k +
    '" rx="' +
    2 * k +
    '" fill="#0c0c0c"/>';
}

// Re-fit and redraw at most once per frame, whatever triggered it.
let wireQueued = false;
function queueWires() {
  if (wireQueued) return;
  wireQueued = true;
  requestAnimationFrame(() => {
    wireQueued = false;
    fitTable();
    drawWires();
  });
}
