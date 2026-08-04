#!/usr/bin/env python3
"""
Structural variation kernel for spec-mockup generated assets.

The point: two contractors in the same trade must NOT get the same animation
with a different colour. Palette alone is not variation — that is the exact
sameness failure the whole engine exists to prevent.

Every asset derives from the business phone number:
  variant  = which STRUCTURAL composition (genuinely different geometry)
  jitter   = seeded parameter noise within that composition
  anchor   = where the composition sits in frame
  motion   = direction, speed, stagger and easing of the animation

fingerprint() gives a structural hash so a batch can assert no two pages in
the same trade came out alike.
"""
import math, random, hashlib

class Vary:
    def __init__(self, seed:int, n_variants:int):
        self.seed = int(seed)
        self.rng = random.Random(self.seed)
        # variant from a different bit-range than the rng stream, so two
        # businesses with adjacent numbers don't land on the same layout
        self.variant = (self.seed // 7919) % n_variants
        self.anchor  = self.rng.choice(["left","center","right"])
        self.flip    = self.rng.random() < 0.5
        self.speed   = round(self.rng.uniform(0.80, 1.30), 3)
        self.stagger = round(self.rng.uniform(0.06, 0.34), 3)
        self.rot     = round(self.rng.uniform(-8, 8), 2)
        self.density = self.rng.choice(["sparse","medium","dense"])

    def f(self, lo, hi):   return self.rng.uniform(lo, hi)
    def i(self, lo, hi):   return self.rng.randint(lo, hi)
    def pick(self, seq):   return self.rng.choice(seq)
    def dur(self, base):   return round(base / self.speed, 2)

    def count(self, sparse, medium, dense):
        return {"sparse":sparse,"medium":medium,"dense":dense}[self.density]

    def ax(self, W, spread=0.18):
        """Horizontal anchor point for the composition."""
        return {"left":W*(0.5-spread),"center":W*0.5,"right":W*(0.5+spread)}[self.anchor]

    def describe(self):
        return (f"v{self.variant} {self.anchor}"
                f"{' flip' if self.flip else ''} {self.density} "
                f"x{self.speed} rot{self.rot}")

def fingerprint(svg:str) -> str:
    """Structural hash — ignores colour, keeps geometry and timing."""
    import re
    geo = re.findall(r'\sd="([^"]+)"|\scx="([\d.]+)"|\scy="([\d.]+)"|\br="([\d.]+)"'
                     r'|\bx="([\d.-]+)"|\by="([\d.-]+)"|animation-delay:([\d.]+)s', svg)
    flat = "|".join("".join(t for t in g if t) for g in geo)
    return hashlib.sha1(flat.encode()).hexdigest()[:12]

def assert_unique(pairs, label=""):
    """pairs: [(slug, svg_text)]. Raises if any two share a fingerprint."""
    seen = {}
    dupes = []
    for slug, svg in pairs:
        fp = fingerprint(svg)
        if fp in seen:
            dupes.append((seen[fp], slug, fp))
        seen[fp] = slug
    if dupes:
        raise SystemExit(f"DUPLICATE COMPOSITIONS {label}: {dupes}")
    return len(seen)
