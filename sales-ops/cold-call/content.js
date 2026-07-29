/* ===================================================================
   UNC SALES COCKPIT — Cold Call Content Logic
   v2.0 — 2026-05-12
   Screen state machine. Loads scripts.json. Hands outcomes to Shell.

   V2 adds:
   - Trade-aware Q2 surfacing (reads contact.trade)
   - Token interpolation for {first_name}, {business_name}, {trade_lower}, {city}
   - Variant auto-assign mode (round-robin via Shell.autoAssignVariant)
   - Section 02 replaced with real trade_q2 screen
   =================================================================== */

(function() {
  'use strict';

  // Sound must never block navigation. If CockpitAudio isn't wired, click silently.
  function playClick(kind){ try { var a = window.CockpitAudio; if (a && typeof a.play === 'function') a.play(kind || 'click'); } catch (_) {} }

  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  let trainMode = false;
  const stage = () => document.querySelector('#screen-stage');

  // ============================================================
  // MODULE-LEVEL CONSTANTS — single source of truth
  // Both renderLiveCard() and renderDialPreview() read from here.
  // Update in one place, both surfaces stay in sync.
  // ============================================================

  const TRADE_WINDOWS = {
    'HVAC':               '☀ Best: 7–9 AM or after 4 PM',
    'Roofer':             '☀ Best: 7:30–9 AM or 12–1 PM',
    'Plumber':            '☀ Best: 7–8:30 AM',
    'Electrician':        '☀ Best: 7–9 AM',
    'Landscaper':         '☀ Best: 6:30–8 AM or after 5 PM',
    'General Contractor': '☀ Best: 7–9 AM',
    'Painter':            '☀ Best: 7–8:30 AM',
    'Concrete':           '☀ Best: 6:30–8 AM',
    'Remodeler':          '☀ Best: 8–10 AM',
    'Tree Service':       '☀ Best: 7–8:30 AM',
    'Pressure Washing':   '☀ Best: 7–9 AM',
    'Flooring':           '☀ Best: 8–10 AM',
    'Insulation':         '☀ Best: 7–9 AM',
    'Pest Control':       '☀ Best: 8–10 AM',
    'Masonry':            '☀ Best: 6:30–8 AM',
  };

  const TRADE_INTEL = {
    'Roofer':             { win:'Check GBP reviews -- most roofers under 20 reviews, ranking below storm-chaser agencies', hook:'Storm-chaser agencies are outranking you in your own market. Want me to show you?', dm:'Owner (spouse involved on large residential)' },
    'HVAC':               { win:'Most HVAC sites have no off-season content -- invisible when it is not peak season', hook:'When it hits 95 degrees next month, who shows up first on Google -- you or the chain?', dm:'Owner or ops manager' },
    'Plumber':            { win:'Check GBP for 24/7 badge and emergency keywords -- most plumbers missing both', hook:'When a basement floods at 11 PM in their city, are they the first call?', dm:'Owner' },
    'Electrician':        { win:'Commercial bid terms almost never SEO-targeted -- huge gap most electricians ignore', hook:'Getting commercial RFPs through your website, or just the same 5 GCs calling you?', dm:'Owner (project manager on commercial)' },
    'Landscaper':         { win:'Before/after Instagram almost always weak -- highest visual-to-conversion trade', hook:'Your work looks 10x better in person than on your website. Want to fix that?', dm:'Owner' },
    'Painter':            { win:'100+ painters in most markets, almost none doing real marketing -- wide open', hook:'100 painters in their city -- none are doing real marketing. That is the opening.', dm:'Owner' },
    'General Contractor': { win:'Project gallery is almost always weak or missing -- portfolio does the closing', hook:'GC cycles run 60-90 days. Are you staying top of mind in that window?', dm:'Owner (spouse often co-DM on residential)' },
    'Concrete':           { win:'Reviews are the deciding factor -- most concrete contractors have under 30', hook:'Driveways are a 2-week decision. Are you in the first 3 names they call?', dm:'Owner' },
    'Remodeler':          { win:'Long sales cycle dies in the middle from zero nurture -- email sequence gap', hook:'Most remodeler sites lose the sale before the form fills. Want to see your conversion rate?', dm:'Owner and spouse usually co-DM' },
    'Tree Service':       { win:'Storm-day calls go unanswered at most tree services -- no emergency landing page', hook:'When a tree comes down at 2 AM in their city, are they the first call?', dm:'Owner' },
    'Pressure Washing':   { win:'No Instagram presence -- the highest visual-to-conversion trade wasting its edge', hook:'Pressure washing is 100% visual. If Instagram is not on point you are losing in 3 seconds.', dm:'Owner' },
    'Flooring':           { win:'Room-by-room SEO almost never done -- kitchen flooring, bathroom flooring pages missing', hook:'You are the 4th quote they got. What makes you the one they call back?', dm:'Owner' },
    'Insulation':         { win:'Rebate-season search intent almost never targeted -- massive untapped traffic', hook:'Rebate season drives 60% of insulation jobs. Are you capturing that traffic?', dm:'Owner' },
    'Pest Control':       { win:'Seasonal ad calendar almost never set up -- one-size-fits-all PPC burns budget', hook:'Mice in fall, ants in spring, mosquitoes in summer. Are your ads firing for the right pest?', dm:'Owner or office manager' },
    'Masonry':            { win:'Portfolio scattered on FB posts -- no SEO, no Houzz, no real site presence', hook:'Your brick work is incredible. Nobody can find it online. Want to fix that?', dm:'Owner' },
  };
  const TRADE_INTEL_DEFAULT = { win:'GBP is almost always under-leveraged -- reviews, photos, posts all weak', hook:'Quick gut check -- when somebody Googles what you do, are you on page one?', dm:'Owner typically' };

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  async function boot() {
    try {
      const r = await fetch('/sales-ops/cold-call/scripts.json', { cache: 'no-cache' });
      scripts = await r.json();
    } catch(e) {
      console.error('[cold-call] scripts.json load failed', e);
      stage().innerHTML = '<div class="script-panel"><div class="script-panel__line">Scripts failed to load. Check console.</div></div>';
      return;
    }
    await Shell.init({ cockpit: 'cold-call' });
    Shell.bindNotes();
    Shell.onReset(renderStart);
    Shell.onBack(goBack);
    // Register live queue advance hook so shell can trigger it after outcome
    window._liveAdvance = function(outcomeCode) {
      if (liveQueue.length) advanceAfterOutcome(outcomeCode);
    };
    trainMode = localStorage.getItem('unc_train_mode') === 'true';
    injectTrainToggle();
    renderStart();
  }

  // ============================================================
  // TRAINING MODE TOGGLE
  // ============================================================
  function injectTrainToggle() {
    const hud = document.querySelector('.hud__center');
    if (!hud || document.getElementById('train-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'train-toggle';
    btn.className = 'variant-mode-btn';
    btn.title = 'Toggle Training Mode — shows coaching notes under script lines';
    btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
    btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    btn.addEventListener('click', () => {
      trainMode = !trainMode;
      localStorage.setItem('unc_train_mode', trainMode);
      btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
      btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    });
    hud.appendChild(btn);
  }

  function trainingNote(text) {
    // Always-on: notes live in the right-column coach rail now, never in the script's way.
    if (!text) return '';
    return `<div class="coach-note">📘 ${text}</div>`;
  }

  // ============================================================
  // CONTACT NOTE PERSISTENCE — localStorage-backed, 30-day TTL
  // ============================================================
  const NOTE_PREFIX = 'unc_contact_note_';
  const NOTE_TTL_DAYS = 30;

  function saveContactNote(contactId, text) {
    if (!contactId) return;
    try {
      const entry = { text: text, saved_at: new Date().toISOString() };
      localStorage.setItem(NOTE_PREFIX + contactId, JSON.stringify(entry));
    } catch(e) {}
  }

  function loadContactNote(contactId) {
    if (!contactId) return '';
    try {
      const raw = localStorage.getItem(NOTE_PREFIX + contactId);
      if (!raw) return '';
      const entry = JSON.parse(raw);
      // TTL check
      if (entry.saved_at) {
        const ageDays = (Date.now() - new Date(entry.saved_at).getTime()) / 86400000;
        if (ageDays > NOTE_TTL_DAYS) { localStorage.removeItem(NOTE_PREFIX + contactId); return ''; }
      }
      return entry.text || '';
    } catch(e) { return ''; }
  }

  function pruneOldNotes() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NOTE_PREFIX)) keys.push(k);
      }
      keys.forEach(k => {
        try {
          const entry = JSON.parse(localStorage.getItem(k));
          if (entry && entry.saved_at) {
            const ageDays = (Date.now() - new Date(entry.saved_at).getTime()) / 86400000;
            if (ageDays > NOTE_TTL_DAYS) localStorage.removeItem(k);
          }
        } catch(e) {}
      });
    } catch(e) {}
  }
  pruneOldNotes(); // run once on cockpit load

    // ============================================================
  // TOKEN INTERPOLATION
  // ============================================================
  function tokens() {
    const c = Shell.getContact() || {};
    const rep = Shell.getRep ? Shell.getRep() : {};
    const trade = c.trade || 'Unknown';
    const tradeBlock = (scripts.trade_q2 && (scripts.trade_q2[trade] || scripts.trade_q2.Unknown)) || {};
    return {
      first_name: (c.first_name && !/unknown|likely|owner/i.test(c.first_name)) ? c.first_name : '',
      business_name: c.business_name || 'your business',
      rep_name: rep.display_name || 'Ricky',
      trade: trade,
      trade_lower: (trade || 'contractor').toLowerCase(),
      city: c.city || 'your area',
      ai_hook: c.ai_hook || '',
      quick_win: c.quick_win || c.ai_hook || c.notes_preview || 'a gap in your online presence',
      trade_q2_line: (tradeBlock.q2_line || 'something specific about your online presence').replace(/\{(first_name|business_name|trade|trade_lower|city)\}/g, (m, k) => {
        const innerC = Shell.getContact() || {};
        if (k === 'first_name') return innerC.first_name || 'there';
        if (k === 'business_name') return innerC.business_name || 'your business';
        if (k === 'trade') return innerC.trade || 'contractor';
        if (k === 'trade_lower') return (innerC.trade || 'contractor').toLowerCase();
        if (k === 'city') return innerC.city || 'your area';
        return m;
      })
    };
  }

  function interpolate(str) {
    if (!str) return '';
    const t = tokens();
    let result = str.replace(/\{(first_name|business_name|rep_name|trade|trade_lower|city|trade_q2_line|quick_win|ai_hook)\}/g, (m, k) => t[k] != null ? t[k] : m);
    // Clean whitespace; only strip "Hey —" opener when first_name resolved empty
    result = result.replace(/\s{2,}/g, ' ').replace(/\s+—/g, ' —');
    if (!t.first_name) result = result.replace(/Hey —/g, 'Hey');
    result = result.trim();
    return result;
  }

  function tokenizeHTML(str) {
    if (!str) return '';
    const interp = interpolate(str);
    return interp.replace(/\{[^}]+\}/g, m => `<span class="script-panel__token">${m}</span>`);
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function goTo(screenId, opts) {
    const renderer = SCREENS[screenId];
    if (!renderer) { console.error('[cold-call] Unknown screen:', screenId); return; }
    if (!opts || !opts.isBack) {
      const current = stage().getAttribute('data-screen');
      if (current && current !== 'start') history.push(current);
    }
    Shell.hideOutcomes();
    stage().setAttribute('data-screen', screenId);
    renderer(opts || {});
  }

  function goBack() {
    if (!history.length) {
      renderStart();
      // Re-render prospect card if we have a live contact loaded
      if (liveQueue.length && liveQueue[liveIndex]) renderLiveCard(liveQueue[liveIndex]);
      return;
    }
    const prev = history.pop();
    goTo(prev, { isBack: true });
    // Re-render prospect card on any back navigation
    if (liveQueue.length && liveQueue[liveIndex]) renderLiveCard(liveQueue[liveIndex]);
  }

  function renderScreen(content) {
    const s = stage();
    s.classList.remove('active'); void s.offsetWidth;
    s.innerHTML = content;
    s.classList.add('screen', 'active');
  }

  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += String(values[i]) + strings[i + 1];
    return out;
  }

  function renderNotesBlock() {
    return html`
      <div class="notes">
        <div class="notes__header">
          <span>Call notes</span>
          <span>Saved per contact · synced via Cowork batch</span>
        </div>
        <textarea id="call-notes-stub" class="notes__textarea"
          placeholder="What did they say? Brother handles marketing? Off-season? Drop the 1-liner here — saves per contact as you type."></textarea>
        <div class="notes__meta">
          <span>Press Tab to focus · Esc to leave</span>
          <span><span id="notes-char-count">0</span> chars</span>
        </div>
      </div>
    `;
  }

  // Per-contact wiring for the main Call Notes box. Replaces the old
  // separate "pre-dial note" textarea — one box, remembers per contact,
  // and Shell.getNotes() still reads it when an outcome is logged.
  function syncCallNotesToContact(contactId) {
    const el = document.getElementById('call-notes');
    if (!el || !contactId) return;
    el._noteContactId = contactId;
    el.value = loadContactNote(contactId) || '';
    const cc = document.getElementById('notes-char-count');
    if (cc) cc.textContent = el.value.length;
    if (!el._contactBound) {
      el._contactBound = true;
      el.addEventListener('input', function() {
        if (el._noteContactId) saveContactNote(el._noteContactId, el.value);
      });
    }
  }

  // ============================================================
  // SCREENS
  // ============================================================
  const SCREENS = {};

  // -------- START --------
  // Live queue + session state
  let liveQueue  = [];
  let liveIndex  = 0;
  let sessionDialCount = 0;
  let sessionHot  = 0;
  let sessionWarm = 0;
  let sessionStreak = 0;
  let dailyGoal = null; // set by goal modal

  // ── Daily goal helpers ────────────────────────────────────────
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function repKey() {
    // Get current rep ID from Shell — falls back to 'unknown' so keys never collide
    try { return (Shell._currentRep && Shell._currentRep().id) || 'unknown'; } catch(e) { return 'unknown'; }
  }

  function getStoredGoal() {
    try {
      const raw = localStorage.getItem('unc_daily_goal_' + repKey());
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj.date === todayKey() ? obj.goal : null;
    } catch(e) { return null; }
  }

  function storeGoal(n) {
    localStorage.setItem('unc_daily_goal_' + repKey(), JSON.stringify({ date: todayKey(), goal: n }));
    dailyGoal = n;
  }

  function getDialsToday() {
    try {
      const raw = localStorage.getItem('unc_dials_today_' + repKey());
      if (!raw) return 0;
      const obj = JSON.parse(raw);
      return obj.date === todayKey() ? (obj.count || 0) : 0;
    } catch(e) { return 0; }
  }

  function bumpDialsToday() {
    const current = getDialsToday();
    localStorage.setItem('unc_dials_today_' + repKey(), JSON.stringify({ date: todayKey(), count: current + 1 }));
  }

  // ── Goal modal ────────────────────────────────────────────────
  function showGoalModal(repDialTarget, onComplete) {
    const existing = document.getElementById('goal-modal');
    if (existing) existing.remove();

    const suggestions = [5, 10, 15, 20, 25];
    const def = repDialTarget || 10;

    const modal = document.createElement('div');
    modal.id = 'goal-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML =
      '<div style="background:var(--color-dark);border:1px solid var(--color-border-bright);border-radius:var(--radius-lg);padding:2rem;max-width:380px;width:90%;text-align:center;">' +
        '<div style="font-size:0.72rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.75rem;">Today&#39;s Dial Goal</div>' +
        '<div style="font-size:1.1rem;font-weight:600;color:var(--color-white);margin-bottom:1.5rem;">How many dials are you committing to today?</div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;">' +
          suggestions.map(n =>
            '<button class="goal-suggestion action-btn' + (n === def ? ' action-btn--primary' : '') + '" data-goal="' + n + '" style="min-width:56px;font-weight:700;">' + n + '</button>'
          ).join('') +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;margin-bottom:1.25rem;">' +
          '<span style="font-size:0.82rem;color:var(--color-white-dim);">Custom:</span>' +
          '<input id="goal-custom" type="number" min="1" max="100" placeholder="e.g. 12" style="width:80px;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-white);padding:0.4rem 0.6rem;font-size:0.9rem;text-align:center;">' +
        '</div>' +
        '<button id="goal-confirm" class="action-btn action-btn--primary" style="width:100%;font-size:1rem;padding:0.75rem;">Let&#39;s go →</button>' +
      '</div>';

    document.body.appendChild(modal);

    let selected = def;

    modal.querySelectorAll('.goal-suggestion').forEach(btn => {
      btn.addEventListener('click', function() {
        selected = parseInt(this.dataset.goal);
        modal.querySelectorAll('.goal-suggestion').forEach(b => b.classList.remove('action-btn--primary'));
        this.classList.add('action-btn--primary');
        document.getElementById('goal-custom').value = '';
      });
    });

    document.getElementById('goal-custom').addEventListener('input', function() {
      const v = parseInt(this.value);
      if (v > 0) {
        selected = v;
        modal.querySelectorAll('.goal-suggestion').forEach(b => b.classList.remove('action-btn--primary'));
      }
    });

    document.getElementById('goal-confirm').addEventListener('click', function() {
      const customVal = parseInt(document.getElementById('goal-custom').value);
      if (customVal > 0) selected = customVal;
      storeGoal(selected);
      modal.remove();
      onComplete(selected);
    });
  }

  // ── Session HUD (momentum bar + goal + streak) ────────────────
  function renderSessionHUD() {
    // Stats now live in the HUD bar (next to rep selector) — no floating div in the layout
    const dialsToday = getDialsToday();
    const goal       = dailyGoal || getStoredGoal() || 10;
    const pct        = Math.min(100, Math.round((dialsToday / goal) * 100));
    const convRate   = sessionDialCount > 0
      ? Math.round(((sessionHot + sessionWarm) / sessionDialCount) * 100) : 0;

    // ── Dial cap (shows "/10" next to the existing dial count) ──
    const dialCap = document.getElementById('dial-cap');
    if (dialCap) dialCap.textContent = '/' + goal;

    // ── HOT+WARM% stat ──────────────────────────────────────────
    let convStat = document.getElementById('hud-conv-stat');
    if (!convStat) {
      convStat = document.createElement('div');
      convStat.id = 'hud-conv-stat';
      convStat.className = 'hud__stat';
      convStat.title = 'HOT + WARM conversion rate this session';
      const variantBtn = document.getElementById('variant-mode');
      if (variantBtn) variantBtn.insertAdjacentElement('beforebegin', convStat);
    }
    const rateColor = convRate >= 20 ? '#22c55e' : convRate >= 10 ? 'var(--color-accent)' : '';
    convStat.innerHTML =
      '<span class="hud__stat-label">H+W</span>' +
      '<span class="hud__stat-value"' + (rateColor ? ' style="color:' + rateColor + '"' : '') + '>' + convRate + '%</span>';

    // ── Streak badge (only appears when on a run) ───────────────
    let streakStat = document.getElementById('hud-streak-stat');
    if (sessionStreak >= 3) {
      if (!streakStat) {
        streakStat = document.createElement('div');
        streakStat.id = 'hud-streak-stat';
        streakStat.className = 'hud__stat';
        convStat.insertAdjacentElement('afterend', streakStat);
      }
      streakStat.innerHTML = '<span class="hud__stat-value" style="color:#fbbf24">🔥' + sessionStreak + '</span>';
    } else if (streakStat) {
      streakStat.remove();
    }

    // Remove any old floating session-hud div if it exists from a prior session
    const oldHud = document.getElementById('session-hud');
    if (oldHud) oldHud.remove();
  }

  // ── Win flash ─────────────────────────────────────────────────
  function flashWin(type) {
    const el = document.createElement('div');
    const isHot = type === 'HOT';
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;pointer-events:none;background:' + (isHot ? 'rgba(34,197,94,0.15)' : 'rgba(232,101,26,0.12)') + ';';
    el.innerHTML = '<div style="font-size:4rem;animation:flashPop 0.6s ease forwards;">' + (isHot ? '🔥' : '🟡') + '</div>';
    if (!document.getElementById('flash-style')) {
      const s = document.createElement('style');
      s.id = 'flash-style';
      s.textContent = '@keyframes flashPop{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.3);opacity:1}100%{transform:scale(1);opacity:0}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // ── Daily session summary email ──────────────────────────────
  function sendDailySummaryEmail() {
    const dialsToday = getDialsToday();
    const goal = dailyGoal || getStoredGoal() || 10;
    // Pull HOT/WARM from CallLog.today() so a page refresh mid-session doesn't undercount
    const todayCalls = window.CockpitLog ? window.CockpitLog.today() : [];
    const hotCount  = todayCalls.filter(c => c.outcome_code === 'HOT').length  || sessionHot;
    const warmCount = todayCalls.filter(c => c.outcome_code === 'WARM').length || sessionWarm;
    const totalLogged = todayCalls.length || sessionDialCount;
    const convRate = totalLogged > 0 ? Math.round(((hotCount + warmCount) / totalLogged) * 100) : 0;
    const rep = Shell._currentRep ? Shell._currentRep() : {};
    const repName = rep.display_name || 'Rep';
    const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
    const subject = encodeURIComponent('[UNC Sales] ' + repName + ' - ' + today + ' (' + dialsToday + ' dials)');
    const body = encodeURIComponent(
      'DAILY DIAL SUMMARY - ' + today + '\n' +
      '=====================================\n\n' +
      'Rep: ' + repName + '\n' +
      'Goal: ' + goal + ' dials\n' +
      'Actual: ' + dialsToday + ' dials\n' +
      'HOT: ' + hotCount + '\n' +
      'WARM: ' + warmCount + '\n' +
      'Conversion: ' + convRate + '%\n\n' +
      (hotCount > 0 ? '*** ' + hotCount + ' HOT lead(s) - proposals should be sent ***\n\n' : '') +
      'Review pipeline: https://app-na2.hubspot.com/contacts/245833525/\n\n' +
      '- UNC Sales OS'
    );
    const summaryRep = Shell._currentRep ? Shell._currentRep() : {};
    const summaryEmail = summaryRep.email || 'ricky@urbannicheco.com';
    window.open('https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(summaryEmail) + '&su=' + subject + '&body=' + body, '_blank');
  }

  // ── Auto-advance after outcome ────────────────────────────────
  function advanceAfterOutcome(outcomeCode) {
    // Update session stats
    sessionDialCount++;
    bumpDialsToday();
    if (outcomeCode === 'HOT') { sessionHot++; sessionStreak++; flashWin('HOT'); }
    else if (outcomeCode === 'WARM') { sessionWarm++; sessionStreak++; flashWin('WARM'); }
    else { sessionStreak = 0; }
    renderSessionHUD();

    // HOT → proposal trigger
    if (outcomeCode === 'HOT' && liveQueue[liveIndex]) {
      const p = liveQueue[liveIndex];
      setTimeout(() => {
        const proceed = confirm('\uD83D\uDD25 HOT logged for ' + (p.business_name || 'prospect') + '! Open Gmail to draft the proposal now?');
        if (proceed) {
          const subject = encodeURIComponent('Your website proposal — ' + (p.business_name || ''));
          const firstName = (p.first_name && !p.first_name.toLowerCase().includes('unknown')) ? p.first_name : 'there';
          const body = encodeURIComponent(
            'Hey ' + firstName + ',\n\n' +
            'Great talking with you. As promised, here is the proposal for your new website.\n\n' +
            'Pay $1,500 deposit to get started: ' + (Shell._currentRep ? (Shell._currentRep().stripe_link || 'https://buy.stripe.com/eVq5kD3Rq37vfSzbhJ6sw0N') : 'https://buy.stripe.com/eVq5kD3Rq37vfSzbhJ6sw0N') + '\n\n' +
            'Once the deposit lands I will send over the intake form - takes about 10 minutes to fill out, and from there you are live in 14 days.\n\n' +
            'Any questions just reply here or text me at ' + (Shell._currentRep ? (Shell._currentRep().phone || '(515) 344-4053') : '(515) 344-4053') + '.\n\n' +
            (Shell._currentRep ? (Shell._currentRep().signature || '- Ricky, UNC') : '- Ricky, UNC') + '\nurbannicheco.com'
          );
          window.open('https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(p.email || '') + '&su=' + subject + '&body=' + body, '_blank');
        }
        moveToNextDial();
      }, 400);
      return;
    }

    setTimeout(moveToNextDial, 300);
  }

  function moveToNextDial() {
    const goal = dailyGoal || getStoredGoal() || 10;
    if (getDialsToday() >= goal) {
      // Goal hit — celebrate
      renderScreen(html`
        <div style="text-align:center;padding:2rem 1rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🎯</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--color-white);margin-bottom:0.5rem;">Goal hit. ${getDialsToday()} dials.</div>
          <div style="color:var(--color-white-dim);margin-bottom:1.5rem;">${sessionHot} HOT · ${sessionWarm} WARM · ${Math.round(((sessionHot+sessionWarm)/Math.max(sessionDialCount,1))*100)}% conversion</div>
          <button class="action-btn action-btn--primary" id="keep-going-btn" style="margin-right:0.5rem;">Keep going</button>
          <button class="action-btn" id="wrap-up-btn">Wrap up session</button>
        </div>
      `);
      document.getElementById('keep-going-btn') && document.getElementById('keep-going-btn').addEventListener('click', () => {
        storeGoal(goal + 5);
        renderSessionHUD();
        loadNextOrRefresh();
      });
      document.getElementById('wrap-up-btn') && document.getElementById('wrap-up-btn').addEventListener('click', () => {
        sendDailySummaryEmail();
        renderScreen(html`<div style="text-align:center;padding:2rem;"><div style="font-size:2rem;margin-bottom:1rem;">✅</div><div style="font-size:1.1rem;color:var(--color-white);">Session complete. ${getDialsToday()} dials logged.</div><div style="font-size:0.85rem;color:var(--color-white-dim);margin-top:0.5rem;">Summary email drafted in Gmail.</div></div>`);
      });
      return;
    }

    liveIndex++;
    if (liveIndex < liveQueue.length) {
      renderLiveCard(liveQueue[liveIndex]);
      renderStart();
    } else {
      loadNextOrRefresh();
    }
  }

  async function loadNextOrRefresh() {
    // Queue exhausted — auto-fetch next batch
    renderScreen(html`
      <div style="text-align:center;padding:2rem;color:var(--color-white-dim);">
        <div style="margin-bottom:0.75rem;">Loading next dials…</div>
      </div>
    `);
    try {
      let data = await Shell.fetchQueue(10);
      // Fallback: try static queue file if worker is down
      // CRITICAL: only use if the file was generated for the current rep — never serve another rep's leads
      if (!data || !data.ok || !data.queue || !data.queue.length) {
        try {
          const currentRepId = Shell._currentRep ? Shell._currentRep().id : null;
          const staticResp = await fetch('/sales-ops/cold-call/queue/' + todayKey() + '.json', { cache: 'no-cache' });
          if (staticResp.ok) {
            const staticQueue = await staticResp.json();
            const fileRep = staticQueue && staticQueue._generated_for_rep_id;
            // Only use static file if it matches current rep OR has no rep tag (legacy)
            if (staticQueue && staticQueue.prospects && staticQueue.prospects.length &&
                (!fileRep || fileRep === currentRepId)) {
              data = { ok: true, queue: staticQueue.prospects };
            }
          }
        } catch(e) {}
      }
      if (!data || !data.ok || !data.queue || !data.queue.length) {
        renderScreen(html`
          <div style="text-align:center;padding:2rem;">
            <div style="font-size:1.1rem;color:var(--color-white);margin-bottom:0.5rem;">No more eligible dials right now.</div>
            <div style="color:var(--color-white-dim);font-size:0.85rem;">Everyone has been called or is in cooldown. Check back later or add more contacts in HubSpot.</div>
          </div>
        `);
        const card = document.getElementById('prospect-card');
        if (card) card.hidden = true;
        return;
      }
      liveQueue = data.queue;
      liveIndex = 0;
      renderLiveCard(liveQueue[0]);
      renderStart();
    } catch(e) {
      renderScreen(html`<div style="text-align:center;padding:2rem;color:var(--color-white-dim);">Failed to load next batch. Check connection.</div>`);
    }
  }

  // ── Fetch callbacks due ──────────────────────────────────────
  async function loadCallbacks() {
    const btn = document.getElementById('load-callbacks-btn');
    if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
    try {
      const rep = Shell._currentRep ? Shell._currentRep() : {};
      const ownerId = rep.hubspot_owner_id || '';
      const r = await fetch(
        'https://unc-sales-os-sync.ricky-a17.workers.dev/callbacks?owner_id=' + encodeURIComponent(ownerId),
        { cache: 'no-cache' }
      );
      const data = await r.json();
      const container = document.getElementById('callbacks-container');
      if (!container) return;

      if (!data.ok || !data.callbacks || !data.callbacks.length) {
        container.innerHTML = '<div style="font-size:0.82rem;color:var(--color-white-dim);padding:0.5rem 0;">No callbacks due — clear board.</div>';
        if (btn) { btn.textContent = 'No callbacks due'; btn.disabled = false; }
        return;
      }

      container.innerHTML = data.callbacks.map((c, i) => {
        const name = c.business_name || (c.first_name + ' ' + c.last_name).trim() || 'Unknown';
        const window_str = c.callback_window ? ' · ' + c.callback_window : '';
        const notes = c.last_call_notes ? '<div style="font-size:0.75rem;color:var(--color-white-dim);margin-top:0.2rem;">' + escapeHTML(c.last_call_notes.slice(0,80)) + '</div>' : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--color-dark-2);border-radius:var(--radius-sm);margin-bottom:0.4rem;">' +
          '<div>' +
            '<div style="font-size:0.85rem;font-weight:600;color:var(--color-white);">' + escapeHTML(name) + '</div>' +
            '<div style="font-size:0.75rem;color:var(--color-white-dim);">' +
              escapeHTML(c.trade_type || '') +
              (c.city ? ' · ' + escapeHTML(c.city) : '') +
              '<span style="color:#fbbf24;">' + escapeHTML(window_str) + '</span>' +
            '</div>' +
            notes +
          '</div>' +
          '<div style="display:flex;gap:0.4rem;">' +
            '<a href="tel:' + escapeHTML(c.phone||'') + '" style="font-size:0.75rem;" class="action-btn action-btn--sm">📞 Call</a>' +
            '<button class="action-btn action-btn--sm load-callback-card" data-idx="' + i + '" style="font-size:0.75rem;">Load →</button>' +
          '</div>' +
        '</div>';
      }).join('');

      // Store callbacks for load button
      window._callbackQueue = data.callbacks;

      // Bind load buttons
      container.querySelectorAll('.load-callback-card').forEach(b => {
        b.addEventListener('click', () => {
          const cb = window._callbackQueue[parseInt(b.dataset.idx)];
          if (!cb) return;
          // Convert callback to queue-compatible format and render
          liveQueue = [{ ...cb, contact_id: cb.contact_id, last_call_outcome: 'WARM' }];
          liveIndex = 0;
          renderLiveCard(liveQueue[0]);
          renderStart();
          // Collapse callback panel
          const panel = document.getElementById('callbacks-container');
          if (panel) panel.style.display = 'none';
        });
      });

      if (btn) { btn.textContent = '✓ ' + data.callbacks.length + ' callbacks'; btn.disabled = false; }
    } catch(e) {
      if (btn) { btn.textContent = '✗ Load failed'; btn.disabled = false; }
    }
  }

  // ── Load dials (initial) ──────────────────────────────────────
  async function loadLiveDials() {
    const btn = document.getElementById('load-dials-btn');
    if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
    try {
      // Try live worker first — falls back to today's static queue file if worker is down
      let data = await Shell.fetchQueue(10);
      let usedFallback = false;

      if (!data || !data.ok || !data.queue || !data.queue.length) {
        // Worker down or no eligible contacts — try static queue file for today
        const todayStr = todayKey();
        const staticPath = '/sales-ops/cold-call/queue/' + todayStr + '.json';
        try {
          const staticResp = await fetch(staticPath, { cache: 'no-cache' });
          if (staticResp.ok) {
            const staticQueue = await staticResp.json();
            if (staticQueue && staticQueue.prospects && staticQueue.prospects.length) {
              data = { ok: true, queue: staticQueue.prospects };
              usedFallback = true;
            }
          }
        } catch(e) {}
      }

      if (!data || !data.ok || !data.queue || !data.queue.length) {
        if (btn) { btn.textContent = '⚠ No eligible dials found'; btn.disabled = false; }
        return;
      }
      liveQueue = data.queue;
      liveIndex = 0;
      if (usedFallback && btn) { btn.title = 'Loaded from static queue file — worker offline. Cooldown filtering not applied.'; }

      // Update button immediately so "of N" is correct when card renders
      if (btn) { btn.textContent = '✓ ' + liveQueue.length + ' dials loaded'; btn.disabled = false; }
      // Hide queue-banner (manual mode notice) — live dials are now active
      const queueBanner = document.getElementById('queue-banner');
      if (queueBanner) { queueBanner.hidden = true; queueBanner.style.display = 'none'; }

      // Show goal modal if not set today for this rep
      const stored = getStoredGoal();
      if (!stored) {
        const rep = Shell._currentRep ? Shell._currentRep() : {};
        const repTarget = rep.dial_target || 10;
        showGoalModal(repTarget, (goal) => {
          dailyGoal = goal;
          renderSessionHUD();
          renderLiveCard(liveQueue[0]);
        });
      } else {
        dailyGoal = stored;
        renderSessionHUD();
        renderLiveCard(liveQueue[0]);
      }
    } catch(e) {
      if (btn) { btn.textContent = '✗ Load failed — check connection'; btn.disabled = false; }
    }
  }

  // ── Render prospect card ──────────────────────────────────────
  function renderLiveCard(prospect) {
    if (!prospect) return;

    // Push to Shell contact state
    if (Shell._state) {
      Shell._state.contact = {
        id:                   prospect.contact_id,
        first_name:           prospect.first_name,
        last_name:            prospect.last_name,
        business_name:        prospect.business_name,
        phone:                prospect.phone,
        email:                prospect.email              || '',
        website:              prospect.website            || '',
        trade:                prospect.trade_type || prospect.trade || '',
        city:                 prospect.city,
        state:                prospect.state,
        pipeline_stage:       prospect.last_call_outcome  || '',
        ai_hook:              prospect.ai_hook             || '',
        quick_win:            prospect.quick_win           || '',
        gbp_review_count:     prospect.gbp_review_count   || '',
        website_gaps:         prospect.website_gaps        || '',
        decision_maker_known: prospect.decision_maker_known || '',
        best_phone_verified:  prospect.best_phone_verified  || ''
      };
    }

    const card = document.getElementById('prospect-card');
    if (!card) return;

    const hubPortalId = (Shell._state && Shell._state.hubConfig && Shell._state.hubConfig.portal_id) ? Shell._state.hubConfig.portal_id : '245833525';
    const hubURL = 'https://app-na2.hubspot.com/contacts/' + hubPortalId + '/contact/' + prospect.contact_id;
    const tradeLabel  = prospect.trade_type || prospect.trade || '';
    const cityState   = [prospect.city, prospect.state].filter(Boolean).join(', ');

    // Clean placeholder names
    const rawFirst = prospect.first_name || '';
    const isPlaceholder = /unknown|likely|owner/i.test(rawFirst);
    const displayName = isPlaceholder ? '(Owner unknown)' : (rawFirst + ' ' + (prospect.last_name || '')).trim();

    // Best time hint by trade — uses module-level TRADE_WINDOWS
    const timeHint = TRADE_WINDOWS[tradeLabel] || '';

    // Notes
    // "Their words" = fact-grade intel captured on prior calls. Pull from
    // every field that carries it (static queue uses company/dealings_notes;
    // worker search/queue carries discovery_findings/last_call_notes).
    const companyNotes  = prospect.company_notes  || prospect.discovery_findings || '';
    const dealingsNotes = prospect.dealings_notes || prospect.last_call_notes    || '';
    const notesHTML = (companyNotes || dealingsNotes) ?
      '<div style="margin-top:0.5rem;font-size:0.78rem;color:var(--color-white-dim);border-top:1px solid var(--color-border);padding-top:0.5rem;">' +
        (companyNotes  ? '<div><b style="color:var(--color-accent)">Company:</b> ' + escapeHTML(companyNotes)  + '</div>' : '') +
        (dealingsNotes ? '<div style="margin-top:0.2rem"><b style="color:var(--color-accent)">Notes:</b> '    + escapeHTML(dealingsNotes) + '</div>' : '') +
      '</div>' : '';

    // Per-contact note persistence now lives in the main Call Notes box —
    // see syncCallNotesToContact() called at the end of this render.

    // Trade intel — uses module-level TRADE_INTEL
    const intel = TRADE_INTEL[tradeLabel] || TRADE_INTEL_DEFAULT;

    const lastOutcome = prospect.last_call_outcome || '';
    const lastDate    = prospect.last_call_date ? new Date(prospect.last_call_date).toLocaleDateString() : '';
    const outcomeColor = lastOutcome === 'HOT' ? '#22c55e' : lastOutcome === 'WARM' ? 'var(--color-accent)' : '#666';
    const lastTouchHTML = lastOutcome
      ? '<span style="font-size:0.68rem;font-weight:700;padding:0.15rem 0.4rem;border-radius:3px;background:rgba(100,100,100,0.15);color:' + outcomeColor + ';border:1px solid ' + outcomeColor + ';">' + escapeHTML(lastOutcome) + '</span>' + (lastDate ? '<span style="font-size:0.68rem;color:var(--color-white-dim);margin-left:0.25rem;">' + lastDate + '</span>' : '')
      : '<span style="font-size:0.68rem;color:var(--color-white-dim);">First contact</span>';


    const savedCollapsed = localStorage.getItem('unc_card_collapsed') !== 'false';
    const isCollapsed = savedCollapsed;
    card.innerHTML =
      // ── card-head (nav folded in — no separate card-nav row) ──
      '<div class="card-head">' +
        '<div class="card-top">' +
          '<span class="card-pos">#' + (liveIndex + 1) + '</span>' +
          '<span class="card-of"> of ' + (liveQueue.length || 1) + '</span>' +
          '<span class="card-trade">' + escapeHTML(tradeLabel || 'Unknown') + '</span>' +
          (timeHint ? '<span class="card-time">' + escapeHTML(timeHint) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.28rem;margin-bottom:0.25rem;">' +
          '<div class="card-biz" style="flex:1;margin-bottom:0;">' + escapeHTML(prospect.business_name || '—') + '</div>' +
          '<button class="card-mini-btn" id="live-prev"' + (liveIndex <= 0 ? ' disabled' : '') + '>‹</button>' +
          '<button class="card-mini-btn" id="live-next"' + (liveIndex >= (liveQueue.length || 1) - 1 ? ' disabled' : '') + '>›</button>' +
          '<button class="card-mini-btn" id="skip-btn">Skip</button>' +
          '<button class="card-mini-btn card-mini-btn--red" id="dnc-btn">DNC</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;">' +
          '<a href="tel:' + escapeHTML(prospect.phone || '') + '" class="card-phone">' + escapeHTML(prospect.phone || 'No phone') + '</a>' +
          lastTouchHTML +
          '<a href="' + hubURL + '" target="_blank" rel="noopener" class="card-hs-btn" style="margin-left:auto;">↗ HubSpot</a>' +
        '</div>' +
      '</div>' +
      // ── badges ──
      (function() {
        const phoneOk = (prospect.best_phone_verified || '').toLowerCase() === 'true' || (prospect.best_phone_verified || '') === '1';
        const dmKnown = (prospect.decision_maker_known || '').toLowerCase() === 'true' || (prospect.decision_maker_known || '') === '1';
        const gbpCount = prospect.gbp_review_count ? parseInt(prospect.gbp_review_count, 10) : null;
        const siteGap  = prospect.website_gaps || '';
        const lifecycle = prospect.last_call_outcome || '';
        let b = '';
        b += phoneOk ? '<span class="badge bg">✓ Phone verified</span>' : '<span class="badge ba">Phone unverified</span>';
        b += dmKnown ? '<span class="badge bg">✓ DM known</span>'       : '<span class="badge ba">DM unknown</span>';
        if (gbpCount !== null) b += '<span class="badge bb">⭐ ' + gbpCount + ' reviews</span>';
        if (siteGap) b += '<span class="badge br" title="' + escapeHTML(siteGap) + '">⚠ ' + escapeHTML(siteGap.length > 20 ? siteGap.slice(0,20)+'…' : siteGap) + '</span>';
        if (lifecycle && lifecycle !== 'COLD') b += '<span class="badge ba">' + escapeHTML(lifecycle) + '</span>';
        return '<div class="card-badges">' + b + '</div>';
      })() +
      // ── card-intel (scrollable) — KNOWN facts first, ANGLE (our prep) below ──
      '<div class="card-intel">' +
        '<div style="font-size:0.58rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#22c55e;margin-bottom:0.3rem;">Known — verified</div>' +
        ((companyNotes || dealingsNotes) ?
          '<div class="irow">' +
            '<span class="ikey ik-g">Their Words</span>' +
            '<span class="ival ival--hi">' + escapeHTML((companyNotes + (dealingsNotes ? ' · ' + dealingsNotes : '')).trim()) + '</span>' +
          '</div>' : '') +
        // ── Contact info rows — always render, flag missing data explicitly ──
        '<div class="drow">' +
          '<span class="dkey">Name:</span>' +
          '<span class="dval">' + (displayName && displayName !== '(Owner unknown)'
            ? escapeHTML(displayName)
            : '<a href="' + hubURL + '" target="_blank" rel="noopener" class="missing-link">⚠ Missing — add in HubSpot ↗</a>'
          ) + '</span>' +
        '</div>' +
        (cityState ?
          '<div class="drow">' +
            '<span class="dkey">City:</span>' +
            '<span class="dval">' + escapeHTML(cityState) + '</span>' +
          '</div>' : '') +
        '<div class="drow">' +
          '<span class="dkey">Email:</span>' +
          '<span class="dval">' + (prospect.email
            ? '<a href="mailto:' + escapeHTML(prospect.email) + '" style="color:var(--color-white-dim);">' + escapeHTML(prospect.email) + '</a>'
            : '<a href="' + hubURL + '" target="_blank" rel="noopener" class="missing-link">⚠ Missing — add in HubSpot ↗</a>'
          ) + '</span>' +
        '</div>' +
        '<div class="drow">' +
          '<span class="dkey">Website:</span>' +
          '<span class="dval">' + (prospect.website
            ? '<a href="' + escapeHTML(prospect.website) + '" target="_blank" rel="noopener" style="color:#60a5fa;">' + escapeHTML(prospect.website.replace(/^https?:\/\//, '')) + '</a>'
            : '<a href="' + hubURL + '" target="_blank" rel="noopener" class="missing-link">⚠ Missing — add in HubSpot ↗</a>'
          ) + '</span>' +
        '</div>' +
        // ── ANGLE — our prep. Useful ammo, clearly labeled as homework not gospel ──
        '<div style="font-size:0.58rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-accent);margin:0.55rem 0 0.3rem;border-top:1px solid var(--color-border);padding-top:0.5rem;opacity:0.85;">Angle — our prep</div>' +
        '<div class="irow">' +
          '<span class="ikey ik-a">Hook</span>' +
          '<span class="ival ival--hook" id="hook-copy-btn" title="Click to copy">' + (prospect.ai_hook ? '⚡ ' : '') + escapeHTML(prospect.ai_hook || intel.hook) + '</span>' +
        '</div>' +
        ((prospect.quick_win && prospect.quick_win !== prospect.ai_hook) ?
          '<div class="irow">' +
            '<span class="ikey ik-g">Quick Win</span>' +
            '<span class="ival">' + escapeHTML(prospect.quick_win) + '</span>' +
          '</div>' : '') +
        '<div class="irow">' +
          '<span class="ikey ik-b">Ask For</span>' +
          '<span class="ival">' + escapeHTML(intel.dm) + '</span>' +
        '</div>' +
        // Call Notes textarea lives in .call-notes-panel (bottom of col-right, always visible)
      '</div>';

    card.hidden = false;
    const cnPanel = document.getElementById('call-notes-panel');
    if (cnPanel) cnPanel.hidden = false;

    // Wire hook copy button
    const hookCopyBtn = document.getElementById('hook-copy-btn');
    if (hookCopyBtn) {
      hookCopyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(hookCopyBtn.textContent.trim());
        hookCopyBtn.style.color = '#22c55e';
        setTimeout(() => hookCopyBtn.style.color = '', 800);
      });
    }


    // Per-contact call notes — the ONE note box. Loads this contact's saved
    // note into the main Call Notes textarea, saves on every keystroke
    // (localStorage, 30-day TTL), and still feeds Shell.getNotes() on log.
    syncCallNotesToContact(prospect.contact_id);

    // Skip — advance without logging
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', function() {
      liveIndex++;
      if (liveIndex < liveQueue.length) {
        renderLiveCard(liveQueue[liveIndex]);
        renderStart();
      } else {
        loadNextOrRefresh();
      }
    });

    // DNC one-tap
    const dncBtn = document.getElementById('dnc-btn');
    if (dncBtn) dncBtn.addEventListener('click', function() {
      if (!confirm('Mark ' + (prospect.business_name || 'this contact') + ' as DNC?')) return;
      Shell._state && (Shell._state.contact = Shell._state.contact || {});
      Shell.recordOutcome && Shell.recordOutcome('DNC');
      advanceAfterOutcome('DNC');
    });

    // Prev/Next browse (pre-call only) — update card only, don't re-render screen
    const prevBtn = document.getElementById('live-prev');
    const nextBtn = document.getElementById('live-next');
    if (prevBtn) prevBtn.addEventListener('click', function() {
      if (liveIndex > 0) {
        liveIndex--;
        renderLiveCard(liveQueue[liveIndex]);
        // Re-bind THIS card's buttons only — don't re-render the whole screen
        bindBranchClicks(liveQueue[liveIndex]);
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', function() {
      if (liveIndex < liveQueue.length - 1) {
        liveIndex++;
        renderLiveCard(liveQueue[liveIndex]);
        bindBranchClicks(liveQueue[liveIndex]);
      }
    });

    // Call history
    const histHost = document.getElementById('live-history');
    if (histHost) {
      if (prospect.call_history && prospect.call_history.length) {
        histHost.innerHTML = prospect.call_history.map(h =>
          '<div style="font-size:0.78rem;opacity:0.7;">' +
            new Date(h.timestamp).toLocaleDateString() + ' — <b>' + escapeHTML(h.outcome_code) + '</b>' +
            (h.notes ? ' · "' + escapeHTML(h.notes.slice(0,60)) + '…"' : '') +
          '</div>'
        ).join('');
        histHost.style.display = 'block';
      } else {
        // No history = say nothing. The card header already shows "First
        // contact" — an empty-state strip on the stage is pure noise.
        histHost.innerHTML = '';
        histHost.style.display = 'none';
      }
    }
    // Re-render greeting line with live contact tokens
    const _greetLine = document.querySelector('.script-panel__line');
    if (_greetLine && scripts && scripts.greeting && scripts.greeting.default) {
      _greetLine.innerHTML = tokenizeHTML(scripts.greeting.default);
    }
  }

  function nextLiveDial() {
    liveIndex++;
    if (liveIndex < liveQueue.length) {
      renderLiveCard(liveQueue[liveIndex]);
    } else {
      liveQueue = [];
      liveIndex = 0;
    }
  }

  // ── Objection quick-reference panel ────────────────────────────
  // Injects a floating "OBJ" button on every screen. One tap shows
  // top 3 objection handlers without leaving the current screen.
  function injectObjPanel() {
    if (document.getElementById('obj-panel-btn')) return;
    if (!scripts || !scripts.objections) return;

    // Read top_objections from active rep — falls back to global defaults
    const _repForObj = Shell.getRep ? Shell.getRep() : {};
    const TOP_OBJECTIONS = (_repForObj.top_objections && _repForObj.top_objections.length)
      ? _repForObj.top_objections
      : ['not_interested', 'no_budget', 'already_have_agency'];
    const objs = scripts.objections;

    // Floating trigger button
    const btn = document.createElement('button');
    btn.id = 'obj-panel-btn';
    btn.textContent = 'OBJ';
    btn.style.cssText = [
      'position:fixed', 'bottom:72px', 'right:12px', 'z-index:800',
      'background:rgba(232,101,26,0.15)', 'border:1px solid rgba(232,101,26,0.4)',
      'color:var(--color-accent)', 'font-size:0.7rem', 'font-weight:700',
      'letter-spacing:0.1em', 'padding:0.4rem 0.6rem',
      'border-radius:var(--radius-sm)', 'cursor:pointer',
      'transition:background 0.15s'
    ].join(';');

    // Panel
    const panel = document.createElement('div');
    panel.id = 'obj-panel';
    panel.style.cssText = [
      'position:fixed', 'bottom:108px', 'right:12px', 'z-index:799',
      'width:320px', 'max-height:60vh', 'overflow-y:auto',
      'background:var(--color-dark)', 'border:1px solid var(--color-border-bright)',
      'border-radius:var(--radius-md)', 'padding:1rem',
      'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'display:none'
    ].join(';');

    const panelHTML = TOP_OBJECTIONS.map(k => {
      const o = objs[k];
      if (!o) return '';
      const label = o.label || k.replace(/_/g,' ').toUpperCase();
      const script = o.say_this || '';
      return '<div style="margin-bottom:0.85rem;padding-bottom:0.85rem;border-bottom:1px solid var(--color-border);">' +
        '<div style="font-size:0.7rem;font-weight:700;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.3rem;">' +
          escapeHTML(label) +
        '</div>' +
        '<div style="font-size:0.82rem;color:var(--color-white);line-height:1.5;">' +
          tokenizeHTML(script) +
        '</div>' +
      '</div>';
    }).join('');

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
        '<span style="font-size:0.72rem;font-weight:700;color:var(--color-white-dim);text-transform:uppercase;letter-spacing:0.12em;">Top Objections</span>' +
        '<button id="obj-panel-close" style="background:none;border:none;color:var(--color-white-dim);cursor:pointer;font-size:1rem;line-height:1;">&times;</button>' +
      '</div>' +
      panelHTML +
      '<a href="#" id="obj-panel-more" style="font-size:0.75rem;color:var(--color-accent);text-decoration:none;">See all objections →</a>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    let open = false;
    btn.addEventListener('click', () => {
      open = !open;
      panel.style.display = open ? 'block' : 'none';
      btn.style.background = open ? 'rgba(232,101,26,0.3)' : 'rgba(232,101,26,0.15)';
    });
    document.getElementById('obj-panel-close').addEventListener('click', (e) => {
      e.preventDefault();
      open = false;
      panel.style.display = 'none';
      btn.style.background = 'rgba(232,101,26,0.15)';
    });
  }

  // ── Preview mode — browse all loaded dials before starting ──
  function renderDialPreview() {
    if (!liveQueue.length) { renderStart(); return; }
    history.length = 0;
    const rows = liveQueue.map((p, i) => {
      const isPlaceholder = /unknown|likely|owner/i.test(p.first_name || '');
      const displayName = isPlaceholder ? '(Owner unknown)' : ((p.first_name||'') + ' ' + (p.last_name||'')).trim();
      const tradeLabel = p.trade_type || p.trade || '';
      const cityState = [p.city, p.state].filter(Boolean).join(', ');
      // Best time hint — uses module-level TRADE_WINDOWS
      const timeHint = TRADE_WINDOWS[tradeLabel] || '';
      return html`
        <div class="preview-row ${i === liveIndex ? 'preview-row--active' : ''}" data-idx="${i}"
          style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0.85rem;border-radius:var(--radius-sm);cursor:pointer;margin-bottom:0.4rem;background:${i===liveIndex?'rgba(232,101,26,0.12)':'var(--color-dark-2)'};border:1px solid ${i===liveIndex?'rgba(232,101,26,0.4)':'var(--color-border)'};transition:all 0.15s;">
          <span style="font-size:0.72rem;font-weight:700;color:${i===liveIndex?'var(--color-accent)':'var(--color-white-dim)'};min-width:1.5rem;">#${i+1}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.88rem;font-weight:600;color:var(--color-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(p.business_name||'—')}</div>
            <div style="font-size:0.75rem;color:var(--color-white-dim);">${escapeHTML(displayName)}${cityState?' · '+escapeHTML(cityState):''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${tradeLabel?html`<div style="font-size:0.7rem;font-weight:700;color:var(--color-accent);text-transform:uppercase;">${escapeHTML(tradeLabel)}</div>`:''}
            ${timeHint?html`<div style="font-size:0.65rem;color:#fbbf24;">${escapeHTML(timeHint)}</div>`:''}
          </div>
        </div>`;
    }).join('');

    renderScreen(html`
      <div class="screen__eyebrow">Dial Preview — ${liveQueue.length} contacts loaded</div>
      <div style="font-size:0.82rem;color:var(--color-white-dim);margin-bottom:0.75rem;">Click any contact to start dialing from there. Orange = currently selected.</div>
      <div id="preview-list">${rows}</div>
      <div style="margin-top:1rem;">
        <button id="start-from-top-btn" class="action-btn action-btn--primary" style="width:100%;padding:0.65rem;">
          ▶ Start Dialing from #${liveIndex + 1}
        </button>
      </div>
    `);

    // Bind row clicks — set index then go to start screen with that contact loaded
    stage().querySelectorAll('.preview-row').forEach(row => {
      row.addEventListener('click', () => {
        liveIndex = parseInt(row.dataset.idx);
        renderLiveCard(liveQueue[liveIndex]);
        renderStart();
      });
    });

    const startBtn = document.getElementById('start-from-top-btn');
    if (startBtn) startBtn.addEventListener('click', () => {
      renderLiveCard(liveQueue[liveIndex]);
      renderStart();
    });
  }

  // ── AMMO STRIP — one compact line of ammo on deep screens only.
  // The right-rail prospect card owns the full intel; this is just the
  // single best thing to say when the rep is mid-conversation and can't
  // glance right. Never rendered on start/opener (kept clean by design).
  function ammoStrip() {
    const c = Shell.getContact() || (liveQueue.length && liveQueue[liveIndex]) || {};
    const primary = (c.ai_hook || '').trim() || (c.quick_win || '').trim();
    if (!primary) return '';
    return `
      <div style="padding:0.4rem 0.85rem;margin-bottom:0.6rem;background:rgba(232,101,26,0.06);border-left:3px solid var(--color-accent);border-radius:var(--radius-sm);font-size:0.78rem;line-height:1.4;color:#ffd9a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⚡ ${escapeHTML(primary)}</div>`;
  }

  function renderStart() {
    history.length = 0;
    renderScreen(html`
      <div class="screen__eyebrow">Ready to dial</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.greeting.default)}</div>
        ${trainingNote(scripts.greeting.training_note)}
      </div>
      ${liveQueue.length ? html`
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <button id="preview-dials-btn" class="action-btn" style="flex:1;font-size:0.85rem;padding:0.5rem 0.75rem;border-color:var(--color-accent);color:var(--color-accent);">
            👁 Preview All ${liveQueue.length} Dials
          </button>
        </div>
      ` : ''}
      <div id="live-history" style="display:none;margin-top:0.5rem;margin-bottom:0.75rem;background:var(--color-dark-3);border-radius:var(--radius-sm);padding:0.5rem 0.75rem"></div>
      ${liveQueue.length && liveQueue[liveIndex] ? (() => {
        const _t = liveQueue[liveIndex];
        const _trade = (_t.trade_type || _t.trade || '').trim();
        const _intel = TRADE_INTEL[_trade] || TRADE_INTEL_DEFAULT;
        return html`<div class="trade-box" style="margin-bottom:0.5rem;"><div class="trade-box__lbl">Trade Pitch — ${_trade || 'Contractor'}</div><div class="trade-box__txt">${_intel.hook}</div></div>`;
      })() : ''}
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-branch="dm_free" title="Keyboard: press 1">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 DM Free</span>
          <span class="branch-btn__sub">Decision-maker on the line, free to talk</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-branch="dm_busy" title="Keyboard: press 2">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 DM Busy</span>
          <span class="branch-btn__sub">DM on the line but mid-something</span>
        </button>
        <button class="branch-btn branch-btn--grey" data-hotkey="3" data-branch="gatekeeper" title="Keyboard: press 3">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">⚪ Gatekeeper</span>
          <span class="branch-btn__sub">Someone else answered, not the DM</span>
        </button>
        <button class="branch-btn" data-hotkey="4" data-branch="wrong" title="Keyboard: press 4">
          <span class="branch-btn__hotkey">4</span>
          <span class="branch-btn__label">⚫ Wrong Number</span>
          <span class="branch-btn__sub">Auto-logs WRG, instant next</span>
        </button>
      </div>
      <div style="text-align:center;font-size:0.7rem;color:var(--color-white-dim);margin-top:0.4rem;letter-spacing:0.05em;">
        Press <kbd style="background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:3px;padding:0.1rem 0.35rem;font-size:0.7rem;">1</kbd>
        <kbd style="background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:3px;padding:0.1rem 0.35rem;font-size:0.7rem;">2</kbd>
        <kbd style="background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:3px;padding:0.1rem 0.35rem;font-size:0.7rem;">3</kbd>
        <kbd style="background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:3px;padding:0.1rem 0.35rem;font-size:0.7rem;">4</kbd>
        on your keyboard — no clicking needed
      </div>
    `);
    bindBranchClicks();
  }
  SCREENS.start = renderStart;

  function bindBranchClicks() {
    const previewBtn = document.getElementById('preview-dials-btn');
    if (previewBtn) previewBtn.addEventListener('click', renderDialPreview);
    stage().querySelectorAll('[data-branch]').forEach(btn => {
      btn.addEventListener('click', () => {
        Shell.startCall();
        const where = btn.dataset.branch;
        Shell.pushBranch(where);
        if (where === 'wrong') {
          playClick();
          Shell.recordOutcome('WRG');
          advanceAfterOutcome('WRG');
          return;
        }
        if (where === 'dm_free') goTo('opener_styles');
        else if (where === 'dm_busy') goTo('busy_pivot');
        else if (where === 'gatekeeper') goTo('gatekeeper');
      });
    });
  }

  // ── OPENER STYLES — Word for Word / Guided / Freestyle ─────────
  SCREENS.opener_styles = () => {
    const o = scripts.opener;
    const contact = Shell.getContact() || {};
    const trade = contact.trade || '';

    // Trade-specific pitch line
    const pitchLines = scripts.pitch_30 && scripts.pitch_30.trade_specific;
    const tradePitch = pitchLines && pitchLines[trade]
      ? tokenizeHTML(pitchLines[trade])
      : tokenizeHTML(scripts.pitch_30 ? scripts.pitch_30.default : '');

    let activeStyle = 'word_for_word';

    function renderStyleContent(style) {
      Shell.pushBranch('opener_style:' + style);
      Shell.setOpenerVariant(style, Shell.getVariantMode());
      if (style === 'word_for_word') {
        const hooked = (contact.ai_hook || '').trim() && o.word_for_word.script_hooked;
        const scriptText = hooked ? o.word_for_word.script_hooked : o.word_for_word.script;
        return html`
          ${hooked ? '<div style="font-size:0.62rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#ffd9a8;margin-bottom:0.35rem;">⚡ Personalized — built from their actual online presence</div>' : ''}
          <div class="script-panel">
            <div class="script-panel__line" style="font-size:1.05rem;line-height:1.65;">${tokenizeHTML(scriptText)}</div>
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--color-white-dim);text-align:center;">Read it exactly. Every word is there.</div>
        `;
      }
      if (style === 'guided') {
        return html`
          <div class="script-panel">
            ${o.guided.anchors.map(a => html`<div class="script-panel__line" style="font-size:0.95rem;">→ ${tokenizeHTML(a)}</div>`).join('')}
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--color-white-dim);text-align:center;">Hit each anchor in your own words.</div>
        `;
      }
      if (style === 'freestyle') {
        return html`
          <div class="script-panel">
            <div class="script-panel__line" style="font-size:0.88rem;color:var(--color-accent);font-weight:700;">GOAL: ${escapeHTML(o.freestyle.goal)}</div>
            ${o.freestyle.reminders.map(r => html`<div class="script-panel__line" style="font-size:0.85rem;color:var(--color-white-dim);">• ${escapeHTML(r)}</div>`).join('')}
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--color-white-dim);text-align:center;">You got it. Talk like a human.</div>
        `;
      }
      return '';
    }

    function render(style) {
      activeStyle = style;
      renderScreen(html`
        ${trainingNote(o.training_note)}
        <div class="screen__eyebrow">DM is free — deliver the opener</div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
          <button class="action-btn ${style==='word_for_word'?'action-btn--primary':''}" data-style="word_for_word" style="flex:1;font-size:0.78rem;" title="Full script — read word for word">W · Word for Word</button>
          <button class="action-btn ${style==='guided'?'action-btn--primary':''}" data-style="guided" style="flex:1;font-size:0.78rem;" title="Key anchors — say it in your own words">G · Guided</button>
          <button class="action-btn ${style==='freestyle'?'action-btn--primary':''}" data-style="freestyle" style="flex:1;font-size:0.78rem;" title="Goal only — full freestyle">F · Freestyle</button>
        </div>
        ${renderStyleContent(style)}
        <div class="branches" style="margin-top:0.75rem;">
          <button class="branch-btn branch-btn--green" data-hotkey="1" data-resp="YES">
            <span class="branch-btn__hotkey">1</span>
            <span class="branch-btn__label">🟢 Yes — trying to grow</span>
            <span class="branch-btn__sub">They want to grow → pitch</span>
          </button>
          <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-resp="WHAT_DO_YOU_DO">
            <span class="branch-btn__hotkey">2</span>
            <span class="branch-btn__label">🟡 What do you do exactly?</span>
            <span class="branch-btn__sub">Curious but not committed → 30-sec pitch</span>
          </button>
          <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-resp="BUSY_NOW">
            <span class="branch-btn__hotkey">3</span>
            <span class="branch-btn__label">🟡 Busy right now</span>
            <span class="branch-btn__sub">Bad time → get callback</span>
          </button>
          <button class="branch-btn branch-btn--red" data-hotkey="4" data-resp="NOT_INTERESTED">
            <span class="branch-btn__hotkey">4</span>
            <span class="branch-btn__label">🔴 Not interested</span>
            <span class="branch-btn__sub">→ Audit offer exit</span>
          </button>
          <button class="branch-btn" data-hotkey="5" data-resp="AT_CAPACITY">
            <span class="branch-btn__hotkey">5</span>
            <span class="branch-btn__label">⚪ At capacity</span>
            <span class="branch-btn__sub">→ 90-day follow-up</span>
          </button>
        </div>
        ${renderNotesBlock()}
      `);
      Shell.bindNotes();
      // Style switcher buttons
      const _sp = stage().querySelector('.script-panel');
      if (_sp) _sp.scrollTop = 0;
      stage().querySelectorAll('[data-style]').forEach(b => {
        b.addEventListener('click', () => render(b.dataset.style));
      });
      // Keyboard style shortcuts
      document.addEventListener('keydown', function _styleKey(e) {
        if (e.target.matches('input,textarea,select')) return;
        if (e.key === 'w' || e.key === 'W') { render('word_for_word'); }
        if (e.key === 'g' || e.key === 'G') { render('guided'); }
        if (e.key === 'f' || e.key === 'F') { render('freestyle'); }
      }, { once: false });
      // Response branches
      stage().querySelectorAll('[data-resp]').forEach(b => {
        b.addEventListener('click', () => {
          const resp = b.dataset.resp;
          Shell.pushBranch('opener_resp:' + resp + ' (' + activeStyle + ')');
          playClick();
          if (resp === 'YES')            goTo('pitch_yes');
          else if (resp === 'WHAT_DO_YOU_DO') goTo('pitch_what');
          else if (resp === 'BUSY_NOW')   goTo('busy_pivot');
          else if (resp === 'NOT_INTERESTED') goTo('response_not_interested');
          else if (resp === 'AT_CAPACITY')    goTo('response_capacity');
        });
      });
    }
    render(activeStyle);
  };
  SCREENS.openers = SCREENS.opener_styles; // backward compat

  // ── YES — pitch to someone who wants to grow ─────────────────
  SCREENS.pitch_yes = () => {
    const contact = Shell.getContact() || {};
    const trade = contact.trade || '';
    const pitchLines = scripts.pitch_30 && scripts.pitch_30.trade_specific;
    const pitch = (pitchLines && pitchLines[trade]) ? pitchLines[trade] : (scripts.pitch_30 ? scripts.pitch_30.default : '');
    renderScreen(html`
      <div class="screen__eyebrow">They want to grow — pitch it</div>
      ${ammoStrip()}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.responses.YES.script)}</div>
        ${trainingNote(scripts.responses.YES.training_note)}
        ${trainingNote(scripts.pitch_30.training_note)}
      </div>
      <div style="margin-top:0.75rem;padding:0.75rem;background:rgba(232,101,26,0.08);border:1px solid rgba(232,101,26,0.25);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.35rem;">Trade Pitch — ${escapeHTML(trade||'Contractor')}</div>
        <div style="font-size:0.88rem;line-height:1.6;color:var(--color-white);">${tokenizeHTML(pitch)}</div>
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="audit_offer">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 They're in — offer the audit</span>
          <span class="branch-btn__sub">→ Book the call</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="objections">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 Objection came up</span>
          <span class="branch-btn__sub">→ Handle it</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="q" data-next="tech_deflect" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">Q</span>
          <span class="branch-btn__label">⚡ "How's it work?" — deflect up</span>
          <span class="branch-btn__sub">→ Route to the audit, return here</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-next="response_not_interested">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🔴 Lost them</span>
          <span class="branch-btn__sub">→ Audit offer exit</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-next]').forEach(b => {
      b.addEventListener('click', () => {
        Shell.pushBranch('pitch_result:' + b.dataset.next);
        playClick();
        goTo(b.dataset.next);
      });
    });
  };

  // ── TECH DEFLECT RAIL — never explain mechanics on a cold call ──
  SCREENS.tech_deflect = () => {
    const td = scripts.tech_deflect || {};
    const tdA = td.how_it_works || {};
    const tdB = td.why_it_helps || {};
    renderScreen(html`
      <div class="screen__eyebrow" style="color:#f0985a">⚡ Tech question — deflect UP, never explain live</div>
      ${ammoStrip()}
      <div class="script-panel" style="border-color:rgba(232,101,26,0.35)">
        <div class="script-panel__line"><b>"How does it actually work?"</b> → "${tokenizeHTML(tdA.say_this || '')}"</div>
        ${trainingNote(tdA.training_note)}
        <div class="script-panel__line" style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.08)"><b>"Why would that get ME more calls?"</b> → "${tokenizeHTML(tdB.say_this || '')}"</div>
        ${trainingNote(tdB.training_note)}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-back="1">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 HANDLED — back to the call</span>
          <span class="branch-btn__sub">→ Returns exactly where you were</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', () => {
      Shell.pushBranch('tech_deflect:back');
      playClick();
      goBack();
    }));
  };

  // ── WHAT DO YOU DO — quick pitch for curious/skeptical ───────
  SCREENS.pitch_what = () => {
    renderScreen(html`
      <div class="screen__eyebrow">They asked what you do — tell them fast</div>
      ${ammoStrip()}
      ${trainingNote(scripts.responses.WHAT_DO_YOU_DO.training_note)}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.responses.WHAT_DO_YOU_DO.script)}</div>
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="pitch_yes">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 Now they're interested</span>
          <span class="branch-btn__sub">→ Full pitch</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="2" data-next="response_not_interested">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🔴 Still not interested</span>
          <span class="branch-btn__sub">→ Audit offer exit</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-next]').forEach(b => {
      b.addEventListener('click', () => { Shell.pushBranch('what_result:' + b.dataset.next); playClick(); goTo(b.dataset.next); });
    });
  };

  // ── NOT INTERESTED — audit offer exit ────────────────────────
  SCREENS.response_not_interested = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Not interested — graceful exit</div>
      ${ammoStrip()}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.responses.NOT_INTERESTED.script)}</div>
        ${trainingNote(scripts.responses.NOT_INTERESTED.training_note)}
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-outcome="WARM">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 Got email — sending audit</span>
          <span class="branch-btn__sub">Log WARM</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="2" data-outcome="COLD">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🔴 Hard no — move on</span>
          <span class="branch-btn__sub">Log COLD</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-outcome]').forEach(b => {
      b.addEventListener('click', () => { Shell.pushBranch('exit:' + b.dataset.outcome); playClick(); Shell.recordOutcome(b.dataset.outcome); advanceAfterOutcome(b.dataset.outcome); });
    });
  };
  SCREENS.response_red = SCREENS.response_not_interested;

  // ── AT CAPACITY — 90-day follow-up ───────────────────────────
  SCREENS.response_capacity = () => {
    renderScreen(html`
      <div class="screen__eyebrow">At capacity — plant the seed</div>
      ${ammoStrip()}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.responses.AT_CAPACITY.script)}</div>
        ${trainingNote(scripts.responses.AT_CAPACITY.training_note)}
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--yellow" data-hotkey="1" data-outcome="PARK">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟡 Follow up in 90 days</span>
          <span class="branch-btn__sub">Log PARK — recall in 90 days</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="2" data-outcome="COLD">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🔴 Not interested at all</span>
          <span class="branch-btn__sub">Log COLD</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-outcome]').forEach(b => {
      b.addEventListener('click', () => { Shell.pushBranch('capacity:' + b.dataset.outcome); playClick(); Shell.recordOutcome(b.dataset.outcome); advanceAfterOutcome(b.dataset.outcome); });
    });
  };

  // ── AUDIT OFFER ───────────────────────────────────────────────
  SCREENS.audit_offer = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Offer the free audit — close the call</div>
      ${ammoStrip()}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.audit_offer.default)}</div>
        ${trainingNote(scripts.audit_offer.training_note)}
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-outcome="HOT">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🔥 YES — send the audit</span>
          <span class="branch-btn__sub">Log HOT — capture email</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-outcome="WARM">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 Maybe — follow up</span>
          <span class="branch-btn__sub">Log WARM</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="COLD">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🔴 No thanks</span>
          <span class="branch-btn__sub">Log COLD</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-outcome]').forEach(b => {
      b.addEventListener('click', () => { Shell.pushBranch('audit:' + b.dataset.outcome); playClick(); Shell.recordOutcome(b.dataset.outcome); advanceAfterOutcome(b.dataset.outcome); });
    });
  };

  // ── OBJECTIONS ────────────────────────────────────────────────
  SCREENS.objections = () => {
    const objs = scripts.objections;
    const objKeys = Object.keys(objs);
    renderScreen(html`
      <div class="screen__eyebrow">Objection — pick the one they hit you with</div>
      ${ammoStrip()}
      ${objKeys.map((k, i) => html`
        <button class="branch-btn" data-hotkey="${i+1}" data-obj="${k}" style="margin-bottom:0.4rem;">
          <span class="branch-btn__hotkey">${i+1}</span>
          <span class="branch-btn__label">${escapeHTML(objs[k].label)}</span>
        </button>
      `).join('')}
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-obj]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.obj;
        Shell.pushBranch('objection:' + k);
        playClick();
        goTo('objection_handle', { key: k });
      });
    });
  };

  // Return to wherever the rep was BEFORE the objection detour (skips the picker screen)
  function returnFromObjection() {
    goBack();
    if (stage().getAttribute('data-screen') === 'objections') goBack();
  }

  SCREENS.objection_handle = (opts) => {
    const k = opts && opts.key;
    const obj = scripts.objections[k];
    if (!obj) { goTo('pitch_yes'); return; }
    renderScreen(html`
      <div class="screen__eyebrow">Handle: ${escapeHTML(obj.label)}</div>
      ${ammoStrip()}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(obj.say_this)}</div>
        ${trainingNote(obj.training_note)}
      </div>
      <div class="branches" style="margin-top:0.75rem;">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-act="return">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 Handled — back to the call</span>
          <span class="branch-btn__sub">→ Returns where you left off</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="2" data-act="audit">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟢 They're warming — go for the audit</span>
          <span class="branch-btn__sub">→ Close the call</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="q" data-act="tech" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">Q</span>
          <span class="branch-btn__label">⚡ Turned into a tech question</span>
          <span class="branch-btn__sub">→ Deflect up</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-act="exit">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🔴 Still no</span>
          <span class="branch-btn__sub">→ Exit</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.act;
        Shell.pushBranch('obj_result:' + k + ':' + a);
        playClick();
        if (a === 'return') returnFromObjection();
        else if (a === 'audit') goTo('audit_offer');
        else if (a === 'tech') goTo('tech_deflect');
        else goTo('response_not_interested');
      });
    });
  };

  // ── BACKWARD COMPAT ────────────────────────────────────────────
  SCREENS.trade_q2      = SCREENS.pitch_yes;
  SCREENS.response      = SCREENS.opener_styles;
  SCREENS.response_yellow = SCREENS.pitch_what;
  SCREENS.opener_auto_card = SCREENS.opener_styles;

  // ── BUSY PIVOT — rebuilt with 5 branches ──────────────────────
  // ── BUSY pivot --------
  SCREENS.busy_pivot = () => {
    const bp = scripts.dm_busy;
    renderScreen(html`
      <div class="screen__eyebrow">DM is busy — get a real commitment</div>
      ${ammoStrip()}
      ${trainingNote(scripts.busy_pivot.training_note)}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(bp.script)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-busy="NOW">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 Give it to me now</span>
          <span class="branch-btn__sub">→ Deliver opener</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-busy="MORNING">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 Call me tomorrow morning</span>
          <span class="branch-btn__sub">→ Lock in a time</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-busy="SPECIFIC">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🟡 Specific time / day</span>
          <span class="branch-btn__sub">→ Capture exact window</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="4" data-busy="TEXT">
          <span class="branch-btn__hotkey">4</span>
          <span class="branch-btn__label">🟡 Text me first</span>
          <span class="branch-btn__sub">→ Send text, lock window</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="5" data-busy="NO">
          <span class="branch-btn__hotkey">5</span>
          <span class="branch-btn__label">🔴 Not interested</span>
          <span class="branch-btn__sub">→ Audit offer exit</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-busy]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.busy;
        Shell.pushBranch('busy:' + k);
        playClick();
        if (k === 'NOW') goTo('opener_styles');
        else if (k === 'MORNING' || k === 'SPECIFIC') goTo('busy_callback');
        else if (k === 'TEXT') goTo('busy_text');
        else goTo('busy_last_swing');
      });
    });
  };

  SCREENS.busy_text = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Send a text first — lock the window</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.dm_busy.branches.TEXT_FIRST.script)}</div>
      </div>
      <div class="capture">
        <label class="capture__label" for="cb-window-text">Callback window they confirmed</label>
        <input id="cb-window-text" class="capture__input" type="text" placeholder="e.g. Thursday 8 AM" autocomplete="off">
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    const inp = document.querySelector('#cb-window-text');
    if (inp) { inp.focus(); inp.addEventListener('input', () => Shell.setCallbackWindow(inp.value)); }
    Shell.showOutcomes('WARM');
  };

  SCREENS.busy_callback = () => {
    const cb = scripts.busy_pivot.branches.CALLBACK;
    renderScreen(html`
      <div class="screen__eyebrow">Capture the callback</div>
      <div class="script-panel">
        <div class="script-panel__line">Get the window. Lock it down. Log WARM and move on.</div>
      </div>
      <div class="capture">
        <label class="capture__label" for="cb-window">${escapeHTML(cb.capture_prompt)}</label>
        <input id="cb-window" class="capture__input" type="text" placeholder="e.g. 8 AM tomorrow" autocomplete="off">
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    const inp = document.querySelector('#cb-window');
    inp.focus();
    inp.addEventListener('input', () => Shell.setCallbackWindow(inp.value));
    Shell.showOutcomes(cb.default_outcome);
  };

  SCREENS.busy_last_swing = () => {
    const ls2 = scripts.busy_last_swing;
    renderScreen(html`
      <div class="screen__eyebrow">Last swing</div>
      ${trainingNote(scripts.busy_last_swing.training_note)}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(ls2.script)}</div>
      </div>
      <div class="screen__heading">Log the outcome below.</div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    Shell.showOutcomes(ls2.default_outcome);
  };

  // -------- GATEKEEPER --------
  SCREENS.gatekeeper = () => {
    const gk = scripts.gatekeeper;
    renderScreen(html`
      <div class="screen__eyebrow">Gatekeeper — identify who answered</div>
      ${trainingNote(scripts.gatekeeper.training_note)}
      <div class="script-panel">
        <div class="script-panel__line" style="font-size:0.95rem;">Hey — is the owner around?</div>
        <div class="script-panel__line" style="font-size:0.8rem;color:var(--color-white-dim);">Then pick what you're dealing with below.</div>
      </div>
      <div class="branches">
        <button class="branch-btn" data-hotkey="1" data-gk="RECEPTIONIST">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">📋 Receptionist / Office</span>
          <span class="branch-btn__sub">Professional gatekeeper — get a window</span>
        </button>
        <button class="branch-btn" data-hotkey="2" data-gk="SPOUSE">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">👤 Spouse / Partner</span>
          <span class="branch-btn__sub">Soft approach — get a callback</span>
        </button>
        <button class="branch-btn" data-hotkey="3" data-gk="EMPLOYEE">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🪖 Employee / Crew</span>
          <span class="branch-btn__sub">Simple — ask for owner, get window</span>
        </button>
        <button class="branch-btn" data-hotkey="4" data-gk="VOICEMAIL">
          <span class="branch-btn__hotkey">4</span>
          <span class="branch-btn__label">📵 Hit Voicemail System</span>
          <span class="branch-btn__sub">Leave VM or hang up</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="5" data-gk="HANDED_TO_DM">
          <span class="branch-btn__hotkey">5</span>
          <span class="branch-btn__label">🟢 They Put DM On</span>
          <span class="branch-btn__sub">→ Deliver opener</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-gk]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.gk;
        Shell.pushBranch('gk_type:' + k);
        playClick();
        if (k === 'HANDED_TO_DM') goTo('opener_styles');
        else if (k === 'VOICEMAIL')   goTo('gatekeeper_voicemail');
        else goTo('gatekeeper_script', { type: k });
      });
    });
  };

  SCREENS.gatekeeper_script = (opts) => {
    const type = opts && opts.type || 'RECEPTIONIST';
    const gk = scripts.gatekeeper;
    const typeData = gk.types[type];
    if (!typeData) { goTo('gatekeeper_window'); return; }
    renderScreen(html`
      <div class="screen__eyebrow">Gatekeeper — ${escapeHTML(typeData.label)}</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(typeData.script)}</div>
        <div class="script-panel__line" style="margin-top:0.5rem;color:var(--color-white-dim);font-size:0.85rem;">
          If not available: "${escapeHTML(typeData.if_not_available || 'Ask for best time.')}"
        </div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-gk-result="WINDOW">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 Got a callback window</span>
          <span class="branch-btn__sub">→ Capture it — log WARM</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="2" data-gk-result="DM_ON">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟢 They put DM on</span>
          <span class="branch-btn__sub">→ Deliver opener</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-gk-result="WALL">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🔴 Won't help — wall</span>
          <span class="branch-btn__sub">→ Log COLD</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-gk-result]').forEach(b => {
      b.addEventListener('click', () => {
        const r = b.dataset.gkResult;
        Shell.pushBranch('gk_result:' + r);
        playClick();
        if (r === 'WINDOW') goTo('gatekeeper_window');
        else if (r === 'DM_ON') goTo('opener_styles');
        else goTo('gatekeeper_wall');
      });
    });
  };

  SCREENS.gatekeeper_voicemail = () => {
    const vms = scripts.gatekeeper.types.VOICEMAIL_SYSTEM;
    renderScreen(html`
      <div class="screen__eyebrow">Hit voicemail system — leave VM or skip</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(vms.vm_script)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--yellow" data-hotkey="1" data-outcome="NA" data-vm="1">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">📱 Left voicemail</span>
          <span class="branch-btn__sub">Log NA — VM noted in path</span>
        </button>
        <button class="branch-btn" data-hotkey="2" data-outcome="NA">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">⚫ Hung up — no VM</span>
          <span class="branch-btn__sub">Log NA</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-outcome]').forEach(b => {
      b.addEventListener('click', () => { Shell.pushBranch(b.dataset.vm ? 'vm:LEFT_VM' : 'vm:NO_VM'); playClick(); Shell.recordOutcome(b.dataset.outcome); advanceAfterOutcome(b.dataset.outcome); });
    });
  };

  SCREENS.gatekeeper_window = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Capture the callback window</div>
      <div class="script-panel">
        <div class="script-panel__line">Lock it down. Get specific. "Tomorrow at 8" beats "sometime this week".</div>
      </div>
      <div class="capture">
        <label class="capture__label" for="gk-window">Callback window they gave you</label>
        <input id="gk-window" class="capture__input" type="text" placeholder="e.g. Tomorrow 8 AM" autocomplete="off">
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    const inp = document.querySelector('#gk-window');
    if (inp) { inp.focus(); inp.addEventListener('input', () => Shell.setCallbackWindow(inp.value)); }
    Shell.showOutcomes('WARM');
  };

  SCREENS.gatekeeper_wall = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Wall — disengage clean</div>
      <div class="script-panel">
        <div class="script-panel__line">"No worries at all. I'll try him another time. Have a good one."</div>
        <div class="script-panel__line" style="color:var(--color-white-dim);font-size:0.82rem;margin-top:0.5rem;">Move on. Different angle next time — call earlier, or try a text first.</div>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    Shell.showOutcomes('COLD');
  };

  // -------- TRADE Q2 — the real Section 02 (V2) --------
  SCREENS.trade_q2 = () => {
    const trade = Shell.getCurrentTrade();
    const tq2 = scripts.trade_q2;
    const block = tq2[trade] || tq2['Unknown'];
    const universalOffer = tq2._audit_offer_universal || 'Want me to send you a free audit?';

    Shell.pushBranch('trade_q2:' + trade);

    renderScreen(html`
      <div class="screen__eyebrow">Trade Q2 + Audit Offer · ${escapeHTML(trade)} ${block.notes ? '· <span style="opacity:0.6">' + escapeHTML(block.notes) + '</span>' : ''}</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Q2:</b> ${tokenizeHTML(block.q2_line)}</div>
        ${block.pain_hook ? `<div class="script-panel__line" style="opacity:0.85"><b>Pain hook (only if they ask why):</b> ${tokenizeHTML(block.pain_hook)}</div>` : ''}
        <div class="script-panel__line"><b>Audit offer:</b> ${tokenizeHTML(universalOffer)}</div>
      </div>
      <div class="screen__heading">How did they respond to the offer?</div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="h" data-q2="HOT">
          <span class="branch-btn__hotkey">H</span>
          <span class="branch-btn__label">🟢 YES — Send the audit</span>
          <span class="branch-btn__sub">They want it. Logs HOT.</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="w" data-q2="WARM">
          <span class="branch-btn__hotkey">W</span>
          <span class="branch-btn__label">🟡 MAYBE — Want to think</span>
          <span class="branch-btn__sub">Capture callback / send anyway. Logs WARM.</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="c" data-q2="COLD">
          <span class="branch-btn__hotkey">C</span>
          <span class="branch-btn__label">🔴 NO — Not interested</span>
          <span class="branch-btn__sub">Graceful out. Logs COLD.</span>
        </button>
      </div>
      ${renderNotesBlock()}
    `);
    Shell.bindNotes();
    stage().querySelectorAll('[data-q2]').forEach(b => {
      b.addEventListener('click', () => {
        const o = b.dataset.q2;
        Shell.pushBranch('q2_resp:' + o);
        playClick();
        Shell.recordOutcome(o);
      });
    });
  };

  // Legacy fallback (in case someone references old screen id)
  SCREENS.section_02_placeholder = SCREENS.trade_q2;

  // ============================================================
  // WORKSPACE → COCKPIT EVENT BRIDGE
  // Receives prospects/queues fired from the workspace right rail
  // ============================================================
  window.addEventListener('unc:queue-injected', function(ev) {
    var prospects = ev.detail && ev.detail.prospects;
    if (!Array.isArray(prospects) || !prospects.length) return;
    liveQueue.length = 0;
    prospects.forEach(function(p) { liveQueue.push(p); });
    liveIndex = (ev.detail && typeof ev.detail.index === 'number' && ev.detail.index >= 0 && ev.detail.index < liveQueue.length) ? ev.detail.index : 0;
    renderLiveCard(liveQueue[liveIndex]);
    renderStart();
  });

  // Append WITHOUT touching the active call — rep builds the queue as they work
  window.addEventListener('unc:queue-appended', function(ev) {
    var p = ev.detail && ev.detail.prospect;
    if (!p) return;
    var exists = liveQueue.some(function(x) { return String(x.contact_id) === String(p.contact_id); });
    if (!exists) liveQueue.push(p);
    if (liveQueue.length === 1) { liveIndex = 0; renderStart(); }
    if (liveQueue[liveIndex]) renderLiveCard(liveQueue[liveIndex]); // refresh count display
  });

  window.addEventListener('unc:prospect-loaded', function(ev) {
    // Legacy single-load: append-or-find + jump. Never wipes the rest of the queue.
    var p = ev.detail && ev.detail.prospect;
    if (!p) return;
    var idx = -1;
    for (var i = 0; i < liveQueue.length; i++) { if (String(liveQueue[i].contact_id) === String(p.contact_id)) { idx = i; break; } }
    if (idx === -1) { liveQueue.push(p); idx = liveQueue.length - 1; }
    liveIndex = idx;
    renderLiveCard(liveQueue[liveIndex]);
    renderStart();
  });

  // ============================================================
  // KICK OFF
  // ============================================================
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
