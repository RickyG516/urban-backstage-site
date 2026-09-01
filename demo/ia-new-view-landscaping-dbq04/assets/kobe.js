document.addEventListener('DOMContentLoaded', function () {
  var fab = document.querySelector('.chat-fab');
  var panel = document.querySelector('.chat-panel');
  if (!fab || !panel) return;

  var NETLIFY_ENDPOINT = 'https://new-view-landscaping.netlify.app/';
  var PHONE_DISPLAY = '(563) 451-8031';
  var PHONE_TEL = '5634518031';
  var EMAIL = 'Dallas@newviewdbq.com';
  var BOT_NAME = fab.textContent.replace(/^\s*\S+\s*/, '').trim() || 'Kobe';

  var SERVICES = [
    ['Landscape Design & Install', 'A full plan for your yard, then a crew that installs it right the first time.'],
    ['Retaining Walls', 'Walls that hold, built with proper base and drainage, not just stacked block.'],
    ['Patios, Walkways & Fire Pits', 'Paver patios, walkways and fire pits laid on a base built to stay flat.'],
    ['Mulch, Rock & Bed Work', 'Clean bed lines, fresh mulch or rock, and edging that actually holds its shape.'],
    ['Sod, Grading & Drainage', "Fix the grade first so water moves away from the house, not through it."],
    ['Trees & Plantings', 'Trees, shrubs and perennials picked for the spot, not just what looked good at the nursery.'],
    ['Landscape Lighting', 'Path lights, uplighting and accent lighting that show off the work after dark.']
  ];
  var CITIES = ['Dubuque, IA', 'Asbury, IA', 'Peosta, IA', 'Galena, IL', 'Platteville, WI'];

  var scrollEl, formHost;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function botSay(text) {
    var msg = el('div', 'chat-msg', text);
    scrollEl.appendChild(msg);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function userSay(text) {
    var msg = el('div', 'chat-msg user', text);
    scrollEl.appendChild(msg);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function showOptions(options) {
    var wrap = el('div', 'chat-options');
    options.forEach(function (opt) {
      var btn = el('button', 'chat-option-btn', opt[0]);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        wrap.remove();
        userSay(opt[0]);
        setTimeout(function () { opt[1](); }, 250);
      });
      wrap.appendChild(btn);
    });
    scrollEl.appendChild(wrap);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function showRestart() {
    var btn = el('button', 'chat-restart', 'Start over');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      scrollEl.innerHTML = '';
      showEntry();
    });
    scrollEl.appendChild(btn);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function showEntry() {
    setTimeout(function () {
      botSay("Hi! I'm " + BOT_NAME + ", New View Landscaping's virtual assistant. What can I help you with?");
      showOptions([
        ['Get a Free Estimate', showLeadForm],
        ['Learn About Services', showServices],
        ['Check Service Area', showServiceArea],
        ['Hours & Availability', showHours],
        ['Talk to a Real Person', showTalkToPerson]
      ]);
    }, 300);
  }

  function showServices() {
    botSay('New View handles seven core services:');
    var list = el('div', 'chat-msg');
    list.innerHTML = SERVICES.map(function (s) { return '<b>' + s[0] + '</b> \u2014 ' + s[1]; }).join('<br><br>');
    scrollEl.appendChild(list);
    scrollEl.scrollTop = scrollEl.scrollHeight;
    setTimeout(function () {
      showOptions([
        ['Get a Free Estimate', showLeadForm],
        ['Ask Something Else', function () { scrollEl.innerHTML = ''; showEntry(); }]
      ]);
    }, 300);
  }

  function showServiceArea() {
    botSay("We're based in Dubuque, IA and work within about a 30-mile radius, including:");
    botSay(CITIES.join(' \u00b7 '));
    setTimeout(function () {
      showOptions([
        ['Get a Free Estimate', showLeadForm],
        ['Ask Something Else', function () { scrollEl.innerHTML = ''; showEntry(); }]
      ]);
    }, 300);
  }

  function showHours() {
    botSay("Dallas and the crew are usually out on job sites during the day, so the fastest way to reach him directly is a call or text to " + PHONE_DISPLAY + ". Or leave your info here and he'll get back to you.");
    setTimeout(function () {
      showOptions([
        ['Leave My Info', showLeadForm],
        ['Ask Something Else', function () { scrollEl.innerHTML = ''; showEntry(); }]
      ]);
    }, 300);
  }

  function showTalkToPerson() {
    botSay('No problem, here\'s the fastest way to reach Dallas directly:');
    var linkMsg = el('div', 'chat-msg');
    linkMsg.innerHTML = 'Call or text <a href="tel:' + PHONE_TEL + '" style="color:var(--steel2);font-weight:700;">' + PHONE_DISPLAY + '</a><br>Email <a href="mailto:' + EMAIL + '" style="color:var(--steel2);font-weight:700;">' + EMAIL + '</a>';
    scrollEl.appendChild(linkMsg);
    scrollEl.scrollTop = scrollEl.scrollHeight;
    setTimeout(function () {
      showOptions([
        ['Leave My Info Instead', showLeadForm],
        ['Ask Something Else', function () { scrollEl.innerHTML = ''; showEntry(); }]
      ]);
    }, 300);
  }

  function showLeadForm() {
    botSay("Great \u2014 tell me a little about the project and Dallas will follow up. Free estimates, no pressure.");
    var form = el('form', 'chat-lead-form');
    form.innerHTML = [
      '<input type="hidden" name="form-name" value="kobe-lead">',
      '<input type="text" name="name" placeholder="Your name" required>',
      '<input type="tel" name="phone" placeholder="Phone number" required>',
      '<input type="email" name="email" placeholder="Email (optional)">',
      '<select name="service">',
      '<option value="">What kind of project?</option>',
      SERVICES.map(function (s) { return '<option value="' + s[0] + '">' + s[0] + '</option>'; }).join(''),
      '<option value="Not sure yet">Not sure yet</option>',
      '</select>',
      '<textarea name="message" placeholder="Anything else Dallas should know?" rows="2"></textarea>',
      '<button type="submit">Send to Dallas</button>'
    ].join('');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new URLSearchParams(new FormData(form)).toString();
      var submitBtn = form.querySelector('button');
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      fetch(NETLIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      }).then(function () {
        form.remove();
        botSay("Got it, thanks! Dallas will reach out shortly. In the meantime, feel free to call " + PHONE_DISPLAY + " if it's urgent.");
        showRestart();
      }).catch(function () {
        submitBtn.textContent = 'Send to Dallas';
        submitBtn.disabled = false;
        botSay("Hmm, that didn't go through. Easiest to just call or text " + PHONE_DISPLAY + " directly.");
      });
    });
    scrollEl.appendChild(form);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  fab.addEventListener('click', function () {
    var opening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    if (opening && !panel.dataset.started) {
      panel.dataset.started = '1';
      var body = panel.querySelector('.chat-body');
      body.innerHTML = '';
      scrollEl = el('div', 'chat-scroll');
      body.appendChild(scrollEl);
      showEntry();
    }
  });
});
