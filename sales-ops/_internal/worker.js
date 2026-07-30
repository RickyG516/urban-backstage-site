/**
 * UNC Sales OS Sync — Cloudflare Worker  v3
 * Updated 2026-07-30
 *
 * ⚠ THIS FILE IS THE DEPLOYED SOURCE. Before this update the copy in this repo
 *   was an OLD DRAFT in which the auth gate sat INSIDE the `if (OPTIONS)` block,
 *   meaning every real GET served the entire CRM unauthenticated. It also had a
 *   crashing pagination helper and was missing urbanbackstage.com from CORS.
 *   Deploying that file would have been a live data breach. It has been replaced
 *   with the real deployed source. Keep them in sync from here on.
 *
 * DEPLOY: multipart PUT from a browser tab already logged into dash.cloudflare.com
 *   → /api/v4/accounts/<account_id>/workers/scripts/unc-sales-os-sync
 *   ALWAYS send keep_bindings:["secret_text","plain_text","secret_key"] or all
 *   four secrets are wiped. Full runbook: urban-niche-site workers/DEPLOY-SOP.md
 *   Verification gotcha: the multipart response uses CRLF — split on \r\n\r\n.
 *
 * AUTH: fails closed. Every path except '/' and '/pin' requires the x-unc-key
 *   header to equal WORKSPACE_KEY. A missing secret returns 503, never open.
 *
 * ENDPOINTS
 *   Cockpit (v2, unchanged):
 *     GET  /            health            POST /sync         log call outcome
 *     GET  /queue       rep dial queue    GET  /stats        call stats from KV
 *     POST /pin         PIN → key         GET  /commissions  rep commission calc
 *     GET  /search      contact search    GET  /map          geo prospect map
 *     GET  /callbacks   due callbacks     GET  /leaderboard  rep leaderboard
 *     GET|PUT /config   GET|PUT /goals    GET  /contact/:id  call history
 *     GET  /calendar/slots  POST /calendar/book  POST /places  POST /setup
 *
 *   Backstage data layer (v3, new — see banner further down):
 *     GET  /pipeline            deals by stage, junk-filtered
 *     GET  /clients[?slug=]     closed-won roster + social links
 *     GET  /delivery            open [DELIVERY] tasks grouped by client
 *     GET  /finance             MRR, booked, outstanding, 6-month trend
 *     GET  /brief               ranked signals — the brains layer
 *     POST /setup-social-fields creates instagram_page + google_business_url
 *
 * KV binding: CALL_LOG
 * Secrets:    HUBSPOT_TOKEN, WORKSPACE_KEY, PLACES_API_KEY
 */

const ALLOWED_ORIGINS = [
  'https://urbannicheco.com',
  'https://www.urbannicheco.com',
  'https://urbanbackstage.com',
  'https://www.urbanbackstage.com'
];

const HS = 'https://api.hubapi.com';

// ── OUTCOME MAPS ───────────────────────────────────────────────────────────
const LIFECYCLE_BY_OUTCOME = {
  HOT: 'salesqualifiedlead', WARM: 'salesqualifiedlead', PARK: 'lead',
  COLD: 'other', 'COLD-GK': 'lead', DNC: 'other', WRG: 'other', NA: 'lead',
  REF: 'lead', BOOKED: 'salesqualifiedlead', PROPOSAL_REQUESTED: 'opportunity',
  FOLLOW_UP_BOOKED: 'salesqualifiedlead', CLOSED_WON: 'customer',
  SIGNED: 'customer', RENEWED: 'customer', UPSELL_BOOKED: 'customer'
};

