/* UNC Renewal/Upsell Cockpit v1.0 */
(function() {
  'use strict';
function playSound(s){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play(s);}catch(_){}}
  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  const stage = () => document.querySelector('#screen-stage');

  async function boot()  {
  try {

    scripts = await (await fetch('/sales-ops/renewal-upsell/scripts.json', { cache: 'no-cache' })).json();
    await Shell.init({ cockpit: 'renewal-upsell' });
    Shell.bindNotes();
    Shell.onReset(renderStart);
    Shell.onBack(goBack);
    renderStart();
  } catch(e) {
    console.error('[renewal-upsell] boot failed', e);
    const s = document.querySelector('#screen-stage');
    if (s) s.innerHTML = '<div class="script-panel"><div class="script-panel__line" style="color:#ef4444;">⚠ Cockpit failed to load. Reload the page or check your connection.<br><small style=\"opacity:0.5\">' + e.message + '</small></div></div>';
  }
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
      pipeline_stage:   c.pipeline_stage || null
    };
  }
  function interp(s) { if (!s) return ''; const t = tokens(); return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|website|website_gaps|pipeline_stage)\}/g, (m,k) => t[k] != null ? t[k] : m); }
  function tokHTML(s) { return interp(s).replace(/\{[^}]+\}/g, m => `<span class="script-panel__token">${m}</span>`); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function html(strings, ...values) { let o = strings[0]; for (let i = 0; i < values.length; i++) o += String(values[i]) + strings[i+1]; return o; }
  function renderScreen(c) { const s = stage(); s.classList.remove('active'); void s.offsetWidth; s.innerHTML = c; s.classList.add('screen','active'); }
  function goTo(id) { const r = SCREENS[id]; if (!r) return; const c = stage().getAttribute('data-screen'); if (c && c !== 'start') history.push(c); Shell.hideOutcomes(); stage().setAttribute('data-screen', id); r(); }
  function goBack() { if (!history.length) return renderStart(); const p = history.pop(); Shell.hideOutcomes(); stage().setAttribute('data-screen', p); SCREENS[p](); }

  function note(x){if(!x)return'';return `<div class="coach-note">💡 ${esc(x)}</div>`;}

  const SCREENS = {};

  function renderStart() {
    history.length = 0;
    renderScreen(html`
      <div class="screen__eyebrow">Active client check-in</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Open with:</b> ${tokHTML(scripts.intro.default)}</div>
      </div>
      <div class="script-panel" style="border-left-color:var(--color-yellow)">
        <div class="screen__eyebrow" style="color:var(--color-yellow)">Read the first 90 seconds — what color are the signals?</div>
        <div class="script-panel__line"><b>🟢 GREEN:</b> ${scripts.health_check.GREEN_SIGNALS.map(esc).join(' · ')}</div>
        <div class="script-panel__line"><b>🟡 YELLOW:</b> ${scripts.health_check.YELLOW_SIGNALS.map(esc).join(' · ')}</div>
        <div class="script-panel__line"><b>🔴 RED:</b> ${scripts.health_check.RED_SIGNALS.map(esc).join(' · ')}</div>
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="wins_recap">
          <span class="branch-btn__hotkey">1</span><span class="branch-btn__label">🟢 GREEN — healthy</span>
          <span class="branch-btn__sub">→ Wins recap → renewal or upsell</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="intervention">
          <span class="branch-btn__hotkey">2</span><span class="branch-btn__label">🟡 YELLOW — at risk</span>
          <span class="branch-btn__sub">→ Intervention script</span>
        </button>
        <button class="branch-btn branch-btn--red" data-hotkey="3" data-next="churn_save">
          <span class="branch-btn__hotkey">3</span><span class="branch-btn__label">🔴 RED — canceling</span>
          <span class="branch-btn__sub">→ Churn save attempt</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      Shell.startCall();
      Shell.pushBranch('health:' + b.dataset.next);
      playSound('click');
      goTo(b.dataset.next);
    }));
  }
  SCREENS.start = renderStart;

  SCREENS.wins_recap = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Healthy client — recap wins, then branch</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokHTML(scripts.wins_recap.script)}</div>
        <div class="script-panel__line" style="opacity:0.7; font-style:italic">(Pull actual wins from HubSpot before the call — last 60 days of activity.)</div>
      </div>
      ${note(scripts.wins_recap.data_note)}
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="renewal_branch">
          <span class="branch-btn__hotkey">1</span><span class="branch-btn__label">🟢 RENEWAL conversation</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="2" data-next="upsell_branch">
          <span class="branch-btn__hotkey">2</span><span class="branch-btn__label">🟢 UPSELL conversation</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-out="HEALTHY">
          <span class="branch-btn__hotkey">3</span><span class="branch-btn__label">🟡 JUST CHECK-IN — log HEALTHY</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      Shell.pushBranch('wins:' + b.dataset.next);
      playSound('click');
      goTo(b.dataset.next);
    }));
    stage().querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => {
      playSound('click');
      Shell.recordOutcome(b.dataset.out);
    }));
  };

  SCREENS.renewal_branch = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Renewal pitch</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokHTML(scripts.branches.RENEWAL.script)}</div>
      </div>
      ${note(scripts.branches.RENEWAL.training_note)}
    `);
    Shell.showOutcomes('RENEWED');
  };

  SCREENS.upsell_branch = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Upsell pitch</div>
      <div class="script-panel">
        <div class="script-panel__line">${tokHTML(scripts.branches.UPSELL.script)}</div>
        <div class="script-panel__line" style="opacity:0.7"><b>Common upsell paths by current service:</b></div>
        ${Object.entries(scripts.upsell_triggers).filter(([k]) => !k.startsWith('_')).map(([s, paths]) =>
          `<div class="script-panel__line"><b>${esc(s)}:</b> ${paths.map(p => '<span style="color:var(--color-white-dim)">' + esc(p) + '</span>').join(' · ')}</div>`
        ).join('')}
      </div>
      ${note(scripts.branches.UPSELL.training_note)}
      ${scripts.upsell_scripts ? `<div style="margin:0.75rem 0;padding:0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.4rem;">Ready-To-Say Upsell Scripts</div>${Object.entries(scripts.upsell_scripts).filter(([k])=>!k.startsWith('_')).map(([k,v])=>`<div style="margin-bottom:0.6rem;"><div style="font-size:0.68rem;font-weight:700;color:var(--color-accent);text-transform:uppercase;">${esc(k.replace(/_/g,' '))}</div><div style="font-size:0.78rem;color:var(--color-white-dim);font-style:italic;">${esc(v.trigger||'')}</div><div style="font-size:0.83rem;color:var(--color-white);line-height:1.5;">"${tokHTML(v.script||'')}"</div></div>`).join('')}</div>` : ''}
    `);
    Shell.showOutcomes('UPSELL_BOOKED');
  };

  SCREENS.intervention = () => {
    renderScreen(html`
      <div class="screen__eyebrow">At-risk intervention</div>
      <div class="script-panel" style="border-left-color:var(--color-yellow)">
        <div class="script-panel__line">${tokHTML(scripts.branches.INTERVENTION.script)}</div>
      </div>
      ${note(scripts.branches.INTERVENTION.training_note)}
      <div class="screen__heading">Listen. Don't pitch. Capture the real issue verbatim.</div>
    `);
    Shell.showOutcomes('AT_RISK');
  };

  SCREENS.churn_save = () => {
    renderScreen(html`
      <div class="screen__eyebrow">Churn save — last attempt</div>
      <div class="script-panel" style="border-left-color:var(--color-red)">
        <div class="script-panel__line">${tokHTML(scripts.branches.CHURN_SAVE.script)}</div>
      </div>
      ${note(scripts.branches.CHURN_SAVE.training_note)}
    `);
    Shell.showOutcomes('CHURN_FLAGGED');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
