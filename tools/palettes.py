#!/usr/bin/env python3
"""Curated colour palettes for spec mockups — stage 1 of the palette widening.

WHY THIS EXISTS
Ricky reviewed the 2026-08-09 batch and said the pages read as Urban Niche Co.'s
own site rather than the prospect's. He was right, and the library proves it:

    orange            42.5%  of 113 accents
    warm overall      62%    (orange + amber/tan + red)
    warm + green      78%
    cool              20%
    true grey/neutral 0%
    dark backgrounds  100%   (--dark lightness 7-16% on every single page)

UNC brand orange #e36b1e sits at hue 23 — dead centre of the dominant band. So
"dark hero + warm glow" IS the house style, and every mockup inherited it.

STAGE 1 (this file): widen accent + background colour inside the existing dark
hero. No template change, no risk to the battle-tested generator.

STAGE 2 (NOT BUILT YET): add LIGHT / WHITE / MONO hero schemes to new_page.py so
the all-dark silhouette itself is broken. That is the change that actually fixes
the sameness. Ricky approved it as separate, staged work — do not skip it and do
not pretend stage 1 replaces it.

USAGE
    import palettes
    p = palettes.pick(trade="roofing", used_accents=palettes.library_accents(ROOT))
    # -> {"name":..., "dark":..., "accent":..., "off":..., "band":...}

pick() deliberately favours the band that is most UNDER-represented in the library
so variety is enforced by the tool, not left to whoever is running the batch.
"""
import re, glob, os, colorsys, collections

# --- hard bans -------------------------------------------------------------
UNC_ORANGE = "#e36b1e"          # gate.sh fails any page containing this

# --- the pool --------------------------------------------------------------
# accent lightness is kept in the 40-65% range: the template paints dark text ON
# the accent (.btn, .call) and accent text ON the dark hero (.kick, h1 span), so
# it has to work in both directions.
PALETTES = [
    # ---- blue ----
    dict(name="steel-blue",     dark="#0f141b", accent="#4a90c4", off="#f1f4f7", band="blue"),
    dict(name="deep-indigo",    dark="#101320", accent="#6a86d6", off="#f3f3f8", band="blue"),
    dict(name="harbour",        dark="#0d1519", accent="#3f8fb5", off="#f0f5f7", band="blue"),
    dict(name="cobalt-night",   dark="#0e1118", accent="#5b8fe0", off="#f2f4f9", band="blue"),
    dict(name="denim",          dark="#12161c", accent="#5d87a8", off="#f2f4f6", band="blue"),
    # ---- grey / neutral (library had ZERO of these) ----
    dict(name="graphite",       dark="#141517", accent="#9aa3ad", off="#f5f5f6", band="grey"),
    dict(name="gunmetal",       dark="#111315", accent="#8d969c", off="#f4f5f5", band="grey"),
    dict(name="concrete-grey",  dark="#16171a", accent="#a8a49c", off="#f6f5f3", band="grey"),
    dict(name="silver-edge",    dark="#101112", accent="#b4bcc2", off="#f5f6f7", band="grey"),
    # ---- red / crimson ----
    dict(name="oxblood",        dark="#171113", accent="#c46267", off="#f7f3f3", band="red"),
    dict(name="signal-red",     dark="#131315", accent="#ce5b5d", off="#f6f4f4", band="red"),
    dict(name="brick-crimson",  dark="#15100f", accent="#bf635c", off="#f7f4f2", band="red"),
    dict(name="rust-iron",      dark="#141110", accent="#bf6652", off="#f6f4f2", band="red"),
    # ---- teal / cyan ----
    dict(name="slate-teal",     dark="#0f1618", accent="#3f9d9d", off="#f0f6f6", band="teal"),
    dict(name="deep-lagoon",    dark="#0d1417", accent="#4bb0ac", off="#f1f6f6", band="teal"),
    dict(name="petrol",         dark="#101617", accent="#59a5a8", off="#f2f6f6", band="teal"),
    # ---- cool green ----
    dict(name="pine-cool",      dark="#0f1512", accent="#4f9e6d", off="#f2f6f3", band="green"),
    dict(name="moss-slate",     dark="#121513", accent="#6f9b62", off="#f4f6f3", band="green"),
    # ---- violet ----
    dict(name="plum-slate",     dark="#141019", accent="#8f6fc0", off="#f5f3f8", band="violet"),
    dict(name="mauve-iron",     dark="#15121a", accent="#a07ab0", off="#f6f4f7", band="violet"),
    # ---- warm: deliberately capped, the library is already 62% warm ----
    dict(name="amber-restraint", dark="#16130f", accent="#d6a851", off="#f6f4f0", band="warm"),
    dict(name="ember",           dark="#151110", accent="#c2673a", off="#f6f3f1", band="warm"),
]

