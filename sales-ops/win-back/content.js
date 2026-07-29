(function(){'use strict';
function playSound(s){try{var a=window.CockpitAudio;if(a&&typeof a.play==='function')a.play(s);}catch(_){}}
const Shell=window.CockpitShell;
let scripts=null;
const history=[];
const stage=()=>document.querySelector('#screen-stage');

async function boot() {
  try {

  scripts=await(await fetch('/sales-ops/win-back/scripts.json',{cache:'no-cache'})).json();
  await Shell.init({cockpit:'win-back'});
  Shell.bindNotes();
  Shell.onReset(renderStart);
  Shell.onBack(goBack);
  renderStart();
  } catch(e) {
    console.error('[win-back] boot failed', e);
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
function interp(s){if(!s)return'';if(typeof s==='object')s=s.script||s.default||'';const tt=t();return s.replace(/\{(first_name|business_name|trade|trade_lower|city|state|rep_name|rep_phone|gbp_review_count|quick_win|pipeline_stage)\}/g,(m,k)=>tt[k]!=null?tt[k]:m);}
function tok(s){return interp(s).replace(/\{[^}]+\}/g,m=>`<span class="script-panel__token">${m}</span>`);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function html(strings,...values){let o=strings[0];for(let i=0;i<values.length;i++)o+=String(values[i])+strings[i+1];return o;}
function renderScreen(c){const s=stage();s.classList.remove('active');void s.offsetWidth;s.innerHTML=c;s.classList.add('screen','active');}
function note(x){if(!x)return'';return `<div class="coach-note">💡 ${esc(x)}</div>`;}
function tn(k){const v=scripts&&scripts[k];return note(v&&v.training_note);}

function goTo(id){const r=SCREENS[id];if(!r)return;const c=stage().getAttribute('data-screen');if(c&&c!=='start')history.push(c);Shell.hideOutcomes();stage().setAttribute('data-screen',id);r();}
function goBack(){if(!history.length)return renderStart();const p=history.pop();Shell.hideOutcomes();stage().setAttribute('data-screen',p);SCREENS[p]&&SCREENS[p]();}

const SCREENS={};

function renderStart(){
  history.length=0;
  renderScreen(html`
    <div class="screen__eyebrow">Win-Back — Lost Client Re-Engage</div>
    <div style="margin-bottom:0.5rem;padding:0.65rem 0.85rem;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:var(--radius-sm);font-size:0.8rem;color:#fde68a;line-height:1.5;">
      ⚠ No pitch. Pure curiosity and relationship first. Earn 2 minutes by being human. If they shut down immediately, respect it and move on.
    </div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.intro)}</div>
    </div>
    ${tn('intro')}
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="diagnose">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Open to talking</span>
        <span class="branch-btn__sub">→ Diagnose the why</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="cold_reframe">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 Cool / guarded</span>
        <span class="branch-btn__sub">→ Soft reframe — earn trust first</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="HARD_NO">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Shut down — hard no</span>
        <span class="branch-btn__sub">Log HARD_NO — respect it</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.startCall();playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.startCall();playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
}
SCREENS.start=renderStart;

SCREENS.cold_reframe=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Soft Reframe — Earn the Conversation</div>
    <div class="script-panel">
      <div class="script-panel__line">Hey — I'm not calling to pitch you. Genuinely just wanted to check in and see how things are going. No agenda. How's the business been?</div>
      <div class="script-panel__line" style="margin-top:0.5rem;color:var(--color-white-dim);font-size:0.85rem;">Then shut up. Let them talk. Don't steer toward business yet.</div>
    </div>
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="diagnose">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 They warmed up</span>
        <span class="branch-btn__sub">→ Diagnose the why</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="2" data-outcome="HARD_NO">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🔴 Still shut down</span>
        <span class="branch-btn__sub">Log HARD_NO</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.diagnose=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Diagnose — Find the Real Reason</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.diagnostic)}</div>
      <div class="script-panel__line" style="margin-top:0.5rem;color:var(--color-white-dim);font-size:0.85rem;">Shut up. Let them talk. Take verbatim notes. Don't get defensive. Don't explain yet.</div>
    </div>
    ${tn('diagnostic')}
    ${(scripts.diagnostic&&scripts.diagnostic.listen_for)?`<div style="margin:0.75rem 0;padding:0.65rem;background:var(--color-dark-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--color-accent);margin-bottom:0.35rem;">Listen For — And What To Do With It</div>${scripts.diagnostic.listen_for.map(r=>`<div style="font-size:0.8rem;color:var(--color-white-dim);padding:0.25rem 0;border-bottom:1px solid var(--color-border);line-height:1.45;">• ${tok(r)}</div>`).join('')}</div>`:''}
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-next="reengagement">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 Issue is fixable — pitch re-engagement</span>
        <span class="branch-btn__sub">→ Soft ask + reciprocity</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-next="learned_no_pitch">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 Got intel — not fixable right now</span>
        <span class="branch-btn__sub">→ Log the reason, leave door open</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="HARD_NO">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Angry / hostile</span>
        <span class="branch-btn__sub">Log HARD_NO — disengage clean</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('diagnose:'+b.dataset.next);playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('diagnose:hard_no');playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.learned_no_pitch=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Got the Intel — Leave the Door Open</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.learning_capture)}</div>
    </div>
    ${tn('learning_capture')}
    <div class="branches">
      <button class="branch-btn branch-btn--yellow" data-hotkey="1" data-outcome="REASON_LEARNED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟡 Log reason — follow up in 90 days</span>
        <span class="branch-btn__sub">Log REASON_LEARNED</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.reengagement=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Re-Engagement Pitch — Earn Round 2</div>
    <div class="script-panel">
      <div class="script-panel__line" style="font-weight:700;color:var(--color-white-dim);font-size:0.85rem;">Soft ask:</div>
      <div class="script-panel__line">${tok(scripts.reengagement_soft)}</div>
      <div class="script-panel__line" style="margin-top:0.75rem;font-weight:700;color:var(--color-white-dim);font-size:0.85rem;">If hesitant:</div>
      <div class="script-panel__line">${tok(scripts.reengagement_hard)}</div>
    </div>
    ${tn('reengagement_soft')}
    ${tn('reengagement_hard')}
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-outcome="BOOKED_DISCO">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 They're in — book the call</span>
        <span class="branch-btn__sub">Log BOOKED_DISCO — HOT</span>
      </button>
      <button class="branch-btn branch-btn--green" data-hotkey="2" data-outcome="REOPENED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟢 Wants the proposal — send it</span>
        <span class="branch-btn__sub">Log REOPENED — proposal going out</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="3" data-next="last_ask">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🟡 Still hesitant — last ask</span>
        <span class="branch-btn__sub">→ One more angle</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="4" data-outcome="STILL_PARKED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">4</span>
        <span class="branch-btn__label">🔴 Not ready — door stays open</span>
        <span class="branch-btn__sub">Log STILL_PARKED — follow up later</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('reengagement:'+b.dataset.next);playSound('click');goTo(b.dataset.next);}));
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('reengagement:'+b.dataset.outcome);playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

SCREENS.last_ask=()=>{
  renderScreen(html`
    <div class="screen__eyebrow">Last Ask — One More Shot</div>
    <div class="script-panel">
      <div class="script-panel__line">${tok(scripts.last_ask||"Look — I get it. What would it take for you to give us another shot? I'm asking straight.")}</div>
    </div>
    ${tn('last_ask')}
    <div class="branches">
      <button class="branch-btn branch-btn--green" data-hotkey="1" data-outcome="BOOKED_DISCO">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">1</span>
        <span class="branch-btn__label">🟢 They gave us a condition — work it</span>
        <span class="branch-btn__sub">Log BOOKED_DISCO</span>
      </button>
      <button class="branch-btn branch-btn--yellow" data-hotkey="2" data-outcome="STILL_PARKED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">2</span>
        <span class="branch-btn__label">🟡 "Check back in a few months"</span>
        <span class="branch-btn__sub">Log STILL_PARKED — set the reminder</span>
      </button>
      <button class="branch-btn branch-btn--red" data-hotkey="3" data-outcome="REASON_LEARNED">
        <span class="branch-btn__hotkey" style="font-size:1.1rem;font-weight:900;">3</span>
        <span class="branch-btn__label">🔴 Not happening — log and respect it</span>
        <span class="branch-btn__sub">Log REASON_LEARNED</span>
      </button>
    </div>
  `);
  stage().querySelectorAll('[data-outcome]').forEach(b=>b.addEventListener('click',()=>{Shell.pushBranch('last_ask:'+b.dataset.outcome);playSound('click');Shell.recordOutcome(b.dataset.outcome);}));
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
