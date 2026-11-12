/* ------------------------------------------------------------------
   main.js  -  start-up. Loaded last, after everything it uses.
   ------------------------------------------------------------------ */

build(); // create the empty tile grid
buildButtons();
renderSound();
paintSound();
mkBtn(document.getElementById("copy"), copyLink);
mkBtn(document.getElementById("back"), goBack);
show(rowsFor(null), true); // the opening board, shown without animation
queueWires();

// Keep the cable and tabletop fitted when the layout changes.
window.addEventListener("resize", queueWires);
if (window.ResizeObserver)
  new ResizeObserver(queueWires).observe(document.getElementById("stack"));
if (document.fonts && document.fonts.ready)
  document.fonts.ready.then(queueWires);

// Any touch or key press restarts the idle timer.
["pointerdown", "keydown"].forEach((ev) =>
  document.addEventListener(
    ev,
    () => {
      if (cur) poke();
    },
    { passive: true },
  ),
);

// Editing the address by hand, or using the browser's Back button between links.
window.addEventListener("hashchange", () => {
  if (!fromHash() && location.hash === "") resetBoard();
});

// Load the prompts, then open a shared link if the address contains one.
load()
  .then(fromHash)
  .catch(() => {
    const el = document.getElementById("err");
    el.style.display = "block";
    el.textContent =
      "Couldn't load prompts.csv. If you opened this file directly from your computer, serve the folder instead, for example with python3 -m http.server.";
  });