const TASK_BY_OUTCOME = {
  HOT:               { title: 'Confirm audit booking — {business}',        minutes: 30 },
  WARM:              { title: 'Callback — {business} ({window})',           days: 1 },
  PARK:              { title: 'Recall — {business} (parked)',               days: 30 },
  'COLD-GK':         { title: 'Retry gatekeeper — {business}',             days: 14 },
  NA:                { title: 'Retry — {business} (no answer)',             days: 3 },
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

// Outcomes that permanently exclude a contact from the cold-call queue
const HARD_EXCLUDE_OUTCOMES = new Set(['HOT','BOOKED','CLOSED_WON','SIGNED','DNC','WRG']);

// Default recycling rules (days before re-queuing) — overridden by KV config
const DEFAULT_RECYCLE_DAYS = {
  WARM: 7, PARK: 30, COLD: 30, 'COLD-GK': 14,
  NA: 3, NO_ANSWER: 3, VOICEMAIL: 3, REF: 7,
  PROPOSAL_REQUESTED: 14, FOLLOW_UP_BOOKED: 7,
  default: 30
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-unc-key',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResp(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

async function hs(path, method, body, token) {
  const r = await fetch(HS + path, {
    method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch(e) { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

function taskTitle(template, call) {
  return template
    .replace('{business}', call.business_name || 'prospect')
    .replace('{window}', call.callback_window || 'TBD');
}

function calcDueMs(rule) {
  const now = Date.now();
  if (rule.minutes) return now + rule.minutes * 60000;
  if (rule.days)    return now + rule.days * 86400000;
  return now + 86400000;
}

function branchReachedDM(branch_path) {
  if (!Array.isArray(branch_path)) return false;
  return /\b(opener:|resp:|yellow_retry:|trade_q2)\b/.test(branch_path.join(' '))
    || branch_path.join(' ').includes('gk:HANDED_OVER');
}

// ── KV HELPERS ─────────────────────────────────────────────────────────────
async function kvGet(kv, key) {
  try {
    const val = await kv.get(key);
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

async function kvSet(kv, key, value) {
  try {
    await kv.put(key, JSON.stringify(value));
    return true;
  } catch(e) { return false; }
}

async function appendCallLog(kv, repId, callRecord, contactId) {
  // Append to rep log (capped at 1000)
  const repKey = `calls:${repId}`;
  const repLog = await kvGet(kv, repKey) || [];
  repLog.unshift(callRecord);
  if (repLog.length > 1000) repLog.length = 1000;
  await kvSet(kv, repKey, repLog);

  // Append to team log (capped at 5000)
  const teamLog = await kvGet(kv, 'calls:all') || [];
  teamLog.unshift(callRecord);
  if (teamLog.length > 5000) teamLog.length = 5000;
  await kvSet(kv, 'calls:all', teamLog);

  // Append to contact history (capped at 20 per contact)
  if (contactId) {
    const contactKey = `contact:${contactId}:history`;
    const contactLog = await kvGet(kv, contactKey) || [];
    contactLog.unshift(callRecord);
    if (contactLog.length > 20) contactLog.length = 20;
    await kvSet(kv, contactKey, contactLog);
  }

  // Update goal progress
  await updateGoalProgress(kv, callRecord);
}

async function updateGoalProgress(kv, callRecord) {
  if (!['CLOSED_WON', 'SIGNED'].includes(callRecord.outcome_code)) return;
  const goals = await kvGet(kv, 'goals:team');
  if (!goals) return;
  goals.current_value = (goals.current_value || 0) + 1;
  goals.achieved = goals.current_value >= (goals.target_value || 1);
  goals.last_updated = new Date().toISOString();
  await kvSet(kv, 'goals:team', goals);
}

// ── CONFIG ─────────────────────────────────────────────────────────────────
async function getConfig(kv) {
  const rules = await kvGet(kv, 'config:queue_rules') || DEFAULT_RECYCLE_DAYS;
  const props = await kvGet(kv, 'config:hubspot_props') || {
    trade: 'trade_type',
    owner: 'hubspot_owner_id',
    lastOutcome: 'last_call_outcome',
    lastCallDate: 'last_call_date',
    dialCount: 'dial_count_total',
    doNotCall: 'do_not_call',
    serviceInterest: 'service_interest',
    segment: 'segment'
  };
  return { rules, props };
}

// ── RECYCLING FILTER ────────────────────────────────────────────────────────
function isEligible(contact, config) {
  const props = contact.properties || {};
  const outcome = props.last_call_outcome || '';
  const lastCallDate = props.last_call_date ? new Date(props.last_call_date).getTime() : null;
  const doNotCall = props.do_not_call === 'true';

  if (doNotCall) return false;
  if (HARD_EXCLUDE_OUTCOMES.has(outcome)) return false;

  if (!lastCallDate) return true; // Never called — always eligible

  const daysSinceCall = (Date.now() - lastCallDate) / 86400000;
  const recycleDays = config.rules[outcome] || config.rules.default || 30;
  return daysSinceCall >= recycleDays;
}

// ── SYNC (POST /sync) ───────────────────────────────────────────────────────
async function handleSync(call, token, kv) {
  const results = [];
  const contactId = call.contact_id;
  if (!contactId) return { ok: false, error: 'No contact_id', call_id: call.call_id };

  // 1. Build contact property update
  const reachedDM = branchReachedDM(call.branch_path);
  const props = {
    last_call_outcome: call.outcome_code || '',
    last_call_date:    call.timestamp || new Date().toISOString(),
    last_opener_variant: call.opener_variant_used || '',
    last_call_duration_sec: call.duration_seconds || 0,
    last_call_branch_path: Array.isArray(call.branch_path)
      ? call.branch_path.join(' -> ') : (call.branch_path || ''),
    last_call_notes:   call.notes || '',
    callback_window:   call.callback_window || '',
    best_phone_verified: call.outcome_code === 'WRG' ? 'false' : 'true'
  };
  if (reachedDM)                  props.decision_maker_known = 'true';
  if (call.outcome_code === 'DNC') props.do_not_call = 'true';

  // Increment dial count
  const readR = await hs('/crm/v3/objects/contacts/' + contactId + '?properties=dial_count_total,discovery_findings,last_call_notes', 'GET', null, token);
  let dialCount = 1;
  if (readR.ok && readR.data?.properties) {
    const cur = parseInt(readR.data.properties.dial_count_total || '0', 10);
    dialCount = (isNaN(cur) ? 0 : cur) + 1;
  }
  props.dial_count_total = dialCount;

    // ── Anchor + discovery fields — write only when present, never blank existing data ──
    if (call.avg_ticket !== undefined && call.avg_ticket !== null && String(call.avg_ticket) !== '') props.avg_ticket = String(call.avg_ticket);
    if (call.profit_margin !== undefined && call.profit_margin !== null && String(call.profit_margin) !== '') props.profit_margin = String(call.profit_margin);
    if (call.package_pitched) props.package_pitched = call.package_pitched;
    if (call.quoted_price !== undefined && call.quoted_price !== null && String(call.quoted_price) !== '') props.quoted_price = String(call.quoted_price);
    if (call.recommended_package) props.recommended_package = call.recommended_package;
    if (call.pitch_outcome) props.pitch_outcome = call.pitch_outcome;
    if (call.discovery_date) props.discovery_date = call.discovery_date;
    // discovery_findings + last_call_notes: MERGE into the ongoing log, never overwrite
    const prevP = (readR.ok && readR.data && readR.data.properties) ? readR.data.properties : {};
    if (call.discovery_findings && String(call.discovery_findings).trim()) {
      const prevDF = (prevP.discovery_findings || '').trim();
      const newDF = String(call.discovery_findings).trim();
      if (!prevDF) props.discovery_findings = newDF;
      else if (prevDF === newDF || prevDF.indexOf(newDF) !== -1) props.discovery_findings = prevDF;
      else props.discovery_findings = prevDF + '\n— ' + String(call.timestamp || '').slice(0, 10) + ' —\n' + newDF;
    }
    if (props.last_call_notes && String(props.last_call_notes).trim()) {
      const prevN = (prevP.last_call_notes || '').trim();
      const newN = String(props.last_call_notes).trim();
      if (prevN && (prevN === newN || prevN.indexOf(newN) !== -1)) props.last_call_notes = prevN;
      else if (prevN) props.last_call_notes = prevN + '\n— ' + String(call.timestamp || '').slice(0, 10) + ' —\n' + newN;
    } else {
      delete props.last_call_notes; // no new notes this call — leave the existing log untouched
    }

  const newStage = LIFECYCLE_BY_OUTCOME[call.outcome_code];
  if (newStage) props.lifecyclestage = newStage;

  // Patch contact
  const patch = await hs('/crm/v3/objects/contacts/' + contactId, 'PATCH', { properties: props }, token);
  results.push({ step: 'update_contact', ok: patch.ok, status: patch.status });
  if (!patch.ok) return { ok: false, results, call_id: call.call_id, error: 'Contact update failed' };

  // 2. Auto-complete previous open tasks for this contact
  try {
    const tasksR = await hs(
      `/crm/v3/objects/tasks/search`,
      'POST',
      {
        filterGroups: [{
          filters: [
            { propertyName: 'associations.contact', operator: 'EQ', value: contactId },
            { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }
          ]
        }],
        properties: ['hs_task_subject', 'hs_task_status'],
        limit: 5
      },
      token
    );
    if (tasksR.ok && tasksR.data?.results?.length) {
      for (const task of tasksR.data.results) {
        await hs(`/crm/v3/objects/tasks/${task.id}`, 'PATCH',
          { properties: { hs_task_status: 'COMPLETED' } }, token);
      }
      results.push({ step: 'complete_old_tasks', count: tasksR.data.results.length, ok: true });
    }
  } catch(e) { results.push({ step: 'complete_old_tasks', ok: false, error: e.message }); }

  // 3. Create new follow-up task
  const taskRule = TASK_BY_OUTCOME[call.outcome_code];
  if (taskRule) {
    const taskR = await hs('/crm/v3/objects/tasks', 'POST', {
      properties: {
        hs_task_subject: taskTitle(taskRule.title, call),
        hs_task_type: 'CALL',
        hs_task_priority: 'HIGH',
        hs_task_status: 'NOT_STARTED',
        hs_timestamp: calcDueMs(taskRule),
        hs_task_body: `Logged by ${call.rep_name || 'rep'} via Sales OS\nOutcome: ${call.outcome_code}\nPath: ${Array.isArray(call.branch_path) ? call.branch_path.join(' -> ') : ''}\nNotes: ${call.notes || '(none)'}`,
        hubspot_owner_id: call.hubspot_owner_id || undefined
      },
      associations: [{
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }]
      }]
    }, token);
    results.push({ step: 'create_task', ok: taskR.ok, status: taskR.status });
  }

  // 4. Write call record to KV
  const callRecord = {
    call_id: call.call_id,
    timestamp: call.timestamp || new Date().toISOString(),
    rep_id: call.rep_id || '',
    rep_name: call.rep_name || '',
    contact_id: contactId,
    business_name: call.business_name || '',
    trade: call.trade || '',
    city: call.city || '',
    outcome_code: call.outcome_code || '',
    cockpit: call.cockpit || 'cold-call',
    opener_variant_used: call.opener_variant_used || '',
    duration_seconds: call.duration_seconds || 0,
    notes: call.notes || '',
    callback_window: call.callback_window || '',
    branch_path: call.branch_path || [],
    quoted_price: call.quoted_price || '',
    package_pitched: call.package_pitched || '',
    dial_count_total: dialCount
  };

  if (kv) await appendCallLog(kv, call.rep_id || 'unknown', callRecord, contactId);

  return { ok: true, results, call_id: call.call_id, dial_count_total: dialCount };
}

// ── QUEUE (GET /queue) ──────────────────────────────────────────────────────
async function handleQueue(url, token, kv) {
  const repId    = url.searchParams.get('rep_id') || '';
  const ownerId  = url.searchParams.get('owner_id') || '';
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 25);
  const cockpit  = url.searchParams.get('cockpit') || '';

  const NICHE_TRADE_TYPES = [
    'Restaurant','Bar / Venue','Bar','Retail','Salon / Spa','Auto Repair',
    'Gym / Fitness','Real Estate','Medical / Dental','Property Management',
    'Home Services','Food & Beverage','Entertainment','Café','Bakery','Catering',
    'Photography','Event Venue','Hotel','Brewery','Winery','Fitness Studio'
  ];

  if (!ownerId) return { ok: false, error: 'owner_id required' };

  const config = kv ? await getConfig(kv) : { rules: DEFAULT_RECYCLE_DAYS, props: {} };
  const p = config.props;

  // Build filter set — niche-outreach cockpit gets a non-contractor trade_type filter
  const _baseFilters = [
    { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
    { propertyName: 'phone',            operator: 'HAS_PROPERTY' },
    { propertyName: 'do_not_call',      operator: 'NEQ', value: 'true' }
  ];
  if (cockpit === 'niche-outreach') {
    _baseFilters.push({ propertyName: p.trade || 'trade_type', operator: 'IN', values: NICHE_TRADE_TYPES });
  }

  // Search HubSpot for owned contacts with phone
  const searchR = await hs('/crm/v3/objects/contacts/search', 'POST', {
    filterGroups: [{ filters: _baseFilters }],
    properties: [
      'firstname', 'lastname', 'company', 'phone', 'mobilephone',
      p.trade || 'trade_type', p.lastOutcome || 'last_call_outcome',
      p.lastCallDate || 'last_call_date', p.dialCount || 'dial_count_total',
      p.serviceInterest || 'service_interest', p.segment || 'segment',
      'city', 'state', 'hubspot_owner_id', 'lifecyclestage', 'notes', 'ai_hook'
    , 'discovery_findings', 'discovery_date', 'recommended_package', 'avg_ticket', 'profit_margin', 'pitch_script', 'package_pitched', 'quoted_price', 'pitch_outcome', 'quick_win', 'gbp_review_count', 'website_gaps'],
    sorts: [{ propertyName: p.lastCallDate || 'last_call_date', direction: 'ASCENDING' }],
    limit: 50
  }, token);

  if (!searchR.ok) return { ok: false, error: 'HubSpot search failed', detail: searchR.data };

  const contacts = (searchR.data?.results || []).filter(c => isEligible(c, config));
  const queue = contacts.slice(0, limit).map(c => {
    const pr = c.properties || {};
    const trade = pr[p.trade || 'trade_type'] || pr.trade_type || '';
    const phone = pr.phone || pr.mobilephone || '';
    const firstName = pr.firstname || '';
    const lastName = pr.lastname || '';

    return {
      discovery_findings: pr.discovery_findings || '', discovery_date: pr.discovery_date || '', recommended_package: pr.recommended_package || '', avg_ticket: pr.avg_ticket || '', profit_margin: pr.profit_margin || '',
      pitch_script: pr.pitch_script || '',
      package_pitched: pr.package_pitched || '',
      quoted_price: pr.quoted_price || '',
      pitch_outcome: pr.pitch_outcome || '', quick_win: pr.quick_win || '', gbp_review_count: pr.gbp_review_count || '', website_gaps: pr.website_gaps || '',
      contact_id:    c.id,
      first_name:    firstName,
      last_name:     lastName,
      business_name: pr.company || `${firstName} ${lastName}`.trim(),
      phone,
      trade,
      city:          pr.city || '',
      state:         pr.state || '',
      last_outcome:  pr[p.lastOutcome || 'last_call_outcome'] || '',
      last_call_date:pr[p.lastCallDate || 'last_call_date'] || null,
      dial_count:    parseInt(pr[p.dialCount || 'dial_count_total'] || '0', 10),
      service_interest: pr[p.serviceInterest || 'service_interest'] || '',
      hubspot_url: `https://app-na2.hubspot.com/contacts/245833525/contact/${c.id}`,
      ai_hook:   pr.ai_hook || '',
      vertical:  trade  // alias for niche-outreach cockpit
    };
  });

  // Attach contact history from KV for each card
  if (kv) {
    await Promise.all(queue.map(async card => {
      const history = await kvGet(kv, `contact:${card.contact_id}:history`);
      card.call_history = (history || []).slice(0, 5);
    }));
  }

  return { ok: true, queue, total_eligible: contacts.length };
}

// ── STATS (GET /stats) ──────────────────────────────────────────────────────
function filterByRange(calls, range) {
  const now = Date.now();
  const cutoffs = { today: 86400000, week: 7*86400000, month: 30*86400000, all: 0 };
  const ms = cutoffs[range] || 0;
  return ms === 0 ? calls : calls.filter(c => new Date(c.timestamp).getTime() >= now - ms);
}

function aggregateCalls(calls) {
  const total = calls.length;
  const hot   = calls.filter(c => ['HOT','BOOKED','CLOSED_WON','SIGNED'].includes(c.outcome_code)).length;
  const warm  = calls.filter(c => ['WARM','PARK','PROPOSAL_REQUESTED','FOLLOW_UP_BOOKED','INFO_SENT'].includes(c.outcome_code)).length;
  const cold  = calls.filter(c => ['COLD','COLD-GK','DNC','WRG'].includes(c.outcome_code)).length;
  const noAnswer = calls.filter(c => ['NA','NO_ANSWER','VOICEMAIL'].includes(c.outcome_code)).length;
  const connected = calls.filter(c => !['NA','NO_ANSWER','VOICEMAIL','WRG','NO_SHOW','SPAM'].includes(c.outcome_code)).length;

  // By hour of day (0-23)
  const byHour = Array(24).fill(0).map(() => ({ total: 0, positive: 0 }));
  // By day of week (0=Sun)
  const byDay  = Array(7).fill(0).map(() => ({ total: 0, positive: 0 }));
  // By opener variant
  const byVariant = {};
  // By rep
  const byRep = {};

  for (const c of calls) {
    const d = new Date(c.timestamp);
    const h = d.getHours(), dow = d.getDay();
    const positive = ['HOT','BOOKED','WARM','PROPOSAL_REQUESTED','FOLLOW_UP_BOOKED'].includes(c.outcome_code);
    byHour[h].total++;
    byDay[dow].total++;
    if (positive) { byHour[h].positive++; byDay[dow].positive++; }

    if (c.opener_variant_used) {
      const v = c.opener_variant_used;
      if (!byVariant[v]) byVariant[v] = { total: 0, hot: 0, warm: 0, cold: 0 };
      byVariant[v].total++;
      if (['HOT','BOOKED','CLOSED_WON'].includes(c.outcome_code)) byVariant[v].hot++;
      else if (['WARM','PROPOSAL_REQUESTED','FOLLOW_UP_BOOKED'].includes(c.outcome_code)) byVariant[v].warm++;
      else byVariant[v].cold++;
    }

    const rep = c.rep_id || 'unknown';
    if (!byRep[rep]) byRep[rep] = { rep_name: c.rep_name || rep, total: 0, hot: 0, warm: 0 };
    byRep[rep].total++;
    if (['HOT','BOOKED','CLOSED_WON'].includes(c.outcome_code)) byRep[rep].hot++;
    else if (['WARM','PROPOSAL_REQUESTED'].includes(c.outcome_code)) byRep[rep].warm++;
  }

  const avgDuration = total ? Math.round(calls.reduce((s,c) => s + (c.duration_seconds||0), 0) / total) : 0;

  return {
    total, hot, warm, cold, noAnswer, connected,
    connectRate: total ? Math.round((connected/total)*100) : 0,
    convRate:    total ? Math.round(((hot+warm)/total)*100) : 0,
    avgDuration,
    byHour, byDay, byVariant, byRep
  };
}

async function handleStats(url, kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const repId = url.searchParams.get('rep_id') || '';
  const range = url.searchParams.get('range') || 'week';
  const view  = url.searchParams.get('view') || 'individual'; // individual | team

  let calls;
  if (view === 'team' || !repId) {
    calls = await kvGet(kv, 'calls:all') || [];
  } else {
    calls = await kvGet(kv, `calls:${repId}`) || [];
  }

  const filtered = filterByRange(calls, range);
  const stats = aggregateCalls(filtered);

  // Recent activity (last 20 calls)
  const recent = filtered.slice(0, 20).map(c => ({
    timestamp: c.timestamp,
    business_name: c.business_name,
    outcome_code: c.outcome_code,
    cockpit: c.cockpit,
    duration_seconds: c.duration_seconds,
    rep_name: c.rep_name,
    notes: c.notes
  }));

  return { ok: true, stats, recent, range, view, count: filtered.length };
}

// ── LEADERBOARD (GET /leaderboard) ─────────────────────────────────────────
async function handleLeaderboard(kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const calls = await kvGet(kv, 'calls:all') || [];
  const month = filterByRange(calls, 'month');
  const week  = filterByRange(calls, 'week');
  const today = filterByRange(calls, 'today');

  const HOT_SET  = ['HOT','BOOKED','CLOSED_WON','SIGNED'];
  const WARM_SET = ['WARM','PARK','PROPOSAL_REQUESTED','FOLLOW_UP_BOOKED','INFO_SENT'];

  function repSlice(list) {
    const out = {};
    for (const c of list) {
      const id = c.rep_id || 'unknown';
      if (!out[id]) out[id] = { rep_id: id, rep_name: c.rep_name || id, dials: 0, hot: 0, warm: 0, quoted: 0, dur: 0 };
      const r = out[id];
      r.dials++;
      if (HOT_SET.indexOf(c.outcome_code) !== -1) r.hot++;
      else if (WARM_SET.indexOf(c.outcome_code) !== -1) r.warm++;
      const q = parseFloat(c.quoted_price); if (!isNaN(q)) r.quoted += q;
      r.dur += (c.duration_seconds || 0);
    }
    Object.keys(out).forEach(k => {
      const r = out[k];
      r.conv = r.dials ? Math.round(((r.hot + r.warm) / r.dials) * 100) : 0;
      r.avg_duration = r.dials ? Math.round(r.dur / r.dials) : 0;
      delete r.dur;
    });
    return out;
  }

  const mo = repSlice(month), wk = repSlice(week), td = repSlice(today);

  // Streaks + personal bests — per rep, from all stored calls
  const byRepDates = {};
  for (const c of calls) {
    const id = c.rep_id || 'unknown';
    const d = String(c.timestamp || '').slice(0, 10);
    if (!d) continue;
    if (!byRepDates[id]) byRepDates[id] = {};
    byRepDates[id][d] = (byRepDates[id][d] || 0) + 1;
  }
  function streakFor(dates) {
    let streak = 0;
    const day = new Date();
    for (let i = 0; i < 60; i++) {
      const dow = day.getUTCDay();
      const key = day.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6) { // weekdays only
        if (dates[key]) streak++;
        else if (i > 0) break; // today itself may not have calls yet — free pass on i=0
      }
      day.setUTCDate(day.getUTCDate() - 1);
    }
    return streak;
  }
  function bestDayFor(dates) {
    let best = { date: null, dials: 0 };
    Object.keys(dates).forEach(d => { if (dates[d] > best.dials) best = { date: d, dials: dates[d] }; });
    return best;
  }

  const repIds = Object.keys(Object.assign({}, mo, wk, td, byRepDates));
  const reps = repIds.map(id => ({
    rep_id: id,
    rep_name: (mo[id] || wk[id] || td[id] || {}).rep_name || id,
    today: td[id] || { dials: 0, hot: 0, warm: 0, quoted: 0, conv: 0 },
    week:  wk[id] || { dials: 0, hot: 0, warm: 0, quoted: 0, conv: 0 },
    month: mo[id] || { dials: 0, hot: 0, warm: 0, quoted: 0, conv: 0 },
    streak_days: streakFor(byRepDates[id] || {}),
    best_day: bestDayFor(byRepDates[id] || {})
  })).sort((a, b) => (b.week.dials || 0) - (a.week.dials || 0));

  // Variant performance (month)
  const byVariant = {};
  for (const c of month) {
    if (!c.opener_variant_used) continue;
    const v = c.opener_variant_used;
    if (!byVariant[v]) byVariant[v] = { variant: v, total: 0, positive: 0 };
    byVariant[v].total++;
    if (HOT_SET.indexOf(c.outcome_code) !== -1 || WARM_SET.indexOf(c.outcome_code) !== -1) byVariant[v].positive++;
  }
  const variants = Object.keys(byVariant).map(v => {
    const x = byVariant[v];
    return { variant: v, total: x.total, positive: x.positive, convPct: x.total ? Math.round((x.positive / x.total) * 100) : 0 };
  }).sort((a, b) => b.convPct - a.convPct);

  // Objection frequency (month) — from branch paths
  const objTally = {};
  const OBJ_RE = /(obj|stall|deflect|complacency|burned|price|capacity|gk|remorse|resist)/i;
  for (const c of month) {
    const bp = Array.isArray(c.branch_path) ? c.branch_path : [];
    for (const seg of bp) {
      const tag = String(seg).split(':')[0];
      if (OBJ_RE.test(tag)) objTally[tag] = (objTally[tag] || 0) + 1;
    }
  }
  const objections = Object.keys(objTally).map(t => ({ tag: t, count: objTally[t] })).sort((a, b) => b.count - a.count).slice(0, 15);

  const team = {
    week_dials: week.length,
    week_hot: week.filter(c => HOT_SET.indexOf(c.outcome_code) !== -1).length,
    week_warm: week.filter(c => WARM_SET.indexOf(c.outcome_code) !== -1).length,
    week_quoted: week.reduce((t, c) => { const q = parseFloat(c.quoted_price); return t + (isNaN(q) ? 0 : q); }, 0),
    month_dials: month.length
  };

  const recent = calls.slice(0, 10).map(c => ({ timestamp: c.timestamp, rep_name: c.rep_name, business_name: c.business_name, outcome_code: c.outcome_code, cockpit: c.cockpit }));

  return { ok: true, reps, team, variants, objections, recent };
}

// ── PIN VERIFY (POST /pin) ──────────────────────────────────────────────────
// This endpoint is exempt from the auth gate ON PURPOSE: it is how a device with
// no key gets one. A correct PIN returns the WORKSPACE_KEY so the browser can
// self-heal after localStorage is cleared.
//
// DESIGN NOTE — there is deliberately NO LOCKOUT. Repeated wrong PINs only make
// each *failed* response slower (capped at 5s, counter self-expires in 15 min).
// A correct PIN always succeeds instantly on the very next attempt, no matter how
// many failures came before it. Nobody can ever be locked out of their own tools.
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function handlePin(body, kv, env, origin) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const { rep_id, pin } = body || {};
  if (!rep_id || !pin) return { ok: false, error: 'rep_id and pin required' };

  const stored = await kvGet(kv, `pin:${rep_id}`);
  if (!stored) return { ok: false, error: 'Rep not found' };

  // Stored value may be a sha256 hex digest (preferred) or a legacy plaintext PIN.
  const s = String(stored);
  const match = /^[a-fA-F0-9]{64}$/.test(s)
    ? (await sha256Hex(pin)) === s.toLowerCase()
    : s === String(pin);

  const failKey = `pinfail:${rep_id}`;

  if (match) {
    try { await kv.delete(failKey); } catch(e) {}
    // Only hand the key back to a real browser on one of our own pages.
    const trusted = ALLOWED_ORIGINS.includes(origin);
    return {
      ok: true,
      rep_id,
      key: trusted ? (env && env.WORKSPACE_KEY ? env.WORKSPACE_KEY : undefined) : undefined,
      key_withheld: trusted ? undefined : 'untrusted origin'
    };
  }

  let n = 0;
  try { n = Number(await kv.get(failKey)) || 0; } catch(e) { n = 0; }
  n += 1;
  try { await kv.put(failKey, String(n), { expirationTtl: 900 }); } catch(e) {}
  const delayMs = Math.min(n * 750, 5000);
  if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

  return { ok: false, rep_id, error: 'Incorrect PIN' };
}

// ── CONTACT HISTORY (GET /contact/:id/history) ─────────────────────────────
async function handleContactHistory(contactId, kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const history = await kvGet(kv, `contact:${contactId}:history`) || [];
  return { ok: true, contact_id: contactId, history };
}

// ── GOALS (GET/PUT /goals) ──────────────────────────────────────────────────
async function handleGetGoals(kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const teamGoal = await kvGet(kv, 'goals:team') || {
    id: 'first_retainer',
    label: 'First Retainer Client',
    reward: 'Steak dinner — team celebration',
    target_metric: 'closed_won_count',
    target_value: 1,
    current_value: 0,
    achieved: false,
    active: true
  };
  return { ok: true, team: teamGoal };
}

async function handlePutGoals(body, kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  await kvSet(kv, 'goals:team', body);
  return { ok: true };
}

// ── CONFIG (GET/PUT /config) ────────────────────────────────────────────────
async function handleGetConfig(kv) {
  const config = await getConfig(kv);
  return { ok: true, ...config };
}

async function handlePutConfig(body, kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  if (body.rules) await kvSet(kv, 'config:queue_rules', body.rules);
  if (body.props) await kvSet(kv, 'config:hubspot_props', body.props);
  return { ok: true };
}

// ── SETUP (POST /setup) — run once ─────────────────────────────────────────
async function handleSetup(kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const steps = [];

  await kvSet(kv, 'config:queue_rules', DEFAULT_RECYCLE_DAYS);
  steps.push('queue_rules initialized');

  await kvSet(kv, 'config:hubspot_props', {
    trade: 'trade_type', owner: 'hubspot_owner_id',
    lastOutcome: 'last_call_outcome', lastCallDate: 'last_call_date',
    dialCount: 'dial_count_total', doNotCall: 'do_not_call',
    serviceInterest: 'service_interest', segment: 'segment'
  });
  steps.push('hubspot_props initialized');

  // SECURITY: never commit real PINs to source. Set via: wrangler kv key put pin:ricky <PIN> --binding=CALL_LOG
  await kvSet(kv, 'pin:ricky', 'SET-VIA-WRANGLER');
  steps.push('pin:ricky set');

  // SECURITY: never commit real PINs to source. Set via: wrangler kv key put pin:tyler <PIN> --binding=CALL_LOG
  await kvSet(kv, 'pin:tyler', 'SET-VIA-WRANGLER');
  steps.push('pin:tyler set');

  await kvSet(kv, 'goals:team', {
    id: 'first_retainer',
    label: 'First Retainer Client',
    reward: 'Steak dinner — team celebration',
    target_metric: 'closed_won_count',
    target_value: 1,
    current_value: 0,
    achieved: false,
    active: true,
    created_at: new Date().toISOString()
  });
  steps.push('team goal initialized — First Retainer Client → Steak dinner');

  return { ok: true, steps };
}


// ── GOOGLE CALENDAR HELPERS ────────────────────────────────────────────────
const GCAL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCAL_BASE      = 'https://www.googleapis.com/calendar/v3';

// Event type configuration — availability rules + durations
const EVENT_TYPES = {
  audit: {
    label: 'Free Website Audit Call',
    duration: 15,   // minutes
    days: [1,2,3,4,5],  // Mon-Fri
    hours: { 1:[9,16], 2:[9,16], 3:[9,16], 4:[9,16], 5:[9,15] }, // {day: [startHr, endHr]}
    notice_hours: 4,
    window_days: 60,
    color: '6'  // HubSpot orange-ish (Tangerine in Google Calendar)
  },
  discovery: {
    label: 'Discovery Call',
    duration: 30,
    days: [1,2,3,4],  // Mon-Thu
    hours: { 1:[10,15], 2:[10,15], 3:[10,15], 4:[10,15] },
    notice_hours: 4,
    window_days: 60,
    color: '9'
  },
  strategy: {
    label: 'Strategy Session',
    duration: 45,
    days: [2,3,4],   // Tue-Thu
    hours: { 2:[13,15], 3:[13,15], 4:[13,15] },
    notice_hours: 4,
    window_days: 60,
    color: '11'
  }
};

async function getAccessToken(kv) {
  // Try cached access token first
  const cached = await kvGet(kv, 'calendar:access_token');
  if (cached && cached.expires_at && Date.now() < cached.expires_at - 60000) {
    return cached.token;
  }
  // Refresh using stored credentials
  const creds = await kvGet(kv, 'calendar:credentials');
  if (!creds || !creds.refresh_token || !creds.client_id || !creds.client_secret) {
    throw new Error('Calendar credentials not configured. Run /setup-calendar first.');
  }
  const r = await fetch(GCAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type:    'refresh_token'
    })
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  // Cache for 55 minutes
  await kvSet(kv, 'calendar:access_token', {
    token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  });
  return data.access_token;
}

async function gcal(path, method, body, token) {
  const r = await fetch(GCAL_BASE + path, {
    method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

function getCTOffsetHours(dateStr) {
  // Get UTC offset for America/Chicago on a given date (handles CDT/CST)
  const sampleUTC = new Date(dateStr + 'T12:00:00Z');
  const ctHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', hour12: false
  }).format(sampleUTC), 10);
  return 12 - ctHour; // e.g. 12 UTC = 7 CT → offset = 5 (CDT)
}

function generateSlots(date, eventType) {
  const config = EVENT_TYPES[eventType];
  if (!config) return [];
  // Use UTC midnight to get day-of-week in CT
  const ctOffset = getCTOffsetHours(date);
  const midnightUTC = new Date(date + 'T00:00:00Z');
  // Get day of week in CT timezone
  const dowCT = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short'
  }).format(midnightUTC) === 'Sun' ? 0 :
    new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',weekday:'short'}).format(midnightUTC) === 'Mon' ? 1 :
    new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',weekday:'short'}).format(midnightUTC) === 'Tue' ? 2 :
    new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',weekday:'short'}).format(midnightUTC) === 'Wed' ? 3 :
    new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',weekday:'short'}).format(midnightUTC) === 'Thu' ? 4 :
    new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',weekday:'short'}).format(midnightUTC) === 'Fri' ? 5 : 6, 10);

  if (!config.days.includes(dowCT)) return [];
  const hours = config.hours[dowCT];
  if (!hours) return [];
  const [startHr, endHr] = hours;
  const slots = [];
  const nowPlusNotice = Date.now() + config.notice_hours * 3600000;
  const step = config.duration;

  for (let h = startHr; h < endHr; h++) {
    for (let m = 0; m + step <= 60; m += step) {
      // Convert CT hour to UTC: CT h + offset = UTC
      const utcHour = h + ctOffset;
      const slotStart = new Date(date + 'T' + String(utcHour).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':00Z');
      const slotEnd   = new Date(slotStart.getTime() + step * 60000);
      if (slotStart.getTime() <= nowPlusNotice) continue;
      const label = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true
      }).format(slotStart) + ' CT';
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label });
    }
  }
  return slots;
}

