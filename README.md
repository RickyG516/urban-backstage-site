# urban-backstage-site

Internal operations domain for Urban Niche Co. — **urbanbackstage.com**

Whole domain is noindexed (`robots.txt` blanket disallow + `noindex` meta on every page).
Nothing here is public-facing, but the site IS publicly reachable — treat every file as
readable by anyone who finds the URL.

## Sections

| Path | What | Gate |
|---|---|---|
| `/` | Six-department hub + tool launcher | open |
| `/playbook/` | Process, training, brand, filing rules | open |
| `/sales-ops/` | Sales OS cockpit, live HubSpot data | PIN |
| `/demo/` | Cold-outreach prospect mockups | open |
| `/verticals/` | Parked generic industry templates | open |

## ⚠ DO NOT ADD A `.nojekyll` FILE

`sales-ops/_internal/worker.js` currently returns **404** only because GitHub Pages runs
Jekyll, which skips underscore-prefixed paths. Adding `.nojekyll` would publish the
Cloudflare Worker source — including its auth logic — to the open internet instantly.

If you ever need `.nojekyll` (for asset paths, etc.), **relocate that file out of the
served tree first.**

## What must never land in the open sections

The test: *if a competitor read this, would it hurt?*

Account IDs, KV namespace IDs, API tokens, security runbooks and competitive intel belong
behind the cockpit PIN or in Google Drive only — never in `/playbook/`, `/demo/` or the hub.

A security runbook was accidentally published here on 2026-07-29 by a wholesale copy of
`sales-ops/` and had to be removed. Don't repeat it.

## Deploys

GitHub Pages from `main`, root folder. Custom domain via `CNAME`. Pushes go live in
roughly 30–60 seconds.

## Pushing (read this if a "unpushed commits" warning nags you)

Push through the `origin` remote — `git push origin main`.

Do **not** push by spelling out the URL (`git push https://<token>@github.com/... main`).
That works, and the commits really do land on GitHub, but it does **not** update the
`origin/main` remote-tracking ref. Anything comparing `origin/main..HEAD` — including the
session's git-check hook — then reports phantom unpushed commits forever, even though
everything is safely pushed.

If refs have already drifted, resync without touching the remote URL:

```
git fetch <url> "+refs/heads/main:refs/remotes/origin/main"
```
