/* UNC Sales OS — device key self-heal.
 *
 * Every Sales OS page needs the worker key in localStorage['unc_worker_key'].
 * If a browser gets wiped, cleaned, or is brand new, that key is gone and every
 * page 401s. This script catches that case and offers a PIN unlock instead of a
 * dead screen: type your PIN, the worker hands the key back, page reloads, done.
 *
 * No lockout exists anywhere in this flow — wrong PINs only get slower to answer,
 * and a correct PIN always works instantly on the very next try.
 *
 * Load this on any page that talks to the worker. It does nothing at all when a
 * key is already present.
 */
(function () {
  'use strict';

  var WORKER = 'https://unc-sales-os-sync.ricky-a17.workers.dev';
  var LS_KEY = 'unc_worker_key';
  var LS_REP = 'unc_cockpit_current_rep_id';

  function getKey() {
    try { var k = localStorage.getItem(LS_KEY); return (k && k.trim()) || ''; }
    catch (e) { return ''; }
  }

  function savedRep() {
    try {
      var v = localStorage.getItem(LS_REP);
      if (!v) return 'ricky';
      try { return JSON.parse(v) || 'ricky'; } catch (e) { return v || 'ricky'; }
    } catch (e) { return 'ricky'; }
  }

  window.UNCKey = { get: getKey, unlock: showModal };

  function showModal() {
    if (document.getElementById('uncKeyModal')) return;

    var wrap = document.createElement('div');
    wrap.id = 'uncKeyModal';
    wrap.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483647;background:rgba(15,15,15,.94);' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      "font-family:'Open Sans',system-ui,-apple-system,sans-serif");

    wrap.innerHTML =
      '<div style="background:#1a1a1a;border:2px solid #e36b1e;border-radius:12px;' +
      'padding:28px 30px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.7)">' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:700;font-size:17px;' +
        'color:#e36b1e;letter-spacing:.02em;margin-bottom:8px">SALES OS LOCKED</div>' +
        '<div style="color:#f5f5f5;font-size:13.5px;line-height:1.55;margin-bottom:18px">' +
        'This device has no access key — most likely the browser was cleared. ' +
        'Enter your PIN to restore it.</div>' +
        '<select id="uncKeyRep" style="width:100%;padding:10px;margin-bottom:10px;' +
        'background:#0f0f0f;color:#f5f5f5;border:1px solid #444;border-radius:6px;font-size:14px">' +
          '<option value="ricky">Ricky</option><option value="tyler">Tyler</option>' +
        '</select>' +
        // inputmode was "numeric" — that forces a digits-only keypad on mobile, which makes
        // an alphanumeric PIN impossible to type on a phone. "text" allows letters everywhere.
        // The worker hashes whatever string it receives; it never required digits.
        '<input id="uncKeyPin" type="password" inputmode="text" autocomplete="off" ' +
        'placeholder="PIN" style="width:100%;padding:11px;background:#0f0f0f;color:#f5f5f5;' +
        'border:1px solid #444;border-radius:6px;font-size:17px;letter-spacing:.3em;' +
        'text-align:center;margin-bottom:12px">' +
        '<button id="uncKeyGo" style="width:100%;background:#e36b1e;color:#0f0f0f;border:0;' +
        'border-radius:6px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;' +
        "font-family:'Montserrat',sans-serif\">UNLOCK</button>" +
        '<div id="uncKeyMsg" style="min-height:18px;margin-top:11px;font-size:12.5px;' +
        'color:#e36b1e;text-align:center"></div>' +
        '<div style="margin-top:14px;text-align:center">' +
        '<a href="/sales-ops/settings/" style="color:#888;font-size:11.5px;text-decoration:underline">' +
        'paste the key manually instead</a></div>' +
      '</div>';

    document.body.appendChild(wrap);

    var rep = wrap.querySelector('#uncKeyRep');
    var pin = wrap.querySelector('#uncKeyPin');
    var go  = wrap.querySelector('#uncKeyGo');
    var msg = wrap.querySelector('#uncKeyMsg');

    try { rep.value = savedRep(); } catch (e) {}
    setTimeout(function () { try { pin.focus(); } catch (e) {} }, 60);

    function submit() {
      var v = (pin.value || '').trim();
      if (!v) { msg.textContent = 'Enter your PIN.'; return; }
      go.disabled = true;
      go.textContent = 'CHECKING…';
      msg.textContent = '';

      fetch(WORKER + '/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: rep.value, pin: v })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok && d.key) {
            try {
              localStorage.setItem(LS_KEY, d.key);
              localStorage.setItem(LS_REP, JSON.stringify(rep.value));
            } catch (e) {}
            msg.style.color = '#5cd67a';
            msg.textContent = '✓ unlocked — reloading';
            setTimeout(function () { location.reload(); }, 450);
            return;
          }
          go.disabled = false;
          go.textContent = 'UNLOCK';
          pin.value = '';
          pin.focus();
          msg.style.color = '#e36b1e';
          msg.textContent = (d && d.key_withheld)
            ? 'Key withheld — open this from urbannicheco.com.'
            : ((d && d.error) || 'Incorrect PIN.');
        })
        .catch(function (e) {
          go.disabled = false;
          go.textContent = 'UNLOCK';
          msg.style.color = '#e36b1e';
          msg.textContent = 'Could not reach the worker: ' + e.message;
        });
    }

    go.addEventListener('click', submit);
    pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function boot() { if (!getKey()) showModal(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
