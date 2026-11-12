# Notice Board

A split-flap board that shows one small prompt at a time to get people to stop and notice what their senses are doing right now. Press a button for hearing, smell, taste, touch or vision (or the die for a random one) and the board flips to a prompt.

It is plain HTML, CSS and JavaScript. There is no build step, no framework and no dependencies.

## Running it

The page loads `prompts.csv` with `fetch`, which browsers block for files opened straight from disk. Serve the folder instead:

```
python3 -m http.server
```

then open <http://localhost:8000>. On a real host, upload the whole folder as it is.

After deploying, edit the `og:image` and `twitter:image` lines in `index.html` to use the full address, for example `https://psychophyshicks.com/notice/og.png`. Most link previews ignore relative image paths.

## What is in the folder

```
index.html            the page: meta tags, icon sprite, and the markup for board and panel
prompts.csv           the prompts (sense,prompt)
og.png                the image shown when the link is shared
apple-touch-icon.png  the icon for phone home screens

css/
  base.css            colors, the unit system, page layout
  board.css           the board frame and the flip tiles
  panel.css           the control panel, cable, buttons, fader, back and copy keys

js/                   loaded in this order (they share one global scope)
  config.js           the settings you are most likely to change
  util.js             small helpers: storage, hashing, shuffle, CSV parser
  audio.js            sounds, synthesized live
  board.js            the tiles, the flip animation, word wrapping
  prompts.js          loading, dealing, share links, back, idle reset
  cable.js            the tabletop fit and the cable
  controls.js         buttons, fader, back and copy keys, keyboard, vibration
  main.js             start-up
```

## Changing things

**Prompts.** Edit `prompts.csv`. Each row is `sense,prompt`, and the sense is one of `hearing`, `smell`, `taste`, `touch`, `vision` (`sight` is accepted too). Wrap a prompt in double quotes if it contains a comma. A prompt can use up to 4 lines of 14 capital letters once word-wrapped (5 lines if you accept losing the blank row under the sense name). The browser console prints a warning when a prompt is too long.

**Settings.** Everything in `js/config.js`: the idle timeout, phone vibration on or off, the opening message, the grid size and the order of characters the flaps cycle through.

**Share links break if you edit a prompt.** A link looks like `#smell-1nz1v`. The part after the dash is a short hash of the prompt's text, so reordering the CSV is safe, but rewording a prompt gives it a new link.

## How it works

### Everything is sized in one unit

The board and the panel are drawn at a fixed design width of 648 units, and `--u` in `css/base.css` is `100cqw / 648`, one unit being 1/648 of the width of `.stack`. `.stack` is a CSS container (`container-type: inline-size`), so `cqw` means "percent of the stack's width". Every size in the CSS is written as `calc(N * var(--u))`, so the whole device scales like one picture on a phone, a laptop or a TV, and text sizes never fall out of step with the tiles. The board has its own unit `--ub` because its inner width is 572 units.

### The board

The board is a grid of 14 by 6 tiles (`COLS` and `ROWS` in `config.js`). `build()` in `board.js` creates them once. Each tile is a `div.t` with two child halves:

```
div.t                      5:7 aspect ratio, perspective for the 3D flip
  div.h.u                  upper half  - shows the top of the character
  div.h.d                  lower half  - shows the bottom of the character
  ::after                  the thin dark seam across the middle
```

Both halves contain the same character in a `span` that is twice as tall as the half, so the upper half clips to the top of the glyph and the lower half to the bottom. That is the whole trick for the split look.

What a half shows is a **token**: a single character, or `sw:<sense>` for a solid colored swatch (the colored tile next to the sense name, and the rainbow stripe on the opening board). `paint()` turns a token into text or a background color.

#### Deciding what goes where

`rowsFor(item)` turns what should be displayed into six strings of up to 14 characters, one per row:

- With no prompt, it returns the opening message from `config.js`, each row prefixed by one rainbow stripe letter (`a` to `f`) and a space.
- With a prompt, row 1 is `#` plus a space plus the sense name (`#` means "the swatch for the current sense"), then a blank row if there is room, then the prompt split into lines by `wrap()`.

`wrap()` upper-cases the text, swaps curly quotes for straight ones, replaces anything the tiles cannot show with a space, and fills lines greedily without breaking words (a word longer than a row is cut).

`show(rows)` walks those strings character by character, converts each character to a token with `tokenFor()`, and tells the matching tile to go there.

#### The flip

Each tile is sent to its target by `run(tile, target, delay)`:

1. **Ripple.** The delay is `column * 22 ms + row * 60 ms + a random 0 to 60 ms`, so the change sweeps across the board from top-left to bottom-right with a little mess in it, like a real board.
2. **Cycle.** The tile does not jump straight to its target. It steps through the characters before it in the `CH` string, 2 to 7 flips, then lands on the target. Wherever the target sits in the alphabet determines the characters it passes on the way, just as the physical drum would.
3. **Each flip** (`flip()`) is two 55 ms animations built with the Web Animations API:
   - The upper half is repainted with the *new* character. On top of it a temporary flap showing the *old* top half rotates from `rotateX(0)` to `rotateX(-90deg)`, falling forward and out of sight.
   - Then a temporary flap showing the *new* bottom half rotates from `rotateX(90deg)` to `rotateX(0)`, swinging down into place. The lower half is repainted and the flap removed.
   - `backface-visibility: hidden` and the tile's `perspective` give it depth.
