/* ===================================================================
   UNC SALES COCKPIT — Shared Shell Runtime
   v2.0 — 2026-05-12
   Self-contained. No external dependencies.

   V2 adds:
   - Queue mode (loads today's prospect list, prospect card in HUD)
   - Auto-advance to next prospect after outcome
   - Cool-down enforcement (7-day window check)
   - Smart variant rotation (round-robin)
   - Cowork sync command builder (one-click batch update for HubSpot)
   - Follow-up panel (HOT/WARM outcomes)

   Exposes window.CockpitShell — singleton runtime used by every cockpit.
   =================================================================== */

(function() {
  'use strict';

  // ============================================================
  // CONFIG — flip this one line to enable real HTTP sync.
  // ============================================================
  const SYNC_ENDPOINT = 'https://unc-sales-os-sync.ricky-a17.workers.dev/sync'; // 'MOCK'
  const WORKER_BASE = 'https://unc-sales-os-sync.ricky-a17.workers.dev';
  const WORKER_KEY = (function(){try{var k=localStorage.getItem('unc_worker_key');return (k&&k.trim())||'';}catch(e){return '';}})(); // Set to match WORKSPACE_KEY wrangler secret

  const COOLDOWN_DAYS = 7;
  const VERSION = '2.0';
  const LS_PREFIX = 'unc_cockpit_';

  // ============================================================
  // UTILITIES
  // ============================================================

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function todayKey() {
    // LOCAL date — NOT UTC. Fixes timezone bug where 11 PM CT was being treated as next day UTC.
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  function daysBetween(iso, now) {
    if (!iso) return Infinity;
    const ms = (now || Date.now()) - new Date(iso).getTime();
    return ms / 86400000;
  }
  function fmtDuration(s) {
    const m = Math.floor((s || 0) / 60);
    const ss = (s || 0) % 60;
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function debounce(fn, ms) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }
  function ls(key) { return LS_PREFIX + key; }
  function readLS(key, fallback) {
    try { const v = localStorage.getItem(ls(key)); return v == null ? fallback : JSON.parse(v); }
    catch(e) { return fallback; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(ls(key), JSON.stringify(value)); } catch(e) {}
  }
  async function fetchJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Fetch failed: ' + path + ' (' + r.status + ')');
    return r.json();
  }
  function tryFetchJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ============================================================
  // AUDIO — synthesized via Web Audio API. No file dependencies.
  // ============================================================

  const Audio = (function() {
    let ctx = null;
    let muted = readLS('audio_muted', false);

    function getCtx() {
      if (ctx) return ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        return ctx;
      } catch(e) { return null; }
    }
    function tone(freq, dur, when, type, g0, g1) {
      const c = getCtx();
      if (!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + when);
      gain.gain.setValueAtTime(g0, c.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(Math.max(g1, 0.0001), c.currentTime + when + dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(c.currentTime + when); osc.stop(c.currentTime + when + dur + 0.05);
    }
    function play(kind) {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
      if (kind === 'click') tone(720, 0.05, 0, 'sine', 0.14, 0.0001);
      else if (kind === 'cha-ching') {
        tone(660, 0.09, 0, 'triangle', 0.20, 0.01);
        tone(880, 0.10, 0.07, 'triangle', 0.18, 0.01);
        tone(1175, 0.18, 0.14, 'triangle', 0.16, 0.005);
      } else if (kind === 'swipe') {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(280, c.currentTime + 0.18);
        gain.gain.setValueAtTime(0.13, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(); osc.stop(c.currentTime + 0.22);
      } else if (kind === 'error') {
        tone(220, 0.08, 0, 'square', 0.12, 0.001);
        tone(180, 0.12, 0.07, 'square', 0.10, 0.001);
      }
    }
    function setMuted(v) { muted = !!v; writeLS('audio_muted', muted); }
    function isMuted() { return muted; }
    function toggle() { setMuted(!muted); return muted; }
    return { play, setMuted, isMuted, toggle };
  })();

  // ============================================================
  // TIMER
  // ============================================================
  const Timer = (function() {
    let startMs = null, intervalId = null, displayEl = null;
    function fmt(ms) { return fmtDuration(Math.floor(ms / 1000)); }
    function tick() { if (displayEl && startMs != null) displayEl.textContent = fmt(Date.now() - startMs); }
    function start() { if (startMs != null) return; startMs = Date.now(); tick(); intervalId = setInterval(tick, 1000); }
    function stop() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      const dur = startMs ? Math.floor((Date.now() - startMs) / 1000) : 0;
      startMs = null;
      return dur;
    }
    function reset() { stop(); if (displayEl) displayEl.textContent = '00:00'; }
    function bind(el) { displayEl = el; reset(); }
    function isRunning() { return startMs != null; }
    return { start, stop, reset, bind, isRunning };
  })();

  // ============================================================
  // CALL LOG — day-keyed localStorage. V2 adds synced flag.
  // ============================================================
  const CallLog = {
    _key() { return 'call_log_' + todayKey(); },
    today() { return readLS(this._key(), []); },
    all() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX + 'call_log_')) {
          try { out.push(...JSON.parse(localStorage.getItem(k))); } catch(e) {}
        }
      }
      return out;
    },
    push(entry) { const log = this.today(); log.push(entry); writeLS(this._key(), log); return log.length; },
    markSynced(call_ids) {
      const log = this.today();
      let n = 0;
      log.forEach(c => { if (call_ids.includes(c.call_id)) { c.synced = true; c.synced_at = new Date().toISOString(); n++; } });
      writeLS(this._key(), log);
      return n;
    },
    unsynced() { return this.today().filter(c => !c.synced); },
    countToday() { return this.today().length; },
    bumpDialCounter() {
      const k = 'dials_' + todayKey();
      const n = (readLS(k, 0) || 0) + 1;
      writeLS(k, n);
      return n;
    },
    dialsToday() { return readLS('dials_' + todayKey(), 0); },
    csvForToday() {
      const rows = this.today();
      if (!rows.length) return '';
      const cols = ['call_id','timestamp','rep_id','rep_name','hubspot_owner_id','duration_seconds','outcome_code','opener_variant_used','variant_assignment_mode','branch_path','callback_window','notes','contact_id','business_name','trade','synced'];
      const esc = v => { if (v == null) return ''; const s = Array.isArray(v) ? v.join('|') : String(v); return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; };
      const lines = [cols.join(',')];
      rows.forEach(r => lines.push(cols.map(c => esc(r[c])).join(',')));
      return lines.join('\n');
    }
  };

  // ============================================================
  // QUEUE — today's prospects from /sales-ops/cold-call/queue/YYYY-MM-DD.json
  // ============================================================
  const Queue = {
    data: null,
    index: 0,
    cooldownOverrides: new Set(),

    async load(cockpitId) {
      const path = '/sales-ops/' + cockpitId + '/queue/' + todayKey() + '.json';
      let q = await tryFetchJSON(path);
      // No static queue? Restore today's manually-built queue (search-to-queue)
      if (!q || !q.prospects || !q.prospects.length) {
        const manual = readLS('manual_queue_' + cockpitId + '_' + todayKey(), null);
        if (manual && manual.length) q = { prospects: manual, _session_cap: 0, _manual: true };
      }
      this.data = q;
      // Restore last position
      const saved = readLS('queue_index_' + cockpitId + '_' + todayKey(), 0);
      this.index = (q && saved < q.prospects.length) ? saved : 0;
      return q;
    },
    addManual(p, cockpitId) {
      if (!p) return { added: false, reason: 'no prospect' };
      if (!this.data || !this.data.prospects) this.data = { prospects: [], _session_cap: 0, _manual: true };
      if (p.contact_id && this.data.prospects.some(x => String(x.contact_id) === String(p.contact_id))) {
        return { added: false, reason: 'already in queue', index: this.data.prospects.findIndex(x => String(x.contact_id) === String(p.contact_id)) };
      }
      this.data.prospects.push(p);
      if (this.data._manual || true) {
        // Persist the full working queue so a refresh mid-session doesn't lose it
        writeLS('manual_queue_' + cockpitId + '_' + todayKey(), this.data.prospects);
      }
      return { added: true, index: this.data.prospects.length - 1 };
    },
    hasQueue() { return !!(this.data && this.data.prospects && this.data.prospects.length); },
    total() { return this.hasQueue() ? this.data.prospects.length : 0; },
    sessionCap() { return this.hasQueue() ? (this.data._session_cap || this.total()) : 0; },
    current() {
      if (!this.hasQueue()) return null;
      return this.data.prospects[this.index] || null;
    },
    setIndex(i, cockpitId) {
      this.index = Math.max(0, Math.min(i, this.total() - 1));
      writeLS('queue_index_' + cockpitId + '_' + todayKey(), this.index);
    },
    advance(cockpitId) { this.setIndex(this.index + 1, cockpitId); return this.current(); },
    retreat(cockpitId) { this.setIndex(this.index - 1, cockpitId); return this.current(); },
    atStart() { return this.index <= 0; },
    atEnd() { return !this.hasQueue() || this.index >= (this.total() - 1); },
    coolDownCheck(prospect) {
      if (!prospect) return { blocked: false };
      if (this.cooldownOverrides.has(prospect.contact_id)) return { blocked: false };
      const d = daysBetween(prospect.last_touched);
      if (d < COOLDOWN_DAYS) {
        const last = prospect.last_outcome;
        if (last === 'WARM') return { blocked: false }; // WARM with pending callback allowed
        return { blocked: true, days: Math.floor(d), last_outcome: last };
      }
      return { blocked: false };
    },
    overrideCooldown(prospect) { if (prospect) this.cooldownOverrides.add(prospect.contact_id); },
    findContactById(id) {
      if (!this.hasQueue()) return null;
      return this.data.prospects.find(p => p.contact_id === id) || null;
    }
  };

  // ============================================================
  // VARIANT ROTATION — round-robin counter persisted in LS
  // ============================================================
  const VariantRotor = {
    mode() { return readLS('variant_mode', 'auto'); }, // 'auto' | 'manual'
    setMode(m) { writeLS('variant_mode', m); },
    counter(key) { return readLS('variant_counter_' + key, 0); },
    next(key, variants) {
      const c = this.counter(key);
      const pick = variants[c % variants.length];
      writeLS('variant_counter_' + key, c + 1);
      return pick;
    }
  };

  // ============================================================
  // SYNC — Cowork command builder + endpoint stub
  // ============================================================
  const Sync = (function() {
    let statusDot = null, statusText = null, hubConfig = null;

    function setStatus(state, label) {
      if (!statusDot) return;
      statusDot.dataset.status = state;
      if (statusText) statusText.textContent = label;
    }

    function refresh() {
      const unsynced = CallLog.unsynced();
      const badge = document.querySelector('#sync-badge');
      if (badge) { badge.textContent = unsynced.length; badge.hidden = unsynced.length === 0; }
      if (SYNC_ENDPOINT === 'MOCK') {
        setStatus('local', unsynced.length ? ('Local — ' + unsynced.length + ' unsynced') : 'Local — all synced');
      } else {
        setStatus(unsynced.length ? 'pending' : 'synced', unsynced.length ? ('Pending (' + unsynced.length + ')') : 'Synced');
      }
    }

    function setHubConfig(cfg) { hubConfig = cfg; }

    function bind(dotEl, textEl) {
      statusDot = dotEl; statusText = textEl;
      refresh();
    }

    function buildCoworkCommand() {
      const unsynced = CallLog.unsynced();
      if (!unsynced.length) return null;
      const cfg = hubConfig || {};
      const portalId = cfg.portal_id || 'YOUR_PORTAL_ID';
      const contactURL = (cid) => cfg.url_templates && cfg.url_templates.contact ? cfg.url_templates.contact.replace('{contact_id}', cid) : 'https://app.hubspot.com/contacts/' + portalId + '/contact/' + cid;
      const taskCfg = cfg.task_timing || {};

      const lines = [];
      lines.push('COWORK BATCH — Sync Cold Call Cockpit outcomes to HubSpot');
      lines.push('Generated: ' + new Date().toLocaleString());
      lines.push('Calls to sync: ' + unsynced.length);
      lines.push('Portal: ' + portalId + ' (region: ' + (cfg.region || 'unknown') + ')');
      lines.push('');
      lines.push('For each call below, do the steps in order. Wait for HubSpot to confirm each save before moving to the next step. If any step fails, note it and continue — do not block the batch on one bad record.');
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      unsynced.forEach((c, i) => {
        lines.push('');
        lines.push('CALL ' + (i + 1) + ' of ' + unsynced.length + ' — ' + (c.business_name || '[no business]') + ' (' + (c.outcome_code || 'NO_OUTCOME') + ')');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (c.contact_id) {
          lines.push('1. Navigate to: ' + contactURL(c.contact_id));
          lines.push('2. Wait for the contact record to fully load.');
        } else {
          lines.push('1. Navigate to: https://app-na2.hubspot.com/contacts/' + portalId + '/contacts/list/view/all/');
          lines.push('2. Search for: "' + (c.business_name || '') + '" — open the matching contact (or create new contact if missing, then continue).');
        }
        lines.push('3. Click "Log activity" → select "Call". Paste the following into the activity body:');
        lines.push('   ---');
        lines.push('   Outcome: ' + (c.outcome_code || '?') + ' (' + (c.outcome_label || '') + ')');
        lines.push('   Duration: ' + fmtDuration(c.duration_seconds) + ' (' + (c.duration_seconds || 0) + 's)');
        lines.push('   Opener variant used: ' + (c.opener_variant_used || 'n/a') + ' (assignment mode: ' + (c.variant_assignment_mode || 'manual') + ')');
        lines.push('   Branch path: ' + (Array.isArray(c.branch_path) ? c.branch_path.join(' → ') : 'n/a'));
        if (c.callback_window) lines.push('   Callback window: ' + c.callback_window);
        lines.push('   Trade at time of call: ' + (c.trade || 'unknown'));
        lines.push('   Pipeline stage at call start: ' + (c.pipeline_stage_at_call_start || 'unknown'));
        lines.push('   Notes: ' + (c.notes ? c.notes.replace(/\r?\n/g, ' / ') : '(none entered)'));
        lines.push('   Logged: ' + fmtDate(c.timestamp) + ' by ' + (c.rep_name || 'unknown rep'));
        lines.push('   Call ID: ' + c.call_id);
        lines.push('   Cockpit version: ' + (c.shell_version || 'unknown'));
        lines.push('   ---');
        lines.push('4. Save the call activity. Wait for confirmation.');
        lines.push('5. Move the deal/contact pipeline stage to: "' + (c.hubspot_stage || c.outcome_code) + '"');
        lines.push('6. Update these custom properties on the contact:');
        lines.push('   - last_call_outcome = "' + (c.outcome_code || '') + '"');
        lines.push('   - last_call_date = "' + (c.timestamp || '') + '"');
        lines.push('   - last_opener_variant = "' + (c.opener_variant_used || '') + '"');
        lines.push('   - last_call_duration_sec = ' + (c.duration_seconds || 0));
        lines.push('   - last_call_branch_path = "' + (Array.isArray(c.branch_path) ? c.branch_path.join(' → ') : '') + '"');
        if (c.notes && c.notes.trim()) {
          lines.push('   - last_call_notes: MERGE — do NOT overwrite. First READ the contact\'s current last_call_notes, then fold the new notes below into it as ONE clean, ongoing running log: combine related points, delete anything now outdated or contradicted by the new notes, remove duplicates, keep it tight and current. Save the MERGED result — not just the new notes on their own.');
          lines.push('       New notes to merge in: "' + c.notes.replace(/"/g, "'").replace(/\r?\n/g, ' / ') + '"');
        } else {
          lines.push('   - last_call_notes: (no new notes entered this call — leave the existing value untouched, do not blank it)');
        }
        ['avg_ticket','profit_margin','package_pitched','quoted_price','recommended_package','pitch_outcome'].forEach(function(k){ if (c[k] !== undefined && c[k] !== null && c[k] !== '') lines.push('   - ' + k + ' = "' + String(c[k]).replace(/"/g, "'") + '"'); });
        if (c.discovery_findings && String(c.discovery_findings).trim()) {
          lines.push('   - discovery_findings: MERGE (same rule as last_call_notes) — READ the current value, fold in the new discovery findings below, keep one clean ongoing record, drop outdated/duplicate lines. Save the merged result.');
          lines.push('       New discovery findings to merge in: "' + String(c.discovery_findings).replace(/"/g, "'").replace(/\r?\n/g, ' / ') + '"');
        }
        if (c.discovery_date) lines.push('   - discovery_date = "' + c.discovery_date + '"');
        lines.push('   - unc_dial_count_total = (read current value, add 1, save)');
        if (c.callback_window) lines.push('   - callback_window = "' + c.callback_window + '"');
        if (c.outcome_code === 'WRG') lines.push('   - best_phone_verified = false');
        else lines.push('   - best_phone_verified = true');
        const branchStr = Array.isArray(c.branch_path) ? c.branch_path.join(' ') : '';
        const reachedDM = /\b(opener:|resp:|yellow_retry:|busy:|trade_q2)\b/.test(branchStr) || /gk:HANDED_OVER/.test(branchStr);
        if (reachedDM) lines.push('   - decision_maker_known = true');
        if (c.outcome_code === 'DNC') lines.push('   - lead_status = "DNC"');
        lines.push('7. Confirm contact owner = ' + (c.hubspot_owner_id || 'unset') + ' (' + (c.rep_name || 'rep') + ').');

        const tc = taskCfg[c.outcome_code];
        if (tc && tc.create_task) {
          lines.push('8. Create a follow-up task:');
          const title = (tc.title || '').replace('{business_name}', c.business_name || '[business]').replace('{callback_window}', c.callback_window || 'TBD');
          lines.push('   - Title: "' + title + '"');
          if (tc.offset_use_callback && c.callback_window) {
            lines.push('   - Due: parse from callback_window: "' + c.callback_window + '"');
          } else if (tc.offset_minutes) {
            const due = new Date(Date.now() + tc.offset_minutes * 60000);
            lines.push('   - Due: ' + due.toLocaleString());
          } else if (tc.offset_days) {
            const due = new Date(Date.now() + tc.offset_days * 86400000);
            lines.push('   - Due: ' + due.toLocaleString());
          }
          lines.push('   - Assigned to: ' + (c.rep_name || 'unassigned'));
          lines.push('   - Type: Call');
          lines.push('   - Save task. Wait for confirmation.');
          lines.push('9. Move to next call.');
        } else {
          lines.push('8. No follow-up task required for outcome ' + c.outcome_code + '. Move to next call.');
        }
      });

      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('END OF BATCH — ' + unsynced.length + ' calls processed.');
      lines.push('After Cowork finishes, return to the cockpit and click "Mark all synced" to clear the queue.');
      lines.push('Call IDs synced: ' + unsynced.map(c => c.call_id).join(', '));

      return { text: lines.join('\n'), callIds: unsynced.map(c => c.call_id), count: unsynced.length };
    }

    async function attempt(payload) {
      if (SYNC_ENDPOINT === 'MOCK') { refresh(); return { ok: false, mock: true }; }
      setStatus('pending', 'Syncing...');
      try {
        const r = await fetch(SYNC_ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-unc-key': WORKER_KEY },
          body: JSON.stringify({ call: payload })
        });
        const data = await r.json();
        if (r.ok && data.ok) {
          CallLog.markSynced([payload.call_id]);
          setStatus('synced', '✓ HubSpot updated');
          refresh();
          return { ok: true, data };
        } else {
          setStatus('error', '✗ Sync failed');
          refresh();
          return { ok: false, data };
        }
      } catch(e) {
        setStatus('error', '✗ Offline — fallback ready');
        refresh();
        return { ok: false, error: e.message };
      }
    }

    return { bind, attempt, refresh, buildCoworkCommand, setHubConfig };
  })();

  // ============================================================
  // TOAST
  // ============================================================
  function toast(msg, type) {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : '•');
    el.innerHTML = '<span class="toast__icon">' + icon + '</span><span>' + escapeHTML(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => { try { host.removeChild(el); } catch(e) {} }, 1800);
  }

  // ============================================================
  // SHELL — public API
  // ============================================================

  // ============================================================
  // TTS — JARVIS-style co-pilot. Male voice, clipped delivery.
  // Speaks at key moments only. Not a screen reader.
  // ============================================================
  const TTS = (function() {
    let enabled = readLS('tts_enabled', true);

    function getVoice() {
      if (!window.speechSynthesis) return null;
      const voices = window.speechSynthesis.getVoices();
      // Priority: UK Male (JARVIS feel) → David/Mark (Windows male) → any male → en-US fallback
      return voices.find(v => v.name === 'Google UK English Male') ||
             voices.find(v => v.name === 'Microsoft David Desktop - English (United States)') ||
             voices.find(v => v.name === 'Microsoft David') ||
             voices.find(v => v.name === 'Microsoft Mark') ||
             voices.find(v => v.name.toLowerCase().includes('male') && v.lang.startsWith('en')) ||
             voices.find(v => v.name === 'Alex') ||
             voices.find(v => v.name === 'Google US English') ||
             voices.find(v => v.lang === 'en-US') ||
             null;
    }

    function speak(text) {
      if (!enabled || !window.speechSynthesis || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.88;
      u.pitch = 0.78;
      u.volume = 1;
      const doSpeak = function() {
        const v = getVoice();
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
      };
      if (window.speechSynthesis.getVoices().length) {
        doSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = function() { doSpeak(); window.speechSynthesis.onvoiceschanged = null; };
      }
    }

    function stop() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }
    function toggle() { enabled = !enabled; writeLS('tts_enabled', enabled); if (!enabled) stop(); return enabled; }
    function isEnabled() { return enabled; }

    function greetSession(repName, queueCount) {
      const first = repName ? repName.split(' ')[0] : null;
      const greeting = first ? (first + '.') : 'System online.';
      const q = queueCount > 0 ? queueCount + ' targets loaded.' : 'Standing by.';
      speak(greeting + ' ' + q);
    }

    function announceProspect(biz, trade) {
      const parts = [];
      if (biz) parts.push(biz + '.');
      if (trade) parts.push(trade + '.');
      if (parts.length) speak(parts.join(' '));
    }

    function callOutcome(code, bizName) {
      const lines = {
        HOT:       'Confirmed. Hot lead.',
        WARM:      'Warm. Callback queued.',
        PARK:      'Parked.',
        COLD:      'Cold. Moving.',
        'COLD-GK': 'Gatekeeper. Logged.',
        DNC:       'Do not contact. Removed.',
        NA:        'No answer.',
        WRG:       'Wrong number.',
        REF:       'Referral captured.',
      };
      speak(lines[code] || 'Logged.');
    }

    function dialMilestone(n) {
      const msgs = {
        5:  'Five contacts.',
        10: 'Ten down.',
        15: 'Fifteen.',
        20: 'Twenty. Most operators stop here.',
        25: 'Twenty-five. Full session complete.',
      };
      if (msgs[n]) speak(msgs[n]);
    }

    return { speak, stop, toggle, isEnabled, greetSession, announceProspect, callOutcome, dialMilestone };
  })();

  const Shell = {
    version: VERSION,
    SYNC_ENDPOINT,

    _state: {
      reps: [], outcomes: [], hubConfig: null,
      currentRepId: null, cockpitId: null,
      branchPath: [], openerVariant: null, variantAssignMode: 'manual',
      callbackWindow: null, contact: null,
      onReset: null, onBack: null,
      followUpPanelHost: null
    },

    async init(config) {
      this._state.cockpitId = config.cockpit;

      try {
        // Try cockpit-specific outcomes first, fall back to shared
        const cockpitOutcomesPath = '/sales-ops/' + config.cockpit + '/outcomes.json';
        const [reps, cockpitOutcomes, sharedOutcomes, hubConfig] = await Promise.all([
          fetchJSON('/sales-ops/shared/reps.json'),
          tryFetchJSON(cockpitOutcomesPath),
          tryFetchJSON('/sales-ops/shared/outcome-codes.json'),
          tryFetchJSON('/sales-ops/shared/hubspot-config.json')
        ]);
        const outcomes = cockpitOutcomes || sharedOutcomes;
        if (!outcomes) throw new Error('No outcomes config found');
        this._state.reps = reps.reps.filter(r => r.active);
        this._state.outcomes = outcomes.outcomes;
        this._state.hubConfig = hubConfig || {};
        Sync.setHubConfig(this._state.hubConfig);
      } catch (e) {
        console.error('[CockpitShell] Failed to load configs', e);
        toast('Config load failed. Check console.', 'error');
        return;
      }

      // Load today's queue
      await Queue.load(config.cockpit);

      // Champion opener — pull the best-performing variant so AUTO mode can favor it
      fetch(WORKER_BASE + '/leaderboard', { headers: { 'x-unc-key': WORKER_KEY } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d || !d.ok || !Array.isArray(d.variants)) return;
          const best = d.variants.filter(v => v.total >= 10)[0];
          if (best && best.convPct > 0) this._state.variantChampion = best.variant;
        })
        .catch(() => {});

      // Maybe pre-select contact from URL ?contact=X
      const urlContact = new URLSearchParams(window.location.search).get('contact');
      if (urlContact && Queue.hasQueue()) {
        const found = Queue.findContactById(urlContact);
        if (found) {
          const idx = Queue.data.prospects.indexOf(found);
          Queue.setIndex(idx, config.cockpit);
        }
      }

      // Restore rep — ?rep=tyler in URL takes priority over localStorage (bookmark-friendly)
      const urlRepParam = new URLSearchParams(window.location.search).get('rep');
      if (urlRepParam && this._state.reps.find(r => r.id === urlRepParam)) {
        writeLS('current_rep_id', urlRepParam); // persist across cockpit navigations
      }
      const savedRepId = urlRepParam || readLS('current_rep_id', null);
      const fallback = this._state.reps[0] && this._state.reps[0].id;
      this._state.currentRepId = (savedRepId && this._state.reps.find(r => r.id === savedRepId)) ? savedRepId : fallback;

      // Variant mode
      this._state.variantAssignMode = VariantRotor.mode();

      // Wire HUD + footer + keys + sync panel
      this._wireHUD();
      this._wireFooter();
      this._wireKeyboard();
      this._wireSyncPanel();
      this._injectConfirmBar();
      this._injectPinModal();
      this._renderProspectCard();
      this._injectFloatingToolbar();
      this._injectCoachRail();

      // Sync content.js live-queue layers (cold-call, niche-outreach) with any
      // restored or static queue — without this, a persisted queue renders the
      // generic shell card and the cockpit's own preview/skip controls stay dormant.
      if (Queue.hasQueue()) {
        window.dispatchEvent(new CustomEvent('unc:queue-injected', { detail: { prospects: Queue.data.prospects, index: Queue.index } }));
      }
    },

    _wireHUD() {
      const repSel = document.querySelector('#rep-select');
      if (repSel) {
        repSel.innerHTML = this._state.reps.map(r =>
          `<option value="${r.id}" data-color="${r.color}">${escapeHTML(r.display_name)}</option>`
        ).join('');
        repSel.value = this._state.currentRepId;
        repSel.style.borderLeftColor = this._currentRep().color;
        repSel.addEventListener('change', () => {
          this._state.currentRepId = repSel.value;
          writeLS('current_rep_id', this._state.currentRepId);
          repSel.style.borderLeftColor = this._currentRep().color;
          toast('Now logging as ' + this._currentRep().display_name);
        });
      }
      const timerEl = document.querySelector('#call-timer');
      if (timerEl) Timer.bind(timerEl);
      this._refreshDialCount();

      const audioBtn = document.querySelector('#audio-toggle');
      if (audioBtn) {
        const paint = () => { const m = Audio.isMuted(); audioBtn.dataset.state = m ? 'off' : 'on'; audioBtn.innerHTML = m ? '🔇' : '🔊'; };
        paint();
        audioBtn.addEventListener('click', () => { Audio.toggle(); paint(); if (!Audio.isMuted()) Audio.play('click'); });
      }
      // TTS toggle button — inject next to audio btn
      const ttsBtn = document.createElement('button');
      ttsBtn.id = 'tts-toggle';
      ttsBtn.className = 'hud__icon-btn';
      ttsBtn.title = 'Toggle voice hype man (TTS)\nReads prospect name, outcomes, and milestones aloud';
      const paintTts = () => { const on = TTS.isEnabled(); ttsBtn.dataset.state = on ? 'on' : 'off'; ttsBtn.innerHTML = on ? '🗣' : '🔕'; };
      paintTts();
      ttsBtn.addEventListener('click', () => { const on = TTS.toggle(); paintTts(); toast(on ? 'Voice: ON' : 'Voice: OFF'); });
      if (audioBtn && audioBtn.parentNode) audioBtn.parentNode.insertBefore(ttsBtn, audioBtn.nextSibling);
      if (false) {
      }
      const syncDot = document.querySelector('#sync-status');
      const syncText = document.querySelector('#sync-status-text');
      if (syncDot) Sync.bind(syncDot, syncText);

      const statsBtn = document.querySelector('#stats-toggle');
      if (statsBtn) statsBtn.addEventListener('click', () => this.toggleStats());

      const csvBtn = document.querySelector('#csv-export');
      if (csvBtn) csvBtn.addEventListener('click', () => this.exportCSV());

      const syncBtn = document.querySelector('#sync-toggle');
      if (syncBtn) syncBtn.addEventListener('click', () => this.openSyncPanel());

      // Variant mode toggle
      const vmBtn = document.querySelector('#variant-mode');
      if (vmBtn) {
        const paint = () => { vmBtn.textContent = this._state.variantAssignMode === 'auto' ? 'AUTO' : 'MANUAL'; vmBtn.dataset.mode = this._state.variantAssignMode; };
        paint();
        vmBtn.addEventListener('click', () => {
          this._state.variantAssignMode = this._state.variantAssignMode === 'auto' ? 'manual' : 'auto';
          VariantRotor.setMode(this._state.variantAssignMode);
          paint();
          toast('Variant assignment: ' + this._state.variantAssignMode.toUpperCase());
        });
      }
    },

    _wireFooter() {
      const host = document.querySelector('#outcome-buttons');
      if (!host) return;
      host.innerHTML = this._state.outcomes.map(o =>
        `<button class="outcome-btn" data-code="${o.code}" title="${escapeHTML(o.description)}">${escapeHTML(o.label)}<span class="outcome-btn__hotkey">${o.hotkey.toUpperCase()}</span></button>`
      ).join('');
      host.addEventListener('click', (e) => {
        const btn = e.target.closest('.outcome-btn');
        if (!btn) return;
        this.recordOutcome(btn.dataset.code);
      });
      const backBtn = document.querySelector('#nav-back');
      if (backBtn) backBtn.addEventListener('click', () => { if (this._state.onBack) this._state.onBack(); });
      const overBtn = document.querySelector('#nav-restart');
      if (overBtn) overBtn.addEventListener('click', () => this.resetCockpit());
    },

    _wireKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) {
          if (e.key === 'Escape') e.target.blur();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const key = e.key.toLowerCase();
        const outHost = document.querySelector('#outcome-buttons');
        const outcomesVisible = outHost && outHost.offsetParent !== null;
        if (outcomesVisible) {
          const o = this._state.outcomes.find(x => x.hotkey === key);
          if (o) { e.preventDefault(); this.recordOutcome(o.code); return; }
        }
        if (key === ' ') { e.preventDefault(); this.resetCockpit(); return; }
        if (e.key === 'Escape') { if (this._state.onBack) { this._state.onBack(); return; } }
        const branchHotkey = document.querySelector('.screen.active [data-hotkey="' + key + '"]');
        if (branchHotkey) { e.preventDefault(); branchHotkey.click(); }
      });
    },

    _wireSyncPanel() {
      const modal = document.querySelector('#sync-modal');
      if (!modal) return;
      const closeBtn = modal.querySelector('[data-sync-close]');
      if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
      const copyBtn = modal.querySelector('[data-sync-copy]');
      if (copyBtn) copyBtn.addEventListener('click', () => this._copyCowork());
      const markBtn = modal.querySelector('[data-sync-mark]');
      if (markBtn) markBtn.addEventListener('click', () => this._markAllSynced());
    },

    _currentRep() { return this._state.reps.find(r => r.id === this._state.currentRepId) || this._state.reps[0] || {}; },

    _refreshDialCount() {
      const el = document.querySelector('#dial-count');
      if (el) el.textContent = CallLog.dialsToday();
      const capEl = document.querySelector('#dial-cap');
      if (capEl) {
        const cap = Queue.sessionCap();
        capEl.textContent = cap > 0 ? ('/ ' + cap) : '';
      }
    },

    _renderProspectCard() {
      const host = document.querySelector('#prospect-card');
      if (!host) return;

      // Use live queue contact (Shell._state.contact) when static Queue is empty
      let p = Queue.current();
      let isLive = false;
      if (!Queue.hasQueue() || !p) {
        const lc = this._state && this._state.contact;
        if (lc && lc.id) {
          p = {
            contact_id:           lc.id,
            first_name:           lc.first_name            || '',
            last_name:            lc.last_name             || '',
            business_name:        lc.business_name         || '',
            phone:                lc.phone                 || '',
            email:                lc.email                 || '',
            website:              lc.website               || '',
            trade:                lc.trade || lc.trade_type || '',
            city:                 lc.city                  || '',
            state:                lc.state                 || '',
            ai_hook:              lc.ai_hook               || '',
            quick_win:            lc.quick_win             || '',
            gbp_review_count:     lc.gbp_review_count      || '',
            website_gaps:         lc.website_gaps          || '',
            decision_maker_known: lc.decision_maker_known  || '',
            best_phone_verified:  lc.best_phone_verified   || '',
            notes_preview:        ''
          };
          isLive = true;
        } else {
          // ── Stats card — shown in right column when no prospect/queue is loaded ──
          const banner = document.querySelector('#queue-banner');
          if (banner) banner.hidden = true;
          const rep = this._currentRep();
          const mine = CallLog.today().filter(function(c) { return !rep.id || c.rep_id === rep.id; });
          const tot  = mine.length;
          const hot  = mine.filter(function(c) { return c.outcome_code === 'HOT'; }).length;
          const warm = mine.filter(function(c) { return c.outcome_code === 'WARM'; }).length;
          const dialCount = CallLog.dialsToday();
          const conv = tot ? Math.round(((hot + warm) / tot) * 100) : 0;
          host.hidden = false;
          host.innerHTML =
            '<div style="padding:1rem;display:flex;flex-direction:column;gap:0.75rem;">' +
              '<div style="font-family:var(--font-head);font-size:0.62rem;letter-spacing:.1em;color:var(--color-white-dim);text-transform:uppercase;">📊 Today\'s Session</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">' +
                '<div style="background:var(--color-dark-3);border-radius:6px;padding:0.5rem;">' +
                  '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:800;color:var(--color-white);">' + dialCount + '</div>' +
                  '<div style="font-size:0.62rem;color:var(--color-white-dim);text-transform:uppercase;letter-spacing:.08em;">Dials</div>' +
                '</div>' +
                '<div style="background:var(--color-dark-3);border-radius:6px;padding:0.5rem;">' +
                  '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:800;color:#22c55e;">' + hot + '</div>' +
                  '<div style="font-size:0.62rem;color:var(--color-white-dim);text-transform:uppercase;letter-spacing:.08em;">HOT</div>' +
                '</div>' +
                '<div style="background:var(--color-dark-3);border-radius:6px;padding:0.5rem;">' +
                  '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:800;color:var(--color-accent);">' + warm + '</div>' +
                  '<div style="font-size:0.62rem;color:var(--color-white-dim);text-transform:uppercase;letter-spacing:.08em;">WARM</div>' +
                '</div>' +
              '</div>' +
              (tot
                ? '<div style="font-size:0.72rem;color:var(--color-white-dim);text-align:center;">HOT+WARM rate: <b style="color:' + (conv >= 20 ? '#22c55e' : conv >= 10 ? 'var(--color-accent)' : 'var(--color-white)') + '">' + conv + '%</b></div>'
                : '<div style="font-size:0.72rem;color:var(--color-white-dim);text-align:center;">No calls yet — use <b style="color:var(--color-white)">Load Dials</b> in the workspace right rail. 🔨</div>') +
            '</div>';
          return;
        }
      }
      const banner = document.querySelector('#queue-banner');
      if (banner) banner.hidden = true;
      host.hidden = false;
      const cd = Queue.coolDownCheck(p);
      const cooldownHTML = cd.blocked ? `
        <div class="prospect-card__cooldown">
          ⚠ Last dialed ${cd.days} day(s) ago — outcome was <b>${cd.last_outcome || 'unknown'}</b>. Cool-down recommends waiting.
          <button class="action-btn action-btn--sm" id="override-cooldown">Dial anyway</button>
        </div>` : '';
      const hubURL = (this._state.hubConfig.url_templates && this._state.hubConfig.url_templates.contact) ? this._state.hubConfig.url_templates.contact.replace('{contact_id}', p.contact_id) : '#';
      // Badge strip helper
      const shellBadges = (() => {
        const phoneOk = (p.best_phone_verified || '').toLowerCase() === 'true' || p.best_phone_verified === '1';
        const dmKnown = (p.decision_maker_known || '').toLowerCase() === 'true' || p.decision_maker_known === '1';
        const gbpN = p.gbp_review_count ? parseInt(p.gbp_review_count, 10) : null;
        const siteGap = p.website_gaps || '';
        const outcome = p.last_call_outcome || p.pipeline_stage || '';
        let b = '';
        b += phoneOk ? '<span class="pc-badge pc-badge--green">✓ Phone</span>' : '<span class="pc-badge pc-badge--gray">Phone?</span>';
        b += dmKnown  ? '<span class="pc-badge pc-badge--green">✓ DM</span>' : '<span class="pc-badge pc-badge--amber">DM?</span>';
        if (gbpN !== null) b += `<span class="pc-badge pc-badge--blue">⭐ ${gbpN}</span>`;
        if (siteGap) b += `<span class="pc-badge pc-badge--red" title="${escapeHTML(siteGap)}">⚠ Gap</span>`;
        if (outcome && outcome !== 'COLD') b += `<span class="pc-badge pc-badge--amber">${escapeHTML(outcome)}</span>`;
        return b ? `<div class="prospect-card__badges">${b}</div>` : '';
      })();

      host.innerHTML = `
        <div class="prospect-card__pos">
          <span class="prospect-card__pos-num">#${Queue.index + 1}</span>
          <span class="prospect-card__pos-of">of ${Queue.total()}</span>
        </div>
        <div class="prospect-card__main">
          <div class="prospect-card__name">${escapeHTML(p.business_name)} <span class="prospect-card__trade">${escapeHTML(p.trade)}</span></div>
          <div class="prospect-card__person">${escapeHTML(p.first_name)} ${escapeHTML(p.last_name || '')} · <a href="tel:${escapeHTML(p.phone)}">${escapeHTML(p.phone)}</a> · ${escapeHTML(p.city)}, ${escapeHTML(p.state)}</div>
          ${p.email ? `<div style="font-size:0.72rem;color:var(--color-white-dim);margin-top:0.15rem;"><span style="color:var(--color-accent);font-weight:700;">Email:</span> <a href="mailto:${escapeHTML(p.email)}" style="color:var(--color-white-dim);">${escapeHTML(p.email)}</a></div>` : ''}
          ${p.website ? `<div style="font-size:0.72rem;color:var(--color-white-dim);"><span style="color:var(--color-accent);font-weight:700;">Site:</span> <a href="${escapeHTML(p.website)}" target="_blank" rel="noopener" style="color:#60a5fa;">${escapeHTML(p.website.replace(/^https?:\/\//, ''))}</a></div>` : ''}
          ${shellBadges}
          ${p.quick_win ? `<div style="margin-top:0.3rem;font-size:0.77rem;color:#86efac;"><span style="color:#22c55e;font-weight:700;font-size:0.63rem;text-transform:uppercase;letter-spacing:0.08em;">Quick Win</span><br>${escapeHTML(p.quick_win)}</div>` : ''}
          ${p.ai_hook ? `<div class="prospect-card__notes" style="color:#facc15;font-style:italic;">⚡ ${escapeHTML(p.ai_hook)}</div>` : (p.notes_preview ? `<div class="prospect-card__notes">${escapeHTML(p.notes_preview)}</div>` : '')}
          ${cooldownHTML}
        </div>
        <div class="prospect-card__actions">
          <a href="${escapeHTML(hubURL)}" target="_blank" rel="noopener" class="action-btn action-btn--sm">↗ HubSpot</a>
          <div class="prospect-card__nav">
            <button class="action-btn action-btn--sm" id="queue-prev" title="Previous prospect (skip back)" ${Queue.atStart() ? 'disabled' : ''}>‹ Prev</button>
            <button class="action-btn action-btn--sm" id="queue-next" title="Next prospect (skip forward)" ${Queue.atEnd() ? 'disabled' : ''}>Next ›</button>
          </div>
        </div>
      `;
      const overrideBtn = document.querySelector('#override-cooldown');
      // TTS — announce this prospect
      TTS.announceProspect(p.business_name, p.trade, p.ai_hook || '');
      if (overrideBtn) overrideBtn.addEventListener('click', () => { Queue.overrideCooldown(p); this._renderProspectCard(); toast('Cool-down overridden — dial away'); });
      const nextBtn = document.querySelector('#queue-next');
      if (nextBtn) nextBtn.addEventListener('click', () => {
        if (Queue.atEnd()) { toast('Already on last prospect', 'error'); return; }
        Queue.advance(this._state.cockpitId);
        this._renderProspectCard();
        this.resetCockpit(true);
      });
      const prevBtn = document.querySelector('#queue-prev');
      if (prevBtn) prevBtn.addEventListener('click', () => {
        if (Queue.atStart()) { toast('Already on first prospect', 'error'); return; }
        Queue.retreat(this._state.cockpitId);
        this._renderProspectCard();
        this.resetCockpit(true);
      });

      // Bind contact to logged state — carry EVERY field the cockpits read,
      // including discovery/anchor data and the prepped pitch script.
      this._state.contact = {
        id:                   p.contact_id,
        business_name:        p.business_name,
        first_name:           p.first_name,
        last_name:            p.last_name           || '',
        phone:                p.phone               || '',
        email:                p.email               || '',
        website:              p.website             || '',
        trade:                p.trade               || '',
        city:                 p.city                || '',
        state:                p.state               || '',
        pipeline_stage:       p.pipeline_stage      || '',
        ai_hook:              p.ai_hook             || '',
        quick_win:            p.quick_win           || '',
        gbp_review_count:     p.gbp_review_count    || '',
        website_gaps:         p.website_gaps        || '',
        decision_maker_known: p.decision_maker_known || '',
        best_phone_verified:  p.best_phone_verified  || '',
        avg_ticket:           p.avg_ticket           || '',
        profit_margin:        p.profit_margin        || '',
        package_pitched:      p.package_pitched      || '',
        quoted_price:         p.quoted_price         || '',
        recommended_package:  p.recommended_package  || '',
        pitch_outcome:        p.pitch_outcome        || '',
        discovery_findings:   p.discovery_findings   || '',
        discovery_date:       p.discovery_date       || '',
        pitch_script:         p.pitch_script         || ''
      };
    },

    // ===== Public API for content.js =====
    onReset(fn) { this._state.onReset = fn; },
    onBack(fn)  { this._state.onBack  = fn; },
    startCall() { if (!Timer.isRunning()) Timer.start(); },
    pushBranch(label) { this._state.branchPath.push(label); },
    setOpenerVariant(v, mode) { this._state.openerVariant = v; if (mode) this._state.variantAssignMode = mode; },
    setCallbackWindow(v) { this._state.callbackWindow = v; },
    setContact(c) { this._state.contact = c; },
    getContact() { return this._state.contact; },
    getRep() { return this._currentRep(); },
    getCurrentTrade() { return (this._state.contact && this._state.contact.trade) || 'Unknown'; },
    getCurrentBusiness() { return (this._state.contact && this._state.contact.business_name) || '[business]'; },
    getCurrentFirstName() { return (this._state.contact && this._state.contact.first_name) || '[first name]'; },
    getCurrentCity() { return (this._state.contact && this._state.contact.city) || '[city]'; },
    getVariantMode() { return this._state.variantAssignMode; },
    _searchResultToProspect(c) {
      return {
        contact_id:           c.contact_id || c.id || '',
        first_name:           c.first_name || '',
        last_name:            c.last_name || '',
        business_name:        c.business_name || c.company || c.name || '',
        phone:                c.phone || '',
        email:                c.email || '',
        website:              c.website || '',
        trade:                c.trade || c.trade_type || '',
        city:                 c.city || '',
        state:                c.state || '',
        pipeline_stage:       c.lifecyclestage || '',
        last_call_outcome:    c.last_call_outcome || '',
        last_touched:         c.last_call_date || '',
        last_outcome:         c.last_call_outcome || '',
        ai_hook:              c.ai_hook || '',
        quick_win:            c.quick_win || '',
        gbp_review_count:     c.gbp_review_count || '',
        website_gaps:         c.website_gaps || '',
        avg_ticket:           c.avg_ticket || '',
        profit_margin:        c.profit_margin || '',
        package_pitched:      c.package_pitched || '',
        quoted_price:         c.quoted_price || '',
        recommended_package:  c.recommended_package || '',
        pitch_outcome:        c.pitch_outcome || '',
        discovery_findings:   c.discovery_findings || '',
        discovery_date:       c.discovery_date || '',
        pitch_script:         c.pitch_script || '',
        decision_maker_known: c.decision_maker_known || '',
        best_phone_verified:  c.best_phone_verified || ''
      };
    },
    addToQueue(searchResult) {
      const p = this._searchResultToProspect(searchResult);
      const wasEmpty = !Queue.hasQueue();
      const res = Queue.addManual(p, this._state.cockpitId);
      if (!res.added) { toast(p.business_name + ' is already in the queue (#' + (res.index + 1) + ')', 'error'); return res; }
      if (wasEmpty) Queue.setIndex(res.index, this._state.cockpitId);
      this._renderProspectCard();
      toast('➕ ' + (p.business_name || 'Prospect') + ' queued — #' + (res.index + 1) + ' of ' + Queue.total(), 'success');
      Audio.play('click');
      // Tell cockpits with their own live-queue layer (cold-call, niche-outreach)
      window.dispatchEvent(new CustomEvent('unc:queue-appended', { detail: { prospect: p, prospects: Queue.data.prospects, index: Queue.index } }));
      return res;
    },
    loadNow(searchResult) {
      const p = this._searchResultToProspect(searchResult);
      let res = Queue.addManual(p, this._state.cockpitId);
      const idx = res.added ? res.index : res.index;
      if (idx != null && idx >= 0) Queue.setIndex(idx, this._state.cockpitId);
      this._renderProspectCard();
      this.resetCockpit(true);
      toast('🎯 Loaded ' + (p.business_name || 'prospect') + ' — scripts are live', 'success');
      // Rebuild content.js live queues with the FULL list, jumping to the loaded prospect
      window.dispatchEvent(new CustomEvent('unc:queue-injected', { detail: { prospects: Queue.data.prospects, index: (idx != null && idx >= 0) ? idx : 0 } }));
      return res;
    },
    autoAssignVariant(key, variants) {
      // Exploit the proven best variant 70% of the time once it has a real sample;
      // keep rotating the rest so new variants still get tested.
      const champ = this._state.variantChampion;
      if (champ && Math.random() < 0.7) {
        const names = variants.map(v => (typeof v === 'string' ? v : (v && (v.id || v.name || v.label))) );
        const idx = names.indexOf(champ);
        if (idx !== -1) {
          this._state.openerVariant = variants[idx];
          return variants[idx];
        }
      }
      const pick = VariantRotor.next(key, variants);
      this._state.openerVariant = pick;
      return pick;
    },

    bindNotes() {
      const el = document.querySelector('#call-notes');
      if (!el) return;
      const panel = document.querySelector('#call-notes-panel');
      if (panel) panel.hidden = false; // notes box always available in every cockpit
      const charCount = document.querySelector('#notes-char-count');
      const draftKey = 'notes_draft';
      const saved = readLS(draftKey, '');
      if (saved) el.value = saved;
      const save = debounce(() => { writeLS(draftKey, el.value); if (charCount) charCount.textContent = el.value.length; }, 300);
      el.addEventListener('input', save);
      if (charCount) charCount.textContent = el.value.length;
    },
    _clearNotes() {
      const el = document.querySelector('#call-notes');
      if (el) el.value = '';
      writeLS('notes_draft', '');
      const cc = document.querySelector('#notes-char-count');
      if (cc) cc.textContent = '0';
    },
    getNotes() { const el = document.querySelector('#call-notes'); return el ? el.value : ''; },

    showOutcomes(defaultCode) {
      const host = document.querySelector('#outcome-buttons');
      if (!host) return;
      host.hidden = false;
      host.querySelectorAll('.outcome-btn').forEach(b => b.classList.toggle('outcome-btn--default', b.dataset.code === defaultCode));
    },
    hideOutcomes() { const host = document.querySelector('#outcome-buttons'); if (host) host.hidden = true; },

    recordOutcome(code) {
      const outcome = this._state.outcomes.find(o => o.code === code);
      if (!outcome) { toast('Unknown outcome: ' + code, 'error'); return; }
      const rep = this._currentRep();
      const duration = Timer.stop();
      const c = this._state.contact || {};
      const payload = {
        call_id: uuid(),
        timestamp: new Date().toISOString(),
        rep_id: rep.id,
        rep_name: rep.display_name,
        hubspot_owner_id: rep.hubspot_owner_id,
        duration_seconds: duration,
        branch_path: [...this._state.branchPath],
        opener_variant_used: this._state.openerVariant,
        variant_assignment_mode: this._state.variantAssignMode,
        outcome_code: outcome.code,
        outcome_label: outcome.label,
        hubspot_stage: outcome.hubspot_stage,
        callback_window: this._state.callbackWindow,
        notes: this.getNotes(),
        contact_id: c.id || null,
        business_name: c.business_name || null,
        first_name: c.first_name || null,
        trade: c.trade || null,
        pipeline_stage_at_call_start: c.pipeline_stage || null,
        avg_ticket: c.avg_ticket || '',
        profit_margin: c.profit_margin || '',
        package_pitched: c.package_pitched || '',
        quoted_price: c.quoted_price || '',
        recommended_package: c.recommended_package || '',
        pitch_outcome: this._state.cockpitId === 'service-pitch' ? outcome.code : '',
        discovery_findings: this._state.cockpitId === 'discovery' ? this.getNotes() : (c.discovery_findings || ''),
        discovery_date: this._state.cockpitId === 'discovery' ? new Date().toISOString().slice(0, 10) : (c.discovery_date || ''),
        cockpit: this._state.cockpitId,
        shell_version: VERSION,
        synced: false
      };

      // Show confirm bar — rep verifies before outcome is sent to HubSpot
      this._showConfirmBar(payload, outcome);
    },

    _showConfirmBar(payload, outcome) {
      let bar = document.getElementById('confirm-sync-bar');
      if (!bar) { this._processOutcome(payload, outcome); return; }
      document.getElementById('confirm-sync-label').textContent =
        'Log ' + outcome.code + ' for ' + (payload.business_name || 'this prospect') + '?';
      document.getElementById('confirm-sync-detail').textContent =
        'Updates HubSpot contact · Creates follow-up task · Adds to call log';
      bar.className = 'sync-confirm-bar sync-confirm-bar--visible';
      // Clone buttons to remove stale listeners
      ['confirm-sync-yes','confirm-sync-no','confirm-sync-fallback'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { const n = el.cloneNode(true); el.parentNode.replaceChild(n, el); }
      });
      document.getElementById('confirm-sync-yes').addEventListener('click', () => {
        bar.className = 'sync-confirm-bar sync-confirm-bar--syncing';
        document.getElementById('confirm-sync-label').textContent = 'Syncing to HubSpot...';
        this._processOutcome(payload, outcome);
      });
      document.getElementById('confirm-sync-no').addEventListener('click', () => {
        bar.className = 'sync-confirm-bar';
        toast('Cancelled — not logged.', 'error');
      });
    },

    async _processOutcome(payload, outcome) {
      CallLog.push(payload);
      CallLog.bumpDialCounter();
      this._state._lastOutcomeCode = outcome.code;
      const result = await Sync.attempt(payload);
      Sync.refresh();
      Audio.play(outcome.audio || 'click');
      // V3 — outcome flash
      (function(oc, el) { if (!el) return; var cls = oc === 'HOT' ? 'outcome-flash--hot' : oc === 'WARM' ? 'outcome-flash--warm' : null; if (!cls) return; el.classList.remove('outcome-flash--hot', 'outcome-flash--warm'); void el.offsetWidth; el.classList.add(cls); setTimeout(function(){ el.classList.remove(cls); }, 950); })(outcome.code, document.querySelector('.cockpit'));
      // TTS — outcome callout + milestone
      TTS.callOutcome(outcome.code, payload.business_name);
      (function() { const n = CallLog.countToday(); TTS.dialMilestone(n); })();
      const bar = document.getElementById('confirm-sync-bar');
      if (bar) {
        if (result && result.ok) {
          bar.className = 'sync-confirm-bar sync-confirm-bar--success';
          document.getElementById('confirm-sync-label').textContent = '✓ HubSpot updated — ' + outcome.code + ' logged';
          setTimeout(() => { const b = document.getElementById('confirm-sync-bar'); if (b) b.className = 'sync-confirm-bar'; }, 3000);
        } else {
          bar.className = 'sync-confirm-bar sync-confirm-bar--error';
          document.getElementById('confirm-sync-label').textContent = '✗ Sync failed — copy fallback command to finish session';
          const fb = document.getElementById('confirm-sync-fallback');
          if (fb) {
            fb.style.display = 'inline-flex';
            fb.addEventListener('click', async () => {
              const cmd = Sync.buildCoworkCommand();
              if (cmd) {
                try { await navigator.clipboard.writeText(cmd.text); toast('Fallback command copied — paste in Cowork extension at end of session', 'success'); }
                catch(e) { toast('Copy failed', 'error'); }
              }
            });
          }
        }
      }
      if (['HOT', 'WARM'].includes(outcome.code)) {
        this._renderFollowUpPanel(payload);
      } else {
        toast('Logged ' + outcome.label + '. Next dial.', 'success');
        this._refreshDialCount();
        setTimeout(() => this._advanceAndReset(), 1100);
      }
    },

    // Commission-per-close — rep's cut of the quoted price, shown on HOT.
    // Rates mirror /commissions + tools/commission: retainer Y1 30%/mo, project 25%, merch 50% of net.
    _commissionPreview(p) {
      if (p.outcome_code !== 'HOT') return '';
      const price = parseFloat(String(p.quoted_price == null ? '' : p.quoted_price).replace(/[^0-9.]/g, ''));
      if (!price || price <= 0 || !isFinite(price)) return '';
      const pkg = String(p.package_pitched || '');
      const money = function(n) { return '$' + Math.round(n).toLocaleString(); };
      let main, sub;
      if (/merch/i.test(pkg)) {
        main = '50% of net profit';
        sub = 'Merch deal on ' + money(price) + ' — exact cut depends on COGS. Run it in the Commission tool (Alt+M).';
      } else if (/website|landing|ai build|custom ai|consult/i.test(pkg)) {
        main = money(price * 0.25) + ' one-time';
        sub = '25% project rate on ' + money(price) + ' — paid when the invoice collects.';
      } else {
        main = money(price * 0.30) + '/mo';
        sub = '30% Y1 rate on ' + money(price) + '/mo — ' + money(price * 0.30 * 12) + ' your first year if they stay 12 months. Paid per invoice collected.';
      }
      return `
        <div class="followup-panel__commission" style="margin:0.75rem 0;padding:0.85rem 1rem;border:1px solid rgba(34,197,94,0.35);border-radius:8px;background:rgba(34,197,94,0.06);">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#22c55e;margin-bottom:0.25rem;">💵 Your cut if this closes</div>
          <div style="font-size:1.45rem;font-weight:800;color:#22c55e;line-height:1.1;">${escapeHTML(main)}</div>
          <div style="font-size:0.78rem;color:var(--color-white-dim);margin-top:0.3rem;">${escapeHTML(sub)}</div>
        </div>`;
    },

    _renderFollowUpPanel(payload) {
      // Build Gmail compose URL + HubSpot URL
      const cfg = this._state.hubConfig || {};
      const hubURL = (cfg.url_templates && cfg.url_templates.contact && payload.contact_id) ? cfg.url_templates.contact.replace('{contact_id}', payload.contact_id) : null;

      // Compose follow-up email — Gmail web compose URL
      const subj = payload.outcome_code === 'HOT'
        ? '90-second audit for ' + (payload.business_name || 'your business')
        : 'Following up — ' + (payload.business_name || 'our chat');
      const body = this._buildFollowUpEmail(payload);
      const gmailURL = 'https://mail.google.com/mail/?view=cm&fs=1&to=&su=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);

      const panelHTML = `
        <div class="followup-panel">
          <div class="followup-panel__head">
            <span class="followup-panel__eyebrow">Logged ${payload.outcome_code} · ${escapeHTML(payload.business_name || '')}</span>
            <span class="followup-panel__sub">Quick follow-up actions — all open in new tabs.</span>
          </div>
          ${this._commissionPreview(payload)}
          <div class="followup-panel__actions">
            ${hubURL ? `<a href="${escapeHTML(hubURL)}" target="_blank" rel="noopener" class="action-btn action-btn--primary">↗ Open HubSpot record</a>` : ''}
            <a href="${escapeHTML(gmailURL)}" target="_blank" rel="noopener" class="action-btn">✉ Compose Gmail follow-up</a>
            <button class="action-btn" data-followup="copy-booking-url">📋 Copy booking link</button>
            <button class="action-btn" data-followup="copy-cowork">📋 Copy Cowork sync (this call)</button>
          </div>
          <div class="followup-panel__foot">
            <button class="action-btn action-btn--primary" data-followup="done">Done — Next Dial ›</button>
          </div>
        </div>
      `;
      const host = document.querySelector('#screen-stage');
      if (!host) return;
      host.classList.remove('active'); void host.offsetWidth;
      host.innerHTML = panelHTML;
      host.classList.add('active');

      host.querySelector('[data-followup="copy-booking-url"]').addEventListener('click', async () => {
        const link = 'https://urbannicheco.com/audit';
        try { await navigator.clipboard.writeText(link); toast('Booking link copied'); } catch(e) { toast('Copy failed — link: ' + link, 'error'); }
      });
      host.querySelector('[data-followup="copy-cowork"]').addEventListener('click', async () => {
        const cmd = Sync.buildCoworkCommand();
        if (!cmd) { toast('Nothing to sync', 'error'); return; }
        // Filter to just this call
        const singleCall = cmd.text.split('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━').slice(0, 3).join('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try { await navigator.clipboard.writeText(cmd.text); toast('Cowork sync command copied (' + cmd.count + ' calls)'); } catch(e) { toast('Copy failed', 'error'); }
      });
      host.querySelector('[data-followup="done"]').addEventListener('click', () => { this._refreshDialCount(); this._advanceAndReset(); });
    },

    _buildFollowUpEmail(p) {
      const trade = (p.trade || '').toLowerCase();
      const tradePhrase = trade ? trade + 's' : 'contractors';
      const first = p.first_name || 'there';
      const biz = p.business_name || 'your business';
      const rep = this._currentRep();
      const repPhone = rep.phone || '(515) 344-4053';
      const repSig = rep.signature || ('\u2014 ' + (rep.display_name || 'Your rep') + ', UNC');
      const bookingUrl = rep.booking_url || 'https://urbannicheco.com/audit';
      if (p.outcome_code === 'HOT') {
        return `Hey ${first},\n\nThanks for the call \u2014 here's the booking link as promised:\n\n${bookingUrl}\n\nPick whatever time works and I'll send over the walkthrough video before we hop on. Quick + no pitch.\n\n${repSig}\nUrban Niche Co.\n${repPhone}\nurbannicheco.com`;
      }
      // WARM
      return `Hey ${first},\n\nQuick follow-up from our call earlier. As mentioned, I help ${tradePhrase} in your area get more calls without lighting money on fire with Google Ads.\n\nWhen you're ready, here's the 90-second free audit link:\n\n${bookingUrl}\n\nNo pitch \u2014 just a walkthrough of where ${biz} might be leaving leads on the table.\n\n${repSig}\nUrban Niche Co.\n${repPhone}`;
    },

        _advanceAndReset() {
      // Auto-advance queue if in queue mode
      if (Queue.hasQueue() && Queue.index < Queue.total() - 1) {
        Queue.advance(this._state.cockpitId);
      }
      this.resetCockpit(true);
      this._renderProspectCard();
      // Hook for live queue auto-advance (called from content.js)
      if (typeof window._liveAdvance === 'function') window._liveAdvance(this._state._lastOutcomeCode || '');
    },

    resetCockpit(quiet) {
      this._state.branchPath = [];
      this._state.openerVariant = null;
      this._state.callbackWindow = null;
      this._clearNotes();
      Timer.reset();
      this.hideOutcomes();
      if (this._state.onReset) this._state.onReset();
      if (!quiet) Audio.play('swipe');
    },

    exportCSV() {
      const csv = CallLog.csvForToday();
      if (!csv) { toast('No calls logged today yet.', 'error'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'UNC_call_log_' + todayKey() + '.csv';
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      toast('CSV exported — check downloads', 'success');
    },

    openSyncPanel() {
      const modal = document.querySelector('#sync-modal');
      if (!modal) return;
      const cmd = Sync.buildCoworkCommand();
      const textarea = modal.querySelector('#sync-text');
      const countEl = modal.querySelector('#sync-count');
      if (!cmd) {
        if (textarea) textarea.value = 'No unsynced calls. Everything is up to date.';
        if (countEl) countEl.textContent = '0';
      } else {
        if (textarea) textarea.value = cmd.text;
        if (countEl) countEl.textContent = cmd.count;
        this._lastSyncCallIds = cmd.callIds;
      }
      modal.classList.add('open');
    },

    async _copyCowork() {
      const textarea = document.querySelector('#sync-text');
      if (!textarea || !textarea.value) return;
      try { await navigator.clipboard.writeText(textarea.value); toast('Cowork command copied — paste in Cowork extension', 'success'); }
      catch(e) { textarea.select(); document.execCommand && document.execCommand('copy'); toast('Copied (fallback method)'); }
    },

    _markAllSynced() {
      if (!this._lastSyncCallIds || !this._lastSyncCallIds.length) { toast('Nothing to mark', 'error'); return; }
      const n = CallLog.markSynced(this._lastSyncCallIds);
      Sync.refresh();
      toast('Marked ' + n + ' calls as synced', 'success');
      const modal = document.querySelector('#sync-modal');
      if (modal) modal.classList.remove('open');
      this._lastSyncCallIds = [];
    },

    toggleStats() {
      const drawer = document.querySelector('#stats-drawer');
      if (!drawer) return;
      if (drawer.classList.contains('open')) drawer.classList.remove('open');
      else { this._renderStats(); drawer.classList.add('open'); }
    },

    _renderStats() {
      const body = document.querySelector('#stats-body');
      if (!body) return;
      const rep = this._currentRep();
      const all = CallLog.today();
      const mine = all.filter(c => c.rep_id === rep.id);
      const tot = mine.length;
      const by = {}; this._state.outcomes.forEach(o => by[o.code] = 0);
      let totalDur = 0;
      const variantCount = {}, variantConv = {};
      const byHour = {};
      const byTrade = {};
      mine.forEach(c => {
        if (c.outcome_code && by[c.outcome_code] != null) by[c.outcome_code]++;
        totalDur += (c.duration_seconds || 0);
        if (c.opener_variant_used) {
          variantCount[c.opener_variant_used] = (variantCount[c.opener_variant_used] || 0) + 1;
          if (['HOT','WARM'].includes(c.outcome_code)) variantConv[c.opener_variant_used] = (variantConv[c.opener_variant_used] || 0) + 1;
        }
        const h = c.timestamp ? new Date(c.timestamp).getHours() : null;
        if (h != null) byHour[h] = (byHour[h] || 0) + (['HOT','WARM'].includes(c.outcome_code) ? 1 : 0);
        if (c.trade) {
          byTrade[c.trade] = byTrade[c.trade] || { total: 0, conv: 0 };
          byTrade[c.trade].total++;
          if (['HOT','WARM'].includes(c.outcome_code)) byTrade[c.trade].conv++;
        }
      });
      const conv = tot ? Math.round(((by.HOT + by.WARM) / tot) * 100) : 0;
      const avg = tot ? Math.round(totalDur / tot) : 0;

      let variantHTML = Object.keys(variantCount).sort().map(v => {
        const c = variantCount[v], conv2 = variantConv[v] || 0;
        const rate = c ? Math.round((conv2 / c) * 100) : 0;
        const caveat = c < 10 ? ' <span style="opacity:0.5">(small sample)</span>' : '';
        return `<div class="stat-block__row"><span>${v} (${c}× used)</span><b>${rate}% → HOT/WARM${caveat}</b></div>`;
      }).join('');
      if (!variantHTML) variantHTML = '<div class="stat-block__row"><span>No variant data yet</span><b>—</b></div>';

      const outRows = this._state.outcomes.map(o =>
        `<div class="stat-block__row"><span>${escapeHTML(o.label)}</span><b>${by[o.code] || 0}</b></div>`
      ).join('');

      let tradeHTML = Object.keys(byTrade).map(t => {
        const x = byTrade[t]; const rate = x.total ? Math.round((x.conv / x.total) * 100) : 0;
        return `<div class="stat-block__row"><span>${escapeHTML(t)}</span><b>${x.conv}/${x.total} (${rate}%)</b></div>`;
      }).join('');
      if (!tradeHTML) tradeHTML = '<div class="stat-block__row"><span>No trade data yet</span><b>—</b></div>';

      // Hour heatmap — simple bars
      const maxH = Math.max(1, ...Object.values(byHour));
      const hours = [];
      for (let h = 7; h <= 19; h++) {
        const v = byHour[h] || 0;
        const pct = Math.round((v / maxH) * 100);
        hours.push(`<div class="heatmap__cell" title="${h}:00 — ${v} HOT/WARM"><div class="heatmap__bar" style="height:${pct}%"></div><div class="heatmap__label">${h}</div></div>`);
      }

      body.innerHTML = `
        <div class="stat-block">
          <div class="stat-block__label">${escapeHTML(rep.display_name)} — Today</div>
          <div class="stat-block__value">${tot}</div>
          <div class="stat-block__row"><span>Dials counter</span><b>${CallLog.dialsToday()}</b></div>
          <div class="stat-block__row"><span>HOT + WARM rate</span><b>${conv}%</b></div>
          <div class="stat-block__row"><span>Avg call duration</span><b>${avg}s</b></div>
          <div class="stat-block__row"><span>Unsynced calls</span><b>${CallLog.unsynced().length}</b></div>
        </div>
        <div class="stat-block">
          <div class="stat-block__label">Best dial windows (HOT+WARM by hour)</div>
          <div class="heatmap">${hours.join('')}</div>
        </div>
        <div class="stat-block">
          <div class="stat-block__label">Outcome breakdown</div>
          ${outRows}
        </div>
        <div class="stat-block">
          <div class="stat-block__label">Opener variant performance</div>
          ${variantHTML}
        </div>
        <div class="stat-block">
          <div class="stat-block__label">Per-trade conversion</div>
          ${tradeHTML}
        </div>
        <div class="stat-block">
          <div class="stat-block__label">💰 Money — Today</div>
          <div class="stat-block__row"><span>Pipeline quoted (my calls)</span><b>$${mine.reduce((t, c) => t + (parseFloat(c.quoted_price) || 0), 0).toLocaleString()}</b></div>
          <div class="stat-block__row"><span>Quotes delivered</span><b>${mine.filter(c => c.quoted_price && parseFloat(c.quoted_price) > 0).length}</b></div>
          <div class="stat-block__row"><span>HOT closes to confirm</span><b>${by.HOT || 0}</b></div>
        </div>
        <div class="stat-block">
          <div class="stat-block__label">Sync state</div>
          <div class="stat-block__row"><span>Endpoint</span><b>${SYNC_ENDPOINT === 'MOCK' ? 'localStorage + Cowork batch' : 'Live API'}</b></div>
          <div class="stat-block__row"><span>Today total (all reps)</span><b>${all.length}</b></div>
        </div>
      `;
    }
  };

  // ── COACH RAIL — relocate .coach-note hints from the stage into the right
  //    column (between the session card and the notes panel). One scroll, clean stage.
  Shell._injectCoachRail = function() {
    if (document.getElementById('coach-panel')) return;
    const notes = document.getElementById('call-notes-panel');
    const stage = document.getElementById('screen-stage');
    if (!notes || !notes.parentNode || !stage) return;
    // Collapsed-by-default chip design: notes hide behind a "💡 Coach" chip
    // that wobbles once per session until hovered/clicked, then sits quiet.
    // Click or `C` toggles the pop-open panel; Esc / click-outside closes.
    const wrap = document.createElement('div');
    wrap.id = 'coach-panel';
    wrap.className = 'coach-wrap';
    wrap.hidden = true;
    const introSeen = (function() { try { return sessionStorage.getItem('unc_coach_intro') === '1'; } catch (e) { return true; } })();
    wrap.innerHTML =
      '<button type="button" id="coach-chip" class="coach-chip' + (introSeen ? '' : ' coach-chip--wobble') + '" title="Coaching for this screen — C to toggle, Esc to close">' +
        '💡 Coach <span id="coach-chip-count" class="coach-chip__count"></span>' +
      '</button>' +
      '<div id="coach-pop" class="coach-pop" hidden>' +
        '<div class="coach-panel__lbl">💡 Coach <span class="coach-pop__esc">Esc closes</span></div>' +
        '<div id="coach-panel-body"></div>' +
      '</div>';
    notes.parentNode.insertBefore(wrap, notes);

    const chip = wrap.querySelector('#coach-chip');
    const pop = wrap.querySelector('#coach-pop');
    const settleIntro = function() {
      chip.classList.remove('coach-chip--wobble');
      try { sessionStorage.setItem('unc_coach_intro', '1'); } catch (e) {}
    };
    const openPop = function() { pop.hidden = false; chip.classList.add('coach-chip--active'); settleIntro(); };
    const closePop = function() { pop.hidden = true; chip.classList.remove('coach-chip--active'); };
    const togglePop = function() { if (pop.hidden) openPop(); else closePop(); };

    chip.addEventListener('mouseenter', settleIntro);
    chip.addEventListener('click', function(e) { e.stopPropagation(); togglePop(); });
    document.addEventListener('click', function(e) {
      if (!pop.hidden && !wrap.contains(e.target)) closePop();
    });
    document.addEventListener('keydown', function(e) {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape' && !pop.hidden) { closePop(); return; }
      if (typing) return;
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !wrap.hidden) togglePop();
    });

    const migrate = function(records) {
      // Only react to mutations that ADD nodes (a screen render). Our own
      // removal of hint nodes fires removal-only records — ignore those,
      // or the observer wipes the panel it just filled.
      if (records && records.length && !records.some(function(r) { return r.addedNodes && r.addedNodes.length; })) return;
      const body = document.getElementById('coach-panel-body');
      if (!body) return;
      const hints = stage.querySelectorAll('.coach-note');
      body.innerHTML = '';
      if (!hints.length) { wrap.hidden = true; closePop(); return; }
      hints.forEach(function(el) { body.appendChild(el); });
      const count = document.getElementById('coach-chip-count');
      if (count) count.textContent = String(hints.length);
      wrap.hidden = false;
      // Rep had it open? It stays open across screens — they opted in.
      // Closed stays closed and quiet.
    };
    new MutationObserver(migrate).observe(stage, { childList: true });
    migrate();
  };

  // ── INJECTED METHODS (added to Shell object) ────────────────
  Shell._injectConfirmBar = function() {
    if (document.getElementById('confirm-sync-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'confirm-sync-bar';
    bar.className = 'sync-confirm-bar';
    bar.innerHTML = '<div class="sync-confirm-bar__content"><div class="sync-confirm-bar__text"><div id="confirm-sync-label" class="sync-confirm-bar__label">Confirm outcome</div><div id="confirm-sync-detail" class="sync-confirm-bar__detail">Updates HubSpot · Creates task</div></div><div class="sync-confirm-bar__actions"><button id="confirm-sync-yes" class="sync-confirm-bar__btn sync-confirm-bar__btn--confirm">✓ Log it</button><button id="confirm-sync-no" class="sync-confirm-bar__btn sync-confirm-bar__btn--cancel">Cancel</button><button id="confirm-sync-fallback" class="sync-confirm-bar__btn sync-confirm-bar__btn--fallback" style="display:none">📋 Copy fallback</button></div></div>';
    document.body.appendChild(bar);
  };

  // PIN gate removed — cockpit is a ghost page, URL is the protection.
  // Rep selection persists via localStorage. PIN auth to be re-added later.
  Shell._injectPinModal = function() {
    const saved = readLS('current_rep_id', null);
    if (saved && this._state.reps.find(r => r.id === saved)) {
      this._state.currentRepId = saved;
    } else {
      // Default to first active rep
      this._state.currentRepId = this._state.reps[0] ? this._state.reps[0].id : 'ricky';
      writeLS('current_rep_id', this._state.currentRepId);
    }
    const sel = document.querySelector('#rep-select');
    if (sel) {
      sel.value = this._state.currentRepId;
      sel.style.borderLeftColor = this._currentRep().color;
    }
    toast('Welcome, ' + this._currentRep().display_name);
    // TTS greeting
    (function() {
      const r = window.CockpitShell ? window.CockpitShell._currentRep() : {};
      const name = r.display_name || '';
      const q = typeof Queue !== 'undefined' ? Queue.total() : 0;
      const label = document.querySelector('.hud__cockpit-name') ? document.querySelector('.hud__cockpit-name').textContent : '';
      TTS.greetSession(name, q, label);
    })();
  };

  Shell.fetchQueue = async function(limit) {
    const rep = this._currentRep();
    if (!rep.hubspot_owner_id) return { ok: false, error: 'No rep owner ID' };
    try {
      const r = await fetch(WORKER_BASE + '/queue?rep_id=' + encodeURIComponent(rep.id) + '&owner_id=' + encodeURIComponent(rep.hubspot_owner_id) + '&limit=' + (limit || 10), { headers: { 'x-unc-key': WORKER_KEY } });
      return await r.json();
    } catch(e) { return { ok: false, error: e.message }; }
  };

  Shell.fetchStats = async function(repId, range, view) {
    try {
      const r = await fetch(WORKER_BASE + '/stats?rep_id=' + encodeURIComponent(repId || '') + '&range=' + (range || 'week') + '&view=' + (view || 'individual'), { headers: { 'x-unc-key': WORKER_KEY } });
      return await r.json();
    } catch(e) { return { ok: false, error: e.message }; }
  };

  Shell.fetchContactHistory = async function(contactId) {
    try {
      const r = await fetch(WORKER_BASE + '/contact/' + encodeURIComponent(contactId) + '/history', { headers: { 'x-unc-key': WORKER_KEY } });
      return await r.json();
    } catch(e) { return { ok: false, error: e.message }; }
  };

  Shell.fetchGoals = async function() {
    try {
      const r = await fetch(WORKER_BASE + '/goals', { headers: { 'x-unc-key': WORKER_KEY } });
      return await r.json();
    } catch(e) { return { ok: false, error: e.message }; }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // FLOATING TOOLBAR — shared across all cockpits
  // Buttons: OBJ · LOOKUP · EMAIL · PRICING · VOICEMAIL · TRADE
  // One panel open at a time. Click same = close. Click different = swap.
  // ESC or outside click = close all.
  // ─────────────────────────────────────────────────────────────────────────
  Shell._injectFloatingToolbar = function() {
    if (document.getElementById('ft-col-panel')) return;

    const WORKER = WORKER_BASE;
    const PORTAL = (this._state.hubConfig && this._state.hubConfig.portal_id) ? this._state.hubConfig.portal_id : '245833525';

    const _cache = {};
    let _activePanel = null;
    let _lastPanel = 'obj';

    function esc(s) { return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    // ── Inject column panel into left column ────────────────────────────────
    const leftCol = document.querySelector('.col-right');
    if (!leftCol) return;

    const TOOLS = [
      { id:'obj',       label:'Objections', icon:'👊', tip:'Objection handlers — click any response to copy' },
      { id:'lookup',    label:'Lookup',     icon:'🔎', tip:'Live HubSpot search — find any contact mid-call' },
      { id:'email',     label:'Email',      icon:'✉',  tip:'Fire a follow-up email to the current prospect' },
      { id:'pricing',   label:'Pricing',    icon:'💰', tip:'Full service catalog — click to build a quote' },
      { id:'voicemail', label:'Voicemail',  icon:'📱', tip:'Voicemail scripts — click to copy, under 20s each' },
      { id:'trade',     label:'Trade Info', icon:'🏗',  tip:'Trade intel — auto-selects from current prospect' }
    ];

    const panel = document.createElement('div');
    panel.id = 'ft-col-panel';
    panel.innerHTML =
      '<div class="ft-col-head">' +
        '<span class="ft-col-title" id="ft-col-title">Tools</span>' +
        '<button class="ft-col-close" id="ft-col-close">×</button>' +
      '</div>' +
      '<div class="ft-panel__tabs" id="ft-panel-tabs">' +
        TOOLS.map(t =>
          '<button class="ft-tab" data-panel="'+t.id+'" title="'+t.tip+'">'+t.icon+' '+t.label+'</button>'
        ).join('') +
      '</div>' +
      '<div class="ft-panel__body" id="ft-panel-body"><div class="ft-panel__loading">Select a tool above.</div></div>';

    leftCol.appendChild(panel);

    // ── Inject TOOLS button into footer ──────────────────────────────────────
    const foot = document.querySelector('.foot');
    if (foot && !document.getElementById('ft-tools-btn')) {
      const footRight = document.createElement('div');
      footRight.className = 'foot__right';
      footRight.innerHTML = '<button id="ft-tools-btn" title="Call tools — T to toggle">🧰 Tools</button>';
      foot.appendChild(footRight);
      footRight.querySelector('#ft-tools-btn').addEventListener('click', toggleTools);
    }

    // ── Inject styles for ft-panel__* classes (shared with old floating panel) ─
    if (!document.getElementById('ft-styles')) {
      const style = document.createElement('style');
      style.id = 'ft-styles';
      style.textContent = `
        .ft-panel__tabs { display:flex;flex-wrap:wrap;gap:4px;padding:0.4rem 0.6rem;border-bottom:1px solid var(--color-border);background:var(--color-dark-2);flex-shrink:0; }
        .ft-tab { background:transparent;border:1px solid transparent;color:var(--color-white-dim);font-family:var(--font-display);font-size:0.6rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:0.3rem 0.45rem;border-radius:var(--radius-sm);cursor:pointer;transition:all 0.15s;white-space:nowrap; }
        .ft-tab:hover { color:var(--color-accent); }
        .ft-tab.ft-active { background:rgba(232,101,26,0.15);border-color:var(--color-accent);color:var(--color-accent); }
        .ft-panel__body { overflow-y:auto;padding:0.85rem 1rem;flex:1;font-size:0.85rem;color:var(--color-white); }
        .ft-panel__loading { color:var(--color-white-dim);text-align:center;padding:1.5rem; }
        .ft-search-row { display:flex;gap:0.5rem;margin-bottom:0.75rem; }
        .ft-search-row input { flex:1;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-white);font-family:var(--font-body);font-size:0.85rem;padding:0.5rem 0.7rem;outline:none; }
        .ft-search-row input:focus { border-color:var(--color-accent); }
        .ft-result { padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:0.5rem; }
        .ft-result__name { font-weight:700;font-size:0.88rem; }
        .ft-result__meta { font-size:0.75rem;color:var(--color-white-dim);margin-top:0.2rem; }
        .ft-result__actions { display:flex;gap:0.4rem;margin-top:0.5rem; }
        .ft-obj-item { margin-bottom:0.85rem;padding-bottom:0.85rem;border-bottom:1px solid var(--color-border); }
        .ft-obj-item:last-child { border-bottom:none; }
        .ft-obj-label { font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.3rem; }
        .ft-obj-script { font-size:0.83rem;line-height:1.55;color:var(--color-white);cursor:pointer; }
        .ft-obj-script:hover { color:var(--color-accent); }
        .ft-tmpl { padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:0.5rem;cursor:pointer;transition:border-color 0.15s; }
        .ft-tmpl:hover,.ft-tmpl.selected { border-color:var(--color-accent); }
        .ft-tmpl__name { font-weight:700;font-size:0.85rem; }
        .ft-tmpl__tag { font-size:0.68rem;color:var(--color-accent);margin-top:0.1rem; }
        .ft-price-row { display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0;border-bottom:1px solid var(--color-border);font-size:0.83rem;cursor:pointer; }
        .ft-price-row:last-child { border-bottom:none; }
        .ft-price-val { font-weight:700;color:var(--color-accent); }
        .ft-trade-select { width:100%;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-white);font-size:0.85rem;padding:0.5rem 0.7rem;outline:none;margin-bottom:0.75rem; }
        .ft-trade-select:focus { border-color:var(--color-accent); }
        .ft-trade-field { margin-bottom:0.6rem; }
        .ft-trade-field__label { font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-white-dim);margin-bottom:0.25rem; }
        .ft-trade-field__val { font-size:0.85rem;color:var(--color-white); }
        .ft-hook { font-size:0.82rem;font-style:italic;color:var(--color-accent);padding:0.5rem 0.75rem;background:rgba(232,101,26,0.07);border-radius:var(--radius-sm);margin-top:0.4rem;cursor:pointer; }
        .ft-hook:hover { background:rgba(232,101,26,0.14); }
        .ft-price-cat { font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-white-dim);padding:0.6rem 0 0.25rem;margin-top:0.25rem; }
      `;
      document.head.appendChild(style);
    }

    // ── Open / close / toggle ────────────────────────────────────────────────
    function openPanel(id) {
      _activePanel = id;
      _lastPanel = id;
      document.querySelectorAll('.ft-tab').forEach(b => b.classList.toggle('ft-active', b.dataset.panel === id));
      const titleEl = document.getElementById('ft-col-title');
      if (titleEl) titleEl.textContent = { obj:'Objections', lookup:'Prospect Lookup', email:'Email Launcher', pricing:'Pricing', voicemail:'Voicemails', trade:'Trade Info' }[id] || id;
      leftCol.classList.add('tools-open');
      const btn = document.getElementById('ft-tools-btn');
      if (btn) btn.classList.add('ft-active');
      renderPanel(id);
    }

    function closePanel() {
      _activePanel = null;
      leftCol.classList.remove('tools-open');
      const btn = document.getElementById('ft-tools-btn');
      if (btn) btn.classList.remove('ft-active');
      document.querySelectorAll('.ft-tab').forEach(b => b.classList.remove('ft-active'));
    }

    function toggleTools() {
      if (_activePanel) { closePanel(); } else { openPanel(_lastPanel); }
    }

    // Expose globally so content.js / keyboard handler can call it
    window._cockpitToggleTools = toggleTools;
    window._cockpitCloseTools  = closePanel;

    document.getElementById('ft-panel-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.ft-tab');
      if (!tab) return;
      if (tab.dataset.panel !== _activePanel) openPanel(tab.dataset.panel);
    });

    document.getElementById('ft-col-close').addEventListener('click', closePanel);

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' && _activePanel) { closePanel(); e.stopPropagation(); }
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) toggleTools();
    });

    // ── Panel renderers ──────────────────────────────────────────────────────
    const body = () => document.getElementById('ft-panel-body');

    async function renderPanel(id) {
      body().innerHTML = '<div class="ft-panel__loading">Loading...</div>';
      try {
        if (id === 'obj')       await renderObj();
        if (id === 'lookup')    renderLookup();
        if (id === 'email')     renderEmail();
        if (id === 'pricing')   renderPricing();
        if (id === 'voicemail') await renderVoicemail();
        if (id === 'trade')     await renderTrade();
      } catch(e) {
        body().innerHTML = '<div class="ft-panel__loading" style="color:#ef4444;">Failed to load: '+esc(e.message)+'</div>';
      }
    }

    // OBJ — load from cold-call scripts.json
    async function renderObj() {
      if (!_cache.obj) {
        const r = await fetch('/sales-ops/cold-call/scripts.json', { cache:'no-cache' });
        const d = await r.json();
        _cache.obj = d.objections || {};
      }
      const objs = _cache.obj;
      const Shell = window.CockpitShell;
      // Pull top_objections from active rep — falls back to full list
      const _objRep = Shell && Shell._currentRep ? Shell._currentRep() : {};
      const TOP = (_objRep.top_objections && _objRep.top_objections.length)
        ? _objRep.top_objections
        : ['not_interested','no_budget','already_have_agency','doesnt_work','all_the_same','too_busy','what_does_it_cost'];
      const contact = (Shell && Shell.getContact ? Shell.getContact() : null) || {};
      function interp(s) {
        if (!s) return '';
        return s.replace(/\{(\w+)\}/g, (m,k) => (contact[k] || contact.trade_lower || m));
      }
      body().innerHTML = TOP.map(k => {
        const o = objs[k]; if (!o) return '';
        const label = o.label || k.replace(/_/g,' ').toUpperCase();
        const script = o.say_this || '';
        return '<div class="ft-obj-item">' +
          '<div class="ft-obj-label">'+esc(label)+'</div>' +
          '<div class="ft-obj-script" title="Click to copy" data-text="'+esc(interp(script))+'">'+interp(script)+'</div>' +
        '</div>';
      }).join('');
      body().querySelectorAll('.ft-obj-script').forEach(el => {
        el.addEventListener('click', () => {
          navigator.clipboard.writeText(el.dataset.text);
          const orig = el.style.color;
          el.style.color = '#22c55e';
          setTimeout(() => el.style.color = orig, 800);
        });
      });
    }

    // LOOKUP — live HubSpot search
    function renderLookup() {
      const Shell = window.CockpitShell;
      const rep = Shell && Shell._currentRep ? Shell._currentRep() : {};
      body().innerHTML =
        '<div class="ft-search-row">' +
          '<input type="text" id="ft-lookup-input" placeholder="Name or business..." autocomplete="off">' +
          '<button class="action-btn action-btn--sm" id="ft-lookup-btn">Search</button>' +
        '</div>' +
        '<div id="ft-lookup-results"></div>';

      let debounce = null;
      const input = document.getElementById('ft-lookup-input');
      const results = document.getElementById('ft-lookup-results');

      async function doSearch() {
        const q = input.value.trim();
        if (q.length < 2) return;
        results.innerHTML = '<div style="color:var(--color-white-dim);font-size:0.8rem;">Searching...</div>';
        try {
          const r = await fetch(WORKER+'/search?q='+encodeURIComponent(q)+'&limit=5', { cache:'no-cache', headers: { 'x-unc-key': WORKER_KEY } });
          const data = await r.json();
          if (!data.ok || !data.contacts.length) {
            results.innerHTML = '<div style="color:var(--color-white-dim);font-size:0.8rem;">No results for &quot;'+esc(q)+'&quot;</div>';
            return;
          }
          results.innerHTML = data.contacts.map((c, i) => {
            const hubURL = 'https://app-na2.hubspot.com/contacts/'+PORTAL+'/contact/'+c.contact_id;
            const name = (c.first_name+' '+c.last_name).trim() || '(Unknown)';
            return '<div class="ft-result">' +
              '<div class="ft-result__name">'+esc(c.business_name||'—')+'</div>' +
              '<div class="ft-result__meta">'+esc(name)+(c.phone?' · <a href="tel:'+esc(c.phone)+'" style="color:var(--color-accent);">'+esc(c.phone)+'</a>':'')+(c.last_call_outcome?' · <b>'+esc(c.last_call_outcome)+'</b>':'')+'</div>' +
              '<div class="ft-result__actions">' +
                '<button class="action-btn action-btn--sm ft-load-btn" data-i="'+i+'" style="color:var(--color-accent);border-color:var(--color-accent);">🎯 Load</button>' +
                '<button class="action-btn action-btn--sm ft-queue-btn" data-i="'+i+'">➕ Queue</button>' +
                '<a href="'+hubURL+'" target="_blank" class="action-btn action-btn--sm">HubSpot</a>' +
                (c.phone?'<a href="tel:'+esc(c.phone)+'" class="action-btn action-btn--sm" style="color:#22c55e;border-color:#22c55e;">Call</a>':'') +
              '</div>' +
            '</div>';
          }).join('');
          const found = data.contacts;
          results.querySelectorAll('.ft-load-btn').forEach(function(b) {
            b.addEventListener('click', function() { if (Shell && Shell.loadNow) Shell.loadNow(found[+b.dataset.i]); });
          });
          results.querySelectorAll('.ft-queue-btn').forEach(function(b) {
            b.addEventListener('click', function() {
              if (Shell && Shell.addToQueue) { Shell.addToQueue(found[+b.dataset.i]); b.textContent = '✓ Queued'; b.disabled = true; }
            });
          });
        } catch(e) {
          results.innerHTML = '<div style="color:#ef4444;font-size:0.8rem;">Search failed — deploy worker</div>';
        }
      }

      input.addEventListener('input', () => { clearTimeout(debounce); if (input.value.trim().length >= 2) debounce = setTimeout(doSearch, 400); });
      document.getElementById('ft-lookup-btn').addEventListener('click', doSearch);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    }

    // EMAIL — template launcher
    function renderEmail() {
      const Shell = window.CockpitShell;
      const contact = (Shell && Shell.getContact ? Shell.getContact() : null) || {};
      const rep = Shell && Shell._currentRep ? Shell._currentRep() : {};
      const repPhone = rep.phone || '(515) 344-4053';
      const repSig = rep.signature || ('\u2014 ' + (rep.display_name || 'Ricky') + ', UNC');
      const repStripe = rep.stripe_link || 'https://buy.stripe.com/eVq5kD3Rq37vfSzbhJ6sw0N';
      const repBookingUrl = rep.booking_url || 'https://urbannicheco.com/audit';
      const TMPLS = [
        { id:'audit', name:'Website Audit \u2014 Same Day', tag:'Cold Follow-Up', subject:'Your site audit + proposal \u2014 {biz}', body:'Hey {first},\n\nSent over the audit and proposal. The issues I flagged are fixable in about two weeks.\n\nKitsch Tree Service link is in there so you can see the work firsthand.\n\nQuestions? {rep_phone}.\n\n{rep_sig}' },
        { id:'d3', name:'Follow-Up \u2014 Day 3', tag:'Cold Follow-Up', subject:'Still worth a look \u2014 {biz}', body:'Hey {first},\n\nCircling back on the proposal. Ranking top 3 statewide for contractor SEO in Iowa on pages less than a month old. Contractors getting sites built now are getting ahead.\n\nNo pressure \u2014 just making sure you saw it.\n\n{rep_phone}\n\n{rep_sig}' },
        { id:'d7', name:'Follow-Up \u2014 Day 7', tag:'Cold Follow-Up', subject:'Last follow-up \u2014 {biz}', body:'Hey {first},\n\nLast one, promise. If timing is not right, totally get it. If you know another contractor who needs this \u2014 I would appreciate the intro.\n\n{rep_sig}' },
        { id:'hot', name:'HOT Lead Proposal', tag:'Proposal', subject:'Your website proposal \u2014 {biz}', body:'Hey {first},\n\nGreat talking with you. Here is the proposal.\n\nPay $1,500 deposit to get started:\n{rep_stripe}\n\nOnce the deposit lands I will send the intake form. 14 days from assets received, you are live.\n\n{rep_sig}\nurbannicheco.com' },
        { id:'intake', name:'Intake Form', tag:'Onboarding', subject:'Your intake form \u2014 {biz} website build', body:'Hey {first},\n\nDeposit received. Fill this out \u2014 10 minutes. 14-day clock starts when I have everything.\n\nhttps://urbannicheco.com/client-intake/\n\n{rep_sig}' },
        { id:'disco', name:'Discovery Call Confirm', tag:'Discovery', subject:'Confirmed: Discovery Call \u2014 {biz}', body:'Hey {first},\n\nConfirming our discovery call. We will cover your online presence, biggest gaps, and whether there is a fit. No sales pressure.\n\nSee you then.\n\n{rep_sig}\n{rep_phone}' }
      ];

      let selected = TMPLS[0];
      const first = contact.first_name && !/unknown|likely|owner/i.test(contact.first_name) ? contact.first_name : 'there';
      const biz   = contact.business_name || '';
      const email = contact.email || '';

      function interp(s) {
        return s
          .replace(/\{first\}/g, first)
          .replace(/\{biz\}/g, biz)
          .replace(/\{rep_phone\}/g, repPhone)
          .replace(/\{rep_sig\}/g, repSig)
          .replace(/\{rep_stripe\}/g, repStripe)
          .replace(/\{rep_booking_url\}/g, repBookingUrl);
      }

      function render() {
        body().innerHTML =
          '<div style="margin-bottom:0.6rem;">' +
            TMPLS.map(t =>
              '<div class="ft-tmpl'+(t.id===selected.id?' selected':'')+'" data-id="'+t.id+'">' +
                '<div class="ft-tmpl__name">'+esc(t.name)+'</div>' +
                '<div class="ft-tmpl__tag">'+esc(t.tag)+'</div>' +
              '</div>'
            ).join('') +
          '</div>' +
          '<div style="font-size:0.72rem;color:var(--color-white-dim);margin-bottom:0.3rem;">To:</div>' +
          '<input id="ft-email-to" type="email" placeholder="prospect@email.com" value="'+esc(email)+'" style="width:100%;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-white);font-size:0.82rem;padding:0.45rem 0.65rem;outline:none;margin-bottom:0.6rem;box-sizing:border-box;">' +
          '<button class="action-btn action-btn--primary" id="ft-email-launch" style="width:100%;margin-bottom:0.4rem;">Open in Gmail</button>';

        body().querySelectorAll('.ft-tmpl').forEach(el => {
          el.addEventListener('click', () => {
            selected = TMPLS.find(t => t.id === el.dataset.id);
            render();
          });
        });
        document.getElementById('ft-email-launch').addEventListener('click', () => {
          const to = document.getElementById('ft-email-to').value.trim();
          if (!to) { alert('Enter an email address.'); return; }
          const sub = encodeURIComponent(interp(selected.subject));
          const bod = encodeURIComponent(interp(selected.body));
          window.open('https://mail.google.com/mail/?view=cm&to='+encodeURIComponent(to)+'&su='+sub+'&body='+bod, '_blank');
        });
      }
      render();
    }

    // PRICING — click service to add to calc
    function renderPricing() {
      const BUNDLES = [
        { name:'Local Authority',  price:2800, once:false },
        { name:'Market Growth', price:4500, once:false, star:true },
        { name:'Total Domination', price:7500, once:false }
      ];
      const SERVICES = [
        { name:'SEO Foundation',            price:1500, once:false },
        { name:'SEO Growth',                price:2500, once:false },
        { name:'SEO Domination',            price:3500, once:false },
        { name:'GBP Setup',                 price:250,  once:true  },
        { name:'GBP Authority',             price:500,  once:false },
        { name:'Reputation Foundation',     price:400,  once:false },
        { name:'Reputation Authority',      price:750,  once:false },
        { name:'Content Pack Starter',      price:400,  once:false },
        { name:'Content Pack Growth',       price:700,  once:false },
        { name:'Content Pack Authority',    price:1200, once:false },
        { name:'Email Foundation',          price:500,  once:false },
        { name:'Email Authority',           price:1000, once:false },
        { name:'PPC Standard',              price:1200, once:false },
        { name:'PPC Power',                 price:2000, once:false },
        { name:'PPC Dynamic',               price:3500, once:false },
        { name:'AI Lead Capture Smart',     price:750,  once:false },
        { name:'AI Lead Capture Full Stack',price:1500, once:false },
        { name:'AI Consulting Hour',        price:500,  once:true  },
        { name:'Website Landing',           price:1000, once:true  },
        { name:'Website HTML Starter',      price:3000, once:true  },
        { name:'Website HTML Standard',     price:5500, once:true  },
        { name:'Website HTML Advanced',     price:8500, once:true  }
      ];

      let selectedItems = []; // accumulates clicked services

      function rowHTML(item, isSvc) {
        return '<div class="ft-price-row" style="cursor:pointer;" data-price="'+item.price+'" data-name="'+esc(item.name)+'" data-once="'+(item.once?'1':'0')+'" title="Click to add to quote">'+
          '<span>'+(item.star?'⭐ ':'')+esc(item.name)+'</span>'+
          '<span class="ft-price-val">$'+item.price.toLocaleString()+(item.once?'':'/mo')+' <span style="font-size:0.65rem;opacity:0.5;">+ add</span></span>'+
        '</div>';
      }

      const RATES = { '0.30':'Y1 30%', '0.10':'Y2 10%', '0.25':'Project 25%', '0.50':'Merch 50%' };

      function rateSelect(idx, currentRate) {
        return '<select class="ft-rate-sel" data-idx="'+idx+'" style="background:var(--color-dark-3);border:1px solid var(--color-border);border-radius:3px;color:var(--color-white);font-size:0.7rem;padding:0.15rem 0.3rem;outline:none;cursor:pointer;">'+
          Object.keys(RATES).map(v=>'<option value="'+v+'"'+(v===currentRate?' selected':'')+'>'+RATES[v]+'</option>').join('')+
        '</select>';
      }

      function renderCalc() {
        const total = selectedItems.reduce((s,i)=>s+i.price, 0);
        const totalComm = selectedItems.reduce((s,i)=>s+(i.price*(parseFloat(i.rate)||0.30)), 0);
        const listEl = document.getElementById('ft-selected-list');
        if (listEl) {
          listEl.innerHTML = selectedItems.length
            ? selectedItems.map((item,i)=>
                '<div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:0.4rem;padding:0.35rem 0.5rem;background:rgba(232,101,26,0.08);border-radius:4px;margin-bottom:3px;">'+
                  '<span style="font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(item.name)+'</span>'+
                  '<span style="display:flex;align-items:center;gap:0.3rem;">'+
                    rateSelect(i, item.rate || '0.30')+
                    '<span style="color:#22c55e;font-weight:700;font-size:0.78rem;min-width:48px;text-align:right;">$'+(item.price*(parseFloat(item.rate)||0.30)).toFixed(0)+'</span>'+
                  '</span>'+
                  '<button data-remove="'+i+'" style="background:none;border:none;color:#555;cursor:pointer;font-size:0.9rem;line-height:1;padding:0 0 0 2px;">&times;</button>'+
                '</div>'
              ).join('')
            : '<div style="font-size:0.78rem;color:var(--color-white-dim);padding:0.3rem 0;">No services added — click any row above</div>';

          listEl.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', e => {
              e.stopPropagation();
              selectedItems.splice(parseInt(btn.dataset.remove), 1);
              renderCalc();
            });
          });
          listEl.querySelectorAll('.ft-rate-sel').forEach(sel => {
            sel.addEventListener('change', e => {
              e.stopPropagation();
              selectedItems[parseInt(sel.dataset.idx)].rate = sel.value;
              renderCalc();
            });
          });
        }
        const totalEl = document.getElementById('ft-calc-total');
        const commEl  = document.getElementById('ft-calc-comm');
        if (totalEl) totalEl.textContent = total > 0 ? '$'+total.toLocaleString()+'/mo' : '—';
        if (commEl)  commEl.textContent  = total > 0 ? '$'+totalComm.toFixed(0) : '—';
      }

      body().innerHTML =
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.5rem;">Bundles</div>' +
        BUNDLES.map(b=>rowHTML(b,false)).join('') +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin:0.75rem 0 0.5rem;">Services</div>' +
        SERVICES.map(s=>rowHTML(s,true)).join('') +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin:0.75rem 0 0.4rem;">Quote Builder</div>' +
        '<div id="ft-selected-list" style="margin-bottom:0.5rem;"></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;">' +
          '<button id="ft-calc-clear" style="background:none;border:1px solid var(--color-border);color:var(--color-white-dim);font-size:0.72rem;padding:0.35rem 0.75rem;border-radius:var(--radius-sm);cursor:pointer;">Clear all</button>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;">' +
          '<div style="flex:1;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;font-size:0.82rem;color:var(--color-white-dim);">Total: <span id="ft-calc-total" style="color:var(--color-white);font-weight:700;">—</span></div>' +
          '<div style="flex:1;background:var(--color-dark-2);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;font-size:0.82rem;color:var(--color-white-dim);">Your cut: <span id="ft-calc-comm" style="color:#22c55e;font-weight:700;">—</span></div>' +
        '</div>';

      renderCalc();

      // Rate is per-item — no global rate listener needed
      document.getElementById('ft-calc-clear').addEventListener('click', () => {
        selectedItems = [];
        // Deselect all rows
        body().querySelectorAll('.ft-price-row[data-price]').forEach(r => r.style.background = '');
        renderCalc();
      });

      // Click any row to ADD to quote
      body().querySelectorAll('.ft-price-row[data-price]').forEach(row => {
        row.addEventListener('click', () => {
          const price = parseInt(row.dataset.price);
          const name  = row.dataset.name;
          const isOnce = row.dataset.once === '1';
          // Bundles are exclusive — if clicking a bundle, replace any existing bundle
          const isBundle = BUNDLES.some(b => b.name === name);
          if (isBundle) {
            selectedItems = selectedItems.filter(i => !BUNDLES.some(b => b.name === i.name));
          }
          // Don't add duplicates
          if (!selectedItems.find(i => i.name === name)) {
            selectedItems.push({ name, price, once: isOnce, rate: isOnce ? '0.25' : '0.30' });
            row.style.background = 'rgba(232,101,26,0.12)';
            row.style.borderLeft = '2px solid var(--color-accent)';
          } else {
            // Click again to remove
            selectedItems = selectedItems.filter(i => i.name !== name);
            row.style.background = '';
            row.style.borderLeft = '';
          }
          if (isOnce && selectedItems[selectedItems.length-1]) selectedItems[selectedItems.length-1].rate = '0.25';
          renderCalc();
          document.getElementById('ft-selected-list').scrollIntoView({ behavior:'smooth', block:'nearest' });
        });
      });
    }

    // VOICEMAIL — hardcoded scripts (parsing HTML is fragile)
    async function renderVoicemail() {
      if (!_cache.vms) {
        _cache.vms = [
          { cat:'Cold Call', title:'Standard VM', meta:'15 sec', script:'Hey {name}, this is {rep_name} from Urban Niche Co. I won\'t leave a long voicemail \u2014 I\'ll text you the 30-second reason for the call instead. Watch for a text from {rep_phone}. Talk soon.' },
          { cat:'Cold Call', title:'Direct VM', meta:'12 sec', script:'Hey {name}, {rep_name} at Urban Niche Co. \u2014 I looked at {business}\'s website before I called and noticed something specific. Text me back at {rep_phone} if you want to hear what I found.' },
          { cat:'Cold Call', title:'Curiosity Hook', meta:'18 sec', script:'Hey {name}, this is {rep_name} from Urban Niche Co. I work exclusively with contractors and I found something on your Google presence that\'s costing you jobs. I\'ll text you the details \u2014 {rep_phone}.' },
          { cat:'Follow-Up', title:'Proposal Follow-Up', meta:'15 sec', script:'Hey {name}, {rep_name} from Urban Niche Co. \u2014 just following up on the proposal I sent over. Quick question if you have 2 minutes. Call or text me at {rep_phone} when you get a chance.' },
          { cat:'Follow-Up', title:'Day 7 Final', meta:'12 sec', script:'Hey {name}, {rep_name} at Urban Niche Co. Last follow-up, I promise. If the timing isn\'t right I completely understand. {rep_phone} whenever you\'re ready.' },
          { cat:'Win-Back', title:'Re-Engage', meta:'15 sec', script:'Hey {name}, {rep_name} from Urban Niche Co. — we worked together before and I\'d love to reconnect. Things may have changed — text me at {rep_phone} if you\'re open to a quick conversation.' }
        ];
      }

      const vms = _cache.vms;
      function interp(s) {
        const contact = (window.CockpitShell && window.CockpitShell.getContact ? window.CockpitShell.getContact() : null) || {};
        const rep = (window.CockpitShell && window.CockpitShell._currentRep ? window.CockpitShell._currentRep() : {});
        if (!s) return '';
        return s.replace(/\{(\w+)\}/g, (m,k) => (contact[k] || rep[k] || m));
      }

      // Group by category
      const cats = [...new Set(vms.map(v => v.cat))];
      body().innerHTML = cats.map(cat => {
        const items = vms.filter(v => v.cat === cat);
        return '<div style="margin-bottom:0.75rem;">' +
          '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.4rem;">' + esc(cat) + '</div>' +
          items.map(vm =>
            '<div class="ft-obj-item" style="margin-bottom:0.5rem;">' +
              '<div class="ft-obj-label" style="display:flex;justify-content:space-between;">' +
                '<span>' + esc(vm.title) + '</span>' +
                '<span style="opacity:0.5;font-weight:400;">' + esc(vm.meta) + '</span>' +
              '</div>' +
              '<div class="ft-obj-script" title="Click to copy" data-text="' + esc(interp(vm.script)) + '">' + esc(interp(vm.script)) + '</div>' +
            '</div>'
          ).join('') +
        '</div>';
      }).join('');

      body().querySelectorAll('.ft-obj-script').forEach(el => {
        el.addEventListener('click', () => {
          navigator.clipboard.writeText(el.dataset.text).catch(() => {});
          const orig = el.style.color;
          el.style.color = '#22c55e';
          setTimeout(() => el.style.color = orig, 800);
        });
      });
    }

    // TRADE — trade-specific intel
    async function renderTrade() {
      const contact = (window.CockpitShell && window.CockpitShell.getContact ? window.CockpitShell.getContact() : null) || {};
      const trade = contact.trade || contact.trade_lower || '';

      const TRADE_INTEL = {
        roofing:   { icon:'🏠', pain:'Seasonality + insurance jobs. Ask about storm damage pipeline and referral network.' },
        hvac:      { icon:'❄️', pain:'Peak season Aug/Sep and Dec/Jan. Most shops live on service calls, not installs.' },
        plumbing:  { icon:'🔧', pain:'Emergency calls drive 60% of revenue. Reviews on Google Maps = booking engine.' },
        electrical:{ icon:'⚡', pain:'Commercial jobs require online credibility. Residential is referral-heavy.' },
        landscaping:{ icon:'🌿', pain:'Spring/summer rush. Upsell snow removal in fall. Seasonal content = year-round leads.' },
        'general contractor': { icon:'🏗️', pain:'Project-based. Website is the pitch deck. Photos + testimonials close jobs.' },
        remodeling:{ icon:'🪟', pain:'High ticket, longer sales cycle. Houzz + Google reviews drive 80% of leads.' },
        painting:  { icon:'🖌️', pain:'Highly commoditized. Speed + reviews are the differentiators. 3-bid buyers.' },
        insulation:{ icon:'🧱', pain:'Energy rebate season drives demand. SEO terms include "energy audit" and "rebates".' },
        flooring:  { icon:'🪵', pain:'Showroom or shop-at-home model. Before/after content converts hard.' },
        'pest control': { icon:'🐛', pain:'Recurring service = recurring revenue. Review velocity and local SEO are everything.' },
        'pressure washing': { icon:'🚿', pain:'Low barrier entry. Differentiate on reviews, speed, and before/after photos.' },
        'tree service': { icon:'🌳', pain:'Emergency storm removal = biggest margin job. SEO + GBP for "emergency tree removal near me".' }
      };

      const key = trade.toLowerCase();
      const intel = TRADE_INTEL[key] || null;

      if (!intel && !trade) {
        body().innerHTML = '<div style="color:var(--color-white-dim);font-size:0.82rem;">No trade set on current contact — load a prospect first.</div>';
        return;
      }

      if (!intel) {
        body().innerHTML = '<div style="font-size:0.82rem;color:var(--color-white-dim);">No intel for trade: <b style="color:var(--color-white);">' + esc(trade) + '</b></div>';
        return;
      }

      body().innerHTML =
        '<div style="font-size:1.5rem;margin-bottom:0.4rem;">' + intel.icon + ' ' + esc(trade.charAt(0).toUpperCase() + trade.slice(1)) + '</div>' +
        '<div style="font-size:0.82rem;line-height:1.5;color:var(--color-white-dim);">' + esc(intel.pain) + '</div>';
    }

  }; // end Shell._injectFloatingToolbar

  // ── POSTMESSAGE LISTENER — workspace → cockpit prospect injection ──────────
  // Receives UNC_LOAD_PROSPECT (single) and UNC_LOAD_QUEUE (batch) from parent.
  window.addEventListener('message', function(ev) {
    if (ev.origin !== location.origin) return;
    var msg = ev.data;
    if (!msg || typeof msg !== 'object') return;

    // ── Single prospect: search result → dial now ──────────────────────────
    if (msg.type === 'UNC_LOAD_PROSPECT') {
      var raw = msg.prospect || {};
      var np = {
        id:                   raw.id || raw.contact_id || '',
        contact_id:           raw.contact_id || raw.id || '',
        first_name:           raw.first_name            || '',
        last_name:            raw.last_name             || '',
        business_name:        raw.business_name         || '',
        phone:                raw.phone                 || '',
        email:                raw.email                 || '',
        website:              raw.website               || '',
        trade:                raw.trade || raw.trade_type || '',
        city:                 raw.city                  || '',
        state:                raw.state                 || '',
        ai_hook:              raw.ai_hook               || '',
        quick_win:            raw.quick_win             || '',
        gbp_review_count:     raw.gbp_review_count      || '',
        website_gaps:         raw.website_gaps          || '',
        decision_maker_known: raw.decision_maker_known  || '',
        best_phone_verified:  raw.best_phone_verified   || '',
        last_call_outcome:    raw.last_call_outcome      || '',
        pipeline_stage:       raw.pipeline_stage         || ''
      };
      // Queue-PRESERVING load: append (or find) in the active queue and jump to it.
      // Never nukes the rest of the queue — reps build their list as they work.
      Shell.loadNow(raw); // dispatches unc:queue-injected with the full queue + index
      return;
    }

    // ── Append to queue WITHOUT switching the active prospect ──────────────
    if (msg.type === 'UNC_ADD_TO_QUEUE') {
      Shell.addToQueue(msg.prospect || {});
      return;
    }

    // ── Batch queue: HubSpot /queue endpoint → replace dial queue ─────────
    if (msg.type === 'UNC_LOAD_QUEUE') {
      var raw_list = Array.isArray(msg.prospects) ? msg.prospects : [];
      if (!raw_list.length) {
        toast('No prospects returned — try a different count or check HubSpot', 'error');
        return;
      }
      var normalized = raw_list.map(function(r) {
        return {
          contact_id:           r.contact_id || r.id || '',
          first_name:           r.first_name            || '',
          last_name:            r.last_name             || '',
          business_name:        r.business_name         || '',
          phone:                r.phone                 || '',
          email:                r.email                 || '',
          website:              r.website               || '',
          trade:                r.trade || r.trade_type || '',
          city:                 r.city                  || '',
          state:                r.state                 || '',
          ai_hook:              r.ai_hook               || '',
          quick_win:            r.quick_win             || '',
          gbp_review_count:     r.gbp_review_count      || '',
          website_gaps:         r.website_gaps          || '',
          decision_maker_known: r.decision_maker_known  || '',
          best_phone_verified:  r.best_phone_verified   || '',
          last_call_outcome:    r.last_call_outcome      || '',
          last_touched:         r.last_touched           || '',
          pipeline_stage:       r.pipeline_stage         || ''
        };
      });
      Queue.data  = { prospects: normalized, _session_cap: normalized.length, _source: 'live' };
      Queue.index = 0;
      Shell.setContact(null); // clear single-contact so queue path renders
      Shell._renderProspectCard();
      toast(normalized.length + ' prospects loaded into dial queue');
      // Signal content.js scripts to update their liveQueue with the full batch
      window.dispatchEvent(new CustomEvent('unc:queue-injected', { detail: { prospects: normalized, index: 0 } }));
      return;
    }
  });

  // ── GLOBAL EXPORT ──────────────────────────────────────────────────────────
  window.CockpitShell = Shell;

})();
