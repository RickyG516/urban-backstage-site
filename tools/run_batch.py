#!/usr/bin/env python3
"""Apply the generated-asset treatment to a whole trade at once."""
import re, os, sys, json, subprocess
sys.path.insert(0,"/root/ubs/tools")
import scenes
from variants import Vary

ROOT="/root/ubs"
CAP = {  # truthful, trade-specific captions for the motion panel
 "roofing":("Every roof, same order","Deck, underlayment, courses up, ridge cap last."),
 "painting":("Prep, then paint","The finish is decided before the first coat goes on."),
 "landscaping":("Cut, edge, and detail","Same pattern every visit so the lawn stripes stay clean."),
 "tree":("Take it down in sections","Rigged and lowered, not dropped."),
 "flooring":("Laid to a stagger","Joints offset row to row so the floor reads as one piece."),
}
TEX = {
 "roofing":("Tear-off and re-roof","Old layers off before anything new goes down."),
 "painting":("Interior and exterior","Same crew either side of the door."),
 "landscaping":("Through the season","Spring clean-up, weekly cuts, fall tidy."),
 "tree":("Storm work too","Nights and weekends when one comes down."),
 "flooring":("Wood, tile and vinyl","Whatever the room and the budget call for."),
}

def page_data(slug):
    p=f"{ROOT}/demo/{slug}/index.html"; txt=open(p).read(); head=txt.split("\n",1)[0]
    tr=re.search(r'trade:\s*([a-z-]+)',head).group(1)
    acc=re.search(r'accent:\s*(#[0-9a-fA-F]{6})',head).group(1)
    darks=re.findall(r'--[a-z-]*(?:dark|navy|base|charcoal|ink)[a-z-]*:\s*(#[0-9a-fA-F]{6})',txt[:4000])
    ph=re.search(r'tel:\+?1?(\d{10})',txt)
    reals=[]
    for m in re.finditer(r'src="(https://lh3\.googleusercontent\.com[^"]+)"',txt):
        if m.group(1) not in reals: reals.append(m.group(1))
    return dict(slug=slug,trade=tr,acc=acc,dark=darks[0] if darks else "#1a1c1f",
                seed=int(ph.group(1)) if ph else abs(hash(slug))%10**10, reals=reals, txt=txt, path=p)

def build(slug, variant, city):
    d=page_data(slug); off="#f4f3f0"
    fn=scenes.BUILDERS[d["trade"]]
    try:    svg=fn(d["dark"],d["acc"],off,d["seed"],variant=variant)
    except TypeError: svg=fn(d["dark"],d["acc"],off,d["seed"])
    open(f"{ROOT}/demo/{slug}/motion.svg","w").write(svg)
    wide=svg.replace('viewBox="0 0 1200 900" width="1200" height="900"',
                     'viewBox="60 235 1200 445" width="1200" height="445" preserveAspectRatio="xMidYMid slice"',1)
    open(f"{ROOT}/demo/{slug}/motion-hero.svg","w").write(wide)
    v=Vary(d["seed"],3)
    import gen_assets as G
    open(f"{ROOT}/demo/{slug}/radius.svg","w").write(G.radius(d["dark"],d["acc"],off,d["seed"]))
    open(f"{ROOT}/demo/{slug}/texture.svg","w").write(G.texture(d["dark"],d["acc"],off,d["seed"]))

    reals=d["reals"][:3]
    hero = reals[0] if reals else "motion-hero.svg"
    gal=[]
    for r in reals[1:3]:
        gal.append(dict(src=r,alt=f"Job photo from {slug.split('-',1)[1].replace('-',' ')}",
                        h="From their own profile",p="Pulled off their Google listing."))
    mc=CAP.get(d["trade"],("How the work goes","Same order every job."))
    gal.append(dict(src="motion.svg",alt=f"{d['trade']} process animation",h=mc[0],p=mc[1]))
    if len(gal)<3:
        gal.append(dict(src="radius.svg",alt="Service area radius",
                        h=f"Based in {city.split(',')[0]}" if city else "Local",
                        p=f"{city.split(',')[-1].strip()} and the surrounding towns." if city else "And the towns nearby."))
    if len(gal)<3:
        tc=TEX.get(d["trade"],("What we cover","Straight scope, straight price."))
        gal.append(dict(src="texture.svg",alt="Service pattern",h=tc[0],p=tc[1]))
    return d, hero, gal[:3], bool(reals)

if __name__=="__main__":
    jobs=json.load(open(sys.argv[1]))
    cfgs=[]
    for i,j in enumerate(jobs):
        d,hero,gal,hasreal = build(j["slug"], i, j.get("loc",""))
        cfgs.append(dict(slug=j["slug"], hero=hero,
            heroAlt=(f"Job photo from {j.get('name','this contractor')}" if hasreal
                     else f"Animated {d['trade']} graphic for {j.get('name','this contractor')}"),
            pal=dict(dark=d["dark"], ink=d["dark"], acc=d["acc"], accfaint="rgba(255,255,255,.04)"),
            figures=gal,
            note="<strong>This is where your job photos go.</strong> Send whatever you&rsquo;ve got &mdash; "
                 "trucks, crews, before and afters &mdash; and they&rsquo;re on the page the same week."))
    json.dump(cfgs, open("/tmp/cfg.json","w"), indent=1)
    print(f"prepared {len(cfgs)} page configs")