# How much of the pool each band may occupy on FUTURE batches. Warm is capped
# hard because the existing library is already 62% warm.
BAND_CEILING = {"warm": 0.15}


def _hls(hexcol):
    r, g, b = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return colorsys.rgb_to_hls(r, g, b)


def band_of(hexcol):
    h, l, s = _hls(hexcol)
    h *= 360; s *= 100
    if s < 12:                 return "grey"
    if h < 15 or h >= 345:     return "red"
    if h < 45:                 return "warm"
    if h < 70:                 return "warm"
    if h < 170:                return "green"
    if h < 200:                return "teal"
    if h < 255:                return "blue"
    if h < 290:                return "violet"
    return "violet"


def library_accents(root):
    """Every accent already used in demo/, lowercased."""
    out = set()
    for f in glob.glob(os.path.join(root, "demo", "*", "index.html")):
        m = re.search(r"accent:\s*(#[0-9a-fA-F]{6})", open(f, encoding="utf-8").read()[:400])
        if m:
            out.add(m.group(1).lower())
    return out


def library_bands(root):
    return collections.Counter(band_of(a) for a in library_accents(root))


def pick(trade=None, used_accents=(), used_names=(), root=None, avoid_bands=()):
    """Return the palette from the least-represented band that is not yet used.

    Variety is enforced here rather than left to judgement — that is the whole
    point. Warm is skipped unless nothing else is left.
    """
    used = {a.lower() for a in used_accents}
    if root:
        used |= library_accents(root)
    counts = library_bands(root) if root else collections.Counter()

    cands = [p for p in PALETTES
             if p["accent"].lower() not in used
             and p["name"] not in set(used_names)
             and p["band"] not in set(avoid_bands)]
    if not cands:
        raise ValueError("palette pool exhausted — add more entries to PALETTES")

    # least-represented band first; warm always sorts last
    cands.sort(key=lambda p: (p["band"] == "warm", counts.get(p["band"], 0), p["name"]))
    return dict(cands[0])


def pick_batch(n, root=None, used_accents=(), avoid_bands=()):
    """Pick n palettes for one batch, forcing n DISTINCT colour bands.

    Picking purely by "least represented" stacks four greys in a row, which is
    just a new flavour of the sameness this whole exercise exists to kill.
    Distinct bands per batch is the rule.
    """
    out, names, bands = [], [], list(avoid_bands)
    for _ in range(n):
        p = pick(root=root, used_accents=used_accents, used_names=names, avoid_bands=bands)
        out.append(p); names.append(p["name"]); bands.append(p["band"])
    return out


def contrast(fg, bg):
    """WCAG contrast ratio — used to prove an accent works both directions."""
    def lum(c):
        ch = []
        for i in (1, 3, 5):
            v = int(c[i:i + 2], 16) / 255
            ch.append(v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4)
        return .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2]
    a, b = lum(fg), lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + .05) / (lo + .05)


def audit():
    """Self-check: no UNC orange, every accent readable both ways."""
    problems = []
    for p in PALETTES:
        if p["accent"].lower() == UNC_ORANGE:
            problems.append(f"{p['name']}: uses UNC brand orange")
        on_dark = contrast(p["accent"], p["dark"])
        dark_on = contrast(p["dark"], p["accent"])
        if on_dark < 3.0:
            problems.append(f"{p['name']}: accent on dark only {on_dark:.1f}:1 (need 3.0)")
        if dark_on < 4.5:
            problems.append(f"{p['name']}: dark text on accent only {dark_on:.1f}:1 (need 4.5)")
    return problems


if __name__ == "__main__":
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    probs = audit()
    print("palette audit:", "clean" if not probs else "PROBLEMS")
    for p in probs:
        print("  -", p)
    print(f"\npool: {len(PALETTES)} palettes")
    print("pool by band:", dict(collections.Counter(p["band"] for p in PALETTES)))
    print("\nlibrary today by band:", dict(library_bands(root)))
    print("\nnext batch of 3 (distinct bands enforced):")
    for i, p in enumerate(pick_batch(3, root=root), 1):
        print(f"  {i}. {p['name']:16s} {p['band']:6s} accent {p['accent']}  dark {p['dark']}  off {p['off']}")
    print("\nfollowing batch of 3:")
    seen = [x["band"] for x in pick_batch(3, root=root)]
    for i, p in enumerate(pick_batch(3, root=root, avoid_bands=seen), 1):
        print(f"  {i}. {p['name']:16s} {p['band']:6s} accent {p['accent']}  dark {p['dark']}  off {p['off']}")
    sys.exit(1 if probs else 0)
