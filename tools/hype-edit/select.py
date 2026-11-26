#!/usr/bin/env python3
"""Pick the Facebook prospects that are due a Touch 1 VIDEO (the video IS the first touch).

Rewritten 2026-11-18: the old text-only Touch 1 / Touch 2 video sequence is retired.
The hype-edit video now goes out as the very first message in the thread.

Reads demo/status.json. A slug is due when all of these hold:
  * rec.fb is set (we know the Facebook page)
  * the mockup folder exists with index.html
  * rec.ready is not false
  * rec.stage is not live / building / rebuild-target (existing-site pitches are a
    different play; the T1 line is written for businesses with no findable website)
  * no VIDEO has gone out yet: fb_dm has no t1_video / t2_video / t2_sent / link_sent
    stamp, and fb_dm.replied is not set. A plain text touch (fb_dm.sent) does NOT block:
    since 2026-11-24 the video also goes into threads that hold only Ricky's own
    outbound text with no reply (rule change by Ricky). t1_video_built alone does not
    block either (built but never delivered).
  * fb_dm.t1_skipped blocks (page not found / they replied) EXCEPT legacy skips whose
    t1_note says "thread not empty" (those were Ricky's-own-text threads, now eligible)
  * neither fb_dm.status nor the record-level status is declined / closed / dnc / client
  * rec.note carries none of the skip phrases (identity failed, dropped, excluded,
    rebuild pitch, personal contact, hand-worked website-build prospects)

Rows are ordered real job photos first (better hook), then generated, then the rest.
Each row carries `photos` (usable hook photos in the mockup folder; 0 is fine, build.py
falls back to mockup stills), `name` (from the mockup <title>, tagline dropped) and `fb`.

The Messenger-side guard lives in the runbook: the thread must hold NO message FROM THE
PROSPECT (empty, or only Ricky's own outbound text) or the slug is skipped at attach time.

usage: select.py [--cap 5] [--json] [--require-photos] [--all]
"""
import argparse, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
STATUS = os.path.join(ROOT, "demo", "status.json")
SKIP_STATUS = {"declined", "closed", "dnc", "do-not-contact", "lost", "client", "unsubscribed",
               "manual-outside-sequence"}
SKIP_STAGE = {"live", "building", "rebuild-target"}
SKIP_NOTE = ("identity failed", "fails identity", "dropped", "excluded", "no longer a no-website",
             "rebuild pitch", "personal contact", "website build prospect", "do not contact")
PHOTO_RANK = {"real": 0, "generated": 1}

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


def mockup_name(folder):
    try:
        head = open(os.path.join(folder, "index.html"), encoding="utf-8", errors="ignore").read(4000)
        m = re.search(r"<title>(.*?)</title>", head, re.S | re.I)
        if m:
            return html.unescape(m.group(1)).split("|")[0].strip()
    except OSError:
        pass
    return ""


STOP = {"llc", "inc", "co", "and", "the", "of", "services", "service", "company"}


def identity_hint(name, fburl):
    """'ok' when the FB vanity slug shares a word with the business name, else 'check'
    (profile.php / numeric ids / unrelated slugs). A 'check' row still runs: the runbook's
    Messenger search + empty-thread rule is the real gate, this just warns."""
    slug = fburl.rstrip("/").split("facebook.com/")[-1].split("?")[0].lower()
    slug = slug.replace("p/", "", 1) if slug.startswith("p/") else slug
    words = [w for w in re.findall(r"[a-z]+", name.lower()) if w not in STOP and len(w) > 2]
    return "ok" if any(w in slug for w in words) else "check"


def due(cap=5, require_photos=False, everything=False, skip_built=False):
    data = json.load(open(STATUS))
    out = []
    for slug, rec in data.items():
        fburl = rec.get("fb")
        if not isinstance(fburl, str) or "facebook.com" not in fburl or "/groups/" in fburl:
            continue  # need a real page URL; groups cannot be messaged
        if rec.get("ready") is False:
            continue
        if str(rec.get("stage", "")).lower() in SKIP_STAGE:
            continue
        if str(rec.get("status", "")).lower() in SKIP_STATUS:
            continue
        note = str(rec.get("note", "")).lower()
        if any(p in note for p in SKIP_NOTE):
            continue
        fb = rec.get("fb_dm") or {}
        if not isinstance(fb, dict):
            fb = {}
        if str(fb.get("status", "")).lower() in SKIP_STATUS:
            continue
        if any(fb.get(k) for k in ("t1_video", "t2_video", "t2_sent", "link_sent", "replied")):
            continue  # a video already went out, or they answered: not a T1 video target
        if fb.get("t1_skipped") and "thread not empty" not in str(fb.get("t1_note", "")).lower():
            continue  # page not found / they replied; legacy my-text-only skips are eligible again
        if skip_built and fb.get("t1_video_built"):
            continue  # build-only days (outreach paused): do not rebuild what is already in Drive
        prior_text = fb.get("sent") or (fb.get("t1_skipped") and "thread not empty" in str(fb.get("t1_note", "")).lower())
        folder = os.path.join(ROOT, "demo", slug)
        if not os.path.isfile(os.path.join(folder, "index.html")):
            continue
        photos = photo_count(folder)
        ptype = str(rec.get("photos", "")).lower()
        if require_photos and (photos == 0 or ptype == "generated"):
            continue  # their OWN job photos or nothing (Ricky, 2026-11-26)
        name = mockup_name(folder)
        out.append({"slug": slug, "name": name, "photos": photos,
                    "photo_type": ptype, "fb": fburl,
                    "identity": identity_hint(name, fburl),
                    "reason": (f"T1 video (follow-up: Ricky's own text already in thread, sent {fb.get('sent') or 'see t1_note'})"
                               if prior_text else "T1 video (first touch)"),
                    "prior_text": bool(prior_text),
                    "_rank": PHOTO_RANK.get(ptype, 2)})
    out.sort(key=lambda r: (r["_rank"], r["prior_text"], -max(r["photos"], 0), r["slug"]))
    for r in out:
        r.pop("_rank", None)
    return out if everything else out[:cap]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cap", type=int, default=5)
    ap.add_argument("--days", type=int, default=0, help="ignored (kept for old callers)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--all", action="store_true", help="show the whole eligible pool, ignore --cap")
    ap.add_argument("--require-photos", dest="require_photos", action="store_true", default=True,
                    help="(default since 2026-11-26, Ricky) drop rows whose mockup has no real job photos")
    ap.add_argument("--allow-no-photos", dest="require_photos", action="store_false",
                    help="old behaviour: include mockups with no job photos (mockup-stills hook)")
    ap.add_argument("--skip-built", action="store_true",
                    help="build-only days: drop rows that already have a t1_video_built stamp")
    a = ap.parse_args()
    rows = due(a.cap, a.require_photos, a.all, a.skip_built)
    if a.json:
        print(json.dumps(rows, indent=1))
    else:
        for r in rows:
            print(f"{r['slug']:46s} {r['name'][:30]:30s} photos={r['photos']:<2d} {r['photo_type']:10s} id={r['identity']:5s} {r['fb']}")
        if not rows:
            print("nothing due", file=sys.stderr)
