#!/usr/bin/env python3
"""Rotate a mockup's slug so a link you already sent stops resolving.

Why this exists
---------------
Telling a prospect "this comes down in three days" only works if it actually
comes down. Deleting the page throws away the work. Renaming the folder kills
the old URL while keeping everything, and the new URL is live immediately - so
when he messages back you just send the current link. There is nothing to
"put back up".

The catch this handles
----------------------
A slug appears in FOUR places and the enrich audit fails the moment they
disagree:

    demo/<slug>/                              the folder
    demo/index.html                           two hrefs in the row
    demo/status.json                          the key
    sales-ops/mockup-reveal/queue/latest.json the mockup_url

Doing that by hand at 9pm before a send is how surfaces drift.

Usage
-----
    python3 tools/reslug.py ia-dietz-enterprises-dbq02
    python3 tools/reslug.py ia-dietz-enterprises-dbq02 --dry-run
    python3 tools/reslug.py ia-dietz-enterprises-dbq02 --to custom-slug

Then commit and push. Run tools/enrich_audit.py afterwards to confirm.
"""
import argparse
import json
import os
import random
import re
import string
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "demo")
INDEX = os.path.join(DEMO, "index.html")
STATUS = os.path.join(DEMO, "status.json")
QUEUE = os.path.join(ROOT, "sales-ops", "mockup-reveal", "queue", "latest.json")

# No vowels: keeps the suffix from accidentally spelling something, and these
# slugs get read aloud on calls.
ALPHABET = "bcdfghjkmnpqrstvwxyz23456789"


def new_suffix(n=6):
    return "".join(random.choice(ALPHABET) for _ in range(n))


def rotate(slug):
    """Strip any existing -<suffix> and add a fresh one."""
    base = re.sub(r"-[a-z0-9]{4,8}$", "", slug)
    return f"{base}-{new_suffix()}"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", help="current slug, e.g. ia-dietz-enterprises-dbq02")
    ap.add_argument("--to", help="explicit new slug instead of a random one")
    ap.add_argument("--dry-run", action="store_true", help="show the changes, write nothing")
    args = ap.parse_args()

    old = args.slug.strip("/")
    src = os.path.join(DEMO, old)
    if not os.path.isdir(src):
        sys.exit(f"no such mockup: demo/{old}")

    new = args.to.strip("/") if args.to else rotate(old)
    if os.path.exists(os.path.join(DEMO, new)):
        sys.exit(f"demo/{new} already exists, pick another")

    idx = open(INDEX, encoding="utf-8").read()
    st = json.load(open(STATUS, encoding="utf-8"))
    q = json.load(open(QUEUE, encoding="utf-8"))

    hits = idx.count(f"/demo/{old}/")
    in_status = old in st
    in_queue = [p for p in q["prospects"] if p.get("mockup_url", "").rstrip("/").endswith(old)]

    print(f"  {old}\n    -> {new}\n")
    print(f"  folder        demo/{old}/  ->  demo/{new}/")
    print(f"  index.html    {hits} href(s)")
    print(f"  status.json   {'key found' if in_status else 'NO KEY (nothing to move)'}")
    print(f"  queue         {len(in_queue)} entry")
    if not hits or not in_status:
        print("\n  WARNING: a surface is already out of sync. Run tools/enrich_audit.py first.")

    if args.dry_run:
        print("\n  dry run, nothing written")
        return

    # 1. folder. git mv keeps history attached to the page.
    try:
        subprocess.run(["git", "mv", f"demo/{old}", f"demo/{new}"],
                       cwd=ROOT, check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        os.rename(src, os.path.join(DEMO, new))

    # 2. index row
    open(INDEX, "w", encoding="utf-8").write(idx.replace(f"/demo/{old}/", f"/demo/{new}/"))

    # 3. status key, preserving position by rebuilding sorted (the file is sorted)
    if in_status:
        st[new] = st.pop(old)
        json.dump(st, open(STATUS, "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False, sort_keys=True)
        open(STATUS, "a", encoding="utf-8").write("\n")

    # 4. queue mockup_url
    for p in in_queue:
        p["mockup_url"] = p["mockup_url"].replace(old, new)
    json.dump(q, open(QUEUE, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    open(QUEUE, "a", encoding="utf-8").write("\n")

    print(f"\n  done. dead link:  https://urbanbackstage.com/demo/{old}/")
    print(f"        live link:  https://urbanbackstage.com/demo/{new}/")
    print("\n  commit and push, then run: python3 tools/enrich_audit.py")


if __name__ == "__main__":
    main()
