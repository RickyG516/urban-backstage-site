(function(){'use strict';
const Shell=window.CockpitShell;
let scripts=null;
const history=[];
const stage=()=>document.querySelector('#screen-stage');
function playClick(){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play('click');}catch(_){}}

async function boot() {
  try {

  scripts=await(await fetch('/sales-ops/proposal-walkthrough/scripts.json',{cache:'no-cache'})).json();
  await Shell.init({cockpit:'proposal-walkthrough'});
  Shell.bindNotes();
  Shell.onReset(renderStart);
  Shell.onBack(goBack);
  renderStart();
  } catch(e) {
    console.error('[proposal-walkthrough] boot failed', e);
    const s = document.querySelector('#screen-stage');
    if (s) s.innerHTML = '<div class="script-panel"><div class="script-panel__line" style="color:#ef4444;">⚠ Cockpit failed to load. Reload the page or check your connection.<br><small style=\"opacity:0.5\">' + e.message + '</small></div></div>';
  }
}

function t(){
  const c=Shell.getContact()||{};
  const rep=Shell.getRep?Shell.getRep():{};
  return{
    first_name:       c.first_name||'there',
    business_name:    c.business_name||'your business',
    trade:            c.trade||'Unknown',
    trade_lower:      (c.trade||'contractor').toLowerCase(),
    city:             c.city||'your area',
    state:            c.state||'',
    rep_name:         rep.display_name||'Ricky',
    rep_phone:        rep.phone||'(515) 344-4053',
    gbp_review_count: (c.gbp_review_count!=null&&c.gbp_review_count!=='')?String(c.gbp_review_count):null,
    quick_win:        (c.quick_win&&c.quick_win.trim())?c.quick_win:null,
    website:          c.website||null,
    website_gaps:     (c.website_gaps&&c.website_gaps.trim())?c.website_gaps:null,
    quoted_price:     c.quoted_price||null,
    package_pitched:  c.package_pitched||null,
    discovery_findings:(c.discovery_findings&&String(c.discovery_findings).trim())?c.discovery_findings:null,
    last_call_notes:  (c.last_call_notes&&String(c.last_call_notes).trim())?c.last_call_notes:null,
    pipeline_stage:   c.pipeline_stage||null
  };
}
function interp(s){if(!s)return'';const tt=t();return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|website|website_gaps|quoted_price|package_pitched|discovery_findings|last_call_notes|pipeline_stage)\}/g,(m,k)=>tt[k]!=null?tt[k]:m);}
function contextHeader(){const tt=t();const pitched=tt.package_pitched?`<div style="margin-top:0.3rem"><b style="color:#f0985a">Pitched:</b> ${esc(tt.package_pitched)}${tt.quoted_price?` @ $${esc(String(tt.quoted_price))}`:''}</div>`:'';const find=(tt.discovery_findings||tt.last_call_notes);const findBlock=find?`<div style="margin-top:0.3rem;white-space:pre-wrap;max-height:150px;overflow:auto"><b style="color:#f0985a">Their words:</b> ${esc(find)}</div>`:'';if(!pitched&&!findBlock)return'';return `<div style="background:rgba(232,107,30,0.07);border:1px solid rgba(232,107,30,0.3);border-left:3px solid #e36b1e;border-radius:8px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;font-size:0.85rem;">${pitched}${findBlock}</div>`;}
function tok(s){return interp(s).replace(/\{[^}]+\}/g,m=>`<span class="script-panel__token">${m}</span>`);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function html(strings,...values){let o=strings[0];for(let i=0;i<values.length;i++)o+=String(values[i])+strings[i+1];return o;}
function renderScreen(c){const s=stage();s.classList.remove('active');void s.offsetWidth;s.innerHTML=c;s.classList.add('screen','active');}

function trainingNote(text){return html`<div style="margin:0.5rem 0;padding:0.6rem 0.85rem;background:rgba(96,165,250,0.08);border-left:3px solid #60a5fa;border-radius:0 var(--radius-sm) var(--radius-sm) 0;font-size:0.78rem;color:#93c5fd;line-height:1.5;">💡 ${esc(text)}</div>`;}
function goTo(id){const r=SCREENS[id];if(!r)return;const c=stage().getAttribute('data-screen');if(c&&c!=='start')history.push(c);Shell.hideOutcomes();stage().setAttribute('data-screen',id);r();}
function goBack(){if(!history.length)return renderStart();const p=history.pop();Shell.hideOutcomes();stage().setAttribute('data-screen',p);SCREENS[p]&&SCREENS[p]();}

