/**
 * UNC Sales OS — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /              — health check
 *   POST /sync          — log call outcome → HubSpot
 *   GET  /queue         — pull live dials from HubSpot for a rep
 *
 * Env vars (Cloudflare Secrets):
 *   HUBSPOT_TOKEN — pat-na2-... private app token
 *
 * Version: 2.0 — added /queue endpoint, removed /pin
 */

const ALLOWED_ORIGINS = [
  'https://urbannicheco.com',
  'https://www.urbannicheco.com'
];

const HUBSPOT_API = 'https://api.hubapi.com';

// Outcome → HubSpot lifecyclestage
const LIFECYCLE_BY_OUTCOME = {
  HOT:                'salesqualifiedlead',
  WARM:               'salesqualifiedlead',
  PARK:               'lead',
  COLD:               'other',
  'COLD-GK':          'lead',
  DNC:                'other',
  WRG:                'other',
  NA:                 'lead',
  REF:                'lead',
  BOOKED:             'salesqualifiedlead',
  PROPOSAL_REQUESTED: 'opportunity',
  CLOSED_WON:         'customer',
  SIGNED:             'customer',
  RENEWED:            'customer',
  UPSELL_BOOKED:      'customer'
};

// Outcome → follow-up task
const TASK_BY_OUTCOME = {
  HOT:                { title: 'Confirm audit booking — {business}',        minutes: 30 },
  WARM:               { title: 'Callback — {business} ({callback_window})', days: 1 },
  PARK:               { title: 'Recall — {business} (was a maybe)',         days: 30 },
  'COLD-GK':          { title: 'Retry gatekeeper bypass — {business}',      days: 14 },
  NA:                 { title: 'Retry — {business} (no answer)',            days: 3 },
  WRG:               { title: 'Verify number — {business}',                days: 1 },
  REF:               { title: 'Follow up on referral from {business}',     days: 1 },
  BOOKED:            { title: 'Inbound audit confirmation — {business}',   minutes: 30 },
  PROPOSAL_REQUESTED:{ title: 'Proposal follow-up — {business}',           days: 3 },
  FOLLOW_UP_BOOKED:  { title: 'Follow-up call — {business}',               days: 7 },
  INFO_SENT:         { title: 'Info follow-up — {business}',               days: 3 },
  CLOSED_WON:        { title: 'Onboarding kickoff — {business}',           days: 1 },
  SIGNED:            { title: 'Send onboarding email — {business}',        minutes: 60 },
  RENEWED:           { title: 'Send renewal confirmation — {business}',    minutes: 60 },
  UPSELL_BOOKED:     { title: 'Send upsell proposal — {business}',         days: 1 },
  AT_RISK:           { title: 'Risk intervention — {business}',            days: 1 },
  CHURN_FLAGGED:     { title: 'Save attempt — {business}',                 minutes: 30 }
};

// Properties to pull for each contact in /queue
const QUEUE_PROPERTIES = [
  'firstname', 'lastname', 'company', 'phone', 'email', 'website',
  'trade_type', 'city', 'state', 'segment',
  'last_call_outcome', 'last_call_date', 'last_call_notes',
  'do_not_call', 'best_phone_verified',
  'decision_maker_known', 'hubspot_owner_id',
  'hs_lead_status', 'lifecyclestage',
  'hs_content_membership_notes', 'notes', 'description', 'ai_hook',
  'sequence_status', 'sequence_notes', 'outreach_touch_count'
].join(',');

// Outcomes that disqualify a contact from the queue
const SKIP_OUTCOMES = new Set(['DNC', 'CLOSED_WON', 'SIGNED', 'RENEWED']);

// Cooldown in days per outcome before re-dialing
const COOLDOWN_DAYS = {
  COLD:     7,
  WARM:     1,
  PARK:     30,
  'COLD-GK':14,
  NA:       3,
  WRG:      1,
  REF:      1,
  HOT:      0
};

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin':  ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-unc-key',
    'Access-Control-Max-Age':       '86400'
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

