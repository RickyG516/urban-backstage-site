#!/usr/bin/env python3
"""Pick the Facebook DM threads that are due for a Touch 2 video.

Reads demo/status.json. A slug is due when all of these hold:
  * fb_dm.sent exists (Touch 1 went out on Messenger)
  * fb_dm.t2_video / t2_sent is not set (no video attached or sent yet)
  * neither fb_dm.status nor the record-level status is declined / closed / dnc
  * EITHER the prospect replied (fb_dm.replied, a real reply, not auto_reply)
    OR Touch 1 is at least MIN_DAYS old with no reply
  * the mockup folder exists with index.html

Each row also reports `photos` (count of usable hook photos in the mockup folder,
same rule as build.py). 0 means build.py will fall back to mockup screenshots for
the hook. `--require-photos` drops those rows instead.

usage: select.py [--days 4] [--cap 5] [--json] [--require-photos]
"""
import argparse, datetime as dt, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
STATUS = os.path.join(ROOT, "demo", "status.json")
SKIP_STATUS = {"declined", "closed", "dnc", "do-not-contact", "lost", "client", "unsubscribed"}

sys.path.insert(0, HERE)
try:
    from build import hook_photos  # same photo rule as the builder
except Exception:  # pragma: no cover
    hook_photos = None


def photo_count(folder):
    if hook_photos is None:
        return -1
    try:
        return len(hook_photos(folder))
    except Exception:
        return -1


def due(days=4, cap=5, require_photos=False):
    today = dt.date.today()
    data = json.load(open(STATUS))
    out = []
    for slug, rec in data.items():
        fb = rec.get("fb_dm")
        if not isinstance(fb, dict) or not fb.get("sent"):
            continue
        if fb.get("t2_video") or fb.get("t2_video_built") or fb.get("t2_sent"):
            continue
        if str(fb.get("status", "")).lower() in SKIP_STATUS:
            continue
        if str(rec.get("status", "")).lower() in SKIP_STATUS:
            continue  # record-level decline (e.g. "No thanks" reply logged by nightly DMs)
        folder = os.path.join(ROOT, "demo", slug)
        if not os.path.isfile(os.path.join(folder, "index.html")):
            continue
        photos = photo_count(folder)
        if require_photos and photos == 0:
            continue
        try:
            sent = dt.date.fromisoformat(str(fb["sent"])[:10])
        except ValueError:
            continue
        age = (today - sent).days
        replied = bool(fb.get("replied"))
        if replied:
            reason = f"replied {fb['replied']}"
        elif age >= days:
            reason = f"T1 {age}d old, no reply"
        else:
            continue
        out.append({"slug": slug, "sent": str(fb["sent"]), "age_days": age, "replied": replied,
                    "reason": reason, "photos": photos, "fb": rec.get("fb", "")})
    # replies first, then oldest Touch 1 first
    out.sort(key=lambda r: (not r["replied"], -r["age_days"]))
    return out[:cap]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=4)
    ap.add_argument("--cap", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--require-photos", action="store_true",
                    help="drop rows whose mockup has no usable hook photos")
    a = ap.parse_args()
    rows = due(a.days, a.cap, a.require_photos)
    if a.json:
        print(json.dumps(rows, indent=1))
    else:
        for r in rows:
            print(f"{r['slug']:48s} {r['reason']:24s} photos={r['photos']:<2d} {r['fb']}")
        if not rows:
            print("nothing due", file=sys.stderr)
