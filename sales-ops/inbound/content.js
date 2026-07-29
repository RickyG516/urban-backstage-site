/* ===================================================================
   UNC SALES COCKPIT — Inbound Content Logic
   v1.0 — 2026-05-12
   Speed-to-lead handling for inbound form submissions / DM replies.
   =================================================================== */

(function() {
  'use strict';
function playSound(s){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play(s);}catch(_){}}
  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  let trainMode = false;
  const stage = () => document.querySelector('#screen-stage');

  async function boot() {
    try {
      scripts = await (await fetch('/sales-ops/inbound/scripts.json', { cache: 'no-cache' })).json();
    } catch(e) {
      console.error('[inbound] scripts.json load failed', e);
      return;
    }
    await Shell.init({ cockpit: 'inbound' });
    Shell.bindNotes();
    Shell.onReset(renderStart);
    Shell.onBack(goBack);
    trainMode = localStorage.getItem('unc_train_mode') === 'true';
    injectTrainToggle();
    renderStart();
  }

  function injectTrainToggle() {
    const hud = document.querySelector('.hud__center');
    if (!hud || document.getElementById('train-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'train-toggle'; btn.className = 'variant-mode-btn';
    btn.title = 'Toggle Training Mode'; btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
    btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    btn.addEventListener('click', () => {
      trainMode = !trainMode; localStorage.setItem('unc_train_mode', trainMode);
      btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
      btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    });
    hud.appendChild(btn);
  }
  function trainingNote(text) {
    if (!trainMode || !text) return '';
    return `<div class="coach-note">📘 ${text}</div>`;
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
      service_interest: (c.service_interest || c.inbound_source || 'what we do'),
      gbp_review_count: (c.gbp_review_count != null && c.gbp_review_count !== '') ? String(c.gbp_review_count) : null,
      quick_win:        (c.quick_win && c.quick_win.trim()) ? c.quick_win : null,
      website:          c.website || null,
      website_gaps:     (c.website_gaps && c.website_gaps.trim()) ? c.website_gaps : null,
      ai_hook:          (c.ai_hook && c.ai_hook.trim()) ? c.ai_hook : null,
      pipeline_stage:   c.pipeline_stage || null
    };
  }
  function interpolate(s) {
    if (!s) return '';
    const t = tokens();
    return s.replace(/\{(first_name|business_name|rep_name|trade|trade_lower|city|state|service_interest|rep_phone|gbp_review_count|quick_win|website|website_gaps|ai_hook|pipeline_stage)\}/g, (m, k) => t[k] != null ? t[k] : m);
  }
  function tokenizeHTML(s) {
    return interpolate(s).replace(/\{[^}]+\}/g, m => `<span class="script-panel__token">${m}</span>`);
  }
  function escapeHTML(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function html(strings, ...values) { let o = strings[0]; for (let i = 0; i < values.length; i++) o += String(values[i]) + strings[i+1]; return o; }
  function renderScreen(c) { const s = stage(); s.classList.remove('active'); void s.offsetWidth; s.innerHTML = c; s.classList.add('screen','active'); }
  function goTo(id, opts) { const r = SCREENS[id]; if (!r) return; if (!opts || !opts.isBack) { const c = stage().getAttribute('data-screen'); if (c && c !== 'start') history.push(c); } Shell.hideOutcomes(); stage().setAttribute('data-screen', id); r(opts || {}); }
  function goBack() { if (!history.length) return renderStart(); const p = history.pop(); goTo(p, { isBack: true }); }

  // Speed-to-lead badge — time since form submission
  function speedBadgeHTML() {
    const c = Shell.getContact() || {};
    if (!c.inbound_timestamp) return '';
    const elapsed = Date.now() - new Date(c.inbound_timestamp).getTime();
    const totalSec = Math.floor(elapsed / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    let tier, label;
    const mmss = min + ':' + String(sec).padStart(2, '0');
    if (min < 5)         { tier = 'green';  label = `${mmss} — 🔥 HOT — they may still be on your site. Answer window closing.`; }
    else if (min < 60)   { tier = 'yellow'; label = `${min} min — 🟡 WARM (still in research mode)`; }
    else if (min < 1440) { tier = 'grey';   label = `${Math.floor(min/60)}h — 🔵 COOL (lead with email first)`; }
    else                 { tier = 'red';    label = `${Math.floor(min/1440)}d — ⚪ COLD (re-warm before calling)`; }
    return `<div class="speed-badge speed-badge--${tier}" id="speed-badge-live">⏱ Inbound ${label}</div>`;
  }
  function speedBadge() {
    // Live countdown — re-renders the badge every second while the lead is under 5 min old
    if (window.__speedTick) clearInterval(window.__speedTick);
    window.__speedTick = setInterval(() => {
      const el = document.getElementById('speed-badge-live');
      if (!el) { clearInterval(window.__speedTick); window.__speedTick = null; return; }
      const html = speedBadgeHTML();
      if (html) el.outerHTML = html;
    }, 1000);
    return speedBadgeHTML();
  }

  const SCREENS = {};

  function wireObjRail(tag) {
    stage().querySelectorAll('[data-objrail]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch(tag + ':objection');
      playSound('click');
      goTo('objection_rail');
    }));
  }

  function renderStart() {
    history.length = 0;
    const c = Shell.getContact() || {};
    const formMsg = c.form_message ? `<div class="script-panel" style="border-left-color:#facc15"><div class="screen__eyebrow" style="color:#facc15">What they wrote (verbatim)</div><div class="script-panel__line" style="font-size:1.1rem; font-style:italic; opacity:0.92">"${escapeHTML(c.form_message)}"</div><div class="script-panel__line" style="font-size:0.78rem;color:var(--color-white-dim);margin-top:0.3rem;">Open on THEIR words — quote this back in your first 20 seconds. Their own words beat any script.</div></div>` : '';
    const srcLine = (c.inbound_source || c.service_interest) ? `<div style="font-size:0.75rem;color:var(--color-white-dim);margin-bottom:0.35rem;"><b style="color:var(--color-accent);">Source:</b> ${escapeHTML(c.inbound_source || '')}${c.inbound_source && c.service_interest ? ' · ' : ''}${escapeHTML(c.service_interest || '')} <span style="opacity:0.7">— log where it came from in the notes if missing</span></div>` : '';
    renderScreen(html`
      ${speedBadge()}
      <div class="screen__eyebrow">Inbound lead — first to respond wins</div>
      ${srcLine}
      ${formMsg}
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(scripts.intro.default)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-branch="connected">
          <span class="branch-btn__hotkey">1</span>
          <span class="branch-btn__label">🟢 CONNECTED</span>
          <span class="branch-btn__sub">They picked up — go to qualifier</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-branch="voicemail">
          <span class="branch-btn__hotkey">2</span>
          <span class="branch-btn__label">🟡 VOICEMAIL</span>
          <span class="branch-btn__sub">VM — leave the speed-to-lead voicemail</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-branch="no_pickup">
          <span class="branch-btn__hotkey">3</span>
          <span class="branch-btn__label">🔴 NO PICKUP</span>
          <span class="branch-btn__sub">No answer, no VM. Logs NO_PICKUP.</span>
        </button>
        <button class="branch-btn" data-hotkey="4" data-branch="spam">
          <span class="branch-btn__hotkey">4</span>
          <span class="branch-btn__label">⚫ SPAM/BOT</span>
          <span class="branch-btn__sub">Form spam — auto-disqualify</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-branch]').forEach(b => b.addEventListener('click', () => {
      Shell.startCall();
      const w = b.dataset.branch;
      Shell.pushBranch(w);
      playSound('click');
      if (w === 'connected') goTo('qualifier_Q1');
      else if (w === 'voicemail') goTo('voicemail_screen');
      else if (w === 'no_pickup') Shell.recordOutcome('NO_PICKUP');
      else if (w === 'spam') Shell.recordOutcome('SPAM');
    }));
  }
  SCREENS.start = renderStart;

  SCREENS.voicemail_screen = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Voicemail script — keep it under 20 seconds</div>
      <div class="script-panel">
        <div class="script-panel__line">"Hey ${tokens().first_name}, this is ${tokens().rep_name} from Urban Niche Co. — just calling back on the form you filled out about ${tokens().service_interest}. Quick voicemail — text me back at ${tokens().rep_phone} with a good time today and I'll do a free 90-second audit before we even get on a call. Talk soon."</div>
      </div>
      <div class="screen__heading">After leaving the VM, log the outcome below — NO PICKUP is the default for a VM left.</div>
    `);
    Shell.showOutcomes('NO_PICKUP');
  };

  SCREENS.qualifier_Q1 = () => {
    const q = scripts.qualifier.Q1;
    renderScreen(html`
      <div class="screen__eyebrow">Qualifier 1 of 3 · ${escapeHTML(q.label)}</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(q.script)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="g" data-next="Q2" data-answer="urgent">
          <span class="branch-btn__hotkey">G</span><span class="branch-btn__label">🟢 URGENT — next 30 days</span><span class="branch-btn__sub">→ Q2</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="y" data-next="Q2" data-answer="researching">
          <span class="branch-btn__hotkey">Y</span><span class="branch-btn__label">🟡 RESEARCHING — for later</span><span class="branch-btn__sub">→ Q2 (consider nurture)</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="r" data-branch="nurture_exit">
          <span class="branch-btn__hotkey">R</span><span class="branch-btn__label">🔴 NOT NOW — just curious</span><span class="branch-btn__sub">→ Nurture / soft exit</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="o" data-objrail="1" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">O</span><span class="branch-btn__label">⚡ OBJECTION — handle it</span><span class="branch-btn__sub">→ Returns here after</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('Q1:' + b.dataset.answer);
      playSound('click');
      goTo('qualifier_Q2');
    }));
    stage().querySelectorAll('[data-branch="nurture_exit"]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('Q1:not_now');
      playSound('click');
      goTo('nurture_offer');
    }));
    wireObjRail('Q1');
  };

  SCREENS.qualifier_Q2 = () => {
    const q = scripts.qualifier.Q2;
    renderScreen(html`
      <div class="screen__eyebrow">Qualifier 2 of 3 · ${escapeHTML(q.label)}</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(q.script)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="g" data-answer="sole_dm">
          <span class="branch-btn__hotkey">G</span><span class="branch-btn__label">🟢 YES — they decide</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="y" data-answer="partnered">
          <span class="branch-btn__hotkey">Y</span><span class="branch-btn__label">🟡 PARTNER — they consult someone</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="r" data-answer="not_dm">
          <span class="branch-btn__hotkey">R</span><span class="branch-btn__label">🔴 NO — not their call</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="o" data-objrail="1" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">O</span><span class="branch-btn__label">⚡ OBJECTION — handle it</span><span class="branch-btn__sub">→ Returns here after</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('Q2:' + b.dataset.answer);
      playSound('click');
      goTo('qualifier_Q3');
    }));
    wireObjRail('Q2');
  };

  SCREENS.qualifier_Q3 = () => {
    const q = scripts.qualifier.Q3;
    renderScreen(html`
      <div class="screen__eyebrow">Qualifier 3 of 3 · ${escapeHTML(q.label)}</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(q.script)}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="g" data-branch="book">
          <span class="branch-btn__hotkey">G</span><span class="branch-btn__label">🟢 IN BUDGET — book it</span><span class="branch-btn__sub">→ Schedule audit/discovery</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="y" data-branch="info_send">
          <span class="branch-btn__hotkey">Y</span><span class="branch-btn__label">🟡 STRETCH — send audit info</span><span class="branch-btn__sub">→ Send proof, follow up in 3 days</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="r" data-branch="disqualify">
          <span class="branch-btn__hotkey">R</span><span class="branch-btn__label">🔴 WAY OFF — disqualify</span><span class="branch-btn__sub">→ Polite exit, refer to free resources</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="o" data-objrail="1" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey">O</span><span class="branch-btn__label">⚡ OBJECTION — handle it</span><span class="branch-btn__sub">→ Returns here after</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-branch]').forEach(b => b.addEventListener('click', () => {
      const w = b.dataset.branch;
      Shell.pushBranch('Q3:' + w);
      playSound('click');
      if (w === 'book') goTo('book_screen');
      else if (w === 'info_send') goTo('info_send');
      else if (w === 'disqualify') goTo('disqualify_screen');
    }));
    wireObjRail('Q3');
  };

  // Objection rail — reachable from every qualifier + book screen. Returns to where you were.
  SCREENS.objection_rail = () => {
    const objs = scripts.objections || {};
    const keys = Object.keys(objs).filter(k => !k.startsWith('_'));
    renderScreen(html`
      <div class="screen__eyebrow" style="color:#f0985a">⚡ Objection — handle it, then get back on track</div>
      <div class="script-panel" style="border-color:rgba(232,101,26,0.35)">
        ${keys.map(k => html`
          <div class="script-panel__line" style="margin-bottom:0.85rem;"><b>"${escapeHTML(objs[k].trigger || k)}"</b><br>→ "${tokenizeHTML(objs[k].response || '')}"</div>`).join('')}
        ${trainingNote('Handle the objection, then return to the exact question you were on. Never let an objection end the call — an inbound lead already raised their hand.')}
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
      Shell.pushBranch('objection_rail:back');
      playSound('click');
      goBack();
    }));
  };

  SCREENS.book_screen = () => {
    const b = scripts.branches.BOOK;
    const rep = Shell.getRep ? Shell.getRep() : {};
    const bookingUrl = rep.booking_url || 'https://urbannicheco.com/audit';
    renderScreen(html`
      <div class="screen__eyebrow">Book the audit — strike while it's hot</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(b.script)}</div>
      </div>
      <div class="screen__heading">Book: <a href="${escapeHTML(bookingUrl)}" target="_blank" rel="noopener" style="color:var(--color-accent)">${escapeHTML(bookingUrl)}</a></div>
    `);
    Shell.showOutcomes('BOOKED');
  };

  SCREENS.info_send = () => {
    const b = scripts.branches.INFO;
    renderScreen(html`
      <div class="screen__eyebrow">Send the audit info package</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(b.script)}</div>
      </div>
    `);
    Shell.showOutcomes('INFO_SENT');
  };

  SCREENS.nurture_offer = () => {
    const b = scripts.branches.NURTURE;
    renderScreen(html`
      <div class="screen__eyebrow">Drop into nurture — keep the relationship</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(b.script)}</div>
      </div>
    `);
    Shell.showOutcomes('NURTURE_QUEUED');
  };

  SCREENS.disqualify_screen = () => {
    const b = scripts.branches.DISQUALIFY;
    renderScreen(html`
      <div class="screen__eyebrow">Polite exit — not a fit</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokenizeHTML(b.script)}</div>
      </div>
    `);
    Shell.showOutcomes('DISQUALIFIED');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
