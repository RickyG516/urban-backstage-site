#!/usr/bin/env python3
"""
Composition grammar for spec-mockup animated assets.

Instead of one hand-drawn scene per trade (which makes all 9 concrete pages
identical), a scene is assembled from:

    SUBJECT   trade-specific geometry (slab, panel, pipe run, roof plane...)
  x MOTION    how it animates (draw, fill-rise, sweep, flow, stage, radiate...)
  x LAYOUT    anchor, rotation, density, direction, timing

Seeded off the business phone number, so the combination is deterministic per
business and the space is large enough that same-trade collisions do not occur.
"""
import math, sys
sys.path.insert(0, "/root/ubs/tools")
from variants import Vary

W, H = 1200, 900

# ---------------------------------------------------------------- SUBJECTS
def subj_slab(v):
    """Rectangular form — concrete, flooring, painting panel."""
    cx = v.ax(W, 0.10); w = v.f(700, 860); h = v.f(240, 330)
    x0, y0 = cx - w/2, v.f(330, 420)
    return dict(kind="rect", box=(x0, y0, w, h),
                path=f"M{x0:.0f},{y0+h:.0f} L{x0:.0f},{y0:.0f} L{x0+w:.0f},{y0:.0f} L{x0+w:.0f},{y0+h:.0f} Z")

def subj_gable(v):
    """Pitched roof / frame — roofing, gc, remodel, insulation."""
    cx = v.ax(W, 0.12); w = v.f(560, 760); wall = v.f(150, 230); rise = v.f(150, 240)
    x0 = cx - w/2; ybase = v.f(600, 690); ytop = ybase - wall
    return dict(kind="gable", apex=(cx, ytop - rise),
                path=(f"M{x0:.0f},{ybase:.0f} L{x0:.0f},{ytop:.0f} L{cx:.0f},{ytop-rise:.0f} "
                      f"L{x0+w:.0f},{ytop:.0f} L{x0+w:.0f},{ybase:.0f}"),
                roof=f"M{x0-30:.0f},{ytop:.0f} L{cx:.0f},{ytop-rise:.0f} L{x0+w+30:.0f},{ytop:.0f}")

def subj_run(v):
    """Orthogonal routed run — plumbing, electrical, hvac duct."""
    pts = [(v.f(110,170), v.f(660,740))]
    x, y = pts[0]
    segs = v.count(4, 5, 7)
    for i in range(segs):
        if i % 2 == 0: x += v.f(150, 300)
        else:          y -= v.f(110, 210)
        pts.append((x, y))
    pts.append((min(x + v.f(120, 220), W-90), y))
    d = "M" + " L".join(f"{px:.0f},{py:.0f}" for px, py in pts)
    return dict(kind="run", pts=pts, path=d)

def subj_field(v):
    """Repeating parallel bands — landscaping stripes, siding, flooring runs."""
    n = v.count(7, 10, 14); rows = []
    y = v.f(180, 250); gap = (H - y - 120) / n
    for i in range(n):
        x0 = v.f(150, 300); w = v.f(420, 800)
        rows.append((x0, y + i*gap, w, gap*v.f(0.42, 0.62)))
    return dict(kind="field", rows=rows)

def subj_radial(v):
    """Hub with spokes — tree canopy, service radius, pest perimeter."""
    cx, cy = v.ax(W, 0.08), v.f(420, 500)
    return dict(kind="radial", c=(cx, cy),
                rings=[v.f(90,130)+i*v.f(70,100) for i in range(v.count(3,4,5))],
                spokes=v.count(6, 9, 12))

SUBJECTS = {
 "concrete":[subj_slab, subj_field, subj_run], "flooring":[subj_field, subj_slab],
 "painting":[subj_field, subj_gable, subj_slab], "roofing":[subj_gable, subj_field],
 "gc":[subj_gable, subj_slab, subj_field], "remodel":[subj_slab, subj_gable, subj_field],
 "insulation":[subj_gable, subj_field], "electrical":[subj_run, subj_radial, subj_field],
 "plumbing":[subj_run, subj_radial], "hvac":[subj_run, subj_radial, subj_field],
 "landscaping":[subj_field, subj_radial], "tree":[subj_radial, subj_field],
 "pest":[subj_radial, subj_gable], "default":[subj_slab, subj_radial, subj_field],
}

