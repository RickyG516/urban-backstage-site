#!/usr/bin/env python3
"""Build the Touch 2 video for one mockup slug, end to end.

  python3 build.py ia-some-slug            -> out/<slug>-send.mp4 (under 10 MB, Messenger-ready)
  python3 build.py ia-some-slug --full     -> also keeps the 1080x1920 master

Steps: pick 3 hook photos from the mockup folder, record its mobile scroll,
reuse the cached proof-site scrolls (Kutsch, Fuehrer, New View), render, shrink.
Business name and city come from the mockup's <title>.
First run on a machine also records the three proof sites (about 2 min) and
clones them if they are not already in ../../.proof-sites.
"""
import argparse, html, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, "work")
OUT = os.path.join(HERE, "out")
PROOF_SRC = os.path.join(ROOT, ".proof-sites")
PROOF = [  # repo, record args
    ("kutsch", "kutsch-tree-service-site", []),
    ("fuehrer", "fuehrer-painting", ["--js-speed", "3.5"]),
    ("newview", "new-view-landscaping-site", []),
]
PY = sys.executable


def run(cmd, **kw):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def ensure_proof():
    os.makedirs(PROOF_SRC, exist_ok=True)
    for key, repo, extra in PROOF:
        src = os.path.join(PROOF_SRC, repo)
        if not os.path.isfile(os.path.join(src, "index.html")):
            run(["git", "clone", "--depth", "1", "-q", f"https://github.com/RickyG516/{repo}", src])
        frames = os.path.join(WORK, "clips", key)
        if not os.path.isfile(os.path.join(frames, "meta.json")):
            run([PY, os.path.join(HERE, "record.py"), src, frames, "--seconds", "5", "--max-speed", "480"] + extra)


def ensure_music():
    p = os.path.join(WORK, "music.wav")
    if not os.path.isfile(p):
        run([PY, os.path.join(HERE, "music.py"), p])
    return p


def title_parts(index_html):
    m = re.search(r"<title>([^<]+)</title>", open(index_html, encoding="utf-8", errors="ignore").read(), re.I)
    t = html.unescape(m.group(1)) if m else ""
    parts = [p.strip() for p in t.split("|")]
    name = parts[0] if parts else ""
    city = next((p for p in parts[1:] if re.search(r",\s*[A-Z]{2}\b|Iowa|Illinois|Wisconsin", p)), "")
    if not city and len(parts) > 1 and len(parts[-1]) <= 28:
        city = parts[-1]
    city = re.sub(r"\b(Iowa)\b", "IA", city); city = re.sub(r"\b(Illinois)\b", "IL", city); city = re.sub(r"\b(Wisconsin)\b", "WI", city)
    return name, city


def hook_photos(folder):
    pics = []
    for fn in sorted(os.listdir(folder)):
        if not fn.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        low = fn.lower()
        if any(k in low for k in ("logo", "favicon", "icon", "og-", "og.", "badge", "map", "texture")):
            continue
        pics.append(os.path.join(folder, fn))
    # job photos first, then van/crew, then hero
    def rank(p):
        n = os.path.basename(p).lower()
        return (0 if "job" in n or "photo" in n or "work" in n else 1 if ("van" in n or "truck" in n or "crew" in n or "shop" in n) else 2)
    pics.sort(key=rank)
    return pics[:3]


def main(slug, full=False, days_hint=""):
    folder = os.path.join(ROOT, "demo", slug)
    index = os.path.join(folder, "index.html")
    if not os.path.isfile(index):
        sys.exit(f"no mockup at demo/{slug}")
    os.makedirs(OUT, exist_ok=True)
    ensure_proof()
    music = ensure_music()
    name, city = title_parts(index)
    pics = hook_photos(folder)
    if len(pics) < 3:
        pics = (pics * 3)[:3] if pics else []
    if not pics:
        sys.exit(f"{slug}: no usable photos in the mockup folder, skip (hook needs photos)")
    frames = os.path.join(WORK, "clips", slug)
    if not os.path.isfile(os.path.join(frames, "meta.json")):
        run([PY, os.path.join(HERE, "record.py"), folder, frames, "--seconds", "12.5", "--max-speed", "560"])
    base = json.load(open(os.path.join(HERE, "config.dietz.json")))
    base["music"] = music
    base["lead"] = {"name": name, "city": city, "frames": frames, "cta_frame": 20, "hook_photos": pics}
    for i, (key, _, _) in enumerate(PROOF):
        base["proof"][i]["frames"] = os.path.join(WORK, "clips", key)
    cfg = os.path.join(WORK, f"config.{slug}.json")
    json.dump(base, open(cfg, "w"), indent=1)
    master = os.path.join(OUT, f"{slug}.mp4")
    send = os.path.join(OUT, f"{slug}-send.mp4")
    run([PY, os.path.join(HERE, "render.py"), cfg, master])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", master, "-vf", "scale=810:1440",
         "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", send])
    if not full:
        os.remove(master)
    size = os.path.getsize(send)
    print(json.dumps({"slug": slug, "name": name, "city": city, "send": send, "bytes": size, "photos": [os.path.basename(p) for p in pics]}))
    if size > 9_500_000:
        sys.exit("send file over the 10 MB Messenger upload limit, lower crf")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug"); ap.add_argument("--full", action="store_true")
    a = ap.parse_args()
    main(a.slug, a.full)