async function handleCalendarSlots(url, kv) {
  const type = url.searchParams.get('type') || 'audit';
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  if (!date) return { ok: false, error: 'date param required (YYYY-MM-DD)' };
  if (!EVENT_TYPES[type]) return { ok: false, error: 'Unknown type: ' + type };

  const allSlots = generateSlots(date, type);
  if (!allSlots.length) return { ok: true, slots: [], date, type };

  try {
    const token = await getAccessToken(kv);
    // Check free/busy for the day
    const timeMin = date + 'T00:00:00-05:00';
    const timeMax = date + 'T23:59:59-05:00';
    const fbR = await gcal('/freeBusy', 'POST', {
      timeMin, timeMax,
      items: [{ id: 'primary' }]
    }, token);

    if (!fbR.ok) {
      // If free/busy fails, return all generated slots (degraded mode)
      return { ok: true, slots: allSlots, date, type, degraded: true };
    }

    const busy = (fbR.data.calendars?.primary?.busy || []).map(b => ({
      start: new Date(b.start).getTime(),
      end:   new Date(b.end).getTime()
    }));

    const available = allSlots.filter(slot => {
      const sStart = new Date(slot.start).getTime();
      const sEnd   = new Date(slot.end).getTime();
      return !busy.some(b => sStart < b.end && sEnd > b.start);
    });

    return { ok: true, slots: available, date, type, total_generated: allSlots.length };
  } catch(e) {
    // Credentials not set up yet — return all slots in degraded mode
    return { ok: true, slots: allSlots, date, type, degraded: true, note: e.message };
  }
}

