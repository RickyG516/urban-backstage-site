#!/usr/bin/env python3
"""
Stamp added-dates on demo pages, dedupe the index, and prove the library is
internally consistent BY SCRIPT rather than by eye.

The nightly spec-mockup run referenced `tools/added_dates.py` before it
existed. This is it. Three jobs:

  1. Every demo page carries `<meta name="unc-added" content="YYYY-MM-DD">`.
     Pages missing one get stamped from their first commit date in git
     (falling back to file mtime for anything not committed yet).
  2. demo/index.html carries exactly one <tr> per demo directory — no
     duplicate slugs, no orphan rows, no missing rows.
  3. demo/status.json has an entry for every page.

Counts are COUNTED, never hardcoded. A hardcoded mockup count has already
gone stale once in this library.

    python3 tools/added_dates.py           # stamp + dedupe + verify
    python3 tools/added_dates.py --check    # verify only, exit 1 on any problem
"""
import os, re, sys, json, html, subprocess, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "demo")


def _load_slug_list(name):
    """Shared exclusion lists, same format and same files gate.sh and
    tools/enrich_audit.py read. One source of truth per category."""
    path = os.path.join(DEMO, name)
    out = set()
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.split("#")[0].strip()
                if line:
                    out.add(line)
    return out


# Replicas of signed clients' real sites. The mockup generator's provenance and
# asset conventions do not apply to hand-built client work, so do not warn about
# them here. See demo/.client-sites.
CLIENT_SITES = _load_slug_list(".client-sites")
INDEX = os.path.join(DEMO, "index.html")
STATUS = os.path.join(DEMO, "status.json")

CHECK_ONLY = "--check" in sys.argv


def page_dirs():
    return sorted(
        d for d in os.listdir(DEMO)
        if os.path.isdir(os.path.join(DEMO, d))
        and os.path.isfile(os.path.join(DEMO, d, "index.html"))
    )


