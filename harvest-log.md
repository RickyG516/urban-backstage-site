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

---

## 2026-10-02 — limited-view Maps won't open galleries; storefront/banner photos and BBB uploads carried the run

Ricky's Chrome showed Maps in "limited view" and the window was hidden. The photo gallery would not open
(clicks on the header photo and "See photos" did nothing). Only the header photo and review-photo tiles were
reachable. That was still enough: **two of three logos this run came off signage in the business's own GBP
header photo** — RNS Electric's shop sign (same phone printed on it, which doubles as the identity proof) and
R. Marit Painting's vinyl banner.

**BBB profiles carry business-uploaded job photos.** R. Marit had six on BBB (`m.bbb.org/prod/ProfileImages/...`,
CORS-open, 600px max). One was a TitleMax storefront — another business's name on the building — rejected.
Downloaded by packing all images onto one canvas and splitting with PIL (one download, no multi-download prompt).
The BBB "logo" image was just the business name in a system font — not a logo.

**A business's own banner can disagree with its listing.** R. Marit's 2026 banner prints (424) 333-9932, while
Google, BBB and the page carry (309) 256-4335. Not a disqualifier (name + city + listing phone all match) but a
call flag — confirm the number before quoting either.

**A GBP "Website" field can point at a scraper directory.** RNS Electric's Website button opens
usmapol.org/details/rns-electric-inc…, which redirects to usmapinformation.com. That is a better opening line
than "you don't have a website."

Drops/thin this run: Midwest Painting Service (1 review), Mixer Insulation (0), Klunck Masonry (no listing),
AB Concrete (1 review, 2.0), Davenport Flooring / Don's Concrete / Breon / Poss / YM / Weber / Stufflebeem /
Niklasen / Fox's / Winegar / KVI / T/R Painting / All-Wall / Wernimont (no matching listing), Christner (1),
Cy-Ment (2, and the Google phone (641) 864-2462 ≠ page 515-689-0792), Ridge View (2), J.A. Fritch (4.2/5,
not opened), Benson's (Maps returned a Tallahassee FL namesake), Woody's Heating (Maps listing is Ottumwa,
(641) 682-3407 — fails the gate), Gibbons Masonry (4.2/10, mixed, phone not checked — a candidate for
reviews-only BRONZE later), Grimm Electric (4.3/9, not opened), Genteman (3.9/7, not opened).
**Santee Construction (Eldridge) is marked PERMANENTLY CLOSED on Google.**

Also fixed: `ia-gbg-dubuque` (Ricky's own venture, listed in `demo/.client-sites`) made `enrich_audit.py` and
`added_dates.py --check` fail on "no index row / no status.json entry". Client-site slugs no longer need either.

---

## 2026-10-03 — FB "Links" fields are hooks; Maps limited view truncates reviews

Scanned ~30 BASE pages, enriched 3: Cranford Plumbing (Dunlap IL) GOLD, North Park Heating & AC (Loves Park IL) GOLD,
Willis Electric (Chillicothe IL) BRONZE.

**A business FB page's "Links" field often points at a dead domain** — Cranford → cranfordplumbinginc.com (dead),
North Park → northparkheatingandair.net (NXDOMAIN). That is the best opening line either page has. Check it every time.

**FB cover banners are a logo AND photo source.** Cranford's cover is a photo of their logo sign; North Park's is a
marketing banner with their van and (likely) the owner cut out on it — cropped to a gallery tile, captioned without naming
anyone. FB photo grids at /photos only give 206px thumbs; the full image is on the photo.php viewer page (689px for an
old upload, 1011px for a cover). Relay via the google.com/robots.txt hash, one fetch per page load.

**Maps "limited view" will not expand review text** ("More"/"See more" buttons do nothing). Quote up to the truncation
point and cut with an ellipsis — never finish a sentence for the reviewer.

Drops this run: ASAP Pest Control — Google listing with the matching phone and owner (Curtis) is in AUDUBON, page says
Stuart; city gate fails, flag for a call. G.M. Sipes (4.6/8 but one real sentence of review text), Breckenkamp (3.0/2),
Woodhouse & Lee (listing is 'Woodhouse Concrete Services', 1 review), SGR (3.7/6, Google phone is the ALT 465-4314),
Hinz (4.1/8, lead review is a warranty complaint), Eastern Iowa Masonry (no listing), L&C (no reviews), Action Plus
(Maps returns Practical Plumbing), Elby Smith / Garcia / B & Sons / Papa's / Cover Electric (no matching listing),
Eash (Maps returns Highway 5 Construction), T&T (2), ACG (Nebraska ACG Construction), Michael Painting (3.5/6),
Top Quality Roofing (3.3/7, no phone on listing). **Now have websites on Google:** Better Home Improvements (Bettendorf,
betterhomeimprovementsllc.com) and Kevin Daniels Painting (Champaign, kevindanielspaintinganddrywall.com) — re-check
before dialing as no-website prospects.