async function handleCalendarBook(body, kv) {
  const { type, slot_start, slot_end, name, email, trade, business_name, website, prep_notes } = body || {};
  if (!type || !slot_start || !slot_end || !name || !email) {
    return { ok: false, error: 'Required: type, slot_start, slot_end, name, email' };
  }
  const config = EVENT_TYPES[type];
  if (!config) return { ok: false, error: 'Unknown event type: ' + type };

  const descParts = [
    business_name  ? 'Business: ' + business_name  : null,
    trade          ? 'Trade: '    + trade           : null,
    website        ? 'Website: '  + website          : null,
    prep_notes     ? 'Notes: '    + prep_notes       : null,
    '',
    'Booked via Urban Niche Co. booking system',
    'urbannicheco.com'
  ].filter(x => x !== null);

  try {
    const token = await getAccessToken(kv);
    const eventR = await gcal('/calendars/primary/events', 'POST', {
      summary: config.label + ' — ' + name + (business_name ? ' (' + business_name + ')' : ''),
      description: descParts.join('\n'),
      start: { dateTime: slot_start, timeZone: 'America/Chicago' },
      end:   { dateTime: slot_end,   timeZone: 'America/Chicago' },
      colorId: config.color,
      attendees: [{ email, displayName: name }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      },
      conferenceData: {
        createRequest: { requestId: 'unc-' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } }
      }
    }, token);

    if (!eventR.ok) return { ok: false, error: 'Calendar event creation failed', detail: eventR.data };

    const event = eventR.data;
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null;

    // Store booking in KV for reference
    if (kv) {
      const booking = {
        event_id: event.id, type, name, email, trade, business_name, website,
        slot_start, slot_end, meet_link: meetLink,
        booked_at: new Date().toISOString()
      };
      const bookings = await kvGet(kv, 'bookings:all') || [];
      bookings.unshift(booking);
      if (bookings.length > 500) bookings.length = 500;
      await kvSet(kv, 'bookings:all', bookings);
    }

    return {
      ok: true,
      event_id: event.id,
      meet_link: meetLink,
      calendar_link: event.htmlLink,
      confirmed: { type, name, email, slot_start, slot_end }
    };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

async function handleSetupCalendar(body, kv) {
  if (!kv) return { ok: false, error: 'KV not available' };
  const { refresh_token, client_id, client_secret } = body || {};
  if (!refresh_token || !client_id || !client_secret) {
    return { ok: false, error: 'refresh_token, client_id, and client_secret required' };
  }
  await kvSet(kv, 'calendar:credentials', { refresh_token, client_id, client_secret });
  // Test the token immediately
  try {
    const r = await fetch(GCAL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' })
    });
    const data = await r.json();
    if (!data.access_token) return { ok: false, error: 'Token test failed — check credentials', detail: data };
    return { ok: true, message: 'Calendar credentials stored and verified. Booking system is live.' };
  } catch(e) {
    return { ok: false, error: 'Token test threw: ' + e.message };
  }
}

// ── PLACES PROXY ───────────────────────────────────────────────────────────
// Server-to-server call to Google Places API (New) — avoids browser CORS block.
// Requires env.PLACES_API_KEY Cloudflare Worker secret.
async function handlePlaces(body, env) {
  const query = (body && body.query) ? String(body.query).trim() : '';
  if (!query) return { ok: false, error: 'query required' };
  const placesKey = env.PLACES_API_KEY;
  if (!placesKey) return { ok: false, error: 'PLACES_API_KEY not configured' };
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   placesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount'
      },
      body: JSON.stringify({ textQuery: query })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: 'Places API error ' + res.status, detail: errText.slice(0, 300) };
    }
    const data = await res.json();
    return { ok: true, places: data.places || [] };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── ROUTER ─────────────────────────────────────────────────────────────────

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BACKSTAGE DATA LAYER — v3 (2026-07-30)                                  ║
// ║                                                                          ║
// ║  Powers /sales/, /clients/, /delivery/, /finance/ and /team/ on          ║
// ║  urbanbackstage.com. Everything below is additive — nothing above this   ║
// ║  banner was modified.                                                    ║
// ║                                                                          ║
// ║  Endpoints added:                                                        ║
// ║    GET  /pipeline            deals by stage, junk-filtered               ║
// ║    GET  /clients             closed-won roster + socials                 ║
// ║    GET  /delivery            open [DELIVERY] tasks grouped by client     ║
// ║    GET  /finance             MRR, collected, outstanding, projected      ║
// ║    GET  /brief               computed signals — the brains layer         ║
// ║    POST /setup-social-fields creates instagram/GBP company properties    ║
// ║                                                                          ║
// ║  All of these sit behind the existing WORKSPACE_KEY auth gate            ║
// ║  automatically — the gate exempts only '/' and '/pin'.                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// Stage internal IDs → the labels Ricky actually renamed them to in HubSpot.
// Verified live against the portal on 2026-07-30. Do NOT assume the internal
// IDs match the labels — 'appointmentscheduled' is literally "Prospect
// Identified" here, and 'Proposal Out' is a numeric custom stage.
const BS_STAGES = [
  { id: 'appointmentscheduled',   label: 'Prospect Identified',  open: true  },
  { id: 'qualifiedtobuy',         label: 'First Touch Sent',     open: true  },
  { id: 'presentationscheduled',  label: 'Follow-Up In Progress',open: true  },
  { id: 'decisionmakerboughtin',  label: 'Call Scheduled',       open: true  },
  { id: 'contractsent',           label: 'Pricing Sent',         open: true  },
  { id: '3479061187',             label: 'Proposal Out',         open: true  },
  { id: 'closedwon',              label: 'Closed Won',           open: false },
  { id: 'closedlost',             label: 'Closed Lost/Not Now',  open: false }
];
const BS_STAGE_LABEL = BS_STAGES.reduce((a, s) => { a[s.id] = s.label; return a; }, {});
const BS_STAGE_ORDER = BS_STAGES.reduce((a, s, i) => { a[s.id] = i; return a; }, {});

const BS_PORTAL = '245833525';
const bsDealUrl    = id => 'https://app-na2.hubspot.com/contacts/' + BS_PORTAL + '/deal/' + id;
const bsCompanyUrl = id => 'https://app-na2.hubspot.com/contacts/' + BS_PORTAL + '/company/' + id;

const BS_DAY = 86400000;
const bsNum  = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const bsDays = ts => { if (!ts) return null; const t = new Date(ts).getTime();
                       return isFinite(t) ? Math.floor((Date.now() - t) / BS_DAY) : null; };

// ── JUNK CLASSIFIER ─────────────────────────────────────────────────────────
// The portal carries a lot of noise: form-spam inbound leads that repeat the
// same fake name dozens of times, plus explicit test records. Averaging that
// into a scoreboard produces a comforting lie, so every aggregate below runs on
// filtered data — and the junk count is reported as its own metric so the mess
// stays visible instead of silently disappearing.
//
// Two rules, deliberately conservative:
//   test — the name literally says it's disposable
//   spam — the SAME deal name repeats 3+ times, all $0, all unowned
// A one-off genuine inbound lead trips neither rule and is treated as real.
const BS_TEST_RX = /(DELETE_TEST|DUPLICATE\s*-\s*DELETE|safe to delete|^DELETE\s|test roofing|system check|health check|deep check|weekly system)/i;

function bsClassifyDeals(deals) {
  const nameCount = {};
  for (const d of deals) {
    const n = ((d.properties || {}).dealname || '').trim().toLowerCase();
    if (n) nameCount[n] = (nameCount[n] || 0) + 1;
  }
  const out = [];
  for (const d of deals) {
    const p    = d.properties || {};
    const name = (p.dealname || '').trim();
    const amt  = bsNum(p.amount);
    let junk = null;

    if (BS_TEST_RX.test(name)) {
      junk = 'test';
    } else if (
      nameCount[name.toLowerCase()] >= 3 &&
      amt === 0 &&
      !p.hubspot_owner_id
    ) {
      junk = 'spam';
    }
    out.push({ deal: d, junk });
  }
  return out;
}

function bsShapeDeal(d) {
  const p = d.properties || {};
  const stage = p.dealstage || '';
  return {
    id:            d.id,
    name:          p.dealname || '(unnamed deal)',
    stage_id:      stage,
    stage:         BS_STAGE_LABEL[stage] || stage || 'Unknown',
    amount:        bsNum(p.amount),
    currency:      p.deal_currency_code || 'USD',
    revenue_type:  p.unc_revenue_type || '',
    owner_id:      p.hubspot_owner_id || '',
    close_date:    p.closedate || '',
    created:       p.createdate || '',
    modified:      p.hs_lastmodifieddate || '',
    days_idle:     bsDays(p.hs_lastmodifieddate),
    days_in_stage: bsDays(p.hs_date_entered_current_stage || p.hs_lastmodifieddate),
    contract_end:  p.contract_end_date || '',
    term_months:   p.contract_term_months || '',
    // Negative = days remaining. bsDays() counts elapsed time, so a future
    // contract end returns a negative number; flip it for readability.
    days_to_renewal: p.contract_end_date ? -bsDays(p.contract_end_date) : null,
    hubspot_url:   bsDealUrl(d.id)
  };
}

const BS_DEAL_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount', 'deal_currency_code',
  'closedate', 'createdate', 'hs_lastmodifieddate', 'hubspot_owner_id',
  'unc_revenue_type', 'hs_date_entered_current_stage',
  'contract_end_date', 'contract_term_months'
];

// HubSpot burst-limits a portal to a handful of searches per second. The
// backstage pages each call /brief plus one data endpoint at once, so four
// concurrent page loads reliably trip it. Retry 429s with backoff instead of
// treating a rate-limit as "no data".
async function bsHs(path, method, body, token) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await hs(path, method, body, token);
    if (r.status !== 429) return r;
    await new Promise(res => setTimeout(res, 400 * (attempt + 1)));
  }
  return { ok: false, status: 429, data: null };
}

// Pull every deal in the portal, paginated. Uses the same `hs()` helper and the
// same {ok,status,data} contract as the rest of this worker — never call
// .json() on its return value, it is a plain object.
async function bsAllDeals(token, maxPages) {
  const out = [];
  let after;
  for (let i = 0; i < (maxPages || 6); i++) {
    const body = {
      filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'HAS_PROPERTY' }] }],
      properties: BS_DEAL_PROPS,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 100
    };
    if (after) body.after = after;
    const r = await bsHs('/crm/v3/objects/deals/search', 'POST', body, token);
    if (!r.ok || !r.data) break;
    out.push.apply(out, r.data.results || []);
    after = r.data.paging && r.data.paging.next && r.data.paging.next.after;
    if (!after) break;
  }
  return out;
}

