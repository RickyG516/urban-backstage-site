(function(){'use strict';
function playSound(s){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play(s);}catch(_){}}
const Shell=window.CockpitShell;
let scripts=null;
const history=[];
const stage=()=>document.querySelector('#screen-stage');

async function boot() {
  try {

  scripts=await(await fetch('/sales-ops/referral-ask/scripts.json',{cache:'no-cache'})).json();
  await Shell.init({cockpit:'referral-ask'});
  Shell.bindNotes();
  Shell.onReset(renderStart);
  Shell.onBack(goBack);
  renderStart();
  } catch(e) {
    console.error('[referral-ask] boot failed', e);
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
    pipeline_stage:   c.pipeline_stage||null
  };
}
function interp(s){if(!s)return'';const tt=t();return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|pipeline_stage)\}/g,(m,k)=>tt[k]!=null?tt[k]:m);}
function tok(s){return interp(s).replace(/\{[^}]+\}/g,m=>`<span class="script-panel__token">${m}</span>`);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function html(strings,...values){let o=strings[0];for(let i=0;i<values.length;i++)o+=String(values[i])+strings[i+1];return o;}
function renderScreen(c){const s=stage();s.classList.remove('active');void s.offsetWidth;s.innerHTML=c;s.classList.add('screen','active');}

function goTo(id){const r=SCREENS[id];if(!r)return;const c=stage().getAttribute('data-screen');if(c&&c!=='start')history.push(c);Shell.hideOutcomes();stage().setAttribute('data-screen',id);r();}
function goBack(){if(!history.length)return renderStart();const p=history.pop();Shell.hideOutcomes();stage().setAttribute('data-screen',p);SCREENS[p]&&SCREENS[p]();}

const SCREENS={};

function renderStart(){
  history.length=0;
  renderScreen(html`
    <div class="screen__eyebrow">Referral Ask — Happy Client Conversation</div>
    <div style="margin-bottom:0.5rem;padding:0.65rem 0.85rem;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);font-size:0.8rem;color:#86efac;line-height:1.5;">
      ✅ Only run this with clients who are genuinely happy. Results are visible. Relationship is warm. Never ask a client who has open issues.
    </div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.intro&&scripts.intro.default||scripts.intro)}</div>
    </div>
    ${scripts.intro&&scripts.intro.training_note?`<div class="coach-note">💡 ${esc(scripts.intro.training_note)}</div>`:''}
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="specificity">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Open to it — get specific</span>
        <span class="branch-btn__sub">→ Help them think of who</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-outcome="WILL_THINK">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 Need to think about who</span>
        <span class="branch-btn__sub">Log WILL_THINK — follow up in 3 days</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="NO_REFERRAL">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Nobody comes to mind</span>
        <span class="branch-btn__sub">Log NO_REFERRAL — graceful close</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.startCall();playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.startCall();playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
}
SCREENS.start=renderStart;

SCREENS.specificity=()=>{
  const prompts=scripts.specificity_prompts;
  renderScreen(html`
    <div class="screen__eyebrow">Help Them Get Specific — Guide Them</div>
    <div class="script-panel">
      <div class="script-panel__line" style="color:var(--color-white-dim);font-size:0.88rem;">If they say "I'll think about it" — use these to help them get specific right now:</div>
      ${prompts.map(p=>`<div class="script-panel__line" style="cursor:pointer;font-style:italic;" title="Click to copy">${esc(p)}</div>`).join('')}
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="warm_intro">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Got a name — set up the intro</span>
        <span class="branch-btn__sub">→ Ask for the warm intro</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="cross_vertical">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 No names yet — try cross-vertical</span>
        <span class="branch-btn__sub">→ Other trades they work with</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="WILL_THINK">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Still can't think of anyone</span>
        <span class="branch-btn__sub">Log WILL_THINK — follow up</span>
      </button>
    </div>
  `);
  // Copy prompts on click
  stage().querySelectorAll('.script-panel__line[title="Click to copy"]').forEach(el=>{
    el.addEventListener('click',()=>{navigator.clipboard.writeText(el.textContent.trim());el.style.color='#22c55e';setTimeout(()=>el.style.color='',700);});
  });
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('specificity:'+b.dataset.next);playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.cross_vertical=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Cross-Vertical — Other Trades They Work With</div>
    <div class="script-panel">
      <div class="script-panel__line">Hey — do you ever sub work out to other contractors? Or work alongside guys in other trades — plumbers, electricians, landscapers? Anyone in your network who's always complaining about not getting enough work?</div>
    </div>
    <div style="margin:0.5rem 0;padding:0.65rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--color-white-dim);">
      Cross-trade referrals are gold — a roofer referring a plumber means both clients already trust you. Works the same as a direct referral.
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="warm_intro">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Got a cross-trade name</span>
        <span class="branch-btn__sub">→ Set up the intro</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-outcome="WILL_THINK">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 Will think about it</span>
        <span class="branch-btn__sub">Log WILL_THINK</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="NO_REFERRAL">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Nothing right now</span>
        <span class="branch-btn__sub">Log NO_REFERRAL</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('cross_vertical:'+b.dataset.next);playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.warm_intro=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Ask for the Warm Intro</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.warm_intro_script)}</div>
      <div class="script-panel__line" style="margin-top:0.75rem;color:var(--color-white-dim);font-size:0.88rem;">Reciprocity offer:</div>
      <div class="script-panel__line">${tok(scripts.reciprocity_offer)}</div>
      <div class="script-panel__line" style="margin-top:0.75rem;font-weight:700;">Close:</div>
      <div class="script-panel__line">${tok(scripts.close)}</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-outcome="INTRO_OFFERED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 They'll send the intro</span>
        <span class="branch-btn__sub">Log INTRO_OFFERED — follow up in 3 days</span>
      </button>
      <button class="branch-btn branch-btn--green" data-hotkey="2" data-outcome="REFERRAL_GIVEN">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟢 Got direct contact info</span>
        <span class="branch-btn__sub">Log REFERRAL_GIVEN — call them today</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-outcome="WILL_THINK">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🟡 Will think about it</span>
        <span class="branch-btn__sub">Log WILL_THINK</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('warm_intro:'+b.dataset.outcome);playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
