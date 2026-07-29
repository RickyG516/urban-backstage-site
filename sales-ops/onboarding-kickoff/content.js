(function(){'use strict';
function playSound(s){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play(s);}catch(_){}}
const Shell=window.CockpitShell;
let scripts=null;
const history=[];
const stage=()=>document.querySelector('#screen-stage');

async function boot() {
  try {

  scripts=await(await fetch('/sales-ops/onboarding-kickoff/scripts.json',{cache:'no-cache'})).json();
  await Shell.init({cockpit:'onboarding-kickoff'});
  Shell.bindNotes();
  Shell.onReset(renderStart);
  Shell.onBack(goBack);
  renderStart();
  } catch(e) {
    console.error('[onboarding-kickoff] boot failed', e);
    const s = document.querySelector('#screen-stage');
    if (s) s.innerHTML = '<div class="script-panel"><div class="script-panel__line" style="color:#ef4444;">⚠ Cockpit failed to load. Reload the page or check your connection.<br><small style=\"opacity:0.5\">' + e.message + '</small></div></div>';
  }
}

function t(){
  const c=Shell.getContact()||{};
  const r=Shell.getRep?Shell.getRep():{};
  return{
    first_name:       c.first_name||'there',
    business_name:    c.business_name||'your business',
    trade:            c.trade||'Unknown',
    trade_lower:      (c.trade||'contractor').toLowerCase(),
    city:             c.city||'your area',
    state:            c.state||'',
    rep_name:         r.display_name||'Ricky',
    rep_phone:        r.phone||'(515) 344-4053',
    gbp_review_count: (c.gbp_review_count!=null&&c.gbp_review_count!=='')?String(c.gbp_review_count):null,
    quick_win:        (c.quick_win&&c.quick_win.trim())?c.quick_win:null,
    website:          c.website||null,
    website_gaps:     (c.website_gaps&&c.website_gaps.trim())?c.website_gaps:null,
    pipeline_stage:   c.pipeline_stage||null
  };
}

function interp(s){
  if(!s)return'';
  const tt=t();
  return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|website|website_gaps|pipeline_stage)\}/g,(m,k)=>tt[k]!=null?tt[k]:m);
}

function tok(s){
  return interp(s).replace(/\{[^}]+\}/g,m=>`<span class="script-panel__token">${m}</span>`);
}

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function html(strings,...values){let o=strings[0];for(let i=0;i<values.length;i++)o+=String(values[i])+strings[i+1];return o;}

function renderScreen(c){
  const s=stage();
  s.classList.remove('active');
  void s.offsetWidth;
  s.innerHTML=c;
  s.classList.add('screen','active');
}



function trainingNote(text){
  if(!text)return'';
  return html`<div class="coach-note">💡 ${esc(text)}</div>`;
}

function goTo(id,opts){
  const r=SCREENS[id];
  if(!r)return;
  const c=stage().getAttribute('data-screen');
  if(c&&c!=='start')history.push(c);
  Shell.hideOutcomes();
  stage().setAttribute('data-screen',id);
  r(opts);
}

function goBack(){
  if(!history.length)return renderStart();
  const p=history.pop();
  Shell.hideOutcomes();
  stage().setAttribute('data-screen',p);
  SCREENS[p]&&SCREENS[p]();
}

const SCREENS={};

