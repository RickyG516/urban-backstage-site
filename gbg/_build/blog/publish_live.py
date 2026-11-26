#!/usr/bin/env python3
"""
Build the GBG site with --prod and stage it in the live repo (../gbg-dubuque-site), with guards.

    python gbg/_build/blog/publish_live.py [--slug <new-post-slug>]
    python gbg/_build/blog/publish_live.py --restore      # undo staged changes in the live repo

It never commits or pushes. On success the changes are staged in the live repo and the changed files are
printed; the caller commits and pushes. On any failure it restores the live repo and exits 1.

Guards:
  - live repo must exist, be on main and have a clean tree (it is pulled first)
  - live assets (site.css, site.js, og.png, favicon.svg) and netlify.toml are never overwritten
  - only .html, .xml and site.webmanifest files may change; anything else aborts
  - every page must be indexable with a gbgdubuque.com canonical and parseable JSON-LD
  - with --slug, the new post page must exist and be in the change set
"""
import json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
LIVE = os.path.abspath(os.path.join(ROOT, '..', 'gbg-dubuque-site'))
PRESERVE = ['assets/site.css', 'assets/site.js', 'assets/og.png', 'assets/favicon.svg', 'netlify.toml']
ALLOWED = re.compile(r'.*\.(html|xml)$|^site\.webmanifest$')


def git(*args, cwd=LIVE):
    r = subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f'FAIL git {" ".join(args)}: {r.stderr.strip()}')
    return r.stdout


def restore():
    git('reset', '-q', '--hard', 'HEAD')
    git('clean', '-fdq')


def fail(msg):
    print('FAIL', msg)
    restore()
    print('live repo restored, nothing published')
    sys.exit(1)


def check_pages():
    problems = []
    for dp, dn, fn in os.walk(LIVE):
        if '.git' in dp:
            continue
        for f in fn:
            if not f.endswith('.html') or f == '404.html':
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, LIVE).replace(os.sep, '/')
            t = open(p, encoding='utf-8').read()
            if 'noindex' in t:
                problems.append(f'{rel}: noindex')
            m = re.search(r'rel="canonical" href="([^"]+)"', t)
            if not m or not m.group(1).startswith('https://gbgdubuque.com/'):
                problems.append(f'{rel}: canonical not on gbgdubuque.com')
            for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
                try:
                    json.loads(b)
                except Exception as e:
                    problems.append(f'{rel}: bad JSON-LD ({e})')
            faq_s = 0
            for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
                try:
                    n = json.loads(b)
                    if n.get('@type') == 'FAQPage':
                        faq_s += len(n['mainEntity'])
                except Exception:
                    pass
            if faq_s and faq_s != t.count('<details>'):
                problems.append(f'{rel}: FAQ schema {faq_s} vs page {t.count("<details>")}')
    return problems


def main():
    if '--restore' in sys.argv:
        restore()
        print('live repo restored')
        return
    slug = sys.argv[sys.argv.index('--slug') + 1] if '--slug' in sys.argv else None

    if not os.path.isdir(os.path.join(LIVE, '.git')):
        raise SystemExit(f'FAIL live repo not found at {LIVE}')
    if git('branch', '--show-current').strip() != 'main':
        raise SystemExit('FAIL live repo is not on main')
    if git('status', '--porcelain').strip():
        raise SystemExit('FAIL live repo has uncommitted changes; not touching it')
    git('pull', '-q', '--rebase')

    tmp = tempfile.mkdtemp(prefix='gbgp')
    try:
        out = os.path.join(tmp, 'site')
        shutil.copytree(os.path.join(ROOT, 'gbg'), out)
        r = subprocess.run([sys.executable, os.path.join(out, '_build', 'build.py'), '--prod'],
                           capture_output=True, text=True)
        if r.returncode or 'PRODUCTION' not in r.stdout:
            raise SystemExit(f'FAIL prod build: {r.stdout[-400:]} {r.stderr[-400:]}')
        shutil.rmtree(os.path.join(out, '_build'))
        for p in PRESERVE:
            src = os.path.join(LIVE, p)
            dst = os.path.join(out, p)
            if os.path.exists(src):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
        shutil.copytree(out, LIVE, dirs_exist_ok=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    git('add', '-A')
    changed = [l.split('\t')[-1] for l in git('diff', '--cached', '--name-status').splitlines() if l.strip()]
    bad = [c for c in changed if not ALLOWED.match(c)]
    if bad:
        fail('unexpected files would change: ' + ', '.join(bad))
    deleted = [l.split('\t')[-1] for l in git('diff', '--cached', '--name-status').splitlines() if l.startswith('D')]
    if deleted:
        fail('pages would be deleted: ' + ', '.join(deleted))
    if slug:
        page = f'blog/{slug}/index.html'
        if page not in changed:
            fail(f'new post {page} is not in the change set')
    problems = check_pages()
    if problems:
        fail('; '.join(problems[:8]))
    if not changed:
        print('OK nothing to publish (live already matches)')
        return
    print(f'OK {len(changed)} files staged in {LIVE}:')
    for c in changed:
        print('  ' + c)


if __name__ == '__main__':
    main()
