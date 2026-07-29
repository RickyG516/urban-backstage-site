/* ===================================================================
   UNC SALES COCKPIT — Discovery Content Logic
   v3.0 — 2026-07-21
   Design law: DIAGNOSTICIAN, NOT MECHANIC.
     Every technical "how/why" question routes UP to the written
     proposal / specialist via the Universal Deflect-Up Rail.
     No node ever requires the agent to explain service mechanics live.
   Adds: deflect-up rail (tech_deflect) reachable from every screen
         open-gate handlers (time crunch, gatekeeper)
         mid-diagnosis handlers (complacency, burned before)
         decision/close stalls (money, season, partner, send-info,
           think-it-over, price flinch)
         quick-win repositioned (whisper→implication overlay→close proof)
         HOT outcome (start this week)
   Fixes: dead quick_win_hook that buildSection never rendered.
   =================================================================== */

(function() {
  'use strict';
  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  const stage = () => document.querySelector('#screen-stage');
  let trainMode = false;

  // Sound must never block navigation. If CockpitAudio isn't wired, click silently.
  function playClick() {
    try { var a = window.CockpitAudio; if (a && typeof a.play === 'function') a.play('click'); } catch (_) {}
  }

  // Always-on notes: reveal the panel, size it up, teach the click-to-log behavior.
  function injectNotesUX() {
    if (!document.getElementById('disco-notes-style')) {
      const st = document.createElement('style');
      st.id = 'disco-notes-style';
      st.textContent = [
        '.q-clickable{cursor:pointer;transition:background .12s;border-radius:6px;padding:.15rem .4rem;margin:.05rem -.4rem;}',
        '.q-clickable:hover{background:rgba(232,107,30,.10);}',
        '.q-log-hint{font-size:.68rem;color:#e36b1e;opacity:0;margin-left:.45rem;white-space:nowrap;font-weight:600;}',
        '.q-clickable:hover .q-log-hint{opacity:.9;}',
        '.q-answered{background:rgba(46,160,67,.08);}',
        '.q-answered .q-log-hint{opacity:.85;color:#22c55e;}',
        '#call-notes-panel{display:flex !important;flex-direction:column;}',
        '#call-notes{min-height:230px;flex:1;}'
      ].join('');
      document.head.appendChild(st);
    }
    ensureNotesVisible();
    const lbl = document.querySelector('.call-notes-panel__lbl');
    if (lbl) lbl.textContent = 'Call Notes — tap any question to log its answer';
  }
  function ensureNotesVisible() {
    const panel = document.querySelector('#call-notes-panel');
    if (panel) panel.hidden = false;
  }

  // Stamp a labeled answer stub into the synced #call-notes field and focus it.
  function logAnswer(sectionNum, qnum, qtext, el) {
    ensureNotesVisible();
    const ta = document.querySelector('#call-notes');
    if (!ta) return;
    const tag = '[S' + sectionNum + '·Q' + qnum + ']';
    if (!ta.value.includes(tag)) {
      const stub = tag + ' ' + qtext + '\n→ ';
      const sep = ta.value.replace(/\s+$/, '').length ? '\n\n' : '';
      ta.value = ta.value.replace(/\s+$/, '') + sep + stub;
      ta.dispatchEvent(new Event('input', { bubbles: true })); // triggers Shell autosave
    }
    if (el) { el.classList.add('q-answered'); const h = el.querySelector('.q-log-hint'); if (h) h.textContent = '✓ logged'; }
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.scrollTop = ta.scrollHeight;
  }

  async function boot()  {
  try {
    scripts = await (await fetch('/sales-ops/discovery/scripts.json', { cache: 'no-cache' })).json();
    await Shell.init({ cockpit: 'discovery' });
    Shell.bindNotes();
    Shell.onReset(renderStart);
    Shell.onBack(goBack);
    trainMode = localStorage.getItem('unc_train_mode') === 'true';
    injectTrainToggle();
    injectNotesUX();
    renderStart();
  } catch(e) {
    console.error('[discovery] boot failed', e);
    const s = document.querySelector('#screen-stage');
    if (s) s.innerHTML = '<div class="script-panel"><div class="script-panel__line" style="color:#ef4444;">⚠ Cockpit failed to load. Reload the page or check your connection.<br><small style=\"opacity:0.5\">' + e.message + '</small></div></div>';
  }
}

  function injectTrainToggle() {
    const hud = document.querySelector('.hud__center');
    if (!hud || document.getElementById('train-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'train-toggle';
    btn.className = 'variant-mode-btn';
    btn.title = 'Toggle Training Mode';
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
    if (!trainMode || !text) return '';
    return `<div class="coach-note">📘 ${escapeHTML(text)}</div>`;
  }

  function tokens() {
    const c = Shell.getContact() || {};
    const rep = Shell.getRep ? Shell.getRep() : {};
    return {
      first_name:       c.first_name || 'there',
      business_name:    c.business_name || 'your business',
      trade:            c.trade || 'Unknown',
      trade_lower:      (c.trade || 'contractor').toLowerCase(),
      city:             c.city || 'your area',
      state:            c.state || '',
      rep_name:         rep.display_name || 'Ricky',
      rep_phone:        rep.phone || '(515) 344-4053',
      gbp_review_count: (c.gbp_review_count != null && c.gbp_review_count !== '') ? String(c.gbp_review_count) : null,
      quick_win:        (c.quick_win && c.quick_win.trim()) ? c.quick_win : null,
      website:          c.website || null,
      website_gaps:     (c.website_gaps && c.website_gaps.trim()) ? c.website_gaps : null,
      ai_hook:          (c.ai_hook && c.ai_hook.trim()) ? c.ai_hook : null,
      pipeline_stage:   c.pipeline_stage || null
    };
  }
  function hasQuickWin() { return !!tokens().quick_win; }
  function interpolate(s) {
    if (!s) return '';
    const t = tokens();
    return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|website|website_gaps|ai_hook|pipeline_stage)\}/g, (m, k) => t[k] != null ? t[k] : m);
  }
  function tokenizeHTML(s) { return interpolate(s).replace(/\{[^}]+\}/g, m => `<span class="script-panel__token">${m}</span>`); }
  function escapeHTML(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function html(strings, ...values) { let o = strings[0]; for (let i = 0; i < values.length; i++) o += String(values[i]) + strings[i+1]; return o; }
  function renderScreen(c) { const s = stage(); s.classList.remove('active'); void s.offsetWidth; s.innerHTML = c; s.classList.add('screen','active'); }
  function goTo(id, opts) { const r = SCREENS[id]; if (!r) return; if (!opts || !opts.isBack) { const c = stage().getAttribute('data-screen'); if (c && c !== 'start') history.push(c); } Shell.hideOutcomes(); stage().setAttribute('data-screen', id); r(opts || {}); }
  function goBack() { if (!history.length) return renderStart(); const p = history.pop(); goTo(p, { isBack: true }); }

  function progress(current, total) {
    const dots = [];
    for (let i = 1; i <= total; i++) {
      dots.push(`<span class="discovery-dot ${i < current ? 'done' : i === current ? 'active' : ''}"></span>`);
    }
    return `<div class="discovery-progress">${dots.join('')} <span class="discovery-progress__label">Section ${current} of ${total}</span></div>`;
  }

  const SCREENS = {};

  /* ---------- generic handler screen builder ----------
     cfg = {
       eyebrow, get: ()=>scriptObj, secondary: ()=>scriptObj (optional extra script block),
       branchTag, buttons: [{ label, cls, key, to?, out?, back? }]
     } */
  function makeHandler(id, cfg) {
    SCREENS[id] = () => {
      const d = cfg.get() || {};
      const d2 = cfg.secondary ? (cfg.secondary() || null) : null;
      const btns = cfg.buttons.map((b, i) => html`
        <button class="branch-btn ${b.cls}" data-hotkey="${b.key}" data-i="${i}">
          <span class="branch-btn__hotkey">${b.key}</span>
          <span class="branch-btn__label">${b.label}</span>
        </button>`).join('');
      renderScreen(html`
        <div class="screen__eyebrow">${escapeHTML(cfg.eyebrow)}</div>
        <div class="script-panel">
          <div class="script-panel__line"><b>Say this:</b> "${tokenizeHTML(d.say_this || '')}"</div>
          ${d.follow_up ? html`<div class="script-panel__line" style="margin-top:0.75rem;opacity:0.85"><b>If they pause:</b> "${tokenizeHTML(d.follow_up)}"</div>` : ''}
          ${d2 ? html`<div class="script-panel__line" style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.08)"><b>If they push "why does it help?":</b> "${tokenizeHTML(d2.say_this || '')}"</div>` : ''}
          ${trainingNote(d.training_note || '')}
          ${d2 ? trainingNote(d2.training_note || '') : ''}
        </div>
        <div class="branches">${btns}</div>
      `);
      stage().querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => {
        const b = cfg.buttons[+el.dataset.i];
        Shell.pushBranch((cfg.branchTag || id) + ':' + (b.out || b.to || (b.back ? 'back' : 'x')));
        playClick();
        if (b.out) Shell.recordOutcome(b.out);
        else if (b.back) goBack();
        else if (b.to) goTo(b.to);
      }));
    };
  }

  // -------- START --------
  function renderStart() {
    history.length = 0;
    const s = scripts;
    const qw = scripts.quick_win || {};
    const whisper = hasQuickWin() && qw.open_whisper
      ? html`<div class="script-panel__line" style="margin-top:0.75rem;color:#f0985a"><b>Whisper (homework, don't spend it yet):</b> "${tokenizeHTML(qw.open_whisper)}"</div>`
      : '';
    renderScreen(html`
      <div class="screen__eyebrow">Discovery call — ready to open</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Intro:</b> "${tokenizeHTML(s.intro.default)}"</div>
        ${trainingNote(s.intro.training_note || '')}
        <div class="script-panel__line" style="margin-top:0.75rem"><b>Agenda:</b> "${tokenizeHTML(s.agenda.default)}"</div>
        ${trainingNote(s.agenda.training_note || '')}
        ${whisper}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-branch="start_section">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 AGREED — start Section 1</span>
          <span class="branch-btn__sub">→ Situation questions</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-branch="agency_deflect">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 "We already have an agency"</span>
          <span class="branch-btn__sub">→ Deflect and continue</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-branch="price_early">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🟡 "What does it cost?" — asked early</span>
          <span class="branch-btn__sub">→ Redirect to discovery</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="4" data-branch="time_crunch">
          <span class="branch-btn__hotkey">4</span>
          <span class="branch-btn__label">🟡 "I only got 5 minutes"</span>
          <span class="branch-btn__sub">→ Shrink the ask, keep control</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="5" data-branch="not_owner">
          <span class="branch-btn__hotkey">5</span>
          <span class="branch-btn__label">🟡 "I'm not the owner"</span>
          <span class="branch-btn__sub">→ Route to decision-maker</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="6" data-branch="no_show">
          <span class="branch-btn__hotkey">6</span>
          <span class="branch-btn__label">🔴 NO SHOW</span>
          <span class="branch-btn__sub">→ Log and follow up</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-branch]').forEach(b => b.addEventListener('click', () => {
      Shell.startCall();
      const w = b.dataset.branch;
      Shell.pushBranch(w);
      playClick();
      if (w === 'start_section') goTo('situation');
      else if (w === 'agency_deflect') goTo('deflect_agency');
      else if (w === 'price_early') goTo('deflect_price');
      else if (w === 'time_crunch') goTo('deflect_time_crunch');
      else if (w === 'not_owner') goTo('deflect_not_owner');
      else if (w === 'no_show') Shell.recordOutcome('NO_SHOW');
    }));
  }
  SCREENS.start = renderStart;

  // -------- DEFLECTION: AGENCY --------
  SCREENS.deflect_agency = () => {
    const d = scripts.deflections?.already_have_agency || {};
    renderScreen(html`
      <div class="screen__eyebrow">Deflection — "We already have an agency"</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Say this:</b> "${tokenizeHTML(d.say_this || '')}"</div>
        ${d.follow_up ? html`<div class="script-panel__line" style="margin-top:0.75rem;opacity:0.8"><b>If they pause:</b> "${tokenizeHTML(d.follow_up)}"</div>` : ''}
        ${trainingNote(d.training_note || '')}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="situation">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 OPENED UP — continue discovery</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="not_fit_exit">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 COMMITTED TO CURRENT AGENCY — exit gracefully</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('deflect_agency:' + b.dataset.next);
      playClick();
      goTo(b.dataset.next);
    }));
  };

  // -------- DEFLECTION: EARLY PRICE --------
  SCREENS.deflect_price = () => {
    const d = scripts.deflections?.early_price_question || {};
    renderScreen(html`
      <div class="screen__eyebrow">Deflection — Early price question</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Say this:</b> "${tokenizeHTML(d.say_this || '')}"</div>
        ${trainingNote(d.training_note || '')}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="situation">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 ACCEPTED — continue discovery</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="2" data-next="not_fit_exit">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🔴 PRICE-ONLY — not ready for real conversation</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('deflect_price:' + b.dataset.next);
      playClick();
      goTo(b.dataset.next);
    }));
  };

  // -------- DEFLECTION: TIME CRUNCH (open gate) --------
  makeHandler('deflect_time_crunch', {
    eyebrow: 'Deflection — "I only got 5 minutes"',
    branchTag: 'time_crunch',
    get: () => scripts.deflections?.time_crunch,
    buttons: [
      { label: '🟢 GAVE ME THE TIME — go to Situation', cls: 'branch-btn--green', key: '1', to: 'situation' },
      { label: '🟡 RESCHEDULE — book a real slot', cls: 'branch-btn--yellow', key: '2', out: 'FOLLOW_UP_BOOKED' }
    ]
  });

  // -------- DEFLECTION: NOT THE OWNER (gatekeeper) --------
  makeHandler('deflect_not_owner', {
    eyebrow: 'Deflection — "I\'m not the owner"',
    branchTag: 'not_owner',
    get: () => scripts.deflections?.not_the_owner,
    buttons: [
      { label: '🟢 ROUTES ME TO THE OWNER — book it', cls: 'branch-btn--green', key: '1', out: 'FOLLOW_UP_BOOKED' },
      { label: '🟡 WILL PASS IT ON — send one-pager', cls: 'branch-btn--yellow', key: '2', out: 'INFO_REQUESTED' }
    ]
  });

  // -------- UNIVERSAL DEFLECT-UP RAIL --------
  SCREENS.tech_deflect = () => {
    const t = scripts.tech_deflect || {};
    const a = t.how_it_works || {};
    const b = t.why_it_helps || {};
    renderScreen(html`
      <div class="screen__eyebrow" style="color:#f0985a">⚡ Tech question — deflect UP, never explain live</div>
      <div class="script-panel" style="border-color:rgba(232,101,26,0.35)">
        <div class="script-panel__line"><b>"How does it actually work?"</b> → "${tokenizeHTML(a.say_this || '')}"</div>
        ${trainingNote(a.training_note || '')}
        <div class="script-panel__line" style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.08)"><b>"Why does that get me more leads?"</b> → "${tokenizeHTML(b.say_this || '')}"</div>
        ${trainingNote(b.training_note || '')}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-back="1">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 HANDLED — back to the call</span>
          <span class="branch-btn__sub">→ Returns to where you were</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', () => {
      Shell.pushBranch('tech_deflect:back');
      playClick();
      goBack();
    }));
  };

  // -------- SECTIONS (SPIN) --------
  // opts: { extras:[{branch,label,cls,key,to}], quickWin:bool }
  function buildSection(id, sectionKey, current, total, nextScreen, opts) {
    opts = opts || {};
    SCREENS[id] = () => {
      const s = scripts.sections[sectionKey];
      const prompts = s.prompts.map((p, i) => `<div class="script-panel__line q-clickable" data-qnum="${i+1}" data-qtext="${escapeHTML(interpolate(p))}"><b>Q${i+1}:</b> ${tokenizeHTML(p)}<span class="q-log-hint">＋ log answer</span></div>`).join('');
      const followUps = s.follow_up_prompts ? html`
        <div class="screen__heading" style="margin-top:1rem;font-size:0.8rem;opacity:0.65">FOLLOW-UPS IF THEY GO SHALLOW:</div>
        ${s.follow_up_prompts.map(p => `<div class="script-panel__line" style="font-size:0.88rem;opacity:0.8">→ "${tokenizeHTML(p)}"</div>`).join('')}
      ` : '';
      const calcNote = s.calculator_note ? html`<div class="script-panel__line" style="margin-top:0.75rem;padding:0.75rem;background:rgba(232,101,26,0.08);border:1px solid rgba(232,101,26,0.3);border-radius:var(--radius-sm);font-size:0.85rem">🧮 ${escapeHTML(s.calculator_note)}</div>` : '';
      // quick-win overlay — lands here (Implication), AFTER they feel the cost. Fixes the old dead hook.
      const qw = scripts.quick_win || {};
      const qwOverlay = (opts.quickWin && qw.implication_overlay) ? html`
        <div class="script-panel__line" style="margin-top:0.75rem;padding:0.75rem;background:rgba(232,101,26,0.10);border:1px solid rgba(232,101,26,0.4);border-radius:var(--radius-sm)">
          <b style="color:#f0985a">🎯 Quick-win overlay:</b> "${tokenizeHTML(qw.implication_overlay)}"
          ${!hasQuickWin() ? '<br><small style="opacity:0.6">↑ fill the quick_win field on this contact to make this land</small>' : ''}
        </div>` : '';

      // dynamic objection buttons
      let hk = 2;
      const extras = (opts.extras || []).map(e => html`
        <button class="branch-btn ${e.cls || 'branch-btn--yellow'}" data-hotkey="${hk}" data-obj="${e.to}">
          <span class="branch-btn__hotkey">${hk++}</span>
          <span class="branch-btn__label">${e.label}</span>
        </button>`).join('');
      const techKey = hk++;
      const nfKey = hk++;

      renderScreen(html`
        ${progress(current, total)}
        <div class="screen__eyebrow">${escapeHTML(s.label)}</div>
        <div class="screen__heading" style="opacity:0.7;font-size:0.88rem">Goal: ${escapeHTML(s.goal)}</div>
        <div class="script-panel">
          ${prompts}
          ${followUps}
          ${calcNote}
          ${qwOverlay}
          ${trainingNote(s.training_note || '')}
        </div>
        <div class="branches">
          <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="${nextScreen}">
            <span class="branch-btn__hotkey">1</span>
            <span class="branch-btn__label">🟢 NEXT SECTION</span>
            <span class="branch-btn__sub">${nextScreen === 'closing' ? '→ Close decision' : '→ Continue'}</span>
          </button>
          ${extras}
          <button class="branch-btn branch-btn--yellow" data-hotkey="${techKey}" data-obj="tech_deflect" style="border-color:rgba(232,101,26,0.4)">
            <span class="branch-btn__hotkey">${techKey}</span>
            <span class="branch-btn__label">⚡ TECH QUESTION — deflect up</span>
          </button>
          <button class="branch-btn branch-btn--red" data-hotkey="${nfKey}" data-obj="not_fit_exit">
            <span class="branch-btn__hotkey">${nfKey}</span>
            <span class="branch-btn__label">🔴 NOT A FIT — exit now</span>
          </button>
        </div>
      `);
      ensureNotesVisible();
      stage().querySelectorAll('.q-clickable').forEach(el => el.addEventListener('click', () => {
        logAnswer(current, el.dataset.qnum, el.dataset.qtext, el);
      }));
      stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
        Shell.pushBranch(sectionKey + ':complete');
        playClick();
        goTo(b.dataset.next);
      }));
      stage().querySelectorAll('[data-obj]').forEach(b => b.addEventListener('click', () => {
        Shell.pushBranch(sectionKey + ':' + b.dataset.obj);
        playClick();
        goTo(b.dataset.obj);
      }));
    };
  }

  buildSection('situation',   'situation',   1, 5, 'problem', {
    extras: [
      { label: '🟡 "We have an agency" — deflect', to: 'deflect_agency' },
      { label: '🟡 DISENGAGED — short answers', to: 'deflect_disengaged' }
    ]
  });
  buildSection('problem',     'problem',     2, 5, 'implication', {
    extras: [
      { label: '🟡 "I stay plenty busy" — complacency', to: 'handle_complacency' },
      { label: '🟡 "Tried marketing, got burned"', to: 'handle_burned' }
    ]
  });
  buildSection('implication', 'implication', 3, 5, 'need_payoff', { quickWin: true });
  buildSection('need_payoff', 'need_payoff', 4, 5, 'decision', {});
  buildSection('decision',    'decision',    5, 5, 'closing', {
    extras: [
      { label: '🟡 "Money\'s tight right now"', to: 'stall_money' },
      { label: '🟡 "It\'s my slow/busy season"', to: 'stall_season' },
      { label: '🟡 "Gotta ask my partner"', to: 'stall_partner' },
      { label: '🟡 "Just send me info"', to: 'stall_send_info' }
    ]
  });

  // -------- MID-DIAGNOSIS HANDLERS --------
  makeHandler('handle_complacency', {
    eyebrow: 'Objection — "I stay plenty busy"',
    branchTag: 'complacency',
    get: () => scripts.objections?.complacency,
    buttons: [
      { label: '🟢 REOPENED — back to Implication', cls: 'branch-btn--green', key: '1', to: 'implication' },
      { label: '🔴 GENUINELY FINE — graceful exit', cls: 'branch-btn--red', key: '2', to: 'not_fit_exit' }
    ]
  });
  makeHandler('handle_burned', {
    eyebrow: 'Objection — "Tried marketing, wasted money"',
    branchTag: 'burned',
    get: () => scripts.objections?.burned_before,
    buttons: [
      { label: '🟢 REOPENED — back to Problem', cls: 'branch-btn--green', key: '1', to: 'problem' },
      { label: '🔴 WON\'T RISK AGAIN — graceful exit', cls: 'branch-btn--red', key: '2', to: 'not_fit_exit' }
    ]
  });

  // -------- DEFLECTION: DISENGAGED --------
  SCREENS.deflect_disengaged = () => {
    const d = scripts.deflections?.disengaged_short_answers || {};
    renderScreen(html`
      <div class="screen__eyebrow">Disengaged — short answers / seems distracted</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Say this:</b> "${tokenizeHTML(d.say_this || 'Hey {first_name} — am I catching you at a bad time? I\'d rather call back when you\'ve got 15 minutes.')}"</div>
        ${trainingNote(d.training_note || "Don't fight a distracted call. Cut it, reset, call back.")}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="situation">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 THEY RE-ENGAGED — continue</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-out="FOLLOW_UP_BOOKED">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 RESCHEDULING — book callback</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      playClick(); goTo(b.dataset.next);
    }));
    stage().querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('disengaged:reschedule');
      playClick();
      Shell.recordOutcome(b.dataset.out);
    }));
  };

  // -------- DECISION-STAGE STALLS --------
  makeHandler('stall_money', {
    eyebrow: 'Stall — "Money\'s tight right now"',
    branchTag: 'stall_money',
    get: () => scripts.objections?.money_tight,
    buttons: [
      { label: '🟢 REFRAMED — back to close', cls: 'branch-btn--green', key: '1', to: 'closing' },
      { label: '🔴 TRULY CAN\'T — graceful exit', cls: 'branch-btn--red', key: '2', to: 'not_fit_exit' }
    ]
  });
  makeHandler('stall_season', {
    eyebrow: 'Stall — "It\'s my slow/busy season"',
    branchTag: 'stall_season',
    get: () => scripts.objections?.wrong_season,
    buttons: [
      { label: '🟢 REFRAMED — back to close', cls: 'branch-btn--green', key: '1', to: 'closing' },
      { label: '🟡 PARK IT — book seasonal follow-up', cls: 'branch-btn--yellow', key: '2', out: 'FOLLOW_UP_BOOKED' }
    ]
  });
  makeHandler('stall_partner', {
    eyebrow: 'Stall — "Gotta ask my partner / wife"',
    branchTag: 'stall_partner',
    get: () => scripts.objections?.ask_partner,
    buttons: [
      { label: '🟢 LOOP THEM IN — book call w/ partner', cls: 'branch-btn--green', key: '1', out: 'FOLLOW_UP_BOOKED' },
      { label: '🟡 DECIDING SOLO NOW — back to close', cls: 'branch-btn--yellow', key: '2', to: 'closing' }
    ]
  });
  makeHandler('stall_send_info', {
    eyebrow: 'Stall — "Just send me info"',
    branchTag: 'stall_send_info',
    get: () => scripts.objections?.send_info,
    buttons: [
      { label: '🟢 EARNED A REAL STEP — back to close', cls: 'branch-btn--green', key: '1', to: 'closing' },
      { label: '🟡 INFO ONLY — send + follow up', cls: 'branch-btn--yellow', key: '2', out: 'INFO_REQUESTED' }
    ]
  });

  // -------- CLOSE-STAGE STALLS --------
  makeHandler('stall_think', {
    eyebrow: 'Stall — "Let me think about it"',
    branchTag: 'stall_think',
    get: () => scripts.objections?.think_it_over,
    buttons: [
      { label: '🟢 SURFACED THE REAL CONCERN — back to close', cls: 'branch-btn--green', key: '1', to: 'closing' },
      { label: '🟡 GENUINELY NEEDS TIME — book follow-up', cls: 'branch-btn--yellow', key: '2', out: 'FOLLOW_UP_BOOKED' }
    ]
  });
  makeHandler('stall_price_flinch', {
    eyebrow: 'Stall — Price flinch (sticker shock)',
    branchTag: 'stall_price',
    get: () => scripts.objections?.price_flinch,
    buttons: [
      { label: '🟢 RE-ANCHORED — back to close', cls: 'branch-btn--green', key: '1', to: 'closing' },
      { label: '🔴 OUT OF RANGE — graceful exit', cls: 'branch-btn--red', key: '2', to: 'not_fit_exit' }
    ]
  });

  // -------- CLOSING --------
  SCREENS.closing = () => {
    const cl = scripts.closing;
    const qw = scripts.quick_win || {};
    const proof = (hasQuickWin() && qw.close_proof)
      ? html`<div class="script-panel__line" style="margin-top:0.75rem;color:#f0985a"><b>First-move proof:</b> "${tokenizeHTML(qw.close_proof)}"</div>`
      : '';
    renderScreen(html`
      ${progress(5, 5)}
      <div class="screen__eyebrow">Close — pick your path</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Soft close:</b> "${tokenizeHTML(cl.soft_close)}"</div>
        <div class="script-panel__line" style="margin-top:0.75rem"><b>Hard close (if they're hot):</b> "${tokenizeHTML(cl.hard_close)}"</div>
        ${cl.hot_close ? html`<div class="script-panel__line" style="margin-top:0.75rem;color:#ffb27a"><b>🔥 HOT close (yes to starting):</b> "${tokenizeHTML(cl.hot_close)}"</div>` : ''}
        ${proof}
        ${trainingNote(cl.training_note || '')}
      </div>
      <div class="screen__heading">How did they land?</div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="h" data-out="HOT" style="border-color:#e36b1e;background:rgba(227,107,30,0.12)">
          <span class="branch-btn__hotkey">H</span><span class="branch-btn__label">🔥 HOT — starting this week</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="p" data-out="PROPOSAL_REQUESTED">
          <span class="branch-btn__hotkey">P</span><span class="branch-btn__label">🟢 PROPOSAL — send the doc</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="f" data-out="FOLLOW_UP_BOOKED">
          <span class="branch-btn__hotkey">F</span><span class="branch-btn__label">🟡 FOLLOW-UP — second call booked</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="i" data-out="INFO_REQUESTED">
          <span class="branch-btn__hotkey">I</span><span class="branch-btn__label">🟡 INFO — send package, follow up</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="t" data-obj="stall_think">
          <span class="branch-btn__hotkey">T</span><span class="branch-btn__label">🟡 "Let me think about it"</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="c" data-obj="stall_price_flinch">
          <span class="branch-btn__hotkey">C</span><span class="branch-btn__label">🟡 Price flinch — re-anchor</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="q" data-obj="tech_deflect" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">Q</span><span class="branch-btn__label">⚡ Tech question — deflect up</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="x" data-out="NOT_FIT">
          <span class="branch-btn__hotkey">X</span><span class="branch-btn__label">🔴 NOT A FIT — graceful exit</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('close:' + b.dataset.out);
      playClick();
      Shell.recordOutcome(b.dataset.out);
    }));
    stage().querySelectorAll('[data-obj]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('close:' + b.dataset.obj);
      playClick();
      goTo(b.dataset.obj);
    }));
  };

  // -------- NOT FIT EXIT --------
  SCREENS.not_fit_exit = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Graceful exit — save both your time</div>
      <div class="script-panel">
        <div class="script-panel__line">"${tokenizeHTML((scripts.not_fit_exit && scripts.not_fit_exit.script) || "Honestly {first_name}, based on what you just told me, I don't think I'm the right call right now — and I'd rather tell you that than waste the next 20 minutes. Here's what I'd actually suggest: [referral / resource]. No hard feelings — if things change in 6 months, you know where I am.")}"</div>
        ${trainingNote((scripts.not_fit_exit && scripts.not_fit_exit.training_note) || 'A clean exit is a long-term asset. Contractors talk. The guy who didn\'t waste their time is the guy they refer to a friend a year later.')}
      </div>
    `);
    Shell.showOutcomes('NOT_FIT');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