4. **Interruptions.** Every tile carries a generation counter (`tok`). Starting a new run increments it, and a flip that is already in progress checks the counter at each step and quietly stops if it is out of date. That is why pressing buttons quickly never leaves a tile showing a half-finished character.

`show()` also writes the board's text into a visually hidden `aria-live` region so screen readers hear each prompt, and `prefers-reduced-motion` makes every tile jump straight to its target.

#### Layout of a prompt screen

Row 1 is one colored tile, a blank tile and the sense name. Then, if the prompt is four lines or fewer, a blank row, then the prompt flush left using the full 14 columns.

### Messages on the board

`flash(text)` shows a short message such as `LINK COPIED` for about two seconds and then flips back to what was there. It is the same `show()` call with a different string, plus a timer (`msgT`) that is cancelled if you press something else in the meantime.

### The panel and the cable

The panel is an ordinary box turned back with `transform: rotateX(16deg)` inside a container with `perspective`, which gives the tabletop look. A CSS transform does not change layout, so the box would still reserve its old, flat height. `fitTable()` in `cable.js` computes how tall the tilted panel really appears (including the front lip) and sets the container to match.

The cable is an SVG path redrawn whenever the layout changes (`queueWires()` batches that to one redraw per frame). `drawWires()` measures where the board's bottom-left corner is and where the panel's left-side port is, and draws a cubic Bezier between them, plus a thin highlight line and a plug at each end.

### Buttons

The six sense buttons are a round dark **well** with a colored **cap** that moves up and down. Pressing adds the class `down`, which shrinks the cap, drops it and dims it. A press always lasts at least 150 ms so a fast tap is still visible.

Because the panel is 3D-transformed, some browsers do not deliver `click` reliably to its children. So `controls.js` finds the pressed button itself, by checking whether the pointer is inside a button's rectangle on `pointerdown` and `pointerup`. The normal `click` handler remains for keyboards and screen readers; a timestamp (`handledAt`) stops one press from being handled twice. Keys 1 to 5 and R also work.

The sound fader is a real `<button role="switch">` with `aria-checked`. The knob slides with CSS alone (`left` changes when `aria-checked` flips). The speaker icons at its ends never change; only the knob moves. The back and copy keys share a helper, `mkBtn()`, which gives them the same press feel.

The icons are engraved looking because of CSS in `.eng`: a darkened version of the sense color, plus two one-pixel drop shadows, light below and dark above, so they look cut into the metal.

### Sound

There are no audio files. `audio.js` builds every sound with the Web Audio API:

- a **flap click** is a 12 ms burst of high-pass-filtered noise, rate-limited to one per 35 ms so 84 tiles do not turn into hiss;
- the **button press** (`thunk`) and **release** (`tick`) are a short filtered noise burst plus a low pitched tone, like a relay; press and release are separate sounds, so holding a button plays only the press, and the release is heard when you let go;
- the back and copy keys use softer versions of the same two sounds (`softThunk`, `softTick`), higher and about half as loud;
- the **sound switch** (`detent`) is two small ticks and plays even when you are switching sound off, so you hear the switch.

Browsers refuse to start audio until the person has touched the page, so `audio()` returns nothing until `navigator.userActivation.hasBeenActive`. The on/off state is remembered in `localStorage`.

### Dealing prompts

Prompts are read from the CSV into `bank`, grouped by sense. Each sense is dealt from a shuffled deck, so you see every prompt once before any repeats, and a reshuffle never starts with the prompt you just saw. The random button deals from all senses at once.

### Share links, copy and back

When a prompt is shown, its link `#sense-id` is written to the address bar with `history.replaceState` (so the browser's Back button is not filled with entries). On load, and on `hashchange`, `fromHash()` finds the prompt and shows it instantly. The copy key copies that link, or the plain address on the opening board, and flashes `LINK COPIED`.

The back key returns one step: it remembers only the state before the latest press (a prompt, or the opening board), so you cannot walk back through history.

### Idle reset

Any pointer or key press restarts a timer (`poke()`). After `IDLE_MINUTES` with no activity the board returns to the opening message and the address bar is cleared.

### Vibration

On Android, `navigator.vibrate(12)` gives a short buzz on press. iOS Safari has no vibrate API, but toggling an `<input type="checkbox" switch>` produces a light haptic tick, so a hidden one is clicked instead. Both only work after a real touch. Set `VIBRATE = false` in `config.js` to turn it off.

### No JavaScript

The tiles are drawn by JavaScript, so a `<noscript>` message in `index.html` says so and repeats the opening line.

## Credits

Icons: [Hugeicons](https://hugeicons.com) (ear, nose, link; MIT), [Carbon](https://carbondesignsystem.com) (tongue; Apache-2.0) and [Phosphor](https://phosphoricons.com) (hand, eye; MIT). The die and the back arrow are hand drawn. Sounds are synthesized in the browser.