# ---------------------------------------------------------------- MOTIONS
def m_draw(s, v, acc, off):
    """Geometry draws itself stroke by stroke."""
    paths = _paths_of(s, v)
    body = "".join(
        f'<path class="dw" d="{d}" pathLength="100" stroke="{acc if i%3 else off}" '
        f'stroke-width="{v.f(2.4,5.2):.1f}" opacity="{v.f(.55,1):.2f}" fill="none" '
        f'stroke-linecap="round" stroke-linejoin="round" '
        f'style="animation-delay:{i*v.stagger:.2f}s"/>' for i, d in enumerate(paths))
    css = (f".dw{{stroke-dasharray:100;stroke-dashoffset:100;animation:dw {v.dur(11)}s ease-in-out infinite}}"
           "@keyframes dw{0%{stroke-dashoffset:100}24%{stroke-dashoffset:0}84%{stroke-dashoffset:0;opacity:1}"
           "95%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:100;opacity:0}}")
    return body, css

def m_flow(s, v, acc, off):
    """Travelling dashes along the geometry — current, water, air."""
    paths = _paths_of(s, v)
    body = ""
    for i, d in enumerate(paths):
        body += (f'<path d="{d}" stroke="{off}" stroke-width="{v.f(9,17):.1f}" opacity=".14" fill="none" stroke-linecap="round"/>'
                 f'<path class="fl" d="{d}" stroke="{acc}" stroke-width="{v.f(4,8):.1f}" fill="none" '
                 f'stroke-dasharray="{v.f(14,30):.0f} {v.f(60,110):.0f}" stroke-linecap="round" '
                 f'style="animation-delay:{i*v.stagger:.2f}s"/>')
    css = (f".fl{{animation:fl {v.dur(2.4)}s linear infinite}}"
           f"@keyframes fl{{0%{{stroke-dashoffset:{'240' if not v.flip else '-240'}}}100%{{stroke-dashoffset:0}}}}")
    return body, css

def m_rise(s, v, acc, off):
    """Level rises through the form — pour, fill, coverage."""
    x0, y0, w, h = s.get("box", (200, 380, 800, 300))
    body = (f'<clipPath id="cl"><rect x="{x0:.0f}" y="{y0:.0f}" width="{w:.0f}" height="{h:.0f}" rx="6"/></clipPath>'
            f'<g clip-path="url(#cl)"><rect class="rise" x="{x0:.0f}" y="{y0:.0f}" width="{w:.0f}" height="{h:.0f}" fill="{acc}" opacity=".34"/></g>')
    for i, d in enumerate(_paths_of(s, v)):
        body += (f'<path class="dw" d="{d}" pathLength="100" stroke="{acc}" stroke-width="4.5" fill="none" '
                 f'stroke-linejoin="round" style="animation-delay:{i*v.stagger:.2f}s"/>')
    css = (f".rise{{transform-origin:center bottom;animation:rs {v.dur(11)}s ease-in-out infinite}}"
           "@keyframes rs{0%,16%{transform:scaleY(0)}48%{transform:scaleY(1)}86%{transform:scaleY(1);opacity:.34}96%,100%{opacity:0}}"
           f".dw{{stroke-dasharray:100;stroke-dashoffset:100;animation:dw {v.dur(11)}s ease-in-out infinite}}"
           "@keyframes dw{0%{stroke-dashoffset:100}22%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}")
    return body, css

def m_sweep(s, v, acc, off):
    """A bar sweeps across, revealing/finishing as it goes."""
    x0, y0, w, h = s.get("box", (200, 380, 800, 300))
    d = -1 if v.flip else 1
    body = (f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{w:.0f}" height="{h:.0f}" rx="6" fill="{acc}" opacity=".12"/>'
            f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{w:.0f}" height="{h:.0f}" rx="6" fill="none" stroke="{acc}" stroke-width="4"/>'
            f'<g class="sw"><rect x="{(x0 if d>0 else x0+w):.0f}" y="{y0-24:.0f}" width="22" height="{h+48:.0f}" rx="4" fill="{off}" opacity=".9"/></g>')
    for i in range(v.count(4, 6, 9)):
        yy = y0 + (i+1)*h/(v.count(4,6,9)+1)
        body += (f'<line class="ln" x1="{x0+16:.0f}" y1="{yy:.0f}" x2="{x0+w-16:.0f}" y2="{yy:.0f}" '
                 f'stroke="{off}" stroke-width="1.6" opacity=".22" style="animation-delay:{i*v.stagger:.2f}s"/>')
    css = (f".sw{{animation:sw {v.dur(6)}s ease-in-out infinite}}"
           f"@keyframes sw{{0%{{transform:translateX(0);opacity:0}}8%{{opacity:1}}"
           f"78%{{transform:translateX({d*(w-22):.0f}px);opacity:1}}88%,100%{{opacity:0}}}}"
           f".ln{{opacity:0;animation:ln {v.dur(6)}s ease-in-out infinite}}"
           "@keyframes ln{0%{opacity:0}30%{opacity:.22}86%{opacity:.22}100%{opacity:0}}")
    return body, css

