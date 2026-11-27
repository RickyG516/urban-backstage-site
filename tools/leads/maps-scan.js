// Google Maps no-website scan. Paste into javascript_tool on a Google Maps SEARCH tab
// (any https://www.google.com/maps/search/... URL) in Ricky's Chrome. Defines helpers on
// window, then call:  await window.__search('tree service near Davenport, IA')  (one or two
// per javascript_tool call: each takes ~15 s and the tool times out at 45 s).
// Results accumulate in window.__leads[query] = {total, rows:[{name,rating,phone,cat,addr,q}]}
// where rows are ONLY the listings whose card has no "Website" button.
// Read them back in chunks (the tool truncates output around 1,000 chars):
//   window.__all=[].concat(...Object.values(window.__leads).map(v=>v.rows));
//   window.__all.slice(0,12).map(r=>[r.q,r.name,r.rating,r.phone,r.cat].join(' ~ ')).join('\n')
// Never put '=' or '&' or '=>' in the returned string: the tool blocks output that looks like a
// query string. Use ' ~ ' and ' : ' as separators and replace '&' with 'and'.
window.__leads = window.__leads || {};
window.__extract = function (q) {
  const feed = document.querySelector('div[role="feed"]'); if (!feed) return null;
  const cards = [...feed.querySelectorAll('a[href*="/maps/place/"]')].map(a => a.closest('div[jsaction]') || a.parentElement);
  const out = []; const seen = new Set(); let total = 0;
  for (const c of cards) {
    const a = c.querySelector('a[href*="/maps/place/"]'); if (!a) continue;
    const name = a.getAttribute('aria-label'); if (!name || seen.has(name)) continue; seen.add(name); total++;
    const web = !![...c.querySelectorAll('a')].find(x => /website/i.test(x.getAttribute('aria-label') || '') || x.getAttribute('data-value') === 'Website');
    if (web) continue;
    const rt = c.querySelector('span[role="img"]'); const rating = rt ? rt.getAttribute('aria-label') : '';
    const t = c.innerText; const phone = (t.match(/\(\d{3}\) \d{3}-\d{4}/) || [''])[0];
    const cat = (t.match(/\n([A-Za-z &\/]+?) ·/) || ['', ''])[1];
    const addr = (t.match(/· ([^\n|]+)\n/) || ['', ''])[1];
    out.push({ name, rating, phone, cat, addr, q });
  }
  return { total, rows: out };
};
window.__loadAll = async function () {
  const feed = document.querySelector('div[role="feed"]');
  for (let i = 0; i < 8; i++) { feed.scrollTop = feed.scrollHeight; await new Promise(r => setTimeout(r, 1100)); if (/reached the end/.test(feed.innerText)) break; }
};
window.__search = async function (q) {
  const box = document.querySelector('input[name="q"]'); box.focus(); box.select();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, q);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  await new Promise(r => setTimeout(r, 5000));
  if (!document.title.startsWith(q)) return q + ': title mismatch (' + document.title + ')';
  await window.__loadAll(); const r = window.__extract(q); window.__leads[q] = r;
  return q + ': ' + r.total + ' listings, ' + r.rows.length + ' without a website';
};
// Place-page verify (search a single business, read its own page): confirms NO SITE and gives
// the full address and photo count. a[data-item-id="authority"] is the Website row.
window.__cards = function () {
  const feed = document.querySelector('div[role="feed"]');
  if (!feed) {
    const h = document.querySelector('h1'); if (!h) return [];
    const t = document.body.innerText; const web = !!document.querySelector('a[data-item-id="authority"]');
    const rv = (t.match(/([\d.]+)\s*\(([\d,]+)\)/) || ['', '', '']);
    return [{ name: h.innerText, web, rating: rv[1] + '/' + rv[2], phone: (t.match(/\(\d{3}\) \d{3}-\d{4}/) || [''])[0], addr: (document.querySelector('button[data-item-id="address"]') || { innerText: '' }).innerText }];
  }
  const cards = [...feed.querySelectorAll('a[href*="/maps/place/"]')].map(a => a.closest('div[jsaction]') || a.parentElement);
  const out = []; const seen = new Set();
  for (const c of cards) {
    const a = c.querySelector('a[href*="/maps/place/"]'); if (!a) continue; const name = a.getAttribute('aria-label'); if (!name || seen.has(name)) continue; seen.add(name);
    const web = !![...c.querySelectorAll('a')].find(x => /website/i.test(x.getAttribute('aria-label') || '') || x.getAttribute('data-value') === 'Website');
    const rt = c.querySelector('span[role="img"]'); const t = c.innerText;
    out.push({ name, web, rating: (rt ? rt.getAttribute('aria-label') : '').replace(' stars ', '/').replace(' Reviews', ''), phone: (t.match(/\(\d{3}\) \d{3}-\d{4}/) || [''])[0], addr: (t.match(/· ([^\n|]+)\n/) || ['', ''])[1] });
    if (out.length >= 2) break;
  }
  return out;
};
window.__v = window.__v || {};
window.__fmt = q => { const c = window.__v[q] || []; return q.replace(/&/g, 'and') + ' : ' + (c.length ? c.map(x => [x.name.slice(0, 36).replace(/&/g, 'and'), x.web ? 'HAS SITE' : 'NO SITE', x.rating, x.phone, x.addr.replace(/\n/g, ' ').slice(0, 42)].join(' ~ ')).join(' || ') : 'none'); };
window.__verify = async function (q) {
  const box = document.querySelector('input[name="q"]'); box.focus(); box.select();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, q);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  await new Promise(r => setTimeout(r, 6500)); window.__v[q] = window.__cards(); return window.__fmt(q);
};
'maps-scan helpers ready';
