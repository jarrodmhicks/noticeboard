#!/usr/bin/env python3
"""Check prompts.csv against the board. Run:  python3 check_prompts.py

Reports prompts that are too long for the board (or for the optional accent layouts), characters a
tile cannot show, duplicates, and how many prompts start with the same word."""
import csv, re, collections, sys

COLS, ROWS = 14, 6
SENSES = ["hearing", "smell", "taste", "touch", "vision"]
ALIAS = {"sight": "vision"}


def wrap(text, W):
    """The same greedy word wrap as wrap() in js/board.js."""
    words = re.sub(r"[^A-Z0-9 :.\-?!,']", " ", text.replace("‘", "'").replace("’", "'").upper()).split()
    lines, c = [], ""
    for w in words:
        while len(w) > W:
            if c:
                lines.append(c)
                c = ""
            lines.append(w[:W])
            w = w[W:]
        if not c:
            c = w
        elif len(c + " " + w) <= W:
            c += " " + w
        else:
            lines.append(c)
            c = w
    if c:
        lines.append(c)
    return lines


rows = list(csv.reader(open("prompts.csv", encoding="utf-8")))
if rows and rows[0][0].strip().lower() == "sense":
    rows = rows[1:]
prompts, problems = [], []
for n, r in enumerate(rows, start=2):
    if len(r) < 2 or not r[1].strip():
        continue
    s = ALIAS.get(r[0].strip().lower(), r[0].strip().lower())
    t = ",".join(r[1:]).strip()
    if s not in SENSES:
        problems.append(f"line {n}: unknown sense '{r[0]}'")
        continue
    prompts.append((s, t))
    bad = sorted(set(re.sub(r"[A-Z0-9 :.\-?!,']", "", t.upper().replace("‘", "'").replace("’", "'"))))
    if bad:
        problems.append(f"line {n}: characters the board cannot show ({''.join(bad)}): {t}")

print("Prompts per sense:", dict(collections.Counter(s for s, _ in prompts)), "total", len(prompts))

# Layouts: (name, width, most lines it can hold)
print("\nToo long for the plain layout (more than 5 lines at 14 wide), these will be cut off:")
cut = [t for s, t in prompts if len(wrap(t, COLS)) > 5]
print(*(f"  {t}" for t in cut) or ["  none"], sep="\n")

for name, W, mx in [("the line under the word ('rule' / 'tab')", COLS, 4), ("the full frame (these get a frame with no bottom edge)", COLS - 2, 4), ("the stripes ('spine')", COLS - 2, 5)]:
    long = [t for s, t in prompts if len(wrap(t, W)) > mx]
    print(f"\nWon't fit {name}: {len(long)} of {len(prompts)} (they are shown without it):")
    for t in long:
        print(f"  {t}")

dups = [t for t, n in collections.Counter(t.lower() for _, t in prompts).items() if n > 1]
print("\nDuplicates:", dups or "none")
first = collections.Counter(t.split()[0].lower() for _, t in prompts)
print("Most common first words:", first.most_common(5))
lens = [len(t) for _, t in prompts]
print(f"Length in characters: shortest {min(lens)}, longest {max(lens)}, average {sum(lens)/len(lens):.0f}")
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
