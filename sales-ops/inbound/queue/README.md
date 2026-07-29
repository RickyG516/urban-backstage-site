# Inbound Lead Queue

Webhook drops new inbound leads here. Each file = one inbound submission.

Path: `/sales-ops/inbound/queue/YYYY-MM-DD.json`

Schema same as cold-call queue but each prospect includes:
- `inbound_source`: form / DM / email reply / referral
- `inbound_timestamp`: when they reached out (for speed-to-lead clock)
- `service_interest`: which service they asked about
- `form_message`: the raw form submission text (verbatim)

When the cockpit loads with `?contact=X`, it shows the inbound context AND the time elapsed since they submitted.

For automated webhook integration: Railway endpoint can push directly to this folder via GitHub API.
