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

---

## 2026-09-27 — the Maps "Recents" sidebar is a photo source you must exclude

Scraping `googleusercontent` images out of a Maps place page picks up the **Recents rail on the
far left** (thumbnails of places viewed earlier in this browser). Its tiles carry the aria-label
`Google Maps`, the same label as the place's own header photo, so the label does not separate them.
On this run a red spider-lift photo surfaced on BOTH Cherry Tree Services (New Berlin WI) and
Blaze Electric (Ladysmith WI) — it was Konfrst Tree Service's photo (Council Bluffs, still in
Recents from the 2026-09-26 run), byte-for-byte the same scene as Konfrst's
`photo-lift-in-canopy.jpg`. A fresh page load does NOT clear it; Recents persists per profile.

**Rule:** only take photos whose aria-label names this listing (`Photo N on <reviewer>'s review`,
`By owner`, `Videos`, the place's own header) and compare any `Google Maps`-labelled tile against the
Recents rail before trusting it. Also on this run: a Cherry review photo carried an "ACE" dump truck
in the background (another company's vehicle) — rejected at zoom, invisible at thumbnail size.

---

## 2026-09-28 — Recents leftovers hit ALL THREE pages, and a hidden Chrome tab can't screenshot

**The Recents rail contaminated every prospect this run.** Conner Cuts pulled Konfrst's red lift photo;
Guttuso pulled Konfrst's lift AND a Cherry Tree Services photo (with Cherry's phone number on it);
Calderon pulled Guttuso's striped lawn AND the Cherry photo. Each listing you open joins the rail and
shows up on the NEXT one as a `Google Maps`-labelled tile. The Recents rule from 2026-09-27 is not an
edge case — it fires every run. Only ship `Google Maps`-labelled tiles you can match to the listing's own
header/`All` thumbnail; prefer `By owner`, `Exterior` and `Photo N on <reviewer>'s review` labels.

**If `document.visibilityState` is `hidden`, screenshots time out** (Ricky's Chrome window was not in
front). Everything else still works: collect URLs in JS, download at `=w1600` from the maps tab
(google.com allows several downloads), build the numbered contact sheet with PIL in bash, and look at it
with the Read tool. That review path is as good as a screenshot grid — use it rather than skipping
photo-level review.

Also: the recorded `fb` for sanders-lawn-care-dubuque is an Ohio business (937 area code) — cleared.
A GBP "Website" field can point at a dead domain (Conner Cuts → NXDOMAIN): that is a better opening line
than "you don't have a website".

---

## 2026-09-29 — no-site prospects mostly have no harvestable profile; scan wide before you dig

The build task picks businesses with no website, and most of them also have a thin or missing
Google listing. This run scanned ~25 BASE pages on Maps before finding three with a matching phone
and 3+ reviews. Two recorded `fb` URLs failed the phone gate (Wisconsin Concrete Restoration, Bart
Pals). **Several "FB pages" are auto-generated `Unofficial Page`s** (Shaffer, Dulin, Kellington) —
0 followers, no posts, stock silhouette. They are not the business's page and never a logo source;
one (Dulin) even carries a different phone number.

**Review photos can carry another company's name too.** Kellington's before/after (from a customer
review) had a water-softener dealer's service sticker on the control head. Cropped out; the plumbing
itself is Kellington's job per the review.

Two recorded FB pages now link LIVE websites (Zaiser's → zaisersgardencenter.com, Four Seasons →
fourseasonsplatteville.com) — no longer no-website prospects. Homestead Services' GBP links
homesteadserv.com, which serves a WordPress "critical error" page — a hook, not a disqualifier.

---

## 2026-09-30 — hidden window: gallery thumbnails never paint; resource timing works, but it also catches Recents

Ricky's Chrome window was in the background again (`visibilityState: hidden`). This time the Maps
photo-gallery thumbnails never loaded at all: `[data-photo-index]` tiles had no image, clicking them
did not advance the viewer URL, and one long click-loop froze the renderer (CDP timeout). What worked:
`performance.getEntriesByType('resource')` lists every `googleusercontent` image the page actually
fetched. Match those against the listing panel's own labelled tiles (`Photo of <business>`, `House`,
`By owner`) by URL tail, then fetch at `=w1600-h1200-k-no` and download from the maps tab.

**Resource timing picks up Recents too.** On The Tile Pro's (Webster City) the third fetched image was
a MARK'S TREE CARE (Rockford IL) truck-and-crew photo, left over from searching that name minutes
earlier. It was unlabelled in the panel, which is why it got a contact-sheet look before anything
shipped. Rule: only ship resource-timing URLs whose tail matches a labelled tile in THIS listing's
panel. Treat anything else as contamination until the contact sheet proves otherwise.

**A storefront sign is a logo source.** Tile Pros has no FB page, but its own GBP gallery has a photo of
the shop sign with the logo AND the matching phone number on it. That one image passed the identity
gate and gave up the logo and the brand colours together.

Also: `enrich_level.py`'s back-compat review detection read placeholder review cards as real because
the cards said "Google review". It now only runs on pages with no `data-reviews` attribute at all.

---

## 2026-10-01 — recorded review counts and phones go stale; re-check them before building copy on them

Scanned 13 BASE pages, enriched 2. **The figures in `status.json` notes are not current facts.**
Chris Ihrig's page headlined "118 reviews, every one five stars" — Google shows **41** (5.0); 118/119 is
Birdeye's cross-platform aggregate. Strong's said 4.9/43 and "A+ BBB" — Google now 4.8/49 and BBB lists them
Not Accredited. Rewrite any count the page leans on from the live profile, not the note.

Drops this run: Tree Cutters (Council Bluffs) GBP phone (712) 208-3436 ≠ page 355-1032; Neuman's Insulation
(Springfield) every directory lists (217) 725-2371 ≠ page 717-9515, and Maps fuzzy-matched Prairie Insulation;
The Roofing Company (Dubuque) GBP phone (563) 495-8746 + a website; **Grind It Up (Cedar Rapids) now has a live
site, grinditupcedarrapids.com — no longer a no-website prospect**; **Vogel Irrigation (Waterloo) is marked
PERMANENTLY CLOSED on Google**; Designed Roofing (Springfield) only one-line reviews. Thin/no profile: BBS Electric,
Switlick, Tobin Bros, McNeal's, Schroeder, Dimmer Bros, Carpet Specialists, Redmond Roofing, Big Jim's (has a website link).

**FB photos carry other companies too, even on the business's own page.** Strong's water-main job: two of the
trench shots show the excavating sub's machine (BAUMHARDT) and a strip mall's signs. Shot-level review caught it.
FB's one-download-per-page limit was handled by packing several images onto one canvas and splitting with PIL,
and by the robots.txt hash relay for the full-size viewer images.
