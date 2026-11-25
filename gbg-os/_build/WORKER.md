# gbg-os-api (GBG CRM backend)

- Worker: `gbg-os-api` at https://gbg-os-api.ricky-a17.workers.dev
- Database: D1 `gbg-os` (id 71288793-c6e3-4999-9683-d224f1ae08a6), schema in `schema.sql`
- Source: `worker.js` in this folder. No secrets in it.
- Secrets (set on the Worker, never in a file or repo): PIN_RICKY, PIN_DOUG, PIN_KEVIN, TOKEN_SECRET, FORM_TOKEN, RETELL_TOKEN, USER_EMAILS (JSON of each owner's email for the Monday email)
- Email binding: EMAIL (send_email), used for phone-call alerts
- ALWAYS pull the live code before editing (another session edits this Worker too). The repo copy can lag.
- Pages call it from `gbg-os/assets/api.js`. CORS only allows urbanbackstage.com.

## Redeploy
Multipart PUT from a Chrome tab logged into dash.cloudflare.com to
`/api/v4/accounts/<account>/workers/scripts/gbg-os-api`.
Metadata that worked on 2026-11-24 (keeps every binding):
`{"main_module":"worker.js","compatibility_date":"2026-11-01","keep_bindings":["secret_text","plain_text","send_email","d1"],"bindings":[]}`
Leave out keep_bindings and the PINs get wiped. Leave out the d1 binding and the database disconnects.
After a deploy, test: /pin with a real PIN, then /contacts with the key.

## Change a PIN
Set a new secret_text value for PIN_RICKY, PIN_DOUG or PIN_KEVIN. Changing TOKEN_SECRET logs every device out.

## Website leads
POST /inbound?token=FORM_TOKEN with the Netlify form payload. Creates a contact, a Lead job,
and a "Respond to new website lead" task due today.

## Endpoints
GET /summary, GET/POST /tasks, PATCH /tasks/:id, GET/POST /contacts, GET/PATCH /contacts/:id,
GET/POST /jobs, GET/PATCH /jobs/:id, POST /notes, GET /activity, POST /inbound?token=, POST /inbound-call?token=,
DELETE /contacts/:id, POST /contacts/bulk {ids, action: archive|unarchive|delete}, GET /tasks?q=, GET /contacts?view=&kind=&q=
GET/POST /gear, PATCH/DELETE /gear/:id, POST /gear/:id/have {have},
GET /roles, POST /roles/:id/score {skill, want}, PATCH /roles/:id {owner} (Ricky only),
POST /roles/suggest {name, note}, PATCH /roles/suggest/:id {status: added|passed} (Ricky only)

## Roles rules
Scores stay hidden until every user has rated every active role. Then settings.roles_revealed is set and stays open.
Only Ricky can set an owner or act on a suggestion.
GET /checkin, POST /checkin/notes {week, notes}, POST /digest/test (Ricky only), POST /roles/:id/assign (Ricky only)
Tasks take repeat (weekly|monthly). Closing a repeating task creates the next one; Undo removes it.

## Schedule
Cron trigger `0 13 * * 1` (Mondays 7 AM Central) sends each owner their week by email. Set via PUT /workers/scripts/gbg-os-api/schedules.
A Claude scheduled task backs up every table to Drive weekly (GBG SERVICES / TECH & SYSTEMS).
