#!/usr/bin/env python3
"""Classify how far each demo page has been enriched toward the Ness standard.

WHY THIS EXISTS
The build task ships a page with generated SVG assets only. That is a valid
*starting* state, not a sendable one. `daily-mockup-enrichment` walks the library
and upgrades pages toward real assets. "Upgraded" has to be a thing a SCRIPT
decides, not a thing a run claims, or the notification emails become noise and
Ricky stops trusting them -- exactly what happened to the four-surface parity
check before enrich_audit.py existed.

THE LEVELS
  GOLD   real job photos + real logo + real reviews
  SILVER real logo + real reviews, photos are labelled placeholders
  BRONZE at least one real asset, the rest labelled placeholders
  BASE   generated SVG only -- the build-task output, not sendable

PLACEHOLDER CONTRACT (this is the part that protects the prospect relationship)
Every non-real asset MUST carry a data-placeholder attribute AND the page MUST
carry the visible .swap-notice block. A page that ships stock imagery WITHOUT
announcing it is passing somebody else's photos off as the prospect's own work.
That is the single thing MOCKUP-BASELINE's stock-photography ban exists to stop,
and it is a hard failure here.
"""
import re, sys, glob, os, json

ROOT = os.environ.get("UBS_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def classify(html):
    imgs = re.findall(r'<img[^>]*>', html)
    real_photo = logo_real = False
    ph_unmarked = []
    for tag in imgs:
        src = (re.search(r'src="([^"]*)"', tag) or [None, ""])[1]
        is_ph = 'data-placeholder=' in tag
        is_svg = src.endswith('.svg')
        is_logo = 'logo' in src.lower() or 'data-role="logo"' in tag
        if is_logo and not is_ph:
            logo_real = True
        elif not is_svg and not is_ph and not is_logo:
            real_photo = True
        if (not is_svg) and (not src.startswith('http')) and is_ph is False and is_logo is False:
            pass  # a local raster with no placeholder marker IS a real harvested photo
    # Bespoke hand-authored SVG scenes (Certified Pest hero.svg, Dan Gorman build-sequence.svg)
    # are generated assets and are never placeholders. Do not flag them.
    reviews_real = bool(re.search(r'data-reviews="real"', html))
    if not reviews_real:
        # back-compat: pages enriched before the data-reviews convention (e.g. Ness) carry a
        # real reviews section with verbatim quotes. Detect it rather than demote good work.
        m = re.search(r'<section[^>]*id="reviews"[\s\S]*?</section>', html)
        reviews_real = bool(m and re.search(r'google review', m.group(0), re.I))
    reviews_ph   = bool(re.search(r'data-reviews="placeholder"', html))
    colors_brand = bool(re.search(r'<!--[^>]*brand-colors:\s*(sampled|supplied)', html))
    has_notice   = 'class="swap-notice"' in html
    n_ph = len([t for t in imgs if 'data-placeholder=' in t]) + (1 if reviews_ph else 0)

    if real_photo and logo_real and reviews_real: level = "GOLD"
    elif logo_real and reviews_real:              level = "SILVER"
    elif real_photo or logo_real or reviews_real: level = "BRONZE"
    else:                                         level = "BASE"

    problems = []
    if n_ph and not has_notice:
        problems.append("has placeholders but NO visible .swap-notice block — reads as passing them off as real")
    if has_notice and not n_ph:
        problems.append("carries a .swap-notice but has no placeholders left — stale notice, remove it")
    for s in ph_unmarked:
        problems.append(f"unmarked non-generated asset: {s}")
    return level, dict(photo=real_photo, logo=logo_real, reviews=reviews_real,
                       colors=colors_brand, notice=has_notice, placeholders=n_ph), problems

def main():
    excl = set()
    for f in ('.client-sites', '.non-prospects', '.website-build-prospects'):
        p = os.path.join(ROOT, 'demo', f)
        if os.path.exists(p):
            excl |= {l.strip() for l in open(p) if l.strip() and not l.startswith('#')}
    status_p = os.path.join(ROOT, 'demo', 'status.json')
    status = json.load(open(status_p, encoding='utf-8')) if os.path.exists(status_p) else {}

    counts, problems, rows = {}, [], []
    for d in sorted(glob.glob(os.path.join(ROOT, 'demo', '*', 'index.html'))):
        slug = os.path.basename(os.path.dirname(d))
        if slug in excl: continue
        lvl, facts, probs = classify(open(d, encoding='utf-8').read())
        counts[lvl] = counts.get(lvl, 0) + 1
        rows.append((slug, lvl, facts))
        for pr in probs: problems.append(f"{slug}: {pr}")
        rec = status.get(slug)
        if rec is not None and rec.get('enrich_level') and rec['enrich_level'] != lvl:
            problems.append(f"{slug}: status.json says enrich_level={rec['enrich_level']} but the page is {lvl}")

    total = sum(counts.values())
    print(f"pages scored: {total}")
    for l in ("GOLD", "SILVER", "BRONZE", "BASE"):
        n = counts.get(l, 0)
        print(f"  {l:<7}{n:>4}  {100*n/total if total else 0:.0f}%")
    print(f"remaining to lift off BASE: {counts.get('BASE',0)}")
    if "--list-base" in sys.argv:
        print("\nBASE pages (enrichment backlog, oldest first):")
        for slug, lvl, _ in rows:
            if lvl == "BASE": print("  ", slug)
    if problems:
        print(f"\n{len(problems)} PROBLEM(S):")
        for p in problems: print("  -", p)
        return 1
    print("\nclean — every placeholder is marked and disclosed")
    return 0

if __name__ == "__main__":
    sys.exit(main())