def first_commit_date(path):
    try:
        out = subprocess.run(
            ["git", "log", "--diff-filter=A", "--follow", "--format=%ad",
             "--date=short", "--", path],
            cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.strip()
        if out:
            return out.splitlines()[-1]
    except Exception:
        pass
    return datetime.date.fromtimestamp(os.path.getmtime(path)).isoformat()


def stamp(slugs):
    """Add the unc-added meta to any page missing it. Returns list stamped."""
    done = []
    for slug in slugs:
        p = os.path.join(DEMO, slug, "index.html")
        s = open(p, encoding="utf-8").read()
        if slug in CLIENT_SITES:
            continue          # client replica — not generator output, do not stamp
        if 'name="unc-added"' in s:
            continue
        date = first_commit_date(p)
        tag = f'<meta name="unc-added" content="{date}">\n'
        if '<meta name="robots"' in s:
            s = s.replace('<meta name="robots"', tag + '<meta name="robots"', 1)
        elif "</head>" in s:
            s = s.replace("</head>", tag + "</head>", 1)
        else:
            print(f"  ! {slug}: no <head> to stamp")
            continue
        if not CHECK_ONLY:
            open(p, "w", encoding="utf-8").write(s)
        done.append((slug, date))
    return done


def index_rows():
    s = open(INDEX, encoding="utf-8").read()
    m = re.search(r"<tbody>(.*?)</tbody>", s, re.S)
    if not m:
        sys.exit("index.html: no <tbody>")
    rows = re.findall(r"<tr data-search=.*?</tr>", m.group(1), re.S)
    return s, m, rows


def slug_of(row):
    m = re.search(r"/demo/([^/]+)/", row)
    return m.group(1) if m else None


def name_of(row):
    m = re.search(r'<td class="biz"><a[^>]*>(.*?)</a>', row)
    return html.unescape(m.group(1)).lower().lstrip("\"'") if m else ""


def dedupe():
    # CLIENT ROWS HAVE NO SLUG. demo/index.html carries data-kind="client" rows
    # (Fuehrer, Khloe's, Kutsch, Wortley, Donovan Brothers, Dubuque Roof Repair)
    # that link to the clients' OWN domains, not to /demo/<slug>/. slug_of()
    # returns None for all six, so the original loop put the first None in `seen`
    # and silently DROPPED the other five as duplicates — real, live rows deleted
    # on every bare run, and the row/page counts could never reconcile.
    # Fixed 2026-09-16: rows without a slug are never deduped against each other.
    s, m, rows = index_rows()
    seen, out, dropped = set(), [], []
    for r in sorted(rows, key=name_of):
        sl = slug_of(r)
        if sl is None:
            out.append(r)          # client row — keep, cannot be a slug duplicate
            continue
        if sl in seen:
            dropped.append(sl)
            continue
        seen.add(sl)
        out.append(r)
    if dropped and not CHECK_ONLY:
        s = s[:m.start(1)] + "\n" + "\n".join(out) + "\n" + s[m.end(1):]
        open(INDEX, "w", encoding="utf-8").write(s)
    return dropped, out


def main():
    slugs = page_dirs()

    stamped = stamp(slugs)
    for sl, d in stamped:
        print(f"  stamped {sl} -> {d}")

    dropped, rows = dedupe()
    for sl in dropped:
        print(f"  dropped duplicate index row: {sl}")

    # ---- verification, by count, not by eye -------------------------------
    problems = []

    # Compare only rows that POINT AT A PAGE. The six data-kind="client" rows link
    # to the clients' own live domains and have no /demo/<slug>/ path by design, so
    # counting them against page dirs guaranteed a permanent off-by-six and a
    # bogus "index row with no page: None". Split them out and report both.
    all_row_slugs = [slug_of(r) for r in rows]
    client_rows = [r for r in rows if slug_of(r) is None]
    row_slugs = [sl for sl in all_row_slugs if sl is not None]
    if len(row_slugs) != len(slugs):
        problems.append(f"index rows with a page {len(row_slugs)} != page dirs {len(slugs)}")
    if len(set(row_slugs)) != len(row_slugs):
        problems.append("duplicate slugs still in index")
    for extra in sorted(set(row_slugs) - set(slugs)):
        problems.append(f"index row with no page: {extra}")
    for missing in sorted(set(slugs) - set(row_slugs)):
        problems.append(f"page with no index row: {missing}")

    st = json.load(open(STATUS, encoding="utf-8"))
    for missing in sorted(set(slugs) - set(st)):
        problems.append(f"no status.json entry: {missing}")
    for extra in sorted(set(st) - set(slugs)):
        problems.append(f"status.json entry with no page: {extra}")

    for slug in slugs:
        p = os.path.join(DEMO, slug, "index.html")
        s = open(p, encoding="utf-8").read()
        if 'name="unc-added"' not in s and slug not in CLIENT_SITES:
            problems.append(f"no unc-added meta: {slug}")
        # referenced-but-missing local assets
        for src in set(re.findall(r'src="([a-z0-9-]+\.svg)"', s)):
            if not os.path.isfile(os.path.join(DEMO, slug, src)):
                problems.append(f"missing asset {slug}/{src}")
        # Duplicate img src within one page. A LOGO in the nav and again in the
        # hero is ordinary web design, not the padding Ricky flagged ("Dont reuse
        # the same photos on the same page") — scope this to photos and generated
        # assets, exempt logo files only. Kept in step with the same rule in
        # gate.sh's DUP-IMG-ON-PAGE check.
        srcs = [x for x in re.findall(r'<img[^>]*src="([^"]+)"', s)
                if "logo" not in x.lower()]
        dups = {x for x in srcs if srcs.count(x) > 1}
        for d in sorted(dups):
            problems.append(f"duplicate img src on {slug}: {d}")

    print(f"\npages: {len(slugs)}  index rows with a page: {len(row_slugs)}  "
          f"client rows (own domain, no page): {len(client_rows)}  "
          f"status entries: {len(st)}")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("clean")


if __name__ == "__main__":
    main()