const SECTIONS=['executive_summary','scope_breakdown','pricing_section','timeline_milestones','guarantees','close'];
const SECTION_COUNT=SECTIONS.length;
const SCREENS={};
// Module-scoped state (replaces window._ globals)
let _returnFromObjSection='executive_summary';
let _currentObjScript='';
let _currentObjLabel='';

function progressDots(currentIdx){
  return SECTIONS.map((_,i)=>`<span class="discovery-dot ${i<currentIdx?'done':i===currentIdx?'active':''}"></span>`).join('');
}

function buildSection(key,idx){
  SCREENS[key]=()=>{
    const s=scripts.sections[key];
    if(!s){goTo(SECTIONS[idx+1]||'close');return;}
    const isLast=(idx===SECTION_COUNT-2);
    renderScreen(html`
      <div class="discovery-progress">${progressDots(idx)}<span class="discovery-progress__label">Section ${idx+1} of ${SECTION_COUNT-1}</span></div>
      <div class="screen__eyebrow">${esc(s.label)}</div>
      <div style="font-size:0.78rem;color:var(--color-white-dim);margin-bottom:0.5rem;">Goal: ${esc(s.goal)}</div>
      <div class="script-panel">
        <div class="script-panel__line">${tok(s.script)}</div>
      </div>
      ${s.training_note?trainingNote(s.training_note):''}
      <div style="margin:0.6rem 0;padding:0.65rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.35rem;">Key Points</div>
        ${s.talking_points.map(p=>`<div style="display:flex;gap:0.4rem;padding:0.25rem 0;font-size:0.82rem;color:var(--color-white-dim);border-bottom:1px solid var(--color-border);">
          <span style="color:var(--color-accent);font-weight:700;">→</span>
          <span>${esc(p)}</span>
        </div>`).join('')}
      </div>
      <div class="branches">
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="${SECTIONS[idx+1]||'proposal_close'}">
          <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
          <span class="branch-btn__label">🟢 ${isLast?'Delivered — move to close':'Next section'}</span>
          <span class="branch-btn__sub">${isLast?'→ Close':'→ Section '+(idx+2)+' of '+(SECTION_COUNT-1)}</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="proposal_objection" data-section="${key}">
          <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
          <span class="branch-btn__label">🟡 Question or objection</span>
          <span class="branch-btn__sub">→ Handle it then return</span>
        </button>
        <button class="branch-btn branch-btn--yellow" data-hotkey="t" data-next="tech_deflect" style="border-color:rgba(232,101,26,0.4)">
          <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">T</span>
          <span class="branch-btn__label">⚡ Tech "how does it work" — deflect up</span>
          <span class="branch-btn__sub">→ route to the doc, keep control</span>
        </button>
        ${!isLast?html`<button class="branch-btn" data-hotkey="3" data-next="proposal_close">
          <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
          <span class="branch-btn__label">⚡ Skip to close</span>
          <span class="branch-btn__sub">→ They're ready to sign</span>
        </button>`:''}
      </div>
    `);
    stage().querySelectorAll('[data-next]').forEach(b=>{
      b.addEventListener('click',()=>{
        Shell.pushBranch(key+':'+b.dataset.next);
        playClick();
        if(b.dataset.next==='proposal_objection'){
          _returnFromObjSection=key;
        }
        goTo(b.dataset.next);
      });
    });
  };
}

// Build all sections
SECTIONS.slice(0,-1).forEach((key,idx)=>buildSection(key,idx));

function renderStart(){
  history.length=0;
  renderScreen(html`
    <div class="screen__eyebrow">Proposal Walkthrough</div>
    ${contextHeader()}
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.intro.default)}</div>
    </div>
    <div style="margin:0.75rem 0;padding:0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.3rem;">6 Sections Today</div>
      ${SECTIONS.slice(0,-1).map((k,i)=>`<div style="display:flex;gap:0.4rem;padding:0.25rem 0;border-bottom:1px solid var(--color-border);font-size:0.82rem;color:var(--color-white-dim);">
        <span style="color:var(--color-accent);font-weight:700;min-width:1.2rem;">${i+1}.</span>
        <span>${esc(scripts.sections[k]?scripts.sections[k].label:k)}</span>
      </div>`).join('')}
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="executive_summary">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Start Walkthrough</span>
        <span class="branch-btn__sub">→ Section 1: Executive Summary</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.startCall();playClick();goTo(b.dataset.next);}));
}
SCREENS.start=renderStart;

SCREENS.tech_deflect=()=>{
  renderScreen(html`
    <div class="screen__eyebrow" style="color:#f0985a">⚡ Tech question — deflect UP, don't explain live</div>
    <div class="script-panel" style="border-color:rgba(232,101,26,0.35)">
      <div class="script-panel__line"><b>"How does that actually work?"</b> → "Great question — and the full technical breakdown is written right into the proposal so you've got it in plain English, not just my word on a call. My delivery team scopes the exact build so I'm never overselling you. What matters for you is the outcome — let me keep walking it."</div>
      <div class="script-panel__line" style="margin-top:0.6rem;opacity:0.85"><b>Why it works:</b> answer in outcomes, route the mechanics to the written doc and the specialist. You're never the last line of technical defense — the proposal is.</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-back="1">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Handled — back to the walkthrough</span>
        <span class="branch-btn__sub">→ returns where you were</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{playClick();goBack();}));
};

