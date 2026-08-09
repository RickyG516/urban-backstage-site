FILING DESTINATION: TECH & SYSTEMS / AI & Automation
SOURCE: CLAUDE OUTPUT — Ricky Garner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Spec Mockup — Imagery Baseline v3
Set 2026-08-04. Supersedes the "minimum 4 photos, stock as last resort" rule
in spec-mockup-engine v2 Step 3. Fold this into the skill.

## The rule

**Cap real photos at 3 per page. Every page carries at least one generated
animated asset.** Stock photography is retired — it is manufactured sameness,
and sameness is the exact failure mode the engine exists to prevent.

Image budget per page: up to 3 real photos + 1 or more generated assets = 4 minimum.

## Why the old rule broke

Real-photo yield across the first 10 prospects was ~25%. Four of nine had no
Google Business Profile at all. Of those that did, the median gallery was 3
photos and included non-job content.

**Worse: three of the first ten had a COMPETITOR's branding inside their own
GBP gallery.**
- AFG Concrete — an "Antonio Concrete" storefront sign
- Certified Pest Control — an "Atomic Pest Control" storefront, the only real
  photo in their gallery
- Greg Wirth Electric — a "Haupert Electric" van complete with their phone and
  email, plus a "Dave Pitz Electric Co" building

Also found: a septic company's truck, restaurant selfies, a personal headshot,
reviewer avatar tiles, and a pet bearded dragon.

**Never bulk-harvest. Every photo gets looked at before it ships.**

## Identity gate — two levels

1. **Business level.** Name + city + phone must all match the mockup before
   any photo is taken. Google Maps fuzzy-matches hard: searching "Borer
   Contracting LLC Nevada Iowa" returned "Bortec Inc," a drilling contractor
   in another town.
2. **Photo level.** Render every candidate into a numbered grid, screenshot
   it, and reject anything showing another company's name, vehicle, signage,
   or crew.

## Generated asset patterns that work

- **Certified Pest (P01)** — "treated perimeter": house outline, concentric
  barrier rings, speck field dense outside and absent inside. Composition
  seeded off the business phone number, so it is deterministic and unique.
- **Dan Gorman (P13)** — "build sequence": 22 stroke-dashoffset paths draw a
  gable frame in order — footings, posts, plates, rafters, ridge, king post,
  collar tie, studs, openings, dimension line. 11s loop.

Both double as the trade-specific feature the skill already requires.

## Technical notes

- SVGs referenced via `<img>` **do** run their own CSS animations. They are
  sandboxed: no external resources, and **no webfonts**. Keep text in the HTML
  and let the SVG carry graphics only, or the type falls back to system sans.
- Always include `@media (prefers-reduced-motion: reduce)` inside the SVG.
  Degrade to the finished state, never to an empty frame.
- Hotlinked GBP URLs: `/gps-cs-s/` paths have been reliable. One `/grass-cs/`
  URL timed out at `=w1600-h1200` while others served fine at `=w800`. Format
  does not predict it — **load every URL live before shipping.**
- Verify on the deployed page, not locally. GitHub Pages lags 60-90s.

## Gate changes made

- `no-hero-photo` check repaired — the original used a command substitution
  that captured both branches of an `&&`/`||`, so the check never fired.
- Banned-headline check scoped to `<h1>`/`<h2>` only. Scanning the whole file
  flagged legitimate body prose.
- Known gap: the gate counts `<img>` tags and cannot tell a real photo from a
  generated asset from stock. It should track those three separately.
