# Hype edit renderer

Builds the 35 s vertical outreach video: hook (lead's own photos) → lead's mockup scroll → Kutsch / Fuehrer / New View with Google reviews → CTA.

Setup once per machine: `pip install playwright scipy pillow numpy --break-system-packages && playwright install chromium`, plus ffmpeg. Fonts for the recorded sites come from `@fontsource/*` via npm (`FONT_DIR` in record.py).

1. `python3 music.py music.wav` (original synthesized bed, no license needed)
2. Record scrolls: `python3 record.py <site folder> <frames dir> --seconds 12.5 --max-speed 560` for the lead mockup; 5 s / 480 for each proof site (`--js-speed 3.5` for Fuehrer so its counters finish).
3. Copy `config.dietz.json`, point `lead` at the new mockup folder, frames and 3 hook photos.
4. `python3 render.py config.json out.mp4`