SCREENS.proposal_objection=()=>{
  const OBJECTIONS=[
    {key:'price_high',label:'Price is too high',script:'What were you expecting? ... [let them anchor] ... What\u2019s your average job ticket? That\u2019s what one extra job a month covers.'},
    {key:'need_to_think',label:'Need to think about it',script:'What specifically do you need to think about? I\u2019d rather talk through it now than have it sit.'},
    {key:'spouse_partner',label:'Need to talk to spouse / partner',script:'Totally fair. When can the three of us get on a call? I\u2019d rather answer their questions directly than play telephone.'},
    {key:'tried_before',label:'Tried marketing before \u2014 didn\u2019t work',script:'What did you try? Because most of what gets sold to contractors doesn\u2019t work. I only do local contractors \u2014 that\u2019s the whole business.'},
    {key:'too_busy',label:'Too busy to onboard right now',script:'The onboarding is 20 minutes and we handle everything after that. You don\u2019t need bandwidth \u2014 you need to send me access credentials.'},
    {key:'not_sure_need_it',label:'Not sure I need this',script:'You\u2019re getting jobs now \u2014 I get it. The question is whether your pipeline is predictable. Is it?'},
    {key:'competitor_cheaper',label:'Competitor is cheaper',script:'What are they offering? Because most agencies that work cheap are templated. I build everything specific to your trade and your market.'}
  ];
  renderScreen(html`
    <div class="screen__eyebrow">Objection During Proposal — Handle It</div>
    <div style="margin-bottom:0.5rem;font-size:0.8rem;color:var(--color-white-dim);">Pick the objection. Handle it. Then go back to where you were.</div>
    ${OBJECTIONS.map((o,i)=>`
      <button class="branch-btn" data-hotkey="${i+1}" data-obj-key="${o.key}" style="margin-bottom:0.3rem;">
        <span class="branch-btn__hotkey" style="font-size:0.95rem;font-weight:900;">${i+1}</span>
        <span class="branch-btn__label">${esc(o.label)}</span>
      </button>`).join('')}
  `);
  stage().querySelectorAll('[data-obj-key]').forEach(b=>{
    b.addEventListener('click',()=>{
      const key=b.dataset.objKey;
      const obj=OBJECTIONS.find(o=>o.key===key);
      if(!obj)return;
      Shell.pushBranch('proposal_obj:'+key);
      playClick();
      goTo('proposal_obj_handle');
      _currentObjScript=obj.script;
      _currentObjLabel=obj.label;
    });
  });
};

SCREENS.proposal_obj_handle=()=>{
  const returnTo=_returnFromObjSection||'executive_summary';
  renderScreen(html`
    <div class="screen__eyebrow">Handle: ${esc(_currentObjLabel||'Objection')}</div>
    <div class="script-panel">
      <div class="script-panel__line">${esc(_currentObjScript||'')}</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="${returnTo}">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Handled — back to proposal</span>
        <span class="branch-btn__sub">→ Return to where you were</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="2" data-next="proposal_close">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🔴 Not resolved — go to close</span>
        <span class="branch-btn__sub">→ Force the decision</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{playClick();goTo(b.dataset.next);}));
};

SCREENS.proposal_close=SCREENS.close=()=>{
  const cl=scripts.sections&&scripts.sections.close;
  renderScreen(html`
    <div class="discovery-progress">${progressDots(SECTION_COUNT-1)}<span class="discovery-progress__label">Close</span></div>
    <div class="screen__eyebrow">Close — Get the Decision</div>
    <div class="script-panel">
      ${cl&&cl.talking_points?cl.talking_points.map(p=>`<div class="script-panel__line">• ${esc(p)}</div>`).join(''):'<div class="script-panel__line">So — based on everything we just walked through, does this feel like the right fit for where {business_name} is headed?</div>'}
    </div>
    <div style="margin:0.5rem 0;padding:0.65rem;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);font-size:0.82rem;color:#86efac;">
      Shut up after you ask the close question. The first person to talk loses.
    </div>
  `);
  Shell.showOutcomes('SIGNED');
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
