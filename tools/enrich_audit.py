#!/usr/bin/env python3
"""
Enrichment parity audit for the demo mockup library.

Every ACTIVE demo page must exist on all four surfaces, at the same level:

  1. demo/<slug>/index.html          the mockup itself
  2. demo/index.html                 a row carrying a real HubSpot company link
  3. demo/status.json                an entry with the full key set
  4. sales-ops/mockup-reveal/queue/latest.json
                                     a cockpit queue entry keyed by that same
                                     HubSpot id

A page missing any of these is invisible or untrackable somewhere, and the
library drifts. Prose in a task file does not stop that from happening —
this does.

Archived slugs (declared in demo/index.html DEFAULT_ARCHIVED) are deliberately
off the active list and are exempt from surfaces 2's HubSpot link and 4.

Everything is COUNTED, never hardcoded. A hardcoded count has already gone
stale in this library once.

    python3 tools/enrich_audit.py            # report, exit 1 on any gap
    python3 tools/enrich_audit.py --quiet    # exit code only
"""
import os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "demo")
INDEX = os.path.join(DEMO, "index.html")
STATUS = os.path.join(DEMO, "status.json")
QUEUE = os.path.join(ROOT, "sales-ops", "mockup-reveal", "queue", "latest.json")

QUIET = "--quiet" in sys.argv

# Known non-prospects that live in the library but are not contractors and will
# never go into HubSpot or the dial queue. gate.sh carries the same exception.
# Keep this list SHORT and justify every addition — it is a hole in the audit.
KNOWN_NON_PROSPECTS = {"ia-cremers-meats-dubuque"}  # butcher shop, not a trade contractor

STATUS_KEYS = {"channel", "fb", "note", "photos", "ready", "stage"}
QUEUE_KEYS = {"contact_id", "business_name", "first_name", "last_name", "trade",
              "phone", "city", "state", "hubspot_url", "last_touched",
              "last_outcome", "notes_preview", "pipeline_stage", "mockup_url",
              "ai_hook"}


def page_slugs():
    return sorted(
        d for d in os.listdir(DEMO)
        if os.path.isdir(os.path.join(DEMO, d))
        and os.path.isfile(os.path.join(DEMO, d, "index.html"))
    )


def archived_slugs(idx):
    m = re.search(r"DEFAULT_ARCHIVED\s*=\s*\[(.*?)\]", idx, re.S)
    if not m:
        return set()
    return {s.strip("/").replace("demo/", "")
            for s in re.findall(r'"/demo/([^"]+)/"', m.group(1))}


def index_map(idx):
    """slug -> hubspot company id (or None if the row is still a placeholder)."""
    out = {}
    for row in re.findall(r"<tr data-search=.*?</tr>", idx, re.S):
        m = re.search(r"/demo/([^/]+)/", row)
        if not m:
            continue
        hs = re.search(r"record/0-2/(\d+)", row)
        out[m.group(1)] = hs.group(1) if hs else None
    return out


def main():
    idx = open(INDEX, encoding="utf-8").read()
    slugs = page_slugs()
    arch = archived_slugs(idx)
    rows = index_map(idx)
    st = json.load(open(STATUS, encoding="utf-8"))
    q = json.load(open(QUEUE, encoding="utf-8"))
    qids = {str(p.get("contact_id")) for p in q["prospects"]}

    active = [s for s in slugs if s not in arch and s not in KNOWN_NON_PROSPECTS]
    problems = []

    # --- surface 2: index row + HubSpot link
    for s in slugs:
        if s not in rows:
            problems.append(f"no index row: {s}")
    for s in rows:
        if s not in slugs:
            problems.append(f"index row with no page: {s}")
    for s in active:
        if rows.get(s) is None and s in rows:
            problems.append(f"index row not linked to HubSpot: {s}")

    # --- surface 3: status.json
    for s in set(slugs) - set(st):
        problems.append(f"no status.json entry: {s}")
    for s in set(st) - set(slugs):
        problems.append(f"status.json entry with no page: {s}")
    for s, v in st.items():
        missing = STATUS_KEYS - set(v)
        if missing:
            problems.append(f"status.json {s} missing keys: {sorted(missing)}")

    # --- surface 4: cockpit queue, keyed by the SAME HubSpot id as the index
    for s in active:
        hid = rows.get(s)
        if hid and hid not in qids:
            problems.append(f"not in mockup-reveal queue: {s} (company {hid})")
    hs_ids = {v for k, v in rows.items() if v and k not in arch}
    for extra in sorted(qids - hs_ids):
        problems.append(f"queue entry not tied to an active mockup: company {extra}")

    # --- queue internal consistency
    for p in q["prospects"]:
        missing = QUEUE_KEYS - set(p)
        if missing:
            problems.append(f"queue {p.get('business_name')} missing keys: {sorted(missing)}")
    if q.get("_session_cap") != len(q["prospects"]):
        problems.append(
            f"_session_cap {q.get('_session_cap')} != actual prospects {len(q['prospects'])}")
    dupe = len(qids) != len(q["prospects"])
    if dupe:
        problems.append("duplicate contact_id in queue")

    if not QUIET:
        print(f"pages: {len(slugs)}  active: {len(active)}  archived: {len(arch)}")
        print(f"index rows: {len(rows)}  status entries: {len(st)}  "
              f"queue prospects: {len(q['prospects'])}")
        linked = sum(1 for s in active if rows.get(s))
        print(f"active linked to HubSpot: {linked}/{len(active)}")

    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    if not QUIET:
        print("\nclean — every active mockup is on all four surfaces")


if __name__ == "__main__":
    main()
