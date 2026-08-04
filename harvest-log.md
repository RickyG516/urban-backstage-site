FILING DESTINATION: DELIVERY & OPS / Trackers
SOURCE: CLAUDE OUTPUT — Ricky Garner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Mockup Remediation — Harvest & Build Log
Started 2026-08-04. Repo @ de909e4. Scope: 68 pages (Cremer's excluded per Ricky).

## Standing rules learned on this run

1. **Identity gate.** Business name + city + phone must ALL match the mockup before
   any photo is taken. Google Maps fuzzy-matches hard — it served "Bortec Inc" for
   "Borer Contracting LLC." Wrong city, wrong trade, wrong phone.
2. **Gallery-level identity gate.** A prospect's own GBP gallery can contain photos
   of OTHER companies (user-uploaded). AFG's gallery had a storefront sign reading
   "Antonio Concrete." Never bulk-grab — always eyeball the grid first.
3. **Test every image URL live before shipping it.** Not by format, not by
   assumption — actually load it in a browser. AFG's `/grass-cs/` URL at
   `=w1600-h1200` timed out; Jeff's Tree Service `/grass-cs/` URLs at `=w800` load
   fine. Format alone does not predict it. The size suffix may matter.
4. **Verify on the live deployed page, not locally.** GitHub Pages lags ~60-90s.
   Local file inspection cannot catch a dead hotlink.
5. Reviewer avatar tiles (solid color + single letter) appear in the harvest and
   must be excluded.

## Completed

### 1. ia-afg-concrete-fz9grp — AFG Concrete LLC, Des Moines IA — P13 — ✅ DONE
- Identity: name + addr (207 E Titus Ave) + 5.0/33 reviews confirmed. GBP website
  field reads "facebook.com" — correctly qualified no-site prospect.
- Harvest: 19 URLs. Indices 0-6 `gps-cs-s`, 7-18 `grass-cs`. Excluded index 5
  ("Antonio Concrete" storefront — different company) and 3 reviewer avatars.
- Hero: index 3, crew finishing a large residential slab. P13-correct single photo,
  upscale serif, generous whitespace preserved. Ken Burns moved off the CSS
  gradient onto the photo; added prefers-reduced-motion + print guards.
- Gallery: indices 0 (finished driveway), 6 (pool deck surround), 4 (crew screeding).
- Scrim rebuilt — bright slab was washing out the eyebrow and body copy.
- **Result: 4 images, 100% real, 0 stock, 0 dup URLs, 0 cross-business collisions.**
- Verified live at urbanbackstage.com. All 4 load (1600/1600/1600/600 px).

## Harvest recon (not yet built)

| Slug | Business | GBP? | Photos | Route |
|---|---|---|---|---|
| ia-borer-contracting-5z7f1y | Borer Contracting LLC | NO | 0 | STOCK + headline rewrite |
| ia-bull-west-design-s4t6wm | Bull West Design LLC | NO | 0 | STOCK |
| ia-certified-pest-control-sf35ug | Certified Pest Control | YES | 3 | REAL |
| ia-dolan-concrete-masonry-pm1aag | Dolan Mike Concrete & Masonry | YES | 2 | REAL |

## Open flags for Ricky
- `jeffs-tree-service-sioux-city` uses 4 `grass-cs` URLs. Checked live — they DO
  currently load at `=w800`. Not broken today, but it is the only page in the
  library on that URL family and worth a periodic re-check.
- GBP hit rate running ~60%. Where GBP exists, median photo count is ~3 and
  includes non-job tiles, so real yield per page is 1-3 photos.

---

## Batch 1 complete — 2026-08-04

| Page | Pack | Real photos | Generated | Status |
|---|---|---|---|---|
| ia-afg-concrete-fz9grp | P13 | 3 | — | live |
| ia-certified-pest-control-sf35ug | P01 | 0 | 4 (perimeter, shield, seasonal, radius) | live |
| ia-dan-gorman-construction-tde74u | P13 | 3 | 1 (framing blueprint) | live |
| ia-cordes-heating-cooling-bf6wwp | P13 | 2 | 2 (load curve, shield) | live |
| ia-dolan-concrete-masonry-pm1aag | P14 | 2 | 2 (pour sequence, shield) | live |
| ia-greg-wirth-electric-lucodo | P17 | 1 | 3 (panel current, radius, shield) | live |
| ia-hartwig-plumbing-46ly39 | P01 | 0 | 4 (pipe flow, radius, texture, shield) | live |
| ia-energy-management-network-vjit5t | P09 | 0 | 4 (heat barrier, radius, texture, shield) | live |
| ia-borer-contracting-5z7f1y | P02 | 0 | 4 (phase timeline, radius, texture, shield) | live |
| ia-bull-west-design-s4t6wm | P04 | 0 | 4 (floor plan, radius, texture, shield) | live |

**11 real photos, 0 stock, 28 generated assets. Gate clean on all ten.**

Plus: 14 pages library-wide had no hero at all (badgefix selector) — fixed.
Borer's banned headline rewritten. Gorman's portable headline rewritten.

## Remaining: 59 pages
Tooling is built — `tools/compose.py` + `tools/patch_page.py` turn the rest
into a loop. Uniqueness verified across all 72 before any of it ships.
