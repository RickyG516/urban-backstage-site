#!/usr/bin/env python3
"""Make generated SVG assets render their FINISHED state when CSS animation does not run.

WHY: Chrome does not run CSS animations inside an SVG referenced via <img>. Every
generated asset authors its elements at their *initial* state (stroke-dashoffset:100,
opacity:0) and relies on the animation to reveal them, so in an <img> the frame paints
EMPTY. Verified 2026-09-16: the identical SVG inlined into the DOM draws correctly while
the <img> version is blank. MOCKUP-BASELINE's note that "SVGs referenced via <img> do run
their own CSS animations" is wrong and is what let this ship.

WHAT: appends a base ruleset that puts each animated class at its settled state --
stroke-dashoffset:0 and the maximum opacity the class reaches in its own keyframes.
No !important, so a context that DOES run the animation still plays it normally
(keyframes outrank normal declarations). Geometry, timing and colour are untouched,
so variants.fingerprint() is unchanged and no page's uniqueness is affected.
"""
import re, sys, glob, os

def final_state(css, cls):
    m = re.search(r'\.'+re.escape(cls)+r'\{([^}]*)\}', css)
    if not m: return None
    decl = m.group(1)
    anim = re.search(r'animation:\s*([A-Za-z_][\w-]*)', decl)
    out = {}
    if 'stroke-dashoffset' in decl: out['stroke-dashoffset'] = '0'
    if anim:
        kf = re.search(r'@keyframes\s+'+re.escape(anim.group(1))+r'\s*\{(.*?)\}\s*(?=\.|@|$)', css, re.S)
        if kf:
            ops = [float(o) for o in re.findall(r'opacity:\s*([\d.]+)', kf.group(1))]
            if ops: out['opacity'] = ('%g' % max(ops))
    if 'opacity' not in out and re.search(r'opacity:\s*0(?![.\d])', decl):
        out['opacity'] = '1'
    return out or None

def patch(path):
    t = open(path).read()
    m = re.search(r'<style>(.*?)</style>', t, re.S)
    if not m: return False
    css = m.group(1)
    if '/*rest-state*/' in css: return False
    used = sorted({c for v in re.findall(r'class="([^"]+)"', t) for c in v.split()})
    rules = []
    for c in used:
        st = final_state(css, c)
        if st:
            rules.append('.%s{%s}' % (c, ';'.join(f'{k}:{v}' for k, v in st.items())))
    if not rules: return False
    t = t.replace('</style>', '/*rest-state*/' + ''.join(rules) + '</style>', 1)
    open(path, 'w').write(t)
    return True

if __name__ == "__main__":
    targets = sys.argv[1:] or glob.glob('demo/*/motion*.svg')
    n = sum(1 for f in targets if patch(f))
    print(f"patched {n} of {len(targets)} asset files")
