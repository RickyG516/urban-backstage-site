#!/usr/bin/env python3
"""
Urban Backstage — canonical nav generator.

WHY THIS EXISTS
The nav was hand-copied into every page. Predictably it drifted: pages built in
July carried Home/Cockpit/Sales/Clients/Delivery/Finance/Team/Playbook/Demos,
while /playbook/, /demo/ and /verticals/ still carried the older
Home/Workspace/Playbook/Demos/Verticals. Clicking Playbook or Demos dropped you
into a different site. Worse, /verticals/ existed only in the OLD nav, so the
11 vertical templates became unreachable from anything built later.

Run this after adding a page or changing the nav. It rewrites the <nav
class="ub-nav"> block in every page that has one, sets `active` by longest
path-prefix match, and leaves everything else untouched.

    python3 tools/build-nav.py           # rewrite
    python3 tools/build-nav.py --check   # exit 1 if any page is out of date

Prospect-facing mockups under /demo/<slug>/ have no ub-nav block and are
deliberately skipped — they must never show internal navigation.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The single source of truth. Add a page here, run the script, done.
NAV = [
    ("/",                    "Home"),
    ("/sales-ops/workspace/","Cockpit"),
    ("/sales/",              "Sales"),
    ("/clients/",            "Clients"),
    ("/delivery/",           "Delivery"),
    ("/finance/",            "Finance"),
    ("/team/",               "Team"),
    ("/playbook/",           "Playbook"),
    ("/demo/",               "Demos"),
    ("/verticals/",          "Verticals"),
]

FLAG = "INTERNAL · NOT INDEXED"


def url_for(path):
    """Repo file path -> the URL it serves at."""
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    rel = re.sub(r"index\.html$", "", rel)
    return "/" + rel if not rel.startswith("/") else rel


def active_for(url):
    """Longest nav href that prefixes this URL wins. '/' only matches exactly."""
    best = ""
    for href, _ in NAV:
        if href == "/":
            if url == "/":
                best = "/"
            continue
        if url.startswith(href) and len(href) > len(best):
            best = href
    return best


def render(active):
    links = []
    for href, label in NAV:
        cls = ' class="active"' if href == active else ""
        links.append('    <a href="%s"%s>%s</a>' % (href, cls, label))
    return (
        '<nav class="ub-nav">\n'
        '  <a class="ub-brand" href="/">URBAN&nbsp;<span>BACKSTAGE</span></a>\n'
        '  <div class="ub-links">\n'
        + "\n".join(links) + "\n"
        '  </div>\n'
        '  <span class="ub-flag">' + FLAG + '</span>\n'
        '</nav>'
    )


def main():
    check = "--check" in sys.argv
    nav_re = re.compile(r'<nav class="ub-nav">.*?</nav>', re.S)
    changed, scanned, stale = [], 0, []

    for dirpath, dirnames, filenames in os.walk(ROOT):
        if ".git" in dirpath:
            continue
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            p = os.path.join(dirpath, fn)
            html = io.open(p, encoding="utf-8").read()
            if 'class="ub-nav"' not in html:
                continue          # mockups and anything else without a nav
            scanned += 1
            want = render(active_for(url_for(p)))
            new = nav_re.sub(lambda m: want, html, count=1)
            if new != html:
                stale.append(os.path.relpath(p, ROOT))
                if not check:
                    io.open(p, "w", encoding="utf-8").write(new)
                    changed.append(os.path.relpath(p, ROOT))

    if check:
        if stale:
            print("OUT OF DATE (%d):" % len(stale))
            for s in sorted(stale):
                print("  " + s)
            return 1
        print("nav is consistent across %d pages" % scanned)
        return 0

    print("scanned %d pages with a nav, rewrote %d" % (scanned, len(changed)))
    for c in sorted(changed):
        print("  " + c)
    return 0


if __name__ == "__main__":
    sys.exit(main())
