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
    # ---- added 2026-08-26: pool was EXHAUSTED (all 22 originals live in demo/),
    # so pick_batch(3) raised "palette pool exhausted". These extend the same
    # bands the library is thinnest in (grey 4, violet 5, blue 15) plus spares.
    # Every one checked against the 136 live accents and against audit().
    dict(name="iron-fog",       dark="#131518", accent="#96a1ab", off="#f4f5f6", band="grey"),
    dict(name="ash-pewter",     dark="#121416", accent="#8b949b", off="#f4f5f5", band="grey"),
    dict(name="amethyst-slate", dark="#12101a", accent="#9a7ac9", off="#f4f3f8", band="violet"),
    dict(name="orchid-iron",    dark="#141019", accent="#b07fc6", off="#f6f4f8", band="violet"),
    dict(name="azure-steel",    dark="#0e1419", accent="#4f9fd1", off="#f0f4f7", band="blue"),
    dict(name="slate-sapphire", dark="#0f121a", accent="#7093d4", off="#f2f3f8", band="blue"),
    dict(name="kelp",           dark="#0f1412", accent="#5aa47a", off="#f1f5f2", band="green"),
    dict(name="garnet-iron",    dark="#161112", accent="#cc6f74", off="#f7f3f4", band="red"),
    # ---- added 2026-08-30: pool EXHAUSTED again (29 of 30 already live in
    # demo/, garnet-iron the only survivor), so pick_batch(3) raised "palette
    # pool exhausted" for the second time. Same fix as 08-26, same discipline:
    # extend the bands the library is thinnest in (grey 6, violet 7, teal 16,
    # blue 17, green 21) and add NOTHING warm - the library is still 59/143
    # warm. Every accent checked against the 146 live accents (no collision)
    # and against audit().
    dict(name="tungsten",       dark="#121417", accent="#9ba5ac", off="#f4f5f6", band="grey"),
    dict(name="slate-ash",      dark="#141618", accent="#939ea6", off="#f4f5f6", band="grey"),
    dict(name="iris-iron",      dark="#131019", accent="#8d78c4", off="#f4f3f8", band="violet"),
    dict(name="wisteria-dusk",  dark="#151119", accent="#a586c8", off="#f6f4f8", band="violet"),
    dict(name="lilac-graphite", dark="#12111a", accent="#9c8ad0", off="#f5f4f9", band="violet"),
    dict(name="cyan-slate",     dark="#0e1517", accent="#45a6ad", off="#f1f6f6", band="teal"),
    dict(name="verdigris",      dark="#101718", accent="#4fb2ab", off="#f1f6f6", band="teal"),
    dict(name="tidewater",      dark="#0f1618", accent="#62aeb0", off="#f2f6f7", band="teal"),
    dict(name="glacier-blue",   dark="#0d1218", accent="#5aa3d8", off="#f1f4f8", band="blue"),
    dict(name="prussian",       dark="#0e1219", accent="#5f93cc", off="#f1f4f8", band="blue"),
    dict(name="fern-slate",     dark="#0e1411", accent="#68a97e", off="#f2f6f3", band="green"),
    dict(name="sage-iron",      dark="#111412", accent="#7ba883", off="#f3f6f4", band="green"),
    # ---- added 2026-09-05: pool EXHAUSTED for the THIRD time (41 of 42 already
    # live in demo/, verdigris the only survivor), so pick_batch(3) raised
    # "palette pool exhausted" again. Same fix, same discipline as 08-26 and
    # 08-30: extend only the bands the library is thinnest in - grey 8 and
    # violet 10 against warm 59 - and add NOTHING warm. Every accent checked
    # against the 155 live accents (no collision), against the existing pool,
    # and against audit(). NOTE for whoever hits this a fourth time: the pool
    # is consumed ~1 palette per prospect, so this hand-extension is now a
    # recurring tax. The real fix is Stage 2 (LIGHT/MONO hero schemes), which
    # multiplies the usable space instead of lengthening a flat list.
    dict(name="pewter-mist",      dark="#131517", accent="#a2acb4", off="#f4f5f7", band="grey"),
    dict(name="zinc-slate",       dark="#111416", accent="#8f99a1", off="#f4f5f6", band="grey"),
    dict(name="basalt-grey",      dark="#151618", accent="#9aa0a6", off="#f5f5f6", band="grey"),
    dict(name="heather-iron",     dark="#131019", accent="#9781cd", off="#f5f3f9", band="violet"),
    dict(name="thistle-graphite", dark="#141119", accent="#ab8ad2", off="#f6f4f9", band="violet"),
    dict(name="aquamarine-slate", dark="#0f1617", accent="#4fada6", off="#f1f6f6", band="teal"),
    # ---- added 2026-09-09: pool EXHAUSTED for the FOURTH time (47 of 48 already
    # live in demo/, zinc-slate the only survivor), so pick_batch(3) raised
    # "palette pool exhausted" again. Same fix and same discipline as 08-26,
    # 08-30 and 09-05: extend only the thinnest bands - grey 10, violet 12,
    # red 18, blue 19 against warm 60 - and add NOTHING warm. Every accent
    # checked against the 162 live accents (no collision), against the existing
    # pool, and against audit(). Eight added rather than three so the next few
    # runs do not each pay this tax. STANDING NOTE, now four runs old: the pool
    # burns ~1 palette per prospect, so a flat list will keep running dry. The
    # real fix is Stage 2 (LIGHT / MONO hero schemes), which multiplies the
    # usable space instead of lengthening the list. It is still not built.
    dict(name="nickel",           dark="#121416", accent="#97a0a8", off="#f4f5f6", band="grey"),
    dict(name="dove-iron",        dark="#141517", accent="#a5aeb5", off="#f5f5f7", band="grey"),
    dict(name="mulberry-slate",   dark="#151119", accent="#b183cd", off="#f6f4f9", band="violet"),
    dict(name="carmine-slate",    dark="#151112", accent="#c9666e", off="#f7f3f4", band="red"),
    dict(name="terracotta-iron",  dark="#141110", accent="#c66a60", off="#f7f4f2", band="red"),
    dict(name="rose-graphite",    dark="#161113", accent="#d06c72", off="#f7f4f4", band="red"),
    dict(name="cerulean-iron",    dark="#0e1318", accent="#4c9bcd", off="#f0f4f8", band="blue"),
    dict(name="marine-slate",     dark="#0f131a", accent="#6a90cf", off="#f2f4f9", band="blue"),
    # Teal and green were fully consumed too - the __main__ preview's "following
    # batch of 3" could not find 3 distinct bands until these were added, which
    # is exactly the failure tomorrow's run would have hit. Same checks applied.
    dict(name="seafoam-iron",     dark="#0e1516", accent="#57b0a4", off="#f1f6f6", band="teal"),
    dict(name="teal-shale",       dark="#101617", accent="#3f9fa8", off="#f1f6f7", band="teal"),
    dict(name="lagoon-graphite",  dark="#0f1718", accent="#6ab5b2", off="#f2f7f7", band="teal"),
    dict(name="juniper-slate",    dark="#0f1412", accent="#5fa572", off="#f2f6f3", band="green"),
    # 2026-09-23: pool exhausted again (184 live accents; only 3 unused entries and
    # two of those in the same band, so pick_batch(3) could not find 3 distinct
    # bands). Topped up in the bands the LIVE library is thinnest in - grey 15,
    # violet 16, blue 21 - deliberately not warm, which is still 59. All pass
    # audit() both directions; none collides with a live accent.
    dict(name="pewter-shale",     dark="#121314", accent="#9aa3a8", off="#f3f4f5", band="grey"),
    dict(name="ash-graphite",     dark="#131414", accent="#adb1b0", off="#f4f5f5", band="grey"),
    dict(name="wisteria-iron",    dark="#141119", accent="#a98cd8", off="#f5f3fa", band="violet"),
    dict(name="lilac-shale",      dark="#151219", accent="#c091d8", off="#f7f4fa", band="violet"),
    dict(name="cobalt-shale",     dark="#0d1119", accent="#5f94dd", off="#f1f4fa", band="blue"),
    dict(name="jade-shale",       dark="#0e1513", accent="#4fb089", off="#f1f7f4", band="green"),
    dict(name="mist-teal",        dark="#101718", accent="#5cb8bd", off="#f2f7f7", band="teal"),
    dict(name="cyan-shale",       dark="#0e1618", accent="#49a9bb", off="#f1f6f8", band="teal"),
    dict(name="brick-iron",       dark="#161110", accent="#cf7268", off="#f8f4f3", band="red"),
    dict(name="fern-iron",        dark="#0f1411", accent="#6cb07a", off="#f2f6f3", band="green"),
    dict(name="olive-iron",       dark="#111412", accent="#84ab6b", off="#f4f6f3", band="green"),
    dict(name="emerald-graphite", dark="#0e1311", accent="#4fa886", off="#f1f6f4", band="green"),
    # ---- added 2026-09-19: pool EXHAUSTED for the FIFTH time. 174 live accents
    # against a 62-entry pool and every single pool accent now appears in demo/,
    # so pick() had zero candidates and pick_batch(3) raised "palette pool
    # exhausted". Same fix and same discipline as 08-26, 08-30, 09-05 and 09-09:
    # extend only the thinnest bands - grey 13, violet 13, blue 21, red 21,
    # teal 22, green 24 against warm 60 - and add NOTHING warm. Every accent
    # below was checked against the 174 live accents (no collision), against the
    # existing pool, against band_of() agreement, and against audit()'s 3.0:1
    # hero / 4.5:1 dark-text-on-accent thresholds. Nine added so the next two
    # runs do not each pay this tax.
    # STANDING NOTE, now FIVE runs old and getting louder: the pool burns ~1
    # palette per prospect, so a flat list will keep running dry roughly every
    # third run. The real fix is Stage 2 (LIGHT / MONO hero schemes), which
    # multiplies the usable space instead of lengthening the list. Still not built.
    dict(name="ironstone",        dark="#151617", accent="#a0a7ad", off="#f5f5f6", band="grey"),
    dict(name="flint-grey",       dark="#101113", accent="#949da4", off="#f4f4f6", band="grey"),
    dict(name="amethyst-iron",    dark="#141019", accent="#9c86d4", off="#f5f4f9", band="violet"),
    dict(name="orchid-shale",     dark="#161219", accent="#b58ed6", off="#f7f4f9", band="violet"),
    dict(name="azure-shale",      dark="#0d1217", accent="#57a0d0", off="#f1f4f8", band="blue"),
    dict(name="slate-cobalt",     dark="#0f1219", accent="#6d94d9", off="#f2f4f9", band="blue"),
    dict(name="coral-shale",      dark="#151210", accent="#cf6f61", off="#f7f4f3", band="red"),
    dict(name="verdigris-iron",   dark="#0f1617", accent="#4aa8a0", off="#f1f6f6", band="teal"),
    dict(name="cypress-slate",    dark="#0f1411", accent="#6fae7a", off="#f2f6f3", band="green"),
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
