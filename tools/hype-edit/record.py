#!/usr/bin/env python3
"""Frame-accurate mobile scroll recorder for a static site folder.

Serves ROOT on localhost, opens PAGE in a phone-sized headless browser, and
writes one JPEG per video frame while scrolling. Time inside the page is
stepped manually (timers, requestAnimationFrame and CSS animations), so the
result is perfectly smooth at any capture speed.

usage: record.py ROOT OUTDIR --seconds 12.5 [--page index.html] [--distance 0]
"""
import argparse, asyncio, base64, functools, http.server, json, os, re, socketserver, subprocess, threading
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fonts")
VW, VH, DSF = 390, 780, 2
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    handler = functools.partial(Quiet, directory=root)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def font_pkg(family):
    slug = family.strip().lower().replace(" ", "-")
    pkg = os.path.join(FONT_DIR, "node_modules", "@fontsource", slug)
    if not os.path.isdir(pkg):
        os.makedirs(FONT_DIR, exist_ok=True)
        if not os.path.isfile(os.path.join(FONT_DIR, "package.json")):
            subprocess.run(["npm", "init", "-y"], cwd=FONT_DIR, capture_output=True, timeout=60)
        subprocess.run(["npm", "i", "--silent", f"@fontsource/{slug}"], cwd=FONT_DIR,
                       capture_output=True, timeout=120)
    return slug, pkg


def google_fonts_css(url):
    """Build @font-face CSS for a fonts.googleapis.com/css2 URL from local npm font files."""
    css = []
    for fam in parse_qs(urlparse(url).query).get("family", []):
        name = fam.split(":")[0]
        slug, pkg = font_pkg(name)
        files = os.path.join(pkg, "files")
        if not os.path.isdir(files):
            continue
        for fn in sorted(os.listdir(files)):
            m = re.match(rf"{re.escape(slug)}-latin-(\d+)-(normal|italic)\.woff2$", fn)
            if not m:
                continue
            css.append(
                f"@font-face{{font-family:'{name}';font-style:{m.group(2)};font-weight:{m.group(1)};"
                f"font-display:block;src:url(https://fonts.local/{slug}/{fn}) format('woff2');}}")
    return "\n".join(css)


STEP_JS = """(dt) => {
  const seen = window.__hypeSeen || (window.__hypeSeen = new WeakSet());
  for (const a of document.getAnimations()) {
    try {
      if (!seen.has(a)) { seen.add(a); a.pause(); if (a.currentTime == null) a.currentTime = 0; }
      else {
        const t = (Number(a.currentTime) || 0) + dt;
        const end = a.effect && a.effect.getComputedTiming().endTime;
        if (isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      }
    } catch (e) {}
  }
}"""


def scroll_pos(u, hold_start=0.08, hold_end=0.06):
    """0..1 progress -> 0..1 scroll, constant speed with soft start and stop."""
    if u <= hold_start:
        return 0.0
    if u >= 1 - hold_end:
        return 1.0
    x = (u - hold_start) / (1 - hold_start - hold_end)
    r = 0.18  # ramp fraction at each end
    v = 1 / (1 - r)
    if x < r:
        return 0.5 * v * x * x / r
    if x > 1 - r:
        y = 1 - x
        return 1 - 0.5 * v * y * y / r
    return 0.5 * v * r + v * (x - r)


async def record(root, outdir, seconds, page_path="index.html", fps=30, distance=0, max_speed=520, hide="", js_speed=1.0):
    os.makedirs(outdir, exist_ok=True)
    srv, port = serve(root)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DSF,
                                        is_mobile=True, has_touch=True, user_agent=UA)
        page = await ctx.new_page()

        async def route(r):
            url = r.request.url
            host = urlparse(url).hostname or ""
            if host in ("127.0.0.1", "localhost"):
                return await r.continue_()
            if host == "fonts.googleapis.com":
                return await r.fulfill(status=200, content_type="text/css", body=google_fonts_css(url))
            if host == "fonts.local":
                slug, fn = urlparse(url).path.strip("/").split("/", 1)
                fp = os.path.join(FONT_DIR, "node_modules", "@fontsource", slug, "files", fn)
                return await r.fulfill(status=200, content_type="font/woff2", path=fp,
                                       headers={"access-control-allow-origin": "*"})
            await r.abort()

        await page.route("**/*", route)
        await page.clock.install()
        await page.goto(f"http://127.0.0.1:{port}/{page_path}", wait_until="load")
        await page.add_style_tag(content="html,body{scroll-behavior:auto!important}"
                                         "::-webkit-scrollbar{display:none}" + (hide and f"{hide}{{display:none!important}}"))
        await page.evaluate("()=>document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass
        await page.evaluate("()=>document.fonts.ready.then(()=>1)")
        await asyncio.sleep(0.6)

        cdp = await ctx.new_cdp_session(page)
        now = await page.evaluate("Date.now()")
        await page.clock.pause_at(now + 50)
        doc_h = await page.evaluate("()=>Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
        max_scroll = max(0, doc_h - VH)
        travel = min(max_scroll, distance or max_scroll, max_speed * seconds)
        n = round(seconds * fps)
        dt = 1000.0 / fps
        for i in range(n):
            y = travel * scroll_pos(i / max(1, n - 1))
            await page.evaluate("(y)=>window.scrollTo(0,y)", y)
            tick = round((i + 1) * dt * js_speed) - round(i * dt * js_speed)
            await page.clock.run_for(tick)
            await page.evaluate(STEP_JS, dt)
            shot = await cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 92})
            with open(os.path.join(outdir, f"f_{i:05d}.jpg"), "wb") as f:
                f.write(base64.b64decode(shot["data"]))
        await browser.close()
    srv.shutdown()
    meta = {"frames": n, "fps": fps, "doc_height": doc_h, "travel": travel, "w": VW * DSF, "h": VH * DSF}
    json.dump(meta, open(os.path.join(outdir, "meta.json"), "w"))
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("root"); ap.add_argument("outdir")
    ap.add_argument("--seconds", type=float, default=5)
    ap.add_argument("--page", default="index.html")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--distance", type=float, default=0)
    ap.add_argument("--max-speed", type=float, default=520)
    ap.add_argument("--hide", default="")
    ap.add_argument("--js-speed", type=float, default=1.0, help="run script-driven effects (count-up stats) faster so they finish on screen")
    a = ap.parse_args()
    print(asyncio.run(record(a.root, a.outdir, a.seconds, a.page, a.fps, a.distance, a.max_speed, a.hide, a.js_speed)))
