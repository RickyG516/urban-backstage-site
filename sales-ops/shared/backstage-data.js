/* ══════════════════════════════════════════════════════════════════════════
   URBAN BACKSTAGE — shared data layer
   Every department page talks to the worker through this file and nothing else.

   Why it exists: five pages each hand-rolling fetch + auth + loading states +
   currency formatting is five chances to get auth subtly wrong and five
   different-looking error screens. One module, one behaviour.

   Depends on unc-key.js being loaded FIRST (it owns the PIN modal and the
   localStorage key). Load order in every page:
       <script src="/sales-ops/shared/unc-key.js"></script>
       <script src="/sales-ops/shared/backstage-data.js"></script>
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var WORKER = 'https://unc-sales-os-sync.ricky-a17.workers.dev';
  var LS_KEY = 'unc_worker_key';

  function key() {
    try { return (localStorage.getItem(LS_KEY) || '').trim(); } catch (e) { return ''; }
  }

  /* Fetch a worker endpoint.
     The worker answers most handler-level failures with HTTP 200 and
     {ok:false,error}, so checking response.ok alone is not enough — the body
     has to be inspected too. Both shapes are normalised into one rejection. */
  function api(path, opts) {
    opts = opts || {};
    var k = key();
    if (!k) {
      if (window.UNCKey && window.UNCKey.unlock) window.UNCKey.unlock();
      return Promise.reject(new Error('No access key on this device.'));
    }
    var headers = { 'x-unc-key': k };
    if (opts.body) headers['Content-Type'] = 'application/json';

    return fetch(WORKER + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401) {
        // Key exists but the worker rejected it — stale or rotated. Drop it and
        // let the PIN modal re-provision rather than looping on a dead key.
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        if (window.UNCKey && window.UNCKey.unlock) window.UNCKey.unlock();
        throw new Error('Access key rejected. Unlock with your PIN.');
      }
      if (r.status === 503) throw new Error('Worker is misconfigured — WORKSPACE_KEY is not set on Cloudflare.');
      return r.json().catch(function () { throw new Error('Worker returned a non-JSON response (HTTP ' + r.status + ').'); });
    }).then(function (d) {
      if (!d || d.ok === false) throw new Error((d && d.error) || 'Request failed.');
      return d;
    });
  }

  /* ── formatting ─────────────────────────────────────────────────────── */
  function money(n, opts) {
    n = Number(n) || 0;
    var o = opts || {};
    return '$' + n.toLocaleString('en-US', {
      minimumFractionDigits: o.cents ? 2 : 0,
      maximumFractionDigits: o.cents ? 2 : 0
    });
  }
  function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }

  function ago(iso) {
    if (!iso) return '—';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (!isFinite(d)) return '—';
    if (d < 0)   return 'in ' + Math.abs(d) + 'd';
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30)  return d + 'd ago';
    if (d < 365) return Math.round(d / 30) + 'mo ago';
    return Math.round(d / 365) + 'y ago';
  }
  function dueLabel(days) {
    if (days === null || days === undefined) return 'no due date';
    if (days < 0)   return Math.abs(days) + 'd overdue';
    if (days === 0) return 'due today';
    if (days === 1) return 'due tomorrow';
    return 'due in ' + days + 'd';
  }
  function dateShort(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── render states ──────────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }
  function loading(id, msg) {
    var n = el(id); if (n) n.innerHTML = '<div class="loading">' + esc(msg || 'Loading live data') + '</div>';
  }
  function empty(id, msg) {
    var n = el(id); if (n) n.innerHTML = '<div class="empty">' + esc(msg) + '</div>';
  }
  function fail(id, err) {
    var n = el(id); if (!n) return;
    n.innerHTML = '<div class="err"><b>Could not load</b>' + esc(err && err.message ? err.message : String(err)) + '</div>';
  }
  function stamp(id, iso) {
    var n = el(id); if (n) n.textContent = 'live from HubSpot · ' + (iso ? new Date(iso).toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit' }) : 'now');
  }

  /* ── social icons ───────────────────────────────────────────────────── */
  /* Inline SVG rather than an icon font or CDN: this domain is noindexed and
     internal, and a third-party font request is one more thing that can be
     slow, blocked, or offline when someone opens this on a job site. */
  var ICONS = {
    web: '<path d="M8 0a8 8 0 100 16A8 8 0 008 0zM6.7 14.3A6.5 6.5 0 011.6 9h2.6c.1 1.9.5 3.6 1.1 4.9l.5.4h-1.1zm-2.5-6.6H1.6a6.5 6.5 0 015.1-5.3c-.8 1.4-1.3 3.2-1.4 5.3h-1.1zM8 1.7c.8 1 1.5 3 1.6 5.6H6.4C6.5 4.7 7.2 2.7 8 1.7zm0 12.6c-.8-1-1.5-3-1.6-5.6h3.2c-.1 2.6-.8 4.6-1.6 5.6zm1.3-.4c.7-1.4 1.1-3.2 1.2-5.2h2.6a6.5 6.5 0 01-5.1 5.3l1.3-.1zM11.8 7.3c-.1-2.1-.5-3.9-1.3-5.3a6.5 6.5 0 015.1 5.3h-3.8z"/>',
    fb:  '<path d="M16 8a8 8 0 10-9.2 7.9v-5.6H4.7V8h2.1V6.2c0-2.1 1.2-3.2 3.1-3.2.9 0 1.8.16 1.8.16v2h-1c-1 0-1.3.62-1.3 1.26V8h2.2l-.35 2.3H9.4v5.6A8 8 0 0016 8z"/>',
    ig:  '<path d="M8 1.4c2.1 0 2.4 0 3.3.05.8.04 1.2.17 1.5.28.38.15.65.32.94.6.28.3.45.56.6.94.11.3.24.7.28 1.5.04.9.05 1.2.05 3.3s0 2.4-.05 3.3c-.04.8-.17 1.2-.28 1.5-.15.38-.32.65-.6.94-.3.28-.56.45-.94.6-.3.11-.7.24-1.5.28-.9.04-1.2.05-3.3.05s-2.4 0-3.3-.05c-.8-.04-1.2-.17-1.5-.28a2.5 2.5 0 01-.94-.6 2.5 2.5 0 01-.6-.94c-.11-.3-.24-.7-.28-1.5C1.4 10.4 1.4 10.1 1.4 8s0-2.4.05-3.3c.04-.8.17-1.2.28-1.5.15-.38.32-.65.6-.94.3-.28.56-.45.94-.6.3-.11.7-.24 1.5-.28C5.6 1.4 5.9 1.4 8 1.4zM8 0C5.9 0 5.6 0 4.7.05c-.86.04-1.45.18-1.97.38-.53.2-.98.48-1.43.93-.45.45-.72.9-.93 1.43-.2.52-.34 1.11-.38 1.97C0 5.6 0 5.9 0 8s0 2.4.05 3.3c.04.86.18 1.45.38 1.97.2.53.48.98.93 1.43.45.45.9.72 1.43.93.52.2 1.11.34 1.97.38C5.6 16 5.9 16 8 16s2.4 0 3.3-.05c.86-.04 1.45-.18 1.97-.38.53-.2.98-.48 1.43-.93.45-.45.72-.9.93-1.43.2-.52.34-1.11.38-1.97C16 10.4 16 10.1 16 8s0-2.4-.05-3.3c-.04-.86-.18-1.45-.38-1.97a3.9 3.9 0 00-.93-1.43A3.9 3.9 0 0013.2.43c-.52-.2-1.11-.34-1.97-.38C10.4 0 10.1 0 8 0zm0 3.9a4.1 4.1 0 100 8.2 4.1 4.1 0 000-8.2zm0 6.77a2.67 2.67 0 110-5.34 2.67 2.67 0 010 5.34zm5.23-6.93a.96.96 0 11-1.92 0 .96.96 0 011.92 0z"/>',
    li:  '<path d="M13.6 0H2.4A2.4 2.4 0 000 2.4v11.2A2.4 2.4 0 002.4 16h11.2a2.4 2.4 0 002.4-2.4V2.4A2.4 2.4 0 0013.6 0zM5 13.4H2.8V6.2H5v7.2zM3.9 5.2a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6zm9.5 8.2h-2.2V9.9c0-.9 0-2-1.2-2s-1.4 1-1.4 2v3.5H6.4V6.2h2.1v1h.03c.3-.56 1-1.15 2.1-1.15 2.2 0 2.7 1.5 2.7 3.4v4z"/>',
    x:   '<path d="M12.6 0h2.45l-5.35 6.12L16 16h-4.93l-3.86-5.05L2.79 16H.34l5.72-6.54L0 0h5.05l3.5 4.62L12.6 0zm-.86 14.55h1.36L4.32 1.38H2.87l8.87 13.17z"/>',
    gbp: '<path d="M8 0L0 4.6v6.8L8 16l8-4.6V4.6L8 0zm0 2.1l5.6 3.2v.4L8 8.9 2.4 5.7v-.4L8 2.1zM2.4 7.5L7.3 10.3v3.3L2.4 10.8V7.5zm6.3 6.1v-3.3l4.9-2.8v3.3l-4.9 2.8z"/>',
    hs:  '<path d="M11.2 5.6V3.9a1.3 1.3 0 10-1.5 0v1.7a3.8 3.8 0 00-1.8.8L3.1 2.7a1.5 1.5 0 10-.7 1.2l4.7 3.6a3.8 3.8 0 000 3l-1.4 1.4a1.2 1.2 0 00-.36-.06 1.25 1.25 0 101.25 1.25c0-.13-.02-.25-.06-.36l1.4-1.4a3.8 3.8 0 102.3-6.7zm-.75 5.8a2 2 0 110-4 2 2 0 010 4z"/>'
  };
  var SOC_LABEL = { web:'Website', fb:'Facebook', ig:'Instagram', li:'LinkedIn', x:'X / Twitter', gbp:'Google Business', hs:'HubSpot record' };

  /* Renders the social row for a client card.
     Missing platforms render as dimmed, non-clickable slots on purpose — a gap
     you can see is a gap you can fill. Hiding them would make an unserviceable
     client look identical to a fully-wired one. */
  function socialRow(social, hubspotUrl) {
    social = social || {};
    var map = [
      ['web', social.website], ['fb', social.facebook], ['ig', social.instagram],
      ['gbp', social.gbp],     ['li', social.linkedin], ['x',  social.twitter]
    ];
    if (hubspotUrl) map.push(['hs', hubspotUrl]);

    var missing = 0, html = '';
    for (var i = 0; i < map.length; i++) {
      var k = map[i][0], url = map[i][1];
      var svg = '<svg viewBox="0 0 16 16" aria-hidden="true">' + ICONS[k] + '</svg>';
      if (url) {
        html += '<a class="soc ' + k + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" ' +
                'title="' + esc(SOC_LABEL[k]) + '" aria-label="' + esc(SOC_LABEL[k]) + '">' + svg + '</a>';
      } else {
        if (k !== 'hs') missing++;
        html += '<span class="soc ' + k + ' off" title="' + esc(SOC_LABEL[k]) + ' — not on file" ' +
                'aria-label="' + esc(SOC_LABEL[k]) + ' not on file">' + svg + '</span>';
      }
    }
    if (missing) html += '<span class="social-gap">' + missing + ' missing</span>';
    return '<div class="social">' + html + '</div>';
  }

  /* ── the brains panel ───────────────────────────────────────────────── */
  function renderSignals(containerId, signals, limit) {
    var n = el(containerId); if (!n) return;
    if (!signals || !signals.length) { empty(containerId, 'No signals.'); return; }
    var list = limit ? signals.slice(0, limit) : signals;
    n.innerHTML = list.map(function (s) {
      return '<div class="sig ' + esc(s.severity) + '">' +
        '<div class="sig-top"><span class="sig-title">' + esc(s.title) + '</span>' +
        '<span class="badge ' + esc(s.severity === 'critical' ? 'crit' : s.severity) + '">' + esc(s.severity) + '</span>' +
        '<span class="sig-metric">' + esc(s.metric) + '</span></div>' +
        '<div class="sig-detail">' + esc(s.detail) + '</div>' +
        (s.action ? '<div class="sig-action"><b>Do this</b>' + esc(s.action) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  window.BS = {
    api: api, WORKER: WORKER,
    money: money, num: num, ago: ago, dueLabel: dueLabel, dateShort: dateShort, esc: esc,
    el: el, loading: loading, empty: empty, fail: fail, stamp: stamp,
    socialRow: socialRow, renderSignals: renderSignals, icons: ICONS
  };
})();