// ── CLIENT NAME NORMALISATION ───────────────────────────────────────────────
// Deals are named "Fuehrer Painting — Retainer", "Kutsch Tree Service — Merch
// (Single Color)". The client is the part before the em-dash. Everything after
// is the thing sold. Splitting there gives one roster row per business rather
// than one per invoice.
function bsClientName(dealname) {
  return String(dealname || '')
    .split(/\s[—–-]\s/)[0]
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();
}
function bsSlug(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
function bsNorm(s) {
  return String(s || '').toLowerCase()
    .replace(/\b(llc|inc|co|company|corp|ltd|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Task subjects abbreviate. A deal is "Fuehrer Painting — Retainer" but its
// delivery tasks just say "Fuehrer", so exact normalised equality matches
// nothing. Prefix matching in either direction links them, with a 4-character
// floor so short fragments cannot collide two unrelated clients together.
function bsNameMatch(a, b) {
  const x = bsNorm(a), y = bsNorm(b);
  if (!x || !y || x.length < 4 || y.length < 4) return false;
  return x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0;
}

const BS_COMPANY_PROPS = [
  'name', 'domain', 'website', 'phone', 'city', 'state', 'trade_type',
  'lifecyclestage', 'hs_lastmodifieddate', 'facebook_company_page', 'linkedin_company_page',
  'twitterhandle', 'instagram_page', 'google_business_url', 'description'
];

async function bsAllCompanies(token, maxPages) {
  const out = [];
  let after;
  for (let i = 0; i < (maxPages || 3); i++) {
    const body = {
      filterGroups: [{ filters: [{ propertyName: 'name', operator: 'HAS_PROPERTY' }] }],
      properties: BS_COMPANY_PROPS,
      limit: 100
    };
    if (after) body.after = after;
    const r = await bsHs('/crm/v3/objects/companies/search', 'POST', body, token);
    if (!r.ok || !r.data) break;
    out.push.apply(out, r.data.results || []);
    after = r.data.paging && r.data.paging.next && r.data.paging.next.after;
    if (!after) break;
  }
  return out;
}

// ── SOCIAL LINK SHAPING ─────────────────────────────────────────────────────
// HubSpot stores these inconsistently: facebook_company_page is usually a full
// URL, twitterhandle is usually a bare @handle, instagram_page and
// google_business_url are custom fields this worker creates and could hold
// either. Normalise everything to a real https:// URL so the front end can just
// render an anchor without four special cases.
function bsSocial(p) {
  const raw = {
    website:   p.website || (p.domain ? 'https://' + p.domain : ''),
    facebook:  p.facebook_company_page || '',
    instagram: p.instagram_page || '',
    linkedin:  p.linkedin_company_page || '',
    twitter:   p.twitterhandle || '',
    gbp:       p.google_business_url || ''
  };
  const bases = {
    facebook:  'https://facebook.com/',
    instagram: 'https://instagram.com/',
    linkedin:  'https://linkedin.com/company/',
    twitter:   'https://x.com/'
  };
  const out = {};
  for (const k of Object.keys(raw)) {
    let v = String(raw[k] || '').trim();
    if (!v) { out[k] = ''; continue; }
    if (/^https?:\/\//i.test(v)) { out[k] = v; continue; }
    if (v.charAt(0) === '@') v = v.slice(1);
    out[k] = bases[k] ? bases[k] + v.replace(/^\/+/, '') : 'https://' + v;
  }
  return out;
}


// Look up ONLY the companies matching the client names we actually care about.
// Bulk-pulling and matching locally does not scale — this portal has 1,348
// company records, so any fixed page window silently misses real clients and
// every card reads "no company record". Cost here scales with client count
// (one search per 5 clients), not with portal size.
function bsSearchToken(name) {
  const parts = String(name || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const w of parts) if (w.length >= 3) return w;
  return parts[0] || '';
}
async function bsCompaniesForNames(names, token) {
  const toks = [];
  for (const n of names) {
    const t = bsSearchToken(n);
    if (t && t.length >= 3 && toks.indexOf(t) === -1) toks.push(t);
  }
  const out = [];
  for (let i = 0; i < toks.length; i += 5) {          // HubSpot caps filterGroups at 5
    const chunk = toks.slice(i, i + 5);
    const r = await bsHs('/crm/v3/objects/companies/search', 'POST', {
      filterGroups: chunk.map(t => ({ filters: [
        { propertyName: 'name', operator: 'CONTAINS_TOKEN', value: t }
      ]})),
      properties: BS_COMPANY_PROPS,
      limit: 100
    }, token);
    if (r.ok && r.data) out.push.apply(out, r.data.results || []);
  }
  return out;
}

// Names of every client that has actually paid — the only companies worth fetching.
function bsWonClientNames(dealsShaped) {
  const seen = [];
  for (const d of dealsShaped) {
    if (d.stage_id !== 'closedwon') continue;
    const n = bsClientName(d.name);
    if (n && seen.indexOf(n) === -1) seen.push(n);
  }
  return seen;
}

// When a client name matches more than one company record — and in a portal
// with 1,348 companies and known duplicate problems, it will — picking the
// first match is arbitrary and silently wrong. Kutsch Tree Service existed
// twice; first-match returned the older, emptier record and the dashboard
// showed no Facebook for a client that had one. Prefer the record carrying the
// most real information, tie-breaking on most recently modified.
const BS_RICHNESS_FIELDS = ['website','domain','phone','city','state','trade_type',
  'facebook_company_page','instagram_page','google_business_url',
  'linkedin_company_page','twitterhandle','description'];
function bsCompanyScore(co) {
  const p = (co && co.properties) || {};
  let n = 0;
  for (const f of BS_RICHNESS_FIELDS) if (p[f] && String(p[f]).trim()) n++;
  return n;
}
function bsBetterCompany(a, b) {
  if (!a) return b;
  if (!b) return a;
  const sa = bsCompanyScore(a), sb = bsCompanyScore(b);
  if (sa !== sb) return sa > sb ? a : b;
  const ma = new Date(((a.properties||{}).hs_lastmodifieddate) || 0).getTime() || 0;
  const mb = new Date(((b.properties||{}).hs_lastmodifieddate) || 0).getTime() || 0;
  return mb > ma ? b : a;
}

// ── ROSTER BUILDER ──────────────────────────────────────────────────────────
// Groups closed-won deals into one row per client and attaches the matching
// company record (matched on a punctuation/suffix-stripped name) for socials.
function bsBuildRoster(dealsShaped, companies) {
  const byNorm = {};
  const dupes  = {};
  for (const c of companies) {
    const p = c.properties || {};
    const k = bsNorm(p.name);
    if (!k) continue;
    if (byNorm[k]) dupes[k] = (dupes[k] || 1) + 1;
    byNorm[k] = bsBetterCompany(byNorm[k], c);
  }

  const map = {};
  for (const d of dealsShaped) {
    if (d.stage_id !== 'closedwon') continue;
    const name = bsClientName(d.name);
    if (!name) continue;
    const key = bsNorm(name);
    if (!map[key]) {
      map[key] = {
        slug: bsSlug(name), name, deals: [],
        mrr: 0, one_time: 0, lifetime: 0,
        first_close: '', last_close: '', services: []
      };
    }
    const c = map[key];
    c.deals.push(d);
    c.lifetime += d.amount;
    if (d.revenue_type === 'retainer_y1' || d.revenue_type === 'retainer_y2') c.mrr += d.amount;
    else c.one_time += d.amount;
    if (d.close_date) {
      if (!c.first_close || d.close_date < c.first_close) c.first_close = d.close_date;
      if (!c.last_close  || d.close_date > c.last_close)  c.last_close  = d.close_date;
    }
    const svc = String(d.name).split(/\s[—–-]\s/).slice(1).join(' — ').trim();
    if (svc && c.services.indexOf(svc) === -1) c.services.push(svc);
  }

  const roster = Object.keys(map).map(k => {
    const c  = map[k];
    const co = byNorm[k];
    if (co) {
      const p = co.properties || {};
      c.company_id  = co.id;
      c.hubspot_url = bsCompanyUrl(co.id);
      c.city        = p.city  || '';
      c.state       = p.state || '';
      c.trade       = p.trade_type || '';
      c.phone       = p.phone || '';
      c.social      = bsSocial(p);
    } else {
      c.company_id  = null;
      c.hubspot_url = '';
      c.city = ''; c.state = ''; c.trade = ''; c.phone = '';
      c.social = bsSocial({});
    }
    c.duplicate_companies = dupes[k] || 0;
    c.social_missing = Object.keys(c.social).filter(x => !c.social[x]);
    c.active_retainer = c.mrr > 0;
    c.tenure_days = c.first_close ? bsDays(c.first_close) : null;
    return c;
  });

  roster.sort((a, b) => (b.mrr - a.mrr) || (b.lifetime - a.lifetime));
  return roster;
}

// ── TASKS ───────────────────────────────────────────────────────────────────
async function bsOpenTasks(token, maxPages) {
  const out = [];
  let after;
  for (let i = 0; i < (maxPages || 3); i++) {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
        { propertyName: 'hs_task_subject', operator: 'HAS_PROPERTY' }
      ] }],
      properties: ['hs_task_subject','hs_task_status','hs_task_priority','hs_timestamp',
                   'hs_task_type','hs_task_body','hubspot_owner_id','hs_createdate'],
      sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }],
      limit: 100
    };
    if (after) body.after = after;
    const r = await bsHs('/crm/v3/objects/tasks/search', 'POST', body, token);
    // Distinguish "there are no tasks" from "we could not read the tasks".
    // Silently returning [] on a failed first page makes /brief announce that
    // delivery is all clear while work sits overdue.
    if (!r.ok || !r.data) {
      if (i === 0) throw new Error('HubSpot task search failed (HTTP ' + r.status + ')');
      break;
    }
    out.push.apply(out, r.data.results || []);
    after = r.data.paging && r.data.paging.next && r.data.paging.next.after;
    if (!after) break;
  }
  return out;
}

