#!/usr/bin/env python3
"""
Per-trade scene builders — representational, not abstract.

The first attempt used a generic shape grammar (rect / field / run / radial).
It passed the uniqueness check and still looked like noise: roofing rendered as
scattered horizontal lines, painting as two empty rectangles. Unique is not the
same as good.

These draw the actual thing. A roof plane has courses and a ridge. A lawn has
mower stripes and a bed edge. Variation comes from Vary (angle, counts, layout,
motion emphasis) applied to real geometry, so two roofers differ the way two
roofs differ — not the way two random line-scatters differ.
"""
import math, sys
sys.path.insert(0, "/root/ubs/tools")
from variants import Vary

W, H = 1200, 900
SAFE = (250, 660)   # vertical band that survives a wide hero crop

def _wrap(body, css, label, dark, off, v, extra_defs=""):
    grid = "".join(
        [f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{off}" stroke-width="1" opacity=".028"/>' for x in range(0, W+1, 60)] +
        [f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{off}" stroke-width="1" opacity=".028"/>' for y in range(0, H+1, 60)])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img" aria-label="{label}"><defs>{extra_defs}'
            f'<radialGradient id="glow"><stop offset="0%" stop-color="{v.acc}" stop-opacity=".20"/>'
            f'<stop offset="100%" stop-color="{v.acc}" stop-opacity="0"/></radialGradient></defs>'
            f'<style>{css}@media (prefers-reduced-motion: reduce){{*{{animation:none!important}}'
            '.dw{stroke-dashoffset:0!important}[class]{opacity:1!important}}</style>'
            f'<rect width="{W}" height="{H}" fill="{dark}"/>{grid}'
            f'<ellipse cx="{v.ax(W,.14):.0f}" cy="455" rx="430" ry="330" fill="url(#glow)"/>'
            f'{body}</svg>')

DRAW = ("{sel}{{stroke-dasharray:100;stroke-dashoffset:100;animation:dw {d}s ease-in-out infinite}}"
        "@keyframes dw{{0%{{stroke-dashoffset:100}}24%{{stroke-dashoffset:0}}84%{{stroke-dashoffset:0;opacity:1}}"
        "95%{{stroke-dashoffset:0;opacity:0}}100%{{stroke-dashoffset:100;opacity:0}}}}")

# ------------------------------------------------------------------ ROOFING
def roofing(dark, acc, off, seed, variant=None):
    """Five distinct roof forms. Two roofers should differ the way two roofs
    differ — a hip is not a gable is not a gambrel."""
    v = Vary(seed, 5); v.acc = acc
    if variant is not None: v.variant = variant % 5
    form = ["gable","hip","shed","gambrel","crossgable"][v.variant]
    cx = v.ax(W, .09); hw = v.f(340, 430)
    eave = 620 + v.f(-25, 25); ridge = eave - v.f(230, 320)
    body = [f'<path class="dw" d="M{cx-hw-45:.0f},{eave:.0f} L{cx+hw+45:.0f},{eave:.0f}" pathLength="100" '
            f'stroke="{off}" stroke-width="5" fill="none" opacity=".5" style="animation-delay:0s"/>']
    outline, courses = [], []
    if form == "gable":
        outline = [f"M{cx-hw:.0f},{eave:.0f} L{cx:.0f},{ridge:.0f} L{cx+hw:.0f},{eave:.0f}"]
        courses = [(t, hw*(1-t), cx) for t in [i/12 for i in range(1,12)]]
    elif form == "hip":
        rt = hw*.42
        outline = [f"M{cx-hw:.0f},{eave:.0f} L{cx-rt:.0f},{ridge:.0f} L{cx+rt:.0f},{ridge:.0f} L{cx+hw:.0f},{eave:.0f}"]
        courses = [(t, hw-(hw-rt)*t, cx) for t in [i/12 for i in range(1,12)]]
    elif form == "shed":
        lean = 1 if not v.flip else -1
        outline = [f"M{cx-hw:.0f},{eave:.0f} L{cx-hw*lean:.0f},{eave:.0f} L{cx+hw*lean:.0f},{ridge:.0f} L{cx+hw:.0f},{eave:.0f}"] \
                  if False else [f"M{cx-hw:.0f},{eave if lean>0 else ridge:.0f} L{cx+hw:.0f},{ridge if lean>0 else eave:.0f}"]
        courses = [(t, hw, cx) for t in [i/11 for i in range(1,11)]]
    elif form == "gambrel":
        kx, ky = hw*.55, ridge + (eave-ridge)*.45
        outline = [f"M{cx-hw:.0f},{eave:.0f} L{cx-kx:.0f},{ky:.0f} L{cx:.0f},{ridge:.0f} "
                   f"L{cx+kx:.0f},{ky:.0f} L{cx+hw:.0f},{eave:.0f}"]
        courses = [(t, hw-(hw-kx)*min(t/.45,1) - (kx*max(0,(t-.45)/.55)), cx) for t in [i/12 for i in range(1,12)]]
    else:  # crossgable — main ridge plus a perpendicular wing
        wx = cx - hw*.35
        outline = [f"M{cx-hw:.0f},{eave:.0f} L{cx:.0f},{ridge:.0f} L{cx+hw:.0f},{eave:.0f}",
                   f"M{wx-hw*.42:.0f},{eave:.0f} L{wx:.0f},{ridge+ (eave-ridge)*.30:.0f} L{wx+hw*.42:.0f},{eave:.0f}"]
        courses = [(t, hw*(1-t), cx) for t in [i/11 for i in range(1,11)]]
    for i,(t,halfw,ccx) in enumerate(courses):
        y = eave + (ridge-eave)*t
        if form == "shed":
            y = eave + (ridge-eave)*t
        body.append(f'<path class="dw" d="M{ccx-halfw:.0f},{y:.0f} L{ccx+halfw:.0f},{y:.0f}" pathLength="100" '
                    f'stroke="{acc}" stroke-width="{3.6-t*1.5:.1f}" fill="none" opacity="{.88-t*.30:.2f}" '
                    f'style="animation-delay:{0.5+i*v.stagger:.2f}s"/>')
        for k in range(int(6+i)):
            xx = ccx-halfw + (2*halfw)*((k+(0.5 if i%2 else 0))/max(6+i,1))
            body.append(f'<line class="tab" x1="{xx:.0f}" y1="{y:.0f}" x2="{xx:.0f}" y2="{y+22:.0f}" '
                        f'stroke="{acc}" stroke-width="1.4" opacity=".28" style="animation-delay:{0.7+i*v.stagger:.2f}s"/>')
    for j,o in enumerate(outline):
        body.append(f'<path class="dw" d="{o}" pathLength="100" stroke="{off}" stroke-width="5.5" fill="none" '
                    f'style="animation-delay:{0.2+j*.25:.2f}s"/>')
    if v.rng.random() < .55:                                   # chimney
        chx = cx + v.pick([-1,1])*hw*v.f(.30,.55)
        body.append(f'<path class="dw" d="M{chx:.0f},{eave-(eave-ridge)*.55:.0f} L{chx:.0f},{ridge-60:.0f} '
                    f'L{chx+42:.0f},{ridge-60:.0f} L{chx+42:.0f},{eave-(eave-ridge)*.40:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="4" fill="none" opacity=".8" style="animation-delay:2.6s"/>')
    if form in ("gable","hip") and v.rng.random() < .5:        # dormer
        dx = cx + v.pick([-1,1])*hw*.34
        body.append(f'<path class="dw" d="M{dx-52:.0f},{eave-(eave-ridge)*.42:.0f} L{dx:.0f},{eave-(eave-ridge)*.66:.0f} '
                    f'L{dx+52:.0f},{eave-(eave-ridge)*.42:.0f}" pathLength="100" stroke="{off}" stroke-width="4" '
                    f'fill="none" opacity=".85" style="animation-delay:2.9s"/>')
    css = DRAW.format(sel=".dw", d=v.dur(11)) + (
        ".tab{opacity:0;animation:tb DURs ease-in-out infinite}"
        "@keyframes tb{0%,18%{opacity:0}34%{opacity:.28}84%{opacity:.28}95%,100%{opacity:0}}"
        ).replace("DUR", str(v.dur(11)))
    return _wrap("".join(body), css, f"{form} roof with shingle courses", dark, off, v)

# ------------------------------------------------------------------ PAINTING
def painting(dark, acc, off, seed):
    v = Vary(seed, 3); v.acc = acc
    x0, y0 = v.ax(W,.10)-380, SAFE[0]+v.f(-20,30)
    w, h = 760, 360
    lanes = v.count(4, 6, 8)
    lw = w/lanes
    body = [f'<rect class="dw2" x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" fill="none" '
            f'stroke="{off}" stroke-width="4" opacity=".45" rx="3"/>']
    body.append(f'<clipPath id="wall"><rect x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" rx="3"/></clipPath>')
    body.append(f'<g clip-path="url(#wall)">')
    for i in range(lanes):                                # roller lanes filling in
        lx = x0 + i*lw
        body.append(f'<rect class="lane" x="{lx:.1f}" y="{y0:.0f}" width="{lw+1:.1f}" height="{h}" '
                    f'fill="{acc}" opacity="{.30+ (i%3)*.07:.2f}" style="animation-delay:{i*max(v.stagger,.18):.2f}s"/>')
    body.append('</g>')
    # the roller itself, travelling
    rx = x0 - 26
    body.append(f'<g class="roller"><rect x="{rx:.0f}" y="{y0-30:.0f}" width="30" height="{h+60:.0f}" rx="12" '
                f'fill="{off}" opacity=".92"/><rect x="{rx+11:.0f}" y="{y0+h+28:.0f}" width="8" height="70" rx="4" fill="{off}" opacity=".6"/></g>')
    css = (DRAW.format(sel=".dw2", d=v.dur(11)) +
           ".lane{transform-origin:%s center;animation:ln %ss ease-in-out infinite;opacity:0}"
           "@keyframes ln{0%%,10%%{opacity:0;transform:scaleY(0)}30%%{opacity:1;transform:scaleY(1)}"
           "84%%{opacity:1}95%%,100%%{opacity:0}}"
           ".roller{animation:rl %ss ease-in-out infinite;opacity:0}"
           "@keyframes rl{0%%{transform:translateX(0);opacity:0}8%%{opacity:1}"
           "72%%{transform:translateX(%dpx);opacity:1}82%%,100%%{opacity:0}}"
           % ("bottom" if not v.flip else "top", v.dur(11), v.dur(11), int(w+26)))
    return _wrap("".join(body), css, "Wall being rolled with fresh paint", dark, off, v)

# ------------------------------------------------------------------ LANDSCAPING
def landscaping(dark, acc, off, seed, variant=None):
    v = Vary(seed, 3); v.acc = acc
    if variant is not None: v.variant = variant % 3
    mode = ["stripes","diagonal","island"][v.variant]
    top, bot = SAFE[0]+25, SAFE[1]-25
    body = []
    n = v.count(8, 11, 14)
    if mode in ("stripes","diagonal"):
        skew = 0 if mode == "stripes" else v.f(90, 170) * (1 if not v.flip else -1)
        for i in range(n):
            t = i/(n-1); y = top + t*(bot-top)
            x1, x2 = 170 + skew*t, 1030 + skew*t
            body.append(f'<path class="dw" d="M{x1:.0f},{y:.0f} L{x2:.0f},{y:.0f}" pathLength="100" '
                        f'stroke="{acc}" stroke-width="{19 if i%2 else 10}" fill="none" '
                        f'opacity="{.30 if i%2 else .58}" style="animation-delay:{i*v.stagger*.7:.2f}s"/>')
    elif mode == "island":
        cx, cy = v.ax(W,.06), (top+bot)/2
        for i in range(n):                                    # concentric mown rings
            r = 40 + i*((bot-top)/2-30)/n
            body.append(f'<ellipse class="dw" cx="{cx:.0f}" cy="{cy:.0f}" rx="{r*1.7:.0f}" ry="{r:.0f}" '
                        f'pathLength="100" fill="none" stroke="{acc}" stroke-width="{11 if i%2 else 6}" '
                        f'opacity="{.52 if i%2 else .28}" style="animation-delay:{i*v.stagger*.7:.2f}s"/>')
        body.append(f'<ellipse class="bush" cx="{cx:.0f}" cy="{cy:.0f}" rx="70" ry="42" fill="{off}" opacity=".35" style="animation-delay:1.8s"/>')
    else:                                                     # paved terrace set into the lawn
        pw, ph = 470, 200
        px, py = v.ax(W,.07)-pw/2, top+30
        body.append(f'<rect class="dw" x="{px:.0f}" y="{py:.0f}" width="{pw}" height="{ph}" rx="4" '
                    f'pathLength="100" fill="none" stroke="{off}" stroke-width="5" opacity=".8" style="animation-delay:.1s"/>')
        cols, rws = 7, 3
        for r in range(rws):
            for c in range(cols):
                jx = px + c*pw/cols + ((pw/cols/2) if r % 2 else 0)
                if jx + pw/cols - 6 > px + pw: continue
                body.append(f'<rect class="paver" x="{jx+3:.0f}" y="{py+r*ph/rws+3:.0f}" width="{pw/cols-6:.0f}" '
                            f'height="{ph/rws-6:.0f}" rx="2" fill="{off}" opacity="{.16+((r+c)%3)*.06:.2f}" '
                            f'style="animation-delay:{0.4+(r*cols+c)*.05:.2f}s"/>')
        for i in range(n):
            t=i/(n-1); y=py+ph+30+t*(bot-py-ph-30)
            body.append(f'<path class="dw" d="M{190:.0f},{y:.0f} L{1010:.0f},{y:.0f}" pathLength="100" '
                        f'stroke="{acc}" stroke-width="{16 if i%2 else 9}" fill="none" '
                        f'opacity="{.30 if i%2 else .55}" style="animation-delay:{1.2+i*v.stagger*.6:.2f}s"/>')
    if mode in ("stripes","diagonal"):
        bx = 210 if not v.flip else 990; d = 1 if not v.flip else -1
        body.append(f'<path class="dw" d="M{bx:.0f},{top:.0f} C{bx+300*d:.0f},{(top+bot)/2-70:.0f} '
                    f'{bx+110*d:.0f},{(top+bot)/2+90:.0f} {bx+380*d:.0f},{bot:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="6" fill="none" opacity=".75" style="animation-delay:{n*v.stagger*.7+.3:.2f}s"/>')
        for i in range(v.count(3,5,7)):
            t=(i+1)/(v.count(3,5,7)+1)
            body.append(f'<circle class="bush" cx="{bx+380*d*t*0.82+v.f(-28,28):.0f}" cy="{top+t*(bot-top):.0f}" '
                        f'r="{v.f(15,30):.0f}" fill="{off}" opacity=".5" style="animation-delay:{1.7+i*.18:.2f}s"/>')
    css = DRAW.format(sel=".dw", d=v.dur(11)) + (
        ".bush,.paver{opacity:0;animation:bs DURs ease-in-out infinite}"
        "@keyframes bs{0%,26%{opacity:0;transform:scale(.45)}42%{opacity:.5;transform:scale(1)}"
        "84%{opacity:.5}95%,100%{opacity:0}}").replace("DUR", str(v.dur(11)))
    return _wrap("".join(body), css, f"Landscaped lawn, {mode}", dark, off, v)

# ------------------------------------------------------------------ TREE
def tree(dark, acc, off, seed, variant=None):
    v = Vary(seed, 4); v.acc = acc
    if variant is not None: v.variant = variant % 4
    habit = ["spreading","upright","leaning","multistem"][v.variant]
    cx, base = v.ax(W,.08), SAFE[1]+40
    trunk_h = {"spreading":130,"upright":190,"leaning":150,"multistem":95}[habit]
    lean = v.f(-14,14) if habit=="leaning" else v.f(-4,4)
    topx = cx + lean*2
    body=[f'<path class="dw" d="M{cx-40:.0f},{base:.0f} L{cx+40:.0f},{base:.0f}" pathLength="100" '
          f'stroke="{off}" stroke-width="4" fill="none" opacity=".45" style="animation-delay:0s"/>',
          f'<path class="dw" d="M{cx-17:.0f},{base:.0f} L{topx-8:.0f},{base-trunk_h:.0f} L{topx+8:.0f},{base-trunk_h:.0f} L{cx+17:.0f},{base:.0f} Z" '
          f'pathLength="100" stroke="{off}" stroke-width="4" fill="none" style="animation-delay:.15s"/>']
    def limb(x, y, ang, ln, depth, delay):
        if depth == 0 or ln < 22: return
        x2 = x + ln*math.cos(ang); y2 = y - ln*math.sin(ang)
        body.append(f'<path class="dw" d="M{x:.0f},{y:.0f} L{x2:.0f},{y2:.0f}" pathLength="100" '
                    f'stroke="{off if depth>2 else acc}" stroke-width="{depth*1.05:.1f}" fill="none" '
                    f'opacity="{.45+depth*.11:.2f}" style="animation-delay:{delay:.2f}s"/>')
        spread = math.radians(v.f(20, 36))
        limb(x2, y2, ang-spread, ln*v.f(.62,.76), depth-1, delay+v.stagger)
        limb(x2, y2, ang+spread, ln*v.f(.62,.76), depth-1, delay+v.stagger)
        if depth > 3 and v.rng.random() < .5:
            limb(x2, y2, ang+v.f(-.2,.2), ln*.6, depth-2, delay+v.stagger*1.4)
    if habit == "multistem":
        for k in (-1, 0, 1):
            limb(topx, base-trunk_h, math.radians(90+v.rot+k*24), v.f(95,120), v.count(4,5,5), .45+abs(k)*.2)
    else:
        spreadbase = {"spreading":118,"upright":150,"leaning":112}[habit]
        limb(topx, base-trunk_h, math.radians(90+v.rot+lean*1.6), v.f(spreadbase-15, spreadbase+20), v.count(4,5,5), .45)
    for i in range(v.count(10,16,22)):                     # canopy
        a=v.f(0,2*math.pi); r=v.f(40,190)
        squash = {"spreading":(1.45,.62),"upright":(.95,1.05),"leaning":(1.2,.8),"multistem":(1.35,.75)}[habit]
        body.append(f'<circle class="leaf" cx="{topx+r*math.cos(a)*squash[0]:.0f}" cy="{base-trunk_h-140+r*math.sin(a)*squash[1]:.0f}" '
                    f'r="{v.f(22,52):.0f}" fill="{acc}" fill-opacity="{v.f(.22,.42):.2f}" style="animation-delay:{1.9+i*.06:.2f}s"/>')
    css = DRAW.format(sel=".dw", d=v.dur(12)) + (
        ".leaf{opacity:0;animation:lf %ss ease-in-out infinite}"
        "@keyframes lf{0%%,30%%{opacity:0;transform:scale(.5)}48%%{opacity:1;transform:scale(1)}"
        "84%%{opacity:1}95%%,100%%{opacity:0}}" % v.dur(12))
    return _wrap("".join(body), css, f"Tree drawing itself, {habit} habit", dark, off, v)

# ------------------------------------------------------------------ FLOORING
def flooring(dark, acc, off, seed):
    v = Vary(seed, 3); v.acc = acc
    rows = v.count(6, 8, 10)
    x0, y0, w = 180, SAFE[0]+15, 840
    rh = (SAFE[1]-SAFE[0]-30)/rows
    body=[]
    for r in range(rows):
        y = y0 + r*rh
        planks = v.i(3, 5)
        off_x = (r % 2) * (w/planks/2)
        x = x0 - off_x
        i = 0
        while x < x0 + w:
            left = max(x, x0)                      # clamp: no plank hangs off the left edge
            pw = min(x + w/planks, x0 + w) - left
            x_draw = left
            if pw > 24:
                body.append(f'<rect class="plank" x="{x_draw:.0f}" y="{y:.0f}" width="{pw-6:.0f}" height="{rh-6:.0f}" rx="2" '
                            f'fill="{acc}" opacity="{.16+((r+i)%3)*.07:.2f}" style="animation-delay:{(r*3+i)*v.stagger*.5:.2f}s"/>')
                body.append(f'<rect class="plank" x="{x_draw:.0f}" y="{y:.0f}" width="{pw-6:.0f}" height="{rh-6:.0f}" rx="2" '
                            f'fill="none" stroke="{acc}" stroke-width="1.5" opacity=".45" style="animation-delay:{(r*3+i)*v.stagger*.5:.2f}s"/>')
                for g in range(2):                          # grain
                    gy = y + (rh-6)*(g+1)/3
                    body.append(f'<line class="plank" x1="{x_draw+6:.0f}" y1="{gy:.0f}" x2="{x_draw+pw-12:.0f}" y2="{gy:.0f}" '
                                f'stroke="{off}" stroke-width="1" opacity=".13" style="animation-delay:{(r*3+i)*v.stagger*.5:.2f}s"/>')
            x += w/planks; i += 1
    css = (".plank{opacity:0;animation:pk %ss ease-in-out infinite}"
           "@keyframes pk{0%%,4%%{opacity:0;transform:translateY(-10px)}20%%{opacity:1;transform:translateY(0)}"
           "84%%{opacity:1}95%%,100%%{opacity:0}}" % v.dur(11))
    return _wrap("".join(body), css, "Floor planks laid in staggered rows", dark, off, v)

BUILDERS = {"roofing":roofing, "painting":painting, "landscaping":landscaping,
            "tree":tree, "flooring":flooring}

# ------------------------------------------------------------------ CONCRETE
def concrete(dark, acc, off, seed, variant=None):
    v = Vary(seed, 4); v.acc = acc
    if variant is not None: v.variant = variant % 4
    mode = ["pour","stamped","section","joints"][v.variant]
    x0, y0, w, h = v.ax(W,.07)-390, SAFE[0]+20, 780, 330
    body = []
    if mode == "pour":
        body.append(f'<clipPath id="fm"><rect x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}"/></clipPath>')
        body.append(f'<g clip-path="url(#fm)"><rect class="rise" x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" fill="{acc}" opacity=".34"/></g>')
        body.append(f'<path class="dw" d="M{x0:.0f},{y0+h:.0f} L{x0:.0f},{y0:.0f} L{x0+w:.0f},{y0:.0f} L{x0+w:.0f},{y0+h:.0f} Z" '
                    f'pathLength="100" stroke="{acc}" stroke-width="5" fill="none" style="animation-delay:0s"/>')
        for i,xx in enumerate(range(int(x0)+70, int(x0+w)-40, 92)):
            body.append(f'<path class="dw" d="M{xx},{y0+20:.0f} L{xx},{y0+h-20:.0f}" pathLength="100" stroke="{off}" '
                        f'stroke-width="2" opacity=".28" style="animation-delay:{.9+i*.08:.2f}s"/>')
        body.append(f'<g class="sweep"><rect x="{x0-12:.0f}" y="{y0-26:.0f}" width="24" height="{h+52}" rx="4" fill="{off}" opacity=".9"/></g>')
    elif mode == "stamped":
        cols, rws = v.count(6,8,10), v.count(3,4,5)
        for r in range(rws):
            for c in range(cols):
                jx = x0 + c*w/cols + ((w/cols/2) if r%2 else 0)
                if jx + w/cols - 8 > x0 + w: continue
                body.append(f'<rect class="st" x="{jx+4:.0f}" y="{y0+r*h/rws+4:.0f}" width="{w/cols-8:.0f}" '
                            f'height="{h/rws-8:.0f}" rx="3" fill="{acc}" opacity="{.18+((r+c)%3)*.08:.2f}" '
                            f'style="animation-delay:{(r*cols+c)*.05:.2f}s"/>')
                body.append(f'<rect class="st" x="{jx+4:.0f}" y="{y0+r*h/rws+4:.0f}" width="{w/cols-8:.0f}" '
                            f'height="{h/rws-8:.0f}" rx="3" fill="none" stroke="{acc}" stroke-width="1.6" opacity=".5" '
                            f'style="animation-delay:{(r*cols+c)*.05:.2f}s"/>')
    elif mode == "section":
        layers = [("subgrade",.34,off,.10),("base rock",.24,off,.20),("slab",.30,acc,.34),("finish",.12,acc,.46)]
        yy = y0 + h
        for i,(nm,frac,col,op) in enumerate(layers):
            lh = h*frac; yy -= lh
            body.append(f'<rect class="st" x="{x0:.0f}" y="{yy:.0f}" width="{w}" height="{lh:.0f}" fill="{col}" '
                        f'opacity="{op}" style="animation-delay:{i*.34:.2f}s"/>')
            body.append(f'<rect class="st" x="{x0:.0f}" y="{yy:.0f}" width="{w}" height="{lh:.0f}" fill="none" '
                        f'stroke="{off}" stroke-width="1.6" opacity=".35" style="animation-delay:{i*.34:.2f}s"/>')
        for i,xx in enumerate(range(int(x0)+60, int(x0+w)-40, 78)):   # rebar dots in the slab
            body.append(f'<circle class="st" cx="{xx}" cy="{y0+h*.52:.0f}" r="6" fill="{off}" opacity=".55" '
                        f'style="animation-delay:{1.5+i*.05:.2f}s"/>')
        for i,xx in enumerate(range(int(x0)+18, int(x0+w)-10, 26)):   # subgrade hatch
            body.append(f'<line class="st" x1="{xx}" y1="{y0+h:.0f}" x2="{xx+18}" y2="{y0+h-h*.34:.0f}" '
                        f'stroke="{off}" stroke-width="1.3" opacity=".18" style="animation-delay:{.2+i*.012:.2f}s"/>')
        body.append(f'<path class="dw" d="M{x0+w*.46:.0f},{y0+h*.10:.0f} L{x0+w*.46:.0f},{y0+h*.44:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="3.5" opacity=".8" style="animation-delay:1.9s"/>')
    else:  # joints — saw cut sweeping across a finished slab
        body.append(f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" rx="3" fill="{acc}" opacity=".16"/>')
        body.append(f'<rect class="dw2" x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" rx="3" fill="none" stroke="{acc}" stroke-width="5"/>')
        n = v.count(3,4,6)
        for i in range(1, n+1):
            jx = x0 + w*i/(n+1)
            body.append(f'<path class="dw" d="M{jx:.0f},{y0+8:.0f} L{jx:.0f},{y0+h-8:.0f}" pathLength="100" '
                        f'stroke="{off}" stroke-width="3.4" opacity=".7" style="animation-delay:{.6+i*.4:.2f}s"/>')
        body.append(f'<path class="dw" d="M{x0+8:.0f},{y0+h/2:.0f} L{x0+w-8:.0f},{y0+h/2:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="3.4" opacity=".7" style="animation-delay:{.4:.2f}s"/>')
    css = (DRAW.format(sel=".dw", d=v.dur(11)) + DRAW.format(sel=".dw2", d=v.dur(11)) +
           ".rise{transform-origin:center bottom;animation:rs DURs ease-in-out infinite}"
           "@keyframes rs{0%,16%{transform:scaleY(0)}48%{transform:scaleY(1)}86%{transform:scaleY(1);opacity:.34}96%,100%{opacity:0}}"
           ".sweep{opacity:0;animation:sw DURs ease-in-out infinite}"
           "@keyframes sw{0%,46%{transform:translateX(0);opacity:0}52%{opacity:1}76%{transform:translateX(SWpx);opacity:1}84%,100%{opacity:0}}"
           ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
           "@keyframes stg{0%,6%{opacity:0;transform:translateY(-8px)}24%{opacity:1;transform:translateY(0)}"
           "84%{opacity:1}95%,100%{opacity:0}}"
           ).replace("DUR", str(v.dur(11))).replace("SW", str(int(w)))
    return _wrap("".join(body), css, f"Concrete {mode}", dark, off, v)

# ------------------------------------------------------------------ ELECTRICAL
def electrical(dark, acc, off, seed, variant=None):
    v = Vary(seed, 3); v.acc = acc
    if variant is not None: v.variant = variant % 3
    mode = ["panel","conduit","mast"][v.variant]
    body = []
    if mode == "panel":
        px, py, pw, ph = v.ax(W,.16)-90, SAFE[0]+20, 190, 300
        body.append(f'<path class="dw" d="M{px:.0f},{py:.0f} L{px+pw:.0f},{py:.0f} L{px+pw:.0f},{py+ph:.0f} L{px:.0f},{py+ph:.0f} Z" '
                    f'pathLength="100" stroke="{acc}" stroke-width="5" fill="none" style="animation-delay:0s"/>')
        n = v.count(4,6,7)
        for i in range(n):
            y = py+28+i*(ph-46)/max(n-1,1); mid = px+pw+120+(i%3)*80; ey = SAFE[0]+30+i*(SAFE[1]-SAFE[0]-60)/max(n-1,1)
            d = f"M{px+pw:.0f},{y:.0f} L{mid:.0f},{y:.0f} L{mid:.0f},{ey:.0f} L{1080:.0f},{ey:.0f}"
            body.append(f'<path class="dw" d="M{px+20:.0f},{y:.0f} l40,0" pathLength="100" stroke="{acc}" stroke-width="7" fill="none" style="animation-delay:{.7+i*.1:.2f}s"/>')
            body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{off}" stroke-width="3" opacity=".36" fill="none" style="animation-delay:{1.4+i*.14:.2f}s"/>')
            body.append(f'<path class="cur" d="{d}" fill="none" stroke="{acc}" stroke-width="3.6" stroke-dasharray="14 150" style="animation-delay:{i*.28:.2f}s"/>')
    elif mode == "conduit":
        pts=[(150,600)]; x,y=pts[0]
        for i in range(v.count(4,5,6)):
            if i%2==0: x+=v.f(160,260)
            else: y-=v.f(90,150)
            pts.append((x,y))
        d="M"+" L".join(f"{a:.0f},{b:.0f}" for a,b in pts)
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{off}" stroke-width="16" opacity=".22" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{acc}" stroke-width="7" opacity=".55" fill="none" style="animation-delay:.2s"/>')
        body.append(f'<path class="cur" d="{d}" fill="none" stroke="{acc}" stroke-width="5" stroke-dasharray="20 90" stroke-linecap="round"/>')
        for i,(bx,by) in enumerate(pts[1:]):
            body.append(f'<rect class="st" x="{bx-22:.0f}" y="{by-22:.0f}" width="44" height="44" rx="5" fill="{dark}" '
                        f'stroke="{off}" stroke-width="3" opacity=".8" style="animation-delay:{1.2+i*.2:.2f}s"/>')
    else:  # mast — service drop, meter, riser
        mx = v.ax(W,.10)
        body.append(f'<path class="dw" d="M{mx:.0f},{SAFE[1]:.0f} L{mx:.0f},{SAFE[0]-40:.0f}" pathLength="100" stroke="{off}" stroke-width="9" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="M{mx:.0f},{SAFE[0]-30:.0f} C{mx-160:.0f},{SAFE[0]+30:.0f} {mx-300:.0f},{SAFE[0]+10:.0f} {mx-420:.0f},{SAFE[0]+70:.0f}" '
                    f'pathLength="100" stroke="{acc}" stroke-width="4" fill="none" style="animation-delay:.5s"/>')
        body.append(f'<circle class="st" cx="{mx:.0f}" cy="{SAFE[0]+230:.0f}" r="52" fill="{dark}" stroke="{acc}" stroke-width="5" style="animation-delay:1.2s"/>')
        body.append(f'<path class="cur" d="M{mx:.0f},{SAFE[0]-20:.0f} L{mx:.0f},{SAFE[1]-10:.0f}" fill="none" stroke="{acc}" stroke-width="5" stroke-dasharray="16 70"/>')
        body.append(f'<path class="dw" d="M{mx-26:.0f},{SAFE[0]-40:.0f} q26,-26 52,0" pathLength="100" stroke="{off}" '
                    f'stroke-width="7" fill="none" style="animation-delay:.3s"/>')      # weatherhead
        for i in range(3):                                                                # riser straps
            sy = SAFE[0]+70+i*90
            body.append(f'<line class="st" x1="{mx-24:.0f}" y1="{sy:.0f}" x2="{mx+24:.0f}" y2="{sy:.0f}" '
                        f'stroke="{off}" stroke-width="4" opacity=".65" style="animation-delay:{1.0+i*.18:.2f}s"/>')
        body.append(f'<path class="dw" d="M{mx-70:.0f},{SAFE[1]:.0f} L{mx+70:.0f},{SAFE[1]:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="5" opacity=".5" fill="none" style="animation-delay:.1s"/>')
        body.append(f'<path class="dw" d="M{mx:.0f},{SAFE[1]:.0f} L{mx-46:.0f},{SAFE[1]+52:.0f}" pathLength="100" '
                    f'stroke="{acc}" stroke-width="4" opacity=".7" fill="none" style="animation-delay:1.7s"/>')  # ground
    css = (DRAW.format(sel=".dw", d=v.dur(11)) +
           ".cur{stroke-dashoffset:0;animation:cur DURFs linear infinite}"
           "@keyframes cur{0%{stroke-dashoffset:164}100%{stroke-dashoffset:0}}"
           ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
           "@keyframes stg{0%,10%{opacity:0;transform:scale(.7)}28%{opacity:1;transform:scale(1)}84%{opacity:1}95%,100%{opacity:0}}"
           ).replace("DURF", str(v.dur(2.6))).replace("DUR", str(v.dur(11)))
    return _wrap("".join(body), css, f"Electrical {mode}", dark, off, v)

# ------------------------------------------------------------------ HVAC
def hvac(dark, acc, off, seed, variant=None):
    v = Vary(seed, 3); v.acc = acc
    if variant is not None: v.variant = variant % 3
    mode = ["curve","duct","loop"][v.variant]
    body=[]
    if mode == "curve":
        pts=[]
        for i in range(121):
            t=i/120.0; y=455-190*math.cos(2*math.pi*t)
            pts.append(f"{150+900*t:.1f},{y:.1f}")
        body.append(f'<line x1="150" y1="455" x2="1050" y2="455" stroke="{off}" stroke-width="2" opacity=".22"/>')
        for i in range(13):
            x=150+900*i/12
            body.append(f'<line x1="{x:.0f}" y1="447" x2="{x:.0f}" y2="463" stroke="{off}" stroke-width="{2 if i%3==0 else 1}" opacity="{.35 if i%3==0 else .15}"/>')
        body.append(f'<path class="dw" d="M{" L".join(pts)}" pathLength="100" fill="none" stroke="{acc}" stroke-width="5" style="animation-delay:.2s" stroke-linecap="round"/>')
        for cx,cy in [(150,265),(600,645),(1050,265)]:
            body.append(f'<circle class="st" cx="{cx}" cy="{cy}" r="13" fill="{acc}" style="animation-delay:2.4s"/>')
    elif mode == "duct":
        ty = 430; body.append(f'<path class="dw" d="M150,{ty} L1010,{ty}" pathLength="100" stroke="{off}" stroke-width="46" opacity=".18" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="M150,{ty} L1010,{ty}" pathLength="100" stroke="{acc}" stroke-width="10" opacity=".45" fill="none" style="animation-delay:.2s"/>')
        n=v.count(3,4,6)
        for i in range(n):
            bx=260+i*(720/max(n-1,1)); up = -1 if i%2==0 else 1
            body.append(f'<path class="dw" d="M{bx:.0f},{ty} L{bx:.0f},{ty+up*150:.0f}" pathLength="100" stroke="{acc}" '
                        f'stroke-width="7" opacity=".6" fill="none" style="animation-delay:{.8+i*.22:.2f}s"/>')
            body.append(f'<path class="cur" d="M{bx:.0f},{ty} L{bx:.0f},{ty+up*150:.0f}" fill="none" stroke="{acc}" stroke-width="6" stroke-dasharray="12 40"/>')
        body.append(f'<path class="cur" d="M150,{ty} L1010,{ty}" fill="none" stroke="{acc}" stroke-width="8" stroke-dasharray="26 80" stroke-linecap="round"/>')
    else:  # refrigeration loop
        cx,cy,rx,ry = v.ax(W,.06), 455, 330, 165
        d=f"M{cx-rx:.0f},{cy:.0f} a{rx:.0f},{ry:.0f} 0 1,0 {2*rx:.0f},0 a{rx:.0f},{ry:.0f} 0 1,0 {-2*rx:.0f},0"
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{off}" stroke-width="18" opacity=".18" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{acc}" stroke-width="6" opacity=".5" fill="none" style="animation-delay:.2s"/>')
        body.append(f'<path class="cur" d="{d}" fill="none" stroke="{acc}" stroke-width="7" stroke-dasharray="24 76" stroke-linecap="round"/>')
        for i,(ax,ay) in enumerate([(cx-rx,cy),(cx,cy-ry),(cx+rx,cy),(cx,cy+ry)]):
            body.append(f'<rect class="st" x="{ax-30:.0f}" y="{ay-24:.0f}" width="60" height="48" rx="6" fill="{dark}" '
                        f'stroke="{acc}" stroke-width="4" style="animation-delay:{1.1+i*.22:.2f}s"/>')
    css = (DRAW.format(sel=".dw", d=v.dur(11)) +
           ".cur{stroke-dashoffset:0;animation:cur DURFs linear infinite}"
           "@keyframes cur{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}"
           ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
           "@keyframes stg{0%,14%{opacity:0;transform:scale(.7)}32%{opacity:1;transform:scale(1)}84%{opacity:1}95%,100%{opacity:0}}"
           ).replace("DURF", str(v.dur(3.0))).replace("DUR", str(v.dur(11)))
    return _wrap("".join(body), css, f"HVAC {mode}", dark, off, v)

BUILDERS.update({"concrete":concrete, "electrical":electrical, "hvac":hvac})

# ------------------------------------------------------------------ PEST
def pest(dark, acc, off, seed, variant=None):
    v = Vary(seed, 3); v.acc = acc
    if variant is not None: v.variant = variant % 3
    mode = ["perimeter","season","sweep"][v.variant]
    cx, cy = v.ax(W,.07), 455
    body=[]
    if mode == "perimeter":
        hw,hh,rh = 105,72,44
        body.append(f'<path class="dw" d="M{cx-hw:.0f},{cy+hh:.0f} L{cx-hw:.0f},{cy-hh:.0f} L{cx:.0f},{cy-hh-rh:.0f} '
                    f'L{cx+hw:.0f},{cy-hh:.0f} L{cx+hw:.0f},{cy+hh:.0f} Z" pathLength="100" stroke="{acc}" '
                    f'stroke-width="4.5" fill="none" style="animation-delay:.2s"/>')
        for i in range(v.count(4,6,7)):
            pad=150+i*68
            body.append(f'<rect class="rg" x="{cx-pad:.0f}" y="{cy-pad*.66:.0f}" width="{pad*2:.0f}" height="{pad*1.32:.0f}" '
                        f'rx="{pad*.5:.0f}" fill="none" stroke="{acc}" stroke-width="{2.8-i*.24:.1f}" '
                        f'opacity="{max(.5-i*.06,.10):.2f}" style="animation-delay:{i*.34:.2f}s"/>')
        for i in range(v.count(50,90,130)):
            a=v.f(0,2*math.pi); r=v.f(300,600)
            body.append(f'<circle class="sp" cx="{cx+r*math.cos(a):.0f}" cy="{cy+r*math.sin(a)*.62:.0f}" '
                        f'r="{v.f(1.2,3):.1f}" fill="{acc}" opacity="{v.f(.2,.6):.2f}"/>')
    elif mode == "season":
        R,r = 300,150
        for i in range(4):
            a0=-math.pi/2+i*math.pi/2+.035; a1=a0+math.pi/2-.07
            x0,y0=cx+R*math.cos(a0),cy+R*math.sin(a0); x1,y1=cx+R*math.cos(a1),cy+R*math.sin(a1)
            xi1,yi1=cx+r*math.cos(a1),cy+r*math.sin(a1); xi0,yi0=cx+r*math.cos(a0),cy+r*math.sin(a0)
            body.append(f'<path class="st" d="M{x0:.0f},{y0:.0f} A{R},{R} 0 0 1 {x1:.0f},{y1:.0f} L{xi1:.0f},{yi1:.0f} '
                        f'A{r},{r} 0 0 0 {xi0:.0f},{yi0:.0f} Z" fill="{acc}" opacity="{[.9,.66,.42,.24][i]}" '
                        f'style="animation-delay:{i*.4:.2f}s"/>')
        for i in range(48):
            a=i*2*math.pi/48; r0,r1=(R+22,R+42) if i%12==0 else (R+24,R+34)
            body.append(f'<line x1="{cx+r0*math.cos(a):.0f}" y1="{cy+r0*math.sin(a):.0f}" x2="{cx+r1*math.cos(a):.0f}" '
                        f'y2="{cy+r1*math.sin(a):.0f}" stroke="{off}" stroke-width="{3 if i%12==0 else 1.4}" opacity="{.5 if i%12==0 else .2}"/>')
    else:  # sweep — inspection grid cleared row by row
        cols,rws = v.count(7,9,11), v.count(4,5,6)
        gx,gy,gw,gh = cx-380, SAFE[0]+25, 760, 340
        for r_ in range(rws):
            for c in range(cols):
                body.append(f'<rect class="st" x="{gx+c*gw/cols+3:.0f}" y="{gy+r_*gh/rws+3:.0f}" '
                            f'width="{gw/cols-6:.0f}" height="{gh/rws-6:.0f}" rx="3" fill="{acc}" '
                            f'opacity="{.12+((r_+c)%3)*.06:.2f}" style="animation-delay:{(r_*cols+c)*.035:.2f}s"/>')
        body.append(f'<g class="sweepbar"><rect x="{gx-10:.0f}" y="{gy-20:.0f}" width="20" height="{gh+40:.0f}" rx="4" fill="{off}" opacity=".85"/></g>')
    css=(DRAW.format(sel=".dw",d=v.dur(11))+
         ".rg{animation:rg DURFs ease-out infinite;transform-origin:CXpx CYpx}"
         "@keyframes rg{0%{transform:scale(.72);opacity:0}34%{opacity:.5}100%{transform:scale(1.1);opacity:0}}"
         ".sp{animation:sp 5s ease-in-out infinite}@keyframes sp{0%,100%{opacity:.2}50%{opacity:.6}}"
         ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
         "@keyframes stg{0%,6%{opacity:0;transform:scale(.85)}24%{opacity:1;transform:scale(1)}84%{opacity:1}95%,100%{opacity:0}}"
         ".sweepbar{opacity:0;animation:swb DURs ease-in-out infinite}"
         "@keyframes swb{0%,20%{transform:translateX(0);opacity:0}26%{opacity:1}74%{transform:translateX(760px);opacity:1}82%,100%{opacity:0}}"
         ).replace("DURF",str(v.dur(4.4))).replace("DUR",str(v.dur(11))).replace("CX",str(int(cx))).replace("CY",str(int(cy)))
    return _wrap("".join(body), css, f"Pest control {mode}", dark, off, v)

# ------------------------------------------------------------------ PLUMBING
def plumbing(dark, acc, off, seed, variant=None):
    v = Vary(seed, 2); v.acc = acc
    if variant is not None: v.variant = variant % 2
    body=[]
    if v.variant == 0:
        d="M120,600 L300,600 L300,420 L560,420 L560,300 L840,300 L840,560 L1080,560"
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{off}" stroke-width="22" opacity=".30" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="{d}" pathLength="100" stroke="{acc}" stroke-width="13" opacity=".42" fill="none" style="animation-delay:.25s"/>')
        body.append(f'<path class="cur" d="{d}" fill="none" stroke="{acc}" stroke-width="9" stroke-dasharray="30 70" stroke-linecap="round"/>')
        for jx,jy in [(300,600),(300,420),(560,420),(560,300),(840,300),(840,560)]:
            body.append(f'<circle cx="{jx}" cy="{jy}" r="18" fill="{dark}" stroke="{off}" stroke-width="3.5" opacity=".55"/>')
        body.append('<g class="valve" transform="translate(560,300)">'+f'<circle r="46" fill="{dark}" opacity=".8"/>'
            +f'<circle r="46" fill="none" stroke="{off}" stroke-width="4.5" opacity=".8"/>'
            +"".join(f'<line x1="0" y1="0" x2="{46*math.cos(a):.1f}" y2="{46*math.sin(a):.1f}" stroke="{off}" stroke-width="4" opacity=".8"/>' for a in [i*math.pi/3 for i in range(6)])+'</g>')
    else:  # DWV riser stack
        sx = v.ax(W,.10)
        body.append(f'<path class="dw" d="M{sx:.0f},{SAFE[1]+30:.0f} L{sx:.0f},{SAFE[0]-30:.0f}" pathLength="100" '
                    f'stroke="{off}" stroke-width="26" opacity=".26" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="M{sx:.0f},{SAFE[1]+30:.0f} L{sx:.0f},{SAFE[0]-30:.0f}" pathLength="100" '
                    f'stroke="{acc}" stroke-width="14" opacity=".45" fill="none" style="animation-delay:.2s"/>')
        n=v.count(3,4,5)
        for i in range(n):
            y=SAFE[0]+40+i*(SAFE[1]-SAFE[0]-60)/max(n-1,1); side = 1 if i%2==0 else -1
            ex = sx+side*v.f(200,300)
            body.append(f'<path class="dw" d="M{sx:.0f},{y:.0f} L{ex:.0f},{y:.0f}" pathLength="100" stroke="{acc}" '
                        f'stroke-width="8" opacity=".6" fill="none" style="animation-delay:{.7+i*.24:.2f}s"/>')
            body.append(f'<path class="cur" d="M{ex:.0f},{y:.0f} L{sx:.0f},{y:.0f}" fill="none" stroke="{acc}" stroke-width="7" stroke-dasharray="16 46"/>')
            body.append(f'<rect class="st" x="{ex-(30 if side>0 else 30):.0f}" y="{y-26:.0f}" width="60" height="52" rx="7" '
                        f'fill="{dark}" stroke="{off}" stroke-width="3.5" opacity=".85" style="animation-delay:{1.2+i*.2:.2f}s"/>')
        body.append(f'<path class="cur" d="M{sx:.0f},{SAFE[0]-20:.0f} L{sx:.0f},{SAFE[1]+20:.0f}" fill="none" stroke="{acc}" stroke-width="10" stroke-dasharray="26 74" stroke-linecap="round"/>')
    css=(DRAW.format(sel=".dw",d=v.dur(11))+
         ".cur{animation:fl DURFs linear infinite}@keyframes fl{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}"
         ".valve{animation:vv DURs ease-in-out infinite;transform-origin:560px 300px}"
         "@keyframes vv{0%,20%{transform:translate(560px,300px) rotate(0deg)}45%{transform:translate(560px,300px) rotate(150deg)}100%{transform:translate(560px,300px) rotate(150deg)}}"
         ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
         "@keyframes stg{0%,12%{opacity:0;transform:scale(.7)}30%{opacity:1;transform:scale(1)}84%{opacity:1}95%,100%{opacity:0}}"
         ).replace("DURF",str(v.dur(2.4))).replace("DUR",str(v.dur(11)))
    return _wrap("".join(body), css, "Plumbing run" if v.variant==0 else "Plumbing riser stack", dark, off, v)

# ------------------------------------------------------------------ INSULATION / GC / REMODEL
def insulation(dark, acc, off, seed, variant=None):
    v = Vary(seed, 2); v.acc = acc
    if variant is not None: v.variant = variant % 2
    body=[]
    if v.variant == 0:
        hx0,hx1,hy0,hy1 = v.ax(W,.06)-300, v.ax(W,.06)+300, 360, 640
        body.append(f'<path class="dw" d="M{hx0:.0f},{hy1:.0f} L{hx0:.0f},{hy0:.0f} L{(hx0+hx1)/2:.0f},{hy0-120:.0f} '
                    f'L{hx1:.0f},{hy0:.0f} L{hx1:.0f},{hy1:.0f} Z" pathLength="100" stroke="{off}" stroke-width="5" '
                    f'fill="none" opacity=".6" style="animation-delay:0s"/>')
        for i in range(v.count(10,14,18)):
            x=v.f(hx0+20,hx1-20)
            body.append(f'<g class="heat" style="animation-delay:{v.f(0,2.4):.2f}s"><path d="M{x:.0f},{hy1-30:.0f} '
                        f'q14,-46 0,-92 q-14,-46 0,-92" fill="none" stroke="{acc}" stroke-width="3.4" stroke-linecap="round" opacity=".85"/></g>')
        body.append(f'<g class="barrier"><rect x="{hx0-18:.0f}" y="{hy0-140:.0f}" width="{hx1-hx0+36:.0f}" '
                    f'height="{hy1-hy0+146:.0f}" rx="18" fill="none" stroke="{acc}" stroke-width="9"/>'
                    f'<rect x="{hx0-18:.0f}" y="{hy0-140:.0f}" width="{hx1-hx0+36:.0f}" height="{hy1-hy0+146:.0f}" rx="18" fill="{acc}" opacity=".12"/></g>')
    else:  # wall section, layers packing in
        x0,y0,w,h = v.ax(W,.07)-360, SAFE[0]+30, 720, 300
        names=[("sheathing",.14,off,.22),("cavity",.46,acc,.30),("batt",.26,acc,.5),("drywall",.14,off,.30)]
        xx=x0
        for i,(nm,frac,col,op) in enumerate(names):
            lw=w*frac
            body.append(f'<rect class="st" x="{xx:.0f}" y="{y0:.0f}" width="{lw:.0f}" height="{h}" fill="{col}" opacity="{op}" style="animation-delay:{i*.36:.2f}s"/>')
            body.append(f'<rect class="st" x="{xx:.0f}" y="{y0:.0f}" width="{lw:.0f}" height="{h}" fill="none" stroke="{off}" stroke-width="2" opacity=".35" style="animation-delay:{i*.36:.2f}s"/>')
            xx+=lw
        for i in range(v.count(5,7,9)):
            sy=y0+16+i*(h-32)/max(v.count(5,7,9)-1,1)
            body.append(f'<path class="dw" d="M{x0+w*.16:.0f},{sy:.0f} q30,-14 60,0 q30,14 60,0 q30,-14 60,0" pathLength="100" '
                        f'stroke="{off}" stroke-width="2.4" fill="none" opacity=".3" style="animation-delay:{1.4+i*.09:.2f}s"/>')
    css=(DRAW.format(sel=".dw",d=v.dur(11))+
         ".heat{animation:ht 3.2s ease-out infinite;opacity:0}"
         "@keyframes ht{0%{opacity:0;transform:translateY(0) scale(.8)}20%{opacity:.85}100%{opacity:0;transform:translateY(-290px) scale(1.3)}}"
         ".barrier{opacity:0;animation:br DURs ease-in-out infinite;transform-origin:center}"
         "@keyframes br{0%,42%{opacity:0;transform:scale(1.12)}58%{opacity:1;transform:scale(1)}86%{opacity:1}96%,100%{opacity:0}}"
         ".st{opacity:0;animation:stg DURs ease-in-out infinite}"
         "@keyframes stg{0%,6%{opacity:0;transform:scaleX(.4)}26%{opacity:1;transform:scaleX(1)}84%{opacity:1}95%,100%{opacity:0}}"
         ).replace("DUR",str(v.dur(11)))
    return _wrap("".join(body), css, "Insulation barrier" if v.variant==0 else "Insulated wall section", dark, off, v)

def gc(dark, acc, off, seed, variant=None):
    v = Vary(seed, 2); v.acc = acc
    if variant is not None: v.variant = variant % 2
    y=640; body=[f'<path class="dw" d="M150,{y} L1050,{y}" pathLength="100" stroke="{off}" stroke-width="4" opacity=".3" fill="none" style="animation-delay:0s"/>']
    ph=[180,360,540,720,900][:v.count(4,5,5)]
    for i,x in enumerate(ph):
        bh=70+i*74
        body.append(f'<rect class="st" x="{x-48:.0f}" y="{y-70-bh:.0f}" width="96" height="{bh}" rx="4" fill="{acc}" opacity=".22" style="animation-delay:{i*.5:.2f}s"/>')
        body.append(f'<rect class="st" x="{x-48:.0f}" y="{y-70-bh:.0f}" width="96" height="{bh}" rx="4" fill="none" stroke="{acc}" stroke-width="2.6" opacity=".72" style="animation-delay:{i*.5:.2f}s"/>')
        body.append(f'<circle class="st" cx="{x}" cy="{y}" r="16" fill="{dark}" stroke="{acc}" stroke-width="4" style="animation-delay:{i*.5:.2f}s"/>')
    body.append(f'<path class="dw" d="M{ph[0]},{y} L{ph[-1]},{y}" pathLength="100" stroke="{acc}" stroke-width="6" fill="none" stroke-linecap="round" style="animation-delay:.3s"/>')
    css=(DRAW.format(sel=".dw",d=v.dur(11))+
         ".st{opacity:0;transform-origin:center bottom;animation:stg DURs ease-in-out infinite}"
         "@keyframes stg{0%,8%{opacity:0;transform:scaleY(0)}26%{opacity:1;transform:scaleY(1)}84%{opacity:1}95%,100%{opacity:0}}"
         ).replace("DUR",str(v.dur(11)))
    return _wrap("".join(body), css, "Project phase timeline", dark, off, v)

def remodel(dark, acc, off, seed, variant=None):
    v = Vary(seed, 2); v.acc = acc
    if variant is not None: v.variant = variant % 2
    body=[]
    if v.variant == 0:
        x0,y0,w,h = v.ax(W,.06)-400, SAFE[0]+10, 800, 380
        body.append(f'<path class="dw" d="M{x0:.0f},{y0+h:.0f} L{x0:.0f},{y0:.0f} L{x0+w:.0f},{y0:.0f} L{x0+w:.0f},{y0+h:.0f} Z" pathLength="100" stroke="{acc}" stroke-width="5" fill="none" style="animation-delay:0s"/>')
        body.append(f'<path class="dw" d="M{x0+w*.5:.0f},{y0+h:.0f} L{x0+w*.5:.0f},{y0+h*.45:.0f}" pathLength="100" stroke="{acc}" stroke-width="4" opacity=".8" fill="none" style="animation-delay:1.1s"/>')
        body.append(f'<path class="dw" d="M{x0+w*.5:.0f},{y0+h*.45:.0f} L{x0+w:.0f},{y0+h*.45:.0f}" pathLength="100" stroke="{acc}" stroke-width="4" opacity=".8" fill="none" style="animation-delay:1.4s"/>')
        for i,(fx,fy,fw,fh) in enumerate([(.06,.10,.16,.24),(.30,.10,.17,.26),(.56,.10,.20,.26),(.80,.10,.15,.24),(.08,.62,.20,.16),(.58,.60,.18,.30),(.80,.60,.15,.30)]):
            body.append(f'<rect class="fx" x="{x0+w*fx:.0f}" y="{y0+h*fy:.0f}" width="{w*fw:.0f}" height="{h*fh:.0f}" rx="6" fill="{acc}" opacity=".2" style="animation-delay:{2.6+i*.2:.2f}s"/>')
            body.append(f'<rect class="fx" x="{x0+w*fx:.0f}" y="{y0+h*fy:.0f}" width="{w*fw:.0f}" height="{h*fh:.0f}" rx="6" fill="none" stroke="{acc}" stroke-width="2.4" opacity=".78" style="animation-delay:{2.6+i*.2:.2f}s"/>')
    else:  # elevation, old wall wiped away to new
        x0,y0,w,h = v.ax(W,.06)-380, SAFE[0]+20, 760, 340
        body.append(f'<clipPath id="el"><rect x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}"/></clipPath>')
        body.append(f'<g clip-path="url(#el)"><rect class="wipe" x="{x0:.0f}" y="{y0:.0f}" width="{w}" height="{h}" fill="{acc}" opacity=".26"/></g>')
        body.append(f'<path class="dw" d="M{x0:.0f},{y0+h:.0f} L{x0:.0f},{y0:.0f} L{x0+w:.0f},{y0:.0f} L{x0+w:.0f},{y0+h:.0f} Z" pathLength="100" stroke="{off}" stroke-width="5" fill="none" style="animation-delay:0s"/>')
        for i in range(v.count(4,6,8)):
            xx=x0+w*(i+1)/(v.count(4,6,8)+1)
            body.append(f'<path class="dw" d="M{xx:.0f},{y0+12:.0f} L{xx:.0f},{y0+h-12:.0f}" pathLength="100" stroke="{off}" stroke-width="2.4" opacity=".28" fill="none" style="animation-delay:{.5+i*.12:.2f}s"/>')
        body.append(f'<g class="sweepbar"><rect x="{x0-10:.0f}" y="{y0-22:.0f}" width="20" height="{h+44}" rx="4" fill="{off}" opacity=".9"/></g>')
    css=(DRAW.format(sel=".dw",d=v.dur(11))+
         ".fx{opacity:0;animation:fx DURs ease-in-out infinite}"
         "@keyframes fx{0%,26%{opacity:0;transform:translateY(-12px)}42%{opacity:1;transform:translateY(0)}84%{opacity:1}95%,100%{opacity:0}}"
         ".wipe{transform-origin:left center;animation:wp DURs ease-in-out infinite}"
         "@keyframes wp{0%,14%{transform:scaleX(0)}52%{transform:scaleX(1)}86%{transform:scaleX(1);opacity:.26}96%,100%{opacity:0}}"
         ".sweepbar{opacity:0;animation:swb DURs ease-in-out infinite}"
         "@keyframes swb{0%,14%{transform:translateX(0);opacity:0}20%{opacity:1}56%{transform:translateX(760px);opacity:1}66%,100%{opacity:0}}"
         ).replace("DUR",str(v.dur(11)))
    return _wrap("".join(body), css, "Remodel floor plan" if v.variant==0 else "Elevation refinish", dark, off, v)

BUILDERS.update({"pest":pest,"plumbing":plumbing,"insulation":insulation,"gc":gc,"remodel":remodel})