function renderStart(){
  history.length=0;
  const s=scripts;
  const agenda=s.agenda.items;
  renderScreen(html`
    <div class="screen__eyebrow">Onboarding Kickoff — New Client</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(s.intro.default)}</div>
    </div>
    ${trainingNote(s.intro.training_note)}
    <div class="script-panel" style="margin-top:0.5rem;">
      <div class="script-panel__line"><b>Say the agenda out loud:</b> ${tok(s.agenda.script)}</div>
    </div>
    ${trainingNote(s.agenda.training_note)}
    <div style="margin:0.75rem 0;padding:0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.4rem;">Today's Agenda</div>
      ${agenda.map((a,i)=>`<div style="display:flex;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--color-border);font-size:0.83rem;"><span style="color:var(--color-accent);font-weight:700;min-width:1.2rem;">${i+1}.</span><span>${esc(a)}</span></div>`).join('')}
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="access">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 They're in — start with access</span>
        <span class="branch-btn__sub">→ Platform access checklist</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="2" data-next="remorse">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🔴 Sensing hesitation / remorse</span>
        <span class="branch-btn__sub">→ Address it now</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
    Shell.startCall();
    playSound('click');
    goTo(b.dataset.next);
  }));
}
SCREENS.start=renderStart;

SCREENS.access=()=>{
  const ac=scripts.access_checklist;
  const items=ac.items;
  let checkedItems=new Set();

  function render(){
    renderScreen(html`
      <div class="screen__eyebrow">Section 1 of 5 — Platform Access</div>
      <div class="script-panel">
        <div class="script-panel__line">${tok(ac.script)}</div>
      </div>
      ${trainingNote(ac.training_note)}
      <div style="margin:0.75rem 0;">
        ${items.map((item,i)=>`
          <div class="access-item" data-idx="${i}" style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.5rem 0.75rem;border-radius:var(--radius-sm);margin-bottom:0.3rem;cursor:pointer;background:${checkedItems.has(i)?'rgba(34,197,94,0.08)':'var(--color-dark-2)'};border:1px solid ${checkedItems.has(i)?'rgba(34,197,94,0.3)':'var(--color-border)'};">
            <span style="font-size:1rem;margin-top:0.05rem;">${checkedItems.has(i)?'✅':'⬜'}</span>
            <span style="font-size:0.83rem;color:${checkedItems.has(i)?'var(--color-white)':'var(--color-white-dim)'};">${esc(item)}</span>
          </div>`).join('')}
      </div>
      <div style="font-size:0.78rem;color:var(--color-white-dim);margin-bottom:0.5rem;">Click each item as you collect access. ${checkedItems.size}/${items.length} collected.</div>
      <div class="branches">
        <button class="branch-btn branch-btn--yellow" data-hotkey="r" data-next="access_resist">
          <span class="branch-btn__hotkey" style="font-size:0.9rem;font-weight:900;">R</span>
          <span class="branch-btn__label">⚠ They're resisting access</span>
          <span class="branch-btn__sub">→ Screenshare offer</span>
        </button>
        <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="brand">
          <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
          <span class="branch-btn__label">🟢 Access collected — next section</span>
          <span class="branch-btn__sub">→ Brand + assets</span>
        </button>
      </div>
    `);
    stage().querySelectorAll('.access-item').forEach(el=>{
      el.addEventListener('click',()=>{
        const idx=parseInt(el.dataset.idx);
        if(checkedItems.has(idx))checkedItems.delete(idx);
        else checkedItems.add(idx);
        render();
      });
    });
    stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
      Shell.pushBranch('access:'+b.dataset.next+':'+checkedItems.size+'/'+items.length);
      playSound('click');
      goTo(b.dataset.next);
    }));
  }
  render();
};

SCREENS.access_resist=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Access resistance — screenshare offer</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.access_checklist.if_they_resist_access)}</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="brand">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Screenshare worked — access given</span>
        <span class="branch-btn__sub">→ Brand section</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-outcome="ACCESS_BLOCKED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 Still blocked — follow up async</span>
        <span class="branch-btn__sub">Log ACCESS_BLOCKED</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.brand=()=>{
  const br=scripts.brand_section;
  renderScreen(html`
    <div class="screen__eyebrow">Section 2 of 5 — Brand + Assets</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(br.script)}</div>
    </div>
    ${trainingNote(br.training_note)}
    <div style="margin:0.75rem 0;padding:0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.4rem;">Capture These</div>
      ${br.what_to_capture.map(c=>`<div style="padding:0.3rem 0;border-bottom:1px solid var(--color-border);font-size:0.82rem;color:var(--color-white-dim);">• ${esc(c)}</div>`).join('')}
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="month_one">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Brand captured — next section</span>
        <span class="branch-btn__sub">→ Month 1 outcomes</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('brand:complete');playSound('click');goTo(b.dataset.next);}));
};