function bsShapeTask(t) {
  const p    = t.properties || {};
  const subj = p.hs_task_subject || '(untitled task)';
  const due  = p.hs_timestamp ? new Date(p.hs_timestamp).getTime() : null;
  const days = due ? Math.floor((due - Date.now()) / BS_DAY) : null;
  // Two different subject conventions live in this portal, and they put the
  // client on OPPOSITE sides of the dash:
  //   delivery-scheduler writes  "[DELIVERY] Fuehrer — SEO: Write 4 blog posts"
  //                               ^ client FIRST
  //   the call cockpit writes    "Callback — Fuehrer Painting (morning)"
  //                               ^ client LAST
  // Reading the wrong end silently yields "SEO: Write 4 blog posts" as a client
  // name, which matches nothing and makes every client look like it has zero
  // open work while dozens of tasks sit there. Verified against live subjects.
  const isDelivery = /^\s*\[DELIVERY\]/i.test(subj);
  let client = '';
  if (isDelivery) {
    const after = subj.replace(/^\s*\[DELIVERY\]\s*/i, '');
    client = after.split(/\s[—–-]\s|:/)[0].replace(/\s*\(.*?\)\s*$/, '').trim();
  } else {
    const m = subj.split(/\s[—–-]\s/);
    if (m.length > 1) client = m[m.length - 1].replace(/\s*\(.*?\)\s*$/, '').trim();
  }
  return {
    id: t.id, subject: subj, client,
    is_delivery: isDelivery,
    status:   p.hs_task_status   || '',
    priority: p.hs_task_priority || '',
    type:     p.hs_task_type     || '',
    owner_id: p.hubspot_owner_id || '',
    due_iso:  p.hs_timestamp     || '',
    days_until: days,
    overdue:  days !== null && days < 0,
    due_soon: days !== null && days >= 0 && days <= 2
  };
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin);
    const kv     = env.CALL_LOG || null;
    const token  = env.HUBSPOT_TOKEN || null;

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // ── AUTH GATE ── FAILS CLOSED.
    // Previously this was opt-in (`if (env.WORKSPACE_KEY && ...)`), which meant a
    // missing/wiped secret silently disabled auth and served the whole CRM to the
    // public. Now a missing secret returns 503 and serves nothing.
    if (url.pathname !== '/' && url.pathname !== '/pin') {
      if (!env.WORKSPACE_KEY) {
        return jsonResp({ ok: false, error: 'server misconfigured: WORKSPACE_KEY not set' }, 503, cors);
      }
      if (request.headers.get('x-unc-key') !== env.WORKSPACE_KEY) {
        return jsonResp({ ok: false, error: 'unauthorized' }, 401, cors);
      }
    }

    // Health check
    if (request.method === 'GET' && url.pathname === '/') {
      return jsonResp({ ok: true, service: 'unc-sales-os-sync', version: '3.0', kv: !!kv }, 200, cors);
    }

    // Setup (run once after deployment)
    if (request.method === 'POST' && url.pathname === '/setup') {
      return jsonResp(await handleSetup(kv), 200, cors);
    }

    // Sync
    if (request.method === 'POST' && url.pathname === '/sync') {
      if (!token) return jsonResp({ ok: false, error: 'HUBSPOT_TOKEN not configured' }, 500, cors);
      let payload;
      try { payload = await request.json(); } catch(e) {
        return jsonResp({ ok: false, error: 'Invalid JSON' }, 400, cors);
      }
      const calls = payload.calls || (payload.call ? [payload.call] : null);
      if (!calls?.length) return jsonResp({ ok: false, error: 'No calls in payload' }, 400, cors);
      const results = [];
      for (const call of calls) {
        try { results.push(await handleSync(call, token, kv)); }
        catch(e) { results.push({ ok: false, call_id: call.call_id, error: e.message }); }
      }
      const allOk = results.every(r => r.ok);
      return jsonResp({ ok: allOk, results }, allOk ? 200 : 207, cors);
    }

    // Queue
    if (request.method === 'GET' && url.pathname === '/queue') {
      if (!token) return jsonResp({ ok: false, error: 'HUBSPOT_TOKEN not configured' }, 500, cors);
      return jsonResp(await handleQueue(url, token, kv), 200, cors);
    }

    // Stats
    // ── GET /commissions — rep commission summary from HubSpot closed-won deals ──
    // Rates (per rep agreement): Retainer Y1 30% monthly, Y2+ 10% monthly, Project 25%, Merch 50%.
    // revenue_type deal property wins when set; otherwise classified from the deal name.
    if (request.method === 'GET' && url.pathname === '/commissions') {
      try {
        const ownerId = url.searchParams.get('owner_id') || '';
        if (!ownerId) return jsonResp({ ok: false, error: 'owner_id required' }, 400, cors);
        const body = {
          filterGroups: [{ filters: [
            { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
            { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }
          ]}],
          properties: ['dealname', 'amount', 'closedate', 'revenue_type'],
          sorts: [{ propertyName: 'closedate', direction: 'DESCENDING' }],
          limit: 100
        };
        const r = await bsHs('/crm/v3/objects/deals/search', 'POST', body, token);
        if (!r.ok) return jsonResp({ ok: false, error: 'HubSpot deals search failed: ' + r.status }, 502, cors);
        const now = new Date();
        const thisMonth = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
        const clients = (r.data.results || []).map((d) => {
          const p = d.properties || {};
          const name = p.dealname || 'Unnamed deal';
          const amount = parseFloat(p.amount) || 0;
          const closeDate = p.closedate || '';
          let type = (p.revenue_type || '').toLowerCase();
          if (!type) {
            const n = name.toLowerCase();
            if (/merch|shirt|hat|apparel|card|print|embroider|gear|hoodie/.test(n)) type = 'merch';
            else if (/retainer|seo|gbp|authority|growth|domination|ppc|content|email|reputation|ai lead|monthly/.test(n)) type = 'retainer';
            else type = 'project';
          }
          let monthNum = null, rate, revenue_type, type_label, commission;
          if (type === 'retainer' || type === 'retainer_y1' || type === 'retainer_y2') {
            const ms = closeDate ? (now - new Date(closeDate)) : 0;
            monthNum = Math.max(1, Math.floor(ms / (30.44 * 86400000)) + 1);
            rate = monthNum <= 12 ? 0.30 : 0.10;
            revenue_type = monthNum <= 12 ? 'retainer_y1' : 'retainer_y2';
            type_label = monthNum <= 12 ? 'Retainer · Y1' : 'Retainer · Y2+';
            commission = amount * rate;
          } else if (type === 'merch') {
            rate = 0.50; revenue_type = 'merch'; type_label = 'Merch'; commission = amount * rate;
          } else {
            rate = 0.25; revenue_type = 'project'; type_label = 'Project'; commission = amount * rate;
          }
          return {
            deal_id: d.id, name: name, amount: amount, close_date: closeDate,
            revenue_type: revenue_type, type_label: type_label, rate: rate,
            commission: Math.round(commission * 100) / 100,
            month_num: monthNum,
            clawback_risk: revenue_type === 'retainer_y1' && monthNum === 1
          };
        });
        const retainers = clients.filter((c) => c.revenue_type === 'retainer_y1' || c.revenue_type === 'retainer_y2');
        let monthEarned = 0, totalEarned = 0;
        clients.forEach((c) => {
          if (c.month_num) {
            monthEarned += c.commission;
            for (let m = 1; m <= c.month_num; m++) totalEarned += c.amount * (m <= 12 ? 0.30 : 0.10);
          } else {
            totalEarned += c.commission;
            if (String(c.close_date).slice(0, 7) === thisMonth) monthEarned += c.commission;
          }
        });
        const summary = {
          month_earned: Math.round(monthEarned * 100) / 100,
          total_earned: Math.round(totalEarned * 100) / 100,
          active_clients: clients.length,
          active_retainers: retainers.length,
          claude_eligible: retainers.length >= 1,
          clawback_risk: clients.filter((c) => c.clawback_risk).map((c) => ({ name: c.name, amount: Math.round(c.amount * 0.30 * 100) / 100 }))
        };
        return jsonResp({ ok: true, summary: summary, clients: clients }, 200, cors);
      } catch (e) {
        return jsonResp({ ok: false, error: e.message }, 500, cors);
      }
    }

    // ── POST /setup-pitch-field — one-shot: create the pitch_script contact property ──
    if (request.method === 'POST' && url.pathname === '/setup-pitch-field') {
      try {
        const r = await hs('/crm/v3/properties/contacts', 'POST', {
          name: 'pitch_script',
          label: 'Pitch Script',
          description: 'Custom pitch script generated from the actual quote + prior call language. Rendered by the Service Pitch cockpit when present.',
          groupName: 'sales_properties',
          type: 'string',
          fieldType: 'textarea'
        }, token);
        if (r.ok) return jsonResp({ ok: true, created: true }, 200, cors);
        if (r.status === 409) return jsonResp({ ok: true, created: false, note: 'already exists' }, 200, cors);
        return jsonResp({ ok: false, status: r.status, detail: r.data }, 502, cors);
      } catch (e) { return jsonResp({ ok: false, error: e.message }, 500, cors); }
    }

    if (request.method === 'GET' && url.pathname === '/leaderboard') {
      return jsonResp(await handleLeaderboard(kv), 200, cors);
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      return jsonResp(await handleStats(url, kv), 200, cors);
    }

    // PIN
    if (request.method === 'POST' && url.pathname === '/pin') {
      let body;
      try { body = await request.json(); } catch(e) { body = {}; }
      return jsonResp(await handlePin(body, kv, env, origin), 200, cors);
    }

    // Contact history
    if (request.method === 'GET' && url.pathname.startsWith('/contact/')) {
      const parts = url.pathname.split('/');
      const contactId = parts[2];
      if (!contactId) return jsonResp({ ok: false, error: 'contact id required' }, 400, cors);
      return jsonResp(await handleContactHistory(contactId, kv), 200, cors);
    }

    // Config
    if (url.pathname === '/config') {
      if (request.method === 'GET')  return jsonResp(await handleGetConfig(kv), 200, cors);
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch(e) { body = {}; }
        return jsonResp(await handlePutConfig(body, kv), 200, cors);
      }
    }

    // Goals
    if (url.pathname === '/goals') {
      if (request.method === 'GET') return jsonResp(await handleGetGoals(kv), 200, cors);
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch(e) { body = {}; }
        return jsonResp(await handlePutGoals(body, kv), 200, cors);
      }
    }


    // Calendar slots
    if (request.method === 'GET' && url.pathname === '/calendar/slots') {
      return jsonResp(await handleCalendarSlots(url, kv), 200, cors);
    }

    // Calendar book
    if (request.method === 'POST' && url.pathname === '/calendar/book') {
      let body; try { body = await request.json(); } catch(e) { body = {}; }
      return jsonResp(await handleCalendarBook(body, kv), 200, cors);
    }

    // Setup calendar form (browser UI — no CORS issues)
    if (request.method === 'GET' && url.pathname === '/setup-calendar-form') {
      const formHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UNC Calendar Setup</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f0f0f;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}.card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:2rem;width:100%;max-width:480px}h1{font-size:1.2rem;font-weight:800;color:#e36b1e;margin-bottom:0.35rem}p{font-size:0.82rem;color:rgba(255,255,255,0.6);margin-bottom:1.5rem;line-height:1.5}label{display:block;font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:0.35rem;margin-top:1rem}input{width:100%;padding:0.75rem 1rem;background:#222;border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#fff;font-family:system-ui;font-size:0.9rem;outline:none}input:focus{border-color:#e36b1e}button{width:100%;margin-top:1.5rem;padding:0.85rem;background:#e36b1e;color:#000;border:none;border-radius:6px;font-weight:800;font-size:1rem;cursor:pointer}#msg{margin-top:1rem;padding:0.75rem;border-radius:6px;font-size:0.85rem;display:none}</style></head><body><div class="card"><h1>UNC Calendar Setup</h1><p>Enter your Google OAuth credentials to connect the booking system to your calendar. This page is served directly from the Worker — credentials never touch the main site.</p><form id="f"><label>Client Secret</label><input type="password" id="cs" placeholder="GOCSPX-..." autocomplete="off" required /><label>Refresh Token</label><input type="password" id="rt" placeholder="1//0g..." autocomplete="off" required /><button type="submit">Connect Calendar</button></form><div id="msg"></div></div><script>document.getElementById("f").addEventListener("submit",async function(e){e.preventDefault();const btn=this.querySelector("button");const msg=document.getElementById("msg");btn.textContent="Connecting...";btn.disabled=true;try{const r=await fetch("/setup-calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_secret:document.getElementById("cs").value,refresh_token:document.getElementById("rt").value,client_id:"37969998857-g6m8787uldnmhf4geqp7nbrduh6to580.apps.googleusercontent.com"})});const d=await r.json();msg.style.display="block";if(d.ok){msg.style.background="rgba(34,197,94,0.15)";msg.style.border="1px solid #22c55e";msg.style.color="#22c55e";msg.textContent="✓ "+d.message;document.getElementById("cs").value="";document.getElementById("rt").value="";}else{msg.style.background="rgba(239,68,68,0.15)";msg.style.border="1px solid #ef4444";msg.style.color="#ef4444";msg.textContent="✗ "+(d.error||"Failed — check credentials");}}catch(e){msg.style.display="block";msg.textContent="Network error: "+e.message;}finally{btn.textContent="Connect Calendar";btn.disabled=false;}});</script></body></html>`;
      return new Response(formHTML, { status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // Setup calendar credentials (one-time)
    if (request.method === 'POST' && url.pathname === '/setup-calendar') {
      let body; try { body = await request.json(); } catch(e) { body = {}; }
      return jsonResp(await handleSetupCalendar(body, kv), 200, cors);
    }

    // Places search proxy
    if (request.method === 'POST' && url.pathname === '/places') {
      let body; try { body = await request.json(); } catch(e) { body = {}; }
      return jsonResp(await handlePlaces(body, env), 200, cors);
    }

      // HubSpot prospect search proxy
      if (request.method === 'GET' && url.pathname === '/search') {
        const q = url.searchParams.get('q') || '';
        const type = url.searchParams.get('type') || 'contacts';
        const token = env.HUBSPOT_TOKEN;
        if (!q) return jsonResp({ ok: false, error: 'q param required' }, 400, cors);
        const objectType = type === 'companies' ? 'companies' : 'contacts';
        const properties = objectType === 'contacts'
          ? ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'hs_lead_status', 'trade_type', 'discovery_findings', 'discovery_date', 'recommended_package', 'avg_ticket', 'profit_margin', 'pitch_script', 'package_pitched', 'quoted_price', 'pitch_outcome', 'quick_win', 'gbp_review_count', 'website_gaps']
          : ['name', 'domain', 'phone', 'city', 'state', 'industry'];
        const searchBody = { query: q, limit: 20, properties };
        const hsRes = await hs('/crm/v3/objects/' + objectType + '/search', 'POST', searchBody, token);
        if (!hsRes.ok) return jsonResp({ ok: false, error: 'HubSpot search failed', status: hsRes.status }, 502, cors);
        const raw = (hsRes.data && hsRes.data.results) || [];
        const results = raw.map(r => {
          const p = r.properties || {};
          const fullName = [p.firstname, p.lastname].filter(Boolean).join(' ').trim();
          return {
      discovery_findings: p.discovery_findings || '', discovery_date: p.discovery_date || '', recommended_package: p.recommended_package || '', avg_ticket: p.avg_ticket || '', profit_margin: p.profit_margin || '',
          pitch_script: p.pitch_script || '',
          package_pitched: p.package_pitched || '',
          quoted_price: p.quoted_price || '',
          pitch_outcome: p.pitch_outcome || '',
          trade: p.trade_type || '',
          trade_type: p.trade_type || '', quick_win: p.quick_win || '', gbp_review_count: p.gbp_review_count || '', website_gaps: p.website_gaps || '',
            id: r.id,
            contact_id: r.id,
            name: objectType === 'companies' ? (p.name || '') : (fullName || p.email || p.company || ''),
        company: p.company || p.name || '',
        business: p.company || p.name || '', business_name: p.company || p.name || '', first_name: p.firstname || '', last_name: p.lastname || '',
            phone: p.phone || '',
            email: p.email || '',
            city: p.city || '',
            state: p.state || '',
            lifecyclestage: p.lifecyclestage || '',
            lead_status: p.hs_lead_status || ''
          };
        });
        return jsonResp({ ok: true, total: (hsRes.data && hsRes.data.total) || results.length, contacts: results, prospects: results, results }, 200, cors);
      }
              // ── GET /map — live companies + contacts for the Intel Map ──────────────
    if (request.method === 'GET' && url.pathname === '/map') {
      try {
        const ABBR = { 'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE','FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS','KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA','MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT','NEBRASKA':'NE','NEVADA':'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV','WISCONSIN':'WI','WYOMING':'WY' };
        const stAbbr = (x) => { const u = String(x || '').trim().toUpperCase(); return u.length === 2 ? u : (ABBR[u] || u); };
        const KNOWN = ['HOT','WARM','COLD','PARK','DNC','WRG','REF','COLD-GK'];
        const norm = (o) => { const u = String(o || '').trim().toUpperCase(); return KNOWN.indexOf(u) !== -1 ? u : 'NA'; };
        const CO_PROPS = ['name','city','state','trade_type','hs_lead_status'];
        const CT_PROPS = ['firstname','lastname','company','city','state','trade_type','last_call_outcome','ai_hook'];
        const pull = async (objPath, props) => {
          const out = []; let after;
          for (let page = 0; page < 6; page++) {
            const body = { filterGroups: [{ filters: [{ propertyName: 'city', operator: 'HAS_PROPERTY' }] }], properties: props, limit: 200 };
            if (after) body.after = after;
            const r = await hs(objPath, 'POST', body, token);
            if (!r.ok || !r.data) break;
            out.push.apply(out, r.data.results || []);
            after = r.data.paging && r.data.paging.next && r.data.paging.next.after;
            if (!after) break;
          }
          return out;
        };
        const both = await Promise.all([
          pull('/crm/v3/objects/companies/search', CO_PROPS),
          pull('/crm/v3/objects/contacts/search', CT_PROPS)
        ]);
        const companies = both[0].map((c) => { const p = c.properties || {}; return {
          id: 'co' + c.id, type: 'company', name: p.name || '', city: p.city || '', state: stAbbr(p.state),
          trade: p.trade_type || '', outcome: norm(p.hs_lead_status), ai_hook: '' }; });
        const contacts = both[1].map((c) => { const p = c.properties || {}; return {
          id: 'ct' + c.id, type: 'contact', name: ((p.firstname || '') + ' ' + (p.lastname || '')).trim(),
          company: p.company || '', city: p.city || '', state: stAbbr(p.state),
          trade: p.trade_type || '', outcome: norm(p.last_call_outcome), ai_hook: p.ai_hook || '' }; });
        // Fallback: if the companies object is unreadable (missing scope) or empty,
        // synthesize company pins from contacts so the map always runs on live data.
        if (companies.length === 0 && contacts.length > 0) {
          const byCo = {};
          contacts.forEach((ct) => {
            const key = (ct.company || ct.name || '').toLowerCase();
            if (!key) return;
            const rank = ct.outcome === 'HOT' ? 3 : ct.outcome === 'WARM' ? 2 : ct.outcome === 'NA' ? 0 : 1;
            if (!byCo[key]) byCo[key] = { id: 'syn-' + key.replace(/[^a-z0-9]+/g, '-').slice(0, 40), type: 'company', name: ct.company || ct.name, city: ct.city, state: ct.state, trade: ct.trade, outcome: ct.outcome, ai_hook: ct.ai_hook || '', _r: rank };
            else if (rank > byCo[key]._r) { byCo[key].outcome = ct.outcome; byCo[key]._r = rank; }
          });
          Object.keys(byCo).forEach((k) => { delete byCo[k]._r; companies.push(byCo[k]); });
        }
        // Company pins inherit heat from their contacts when the company record itself is blank
        const heat = {};
        contacts.forEach((ct) => { if (!ct.company) return; const k = ct.company.toLowerCase(); const rank = ct.outcome === 'HOT' ? 3 : ct.outcome === 'WARM' ? 2 : 0; if (!heat[k] || rank > heat[k].r) heat[k] = { r: rank, o: ct.outcome }; });
        companies.forEach((co) => { const h = heat[(co.name || '').toLowerCase()]; if (h && h.r > 0 && co.outcome === 'NA') co.outcome = h.o; });
        const stSet = {};
        companies.concat(contacts).forEach((c) => { if (c.state) stSet[c.state] = 1; });
        const stats = {
          companies: companies.length,
          contacts: contacts.length,
          states: Object.keys(stSet).length,
          hot: companies.filter((c) => c.outcome === 'HOT').length,
          warm: companies.filter((c) => c.outcome === 'WARM').length,
          untouched: companies.filter((c) => c.outcome === 'NA').length
        };
        return jsonResp({ ok: true, companies, contacts, stats }, 200, cors);
      } catch (e) {
        return jsonResp({ ok: false, error: e.message }, 500, cors);
      }
    }

    if (request.method === 'GET' && url.pathname === '/callbacks') { const token = env.HUBSPOT_TOKEN; try { const sb = { filterGroups: [{ filters: [{ propertyName: 'last_call_outcome', operator: 'IN', values: ['FOLLOW_UP_BOOKED','WARM'] }] }], properties: ['firstname','lastname','company','phone','last_call_outcome','last_call_date','last_call_notes', 'discovery_findings', 'discovery_date', 'recommended_package', 'avg_ticket', 'profit_margin', 'pitch_script', 'package_pitched', 'quoted_price', 'pitch_outcome', 'quick_win', 'gbp_review_count', 'website_gaps'], sorts: [{ propertyName: 'last_call_date', direction: 'DESCENDING' }], limit: 25 }; const hr = await hs('/crm/v3/objects/contacts/search','POST',sb,token); if (!hr.ok) return jsonResp({ ok: true, callbacks: [] }, 200, cors); const raw = (hr.data && hr.data.results) || []; const callbacks = raw.map(r => { const p = r.properties || {}; return { id: r.id, contact_id: r.id, business_name: p.company || '', first_name: p.firstname || '', last_name: p.lastname || '', phone: p.phone || '', when: p.last_call_date || '', last_outcome: p.last_call_outcome || '', notes: p.last_call_notes || '' }; }); return jsonResp({ ok: true, callbacks }, 200, cors); } catch (e) { return jsonResp({ ok: true, callbacks: [] }, 200, cors); } }


    // ╔════════════════════════════════════════════════════════════════════╗
    // ║  BACKSTAGE ROUTES — v3                                             ║
    // ║  Inserted ahead of the 404 fallthrough. Each handler owns its own  ║
    // ║  try/catch: this worker has no global error wrapper, and an        ║
    // ║  uncaught throw returns a Cloudflare 1101 with NO cors headers,    ║
    // ║  which the browser then misreports as a CORS failure.             ║
    // ╚════════════════════════════════════════════════════════════════════╝

    // ── GET /pipeline ────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/pipeline') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
        const raw       = await bsAllDeals(token, 6);
        const flagged   = bsClassifyDeals(raw);
        const real      = flagged.filter(f => !f.junk).map(f => bsShapeDeal(f.deal));
        const junk      = flagged.filter(f =>  f.junk);

        const stages = BS_STAGES.map(s => {
          const d = real.filter(x => x.stage_id === s.id);
          return {
            id: s.id, label: s.label, open: s.open,
            count: d.length,
            value: Math.round(d.reduce((a, x) => a + x.amount, 0) * 100) / 100,
            deals: d.sort((a, b) => (b.amount - a.amount) || ((a.days_idle||0) - (b.days_idle||0)))
          };
        });

        const open = real.filter(d => {
          const s = BS_STAGES[BS_STAGE_ORDER[d.stage_id]];
          return s && s.open;
        });

        return jsonResp({
          ok: true,
          stages,
          totals: {
            all_deals:   real.length,
            open_deals:  open.length,
            open_value:  Math.round(open.reduce((a, d) => a + d.amount, 0) * 100) / 100,
            won:         real.filter(d => d.stage_id === 'closedwon').length,
            lost:        real.filter(d => d.stage_id === 'closedlost').length
          },
          junk: {
            total: junk.length,
            test:  junk.filter(j => j.junk === 'test').length,
            spam:  junk.filter(j => j.junk === 'spam').length,
            sample: junk.slice(0, 25).map(j => ({
              id:   j.deal.id,
              name: (j.deal.properties || {}).dealname || '',
              kind: j.junk,
              hubspot_url: bsDealUrl(j.deal.id)
            }))
          },
          fetched_at: new Date().toISOString()
        }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }

    // ── GET /clients ─────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/clients') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
        const rawDeals = await bsAllDeals(token, 6);
        const real      = bsClassifyDeals(rawDeals).filter(f => !f.junk).map(f => bsShapeDeal(f.deal));
        const companies = await bsCompaniesForNames(bsWonClientNames(real), token);
        const roster    = bsBuildRoster(real, companies);

        // Attach open delivery work per client so a card can show live status
        // without the page having to cross-reference two endpoints itself.
        let tasks = [];
        try { tasks = (await bsOpenTasks(token, 2)).map(bsShapeTask); } catch (e) { tasks = []; }
        for (const c of roster) {
          const key = bsNorm(c.name);
          const mine = tasks.filter(t => t.client && bsNameMatch(t.client, c.name));
          c.open_tasks     = mine.length;
          c.overdue_tasks  = mine.filter(t => t.overdue).length;
        }

        const slug = url.searchParams.get('slug');
        if (slug) {
          const one = roster.filter(c => c.slug === slug)[0];
          if (!one) return jsonResp({ ok:false, error:'client not found', slug }, 404, cors);
          one.tasks = tasks.filter(t => t.client && bsNameMatch(t.client, one.name));
          return jsonResp({ ok:true, client: one, fetched_at:new Date().toISOString() }, 200, cors);
        }

        return jsonResp({
          ok: true,
          clients: roster,
          totals: {
            count:          roster.length,
            active_retainer:roster.filter(c => c.active_retainer).length,
            mrr:            Math.round(roster.reduce((a, c) => a + c.mrr, 0) * 100) / 100,
            lifetime:       Math.round(roster.reduce((a, c) => a + c.lifetime, 0) * 100) / 100
          },
          fetched_at: new Date().toISOString()
        }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }

    // ── GET /delivery ────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/delivery') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
        const all      = (await bsOpenTasks(token, 3)).map(bsShapeTask);
        const delivery = all.filter(t => t.is_delivery);

        const byClient = {};
        for (const t of delivery) {
          const k = t.client || 'Unassigned';
          if (!byClient[k]) byClient[k] = { client: k, slug: bsSlug(k), tasks: [], overdue: 0, due_soon: 0 };
          byClient[k].tasks.push(t);
          if (t.overdue)  byClient[k].overdue++;
          if (t.due_soon) byClient[k].due_soon++;
        }
        const groups = Object.keys(byClient).map(k => byClient[k])
          .sort((a, b) => (b.overdue - a.overdue) || (b.due_soon - a.due_soon) || (b.tasks.length - a.tasks.length));

        const otherOverdue = all.filter(t => !t.is_delivery && t.overdue)
          .sort((a, b) => (a.days_until || 0) - (b.days_until || 0));

        return jsonResp({
          ok: true,
          groups,
          other_overdue: otherOverdue.slice(0, 60),
          totals: {
            delivery_open:    delivery.length,
            delivery_overdue: delivery.filter(t => t.overdue).length,
            delivery_soon:    delivery.filter(t => t.due_soon).length,
            all_open_tasks:   all.length,
            all_overdue:      all.filter(t => t.overdue).length,
            other_overdue:    otherOverdue.length
          },
          fetched_at: new Date().toISOString()
        }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }

    // ── GET /finance ─────────────────────────────────────────────────────
    // SOURCE NOTE, read this before trusting the numbers:
    // Per UNC globals the authoritative financial record is the Drive
    // "UNC_Tracker_PaymentDispersal" sheet — money actually received, by any
    // method. This worker cannot reach Drive, so everything here is derived
    // from HubSpot deal records instead. That means it reflects what was SOLD
    // and marked Closed Won, not what has CLEARED. The response says so in
    // `source` and the UI prints it. Do not quietly present this as banked cash.
    if (request.method === 'GET' && url.pathname === '/finance') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
        const raw  = await bsAllDeals(token, 6);
        const real = bsClassifyDeals(raw).filter(f => !f.junk).map(f => bsShapeDeal(f.deal));

        const won = real.filter(d => d.stage_id === 'closedwon');
        const isRetainer = d => d.revenue_type === 'retainer_y1' || d.revenue_type === 'retainer_y2';

        const mrr       = won.filter(isRetainer).reduce((a, d) => a + d.amount, 0);
        const oneTime   = won.filter(d => !isRetainer(d)).reduce((a, d) => a + d.amount, 0);
        const bookedAll = won.reduce((a, d) => a + d.amount, 0);

        // "Outstanding" = priced or proposed but not yet won or lost.
        const outstandingStages = ['contractsent', '3479061187'];
        const outstanding = real.filter(d => outstandingStages.indexOf(d.stage_id) > -1);

        // Month-by-month booked value, last 6 months, for a trend line.
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const dt   = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const key  = dt.toISOString().slice(0, 7);
          const v = won.filter(d => {
            if (!d.close_date) return false;
            const t = new Date(d.close_date).getTime();
            return t >= dt.getTime() && t < next.getTime();
          }).reduce((a, d) => a + d.amount, 0);
          months.push({ month: key, booked: Math.round(v * 100) / 100 });
        }

        const byType = {};
        for (const d of won) {
          const k = d.revenue_type || 'unclassified';
          byType[k] = Math.round(((byType[k] || 0) + d.amount) * 100) / 100;
        }

        return jsonResp({
          ok: true,
          source: 'HubSpot deals — bookings, not cleared payments. Drive UNC_Tracker_PaymentDispersal remains the source of truth for cash received.',
          summary: {
            mrr:              Math.round(mrr * 100) / 100,
            arr_projected:    Math.round(mrr * 12 * 100) / 100,
            one_time_booked:  Math.round(oneTime * 100) / 100,
            booked_all_time:  Math.round(bookedAll * 100) / 100,
            outstanding_value:Math.round(outstanding.reduce((a, d) => a + d.amount, 0) * 100) / 100,
            outstanding_count:outstanding.length,
            won_count:        won.length,
            unpriced_won:     won.filter(d => d.amount === 0).length
          },
          by_revenue_type: byType,
          months,
          outstanding: outstanding.sort((a, b) => b.amount - a.amount),
          fetched_at: new Date().toISOString()
        }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }

    // ── GET /brief ───────────────────────────────────────────────────────
    // THE BRAINS LAYER.
    // Every other endpoint reports what IS. This one decides what MATTERS.
    // It reads the same data and emits ranked signals — each with a severity,
    // a number behind it, and a specific next action. A dashboard that only
    // mirrors the CRM makes you do the thinking; this does some of it for you.
    if (request.method === 'GET' && url.pathname === '/brief') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);

        const rawDeals  = await bsAllDeals(token, 6);
        const companies = await bsCompaniesForNames(
          bsWonClientNames(bsClassifyDeals(rawDeals).filter(f => !f.junk).map(f => bsShapeDeal(f.deal))),
          token);
        let tasks = [], tasksOk = true;
        try { tasks = (await bsOpenTasks(token, 3)).map(bsShapeTask); }
        catch (e) { tasks = []; tasksOk = false; }

        const flagged = bsClassifyDeals(rawDeals);
        const real    = flagged.filter(f => !f.junk).map(f => bsShapeDeal(f.deal));
        const junkN   = flagged.length - real.length;
        const roster  = bsBuildRoster(real, companies);

        const openDeals = real.filter(d => {
          const s = BS_STAGES[BS_STAGE_ORDER[d.stage_id]];
          return s && s.open;
        });
        const mrr = roster.reduce((a, c) => a + c.mrr, 0);
        const signals = [];
        const S = (severity, key, title, detail, metric, action) =>
          signals.push({ severity, key, title, detail, metric, action });

        // 1. Revenue concentration — the number that decides whether a bad week
        //    is an inconvenience or an extinction event.
        if (roster.length > 0 && mrr > 0) {
          const top   = roster.filter(c => c.mrr > 0).sort((a, b) => b.mrr - a.mrr)[0];
          const share = Math.round((top.mrr / mrr) * 100);
          if (share >= 60) {
            S('critical', 'concentration',
              share >= 100 ? 'All recurring revenue is one client' : 'Revenue concentrated in one client',
              top.name + ' is ' + share + '% of MRR ($' + top.mrr.toLocaleString() + ' of $' + Math.round(mrr).toLocaleString() + '). If they leave, recurring revenue goes to near zero the same day.',
              share + '%',
              'Close a second retainer. Not a project — a retainer. That single signature is the difference between a client and a business.');
          } else {
            S('good', 'concentration', 'Revenue spread across clients',
              'Largest client is ' + share + '% of MRR. No single cancellation ends the business.',
              share + '%', 'Keep it that way — no client above 50%.');
          }
        } else {
          S('critical', 'concentration', 'No recurring revenue',
            'Zero active retainers found in Closed Won. One-time projects do not compound — every month restarts at zero.',
            '$0 MRR',
            'One retainer. That is the entire job right now.');
        }

        // 2. Data hygiene — junk in the CRM silently corrupts every metric
        //    above it, so this is a data-integrity signal, not housekeeping.
        if (junkN > 0) {
          const pct = Math.round((junkN / flagged.length) * 100);
          S(pct >= 25 ? 'critical' : 'warn', 'hygiene', 'CRM is carrying junk records',
            junkN + ' of ' + flagged.length + ' deals (' + pct + '%) are form spam or test records. They are excluded from every number on this site, but they are still in HubSpot skewing anything that reads the portal directly — including your weekly CRO report.',
            junkN + ' junk',
            'Bulk-delete them in HubSpot, then add a honeypot or reCAPTCHA to the inbound form so they stop arriving.');
        } else {
          S('good', 'hygiene', 'CRM is clean', 'No spam or test deals detected.', '0 junk', 'Nothing to do.');
        }

        // 3. Stalled deals — the pipeline's actual failure mode is not losing
        //    deals, it is deals that never move and never get declared dead.
        const stalled = openDeals.filter(d => (d.days_idle || 0) >= 21);
        if (stalled.length) {
          S(stalled.length >= 5 ? 'critical' : 'warn', 'stalled', 'Deals are rotting in the pipeline',
            stalled.length + ' open deal' + (stalled.length === 1 ? '' : 's') + ' with no activity in 21+ days. Oldest: ' +
            stalled.sort((a, b) => (b.days_idle||0) - (a.days_idle||0))[0].name + ' at ' +
            (stalled[0].days_idle) + ' days. A deal nobody has touched in three weeks is not a deal, it is a bookmark.',
            stalled.length + ' stalled',
            'Work them or mark them Closed Lost today. A false pipeline is worse than an empty one.');
        } else if (openDeals.length) {
          S('good', 'stalled', 'Pipeline is moving', 'No open deal has sat untouched for 21+ days.', '0 stalled', 'Keep the cadence.');
        }

        // 4. Funnel shape — an empty middle means outreach is happening but
        //    conversion is not, which is a different problem from low volume.
        const emptyOpen = BS_STAGES.filter(s => s.open && real.filter(d => d.stage_id === s.id).length === 0);
        if (emptyOpen.length >= 3) {
          S('warn', 'funnel', 'Funnel has holes',
            emptyOpen.length + ' open stages are completely empty: ' + emptyOpen.map(s => s.label).join(', ') +
            '. Deals are entering and dying without ever reaching the middle of the funnel.',
            emptyOpen.length + ' empty stages',
            'Pick five prospects today and move each one exactly one stage. Movement first, volume second.');
        }

        // 5. Delivery risk — the fastest way to lose the client you already have.
        const overdue = tasks.filter(t => t.is_delivery && t.overdue);
        if (overdue.length) {
          S('critical', 'delivery', 'Delivery work is overdue',
            overdue.length + ' [DELIVERY] task' + (overdue.length === 1 ? ' is' : 's are') + ' past due. Late delivery is the cheapest way to lose the only recurring revenue you have.',
            overdue.length + ' overdue',
            'Clear these before any new outreach. Retention beats acquisition every time.');
        } else if (!tasksOk) {
          S('warn', 'delivery', 'Delivery status could not be read',
            'HubSpot did not return the task list for this request, most likely a burst rate-limit. ' +
            'This is NOT a report that delivery is clear — it is a report that delivery is unknown. Reload in a few seconds.',
            'unknown',
            'Reload the page. If it persists, check the HubSpot private app token has tasks read scope.');
        } else {
          const dOpen = tasks.filter(t => t.is_delivery).length;
          S('good', 'delivery', dOpen ? 'Delivery on schedule' : 'No delivery work queued',
            dOpen ? dOpen + ' open delivery task' + (dOpen === 1 ? '' : 's') + ', none overdue.'
                  : 'No [DELIVERY] tasks in HubSpot. Either work is done or it was never scheduled.',
            dOpen + ' open',
            dOpen ? 'Stay ahead of it.' : 'Run delivery-scheduler for active clients so the work is tracked.');
        }

        // 5b. RENEWAL CLIFF — the most consequential date in the business.
        // Concentration tells you the risk exists. This tells you when it lands.
        // A retainer with no recorded end date is itself the finding: the date
        // 100% of recurring revenue stops exists only in someone's memory.
        const retainers = real.filter(d => d.stage_id === 'closedwon' &&
          (d.revenue_type === 'retainer_y1' || d.revenue_type === 'retainer_y2'));
        const dated   = retainers.filter(d => d.days_to_renewal !== null);
        const undated = retainers.filter(d => d.days_to_renewal === null);

        if (dated.length) {
          const soonest = dated.sort((a, b) => a.days_to_renewal - b.days_to_renewal)[0];
          const dleft   = soonest.days_to_renewal;
          const share   = mrr > 0 ? Math.round((soonest.amount / mrr) * 100) : 0;
          if (dleft < 0) {
            S('critical', 'renewal', 'A retainer term has already ended',
              bsClientName(soonest.name) + ' passed its contract end date ' + Math.abs(dleft) +
              ' days ago and nothing has been recorded since. That is ' + share + '% of MRR in limbo.',
              Math.abs(dleft) + 'd past', 'Confirm renewal in writing today, or move it to Closed Lost and stop counting the revenue.');
          } else if (dleft <= 45) {
            S('critical', 'renewal', 'Revenue cliff in ' + dleft + ' days',
              bsClientName(soonest.name) + ' — ' + share + '% of MRR — reaches contract end on ' +
              String(soonest.contract_end).slice(0, 10) + '. Renewal conversations that start in the final ' +
              'two weeks are negotiations from weakness. Start now, while the work is still fresh.',
              dleft + 'd left', 'Book the renewal conversation this week. Bring the results, not the invoice.');
          } else {
            S('good', 'renewal', 'Renewal runway is healthy',
              'Nearest contract end is ' + dleft + ' days out (' + bsClientName(soonest.name) + ').',
              dleft + 'd left', 'Diarise the conversation for 45 days out.');
          }
        }
        if (undated.length) {
          S('warn', 'renewal_unknown', 'Retainer has no recorded end date',
            undated.length + ' active retainer' + (undated.length === 1 ? '' : 's') + ' (' +
            undated.map(d => bsClientName(d.name)).join(', ') + ') carry no contract_end_date. ' +
            'The date your recurring revenue stops is not in any system this dashboard can read — ' +
            'it exists only in a document or in your head, which means nothing can warn you as it approaches.',
            undated.length + ' undated',
            'Set contract_end_date and contract_term_months on the deal. Then this page counts down for you.');
        }

        // 6. Unpriced wins — $0 Closed Won deals make MRR and lifetime value lie.
        const unpriced = real.filter(d => d.stage_id === 'closedwon' && d.amount === 0);
        if (unpriced.length) {
          S('warn', 'unpriced', 'Closed Won deals with no amount',
            unpriced.length + ' won deal' + (unpriced.length === 1 ? ' has' : 's have') + ' $0 on them. Some are genuinely free (case-study builds), but until each one is labelled, lifetime value per client is understated.',
            unpriced.length + ' at $0',
            'Set the real amount, or tag deliberate freebies so they stop looking like missing data.');
        }

        // 7. Social coverage — directly requested, and it has teeth: a client
        //    with no social links on file cannot be serviced by content or
        //    reputation retainers without someone going hunting first.
        const noSocial = roster.filter(c => !c.social.facebook && !c.social.instagram);
        if (roster.length && noSocial.length) {
          S('warn', 'social', 'Clients missing social profiles',
            noSocial.length + ' of ' + roster.length + ' client' + (roster.length === 1 ? '' : 's') +
            ' have no Facebook or Instagram on file: ' + noSocial.map(c => c.name).join(', ') +
            '. Content Pack and Reputation retainers both need these before work can start.',
            noSocial.length + ' incomplete',
            'Fill facebook_company_page and instagram_page on the HubSpot company record.');
        }

        const rank = { critical: 0, warn: 1, good: 2 };
        signals.sort((a, b) => rank[a.severity] - rank[b.severity]);

        return jsonResp({
          ok: true,
          signals,
          counts: {
            critical: signals.filter(s => s.severity === 'critical').length,
            warn:     signals.filter(s => s.severity === 'warn').length,
            good:     signals.filter(s => s.severity === 'good').length
          },
          headline: (signals.filter(s => s.severity === 'critical')[0] || signals[0] || {}).title || 'All clear',
          context: {
            mrr: Math.round(mrr * 100) / 100,
            clients: roster.length,
            open_deals: openDeals.length,
            junk_deals: junkN,
            open_tasks: tasks.length
          },
          fetched_at: new Date().toISOString()
        }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }

    // ── POST /setup-social-fields ────────────────────────────────────────
    // Idempotent. HubSpot ships facebook_company_page, linkedin_company_page
    // and twitterhandle out of the box but has NO Instagram or Google Business
    // Profile field — and for a contractor marketing agency those two matter
    // more than Twitter. Creates them once; a 409 back from HubSpot means the
    // property already exists and is treated as success.
    if (request.method === 'POST' && url.pathname === '/setup-social-fields') {
      try {
        if (!token) return jsonResp({ ok:false, error:'HUBSPOT_TOKEN not configured' }, 500, cors);
        const defs = [
          { name:'instagram_page',     label:'Instagram Page',         description:'URL or handle of the company Instagram profile.' },
          { name:'google_business_url',label:'Google Business Profile', description:'Public URL of the company Google Business Profile listing.' }
        ];
        const results = [];
        for (const d of defs) {
          const r = await hs('/crm/v3/properties/companies', 'POST', {
            name: d.name, label: d.label, description: d.description,
            groupName: 'companyinformation', type: 'string', fieldType: 'text'
          }, token);
          const exists = r.status === 409 ||
            (r.data && JSON.stringify(r.data).indexOf('already exists') > -1);
          results.push({ property: d.name, created: r.ok, already_existed: exists,
                         ok: r.ok || exists, status: r.status });
        }
        return jsonResp({ ok: results.every(x => x.ok), results }, 200, cors);
      } catch (e) {
        return jsonResp({ ok:false, error: e.message }, 500, cors);
      }
    }


    return jsonResp({ ok: false, error: 'Not found' }, 404, cors);
  }
};
