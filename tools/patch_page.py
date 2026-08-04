#!/usr/bin/env python3
"""Wire generated assets + real photos into a mockup page. Surgical: hero image,
gallery figures, gallery CSS. Nothing else is touched."""
import re, sys, json

HERO_CSS = """
  /* Hero visual — real photo or generated asset. Never stock. */
  .hero-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
    animation:kenburns 24s ease-in-out infinite alternate;}
  @media (prefers-reduced-motion: reduce){.hero-photo{animation:none}}
  @media print{.hero-photo{animation:none;break-inside:avoid}}
"""
KENBURNS = """
  @keyframes kenburns{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.16) translate(-2%,-1.5%)}}
"""
GAL_CSS = """
/* Branded-asset gallery: graphics carry the visual, captions carry the facts. */
.unc-grid figure{aspect-ratio:auto;background:none;border-radius:0}
.unc-grid figure img{aspect-ratio:4/3;height:auto;border-radius:6px;background:%(dark)s}
.unc-grid figure:hover img{transform:none}
.unc-grid figcaption{margin-top:.7rem;font-size:.86rem;line-height:1.45;color:#4a4a46}
.unc-grid figcaption strong{display:block;color:%(ink)s;font-weight:700;margin-bottom:.15rem}
.unc-galnote{max-width:640px;margin:2rem auto 0;padding:1.1rem 1.3rem;border:1px dashed %(acc)s;border-radius:8px;
  opacity:1;font-size:.92rem;line-height:1.55;color:#3a3934;background:%(accfaint)s}
.unc-galnote strong{color:%(acc)s}
@media print{.unc-galnote{border-style:solid}}
"""

def patch(cfg):
    p = f"/root/ubs/demo/{cfg['slug']}/index.html"
    s = open(p).read()
    orig = s

    # ---- 1. hero image -------------------------------------------------
    if 'class="hero-photo"' not in s:
        img = (f'\n  <img class="hero-photo" src="{cfg["hero"]}" alt="{cfg["heroAlt"]}">')
        m = re.search(r'<(section|header) class="hero"[^>]*>', s)
        assert m, "no hero element"
        s = s[:m.end()] + img + s[m.end():]

    # ---- 2. hero CSS ---------------------------------------------------
    if '.hero-photo{' not in s:
        anchor = s.index('</style>')
        add = HERO_CSS + ('' if '@keyframes kenburns' in s else KENBURNS)
        s = s[:anchor] + add + s[anchor:]

    # ---- 3. thin any opaque hero backdrop so the image reads ------------
    for pat, rep in cfg.get('thin', []):
        if pat in s:
            s = s.replace(pat, rep, 1)

    # ---- 4. gallery ----------------------------------------------------
    figs = "".join(
        f'<figure><img src="{f["src"]}" loading="lazy" alt="{f["alt"]}">'
        f'<figcaption><strong>{f["h"]}</strong>{f["p"]}</figcaption></figure>'
        for f in cfg['figures'])
    gm = re.search(r'(<div class="unc-grid">).*?(</div>)(<p class="unc-galnote">).*?(</p>)', s, re.S)
    assert gm, "gallery not found"
    s = s[:gm.start()] + '<div class="unc-grid">' + figs + '</div>' \
        + f'<p class="unc-galnote">{cfg["note"]}</p>' + s[gm.end():]

    # ---- 5. gallery CSS ------------------------------------------------
    key = '@media print{.unc-grid figure{break-inside:avoid}}'
    if key in s and 'Branded-asset gallery' not in s:
        s = s.replace(key, key + "\n" + GAL_CSS % cfg['pal'], 1)

    # ---- 6. optional headline rewrite ----------------------------------
    for a, b in cfg.get('replace', []):
        assert a in s, f"replace target missing: {a[:60]}"
        s = s.replace(a, b, 1)

    assert s != orig, "no change made"
    open(p, 'w').write(s)
    imgs = s.count('<img')
    print(f"{cfg['slug']:42s} imgs={imgs}  unsplash={s.count('unsplash')}")

if __name__ == "__main__":
    for cfg in json.load(open(sys.argv[1])):
        patch(cfg)
