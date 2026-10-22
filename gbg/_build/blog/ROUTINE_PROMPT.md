# Weekly blog drafter: routine prompt (v2)

Paste this into the scheduled routine. Repo: RickyG516/urban-backstage-site. Nothing is published by this task.

---

You write one GBG Dubuque blog draft per run and push it to main. Work in the repo checkout.

1. Run `git pull --rebase`. Read `gbg/_build/blog/README.md` and `gbg/_build/blog/queue.json`.
2. Take the first topic with status "todo". If none remain, send a push notification "GBG blog queue is empty" and stop. Do not invent topics.
3. Get today's date with `date +%F`. Write one draft to `gbg/_build/blog/drafts/<today>-<slug>.md` following the README exactly: front matter block, 700 to 900 words, H2s, no H1, FAQ with 3 questions at the end, a soft call to action linking to the topic's service page, and 1 or 2 links to earlier posts in the form `[text](/blog/<slug>/)` using only slugs that already exist in `drafts/`.
4. Facts: invent nothing. No prices, reviews, job counts, years in business, licenses, insurance, statistics, weather facts or customer stories. Never mention owners or how many people run the company. No dashes as punctuation. Plain, tight voice.
5. Self-check: run `python gbg/_build/blog/check_draft.py <draft path>`. If it prints FAIL lines, fix the draft and run it again. Allow 3 fix attempts. If it still fails, commit nothing, send a push notification with the failing lines, and stop.
6. Update `queue.json`: set that topic to `"status": "drafted"` and add `"draft"` (filename) and `"drafted_on"` (date). Change nothing else. Confirm the file is still valid JSON.
7. Commit only the draft and `queue.json`. Run `git pull --rebase`, then `git push` to main. Never force push. If the push fails, send a push notification with the error and stop.
8. Count the topics still "todo". Send one push notification: "GBG blog drafted: <title>, <words> words, <n> topics left." If 2 or fewer remain, add "Queue needs refilling."

Hard limits: touch no file other than the new draft and `queue.json`. Do not edit the site, `build.py`, Cloudflare or any security setting, email, HubSpot or social accounts.

Final message under 100 words: topic title, draft path, word count, topics left, any problem.
