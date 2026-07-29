/* ===================================================================
   UNC SALES COCKPIT — Re-Engage Content Logic
   v2.0 — 2026-07-21
   Re-engage the quiet lead. Caller = active rep (dynamic). Loads /re-engage.
   Goal: Phone → Permission → Email. Never close on this call.
   =================================================================== */

(function() {
  'use strict';

  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  const stage = () => document.querySelector('#screen-stage');

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  async function boot() {
    try {
      const r = await fetch('/sales-ops/re-engage/scripts.json', { cache: 'no-cache' });
      scripts = await r.json();
    } catch(e) {
      console.error('[re-engage] scripts.json load failed', e);
      stage().innerHTML = '<div class="script-panel"><div class="script-panel__line">Scripts failed to load. Check console.</div></div>';
      return;
    }
    await Shell.init({ cockpit: 're-engage' });
    Shell.bindNotes();
    Shell.onReset(renderStart);
    Shell.onBack(goBack);
    renderStart();
  }

  // ── Token interpolation ────────────────────────────────────────────────────
  function fill(template, contact) {
    if (!template) return '';
    contact = contact || {};
    const trade = (contact.trade_type || contact.trade || '').toLowerCase();
    const rep = (Shell.getRep ? Shell.getRep() : {}) || {};
    return template
      .replace(/\{first_name\}/g,    contact.first_name    || 'there')
      .replace(/\{business_name\}/g, contact.business_name || 'your business')
      .replace(/\{trade_lower\}/g,   trade || 'contractor')
      .replace(/\{city\}/g,          contact.city          || 'your area')
      .replace(/\{email\}/g,         contact.email         || 'your email')
      .replace(/\{ai_hook\}/g,       contact.ai_hook       || 'a gap in your online presence that’s costing you calls')
      .replace(/\{seq_touches\}/g,   contact.outreach_touch_count || '?')
      .replace(/\{rep_name\}/g,      rep.display_name || 'Ricky')
      .replace(/\{rep_phone\}/g,     rep.phone || '(515) 344-4053');
  }

  // ── Prospect card (sequence context panel) ────────────────────────────────
  function renderProspectPanel(contact) {
    const card = document.querySelector('#prospect-card');
    if (!card) return;

    const touchCount = contact.outreach_touch_count || '?';
    const hook       = contact.ai_hook || '—';
    const notes      = contact.sequence_notes || '';
    const status     = contact.sequence_status || '';

    card.hidden = false;
    card.innerHTML = `
      <div class="prospect-card__header">
        <div class="prospect-card__name">${contact.first_name || ''} ${contact.last_name || ''}</div>
        <div class="prospect-card__biz">${contact.business_name || ''}</div>
        <div class="prospect-card__meta">${contact.trade_type || ''} · ${contact.city || ''}, ${contact.state || ''}</div>
      </div>
      <div class="prospect-card__divider"></div>
      <div class="prospect-card__row">
        <span class="prospect-card__lbl">Phone</span>
        <span class="prospect-card__val">${contact.phone || '—'}</span>
      </div>
      <div class="prospect-card__row">
        <span class="prospect-card__lbl">Email</span>
        <span class="prospect-card__val">${contact.email || '—'}</span>
      </div>
      <div class="prospect-card__divider"></div>
      <div class="prospect-card__row">
        <span class="prospect-card__lbl">The Hook</span>
        <span class="prospect-card__val prospect-card__val--hook">${hook}</span>
      </div>
      <div class="prospect-card__row">
        <span class="prospect-card__lbl">Emails Sent</span>
        <span class="prospect-card__val">${touchCount} touches · no reply</span>
      </div>
      ${notes ? `<div class="prospect-card__row">
        <span class="prospect-card__lbl">Seq Notes</span>
        <span class="prospect-card__val prospect-card__val--small">${notes}</span>
      </div>` : ''}
      <div class="prospect-card__divider"></div>
      <div class="prospect-card__goal">🎯 Goal: get permission to send one thing. Confirm email. Hang up.</div>
    `;
  }

  // ── Screen helpers ─────────────────────────────────────────────────────────
  function btn(label, action, style) {
    return `<button class="branch-btn${style ? ' branch-btn--'+style : ''}" data-action="${action}">${label}</button>`;
  }

  function renderScreen(html, buttons) {
    const btns = buttons.map(b => btn(b.label, b.action, b.style)).join('');
    stage().innerHTML = `<div class="script-panel">${html}</div><div class="branch-row">${btns}</div>`;
    stage().querySelectorAll('.branch-btn').forEach(el => {
      el.addEventListener('click', () => {
        history.push(stage().innerHTML);
        dispatch(el.dataset.action);
      });
    });
  }

  function scriptLine(text) {
    return `<div class="script-panel__line">${text}</div>`;
  }

  function noteBox(text) {
    return `<div class="script-panel__note">${text}</div>`;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goBack() {
    if (history.length) stage().innerHTML = history.pop();
    bindCurrentButtons();
  }

  function bindCurrentButtons() {
    stage().querySelectorAll('.branch-btn').forEach(el => {
      el.addEventListener('click', () => {
        history.push(stage().innerHTML);
        dispatch(el.dataset.action);
      });
    });
  }

  // ── State machine ──────────────────────────────────────────────────────────
  function dispatch(action) {
    Shell.startCall && Shell.startCall();
    const contact = (Shell.getContact ? Shell.getContact() : null) || {};
    switch(action) {
      case 'start':           return renderOpener(contact);
      case 'no_leads':        return renderNoLeads(contact);
      case 'leads_fine':      return renderLeadsFine(contact);
      case 'no_answer':       return renderNoAnswer(contact);
      case 'dont_remember':   return renderDontRemember(contact);
      case 'what_is_this':    return renderWhatIsThis(contact);
      case 'get_yes':         return renderGetYes(contact);
      case 'wants_forward':   return renderWantsForward(contact);
      case 'bad_time':        return renderBadTime(contact);
      case 'voicemail':       return renderVoicemail(contact);
      case 'outcome_emailed': return Shell.recordOutcome('EMAILED');
      case 'outcome_hot':     return Shell.recordOutcome('HOT');
      case 'outcome_warm':    return Shell.recordOutcome('WARM');
      case 'outcome_cold':    return Shell.recordOutcome('COLD');
      case 'outcome_na':      return Shell.recordOutcome('NA');
      default: console.warn('[re-engage] unknown action:', action);
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────────
  function renderStart() {
    const contact = (Shell.getContact ? Shell.getContact() : null) || {};
    if (contact && contact.contact_id) renderProspectPanel(contact);

    stage().innerHTML = `
      <div class="script-panel">
        <div class="script-panel__label">Re-Engage</div>
        ${noteBox('This contact went through our email sequence and never replied. Your job: one human phone call → get permission to send them one thing → confirm the email → hang up. <strong>Do not pitch. Do not quote pricing.</strong> Underpromise, overdeliver — the goal is a yes to look, nothing more.')}
        <div class="script-panel__cta">Ready to dial?</div>
      </div>
      <div class="branch-row">
        <button class="branch-btn branch-btn--primary" data-action="start">Start Call</button>
        <button class="branch-btn" data-action="voicemail">Left Voicemail</button>
        <button class="branch-btn" data-action="outcome_na">No Answer</button>
      </div>
    `;
    stage().querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => { history.push(stage().innerHTML); dispatch(el.dataset.action); });
    });
  }

  function renderOpener(contact) {
    renderScreen(
      scriptLine(fill(scripts.opener.default, contact)),
      [
        { label: 'No / could be better',       action: 'no_leads' },
        { label: "Leads are fine / we're good", action: 'leads_fine' },
        { label: "Don't remember the emails",   action: 'dont_remember' },
        { label: 'Who is this / what do you do?', action: 'what_is_this' },
        { label: 'Wants to move forward now',   action: 'wants_forward' },
        { label: 'Bad time',                    action: 'bad_time' }
      ]
    );
  }

  function renderNoLeads(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.NO_LEADS.script, contact)) +
      noteBox('If no ai_hook is loaded — fall back to trade intel: "Ricky noticed your Google presence has some gaps that are probably costing you calls."'),
      [
        { label: 'They said yes → confirm email', action: 'get_yes', style: 'hot' },
        { label: 'Not interested',                action: 'outcome_cold' }
      ]
    );
  }

  function renderGetYes(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.GET_THE_YES.script, contact)) +
      noteBox(fill(scripts.responses.GET_THE_YES.confirm_prompt, contact)),
      [
        { label: '✅ Email confirmed — log EMAILED', action: 'outcome_emailed', style: 'hot' },
        { label: 'Wrong email — get the right one',  action: 'get_yes' },
        { label: 'They changed their mind',          action: 'outcome_cold' }
      ]
    );
  }

  function renderLeadsFine(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.LEADS_ARE_FINE.script, contact)),
      [
        { label: 'Log COLD — exit clean', action: 'outcome_cold' }
      ]
    );
  }

  function renderDontRemember(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.DONT_REMEMBER.script, contact)),
      [
        { label: 'They said yes → confirm email', action: 'get_yes', style: 'hot' },
        { label: 'Still not interested',          action: 'outcome_cold' }
      ]
    );
  }

  function renderWhatIsThis(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.WHAT_IS_THIS.script, contact)),
      [
        { label: 'They said yes → confirm email', action: 'get_yes', style: 'hot' },
        { label: 'Not interested',                action: 'outcome_cold' }
      ]
    );
  }

  function renderWantsForward(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.WANTS_TO_MOVE_FORWARD.script, contact)) +
      noteBox('⚠️ ' + scripts.responses.WANTS_TO_MOVE_FORWARD.note),
      [
        { label: '🔥 Log HOT — book Ricky discovery call', action: 'outcome_hot', style: 'hot' }
      ]
    );
  }

  function renderBadTime(contact) {
    renderScreen(
      scriptLine(fill(scripts.responses.BAD_TIME.script, contact)) +
      noteBox(scripts.responses.BAD_TIME.note),
      [
        { label: 'Got callback time — log WARM', action: 'outcome_warm', style: 'warm' },
        { label: 'Hung up',                      action: 'outcome_cold' }
      ]
    );
  }

  function renderNoAnswer(contact) {
    renderScreen(
      noteBox('No answer. Log NA — auto-cooldown applies.'),
      [
        { label: 'Log NA', action: 'outcome_na' }
      ]
    );
  }

  function renderVoicemail(contact) {
    renderScreen(
      scriptLine(fill(scripts.voicemail.script, contact)) +
      noteBox('Left VM. Log NA — system will re-queue after cooldown.'),
      [
        { label: 'Log NA — voicemail left', action: 'outcome_na' }
      ]
    );
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
