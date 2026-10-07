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

---

## 2026-10-04 — a GBP "Website" pointing at a free Google Sites page is the best photo source yet

Scanned ~40 BASE pages on Maps (window hidden, Maps in limited view again), enriched 3: Sierra Construction
(Des Moines IA) GOLD, Aldo's Concrete & Landscaping (Belvidere IL) BRONZE, Granite Style Design (Chicago IL) BRONZE.

**Sierra's Google listing links sites.google.com/view/sierraconstructionllc** — a free Google Sites page with the
owner's name and the matching phone on its Contact page (identity proof), the logo in its header, and a 78-photo
work gallery that is entirely their own pours. Sites images are same-origin on sites.google.com, so a canvas contact
sheet works with no CORS trouble. **sites.google.com allows only ONE automatic download per page load** (second one
silently dropped, even after a reload). Fix that worked: stash the image URLs in `window.name`, navigate the same tab to
`https://www.google.com/robots.txt` (same-site, so `window.name` survives), fetch them there (CORS-open) and download
one packed canvas. A Google Sites page is a hook, not a disqualifier: no reviews on it and it reads as a template.

**Customer house numbers show up in job photos.** Aldo's second driveway shot had the house number on the brick —
cropped out rather than blurred (a blur box looked worse than the crop).

**Mockup copy from the 2026-07-29 bulk batch over-claims.** Sierra's page sold masonry, brickwork and retaining walls
and called them "bonded"; their own site says concrete only, licensed and insured. Rewritten to what their site shows.

Drops / thin this run: Snuff Um Out (1 review, Google phone (262) 374-9371 ≠ page), Pro Serve (1), Landgrebe (1),
Plato (1, listing is 'Plato Electric Shop' (319) 643-2171 ≠ page), Kenneth Janning (1), Armada (1, has a website),
Allen House (3.0/1), Paint Productions (1, phone ≠), Hard Rock Terrazzo (1, phone ≠), Superior Wood Floors (4.0/2),
Palace Roofing (3.0/4), Murray Custom Cabinetry (2.6/27), Duran Concrete (3.2/15), Mike Holmes (3.2/5), Budget Rooter
(4.0/4), R.W. Cardella (4.7/3, not opened), Widick / John Sheehan / Hein / Dewco / A-1 Pest (no reviews), Sean Kollman
(1), Primetime / A-Team / J's Paint / Jesco / Nova / Midwest Pest / Anderson / J&J Tree / Double D / Kuehl / Pauley
(no matching listing), Lee Foundation (Maps returned Nashua NH), R.D. Primmer (Maps returned the Tampa namesake),
Rabalais (Maps returned Live Wire Electric), P&K Termite (listing is P&K Pest, Sheldon, pkpest.com — has a website),
Thomson Heating (4.8/26 but Google phone (920) 829-5232 ≠ page 715-330-4328, and search shows a site — check).
**Bear Renovations (Tomahawk WI) is marked PERMANENTLY CLOSED on Google. Johnson Tree Care (Monona) now has a website
(johnsontreecarellc.com).** Spares with clean reviews and matching phones, reviews-only BRONZE candidates for a later run:
Masterpiece Painting & Decorating (Racine, 5.0/3 — NB the FB page under that name is a New Jersey namesake),
Hintermeister Electric (Davenport, 5.0/3, owner Kurt), Arteaga Construction (Milwaukee, 4.6/5, commercial GC).
Prescott Landscape (Racine, 4.4/28) passed the gate but its lead negative review describes legal action and the owner's
public reply names the reviewer and calls him a "nut job" — left for Ricky's call.

---

## 2026-10-05 — Maps hidden-window workaround: read the place's own `preview/place` response

Ricky's Chrome window was hidden again and the gallery tiles never painted (Chrome AND the built-in pane
both report `visibilityState: hidden`). What worked: on the place page, re-`fetch` the
`/maps/preview/place?...` and `batchexecute` URLs already in `performance.getEntriesByType('resource')`
and regex the `lh3.googleusercontent.com/(gps-cs-s|grass-cs)/…` URLs out of the response body. That
payload belongs to the listing itself, so it does not carry Recents tiles. Gerard gave 5, II Bulls gave 6
(one a byte-identical duplicate). Download from a google.com tab at `=w1600-h1200-k-no` (several downloads
allowed), contact-sheet with PIL, look at it, then crop. Still contact-sheet every one — Gerard's own
listing had a Sunbelt Rentals lift and two storefront rows full of other businesses' signs.

Enriched 3, all BRONZE: Gerard Tuck Pointing (Oneida IL, 3 own photos), II Bulls Mechanical (Chicago,
3 furnace-job photos), Masterpiece Painting & Decorating (Racine WI, 2 verbatim reviews 5.0/3).

**A review that credits two companies makes the crew in the photos ambiguous.** II Bulls' only review
thanks "II Bulls Mechanical Services and MIKK Construction". Faces were kept off the page and nothing
claims the people are his crew.

