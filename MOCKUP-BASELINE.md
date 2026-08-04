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
