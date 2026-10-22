# Touch 2 video runbook (scheduled task: fb-t2-video)

Goal each weekday morning: for every Facebook DM prospect who is due a Touch 2,
build their hype-edit video and leave it ATTACHED in their Messenger thread with a
short draft line typed. Never press send. Ricky sends and adds his own words.

## 0. Setup (fresh session)
```
git clone --depth 1 https://github.com/RickyG516/urban-backstage-site ~/urban-backstage-site
cd ~/urban-backstage-site
pip install playwright scipy pillow numpy --break-system-packages -q   # usually already there
which ffmpeg || apt-get install -y ffmpeg
```
Playwright's Chromium is preinstalled in the cloud container (do not run `playwright install`).

## 1. Who is due
```
python3 tools/hype-edit/select.py --days 4 --cap 5 --json
```
Rule: Touch 1 sent on Messenger, 4+ days ago with no real reply, OR any real reply
(auto-replies do not count), no `t2_video` stamp yet, status not declined/closed,
mockup exists. Replies come first, then oldest Touch 1. Cap 5 a day.

## 2. Build each video
```
python3 tools/hype-edit/build.py <slug>
```
Output: `tools/hype-edit/out/<slug>-send.mp4` (810x1440, ~4-5 MB, under the 10 MB
Messenger upload limit). First build on a machine also clones and records the three
proof sites and synthesizes the music; later builds reuse them. ~4 min per video.
If build.py exits with "no usable photos", skip that slug and note it.

## 3. Attach in Messenger (Claude in Chrome, Ricky's computer)
Load the chrome tools, `tabs_context_mcp`, open a new tab at `https://www.facebook.com/messages/`.
For each slug:
1. Find the thread. Search Messenger for the business name (use the page name
   from the `fb` URL or the mockup `<title>`). Search results list People/Pages
   rows; use `find` to get the row ref for the business and click it. Confirm the
   open thread shows Ricky's Touch 1 text before doing anything.
2. `find` "hidden file input (input type=file) in the message composer", then
   `file_upload` with the `-send.mp4` path and that ref. Wait 3 s, screenshot:
   the video tile must show in the composer.
3. Click the "Aa" text box and `type` the draft line (do NOT press Enter):
   - no reply yet: `Figured I'd save you the click. 35 seconds, your homepage start to finish.`
   - they replied: `Appreciate the reply. Made this so you can see it without clicking around. 35 seconds.`
   Messenger keeps the attachment and text as a draft in that thread.
4. Do not click send. Do not press Enter. Move to the next thread.

If the first `file_upload` shows "Couldn't send" after Ricky sends, a second attach
of the same file has worked before. Note it in the summary.

If the Chrome tools are missing or the computer is unreachable: still build the
videos, then write the list below and stop. Ricky attaches by hand.

## 4. Log
In `demo/status.json`, for each slug attached set `fb_dm.t2_video` = today
(ISO date) and `fb_dm.t2_note` = "video attached, draft typed, awaiting Ricky send".
For slugs built but not attached use `fb_dm.t2_video_built` = today instead.
Commit and push: `git commit -am "fb-t2-video YYYY-MM-DD: attached N, built-only M" && git push`.

## 5. Report (SendUserMessage)
One short block: who got a video attached (business, reason, thread name), who was
built but not attached and why, who was skipped. Remind: open Messenger, hit send on
each draft, add your own line.

## Never
- Never send a message or press Enter in a Messenger composer.
- Never attach to a thread that does not show Ricky's Touch 1.
- Never build a mockup here; no mockup means skip.
- Never exceed the daily cap.
