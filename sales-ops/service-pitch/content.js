/* ===================================================================
   UNC SERVICE PITCH COCKPIT — Content Logic
   v3.0 — 2026-07-21  — THE CLOSE ENGINE
   Stage: follow-up on Discovery findings (warm, already diagnosed).
   Spine: ① Bridge/Recap → ② Recommendation → ③ Value Stack
          → ④ Money Anchor (calculator) → ⑤ Assumptive Ask.
   Design law carried from Discovery: DIAGNOSTICIAN, NOT MECHANIC —
     technical "how/why" routes UP to the proposal via the deflect-up rail.
   Reads discovery_findings + avg_ticket/profit_margin (worker now returns them).
   Writes back avg_ticket, profit_margin, package_pitched, quoted_price, pitch_outcome.
   =================================================================== */
(function() {
  'use strict';
  const Shell = window.CockpitShell;
  let scripts = null;
  const history = [];
  const stage = () => document.querySelector('#screen-stage');
  let activeBundle = null;   // key into scripts.bundles
  let activeService = null;  // key into scripts.services
  let trainMode = false;
  const anchor = { ticket: null, profitMode: 'pct', profit: null }; // money-anchor state
  const SCREENS = {};

  function playClick() { try { var a = window.CockpitAudio; if (a && typeof a.play === 'function') a.play('click'); } catch (_) {} }

  async function boot() {
    try {
      scripts = await (await fetch('/sales-ops/service-pitch/scripts.json', { cache: 'no-cache' })).json();
      await Shell.init({ cockpit: 'service-pitch' });
      Shell.bindNotes();
      Shell.onReset(renderStart);
      Shell.onBack(goBack);
      trainMode = localStorage.getItem('unc_train_mode') === 'true';
      injectTrainToggle();
      injectStyles();
      // pre-fill money anchor from contact if present
      const c = Shell.getContact() || {};
      if (c.avg_ticket) anchor.ticket = parseFloat(String(c.avg_ticket).replace(/[^0-9.]/g, '')) || null;
      if (c.profit_margin) { anchor.profit = parseFloat(String(c.profit_margin).replace(/[^0-9.]/g, '')) || null; anchor.profitMode = 'pct'; }
      if (c.recommended_package) activeBundle = mapPkgToBundle(c.recommended_package);
      renderStart();
    } catch (e) {
      console.error('[service-pitch] boot failed', e);
      const s = document.querySelector('#screen-stage');
      if (s) s.innerHTML = '<div class="script-panel"><div class="script-panel__line" style="color:#ef4444;">⚠ Cockpit failed to load. Reload the page.<br><small style="opacity:0.5">' + e.message + '</small></div></div>';
    }
  }

  function mapPkgToBundle(v) {
    const m = { 'Local Authority': 'local_authority', 'Market Growth': 'market_growth', 'Total Domination': 'total_domination' };
    return m[v] || null;
  }

  function injectStyles() {
    if (document.getElementById('sp-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-style';
    st.textContent = [
      '.sp-findings{background:rgba(232,107,30,0.07);border:1px solid rgba(232,107,30,0.32);border-left:3px solid #e36b1e;border-radius:8px;padding:0.8rem 1rem;margin-bottom:0.75rem;font-size:0.9rem;white-space:pre-wrap;max-height:230px;overflow:auto;}',
      '.sp-findings b{color:#f0985a;}',
      '.sp-anchor-input{background:#0d0d0d;border:1px solid var(--color-border,#333);border-radius:8px;color:#fff;font-size:1.15rem;padding:0.5rem 0.7rem;width:150px;font-family:var(--font-head,inherit);}',
      '.sp-anchor-input:focus{outline:none;border-color:#e36b1e;}',
      '.sp-grid{width:100%;border-collapse:collapse;margin-top:0.9rem;font-size:0.95rem;}',
      '.sp-grid td{padding:0.6rem 0.7rem;border-bottom:1px solid #232323;}',
      '.sp-grid .pkg{color:#dbe8f5;}',
      '.sp-grid .jobs{color:#5fd37a;font-weight:800;text-align:right;font-family:var(--font-head,inherit);}',
      '.sp-grid tr.rec{background:rgba(232,107,30,0.10);}',
      '.sp-grid tr.rec .pkg{color:#f0985a;font-weight:700;}',
      '.sp-toggle{display:inline-flex;border:1px solid #333;border-radius:6px;overflow:hidden;margin-left:0.5rem;}',
      '.sp-toggle button{background:#141414;color:#999;border:none;padding:0.35rem 0.7rem;cursor:pointer;font-size:0.8rem;}',
      '.sp-toggle button.on{background:#e36b1e;color:#0f0f0f;font-weight:700;}'
    ].join('');
    document.head.appendChild(st);
  }

  function injectTrainToggle() {
    const hud = document.querySelector('.hud__center');
    if (!hud || document.getElementById('train-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'train-toggle'; btn.className = 'variant-mode-btn';
    btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
    btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    btn.addEventListener('click', () => {
      trainMode = !trainMode; localStorage.setItem('unc_train_mode', trainMode);
      btn.textContent = trainMode ? 'TRAIN' : 'LIVE';
      btn.style.cssText = trainMode ? 'background:rgba(96,165,250,0.15);border-color:#60a5fa;color:#60a5fa' : '';
    });
    hud.appendChild(btn);
  }
  function trainingNote(t) { return (!trainMode || !t) ? '' : `<div class="coach-note">📘 ${esc(t)}</div>`; }

  function tokens() {
    const c = Shell.getContact() || {};
    const rep = Shell.getRep ? Shell.getRep() : {};
    const svc = activeService && scripts.services[activeService] ? scripts.services[activeService] : null;
    return {
      first_name: c.first_name || 'there',
      business_name: c.business_name || 'your business',
      trade: c.trade || 'contractor',
      trade_lower: (c.trade || 'contractor').toLowerCase(),
      city: c.city || 'your area',
      state: c.state || '',
      rep_name: rep.display_name || 'Ricky',
      rep_phone: rep.phone || '(515) 344-4053',
      service_name: svc ? svc.label : '[service]',
      gbp_review_count: (c.gbp_review_count != null && c.gbp_review_count !== '') ? String(c.gbp_review_count) : null,
      quick_win: (c.quick_win && String(c.quick_win).trim()) ? c.quick_win : null,
      discovery_findings: (c.discovery_findings && String(c.discovery_findings).trim()) ? c.discovery_findings : null,
      last_call_notes: (c.last_call_notes && String(c.last_call_notes).trim()) ? c.last_call_notes : null
    };
  }
  function interp(s) { if (!s) return ''; const t = tokens(); return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|service_name|gbp_review_count|quick_win|discovery_findings|last_call_notes)\}/g, (m, k) => t[k] != null ? t[k] : m); }
  function tokenHTML(s) { return interp(s).replace(/\{[^}]+\}/g, m => `<span class="script-panel__token">${m}</span>`); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function html(strings, ...v) { let o = strings[0]; for (let i = 0; i < v.length; i++) o += String(v[i]) + strings[i + 1]; return o; }
  function renderScreen(c) { const s = stage(); s.classList.remove('active'); void s.offsetWidth; s.innerHTML = c; s.classList.add('screen', 'active'); }
  function goTo(id, opts) { const r = SCREENS[id]; if (!r) return; if (!opts || !opts.isBack) { const cur = stage().getAttribute('data-screen'); if (cur && cur !== 'start') history.push(cur); } Shell.hideOutcomes(); stage().setAttribute('data-screen', id); r(opts || {}); }
  function goBack() { if (!history.length) return renderStart(); const p = history.pop(); goTo(p, { isBack: true }); }

  function setContactField(obj) { const c = Shell.getContact() || {}; Object.assign(c, obj); Shell.setContact(c); }

  // fields helper for consistent branch button
  function branchBtn(key, cls, label, sub) {
    return html`<button class="branch-btn ${cls}" data-hotkey="${key}" data-k="${key}">
      <span class="branch-btn__hotkey">${key}</span>
      <span class="branch-btn__label">${label}</span>
      ${sub ? `<span class="branch-btn__sub">${sub}</span>` : ''}
    </button>`;
  }
  // wire buttons: map of key -> handler
  function wire(map) {
    stage().querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const fn = map[b.dataset.k]; if (!fn) return;
      playClick(); fn();
    }));
  }

  // ---------- findings block (Bridge + rail) ----------
  function findingsHTML() {
    const t = tokens();
    const body = t.discovery_findings || t.last_call_notes;
    if (!body) return `<div class="sp-findings"><b>No discovery notes on file.</b> Open with a 30-second recap of what they told you, then diagnose one gap before you pitch.</div>`;
    const qw = t.quick_win ? `\n\nQUICK WIN SPOTTED: ${t.quick_win}` : '';
    return `<div class="sp-findings"><b>📋 From their discovery call:</b>\n${esc(body)}${esc(qw)}</div>`;
  }

  // ---------- START → Bridge ----------
  function customPitchHTML() {
    const c = (Shell.getContact ? Shell.getContact() : null) || {};
    const ps = c.pitch_script && String(c.pitch_script).trim();
    if (!ps) return '';
    // Render the prepped script: plain-text field, linebreaks preserved, ## lines become section headers
    const rendered = esc(ps)
      .replace(/^## (.+)$/gm, '<div style="font-size:0.68rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-accent);margin-top:0.9rem;">$1</div>')
      .replace(/\n/g, '<br>');
    return html`
      <div class="script-panel" style="border-left-color:#22c55e;border-color:rgba(34,197,94,0.35)">
        <div style="font-size:0.68rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#22c55e;">📜 Custom pitch — built from their actual quote + their own words</div>
        <div class="script-panel__line" style="font-size:1.05rem;line-height:1.6;">${rendered}</div>
        ${trainingNote("This script was prepped from the real proposal and this prospect's prior call language. Lead with it — the generic flow below is your fallback if the call goes sideways.")}
      </div>`;
  }

  function renderStart() {
    history.length = 0;
    renderScreen(html`
      <div class="screen__eyebrow">① Bridge — open on their own words</div>
      ${customPitchHTML()}
      ${findingsHTML()}
      <div class="script-panel">
        <div class="script-panel__line"><b>Recap open:</b> "Before I get into what I'd do — let me make sure I've got this right. Last time, you told me ${tokenHTML('{business_name}')} is ${tokenHTML('leaving jobs on the table because of {quick_win}')}. Still the biggest thing on your mind, or has something moved up the list?"</div>
        ${trainingNote("Hand them their own words back. You're not remembering — you're reading it off the screen. That alone separates you from every agency that 'follows up' with a generic check-in.")}
      </div>
      <div class="branches">
        ${branchBtn('1', 'branch-btn--green', '🟢 CONFIRMED — here\'s what I\'d do', '→ Recommendation')}
        ${branchBtn('2', 'branch-btn--yellow', '🟡 Priorities shifted — re-diagnose', '→ pick what to pitch')}
        ${branchBtn('3', 'branch-btn--yellow', '⚡ Tech question', '→ deflect up')}
        ${branchBtn('4', 'branch-btn--red', '🔴 Not the right time', '→ log outcome')}
      </div>
    `);
    Shell.startCall && Shell.startCall();
    wire({
      '1': () => goTo('recommendation'),
      '2': () => goTo('selector'),
      '3': () => goTo('tech_deflect'),
      '4': () => Shell.showOutcomes('NOT_NOW')
    });
  }
  SCREENS.start = renderStart;

  // ---------- ② RECOMMENDATION ----------
  SCREENS.recommendation = () => {
    if (!activeBundle && !activeService) activeBundle = 'market_growth';
    const rec = activeBundle ? scripts.bundles[activeBundle] : null;
    const why = tokens().quick_win
      ? `It's the exact fit for what you told me — ${tokens().quick_win} is precisely what the SEO + GBP + reputation stack fixes.`
      : `It's what most of the contractors I work with run on — complete coverage without paying for pieces you don't need yet.`;
    renderScreen(html`
      <div class="screen__eyebrow">② Recommendation — one call, made with conviction</div>
      <div class="script-panel">
        ${rec ? html`
          <div class="script-panel__line" style="font-size:1.4rem;font-weight:800;color:var(--color-accent)">${esc(rec.label)} — $${rec.price.toLocaleString()}/mo</div>
          <div class="script-panel__line" style="margin-top:0.5rem"><b>Say this:</b> "Based on everything you told me, here's what I'd put ${tokenHTML('{business_name}')} on: <b>${esc(rec.label)}</b>. ${esc(why)}"</div>
          <div class="script-panel__line" style="margin-top:0.6rem;opacity:0.85">"${tokenHTML(rec.on_phone)}"</div>
          ${trainingNote("Don't present a menu — make a recommendation. You're the expert who already diagnosed them. A confident single rec closes; a buffet makes them comparison-shop.")}
        ` : html`<div class="script-panel__line">Pick what you're pitching first.</div>`}
      </div>
      <div class="branches">
        ${branchBtn('1', 'branch-btn--green', '🟢 PITCH THIS — walk the value', '→ Value stack')}
        ${branchBtn('2', 'branch-btn--yellow', '↺ Different package / service', '→ selector')}
        ${branchBtn('3', 'branch-btn--yellow', '⚡ Tech question', '→ deflect up')}
      </div>
    `);
    wire({ '1': () => goTo('value_stack'), '2': () => goTo('selector'), '3': () => goTo('tech_deflect') });
  };

  // ---------- SELECTOR (bundle or service) ----------
  SCREENS.selector = () => {
    const bundles = scripts.bundles || {};
    const bk = Object.keys(bundles).filter(k => !k.startsWith('_'));
    const services = Object.keys(scripts.services);
    renderScreen(html`
      <div class="screen__eyebrow">Pick what you're pitching</div>
      <div class="script-panel" style="padding:0.8rem 1rem"><div class="script-panel__line" style="font-size:0.9rem">Lead with a bundle when you can — it's how contractors buy and it anchors higher. Single service if they asked for something specific.</div></div>
      <div class="screen__heading" style="margin-top:0.8rem;font-size:0.8rem;opacity:0.7">BUNDLES</div>
      <div class="branches">
        ${bk.map((k, i) => { const b = bundles[k]; const badge = b.badge ? ` · ${esc(b.badge)}` : ''; return html`
          <button class="branch-btn ${k === 'market_growth' ? 'branch-btn--green' : ''}" data-b="${esc(k)}">
            <span class="branch-btn__label">📦 ${esc(b.label)} — $${b.price.toLocaleString()}/mo${badge}</span>
            <span class="branch-btn__sub">${esc(b.tagline)}</span>
          </button>`; }).join('')}
      </div>
      <div class="screen__heading" style="margin-top:0.9rem;font-size:0.8rem;opacity:0.7">SINGLE SERVICES</div>
      <div class="branches">
        ${services.map(s => { const v = scripts.services[s]; return html`
          <button class="branch-btn" data-s="${esc(s)}"><span class="branch-btn__label">🎯 ${esc(v.label)}</span><span class="branch-btn__sub">${esc(v.billing)}</span></button>`; }).join('')}
      </div>
    `);
    stage().querySelectorAll('[data-b]').forEach(el => el.addEventListener('click', () => { playClick(); activeBundle = el.dataset.b; activeService = null; Shell.pushBranch('bundle:' + activeBundle); goTo('value_stack'); }));
    stage().querySelectorAll('[data-s]').forEach(el => el.addEventListener('click', () => { playClick(); activeService = el.dataset.s; activeBundle = null; Shell.pushBranch('service:' + activeService); goTo('value_stack'); }));
  };

  // ---------- ③ VALUE STACK ----------
  SCREENS.value_stack = () => {
    const isB = !!activeBundle;
    const item = isB ? scripts.bundles[activeBundle] : scripts.services[activeService];
    if (!item) return goTo('selector');
    const price = isB ? `$${item.price.toLocaleString()}/mo` : `$${item.price_min.toLocaleString()}–$${item.price_max.toLocaleString()}`;
    const list = isB ? item.includes : item.benefits;
    renderScreen(html`
      <div class="screen__eyebrow">③ Value stack — outcomes, not mechanics · ${esc(item.label)}</div>
      <div class="script-panel">
        ${isB ? '' : html`<div class="script-panel__line" style="font-size:1.15rem;color:var(--color-accent);font-weight:700">${esc(item.tagline)}</div>`}
        ${item.on_phone ? html`<div class="script-panel__line" style="margin-top:0.5rem"><b>Say this:</b> "${tokenHTML(item.on_phone)}"</div>` : ''}
        <div class="script-panel__line" style="margin-top:0.8rem"><b>What they actually get:</b></div>
        <ul style="margin:0.2rem 0 0;padding-left:1.4rem;line-height:1.85">
          ${list.map(x => `<li style="color:var(--color-white);font-size:0.92rem">${esc(x)}</li>`).join('')}
        </ul>
        <div class="script-panel__line" style="margin-top:0.8rem;font-style:italic;opacity:0.85"><b>Proof:</b> ${esc(item.social_proof || 'Kutsch Tree got 25 leads month one. Mark at Fuehrer got a qualified lead in 24 hours.')}</div>
        <div class="script-panel__line" style="margin-top:0.8rem;padding-top:0.7rem;border-top:1px solid var(--color-border,#2a2a2a)"><b>Investment:</b> <span style="color:var(--color-accent);font-size:1.15rem;font-weight:700">${price}</span></div>
        ${trainingNote("Never explain HOW it works — describe what the car does, not the engine. Say the price plainly at the end, then go straight to the money anchor before it can hang in the air.")}
      </div>
      <div class="branches">
        ${branchBtn('1', 'branch-btn--green', '🟢 GO TO THE MONEY MATH', '→ Money anchor')}
        ${branchBtn('2', 'branch-btn--yellow', '🟡 Objection', '→ handle it')}
        ${branchBtn('3', 'branch-btn--yellow', '⚡ Tech question', '→ deflect up')}
        ${branchBtn('4', 'branch-btn--yellow', '↺ Switch package', '→ selector')}
        ${branchBtn('5', 'branch-btn--yellow', '📄 View quote', '→ quote')}
      </div>
    `);
    wire({ '1': () => goTo('money_anchor'), '2': () => goTo('objections'), '3': () => goTo('tech_deflect'), '4': () => goTo('selector'), '5': () => goTo('quote') });
  };

  // ---------- ④ MONEY ANCHOR (calculator) ----------
  function recPrice() { return activeBundle ? scripts.bundles[activeBundle].price : (activeService ? scripts.services[activeService].price_min : 0); }
  function profitPerJob() {
    if (!anchor.ticket) return null;
    if (anchor.profitMode === 'dollar') return anchor.profit || null;
    if (anchor.profit == null) return null;
    return anchor.ticket * (anchor.profit / 100);
  }
  function renderAnchorGrid() {
    const ppj = profitPerJob();
    const rows = [];
    const tiers = [
      { k: 'local_authority', label: 'Local Authority', price: 2800 },
      { k: 'market_growth', label: 'Market Growth', price: 4500 },
      { k: 'total_domination', label: 'Total Domination', price: 7500 }
    ];
    tiers.forEach(t => {
      let jobs = '—';
      if (ppj && ppj > 0) { const n = t.price / ppj; jobs = n < 1 ? 'under 1 job/mo' : (n <= 1.3 ? 'just over 1 job/mo' : (Math.ceil(n) + ' jobs/mo')); }
      const isRec = activeBundle === t.k;
      rows.push(`<tr class="${isRec ? 'rec' : ''}"><td class="pkg">${t.label} — $${t.price.toLocaleString()}/mo${isRec ? ' ◀ recommended' : ''}</td><td class="jobs">${jobs}</td></tr>`);
    });
    const el = document.querySelector('#sp-grid-body');
    if (el) el.innerHTML = rows.join('');
    const line = document.querySelector('#sp-anchor-line');
    if (line) {
      if (ppj && ppj > 0) line.innerHTML = `<b>Say it out loud:</b> "At about $${Math.round(ppj).toLocaleString()} profit a job — this covers itself in ${recPrice() && ppj ? (recPrice() / ppj < 1.3 ? 'about one job a month' : Math.ceil(recPrice() / ppj) + ' jobs a month') : ''}. Everything above that is money you're not making right now."`;
      else line.innerHTML = `<span style="opacity:0.6">Enter their average ticket and profit to see the jobs-to-cover math.</span>`;
    }
  }
  SCREENS.money_anchor = () => {
    renderScreen(html`
      <div class="screen__eyebrow">④ Money anchor — their numbers vs. your price ⚡</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Ask:</b> "Quick one so I can show you the real math — what's your average job worth, and roughly what do you keep on it after costs?"</div>
        <div style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:flex-end;margin-top:0.8rem">
          <div><div style="font-size:0.72rem;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem">Avg ticket ($)</div><input id="sp-ticket" class="sp-anchor-input" type="number" inputmode="numeric" placeholder="8000" value="${anchor.ticket || ''}"></div>
          <div>
            <div style="font-size:0.72rem;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem">Profit <span class="sp-toggle"><button id="sp-m-pct" class="${anchor.profitMode === 'pct' ? 'on' : ''}">margin %</button><button id="sp-m-dol" class="${anchor.profitMode === 'dollar' ? 'on' : ''}">$ / job</button></span></div>
            <input id="sp-profit" class="sp-anchor-input" type="number" inputmode="numeric" placeholder="${anchor.profitMode === 'pct' ? '30' : '2400'}" value="${anchor.profit || ''}">
          </div>
        </div>
        <table class="sp-grid"><tbody id="sp-grid-body"></tbody></table>
        <div class="script-panel__line" id="sp-anchor-line" style="margin-top:0.9rem"></div>
        ${trainingNote("Profit, not revenue — the spend is covered by what they keep. Let THEM say the numbers, then you read the jobs-to-cover out loud. One job a month is the whole close.")}
      </div>
      <div class="branches">
        ${branchBtn('1', 'branch-btn--green', '🟢 THEY SEE IT — go to the ask', '→ The ask')}
        ${branchBtn('2', 'branch-btn--yellow', '⬇ Right-size the tier', '→ switch package')}
        ${branchBtn('3', 'branch-btn--yellow', '🟡 Objection', '→ handle it')}
      </div>
    `);
    const ti = document.querySelector('#sp-ticket'), pi = document.querySelector('#sp-profit');
    const sync = () => { anchor.ticket = parseFloat(ti.value) || null; anchor.profit = parseFloat(pi.value) || null; renderAnchorGrid(); };
    ti.addEventListener('input', sync); pi.addEventListener('input', sync);
    document.querySelector('#sp-m-pct').addEventListener('click', () => { anchor.profitMode = 'pct'; document.querySelector('#sp-m-pct').classList.add('on'); document.querySelector('#sp-m-dol').classList.remove('on'); renderAnchorGrid(); });
    document.querySelector('#sp-m-dol').addEventListener('click', () => { anchor.profitMode = 'dollar'; document.querySelector('#sp-m-dol').classList.add('on'); document.querySelector('#sp-m-pct').classList.remove('on'); renderAnchorGrid(); });
    renderAnchorGrid();
    wire({
      '1': () => { saveAnchor(); goTo('ask'); },
      '2': () => { saveAnchor(); goTo('selector'); },
      '3': () => { saveAnchor(); goTo('objections'); }
    });
  };
  function saveAnchor() {
    const upd = {};
    if (anchor.ticket) upd.avg_ticket = anchor.ticket;
    if (anchor.profit != null) upd.profit_margin = anchor.profitMode === 'pct' ? anchor.profit : (anchor.ticket ? Math.round((anchor.profit / anchor.ticket) * 100) : anchor.profit);
    if (activeBundle) { upd.package_pitched = scripts.bundles[activeBundle].label; upd.quoted_price = scripts.bundles[activeBundle].price; upd.recommended_package = scripts.bundles[activeBundle].label; }
    else if (activeService) { upd.package_pitched = 'Single Service'; upd.quoted_price = scripts.services[activeService].price_min; }
    if (Object.keys(upd).length) setContactField(upd);
  }

  // ---------- ⑤ THE ASK ----------
  SCREENS.ask = () => {
    const isB = !!activeBundle;
    const item = isB ? scripts.bundles[activeBundle] : (activeService ? scripts.services[activeService] : null);
    const label = item ? item.label : 'this';
    const price = isB ? `$${item.price.toLocaleString()}/mo` : (item ? `$${item.price_min.toLocaleString()}–$${item.price_max.toLocaleString()}` : '');
    renderScreen(html`
      <div class="screen__eyebrow">⑤ The ask — trial close, then assumptive</div>
      <div class="script-panel">
        <div class="script-panel__line"><b>Trial close:</b> "Does that feel like it'd actually move the needle for ${tokenHTML('{business_name}')}?"</div>
        <div class="script-panel__line" style="margin-top:0.7rem;color:#ffb27a"><b>🔥 Assumptive close:</b> "Then here's what I'd do — let's get ${esc(label)} set up this week. I'll send the paperwork over today and we start the build. Sound good?"</div>
        <div class="script-panel__line" style="margin-top:0.7rem"><b>Soft close (if not fully there):</b> "Want me to put the written proposal together for ${tokenHTML('{business_name}')} at ${price} and walk you through it?"</div>
        ${tokens().quick_win ? html`<div class="script-panel__line" style="margin-top:0.7rem;color:#f0985a"><b>First move:</b> "And the very first thing we fix is what I already spotted — ${tokenHTML('{quick_win}')}. Day one, not day ninety."</div>` : ''}
        ${trainingNote("Trial close first to read the room, THEN go assumptive. The HOT close assumes the yes. Never end on 'let me know' — every path here has a date attached.")}
      </div>
      <div class="screen__heading">How did they land?</div>
      <div class="branches">
        ${branchBtn('h', 'branch-btn--green', '🔥 HOT — starting this week', '')}
        ${branchBtn('w', 'branch-btn--green', '✅ CLOSED — signed on the call', '')}
        ${branchBtn('p', 'branch-btn--green', '🟢 PROPOSAL — send the doc', '')}
        ${branchBtn('f', 'branch-btn--yellow', '🟡 FOLLOW-UP — second call booked', '')}
        ${branchBtn('t', 'branch-btn--yellow', '🟡 "Let me think" / price flinch', '→ handle it')}
        ${branchBtn('x', 'branch-btn--red', '🔴 LOST — clear no', '')}
      </div>
    `);
    const out = (code) => { saveAnchor(); appendPitchNote(code); Shell.recordOutcome(code); };
    wire({ 'h': () => out('HOT'), 'w': () => out('CLOSED_WON'), 'p': () => out('PROPOSAL_REQUESTED'), 'f': () => out('FOLLOW_UP_BOOKED'), 't': () => goTo('objections'), 'x': () => out('LOST') });
  };

  function appendPitchNote(code) {
    const ta = document.querySelector('#call-notes');
    if (!ta) return;
    const isB = !!activeBundle;
    const label = isB ? scripts.bundles[activeBundle].label : (activeService ? scripts.services[activeService].label : '—');
    const price = isB ? '$' + scripts.bundles[activeBundle].price + '/mo' : (activeService ? '$' + scripts.services[activeService].price_min : '');
    const ppj = profitPerJob();
    const block = `\n\n[PITCH] Package: ${label} @ ${price} | Ticket: ${anchor.ticket ? '$' + anchor.ticket : '?'} | Profit/job: ${ppj ? '$' + Math.round(ppj) : '?'} | Outcome: ${code}`;
    if (ta.value.indexOf('[PITCH]') < 0) { ta.value = ta.value.replace(/\s+$/, '') + block; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  // ---------- RAIL: DEFLECT-UP ----------
  SCREENS.tech_deflect = () => {
    renderScreen(html`
      <div class="screen__eyebrow" style="color:#f0985a">⚡ Tech question — deflect UP, never explain live</div>
      <div class="script-panel" style="border-color:rgba(232,101,26,0.35)">
        <div class="script-panel__line"><b>"How does it actually work?"</b> → "Great question — and it's exactly what your written proposal spells out in plain English, so you're not taking my word for it on a call. What I care about right now is getting you the result. Let me keep going —"</div>
        <div class="script-panel__line" style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.08)"><b>"Why does that get me leads?"</b> → "Short version: you show up when someone types '${tokenHTML('{trade_lower}')} near me' at 11pm and right now you don't. The exact build I scope in the proposal so I'm not overselling you on the phone."</div>
        ${trainingNote("Answer in OUTCOMES, route depth to the proposal. 'I don't quote the spec off the top of my head' reads as rigor, not ignorance. You're never the last line of technical defense — the proposal is.")}
      </div>
      <div class="branches">${branchBtn('1', 'branch-btn--green', '🟢 HANDLED — back to the pitch', '→ returns where you were')}</div>
    `);
    wire({ '1': () => goBack() });
  };

  // ---------- RAIL: OBJECTIONS ----------
  SCREENS.objections = () => {
    const objs = scripts.objection_responses || {};
    renderScreen(html`
      <div class="screen__eyebrow">Objection handler — acknowledge, then route back to the anchor or the ask</div>
      ${trainingNote("Never argue. 'Totally fair — let me ask you this…' disarms it. Every objection routes back to the money math or the close, not a dead end.")}
      <div class="script-panel script-panel--variants">
        ${Object.entries(objs).map(([k, o]) => html`<button class="variant" data-obj="${esc(k)}"><span class="variant__label">${esc(k.replace(/_/g, ' '))}</span><span class="variant__script" style="font-style:italic">"${esc(o.trigger)}"</span></button>`).join('')}
      </div>
      <div id="obj-resp" style="display:none"></div>
      <div class="branches">
        ${branchBtn('a', 'branch-btn--green', '🟢 HANDLED — back to money math', '→ anchor')}
        ${branchBtn('c', 'branch-btn--yellow', '🟡 Proceed to the ask', '→ close')}
        ${branchBtn('x', 'branch-btn--red', '🔴 Won\'t move — log it', '→ outcomes')}
      </div>
    `);
    stage().querySelectorAll('[data-obj]').forEach(b => b.addEventListener('click', () => {
      playClick(); const o = scripts.objection_responses[b.dataset.obj];
      const tgt = document.querySelector('#obj-resp');
      tgt.innerHTML = html`<div class="script-panel" style="border-left-color:#facc15;margin-top:0.8rem"><div class="screen__eyebrow" style="color:#facc15">"${esc(o.trigger)}"</div>${o.responses.map((r, i) => `<div class="script-panel__line">${i + 1}. ${tokenHTML(r)}</div>`).join('')}</div>`;
      tgt.style.display = 'block'; Shell.pushBranch('objection:' + b.dataset.obj);
    }));
    wire({ 'a': () => goTo('money_anchor'), 'c': () => goTo('ask'), 'x': () => Shell.showOutcomes('NOT_NOW') });
  };

  // ---------- RAIL: QUOTE VIEW ----------
  SCREENS.quote = () => {
    const isB = !!activeBundle;
    const item = isB ? scripts.bundles[activeBundle] : (activeService ? scripts.services[activeService] : scripts.bundles.market_growth);
    const price = isB ? `$${item.price.toLocaleString()}/mo` : (item.price_min ? `$${item.price_min.toLocaleString()}–$${item.price_max.toLocaleString()}` : '');
    const list = isB ? item.includes : (item.features || []);
    const ppj = profitPerJob();
    renderScreen(html`
      <div class="screen__eyebrow">📄 Quote — ${esc(item.label)}</div>
      <div class="script-panel">
        <div class="script-panel__line" style="font-size:1.5rem;font-weight:800;color:var(--color-accent)">${price}</div>
        <ul style="margin:0.5rem 0 0;padding-left:1.4rem;line-height:1.85">${list.map(x => `<li style="font-size:0.9rem;color:var(--color-white-dim,#ccc)">${esc(x)}</li>`).join('')}</ul>
        ${ppj ? html`<div class="script-panel__line" style="margin-top:0.8rem;color:#5fd37a"><b>Covers itself in ${recPrice() && ppj ? (recPrice() / ppj <= 1.3 ? 'about one job a month' : Math.ceil(recPrice() / ppj) + ' jobs a month') : ''}</b> at their numbers.</div>` : ''}
        <div style="margin-top:0.8rem;padding:0.7rem;background:var(--color-dark-2,#141414);border-radius:8px;font-size:0.85rem">
          <div style="color:var(--color-accent);font-weight:700;margin-bottom:0.3rem">SEND AFTER THE CALL</div>
          <div>📋 Intake: <span style="color:var(--color-accent)">urbannicheco.com/start</span></div>
          <div>💳 Deposit: <span style="color:var(--color-accent)">Stripe link (from close-and-collect)</span></div>
        </div>
      </div>
      <div class="branches">${branchBtn('1', 'branch-btn--green', '🟢 Back to the pitch', '')}</div>
    `);
    wire({ '1': () => goBack() });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
