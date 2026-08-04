#!/usr/bin/env python3
"""
Urban Niche Co. — spec-mockup generated asset library.

One animated SVG per trade. Palette-driven, seeded per business so no two
compositions repeat. Referenced via <img>, so: no webfonts (graphics only,
text lives in the HTML) and prefers-reduced-motion is handled INSIDE each file.
"""
import math, random

W, H = 1200, 900

def _shell(body, defs="", css="", label="", w=W, h=H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" '
            f'height="{h}" role="img" aria-label="{label}"><defs>{defs}</defs><style>{css}'
            '@media (prefers-reduced-motion: reduce){*{animation:none!important}'
            '.dw{stroke-dashoffset:0!important}.fin{opacity:1!important}}'
            f'</style>{body}</svg>')

def _grid(dark, off, step=50, op=0.035):
    return "".join(
        [f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{off}" stroke-width="1" opacity="{op}"/>' for x in range(0, W+1, step)] +
        [f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{off}" stroke-width="1" opacity="{op}"/>' for y in range(0, H+1, step)])

DRAW_CSS = (".dw{stroke-dasharray:100;stroke-dashoffset:100;animation:dw 11s ease-in-out infinite}"
            "@keyframes dw{0%{stroke-dashoffset:100}22%{stroke-dashoffset:0}84%{stroke-dashoffset:0;opacity:1}"
            "95%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:100;opacity:0}}")

def _p(d, delay, w=4, c=None, o=1.0, cls="dw"):
    return (f'<path class="{cls}" d="{d}" pathLength="100" stroke="{c}" stroke-width="{w}" '
            f'opacity="{o}" style="animation-delay:{delay:.2f}s" fill="none" '
            'stroke-linecap="round" stroke-linejoin="round"/>')

# ---------------------------------------------------------------- HVAC
def hvac(dark, acc, off, seed):
    """Seasonal load curve — heating peak, cooling peak, airflow cycling."""
    pts=[]
    for i in range(121):
        t=i/120.0
        y=470 - 210*math.cos(2*math.pi*t) * (1 if t<0.5 else 1)
        y=470 - 200*math.cos(2*math.pi*t)
        pts.append(f"{140+920*t:.1f},{y:.1f}")
    curve="M"+" L".join(pts)
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(f'<line x1="140" y1="470" x2="1060" y2="470" stroke="{off}" stroke-width="2" opacity="0.20"/>')
    for i in range(13):
        x=140+920*i/12
        body.append(f'<line x1="{x:.0f}" y1="462" x2="{x:.0f}" y2="478" stroke="{off}" stroke-width="{2 if i%3==0 else 1}" opacity="{0.35 if i%3==0 else 0.15}"/>')
    body.append(f'<path d="{curve}" fill="none" stroke="{acc}" stroke-width="5" class="dw" pathLength="100" style="animation-delay:.2s" stroke-linecap="round"/>')
    # peak markers
    for cx,cy,lbl in [(140,270,"winter"),(600,670,"summer"),(1060,270,"winter")]:
        body.append(f'<circle class="pk" cx="{cx}" cy="{cy}" r="13" fill="{acc}"/>')
        body.append(f'<circle class="pk" cx="{cx}" cy="{cy}" r="30" fill="none" stroke="{acc}" stroke-width="2.5" opacity=".5"/>')
    # airflow chevrons drifting
    for i in range(7):
        y=150+i*105
        body.append(f'<g class="fl" style="animation-delay:{i*0.42:.2f}s" opacity="0">'
                    f'<path d="M120,{y} l34,22 l-34,22" fill="none" stroke="{acc}" stroke-width="3" opacity=".55" stroke-linecap="round"/></g>')
    css=(DRAW_CSS+
         ".pk{animation:pk 11s ease-in-out infinite;transform-origin:center}"
         "@keyframes pk{0%,25%{opacity:0}40%{opacity:1}84%{opacity:1}95%,100%{opacity:0}}"
         ".fl{animation:fl 3.4s linear infinite}"
         "@keyframes fl{0%{opacity:0;transform:translateX(0)}15%{opacity:.9}"
         "85%{opacity:.9}100%{opacity:0;transform:translateX(940px)}}")
    return _shell("".join(body), css=css, label="Seasonal heating and cooling load curve")

# ---------------------------------------------------------------- CONCRETE
def concrete(dark, acc, off, seed):
    """Form, pour, screed, cure."""
    fx0,fx1,fy0,fy1 = 190, 1010, 380, 660
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(f'<clipPath id="frm"><rect x="{fx0}" y="{fy0}" width="{fx1-fx0}" height="{fy1-fy0}"/></clipPath>')
    # rising pour
    body.append(f'<g clip-path="url(#frm)"><rect class="pour" x="{fx0}" y="{fy0}" width="{fx1-fx0}" height="{fy1-fy0}" fill="{acc}" opacity=".30"/></g>')
    # form outline
    body.append(_p(f"M{fx0},{fy1} L{fx0},{fy0} L{fx1},{fy0} L{fx1},{fy1} Z", 0.0, 5, acc))
    # rebar mat
    for i,x in enumerate(range(fx0+70, fx1-40, 96)):
        body.append(_p(f"M{x},{fy0+22} L{x},{fy1-22}", 1.0+i*0.09, 2, off, .30))
    for i,y in enumerate(range(fy0+62, fy1-30, 74)):
        body.append(_p(f"M{fx0+24},{y} L{fx1-24},{y}", 1.4+i*0.11, 2, off, .30))
    # screed bar sweep
    body.append(f'<g class="screed"><rect x="{fx0-14}" y="{fy0-26}" width="26" height="{fy1-fy0+52}" fill="{off}" opacity=".85" rx="4"/></g>')
    # cure texture
    random.seed(seed)
    sp="".join(f'<circle cx="{random.uniform(fx0+12,fx1-12):.0f}" cy="{random.uniform(fy0+12,fy1-12):.0f}" r="{random.uniform(1,2.6):.1f}" fill="{off}" opacity="{random.uniform(.10,.34):.2f}"/>' for _ in range(260))
    body.append(f'<g class="cure" opacity="0">{sp}</g>')
    css=(DRAW_CSS+
         ".pour{transform-origin:center bottom;animation:pour 11s ease-in-out infinite}"
         "@keyframes pour{0%,18%{transform:scaleY(0)}46%{transform:scaleY(1)}84%{transform:scaleY(1);opacity:.30}95%,100%{opacity:0}}"
         ".screed{animation:scr 11s ease-in-out infinite;opacity:0}"
         "@keyframes scr{0%,46%{transform:translateX(0);opacity:0}50%{opacity:1}"
         "68%{transform:translateX(820px);opacity:1}72%{opacity:0}100%{opacity:0}}"
         ".cure{animation:cure 11s ease-in-out infinite}"
         "@keyframes cure{0%,68%{opacity:0}80%{opacity:1}90%{opacity:1}100%{opacity:0}}")
    return _shell("".join(body), css=css, label="Concrete pour, screed and cure sequence")

# ---------------------------------------------------------------- ELECTRICAL
def electrical(dark, acc, off, seed):
    """Panel with current flowing out along circuits."""
    px,py,pw,ph = 150, 300, 200, 320
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(_p(f"M{px},{py} L{px+pw},{py} L{px+pw},{py+ph} L{px},{py+ph} Z", 0.0, 5, acc))
    runs=[]
    for i in range(6):
        y=py+34+i*50
        bx=px+pw
        mid=430+ (i%3)*90
        ey=140+i*126
        d=f"M{bx},{y} L{mid},{y} L{mid},{ey} L{1055},{ey}"
        runs.append(d)
        body.append(_p(f"M{px+22},{y} l40,0", 0.8+i*0.1, 7, acc, .9))          # breaker
        body.append(_p(d, 1.6+i*0.16, 3, off, .38))                            # conductor
        body.append(f'<path class="cur" d="{d}" fill="none" stroke="{acc}" stroke-width="3.4" '
                    f'stroke-dasharray="14 150" style="animation-delay:{i*0.3:.2f}s" stroke-linecap="round"/>')
        body.append(f'<circle class="fin" cx="1055" cy="{ey}" r="9" fill="{acc}" opacity="0"/>')
    css=(DRAW_CSS+
         ".cur{stroke-dashoffset:0;animation:cur 2.6s linear infinite}"
         "@keyframes cur{0%{stroke-dashoffset:164}100%{stroke-dashoffset:0}}"
         ".fin{animation:fin 11s ease-in-out infinite}"
         "@keyframes fin{0%,40%{opacity:0}52%{opacity:1}84%{opacity:1}95%,100%{opacity:0}}")
    return _shell("".join(body), css=css, label="Electrical panel with current flowing through circuits")

# ---------------------------------------------------------------- PLUMBING
def plumbing(dark, acc, off, seed):
    """Pipe run with flow, valve, and pressure sweep."""
    d="M130,700 L330,700 L330,420 L620,420 L620,240 L900,240 L900,560 L1070,560"
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(_p(d, 0.0, 20, off, .16))
    body.append(_p(d, 0.3, 11, acc, .30))
    body.append(f'<path class="flow" d="{d}" fill="none" stroke="{acc}" stroke-width="8" '
                'stroke-dasharray="26 74" stroke-linecap="round"/>')
    for jx,jy in [(330,700),(330,420),(620,420),(620,240),(900,240),(900,560)]:
        body.append(f'<circle cx="{jx}" cy="{jy}" r="16" fill="none" stroke="{off}" stroke-width="3" opacity=".32"/>')
    # valve wheel
    body.append('<g class="valve" transform="translate(620,240)">'
                + f'<circle r="42" fill="none" stroke="{off}" stroke-width="4" opacity=".55"/>'
                + "".join(f'<line x1="0" y1="0" x2="{42*math.cos(a):.1f}" y2="{42*math.sin(a):.1f}" stroke="{off}" stroke-width="3.5" opacity=".55"/>'
                          for a in [i*math.pi/3 for i in range(6)]) + '</g>')
    # gauge
    body.append(f'<circle cx="1000" cy="720" r="72" fill="none" stroke="{off}" stroke-width="3" opacity=".30"/>')
    body.append(f'<g class="needle" transform="translate(1000,720)"><line x1="0" y1="0" x2="0" y2="-56" stroke="{acc}" stroke-width="5" stroke-linecap="round"/></g>')
    css=(DRAW_CSS+
         ".flow{animation:fl 2.2s linear infinite}@keyframes fl{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}"
         ".valve{animation:vv 11s ease-in-out infinite;transform-origin:620px 240px}"
         "@keyframes vv{0%,20%{transform:translate(620px,240px) rotate(0deg)}45%{transform:translate(620px,240px) rotate(150deg)}100%{transform:translate(620px,240px) rotate(150deg)}}"
         ".needle{animation:nd 11s ease-in-out infinite;transform-origin:1000px 720px}"
         "@keyframes nd{0%,20%{transform:translate(1000px,720px) rotate(-115deg)}55%{transform:translate(1000px,720px) rotate(52deg)}"
         "85%{transform:translate(1000px,720px) rotate(46deg)}100%{transform:translate(1000px,720px) rotate(-115deg)}}")
    return _shell("".join(body), css=css, label="Pipe run with flow, valve and pressure gauge")

# ---------------------------------------------------------------- INSULATION
def insulation(dark, acc, off, seed):
    """Heat escaping, then a barrier stops it."""
    random.seed(seed)
    hx0,hx1,hy0,hy1 = 300, 900, 330, 690
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(_p(f"M{hx0},{hy1} L{hx0},{hy0} L600,{hy0-130} L{hx1},{hy0} L{hx1},{hy1} Z", 0.0, 5, off, .55))
    for i in range(16):
        x=random.uniform(hx0+20, hx1-20); dl=random.uniform(0,2.4)
        body.append(f'<g class="heat" style="animation-delay:{dl:.2f}s"><path d="M{x:.0f},{hy1-30} '
                    f'q14,-46 0,-92 q-14,-46 0,-92" fill="none" stroke="{acc}" stroke-width="3.2" '
                    'stroke-linecap="round" opacity=".8"/></g>')
    body.append(f'<g class="barrier"><rect x="{hx0-16}" y="{hy0-146}" width="{hx1-hx0+32}" height="{hy1-hy0+150}" '
                f'rx="18" fill="none" stroke="{acc}" stroke-width="8" opacity=".9"/>'
                f'<rect x="{hx0-16}" y="{hy0-146}" width="{hx1-hx0+32}" height="{hy1-hy0+150}" rx="18" fill="{acc}" opacity=".10"/></g>')
    css=(DRAW_CSS+
         ".heat{animation:ht 3.2s ease-out infinite;opacity:0}"
         "@keyframes ht{0%{opacity:0;transform:translateY(0) scale(.8)}20%{opacity:.85}"
         "100%{opacity:0;transform:translateY(-300px) scale(1.3)}}"
         ".barrier{opacity:0;animation:br 11s ease-in-out infinite;transform-origin:600px 500px}"
         "@keyframes br{0%,42%{opacity:0;transform:scale(1.14)}58%{opacity:1;transform:scale(1)}"
         "86%{opacity:1;transform:scale(1)}96%,100%{opacity:0;transform:scale(1)}}")
    return _shell("".join(body), css=css, label="Heat loss stopped by an insulation barrier")

# ---------------------------------------------------------------- GC
def gc(dark, acc, off, seed):
    """Project phase timeline with staged site build-up."""
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    y=720
    body.append(_p(f"M140,{y} L1060,{y}", 0.0, 4, off, .30))
    phases=[("site",180),("footings",356),("frame",532),("dry-in",708),("finish",884)]
    for i,(nm,x) in enumerate(phases):
        body.append(f'<circle class="nd" cx="{x}" cy="{y}" r="17" fill="{dark}" stroke="{acc}" stroke-width="4" style="animation-delay:{i*0.9:.2f}s"/>')
        body.append(f'<circle class="nd2" cx="{x}" cy="{y}" r="8" fill="{acc}" style="animation-delay:{i*0.9:.2f}s"/>')
        bh=60+i*78
        body.append(f'<rect class="bar" x="{x-46}" y="{y-70-bh}" width="92" height="{bh}" rx="4" fill="{acc}" '
                    f'opacity=".22" style="animation-delay:{i*0.9:.2f}s"/>')
        body.append(f'<rect class="bar" x="{x-46}" y="{y-70-bh}" width="92" height="{bh}" rx="4" fill="none" stroke="{acc}" '
                    f'stroke-width="2.5" opacity=".7" style="animation-delay:{i*0.9:.2f}s"/>')
    body.append(f'<path class="prog" d="M180,{y} L884,{y}" pathLength="100" stroke="{acc}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    css=(DRAW_CSS+
         ".prog{stroke-dasharray:100;stroke-dashoffset:100;animation:pg 11s ease-in-out infinite}"
         "@keyframes pg{0%{stroke-dashoffset:100}52%{stroke-dashoffset:0}86%{stroke-dashoffset:0;opacity:1}96%,100%{opacity:0}}"
         ".nd,.nd2{opacity:0;animation:nd 11s ease-in-out infinite}"
         "@keyframes nd{0%,6%{opacity:0}16%{opacity:1}86%{opacity:1}96%,100%{opacity:0}}"
         ".bar{opacity:0;transform-origin:center bottom;animation:br 11s ease-in-out infinite}"
         "@keyframes br{0%,8%{opacity:0;transform:scaleY(0)}24%{opacity:1;transform:scaleY(1)}"
         "86%{opacity:1;transform:scaleY(1)}96%,100%{opacity:0}}")
    return _shell("".join(body), css=css, label="Project phase timeline")

# ---------------------------------------------------------------- REMODEL
def remodel(dark, acc, off, seed):
    """Floor plan draws, then fixtures drop in."""
    body=[f'<rect width="{W}" height="{H}" fill="{dark}"/>', _grid(dark, off)]
    body.append(_p("M200,660 L200,260 L1000,260 L1000,660 Z", 0.0, 5, acc))
    body.append(_p("M600,660 L600,430", 1.2, 4, acc, .8))
    body.append(_p("M600,430 L1000,430", 1.6, 4, acc, .8))
    body.append(_p("M200,540 L340,540", 2.0, 3.4, off, .5))
    for i,(x,y,w,h) in enumerate([(240,300,120,90),(430,300,130,100),(650,300,150,100),(840,300,120,90),
                                  (250,470,150,60),(660,480,140,120),(840,480,120,120)]):
        body.append(f'<rect class="fx" x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{acc}" opacity=".18" style="animation-delay:{3.0+i*0.22:.2f}s"/>')
        body.append(f'<rect class="fx" x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="none" stroke="{acc}" stroke-width="2.4" opacity=".75" style="animation-delay:{3.0+i*0.22:.2f}s"/>')
    body.append(f'<path class="swing" d="M200,540 a140,140 0 0,1 140,140" fill="none" stroke="{off}" stroke-width="2" opacity=".3" stroke-dasharray="7 7"/>')
    css=(DRAW_CSS+
         ".fx{opacity:0;animation:fx 11s ease-in-out infinite}"
         "@keyframes fx{0%,26%{opacity:0;transform:translateY(-14px)}40%{opacity:1;transform:translateY(0)}"
         "86%{opacity:1}96%,100%{opacity:0}}"
         ".swing{stroke-dasharray:7 7;opacity:0;animation:sw 11s ease-in-out infinite}"
         "@keyframes sw{0%,30%{opacity:0}44%{opacity:.3}86%{opacity:.3}96%,100%{opacity:0}}")
    return _shell("".join(body), css=css, label="Floor plan with fixtures placed")

RENDER = {"hvac":hvac,"concrete":concrete,"electrical":electrical,"plumbing":plumbing,
          "insulation":insulation,"gc":gc,"remodel":remodel}

if __name__ == "__main__":
    import sys, os
    slug, trade, dark, acc, off, seed, out = sys.argv[1:8]
    svg = RENDER[trade](dark, acc, off, int(seed))
    open(out,"w").write(svg)
    print(f"{slug}: {trade} -> {out} ({len(svg)} bytes)")

# ================= generic supporting panels (palette-driven) =================
def radius(dark, acc, off, seed):
    lines="".join(f'<line x1="{600-700*math.cos(i*math.pi/9+.25):.0f}" y1="{450-700*math.sin(i*math.pi/9+.25):.0f}" '
                  f'x2="{600+700*math.cos(i*math.pi/9+.25):.0f}" y2="{450+700*math.sin(i*math.pi/9+.25):.0f}" '
                  f'stroke="{off}" stroke-width="1.6" opacity="0.07"/>' for i in range(9))
    rings="".join(f'<circle class="rg" cx="600" cy="450" r="{r}" fill="none" stroke="{acc}" stroke-width="{2.6-i*.4:.1f}" '
                  f'opacity="{.55-i*.11:.2f}" stroke-dasharray="{"none" if i==0 else "10 9"}" style="animation-delay:{i*.5:.1f}s"/>'
                  for i,r in enumerate([120,200,285,375]))
    body=(f'<rect width="{W}" height="{H}" fill="{dark}"/>{lines}'
          f'<circle cx="600" cy="450" r="420" fill="{acc}" opacity="0.05"/>{rings}'
          f'<circle cx="600" cy="450" r="15" fill="{acc}"/><circle cx="600" cy="450" r="31" fill="none" stroke="{acc}" stroke-width="3.5"/>')
    css=(".rg{animation:rg 4.5s ease-out infinite;transform-origin:600px 450px}"
         "@keyframes rg{0%{transform:scale(.7);opacity:0}35%{opacity:.55}100%{transform:scale(1.12);opacity:0}}")
    return _shell(body, css=css, label="Service area radius")

def shield(dark, acc, off, seed, stars=5, partial=1.0):
    def star(cx,cy,r,fill,op=1.0,clip=None):
        pts=[]
        for i in range(10):
            a=-math.pi/2+i*math.pi/5; rr=r if i%2==0 else r*0.45
            pts.append(f"{cx+rr*math.cos(a):.1f},{cy+rr*math.sin(a):.1f}")
        c=f' clip-path="url(#{clip})"' if clip else ''
        return f'<polygon points="{" ".join(pts)}" fill="{fill}" opacity="{op}"{c}/>'
    sh="M600,180 L860,268 L860,470 C860,600 760,690 600,742 C440,690 340,600 340,470 L340,268 Z"
    sx0,sy,sr=600-(stars-1)*31, 600, 26
    st=""
    for i in range(stars):
        cx=sx0+i*62; st+=star(cx,sy,sr,acc,0.22)
        if i<stars-1 or partial>=1.0: st+=star(cx,sy,sr,acc,1.0)
        else: st+=star(cx,sy,sr,acc,1.0,clip="cp")
    defs=f'<clipPath id="cp"><rect x="{sx0+(stars-1)*62-26}" y="{sy-30}" width="{26*2*partial:.1f}" height="60"/></clipPath>'
    body=(f'<rect width="{W}" height="{H}" fill="{dark}"/>'
          f'<path d="{sh}" fill="none" stroke="{acc}" stroke-width="6" opacity="0.55" stroke-linejoin="round"/>'
          f'<path d="{sh}" fill="{acc}" opacity="0.06"/>'
          f'<path class="tick" d="M470,430 L560,520 L735,345" pathLength="100" fill="none" stroke="{acc}" '
          'stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>'+st)
    css=(".tick{stroke-dasharray:100;stroke-dashoffset:100;animation:tk 5s ease-in-out infinite}"
         "@keyframes tk{0%{stroke-dashoffset:100}30%{stroke-dashoffset:0}85%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}")
    return _shell(body, defs=defs, css=css, label="Rating shield")

def texture(dark, acc, off, seed):
    """Abstract trade-pattern tile — layered offset bars, slow drift."""
    random.seed(seed+7)
    rows=""
    for i in range(9):
        y=90+i*90; off_x=random.uniform(-70,70)
        w=random.uniform(300,760)
        rows+=(f'<rect class="bar" x="{240+off_x:.0f}" y="{y}" width="{w:.0f}" height="46" rx="6" '
               f'fill="{acc}" opacity="{0.10+ (i%4)*0.055:.3f}" style="animation-delay:{i*0.28:.2f}s"/>')
    body=f'<rect width="{W}" height="{H}" fill="{dark}"/>{_grid(dark,off)}{rows}'
    css=(".bar{animation:bd 6.5s ease-in-out infinite}"
         "@keyframes bd{0%,100%{transform:translateX(-16px);opacity:.5}50%{transform:translateX(16px);opacity:1}}")
    return _shell(body, css=css, label="Layered pattern")

RENDER.update({"radius":radius,"shield":shield,"texture":texture})