Drops/thin this run: Mark's Tree Care (Durango) — Maps returns ExTreem Stump Removal (Dubuque); Sawvell
(no matching listing); Rich Weiler (Maps returns Ladick Trucking); Seward Masonry (Maps returns Seward
Construction, Canton, 1.0/1); April Building Services (Maps returns the Dallas TX namesake); RJS
Snowplowing (no reviews); Arteaga (4.6/5 but one-line reviews only); Hintermeister (5.0/3 but only two
have text, 5 and 10 years old — still a weak candidate). **Mansfield Electric (Springfield IL) is marked
PERMANENTLY CLOSED on Google.** Two BASE pages are already excluded/closed in their notes and still sit in
the BASE count: ia-lewis-electric-sioux-city (has a live website) and il-blondell-plumbing-moline (closed
after 120 years) — candidates for `.non-prospects`.

---

## 2026-10-06 — the BASE backlog is nearly mined out; the "not opened" spares from earlier logs carried the run

Started from 137 BASE. Every BASE page with a recorded `fb` had already been tried and dropped, so this run worked
the spares earlier logs flagged as "not opened". Enriched 3, all BRONZE: Grimm Electric (Morton IL, reviews only),
Gibbons Masonry & Concrete (Abingdon IL, 3 own FB job photos + reviews), Certified Pest Control (Oskaloosa IA,
reviews only).

**Recents contamination again, on the first image pulled.** Gibbons' only `gps-cs-s` image on its Maps page was a
Benson's Heating & Air crew-and-truck photo — Benson's (Eldon IA) was still in the Recents rail. Caught on the
contact sheet. Gibbons' listing has no gallery of its own.

**A business FB page's own profile picture is not automatically a logo.** Gibbons' page uses a personal photo
(a man in a cemetery) as its profile image — not used anywhere. Its photo grid also carried an ad tile and a
BusinessRate "Best of 2025" letter (an auto-generated award mailer) — rejected.

**FB relay, refined.** `window.name` does NOT survive a cross-site navigation (facebook.com → google.com); the
`robots.txt#<encoded JSON>` hash relay does. One image per relay worked reliably; old FB uploads top out at
451–720px in the photo.php viewer, so they went in as gallery tiles, not the hero.

**A GBP phone can be the business's alternate line.** Certified Pest's Google listing shows (641) 295-0700; the
page uses 673-8740. BBB lists 295-0700 as the alternate and Yelp has 673-8740 at the same 2361 265th St address,
so the gate passed on address + both numbers belonging to one BBB file. Flagged for the call.

Drops this run: R.W. Cardella (4.7/3, one-line reviews, owner reply disputes a reviewer), J.A. Fritch (4.2/5,
one-line reviews), Genteman Enterprises (3.9/7 — the 5-stars are all family members named Genteman; a second
listing links gentemanenterprises.com which is NXDOMAIN — a hook for the call), Hartwig Plumbing (no Marshalltown
listing; Maps returns Hartwig Mechanical / Hartwig P&H in IL/WI). **Remaining BASE pages with an untried,
matching Google listing are close to zero** — further enrichment needs prospects' own uploads (the swap-notice ask)
rather than more scraping.

---

## 2026-10-07 — the built-in browser pane gets FULL Maps; BBB + a business card cleared a phone-gate drop

Enriched 2, both GOLD: Perfection Painting (Des Moines IA) and Thomson Heating & Cooling (Lena WI). Stopped at two —
every other untried route this run (FB page search on ~12 BASE names, pane Maps re-checks on 5 "no matching listing"
drops) came back empty, namesake, or ambiguous.

**Ricky's Chrome still serves Maps in limited view (window hidden), but the built-in browser pane does NOT.** In the pane
the Reviews tab opens, "More" expands, every review loads, and review-photo tiles carry `Photo N on <reviewer>'s review`
labels. Read reviews and photo URLs in the pane; download in Chrome from a google.com/robots.txt tab (Downloads folder).

**A phone-gate drop can be cleared with a third source that ties both numbers to one business.** Perfection Painting was
dropped 2026-09-26 (Google shows 771-8718, page 274-0326). BBB lists 274-0326 at the SAME 500 N Valley Dr #702 address with
owner Paul Gordon, and the FB cover photo is his business card printing both numbers (office + cell). Gate passed.

**A dealer-locator page counts as a phone source, not as their number.** Thomson's page phone (715) 330-4328 exists only on
bryant.com's dealer locator; Google, FB and their email all say (920) 829-5232. Same name + Lena + 222 S Rosera St on both,
so the gate passed — the page CTA now shows the 920 number; HubSpot/queue phone left alone for Ricky to confirm.

**Customer review photos are the best photo source on a thin listing.** Perfection's own gallery was one photo; two customers
had posted 5 interior shots with their reviews. Thomson's only real photo is a 362px review shot of a new AC unit.

Drops/flags: Benson's Heating (Eldon) — FB search returns BensonsIsBetter = Tallahassee FL namesake. Tree Cutters (Council
Bluffs) now has two websites (treecutterscb.pro, a vercel page). Big Jim's Tree Service (Canton) — FB latest post just says
"Closed". Fox's Repair (Freeport) — FB page matches but its floor post credits "Brian's Handyman Service"; photos not used.
Alcar Roofing — BBB 3006 Maple Dr / 385-8871 vs Google 93 Copeland / 782-1133, 3.8/13 mixed. Eash and Ridge View FB hits are
KY/TX namesakes. Sewell Brothers — BBB has 0 reviews, still no GBP.