def m_stage(s, v, acc, off):
    """Elements arrive in sequence — phases, layers, build-up."""
    rows = s.get("rows") or [(200+i*90, 700-i*70, 300+i*40, 44) for i in range(6)]
    body = ""
    for i, (x, y, w, h) in enumerate(rows):
        body += (f'<rect class="st" x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{max(h,14):.0f}" rx="5" '
                 f'fill="{acc}" opacity="{0.14+ (i%4)*0.06:.2f}" style="animation-delay:{i*v.stagger:.2f}s"/>'
                 f'<rect class="st" x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{max(h,14):.0f}" rx="5" '
                 f'fill="none" stroke="{acc}" stroke-width="2" opacity=".6" style="animation-delay:{i*v.stagger:.2f}s"/>')
    css = (f".st{{opacity:0;transform-origin:{'right' if v.flip else 'left'} center;animation:st {v.dur(10)}s ease-in-out infinite}}"
           "@keyframes st{0%,6%{opacity:0;transform:scaleX(0)}26%{opacity:1;transform:scaleX(1)}"
           "84%{opacity:1;transform:scaleX(1)}95%,100%{opacity:0}}")
    return body, css

def m_radiate(s, v, acc, off):
    """Rings pulse outward from a hub — coverage, reach, protection."""
    (cx, cy) = s.get("c", (600, 460)); rings = s.get("rings", [130, 220, 310, 400])
    body = ""
    for i in range(s.get("spokes", 9)):
        a = i*math.pi/s.get("spokes", 9) + math.radians(v.rot)
        body += (f'<line x1="{cx-700*math.cos(a):.0f}" y1="{cy-700*math.sin(a):.0f}" '
                 f'x2="{cx+700*math.cos(a):.0f}" y2="{cy+700*math.sin(a):.0f}" stroke="{off}" stroke-width="1.5" opacity=".07"/>')
    for i, r in enumerate(rings):
        body += (f'<circle class="rg" cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="none" stroke="{acc}" '
                 f'stroke-width="{3.0-i*0.4:.1f}" opacity="{0.55-i*0.09:.2f}" '
                 f'stroke-dasharray="{"none" if i==0 else "11 9"}" style="animation-delay:{i*v.stagger*2:.2f}s"/>')
    body += (f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="15" fill="{acc}"/>'
             f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="31" fill="none" stroke="{acc}" stroke-width="3.5"/>')
    css = (f".rg{{animation:rg {v.dur(4.6)}s ease-out infinite;transform-origin:{cx:.0f}px {cy:.0f}px}}"
           "@keyframes rg{0%{transform:scale(.68);opacity:0}32%{opacity:.55}100%{transform:scale(1.14);opacity:0}}")
    return body, css

MOTIONS = {"draw":m_draw, "flow":m_flow, "rise":m_rise, "sweep":m_sweep, "stage":m_stage, "radiate":m_radiate}

# which motions suit which subject kind
FITS = {"rect":["rise","sweep","draw","stage","radiate"],
        "gable":["draw","stage","radiate","sweep","rise"],
        "run":["flow","draw","stage","sweep"],
        "field":["stage","sweep","draw","flow","rise"],
        "radial":["radiate","draw","stage","flow"]}

# LAYOUT is a third structural axis: how many instances of the subject and how
# they sit in frame. Multiplies the family space so a 9-page trade never has to
# reuse a subject/motion/layout combination.
LAYOUTS = ["single", "mirror", "stack", "offset"]

def _layout_wrap(inner, layout, v):
    if layout == "single":
        return f'<g transform="rotate({v.rot:.2f} 600 460)">{inner}</g>'
    if layout == "mirror":
        return (f'<g transform="translate(0,0) scale(.62) translate(180,190) rotate({v.rot:.2f} 600 460)">{inner}</g>'
                f'<g opacity=".55" transform="translate(1200,0) scale(-.62,.62) translate(180,190) rotate({v.rot:.2f} 600 460)">{inner}</g>')
    if layout == "stack":
        return "".join(
            f'<g opacity="{1-0.26*i:.2f}" transform="translate({(-90+90*i)},{(-120+120*i)}) scale({0.92-0.16*i:.2f}) rotate({v.rot+i*3:.2f} 600 460)">{inner}</g>'
            for i in range(3))
    return "".join(  # offset grid
        f'<g opacity="{0.9-0.2*i:.2f}" transform="translate({-200+400*(i%2)},{-150+300*(i//2)}) scale(.5) rotate({v.rot:.2f} 600 460)">{inner}</g>'
        for i in range(4))

def _paths_of(s, v):
    k = s["kind"]
    if k == "rect":  return [s["path"]]
    if k == "gable": return [s["path"], s["roof"]]
    if k == "run":   return [s["path"]]
    if k == "field": return [f'M{x:.0f},{y:.0f} L{x+w:.0f},{y:.0f}' for x, y, w, h in s["rows"]]
    if k == "radial":
        cx, cy = s["c"]
        return [f'M{cx-r:.0f},{cy:.0f} a{r:.0f},{r:.0f} 0 1,0 {2*r:.0f},0 a{r:.0f},{r:.0f} 0 1,0 {-2*r:.0f},0' for r in s["rings"]]
    return [s.get("path", "")]

def families(trade):
    """Every structural combination available to a trade."""
    out = []
    for si, sub in enumerate(SUBJECTS.get(trade, SUBJECTS["default"])):
        probe = sub(Vary(1234567, 8))
        for m in FITS[probe["kind"]]:
            for lay in LAYOUTS:
                out.append((si, m, lay))
    return out

def scene(trade, dark, acc, off, seed, family=None):
    pool = SUBJECTS.get(trade, SUBJECTS["default"])
    v = Vary(seed, len(pool))
    if family is None:
        fam = families(trade)
        family = fam[(seed // 104729) % len(fam)]
    si, motion, layout = family
    s = pool[si % len(pool)](v)
    if motion not in FITS[s["kind"]]:
        motion = FITS[s["kind"]][0]
    body, css = MOTIONS[motion](s, v, acc, off)
    grid = "".join(
        [f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{off}" stroke-width="1" opacity=".03"/>' for x in range(0, W+1, int(v.f(42, 74)))] +
        [f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{off}" stroke-width="1" opacity=".03"/>' for y in range(0, H+1, int(v.f(42, 74)))])
    glow = (f'<defs><radialGradient id="g"><stop offset="0%" stop-color="{acc}" stop-opacity=".22"/>'
            f'<stop offset="100%" stop-color="{acc}" stop-opacity="0"/></radialGradient></defs>'
            f'<circle cx="{v.ax(W,0.16):.0f}" cy="{v.f(380,520):.0f}" r="{v.f(330,450):.0f}" fill="url(#g)"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
           f'role="img" aria-label="{trade} motion graphic"><style>{css}'
           '@media (prefers-reduced-motion: reduce){*{animation:none!important}'
           '.dw{stroke-dashoffset:0!important}.st,.rise,.rg,.sw,.ln{opacity:1!important;transform:none!important}}'
           f'</style><rect width="{W}" height="{H}" fill="{dark}"/>{grid}{glow}'
           f'{_layout_wrap(body, layout, v)}</svg>')
    return svg, f"{trade}/{s['kind']}/{motion}/{layout}/{v.describe()}"


def assign(trade, slugs_seeds):
    """Deterministically spread pages of one trade across distinct families.
    Guarantees zero family reuse while families remain. Sorted by slug so the
    assignment is stable across runs."""
    fam = families(trade)
    items = sorted(slugs_seeds)
    n = len(fam)
    offset = (sum(sd for _, sd in items) // 1013) % n
    # Walk the family list with a stride coprime to its length. Sequential
    # walking clusters neighbours on the same subject/motion and only varies
    # layout, which still reads as a family resemblance. A coprime stride
    # visits every family exactly once while jumping subject and motion each
    # step, so consecutive pages in a trade share no structural axis.
    stride = max(2, n // 3)
    while math.gcd(stride, n) != 1:
        stride += 1
    return {slug: fam[(offset + i * stride) % n] for i, (slug, sd) in enumerate(items)}
