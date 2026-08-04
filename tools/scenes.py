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
