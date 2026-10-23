#!/usr/bin/env python3
"""Pick the Facebook DM threads that are due for a Touch 2 video.

Reads demo/status.json. A slug is due when all of these hold:
  * fb_dm.sent exists (Touch 1 went out on Messenger)
  * fb_dm.t2_video is not set (no video attached yet)
  * fb_dm.status is not declined / closed / do-not-contact
  * EITHER the prospect replied (fb_dm.replied, a real reply, not auto_reply)
    OR Touch 1 is at least MIN_DAYS old with no reply
  * the mockup folder exists with index.html

usage: select.py [--days 4] [--cap 5] [--json]
"""
import argparse, datetime as dt, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
STATUS = os.path.join(ROOT, "demo", "status.json")
SKIP_STATUS = {"declined", "closed", "dnc", "do-not-contact", "lost", "client"}


def due(days=4, cap=5):
    today = dt.date.today()
    data = json.load(open(STATUS))
    out = []
    for slug, rec in data.items():
        fb = rec.get("fb_dm")
        if not isinstance(fb, dict) or not fb.get("sent") or fb.get("t2_video"):
            continue
        if str(fb.get("status", "")).lower() in SKIP_STATUS:
            continue
        if not os.path.isfile(os.path.join(ROOT, "demo", slug, "index.html")):
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
                    "reason": reason, "fb": rec.get("fb", "")})
    # replies first, then oldest Touch 1 first
    out.sort(key=lambda r: (not r["replied"], -r["age_days"]))
    return out[:cap]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=4)
    ap.add_argument("--cap", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    rows = due(a.days, a.cap)
    if a.json:
        print(json.dumps(rows, indent=1))
    else:
        for r in rows:
            print(f"{r['slug']:48s} {r['reason']:24s} {r['fb']}")
        if not rows:
            print("nothing due", file=sys.stderr)
