#!/usr/bin/env python3
"""Render the hype edit from a config JSON: comp.html is drawn one frame at a time
and piped to ffmpeg, then the music bed is mixed in.

usage: render.py CONFIG.json OUT.mp4 [--stills DIR] [--only-stills]
"""
import argparse, asyncio, base64, json, os, subprocess
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))


async def main(cfg_path, out, stills_dir=None, only_stills=False):
    cfg = json.load(open(cfg_path))
    fps, dur = cfg["fps"], cfg["timeline"]["end"]
    n = round(dur * fps)
    for clip in [cfg["lead"]] + cfg["proof"]:
        clip["count"] = len([f for f in os.listdir(clip["frames"]) if f.startswith("f_")])
        clip["frames"] = "file://" + os.path.abspath(clip["frames"])
    cfg["lead"]["hook_photos"] = ["file://" + os.path.abspath(p) for p in cfg["lead"]["hook_photos"]]
    still_frames = {round(s * fps): s for s in cfg.get("stills", [])}
    if stills_dir:
        os.makedirs(stills_dir, exist_ok=True)

    ff = None
    silent = out + ".silent.mp4"
    if not only_stills:
        ff = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps),
             "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
             "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", silent],
            stdin=subprocess.PIPE)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--allow-file-access-from-files"])
        ctx = await browser.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.goto("file://" + os.path.join(HERE, "comp.html"))
        await page.evaluate("(c)=>init(c)", cfg)
        cdp = await ctx.new_cdp_session(page)
        frames = sorted(still_frames) if only_stills else range(n)
        for i in frames:
            await page.evaluate("(t)=>render(t)", i / fps)
            shot = await cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 95})
            data = base64.b64decode(shot["data"])
            if ff:
                ff.stdin.write(data)
            if stills_dir and i in still_frames:
                open(os.path.join(stills_dir, f"t_{still_frames[i]:05.2f}.jpg"), "wb").write(data)
        await browser.close()

    if ff:
        ff.stdin.close()
        ff.wait()
        music = cfg.get("music")
        if music:
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", music,
                 "-filter:a", f"loudnorm=I={cfg.get('music_lufs', -19)}:TP=-2:LRA=7", "-c:v", "copy",
                 "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest", "-movflags", "+faststart", out], check=True)
            os.remove(silent)
        else:
            os.replace(silent, out)
        print("wrote", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("config"); ap.add_argument("out")
    ap.add_argument("--stills"); ap.add_argument("--only-stills", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.config, a.out, a.stills, a.only_stills))
