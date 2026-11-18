# gbg-os-api (GBG CRM backend)

- Worker: `gbg-os-api` at https://gbg-os-api.ricky-a17.workers.dev
- Database: D1 `gbg-os` (id 71288793-c6e3-4999-9683-d224f1ae08a6), schema in `schema.sql`
- Source: `worker.js` in this folder. No secrets in it.
- Secrets (set on the Worker, never in a file or repo): PIN_RICKY, PIN_DOUG, TOKEN_SECRET, FORM_TOKEN
- Pages call it from `gbg-os/assets/api.js`. CORS only allows urbanbackstage.com.

## Redeploy
Multipart PUT from a Chrome tab logged into dash.cloudflare.com to
`/api/v4/accounts/<account>/workers/scripts/gbg-os-api`.
ALWAYS send `keep_bindings: ["secret_text","plain_text","d1"]` in the metadata, or the PINs and the
database binding get wiped. Bindings to keep: DB (d1).

## Change a PIN
Set a new secret_text value for PIN_RICKY or PIN_DOUG. Changing TOKEN_SECRET logs every device out.

## Website leads
POST /inbound?token=FORM_TOKEN with the Netlify form payload. Creates a contact, a Lead job,
and a "Respond to new website lead" task due today.