- Known gap: the portability test ("would this headline still work with
  another business name?") is judgment, not greppable. Gorman shipped with
  "Built Right, In Nevada, Iowa" — not on the literal ban list, but portable
  to any contractor anywhere. Check it by hand.

## Library defect found and fixed

14 of 72 pages rendered with **no hero at all**. Every page carries
`body header:not(.unc-nav){display:none!important}` in the badgefix block, and
those 14 build the hero as `<header class="hero">`. Fixed by excluding `.hero`
from the selector. Any newly generated page must use `<section class="hero">`.

---

## Uniqueness rule (added after Ricky flagged the risk)

**Palette is not variation.** Recolouring one animation per trade would have
shipped 9 identical concrete pages, 9 identical painting pages and 9 identical
roofing pages — the same sameness failure in a new coat.

Trade counts across the 72: roofing 9, painting 9, concrete 9, landscaping 8,
electrical 7, hvac 6, remodel 4, pest 4, flooring 4, tree 3, plumbing 3,
insulation 3, gc 2.

### How it is enforced

`tools/compose.py` assembles a scene from three structural axes:

    SUBJECT  trade geometry — slab, gable, routed run, banded field, radial hub
  x MOTION   draw / flow / rise / sweep / stage / radiate
  x LAYOUT   single / mirror / stack / offset-grid

32-60 families per trade. `assign()` walks that list with a **coprime stride**
so consecutive pages in a trade share no subject, no motion and no layout.
Sequential walking was tried first and clustered four concrete pages onto
`run/sweep` varying only by layout — visibly siblings. The stride fixed it.

Within a family, `variants.Vary` adds seeded jitter off the phone number:
anchor, mirror, density, element counts, rotation, motion speed and stagger.

### The check

`variants.fingerprint()` hashes geometry and timing while ignoring colour.
`assert_unique()` fails a batch if any two pages match.

**Verified across all 72: 72 unique fingerprints, 0 family reuse in any trade.**

Run it before every batch. Do not trust it by eye.

### Bespoke beats generated

The first nine pages carry hand-authored scenes — pest perimeter, framing
blueprint, HVAC load curve, concrete pour-and-screed, electrical panel current,
pipe flow with valve and gauge, insulation heat barrier, GC phase timeline,
remodel floor plan. Those are better than anything the grammar produces and
stay as they are. The grammar exists to hold the line across the remaining 59
at volume, not to replace hand work where hand work already happened.

---

## Hero framing rules (learned the hard way on Hartwig)

1. **Author heroes wide.** A 1200x900 asset in a ~2.4:1 hero slot loses the top
   and bottom third to `object-fit:cover`. Hartwig's valve sat half under the
   nav; the pressure gauge was cropped off entirely. Each generated hero now
   ships a `motion-hero.svg` — same coordinate space, same animation, viewBox
   re-cut to a wide slice so there is nothing to crop. The 4:3 `motion.svg`
   stays for gallery tiles.
2. **Keep the middle third clear.** Hero copy is centre-stacked. Dense geometry
   directly behind the headline or eyebrow chip fights the type. Shift the
   frame so the busiest element sits in an outer third, and alternate the
   direction between pages so a batch doesn't all lean the same way.
3. **Base strokes need to read.** Flow dashes over a 0.16-opacity pipe look
   like floating specks, not water in a pipe. Body strokes at 0.30+.
4. **Check for referenced-but-missing assets before shipping.** A batch config
   referenced `shield.svg` on four pages where only `radius` and `texture` had
   been generated. Three good images and one broken icon went live.
   `for src in $(grep -o 'src="[a-z-]*\.svg"' index.html); do [ -f ] || echo` —
   run it every batch.

---

## Palette rule (added 2026-08-09 after Ricky reviewed that day's batch)

Ricky's note on the 2026-08-09 batch: the pages "looked a lot like our own website
style and colors." He was right, and the library proved it. Measured across the
113 accents live at that moment:

    orange             42.5%
    warm overall       62%     (orange + amber/tan + red)
    warm + green       78%
    cool               20%
    true grey/neutral  0%
    dark backgrounds   100%    (--dark lightness 7-16% on every page)

UNC brand orange `#e36b1e` sits at hue 23 — dead centre of the dominant band.
"Dark hero + warm glow" **is** the UNC house style, so every mockup inherited it.
Palette is not variation (see the uniqueness rule above); neither is a warm accent
on a near-black hero, repeated 113 times.

### Stage 1 — DONE. `tools/palettes.py`

A curated 22-palette pool of `(dark, accent, off)` triples across seven bands:
blue 5, grey 4, red 4, teal 3, green 2, violet 2, **warm 2 (capped on purpose)**.

- `pick_batch(n, root=...)` returns n palettes with **n distinct bands**, ordered
  by which band is most under-represented in the live library. Variety is enforced
  by the tool, not left to whoever runs the batch. Picking purely by
  "least-represented" stacked four greys in a row on the first try — that is just
  a new flavour of the same failure, hence the distinct-band rule.
- `audit()` fails any palette that uses UNC orange, or whose accent does not clear
  **3.0:1 on the dark hero** and **4.5:1 for dark text sitting on the accent**
  (the template paints the accent both ways — `.kick`/`h1 span` on dark, and dark
  text on `.btn`/`.call`). Four reds failed this on the first pass and were
  lightened until they passed. Run `python3 tools/palettes.py` — it exits non-zero
  on any problem.
- Every pool accent was checked against the live library; none collide.

This changes `--dark` and `--off` as well as the accent, so backgrounds move
through navy, graphite, gunmetal, oxblood-black and petrol rather than sitting on
near-black every time. **No template change — `dark`, `accent` and `off` were
already parameters of `build(d)`.** Nothing in the battle-tested generator was
rewritten.

### Stage 2 — NOT BUILT. Do not skip it.

Stage 1 widens colour *inside* a dark hero. It does not fix the thing that
actually makes these read as UNC: **100% of pages are dark-hero.** Even a blue
accent leaves the same silhouette.

Stage 2 adds a scheme axis to `new_page.py`:

    DARK    near-black hero (current — keep, it works)
    SLATE   deep blue-grey / charcoal hero
    LIGHT   white or off-white hero, dark type
    MONO    greyscale + one restrained accent

Ricky explicitly asked for white and greys. Those need LIGHT/MONO, which needs the
hero, nav and section-contrast rules to flip — a real template change, to be made
*alongside* the existing dark path rather than replacing it. Approved as separate,
staged work on 2026-08-09.

### Applies from the next batch onward

The 2026-08-09 batch (EZ Roofing, Freiburger, Seward) shipped on the old palette
and was deliberately left alone — Ricky was dialling it that morning and a page
should not change under a prospect mid-outreach.
