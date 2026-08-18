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
import os, re, sys, json, io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "demo")
INDEX = os.path.join(DEMO, "index.html")
STATUS = os.path.join(DEMO, "status.json")
QUEUE = os.path.join(ROOT, "sales-ops", "mockup-reveal", "queue", "latest.json")
QUEUE_README = os.path.join(ROOT, "sales-ops", "mockup-reveal", "queue", "README.md")

QUIET = "--quiet" in sys.argv

# Known non-prospects that live in the library but are not contractors and will
# never go into HubSpot or the dial queue. Single source of truth is
# demo/.non-prospects, read by this script AND gate.sh. Keep it SHORT and
# justify every addition — it is a hole in the audit.
NON_PROSPECT_FILE = os.path.join(DEMO, ".non-prospects")


def _load_non_prospects():
    if not os.path.exists(NON_PROSPECT_FILE):
        return set()
    out = set()
    with open(NON_PROSPECT_FILE, encoding="utf-8") as fh:
        for line in fh:
            slug = line.split("#", 1)[0].strip()
            if slug:
                out.add(slug)
    return out


def _load_valid_trades():
    """Valid `trade` values, parsed from the queue README's own vocabulary block.

    Deliberately NOT hardcoded here. The README is the documented single source of
    truth for this list; duplicating it in code guarantees the two drift and the
    gate starts passing values HubSpot rejects.
    """
    if not os.path.exists(QUEUE_README):
        return set()
    txt = io.open(QUEUE_README, encoding="utf-8").read()
    m = re.search(r"Valid contractor values:\s*\n(.*?)\n\s*(?:Legacy|###)", txt, re.S)
    if not m:
        return set()
    return {x.strip(" `") for x in m.group(1).replace("\n", " ").split("\u00b7") if x.strip(" `")}


KNOWN_NON_PROSPECTS = _load_non_prospects()
VALID_TRADES = _load_valid_trades()

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
    # Surface 4 cross-checks the queue against the demo index, and the index
    # stores HubSpot COMPANY ids. Phase 2 (0a98128) remapped the queue's
    # contact_id to real contact ids and moved the company id into its own
    # field, so matching on contact_id here compared two different id spaces
    # and reported every page and every queue row as an orphan. Match on
    # company_id; contact_id is still checked for uniqueness below.
    qids = {str(p.get("company_id")) for p in q["prospects"] if p.get("company_id")}

    active = [s for s in slugs if s not in arch and s not in KNOWN_NON_PROSPECTS]
    problems = []

    # --- ONE definition of "active".
    # The page header counts everything not in DEFAULT_ARCHIVED. This audit also
    # drops KNOWN_NON_PROSPECTS. If a non-prospect is not archived, the page says
    # N active and the audit says N-1 — which is exactly the kind of quiet
    # disagreement that makes the library feel untrustworthy. Force them to agree.
    for s in sorted(KNOWN_NON_PROSPECTS & set(slugs)):
        if s not in arch:
            problems.append(
                f"non-prospect not archived: {s} — page header will count it as "
                f"active but this audit will not. Add it to DEFAULT_ARCHIVED.")

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

    # An unlinked row must SAY it is archived on purpose. "not in HubSpot yet"
    # and "Pending" both read as unfinished work and make the page look sloppy.
    for row in re.findall(r"<tr data-search=.*?</tr>", idx, re.S):
        if "record/0-2/" in row:
            continue
        m = re.search(r"/demo/([^/]+)/", row)
        if m and not re.search(r"archived|not a prospect", row, re.I):
            problems.append(
                f"unlinked row does not say why: {m.group(1)} — an unlinked cell "
                f"must read 'archived' or 'not a prospect', never a placeholder")

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

    # --- queue row shape: the checks that used to live only in a prose checklist.
    # Every one of these has already shipped broken at least once. A human-read
    # bullet list did not stop it three separate times; an exit code does.
    for p in q["prospects"]:
        name = p.get("business_name", "?")
        cid, coid = p.get("contact_id"), p.get("company_id")

        # THE recurring defect: the batch writes the COMPANY id into contact_id and
        # never bridges the record to a real contact. /sync then PATCHes
        # /objects/contacts/<company id>, 404s, and drops the outcome silently.
        if coid is None:
            problems.append(f"queue {name}: no company_id")
        elif cid is not None and str(cid) == str(coid):
            problems.append(
                f"queue {name}: contact_id == company_id ({cid}) - record was never "
                f"bridged to a real CONTACT. Create/find the contact, associate it to "
                f"the company, and put the CONTACT id here.")

        url = p.get("hubspot_url") or ""
        if "/0-1/" not in url:
            problems.append(f"queue {name}: hubspot_url is not a /0-1/ contact link: {url}")
        elif cid is not None and not url.rstrip("/").endswith(str(cid)):
            problems.append(f"queue {name}: hubspot_url id does not match contact_id {cid}")

        st_code = p.get("state") or ""
        if not re.fullmatch(r"[A-Z]{2}", st_code):
            problems.append(f"queue {name}: state must be a 2-letter USPS code, got {st_code!r}")

        trade = p.get("trade")
        if VALID_TRADES and trade not in VALID_TRADES:
            problems.append(
                f"queue {name}: trade {trade!r} is not a HubSpot trade_type option - "
                f"see the mapping table in the queue README")

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