SCREENS.month_one=()=>{
  const mo=scripts.month_one_outcomes;
  renderScreen(html`
    <div class="screen__eyebrow">Section 3 of 5 — Month 1 Success Criteria</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(mo.script)}</div>
    </div>
    ${trainingNote(mo.training_note)}
    <div style="margin:0.75rem 0;padding:0.75rem;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);">
      <div style="font-size:0.72rem;font-weight:700;color:#22c55e;margin-bottom:0.3rem;">Why this matters</div>
      <div style="font-size:0.82rem;color:var(--color-white-dim);line-height:1.5;">They set the bar — not you. If they say "5 new leads" and you get 3, you underdelivered. If they say "rank better on Google" and you move from page 3 to page 2, that's a documented win.</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="comms">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Got their 3 outcomes — next</span>
        <span class="branch-btn__sub">→ Communication rhythm</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('month_one:captured');playSound('click');goTo(b.dataset.next);}));
};

SCREENS.comms=()=>{
  const cr=scripts.communication_rhythm;
  renderScreen(html`
    <div class="screen__eyebrow">Section 4 of 5 — Communication Rhythm</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(cr.script)}</div>
    </div>
    ${trainingNote(cr.training_note)}
    <div style="margin:0.75rem 0;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
      <div style="padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.2rem;">Weekly Update</div>
        <div style="font-size:0.8rem;color:var(--color-white);">Every Monday — short, specific, what went out + what's next</div>
      </div>
      <div style="padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.2rem;">Monthly Report</div>
        <div style="font-size:0.8rem;color:var(--color-white);">1st of each month — full picture</div>
      </div>
      <div style="padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.2rem;">Urgent</div>
        <div style="font-size:0.8rem;color:var(--color-white);">Text directly — no email for urgent</div>
      </div>
      <div style="padding:0.6rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.2rem;">Their Job</div>
        <div style="font-size:0.8rem;color:var(--color-white);">Send assets, respond to access requests, review deliverables</div>
      </div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="close_kickoff">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Comms locked in — close out</span>
        <span class="branch-btn__sub">→ Final close + next steps</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('comms:confirmed');playSound('click');goTo(b.dataset.next);}));
};

SCREENS.close_kickoff=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Section 5 of 5 — Close + Next Steps</div>
    <div class="script-panel">
      <div class="script-panel__line">Alright — that's everything I need to hit the ground running. Here's what happens next, and I want to be straight about it: week one is setup — access, research, foundations. You won't see results in week one, and anyone who promises you that is lying. What you WILL see: the first deliverable by end of week, and your first Monday update showing exactly what got done. If anything comes up between now and then, text me directly. Any questions before we hang up?</div>
      ${trainingNote('This is where underpromise/overdeliver lives. Set the expectation HARD that week 1 is setup, not results — so every result that shows up later lands as a win instead of a relief. The client who expects nothing in week 1 and gets a deliverable is thrilled. The client who expects leads in week 1 is already drafting the cancellation email.')}
    </div>
    <div style="margin:0.75rem 0;padding:0.75rem;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);">
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#22c55e;margin-bottom:0.3rem;">Send After Call</div>
      <div style="font-size:0.82rem;color:var(--color-white-dim);line-height:1.5;">
        ✅ Intake form link if assets not yet received<br>
        ✅ Calendar invite for month 1 review<br>
        ✅ Your direct cell number in a text<br>
        ✅ Note in HubSpot with all items captured
      </div>
    </div>
  `);
  Shell.showOutcomes('KICKED_OFF');
};

SCREENS.remorse=()=>{
  const br=scripts.buyers_remorse_save;
  const concerns=br.common_concerns;
  renderScreen(html`
    <div class="screen__eyebrow">Buyers Remorse — Address It Now</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(br.script)}</div>
    </div>
    ${trainingNote(br.training_note)}
    <div style="margin:0.75rem 0;">
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-accent);margin-bottom:0.4rem;">Common Concerns + Scripts</div>
      ${Object.entries(concerns).map(([k,v])=>`
        <div style="margin-bottom:0.5rem;padding:0.65rem 0.75rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.25rem;">${esc(k.toUpperCase())}</div>
          <div style="font-size:0.82rem;color:var(--color-white);line-height:1.5;">${esc(v)}</div>
        </div>`).join('')}
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="access">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Addressed — back on track</span>
        <span class="branch-btn__sub">→ Start access section</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="2" data-outcome="BUYERS_REMORSE">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🔴 Deep remorse — escalate to founder</span>
        <span class="branch-btn__sub">Log BUYERS_REMORSE</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.expectations=SCREENS.comms;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
