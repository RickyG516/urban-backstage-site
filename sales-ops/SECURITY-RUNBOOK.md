# SALES OS — KEY ROTATION RUNBOOK

**Status: rotation COMPLETE as of 2026-07-27.** There is no longer any working key baked into
the public pages. The old public key `wvVeA_…l3C4` is dead at the worker and has been stripped
from all 10 consumer files.

The worker key now resolves in every page as: localStorage `unc_worker_key` → **nothing**.
No device key = no access. That is the intended behaviour.

## How access works now
- Worker `unc-sales-os-sync` enforces an opt-in auth gate: `if (env.WORKSPACE_KEY && …)` —
  every path except `/` and `/pin` requires header `x-unc-key` to equal the `WORKSPACE_KEY` secret.
- Each rep device stores the key once at `urbanbackstage.com/sales-ops/settings/`.
- The key value lives ONLY in Cloudflare (write-only secret) and in each rep's browser
  localStorage. **It is never committed to this repo.** If you ever see a real key in a
  source file again, that is a regression — strip it and rotate.

## No more silent demo data
`sales-ops/map/index.html` used to fall back to `demoData()` on any worker error, which
silently rendered ~126 fake companies and hid a fully dead key. That fallback is removed.
On failure the map now renders **empty** and throws a hard banner:
- no device key → "NO WORKER KEY ON THIS DEVICE" + link to Settings
- any other error → "LIVE CRM UNREACHABLE" + the worker's actual error string

`demoData()` is still defined but is never called automatically. Do not re-wire it to the
error path.

## PIN unlock — how a wiped device recovers itself
A browser with no `unc_worker_key` shows a "SALES OS LOCKED" modal on every Sales
OS page (`sales-ops/shared/unc-key.js`, wired into all 19 worker-backed pages).
Pick the rep, type the PIN, and `POST /pin` returns the WORKSPACE_KEY, which the
page stores and reloads with. No key to remember, no manual paste, no admin.

- `/pin` is exempt from the auth gate on purpose — it is the only way a keyless
  device can get a key. It is the one endpoint that must stay reachable.
- The key is only returned when the request `Origin` is in `ALLOWED_ORIGINS`.
- PINs are stored in KV at `pin:<rep_id>`. The worker accepts either a sha256 hex
  digest (preferred) or a legacy plaintext PIN, so old PINs keep working.
  Both Ricky's and Tyler's PINs are stored as sha256 digests as of 2026-07-27.
  Plaintext compare is kept only as a fallback for any rep added later.

### There is NO lockout. On purpose.
Repeated wrong PINs only make the *failed* response slower — 750ms per
consecutive failure, capped at 5s, and the counter self-expires after 15 minutes.
A correct PIN always succeeds instantly on the very next attempt regardless of how
many failures came before it. Verified live: 4 wrong PINs in a row, then the
correct one returned the key in 315ms.

This is a deliberate trade. A lockout would mean a bad actor — or a kid mashing
keys — could lock a rep out of their own sales tools mid-day. That risk was judged
worse than the brute-force risk on a 6-digit PIN behind an escalating delay. If
`/pin` ever does get hammered, the fix is 60 seconds: set a new WORKSPACE_KEY
secret (old key dies instantly everywhere) and write a new PIN digest to KV.

## To rotate again
1. Generate a new random key (32+ chars, URL-safe).
2. Set it on the worker — either Cloudflare → Workers → unc-sales-os-sync → Settings →
   Variables → `WORKSPACE_KEY`, or via API:
   `PUT /accounts/{account_id}/workers/scripts/unc-sales-os-sync/secrets`
   body `{"name":"WORKSPACE_KEY","text":"<new key>","type":"secret_text"}`
   This sets ONLY the secret. It does not redeploy the script, so bindings and code are safe.
   Do **not** PUT the full script just to change a key.
3. On EVERY rep device: `urbanbackstage.com/sales-ops/settings/` → "Worker access key" →
   paste → Save. Ricky and Tyler both.
4. Verify: open the map — LIVE CRM badge lights and the company count reads 1000+.
   Open a cockpit — no 401 toasts. If you see the orange banner, step 3 was missed.
5. The old key is now dead everywhere, immediately.

## Known gap
Still one shared team key, not per-rep. A leaked key exposes the whole team and rotation
means touching every device. The `/pin` endpoint + `CALL_LOG` KV already exist and are
exempt from the auth gate — that is the hook for per-rep key issuance when it is worth building.

## Worker bindings (do not drop these on any deploy)
`CALL_LOG` (kv_namespace) · `WORKSPACE_KEY` · `HUBSPOT_TOKEN` · `GOOGLE_SA_KEY` ·
`PLACES_API_KEY` (all secret_text). Deploys must send
`keep_bindings:["secret_text","plain_text","secret_key"]` or the secrets are wiped.

## Note on `/health`
There is no `/health` endpoint on this worker and there never was. Routes are:
`/config /callbacks /commissions /goals /leaderboard /map /pin /places /queue /search
/setup /setup-calendar /setup-calendar-form /setup-pitch-field /stats /sync`.
Use `/map` as the smoke test.

## Worker deploy — the safe path
The last full-script deploy failed with `SyntaxError at worker.js:1:2` because the
multipart *envelope* was uploaded instead of the module inside it. Correct
procedure, which worked on 2026-07-27:

1. GET the script. The response is `multipart/form-data` — split on the boundary
   and take the body of the JS part. That is the real module.
2. Verify: sha256 of the extracted module must equal sha256 of
   `workers/sales-os-sync-DEPLOYED.js`. They matched exactly, so the repo copy IS
   the deployed code — trust it, and keep it that way.
3. Edit locally, `node --check` it, push to GitHub.
4. PUT with FormData: a `metadata` part
   (`main_module:'worker.js'`, `compatibility_date:'2026-07-21'`,
   `bindings:[kv_namespace CALL_LOG]`,
   `keep_bindings:['secret_text','plain_text','secret_key']`) plus the module as
   `worker.js` with type `application/javascript+module`. Let the browser set the
   boundary — do not set Content-Type by hand.
5. Confirm all 5 bindings survive, then smoke-test `/map`.

Rollback: Cloudflare keeps version history (Workers → unc-sales-os-sync →
Deployments). The pre-change version is the one before the PIN-unlock deploy.

## Note on api.cloudflare.com access
The Cowork sandbox cannot reach `api.cloudflare.com` or `*.workers.dev` — egress
is allowlisted. All worker reads, deploys, and endpoint tests have to run from a
browser tab (same-origin fetch from a tab on the target origin).
