#!/usr/bin/env python3
"""
Check one GBG blog draft against the README rules.

    python gbg/_build/blog/check_draft.py gbg/_build/blog/drafts/YYYY-MM-DD-slug.md

Prints one line per problem and exits 1 if any rule fails, 0 if the draft is clean.
Only checks the file you pass, so earlier drafts are never touched.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SERVICE_PAGES = ['/permanent-lights/', '/driveway-sealing/', '/yard-spraying/', '/trash-can-cleaning/',
                 '/epoxy-coating/', '/painting/', '/landscaping/', '/tree-service/', '/service-areas/']
FIELDS = ['title', 'slug', 'meta_description', 'service_page', 'target_keyword']
BANNED = ['genuinely', 'honestly', 'straightforward', 'elevate', 'seamless', 'game changer', 'game-changer']
# Facts GBG cannot back up before launch
CLAIMS = [
    (r'\$\s?\d', 'price'),
    (r'\b\d+(\.\d+)?\s?%', 'percentage'),
    (r'\b\d+\+?\s+years?\b', 'years figure'),
    (r'\bsince\s+(19|20)\d\d\b', 'founding year'),
    (r'\b\d+\+?\s+(jobs|customers|clients|homes|homeowners|installs|projects)\b', 'job or customer count'),
    (r'\b(licensed|insured|bonded|certified|award[- ]winning|five[- ]star|5[- ]star)\b', 'license, insurance or award claim'),
    (r'\b(our customers|one customer|a customer told|clients say|reviews? (say|show))\b', 'customer story or review'),
    (r'\b(owners?|founders?|our team of|family[- ]owned)\b', 'mention of owners or team size'),
]


def parse(path):
    raw = open(path, encoding='utf-8').read()
    m = re.match(r'---\n(.*?)\n---\n(.*)', raw, re.S)
    if not m:
        return None, raw
    meta = {}
    for line in m.group(1).splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2).strip()


def known_slugs():
    slugs = set()
    for f in os.listdir(os.path.join(HERE, 'drafts')):
        if f.endswith('.md'):
            slugs.add(f[11:-3])
    return slugs


def check(path):
    problems = []
    meta, body = parse(path)
    if meta is None:
        return ['no front matter block']
    for f in FIELDS:
        if not meta.get(f):
            problems.append(f'front matter missing: {f}')
    if len(meta.get('title', '')) > 60:
        problems.append(f"title is {len(meta['title'])} characters (max 60)")
    if len(meta.get('meta_description', '')) > 150:
        problems.append(f"meta_description is {len(meta['meta_description'])} characters (max 150)")
    slug = meta.get('slug', '')
    if slug and not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
        problems.append('slug is not kebab-case')
    base = os.path.basename(path)
    if slug and not (re.fullmatch(r'\d{4}-\d\d-\d\d-' + re.escape(slug) + r'\.md', base)):
        problems.append(f'filename should be YYYY-MM-DD-{slug}.md')
    sp = meta.get('service_page', '')
    if sp and sp not in SERVICE_PAGES:
        problems.append(f'service_page {sp} is not a site page')

    words = len(body.split())
    if not 700 <= words <= 900:
        problems.append(f'body is {words} words (need 700 to 900)')

    low = body.lower() + ' ' + ' '.join(meta.values()).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\b', low):
            problems.append(f'banned word: {w}')
    full = body + '\n' + '\n'.join(meta.values())
    if re.search('[—–]', full) or re.search(r'(?<=\S)[ \t]+-{1,2}[ \t]+(?=\S)', full):
        problems.append('dash used as punctuation (em dash, en dash or spaced hyphen)')
    for pat, label in CLAIMS:
        hit = re.search(pat, body, re.I)
        if hit:
            problems.append(f'possible invented fact ({label}): "{hit.group(0)}"')

    if re.search(r'^# ', body, re.M):
        problems.append('body has an H1 (title is the H1)')
    if not re.search(r'^## ', body, re.M):
        problems.append('body has no H2 sections')
    if 'dubuque' not in body.lower():
        problems.append('Dubuque is never mentioned')
    if not re.search(r'tri-?state|iowa, illinois|IA, IL', body, re.I):
        problems.append('tri-state area is never mentioned')

    parts = re.split(r'\n## FAQ\s*\n', body, maxsplit=1)
    if len(parts) != 2:
        problems.append('no "## FAQ" section')
        main = body
    else:
        main = parts[0]
        qs = [b for b in re.split(r'\n\s*\n', parts[1].strip()) if b.strip()]
        if len(qs) != 3:
            problems.append(f'FAQ has {len(qs)} questions (need 3)')
        for b in qs:
            if len(b.strip().splitlines()) < 2:
                problems.append('an FAQ item has no answer')
    if sp and f']({sp})' not in main:
        problems.append(f'call to action must link to {sp}')

    links = re.findall(r'\]\(/blog/([a-z0-9-]+)/\)', body)
    ok = known_slugs() - {slug}
    if not links:
        problems.append('no internal link to an earlier post (use [text](/blog/<slug>/))')
    for l in links:
        if l not in ok:
            problems.append(f'internal link to unknown post: {l}')
    return problems, words


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    res = check(sys.argv[1])
    if isinstance(res, list):
        problems, words = res, 0
    else:
        problems, words = res
    for p in problems:
        print('FAIL', p)
    print(('FAILED' if problems else 'OK') + f' ({words} words)')
    sys.exit(1 if problems else 0)