async function hubspot(path, method, body, token) {
  const r = await fetch(HUBSPOT_API + path, {
    method,
    headers: {
      'Authorization':  'Bearer ' + token,
      'Content-Type':   'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

function branchPathReachedDM(branch_path) {
  if (!Array.isArray(branch_path)) return false;
  const joined = branch_path.join(' ');
  return /\b(opener:|resp:|yellow_retry:|busy:|trade_q2)\b/.test(joined) || /gk:HANDED_OVER/.test(joined);
}

function calcDueMs(rule) {
  const now = Date.now();
  if (rule.minutes) return now + rule.minutes * 60000;
  if (rule.days)    return now + rule.days * 86400000;
  return now + 86400000;
}

// ─── /queue helper ───────────────────────────────────────────────────────────
// Filters HubSpot contacts to return only eligible dials for a rep.
// Eligibility rules:
//   1. hubspot_owner_id matches rep's owner ID
//   2. phone is present
//   3. do_not_call is not true
//   4. last_call_outcome is not in SKIP_OUTCOMES
//   5. last_call_date is past the cooldown window for that outcome
//   6. Returns up to `limit` contacts, sorted by last_call_date ASC (oldest first)

async function fetchQueueForRep(ownerId, limit, token) {
  // Search HubSpot contacts owned by this rep with a phone number
  // Use CRM search to filter efficiently
  const searchBody = {
    filterGroups: [
      {
        filters: [
          { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
          { propertyName: 'phone', operator: 'HAS_PROPERTY' },
          { propertyName: 'do_not_call', operator: 'NEQ', value: 'true' }
        ]
      }
    ],
    properties: QUEUE_PROPERTIES.split(','),
    sorts: [{ propertyName: 'last_call_date', direction: 'ASCENDING' }],
    limit: 100 // pull more than needed so we can filter client-side
  };

  const r = await hubspot('/crm/v3/objects/contacts/search', 'POST', searchBody, token);
  if (!r.ok) return { ok: false, error: 'HubSpot search failed: ' + r.status };

  const contacts = (r.data && r.data.results) || [];
  const now = Date.now();
  const queue = [];

  for (const c of contacts) {
    const p = c.properties || {};

    // Skip DNC / closed outcomes
    const lastOutcome = (p.last_call_outcome || '').toUpperCase();
    if (SKIP_OUTCOMES.has(lastOutcome)) continue;

    // Already called today — skip entirely
    if (p.last_call_date) {
      const lastCallMs = new Date(p.last_call_date).getTime();
      const lastCallDate = new Date(p.last_call_date).toDateString();
      const todayDate = new Date().toDateString();
      if (lastCallDate === todayDate) continue;

      // Cooldown check for previous days
      const cooldownDays = COOLDOWN_DAYS[lastOutcome];
      if (cooldownDays !== undefined && cooldownDays > 0) {
        const cooldownMs = cooldownDays * 86400000;
        if (now - lastCallMs < cooldownMs) continue;
      }
    }

    queue.push({
      contact_id:           c.id,
      first_name:           p.firstname  || '',
      last_name:            p.lastname   || '',
      business_name:        p.company    || '',
      phone:                p.phone      || '',
      email:                p.email      || '',
      trade_type:           p.trade_type || '',
      city:                 p.city       || '',
      state:                p.state      || '',
      segment:              p.segment    || '',
      last_call_outcome:    p.last_call_outcome || '',
      last_call_date:       p.last_call_date    || '',
      decision_maker_known: p.decision_maker_known || '',
      best_phone_verified:  p.best_phone_verified  || '',
      lifecyclestage:       p.lifecyclestage        || '',
      company_notes:        p.description           || p.notes || p.hs_content_membership_notes || '',
      website:              p.website               || '',
      dealings_notes:       p.last_call_notes       || '',
      ai_hook:              p.ai_hook               || '',
      sequence_status:      p.sequence_status       || '',
      sequence_notes:       p.sequence_notes        || '',
      outreach_touch_count: p.outreach_touch_count  || '0'
    });

    if (queue.length >= limit) break;
  }

  return { ok: true, queue, total_eligible: queue.length };
}

// ─── syncCall ────────────────────────────────────────────────────────────────
async function syncCall(call, token) {
  const results = [];
  const contactId = call.contact_id;
  if (!contactId) {
    return { ok: false, error: 'No contact_id in payload', call_id: call.call_id };
  }

  const reachedDM = branchPathReachedDM(call.branch_path);
  const props = {
    last_call_outcome:       call.outcome_code || '',
    last_call_date:          call.timestamp || new Date().toISOString(),
    last_opener_variant:     call.opener_variant_used || '',
    last_call_duration_sec:  call.duration_seconds || 0,
    last_call_branch_path:   Array.isArray(call.branch_path) ? call.branch_path.join(' -> ') : (call.branch_path || ''),
    last_call_notes:         call.notes || '',
    callback_window:         call.callback_window || '',
    best_phone_verified:     call.outcome_code === 'WRG' ? 'false' : 'true'
  };

  if (reachedDM)                      props.decision_maker_known = 'true';
  if (call.outcome_code === 'DNC')    props.do_not_call = 'true';

  // Bump dial count
  const readContact = await hubspot('/crm/v3/objects/contacts/' + contactId + '?properties=dial_count_total', 'GET', null, token);
  let dialCount = 1;
  if (readContact.ok && readContact.data && readContact.data.properties) {
    const current = parseInt(readContact.data.properties.dial_count_total || '0', 10);
    dialCount = (isNaN(current) ? 0 : current) + 1;
  }
  props.dial_count_total = dialCount;

  const newStage = LIFECYCLE_BY_OUTCOME[call.outcome_code];
  if (newStage) props.lifecyclestage = newStage;

  const patch = await hubspot('/crm/v3/objects/contacts/' + contactId, 'PATCH', { properties: props }, token);
  results.push({ step: 'update_contact', ok: patch.ok, status: patch.status });

  if (!patch.ok) {
    return { ok: false, results, call_id: call.call_id, error: 'Contact update failed: ' + JSON.stringify(patch.data) };
  }

  const taskRule = TASK_BY_OUTCOME[call.outcome_code];
  if (taskRule) {
    const title = taskRule.title
      .replace('{business}', call.business_name || 'prospect')
      .replace('{callback_window}', call.callback_window || 'TBD');
    const task = await hubspot('/crm/v3/objects/tasks', 'POST', {
      properties: {
        hs_task_subject:   title,
        hs_task_type:      'CALL',
        hs_task_priority:  'HIGH',
        hs_task_status:    'NOT_STARTED',
        hs_timestamp:      calcDueMs(taskRule),
        hs_task_body:      'Auto-created by Sales OS cockpit after ' + (call.outcome_code || '?') + ' outcome.\n\nBranch path: ' + (Array.isArray(call.branch_path) ? call.branch_path.join(' -> ') : '') + '\nNotes: ' + (call.notes || '(none)'),
        hubspot_owner_id:  call.hubspot_owner_id || undefined
      },
      associations: [{
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }]
      }]
    }, token);
    results.push({ step: 'create_task', ok: task.ok, status: task.status, task_id: task.data && task.data.id });
  }

  return { ok: true, results, call_id: call.call_id, dial_count_total: dialCount };
}

// ─── Router ──────────────────────────────────────────────────────────────────
const SA={ALABAMA:'AL',ALASKA:'AK',ARIZONA:'AZ',ARKANSAS:'AR',CALIFORNIA:'CA',COLORADO:'CO',CONNECTICUT:'CT',DELAWARE:'DE',FLORIDA:'FL',GEORGIA:'GA',HAWAII:'HI',IDAHO:'ID',ILLINOIS:'IL',INDIANA:'IN',IOWA:'IA',KANSAS:'KS',KENTUCKY:'KY',LOUISIANA:'LA',MAINE:'ME',MARYLAND:'MD',MASSACHUSETTS:'MA',MICHIGAN:'MI',MINNESOTA:'MN',MISSISSIPPI:'MS',MISSOURI:'MO',MONTANA:'MT',NEBRASKA:'NE',NEVADA:'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND',OHIO:'OH',OKLAHOMA:'OK',OREGON:'OR',PENNSYLVANIA:'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD',TENNESSEE:'TN',TEXAS:'TX',UTAH:'UT',VERMONT:'VT',VIRGINIA:'VA',WASHINGTON:'WA','WEST VIRGINIA':'WV',WISCONSIN:'WI',WYOMING:'WY'};
function stAbbr(s){const u=(s||'').toUpperCase().trim();return SA[u]||u;}
async function paginateSearch(endpoint, filterGroups, properties, maxPages, token) {
  let all = [], after = undefined;
  for (let i = 0; i < maxPages; i++) {
    const body = { filterGroups, properties, limit: 100 };
    if (after) body.after = after;
    const r = await hubspot(endpoint, 'POST', body, token);
    if (!r.ok) break;
    const data = await r.json();
    all = all.concat(data.results || []);
    if (data.paging && data.paging.next && data.paging.next.after) after = data.paging.next.after;
    else break;
  }
  return all;
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {

    // ── OPT-IN AUTH GATE ── enforced only once the WORKSPACE_KEY secret is set.
    // Deploy: wrangler secret put WORKSPACE_KEY   (client must then send x-unc-key header)
    if (env.WORKSPACE_KEY && url.pathname !== '/' &&
        request.headers.get('x-unc-key') !== env.WORKSPACE_KEY) {
      return json({ ok: false, error: 'unauthorized' }, 401, cors);
    }
      return new Response(null, { headers: cors });
    }

    // Health check
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'unc-sales-os-sync', version: '2.0' }, 200, cors);
    }


    // ── GET /queue — pull live dials from HubSpot ──────────────────────────
    if (request.method === 'GET' && url.pathname === '/queue') {
      if (!env.HUBSPOT_TOKEN) {
        return json({ ok: false, error: 'HUBSPOT_TOKEN not configured' }, 500, cors);
      }
      const ownerId = url.searchParams.get('owner_id') || '';
      const limit   = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);
      if (!ownerId) {
        return json({ ok: false, error: 'owner_id is required' }, 400, cors);
      }
      try {
        const result = await fetchQueueForRep(ownerId, limit, env.HUBSPOT_TOKEN);
        return json(result, result.ok ? 200 : 502, cors);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500, cors);
      }
    }

    // ── GET /re-engage — Tyler's re-engage queue ─────────────────────────────
    // Returns contacts where sequence is complete with no reply, owned by Tyler.
    // Filters: sequence_status = COMPLETE_NO_REPLY, owner = Tyler, not DNC/closed.
    // Sorted by outreach_touch_count DESC (most-touched first).
    if (request.method === 'GET' && url.pathname === '/re-engage') {
      if (!env.HUBSPOT_TOKEN) {
        return json({ ok: false, error: 'HUBSPOT_TOKEN not configured' }, 500, cors);
      }
      const ownerId = url.searchParams.get('owner_id') || '164794304'; // Tyler default
      const limit   = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

      try {
        const RE_ENGAGE_PROPS = [
          'firstname', 'lastname', 'company', 'phone', 'email',
          'trade_type', 'city', 'state',
          'ai_hook', 'sequence_status', 'sequence_notes', 'outreach_touch_count',
          'last_call_outcome', 'last_call_date', 'do_not_call',
          'hubspot_owner_id', 'decision_maker_known'
        ];

        const searchBody = {
          filterGroups: [
            {
              filters: [
                { propertyName: 'sequence_status', operator: 'EQ', value: 'COMPLETE_NO_REPLY' },
                { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
                { propertyName: 'do_not_call', operator: 'NEQ', value: 'true' }
              ]
            }
          ],
          properties: RE_ENGAGE_PROPS,
          sorts: [{ propertyName: 'outreach_touch_count', direction: 'DESCENDING' }],
          limit
        };

        const r = await hubspot('/crm/v3/objects/contacts/search', 'POST', searchBody, env.HUBSPOT_TOKEN);
        if (!r.ok) return json({ ok: false, error: 'HubSpot search failed: ' + r.status }, 502, cors);

        const contacts = (r.data.results || []).map(c => {
          const p = c.properties || {};
          return {
            contact_id:           c.id,
            first_name:           p.firstname            || '',
            last_name:            p.lastname             || '',
            business_name:        p.company              || '',
            phone:                p.phone                || '',
            email:                p.email                || '',
            trade_type:           p.trade_type           || '',
            city:                 p.city                 || '',
            state:                p.state                || '',
            ai_hook:              p.ai_hook              || '',
            sequence_status:      p.sequence_status      || '',
            sequence_notes:       p.sequence_notes       || '',
            outreach_touch_count: p.outreach_touch_count || '0',
            last_call_outcome:    p.last_call_outcome    || '',
            decision_maker_known: p.decision_maker_known || ''
          };
        });

        return json({ ok: true, contacts, total: contacts.length }, 200, cors);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500, cors);
      }
    }

    // ── GET /search — search HubSpot contacts by name/business ─────────────
    // Runs THREE parallel searches and deduplicates:
    //   1. Free-text query (matches firstname, lastname, email, phone, company)
    //   2. company CONTAINS_TOKEN filter (catches business name searches)
    //   3. firstname/lastname CONTAINS_TOKEN filters (catches person name searches)
    if (request.method === 'GET' && url.pathname === '/search') {
      if (!env.HUBSPOT_TOKEN) return json({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
      const q = (url.searchParams.get('q') || '').trim();
      const limit = Math.min(parseInt(url.searchParams.get('limit')||'8',10), 20);
      if (!q) return json({ ok:false, error:'q is required' }, 400, cors);

      const PROPS = ['firstname','lastname','company','phone','email','trade_type','city','state','last_call_outcome','last_call_date','last_call_notes','hubspot_owner_id'];

      // Split query into tokens for name matching
      const tokens = q.split(/\s+/).filter(Boolean);
      const firstToken = tokens[0] || q;
      const lastToken  = tokens[tokens.length - 1] || q;

      // Search 1: free-text query (HubSpot searches firstname, lastname, email, phone, company)
      const s1 = hubspot('/crm/v3/objects/contacts/search', 'POST', {
        query: q,
        properties: PROPS,
        sorts: [{ propertyName:'createdate', direction:'DESCENDING' }],
        limit: limit
      }, env.HUBSPOT_TOKEN);

      // Search 2: company CONTAINS_TOKEN (catches "Embassy Construction" style searches)
      const s2 = hubspot('/crm/v3/objects/contacts/search', 'POST', {
        filterGroups: [{ filters: [{ propertyName:'company', operator:'CONTAINS_TOKEN', value: firstToken }] }],
        properties: PROPS,
        sorts: [{ propertyName:'createdate', direction:'DESCENDING' }],
        limit: limit
      }, env.HUBSPOT_TOKEN);

      // Search 3: firstname OR lastname CONTAINS_TOKEN
      const s3 = hubspot('/crm/v3/objects/contacts/search', 'POST', {
        filterGroups: [
          { filters: [{ propertyName:'firstname', operator:'CONTAINS_TOKEN', value: firstToken }] },
          { filters: [{ propertyName:'lastname',  operator:'CONTAINS_TOKEN', value: lastToken  }] }
        ],
        properties: PROPS,
        sorts: [{ propertyName:'createdate', direction:'DESCENDING' }],
        limit: limit
      }, env.HUBSPOT_TOKEN);

      // Search 4: phone CONTAINS_TOKEN (catches partial phone number searches)
      const s4 = hubspot('/crm/v3/objects/contacts/search', 'POST', {
        filterGroups: [{ filters: [{ propertyName:'phone', operator:'CONTAINS_TOKEN', value: firstToken }] }],
        properties: PROPS,
        sorts: [{ propertyName:'createdate', direction:'DESCENDING' }],
        limit: limit
      }, env.HUBSPOT_TOKEN);

      try {
        const [r1, r2, r3, r4] = await Promise.all([s1, s2, s3, s4]);

        // Merge + deduplicate by contact id
        const seen = new Set();
        const merged = [];
        for (const r of [r1, r2, r3, r4]) {
          if (r.ok && r.data && r.data.results) {
            for (const c of r.data.results) {
              if (!seen.has(c.id)) {
                seen.add(c.id);
                merged.push(c);
              }
            }
          }
        }

        const contacts = merged.slice(0, limit).map(c => ({
          contact_id:        c.id,
          first_name:        c.properties.firstname  || '',
          last_name:         c.properties.lastname   || '',
          business_name:     c.properties.company    || '',
          phone:             c.properties.phone      || '',
          email:             c.properties.email      || '',
          trade_type:        c.properties.trade_type || '',
          city:              c.properties.city       || '',
          state:             c.properties.state      || '',
          last_call_outcome: c.properties.last_call_outcome || '',
          last_call_date:    c.properties.last_call_date    || '',
          last_call_notes:   c.properties.last_call_notes   || ''
        }));

        return json({ ok:true, contacts, total:contacts.length }, 200, cors);
      } catch(e) { return json({ ok:false, error:e.message }, 500, cors); }
    }

    // ── GET /callbacks — contacts due for callback today ─────────────────────
    if (request.method === 'GET' && url.pathname === '/callbacks') {
      if (!env.HUBSPOT_TOKEN) {
        return json({ ok: false, error: 'HUBSPOT_TOKEN not configured' }, 500, cors);
      }
      const ownerId = url.searchParams.get('owner_id') || '';
      if (!ownerId) return json({ ok: false, error: 'owner_id required' }, 400, cors);

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const searchBody = {
          filterGroups: [{
            filters: [
              { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
              { propertyName: 'last_call_outcome', operator: 'EQ', value: 'WARM' },
              { propertyName: 'do_not_call', operator: 'NEQ', value: 'true' }
            ]
          }],
          properties: ['firstname','lastname','company','phone','email','trade_type','city','state','callback_window','last_call_date','last_call_notes'],
          sorts: [{ propertyName: 'last_call_date', direction: 'DESCENDING' }],
          limit: 20
        };
        const r = await hubspot('/crm/v3/objects/contacts/search', 'POST', searchBody, env.HUBSPOT_TOKEN);
        if (!r.ok) return json({ ok: false, error: 'HubSpot search failed' }, 502, cors);

        const now = Date.now();
        const callbacks = (r.data.results || []).map(c => {
          const p = c.properties || {};
          return {
            contact_id:      c.id,
            first_name:      p.firstname || '',
            last_name:       p.lastname  || '',
            business_name:   p.company   || '',
            phone:           p.phone     || '',
            trade_type:      p.trade_type || '',
            city:            p.city      || '',
            state:           p.state     || '',
            callback_window: p.callback_window || '',
            last_call_date:  p.last_call_date  || '',
            last_call_notes: p.last_call_notes  || ''
          };
        });
        return json({ ok: true, callbacks, total: callbacks.length }, 200, cors);
      } catch(e) {
        return json({ ok: false, error: e.message }, 500, cors);
      }
    }

    // ── GET /commissions — Tyler's commission summary from HubSpot deals ──────
    if (request.method === 'GET' && url.pathname === '/commissions') {
      if (!env.HUBSPOT_TOKEN) return json({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
      const ownerId = url.searchParams.get('owner_id') || '';
      if (!ownerId) return json({ ok:false, error:'owner_id required' }, 400, cors);

      const RATES = { retainer_y1:0.30, retainer_y2:0.10, project:0.25, merch:0.50 };
      const TYPE_LABELS = {
        retainer_y1:'Monthly Retainer Y1 (30%)',
        retainer_y2:'Monthly Retainer Y2+ (10%)',
        project:'One-Time Project Build (25%)',
        merch:'Branded Merchandise (50%)'
      };

      try {
        // Pull all closed-won deals owned by this rep
        const searchBody = {
          filterGroups: [{
            filters: [
              { propertyName:'hubspot_owner_id', operator:'EQ', value: ownerId },
              { propertyName:'dealstage',        operator:'EQ', value: 'closedwon' }
            ]
          }],
          properties: ['dealname','amount','deal_currency_code','closedate','createdate','unc_revenue_type','dealstage','hs_is_closed_won'],
          sorts: [{ propertyName:'closedate', direction:'DESCENDING' }],
          limit: 100
        };
        const r = await hubspot('/crm/v3/objects/deals/search', 'POST', searchBody, env.HUBSPOT_TOKEN);
        if (!r.ok) return json({ ok:false, error:'HubSpot deal search failed: '+r.status }, 502, cors);

        const deals = (r.data.results || []);
        const now = Date.now();
        let monthEarned = 0;
        let totalEarned = 0;
        let activeRetainers = 0;
        const clawbackRisk = [];
        const clientList = [];

        // Current month bounds
        const nowDate = new Date();
        const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
        const monthEnd   = new Date(nowDate.getFullYear(), nowDate.getMonth()+1, 0).getTime();

        for (const d of deals) {
          const p = d.properties || {};
          const amount = parseFloat(p.amount || '0');
          const revenueType = p.unc_revenue_type || 'project';
          const rate = RATES[revenueType] || 0.25;
          const comm = Math.round(amount * rate * 100) / 100;
          const closeMs = p.closedate ? new Date(p.closedate).getTime() : 0;
          const createMs = p.createdate ? new Date(p.createdate).getTime() : 0;

          // Month # for retainers — months since close date
          let monthNum = 1;
          if (revenueType === 'retainer_y1' || revenueType === 'retainer_y2') {
            const monthsSinceClose = Math.floor((now - closeMs) / (30.44 * 86400000));
            monthNum = Math.max(1, monthsSinceClose + 1);
            // Auto-correct type based on actual months
            const effectiveType = monthNum > 12 ? 'retainer_y2' : 'retainer_y1';
            const effectiveRate = RATES[effectiveType];
            const effectiveComm = Math.round(amount * effectiveRate * 100) / 100;

            if (effectiveType === 'retainer_y1') activeRetainers++;

            // This month earned — retainer clients contribute monthly
            if (closeMs <= monthEnd) monthEarned += effectiveComm;
            totalEarned += effectiveComm * monthNum;

            // Clawback risk: closed within last 60 days and on month 1
            if (monthNum === 1 && (now - closeMs) < 60 * 86400000) {
              clawbackRisk.push({ name: p.dealname || 'Unknown', amount: effectiveComm, deal_id: d.id });
            }

            clientList.push({
              deal_id:      d.id,
              name:         p.dealname || 'Unknown Deal',
              amount,
              revenue_type: effectiveType,
              type_label:   TYPE_LABELS[effectiveType],
              rate:         effectiveRate,
              commission:   effectiveComm,
              month_num:    monthNum,
              close_date:   p.closedate || '',
              clawback_risk: monthNum === 1 && (now - closeMs) < 60 * 86400000
            });
          } else {
            // One-time project / merch — earned at close date
            if (closeMs >= monthStart && closeMs <= monthEnd) monthEarned += comm;
            totalEarned += comm;
            clientList.push({
              deal_id:      d.id,
              name:         p.dealname || 'Unknown Deal',
              amount,
              revenue_type: revenueType,
              type_label:   TYPE_LABELS[revenueType] || revenueType,
              rate,
              commission:   comm,
              month_num:    null,
              close_date:   p.closedate || '',
              clawback_risk: false
            });
          }
        }

        return json({
          ok: true,
          summary: {
            month_earned:     Math.round(monthEarned * 100) / 100,
            total_earned:     Math.round(totalEarned * 100) / 100,
            active_clients:   deals.length,
            active_retainers: activeRetainers,
            claude_eligible:  activeRetainers > 0,
            clawback_risk:    clawbackRisk
          },
          clients: clientList
        }, 200, cors);

      } catch(e) { return json({ ok:false, error:e.message }, 500, cors); }
    }

    // ── GET /map — full CRM contact list for prospect map ──────────────────
    // Returns all contacts with city, state, trade, outcome for map plotting.
    // Paginates HubSpot up to 500 contacts per call (10 pages × 100).
    if (request.method === 'GET' && url.pathname === '/map') {
      if (!env.HUBSPOT_TOKEN) return json({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);

      try {
        const CO_PROPS = ['name','city','state','trade_type','hs_lead_status','ai_hook','description','num_associated_contacts'];
        const coFilter = [{ filters:[{ propertyName:'state', operator:'HAS_PROPERTY' }] }];
        const coRaw = await paginateSearch('/crm/v3/objects/companies/search', coFilter, CO_PROPS, 10, env.HUBSPOT_TOKEN);

        const companies = coRaw.map(c => {
          const p = c.properties || {};
          if (!p.state) return null;
          return {
            id:       c.id,
            type:     'company',
            name:     p.name || '',
            city:     p.city,
            state:    stAbbr(p.state),
            trade:    p.trade_type || '',
            outcome:  p.hs_lead_status || 'NA',
            ai_hook:  p.ai_hook || p.description || '',
            contacts: parseInt(p.num_associated_contacts||'0',10)
          };
        }).filter(Boolean);

        const CT_PROPS = ['firstname','lastname','company','city','state','trade_type','last_call_outcome','ai_hook'];
        const ctFilter = [{ filters:[{ propertyName:'state', operator:'HAS_PROPERTY' }] }];
        const ctRaw = await paginateSearch('/crm/v3/objects/contacts/search', ctFilter, CT_PROPS, 5, env.HUBSPOT_TOKEN);

        const contacts = ctRaw.map(c => {
          const p = c.properties || {};
          if (!p.state) return null;
          return {
            id:      c.id,
            type:    'contact',
            name:    [p.firstname, p.lastname].filter(Boolean).join(' ') || '',
            company: p.company || '',
            city:    p.city,
            state:   stAbbr(p.state),
            trade:   p.trade_type || '',
            outcome: p.last_call_outcome || 'NA',
            ai_hook: p.ai_hook || ''
          };
        }).filter(Boolean);

        const states    = new Set([...companies,...contacts].map(c=>c.state)).size;
        const hot       = companies.filter(c=>['HOT','CONNECTED','QUALIFIED'].includes(c.outcome)).length;
        const warm      = companies.filter(c=>['WARM','IN_PROGRESS','ATTEMPTED_TO_CONTACT'].includes(c.outcome)).length;
        const untouched = companies.filter(c=>!c.outcome||c.outcome==='NA'||c.outcome==='NEW').length;

        const allGeo=[...companies,...contacts];
        return json({ ok:true, companies:allGeo, contacts, stats:{ companies:allGeo.length, contacts:contacts.length, states, hot, warm, untouched } }, 200, cors);
      } catch(e) { return json({ ok:false, error:e.message }, 500, cors); }
    }

    // ── POST /sync — log call outcome → HubSpot ────────────────────────────
    if (request.method === 'POST' && url.pathname === '/sync') {
      if (!env.HUBSPOT_TOKEN) {
        return json({ ok: false, error: 'HUBSPOT_TOKEN not configured in Worker' }, 500, cors);
      }
      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return json({ ok: false, error: 'Invalid JSON' }, 400, cors);
      }
      const calls = payload.calls || (payload.call ? [payload.call] : null);
      if (!calls || !calls.length) {
        return json({ ok: false, error: 'No calls in payload' }, 400, cors);
      }
      const results = [];
      for (const call of calls) {
        try {
          const r = await syncCall(call, env.HUBSPOT_TOKEN);
          results.push(r);
        } catch (e) {
          results.push({ ok: false, call_id: call.call_id, error: e.message });
        }
      }
      const allOk = results.every(r => r.ok);
      return json({ ok: allOk, results }, allOk ? 200 : 207, cors);
    }

    return json({ ok: false, error: 'Not found' }, 404, cors);
  }
};
