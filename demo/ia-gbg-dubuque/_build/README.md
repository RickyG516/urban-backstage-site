# GBG Dubuque site build

The site is generated. Edit content/templates in `build.py`, styles in `../assets/site.css`,
behavior in `../assets/site.js`, then rebuild:

    python _build/build.py            # STAGING: noindex, canonicals on urbanbackstage.com/gbg
    python _build/build.py --prod     # PRODUCTION: indexable, canonicals on https://gbgdubuque.com

This folder starts with an underscore so GitHub Pages/Jekyll does not publish it.

## Launch checklist (real SEO only works on its own domain)
urbanbackstage.com is noindexed site-wide (see repo README), so /gbg/ here can never rank.
1. Register gbgdubuque.com and host the contents of this gbg/ folder at its root
   (Netlify is the easiest: the forms are already Netlify Forms-ready).
2. Run `python _build/build.py --prod` and deploy. Check view-source shows `index,follow`.
3. Submit https://gbgdubuque.com/sitemap.xml in Google Search Console and Bing Webmaster Tools.
4. Create and verify the Google Business Profile (service-area business). Use the same name,
   phone and service list as the site. Ideally use a local 563 number on the site and GBP.
5. Replace illustrations with real job photos as they exist; add reviews and real project galleries.
6. Confirm the service-area town list and 30-mile radius in build.py (TOWNS, RADIUS_M).
7. Confirm copy flagged in the handoff (phone-app control claim, cure times, 2027 booking line,
   careers roles) and the info@gbgdubuque.com inbox works.
8. Social profiles: create them with the same name, phone and service list as the site, then put the real URLs in
   the SOCIAL dict at the top of build.py (Facebook, Instagram, Nextdoor, YouTube, Google Business Profile).
   Footer links and schema sameAs appear on the next build. Never add a profile that does not exist yet.
9. After launch: request indexing for the home page and each service page in Search Console, add the site to
   Bing Webmaster Tools, and ask for real reviews on the Google Business Profile once jobs are done.
