# gbg-os-api (GBG CRM backend)

- Worker: `gbg-os-api` at https://gbg-os-api.ricky-a17.workers.dev
- Database: D1 `gbg-os` (id 71288793-c6e3-4999-9683-d224f1ae08a6), schema in `schema.sql`
- Source: `worker.js` in this folder. No secrets in it.
- Secrets (set on the Worker, never in a file or repo): PIN_RICKY, PIN_DOUG, TOKEN_SECRET, FORM_TOKEN, RETELL_TOKEN
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
Set a new secret_text value for PIN_RICKY or PIN_DOUG. Changing TOKEN_SECRET logs every device out.

## Website leads
POST /inbound?token=FORM_TOKEN with the Netlify form payload. Creates a contact, a Lead job,
and a "Respond to new website lead" task due today.

## Endpoints
GET /summary, GET/POST /tasks, PATCH /tasks/:id, GET/POST /contacts, GET/PATCH /contacts/:id,
GET/POST /jobs, GET/PATCH /jobs/:id, POST /notes, GET /activity, POST /inbound?token=, POST /inbound-call?token=,
DELETE /contacts/:id, POST /contacts/bulk {ids, action: archive|unarchive|delete}, GET /tasks?q=, GET /contacts?view=&kind=&q=
