/**
 * NICHE OUTREACH COCKPIT — content.js v2
 * Urban Niche Co. | Modes: Other Verticals · Merch Opener
 */
'use strict';
/* jshint esversion:8 */
const Shell = window.CockpitShell;
const PLACES_API_KEY = 'AIzaSyAnOVkUKyHsQpKiCn2obpk5VRGI-3P8nVI';

/* ══════════════════════════════════════════════
   VERTICAL INTEL — Other Verticals mode
   ══════════════════════════════════════════════ */
const VERTICAL_INTEL = {
  'Restaurant': {
    win:   'Missing "best [cuisine] near me" — GMB optimization alone drives walk-ins without ad spend',
    hook:  'Most restaurants lose 15–20 covers a week to places with stronger Google presence. Hungry people searching right now pick whoever shows up in the top 3 maps results.',
    dm:    'Owner or GM — avoid 11am–1pm and 5–8pm (meal rushes). Best window: 2–4 PM mid-week.',
    pitch: 'Restaurants live and die on Google Maps. If you\'re not in the top 3 for "[cuisine] near me" you\'re invisible to hungry people actively searching right now.'
  },
  'Bar / Venue': {
    win:   'Event pages don\'t rank — GMB + local SEO gets discovered for "things to do in [city]" free',
    hook:  'When someone searches "bars near me" or "live music in [city]" tonight — are you in the top 3? Most venues aren\'t. That\'s consistent foot traffic going somewhere else.',
    dm:    'Owner or Events Manager — call mid-morning before evening prep starts.',
    pitch: 'Venues that own "things to do in [city]" searches get consistent foot traffic without paying for ads every week. That\'s the play.'
  },
  'Retail': {
    win:   '"Buy [product] near me" searches go unanswered — local shops are the most underserved category in local SEO',
    hook:  'People search "buy [X] near me" constantly and most local shops don\'t show up. Amazon can\'t own those searches — that\'s your territory and you\'re leaving it empty.',
    dm:    'Owner — usually on the floor. Mid-morning before lunch rush.',
    pitch: 'Online giants can\'t compete for "near me" searches. That\'s local retail\'s biggest advantage and most shops aren\'t using it.'
  },
  'Salon / Spa': {
    win:   '50+ Google reviews with active responses beats every local competitor — most salons have under 30',
    hook:  'Salon clients filter on reputation before they ever pick up the phone. If you\'re not actively managing reviews and your Google profile, the salon down the street is taking your bookings.',
    dm:    'Owner — Tues/Wed mornings are gold. Avoid Saturday (peak) and Monday (recovery day).',
    pitch: 'In your business, five stars isn\'t optional — it\'s the first filter clients apply. Reputation management is the highest-ROI thing a salon can do.'
  },
  'Auto Repair': {
    win:   'Car trouble is high-urgency search — first shop with strong reviews and a complete GMB wins the click',
    hook:  'Car trouble is an emergency. People search fast and pick the first shop with strong reviews in under 30 seconds. Most shops have thin, unoptimized profiles.',
    dm:    'Owner or Shop Manager — early morning (8–10 AM) before bays fill up.',
    pitch: 'Auto repair is the highest-intent local search there is. Someone\'s car broke down and they\'re choosing you or your competitor based on Google in the next 30 seconds.'
  },
  'Gym / Fitness': {
    win:   '"Gym near me" gets searched thousands of times monthly — most gyms don\'t own any of those results',
    hook:  'Gyms that win in local search cut their paid ad costs. Monthly memberships are recurring revenue — one SEO investment keeps generating sign-ups month after month.',
    dm:    'Owner or GM — mid-morning between the morning rush and lunch crowd.',
    pitch: 'Every organic gym lead is a free recurring revenue member. The math is obvious once you see what "gym near me" search volume looks like in your city.'
  },
  'Real Estate': {
    win:   'Hyper-local landing pages for [neighborhood] capture buyer/seller searches that competitors ignore',
    hook:  'Home buyers Google "[neighborhood] homes for sale" before they ever call an agent. Most agents don\'t show up for those searches — free leads going to whoever does.',
    dm:    'Agent or Broker/Owner — reach between 9–11 AM or 1–3 PM, not during showings.',
    pitch: 'One closed deal from organic leads pays for 12 months of SEO. In real estate the math is the most obvious it gets.'
  },
  'Medical / Dental': {
    win:   '"Dentist near me accepting new patients" — low competition, high conversion, most practices ignore it',
    hook:  'New patients Google a practice before they call. Under 50 reviews and a thin profile means they call the next dentist on the list.',
    dm:    'Office Manager or Doctor/Owner — call mid-morning, avoid Mondays.',
    pitch: 'New patient LTV in most dental practices is $3,000–$8,000+. Two new patients a month from local SEO pays for itself many times over.'
  },
  'Property Management': {
    win:   'Vacancy SEO — "[city] apartments for rent" + GMB fills units faster than paid listings',
    hook:  'Every day a unit sits vacant is money out the door. Most property managers have zero local search presence for their properties.',
    dm:    'Property Manager or Owner — business hours, mid-morning.',
    pitch: 'Reducing vacancy by 10 days per unit per year on a 20-unit portfolio pays for a full year of marketing. Show them the number and the conversation changes.'
  },
  'Home Services': {
    win:   'Cleaning, pest control, moving — high repeat-purchase services win big on local SEO + reputation',
    hook:  'Home service businesses outside the big trades are massively underserved in local search. Low competition, high intent — best combination there is.',
    dm:    'Owner — typically reachable mid-morning.',
    pitch: 'Your competitors aren\'t investing in digital. That\'s not a warning — that\'s an opening.'
  },
  'Bar': {
    win:   '"Bars near me" gets searched heavily on weekends — most bars have thin, outdated Google profiles that lose the click',
    hook:  'People decide where to drink in 30 seconds on Google Maps. If your photos are old, reviews are stale, and hours are wrong — someone else is getting that table tonight.',
    dm:    'Owner or Manager — call mid-morning (10 AM–12 PM) before afternoon prep. Never evenings or weekends.',
    pitch: 'Bar Google profiles are the most neglected in hospitality. First one in your market to lock it down owns the weekend walk-in traffic.'
  },
  'Café': {
    win:   '"Coffee near me" gets searched constantly — independent cafes lose to chains because of SEO, not product',
    hook:  'Starbucks has a $50M SEO budget. You can own the local results they miss — your neighborhood, your regulars, your regulars\' coworkers searching right now.',
    dm:    'Owner — best before the morning rush (7–9 AM) or between rushes (2–4 PM). Avoid 9–11 AM.',
    pitch: 'Independent cafes that own "coffee near me" for their neighborhood beat chains on local search because Google favors proximity. You just have to show up.'
  },
  'Bakery': {
    win:   '"Custom cakes near me" and "bakery near me" are high-intent searches with very low competition in most mid-size markets',
    hook:  'Someone searching for a birthday cake or wedding cake this weekend is about to spend $200–$500 with whoever shows up on Google first. That\'s happening right now in your city.',
    dm:    'Owner/Baker — early morning (6–9 AM) or between rushes (10 AM–12 PM). Avoid Saturday mornings.',
    pitch: 'Bakeries with strong Google presence capture the special-occasion searches worth $200–$500+ per order. Those customers search, they don\'t scroll social.'
  },
  'Catering': {
    win:   '"Catering near me" and "[food type] catering [city]" — high-value searches, long sales cycles, huge order sizes, almost no local competition in SEO',
    hook:  'Corporate clients and event planners search Google before they ever pick up the phone. A catering company that doesn\'t rank is invisible to their highest-value customers.',
    dm:    'Owner — business hours, mid-morning weekdays. Avoid event execution days (Fri–Sun typically).',
    pitch: 'One corporate catering contract from organic search can be worth $5,000–$20,000+. The math on local SEO is painfully obvious in this vertical.'
  },
  'Photography': {
    win:   '"Wedding photographer [city]" and "family photographer near me" — high-intent, high-value searches most photographers are completely missing',
    hook:  'Couples booking weddings search Google before they check Instagram. If you\'re not ranking for "[city] wedding photographer" you\'re invisible to your highest-paying clients before they even know you exist.',
    dm:    'Photographer/Owner — mid-morning or early afternoon weekdays. Avoid weekends — that\'s their shoot days.',
    pitch: 'A single wedding booking from organic search is worth $2,000–$5,000. One ranking pays for 12 months of SEO on its own.'
  },
  'Event Venue': {
    win:   '"Wedding venue [city]" and "event space near me" — extremely high-intent searches with massive booking value that most venues don\'t optimize for',
    hook:  'Couples and event planners search Google before they visit venues. If you\'re not in the top results for "[city] event venue" you\'re losing bookings to whoever is — and they\'re booking 6–12 months out.',
    dm:    'Owner or Event Coordinator — mid-morning weekdays. Avoid weekends — peak event execution days.',
    pitch: 'One event booking from organic search is worth thousands. Venues that own local search stop paying per lead and start getting found automatically.'
  },
  'Hotel': {
    win:   'Google Maps optimization for "hotels near [landmark/city]" — most independent hotels cede direct bookings to OTAs charging 15–25% commission on the same room',
    hook:  'Every direct booking you lose to Booking.com or Expedia costs you 15–25% commission. Independent hotels that own their Google presence capture those bookings directly. That\'s pure margin.',
    dm:    'Owner or General Manager — mid-morning. Avoid check-in (3–5 PM) and check-out (10 AM–12 PM) windows.',
    pitch: 'Every direct booking instead of an OTA saves 15–25% commission. Local SEO pays for itself on one or two rooms.'
  },
  'Brewery': {
    win:   '"Brewery near me" and "taproom [city]" — craft beer drinkers search Google constantly, most small breweries have thin, incomplete profiles',
    hook:  'Someone looking for a craft beer taproom this weekend is going to whoever shows up on Google Maps. Beer tourism is driven almost entirely by local search — and most taprooms are invisible.',
    dm:    'Owner or Head Brewer — mid-morning weekdays (10 AM–12 PM). Avoid evenings and weekends — taproom rush.',
    pitch: 'Taprooms that own local search get consistent foot traffic without paid ads. Beer tourists plan their visits on Google Maps — if you\'re not there, you don\'t exist to them.'
  },
  'Winery': {
    win:   '"Winery near me" and "[region] wineries" — wine tourism searches are high-intent and high-value per visit, most wineries ignore local SEO entirely',
    hook:  'Wine tourists plan routes on Google Maps before they drive. If you\'re not in the top local results you\'re invisible to people who are literally driving past you right now.',
    dm:    'Owner or Tasting Room Manager — mid-morning weekdays. Avoid weekends — peak tasting room hours.',
    pitch: 'Wine tourists that find you on Google spend more and come back. Tasting room revenue is 100% dependent on being discoverable — and most wineries aren\'t.'
  },
  'Fitness Studio': {
    win:   '"Yoga studio near me" / "pilates near me" / "CrossFit near me" — neighborhood fitness searches with high member LTV and almost no local SEO competition',
    hook:  'When someone searches for a studio near them, they\'re ready to sign up. If you\'re not in the top 3 maps results you\'re handing memberships worth $1,000–$3,000/year to the competitor down the block.',
    dm:    'Owner or Studio Manager — mid-morning (10 AM–12 PM) between classes. Avoid 5–7 PM rush.',
    pitch: 'One new member from local search is worth $1,000–$3,000/year in recurring revenue. Local SEO compounds — it keeps bringing them in month after month.'
  },
  'Entertainment': {
    win:   '"Things to do in [city]" and "entertainment near me" — local entertainment is massively underserved in SEO and one of the most searched phrases in any city',
    hook:  'People searching "what to do in [city] tonight" are ready to spend money right now. Whoever shows up first gets the customers — and most entertainment businesses don\'t even have a complete Google profile.',
    dm:    'Owner or Manager — mid-morning weekdays. Avoid evenings and weekends — that\'s showtime.',
    pitch: 'Entertainment businesses that own "things to do near me" searches get consistent foot traffic without paying for ads every week. That\'s the play.'
  },
  'Food & Beverage': {
    win:   '"Near me" food and drink searches are the highest-frequency local searches on Google — most independent F&B businesses have zero optimization',
    hook:  'Your customers are searching for exactly what you sell on Google right now. The question is whether they find you or whoever optimized their profile first.',
    dm:    'Owner or GM — mid-morning before service rush. Best Tue–Thu.',
    pitch: 'Food and beverage is the most searched local category on Google, period. Independent operators who own those searches don\'t need to compete on price or ads.'
  }
};

const VERTICAL_INTEL_DEFAULT = {
  win:   'Google Maps presence + reputation management — fastest ROI for any local business',
  hook:  'Most local businesses are invisible online. The ones investing in digital now are pulling ahead while everyone else waits.',
  dm:    'Owner or GM — mid-morning typically best',
  pitch: 'The businesses winning locally right now aren\'t spending more — they\'ve just got their digital presence dialed in while competitors haven\'t moved yet.'
};

const VERTICAL_WINDOWS = {
  'Restaurant':          '★ Best: 2–4 PM (avoid meal rush)',
  'Bar / Venue':         '★ Best: 10 AM–12 PM',
  'Bar':                 '★ Best: 10 AM–12 PM (never evenings)',
  'Retail':              '★ Best: 10–11 AM weekdays',
  'Salon / Spa':         '★ Best: Tue–Wed 9–11 AM',
  'Auto Repair':         '★ Best: 8–10 AM',
  'Gym / Fitness':       '★ Best: 10 AM–12 PM',
  'Fitness Studio':      '★ Best: 10 AM–12 PM (between classes)',
  'Real Estate':         '★ Best: 9–11 AM or 1–3 PM',
  'Medical / Dental':    '★ Best: 9–11 AM (call office)',
  'Property Management': '★ Best: 9 AM–12 PM',
  'Home Services':       '★ Best: 8–10 AM',
  'Café':                '★ Best: 7–9 AM or 2–4 PM',
  'Bakery':              '★ Best: 6–9 AM or 10 AM–12 PM',
  'Catering':            '★ Best: Mon–Thu 9–11 AM',
  'Photography':         '★ Best: Mon–Fri 10 AM–2 PM',
  'Event Venue':         '★ Best: Mon–Thu 10 AM–12 PM',
  'Hotel':               '★ Best: 9–11 AM (avoid check-in/out)',
  'Brewery':             '★ Best: Mon–Fri 10 AM–12 PM',
  'Winery':              '★ Best: Mon–Fri 10 AM–12 PM',
  'Entertainment':       '★ Best: Mon–Fri 10 AM–12 PM',
  'Food & Beverage':     '★ Best: 9–11 AM Tue–Thu'
};

/* ══════════════════════════════════════════════
   SCRIPTS: OTHER VERTICALS (advertising specialist frame)
   ══════════════════════════════════════════════ */
const OV_SCRIPTS = {
  greeting: {
    default: 'Hey — is [<b>First Name</b>] around? &nbsp;/&nbsp; [They get them] &nbsp;/&nbsp; Hey [<b>First Name</b>] — {rep_name} with Urban Niche Co. Quick cold call — we\'re a marketing agency. We specialize in local digital marketing, we work across a lot of different industries, and when we spot a gap in a local market, we try to fill it. I was looking at [<b>Business Name</b>]\'s online presence before I called — [<b>Gap Spotted</b>]. Got 30 seconds?'
  },
  dm_free: {
    word_for_word:
      '<b>OPENER</b><br>' +
      'So I was looking at your online presence before I called — [<b>Gap Spotted</b>]. ' +
      'That\'s fixable, and it\'s probably costing you [customers / covers / bookings] every week ' +
      'going to whoever shows up instead of you.<br><br>' +
      '<b>THE PITCH</b><br>' +
      'We\'re a marketing agency — our systems work across industries. ' +
      'When we see a gap in a local market, we move on it. ' +
      'Flat monthly rate, we handle Google profile, reviews, local SEO, reputation management. ' +
      'No ad spend markups. No year-long contracts.<br><br>' +
      '<b>THE CLOSE</b><br>' +
      'I put together a quick free audit on [<b>Business Name</b>] — takes 2 minutes to look at. ' +
      'Can I send it to your email so you can see exactly what we\'re talking about?',
    guided: [
      '⭐ Open with the specific gap you spotted — exact beats vague every time',
      '🎯 "Marketing agency that works across industries" — not contractor-only, not niche-locked',
      '📍 "When we see a gap in a market, we fill it" — that\'s the frame',
      '📦 Position the offer: flat monthly, no markup, no long contract — remove friction',
      '📧 Ask for the email for the free audit — don\'t pitch pricing on call one',
      '💬 If they ask price: "Depends on what the audit shows — most clients start at $1,500–$2,500/mo"'
    ],
    freestyle:
      '<b>KEY ANGLES</b><br>' +
      '• Marketing agency — we work across industries, spot gaps and fill them<br>' +
      '• "Spotted a gap" — [the specific thing you actually saw]<br>' +
      '• Lost revenue angle: "going to whoever shows up instead"<br>' +
      '• Starting range if asked: $1,500–$2,500/mo<br>' +
      '• Time to results: GMB 2–4 weeks / SEO 60–90 days<br><br>' +
      '<b>ONE-LINE CLOSE</b><br>' +
      '"Businesses winning in [city] right now aren\'t spending more — they just got there first. Let me send you what I found."'
  },
  gatekeeper: {
    word_for_word:
      '<b>OPENER</b><br>' +
      'Hey — is the owner or manager around? It\'s {rep_name}.<br><br>' +
      '<b>IF THEY ASK WHAT IT\'S ABOUT</b><br>' +
      'Quick question about their online presence — takes about 2 minutes.<br><br>' +
      '<b>IF OWNER IS OUT</b><br>' +
      'No problem — what\'s the best time to catch them? And is there a direct number or should I call this one back?',
    guided: [
      '👤 Ask for owner or manager by name if you have it',
      '🪄 "Quick question about their online presence" — enough to get past, not enough to pitch',
      '📅 Not available: get callback window + confirm right number',
      '✍️ Note the gatekeeper\'s name — use it on the callback'
    ],
    freestyle:
      '<b>GATEKEEPER GOALS</b><br>' +
      '1. Get owner\'s name if you don\'t have it<br>' +
      '2. Get a callback window<br>' +
      '3. Confirm direct number if possible<br>' +
      '4. Don\'t pitch the gatekeeper — they can\'t say yes'
  },
  voicemail: {
    word_for_word:
      'Hey [<b>First Name</b>] — this is {rep_name} with Urban Niche Co. I was looking at [<b>Business Name</b>]\'s online presence and noticed something worth a quick conversation. ' +
      'Give me a call — {rep_phone}. ' +
      'Again, {rep_name}, Urban Niche Co. {rep_phone}. Talk soon.',
    guided: [
      '⏱ Under 20 seconds — they\'ll actually listen to the whole thing',
      '🎣 "Noticed something worth a quick conversation" — curiosity gap, no pitch',
      '📞 Number twice, clearly — don\'t rush it',
      '🔁 Follow with email or DM same day'
    ],
    freestyle:
      '<b>VOICEMAIL FORMULA</b><br>' +
      'Name + Company → "looked at your [business]" → "noticed something worth a call" → number ×2<br><br>' +
      '<b>NEVER</b> pitch on voicemail. Curiosity only. 20 seconds max.'
  },
  not_interested: {
    word_for_word:
      '<b>PRE-PITCH OBJECTION</b><br>' +
      'Totally fair — I\'ll keep it to 20 seconds. I pulled up your Google profile before I called and [<b>Gap Spotted</b>]. ' +
      'Worth knowing about regardless. Can I send you what I found — just an email, zero obligation?<br><br>' +
      '<b>IF STILL NO</b><br>' +
      'Appreciate your time. If anything changes, we\'re at urbannicheco.com. Have a good one.',
    guided: [
      '⚡ Don\'t fold immediately — one specific pivot with what you actually observed',
      '📧 Downgrade the ask: "just an email" is much easier than agreeing to a call',
      '🎯 Make the observation specific — generic hooks are easy to ignore',
      '🚪 2nd no: clean exit, log COLD, move on — don\'t burn the contact'
    ],
    freestyle:
      '<b>PIVOT LINE</b><br>' +
      '"20 seconds — I pulled your Google listing and saw [specific gap]. Worth knowing about. Can I send it over?"<br><br>' +
      'Specific beats generic every time.'
  },
  wrong_number: {
    word_for_word: 'Oh — my apologies, must have the wrong number. I was trying to reach [<b>Business Name</b>]. Sorry to bother you — have a good one.',
    guided: ['Clean exit. Update phone in HubSpot immediately. Mark best_phone_verified = false.'],
    freestyle: 'Apologize, hang up, update CRM.'
  }
};

/* ══════════════════════════════════════════════
   SCRIPTS: MERCH OPENER (contractor foot-in-the-door)
   ══════════════════════════════════════════════ */
const MERCH_SCRIPTS = {
  greeting: {
    default: 'Hey — is [<b>First Name</b>] around? &nbsp;/&nbsp; [They get them] &nbsp;/&nbsp; Hey [<b>First Name</b>] — {rep_name} with Urban Niche Co. Quick cold call — quick question. Do you guys have any branded gear? Shirts, hats, anything with your logo on it?'
  },
  dm_free: {
    word_for_word:
      '<b>AFTER THEY ANSWER</b><br>' +
      '[If Yes / Some] — Perfect. We do custom screen printed gear for contractors. Tees, hoodies, hats — quality stuff, not the cheap promotional crap you find online.<br><br>' +
      '<b>THE CREW ANGLE</b><br>' +
      'When your guys are on a roof or in someone\'s driveway, that shirt is a rolling billboard. ' +
      'Contractors who brand their crew professionally — it sells itself. Neighbors watch a job, they read the shirt, they call.<br><br>' +
      '<b>THE CLOSE</b><br>' +
      'I can put together a quick quote — just need quantity, colors, and whether you want front/back or just chest. Minimum order\'s about 12 pieces. ' +
      'What\'s a good email to send the pricing to?<br><br>' +
      '<b>IF THEY\'RE WARM — TRANSITION</b><br>' +
      '"By the way — our main thing is actually digital marketing for contractors. Google, local SEO, that whole side. ' +
      'If that\'s ever on your radar, happy to have a different conversation."',
    guided: [
      '🎯 Let them answer the gear question first — listen before pitching',
      '👕 Quality angle: "not the cheap promotional crap" — immediately sets you apart',
      '💡 Crew visibility: "your shirt is your billboard when you\'re on a job site"',
      '📦 Low-pressure close: "quick quote, min 12 pieces, no commitment"',
      '📧 Same close as always: email for pricing',
      '🔑 If they\'re warm: tease the marketing side — "our main thing is actually digital marketing for contractors"',
      '🔁 Goal: get the email and/or plant the marketing seed'
    ],
    freestyle:
      '<b>MERCH ANGLES</b><br>' +
      '• Quality screen printed gear — not promo junk<br>' +
      '• Crew visibility on site = free advertising while they work<br>' +
      '• Min order ~12 pieces, quick turnaround, competitive pricing<br>' +
      '• Hoodies, tees, hats, truck magnets<br><br>' +
      '<b>SOFT TRANSITION (when warm)</b><br>' +
      '"Our main thing is actually digital marketing for contractors — if that\'s ever on your radar..."<br><br>' +
      '<b>ONE-LINE CLOSE</b><br>' +
      '"Let me throw a quote together — takes 5 min. What\'s your email?"'
  },
  gatekeeper: {
    word_for_word:
      '<b>OPENER</b><br>' +
      'Hey — is the owner around? It\'s {rep_name}.<br><br>' +
      '<b>IF THEY ASK WHAT IT\'S ABOUT</b><br>' +
      'Quick question about branded gear for the crew — takes about 2 minutes.<br><br>' +
      '<b>IF OWNER IS OUT</b><br>' +
      'No problem — best time to catch them? Should I call this number back?',
    guided: [
      '👤 Ask for the owner — "branded gear for the crew" is low-threat',
      '🪄 It sounds like you might be doing something for them, not selling — that\'s the vibe',
      '📅 Not available: get callback window and confirm number'
    ],
    freestyle: 'Get to the owner. "Branded gear for the crew" gets you past the gatekeeper without resistance — sounds like you\'re offering something, not selling something.'
  },
  voicemail: {
    word_for_word:
      'Hey [<b>First Name</b>] — this is {rep_name} with Urban Niche Co. Quick question about branded gear for your crew. ' +
      'Give me a call back — {rep_phone}. ' +
      'Again, {rep_name}, Urban Niche Co. {rep_phone}.',
    guided: [
      '⏱ Under 15 seconds — simple and clean',
      '👕 "Branded gear for your crew" — specific, curiosity-generating, non-threatening',
      '📞 Number twice, clearly'
    ],
    freestyle: 'Name + company → "quick question about branded gear for your crew" → number twice. Under 15 seconds. No pitch.'
  },
  not_interested: {
    word_for_word:
      '<b>IF NOT INTERESTED IN MERCH</b><br>' +
      'No worries at all. One other thing quick — we actually do digital marketing specifically for contractors. ' +
      'Google, local SEO, reputation management — stuff that gets your phone ringing. ' +
      'I can shoot you a free audit on [<b>Business Name</b>] if you want — just an email, no commitment. Worth a look?<br><br>' +
      '<b>IF STILL NO</b><br>' +
      'Appreciate your time. We\'re at urbannicheco.com if anything changes. Have a good one.',
    guided: [
      '🔄 Merch no → pivot to digital marketing (natural and clean)',
      '📧 Same close: "free audit, just an email, no commitment"',
      '🎯 "Specifically for contractors" — they just talked to someone who gets their world',
      '🚪 2nd no: clean exit, log COLD'
    ],
    freestyle:
      'Not interested in merch → "Our main thing is digital marketing for contractors actually — free audit, just an email." ' +
      'If that\'s also a no, clean exit. At minimum you planted the seed.'
  },
  wrong_number: {
    word_for_word: 'Oh — sorry about that, must have the wrong number. Looking for [<b>Business Name</b>]. Apologize for the bother — have a good one.',
    guided: ['Clean exit. Update CRM.'],
    freestyle: 'Apologize, hang up, update CRM.'
  }
};

/* ══════════════════════════════════════════════
   BRANCHES + OUTCOMES
   ══════════════════════════════════════════════ */
const BRANCHES = [
  { key: 'dm_free',        hotkey: '1', label: '🟢 DM Free',        sub: 'Owner on the line, ready to talk',     cls: 'branch-btn--green'  },
  { key: 'gatekeeper',     hotkey: '2', label: '🟡 Gatekeeper',      sub: 'Navigate to the decision-maker',       cls: 'branch-btn--yellow' },
  { key: 'voicemail',      hotkey: '3', label: '📵 Voicemail',       sub: 'Left a message — hook only',           cls: ''                   },
  { key: 'not_interested', hotkey: '4', label: '🔴 Not Interested',  sub: 'Objected before the pitch',            cls: 'branch-btn--red'    },
  { key: 'wrong_number',   hotkey: '5', label: '❌ Wrong Number',    sub: 'Bad data — update CRM and move on',    cls: ''                   }
];

const OUTCOMES = [
  { id: 'outcome-hot',    label: '🔥 HOT',    cls: 'outcome-btn--hot',    value: 'HOT'    },
  { id: 'outcome-warm',   label: '🟡 WARM',   cls: 'outcome-btn--warm',   value: 'WARM'   },
  { id: 'outcome-parked', label: '🅿 PARKED', cls: 'outcome-btn--parked', value: 'PARKED' },
  { id: 'outcome-cold',   label: '❄ COLD',   cls: 'outcome-btn--cold',   value: 'COLD'   },
  { id: 'outcome-dnc',    label: '🚫 DNC',    cls: 'outcome-btn--dnc',    value: 'DNC'    }
];

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let liveQueue    = [];
let liveIndex    = 0;
let activeStyle  = 'word_for_word';
let activeBranch = null;
let history      = [];
let activeMode   = 'other_verticals'; // 'other_verticals' | 'merch_opener'
let gapSpotted   = '';
const _syncQueue = [];
let _lookup = { query: '', results: [], selected: null, loading: false, error: '' };

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}
function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += (vals[i] == null ? '' : vals[i]); });
  return out;
}
function stage() { return document.getElementById('screen-stage'); }

function getActiveScripts() {
  return activeMode === 'merch_opener' ? MERCH_SCRIPTS : OV_SCRIPTS;
}

/* Interpolate [<b>First Name</b>], [<b>Business Name</b>], [<b>Gap Spotted</b>] tokens */
function interpolateScript(rawHtml) {
  const p = liveQueue[liveIndex];
  let out = rawHtml;
  if (p) {
    out = out
      .replace(/\[<b>First Name<\/b>\]/g,
        p.first_name ? '<b>' + escapeHTML(p.first_name) + '</b>' : '<b>[First Name]</b>')
      .replace(/\[<b>Business Name<\/b>\]/g,
        p.business_name ? '<b>' + escapeHTML(p.business_name) + '</b>' : '<b>[Business Name]</b>');
  }
  out = out.replace(/\[<b>Gap Spotted<\/b>\]/g,
    gapSpotted
      ? '<b style="color:var(--color-accent);">' + escapeHTML(gapSpotted) + '</b>'
      : '<b style="color:var(--color-accent);opacity:0.5;">[gap spotted — fill in above]</b>'
  );
  // Dynamic rep — never hardcode a name or phone in scripts
  try {
    var _rep = (Shell && Shell.getRep) ? Shell.getRep() : {};
    out = out
      .replace(/\{rep_name\}/g, escapeHTML(_rep.display_name || 'your rep'))
      .replace(/\{rep_phone\}/g, escapeHTML(_rep.phone || '(515) 344-4053'));
  } catch (_) {}
  return out;
}

function renderScreen(content) {
  const s = stage(); if (!s) return;
  s.innerHTML = content;
  const sp = s.querySelector('.script-panel');
  if (sp) sp.scrollTop = 0;
}
function trainingNote(text) { return `<div class="training-note">${text}</div>`; }
function tokenizeHTML(raw)  { return `<span class="script-line">${raw}</span>`; }

function noteKey(id)          { return `niche_note_${id}`; }
function loadNote(id)         { try { return localStorage.getItem(noteKey(id)) || ''; } catch(e) { return ''; } }
function saveNote(id, text)   { try { localStorage.setItem(noteKey(id), text); } catch(e) {} }
function syncNotes(contactId) {
  const el = document.getElementById('call-notes');
  if (!el || !contactId) return;
  el._noteContactId = contactId;
  el.value = loadNote(contactId) || '';
  if (!el._bound) {
    el._bound = true;
    el.addEventListener('input', () => { if (el._noteContactId) saveNote(el._noteContactId, el.value); });
  }
}

function queueSync(payload) {
  _syncQueue.push(payload);
  const badge = document.getElementById('sync-badge');
  if (badge) { badge.textContent = _syncQueue.length; badge.hidden = false; }
}

function outcomeEmoji(o) {
  return { HOT:'🔥', WARM:'🟡', PARKED:'🅿️', COLD:'❄️', DNC:'🚫' }[o] || '✓';
}

/* ══════════════════════════════════════════════
   MODE BAR
   ══════════════════════════════════════════════ */
function wireModeBar() {
  const bar = document.getElementById('mode-bar');
  if (!bar) return;
  bar.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeMode = tab.dataset.mode;
      bar.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === activeMode);
        t.setAttribute('aria-selected', String(t.dataset.mode === activeMode));
      });
      // reset call state
      activeBranch = null;
      activeStyle  = 'word_for_word';
      _lookup      = { query: '', results: [], selected: null, loading: false, error: '' };
      history.length = 0;
      const ob = document.getElementById('outcome-buttons');
      if (ob) ob.hidden = true;
      if (stage()._keyHandler) {
        document.removeEventListener('keydown', stage()._keyHandler);
        stage()._keyHandler = null;
      }
      renderStart();
    });
  });
}

/* ══════════════════════════════════════════════
   START SCREENS — routed by activeMode
   ══════════════════════════════════════════════ */
function renderStart() {
  if (activeMode === 'merch_opener') return renderStart_merch();
  return renderStart_otherVerticals();
}

function renderStart_otherVerticals() {
  history.length = 0;
  const prospect  = liveQueue[liveIndex];
  const vertLabel = prospect ? (prospect.vertical || prospect.trade_type || prospect.trade || '').trim() : '';
  const intel     = VERTICAL_INTEL[vertLabel] || VERTICAL_INTEL_DEFAULT;

  renderScreen(html`
    <div class="screen__eyebrow">Other Verticals — Ready to dial</div>

    <!-- Gap Spotted input -->
    <div class="gap-row">
      <span class="gap-label">Gap Spotted</span>
      <input id="gap-input" type="text" class="gap-input"
        placeholder="e.g. 8 reviews, no photos, not ranking for [service]…"
        value="${escapeHTML(gapSpotted)}" />
    </div>

    <div class="script-panel">
      <div class="script-panel__line" id="greeting-line">${tokenizeHTML(interpolateScript(OV_SCRIPTS.greeting.default))}</div>
      ${trainingNote('Confirm you\'re talking to the right person. Fill in the gap above before dialing.')}
    </div>

    ${liveQueue.length ? html`
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <button id="preview-dials-btn" class="action-btn" style="flex:1;font-size:0.82rem;padding:0.45rem 0.6rem;border-color:var(--color-accent);color:var(--color-accent);">
          👁 Preview All ${liveQueue.length} Dials
        </button>
      </div>
    ` : ''}

    ${prospect ? html`
      <div class="trade-box" style="margin-bottom:0.5rem;">
        <div class="trade-box__lbl">Vertical Pitch — ${escapeHTML(vertLabel || 'Local Business')}</div>
        <div class="trade-box__txt">${escapeHTML(intel.pitch)}</div>
      </div>
    ` : ''}

    <div class="branches">
      ${BRANCHES.map(b => html`
        <button class="branch-btn ${b.cls}" data-hotkey="${b.hotkey}" data-branch="${b.key}" title="Press ${b.hotkey}">
          <span class="branch-btn__hotkey" style="font-size:0.85rem;font-weight:900;min-width:1.4rem;">${b.hotkey}</span>
          <div><span class="branch-btn__label">${b.label}</span><br><span class="branch-btn__sub">${b.sub}</span></div>
        </button>
      `).join('')}
    </div>
  `);

  // Show vertical intel panel on right if no queue loaded
  if (!liveQueue.length) renderRightPanel();

  // Gap input — update state and re-render greeting in real time
  const gapInput = document.getElementById('gap-input');
  if (gapInput) {
    gapInput.addEventListener('input', () => {
      gapSpotted = gapInput.value;
      const line = document.getElementById('greeting-line');
      if (line) line.innerHTML = tokenizeHTML(interpolateScript(OV_SCRIPTS.greeting.default));
    });
  }

  stage().querySelectorAll('[data-branch]').forEach(btn =>
    btn.addEventListener('click', () => handleBranch(btn.dataset.branch))
  );
  const pb = document.getElementById('preview-dials-btn');
  if (pb) pb.addEventListener('click', showPreview);

  stage()._keyHandler = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const b = BRANCHES.find(b => b.hotkey === e.key);
    if (b) handleBranch(b.key);
  };
  document.addEventListener('keydown', stage()._keyHandler);
}

function renderStart_merch() {
  history.length = 0;
  const prospect = liveQueue[liveIndex];

  renderScreen(html`
    <div class="screen__eyebrow">Merch Opener — Ready to dial</div>
    <div class="script-panel">
      <div class="script-panel__line">${tokenizeHTML(interpolateScript(MERCH_SCRIPTS.greeting.default))}</div>
      ${trainingNote('Let them answer the gear question first — then pitch. Goal: email for a quote OR plant the marketing seed.')}
    </div>

    ${liveQueue.length ? html`
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <button id="preview-dials-btn" class="action-btn" style="flex:1;font-size:0.82rem;padding:0.45rem 0.6rem;border-color:var(--color-accent);color:var(--color-accent);">
          👁 Preview All ${liveQueue.length} Dials
        </button>
      </div>
    ` : ''}

    <div style="background:rgba(227,107,30,0.07);border:1px solid rgba(227,107,30,0.2);border-radius:var(--radius-sm);padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--color-white-dim);line-height:1.5;">
      <b style="color:var(--color-accent);">Screen Printed:</b> Tees · Hoodies · Hats · Truck Magnets<br>
      <b style="color:var(--color-accent);">Min Order:</b> ~12 pieces &nbsp;|&nbsp; <b style="color:var(--color-accent);">Target:</b> Get the email <em>or</em> plant the marketing seed
    </div>

    <div class="branches">
      ${BRANCHES.map(b => html`
        <button class="branch-btn ${b.cls}" data-hotkey="${b.hotkey}" data-branch="${b.key}" title="Press ${b.hotkey}">
          <span class="branch-btn__hotkey" style="font-size:0.85rem;font-weight:900;min-width:1.4rem;">${b.hotkey}</span>
          <div><span class="branch-btn__label">${b.label}</span><br><span class="branch-btn__sub">${b.sub}</span></div>
        </button>
      `).join('')}
    </div>
  `);

  // Show merch reference panel on right if no queue loaded
  if (!liveQueue.length) renderRightPanel();

  stage().querySelectorAll('[data-branch]').forEach(btn =>
    btn.addEventListener('click', () => handleBranch(btn.dataset.branch))
  );
  const pb = document.getElementById('preview-dials-btn');
  if (pb) pb.addEventListener('click', showPreview);

  stage()._keyHandler = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const b = BRANCHES.find(b => b.hotkey === e.key);
    if (b) handleBranch(b.key);
  };
  document.addEventListener('keydown', stage()._keyHandler);
}

/* ══════════════════════════════════════════════
   SCRIPT DELIVERY SCREEN
   ══════════════════════════════════════════════ */
function render(style) {
  activeStyle = style;
  renderScreen(html`
    <div class="screen__eyebrow">Deliver the opener</div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
      <button class="action-btn${style==='word_for_word'?' action-btn--primary':''}" data-style="word_for_word" style="flex:1;font-size:0.8rem;padding:0.4rem;">W · Word for Word</button>
      <button class="action-btn${style==='guided'?' action-btn--primary':''}" data-style="guided" style="flex:1;font-size:0.8rem;padding:0.4rem;">G · Guided</button>
      <button class="action-btn${style==='freestyle'?' action-btn--primary':''}" data-style="freestyle" style="flex:1;font-size:0.8rem;padding:0.4rem;">F · Freestyle</button>
    </div>
    ${renderStyleContent(style)}
    <div class="branches" style="margin-top:0.75rem;">
      ${OUTCOMES.map(o => html`<button class="branch-btn ${o.cls}" data-outcome="${o.value}" style="min-height:46px;"><div><span class="branch-btn__label">${o.label}</span></div></button>`).join('')}
    </div>
  `);

  const _sp = stage().querySelector('.script-panel');
  if (_sp) _sp.scrollTop = 0;
  stage().querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => render(b.dataset.style)));
  stage().querySelectorAll('[data-outcome]').forEach(b => b.addEventListener('click', () => logOutcome(b.dataset.outcome)));
}

function renderStyleContent(style) {
  const sc = getActiveScripts();
  const content = sc[activeBranch] || sc.dm_free;
  if (style === 'word_for_word') return html`<div class="script-panel"><div class="script-panel__line">${interpolateScript(content.word_for_word || '')}</div></div>`;
  if (style === 'guided')        return html`<div class="script-panel">${(content.guided || []).map(i => `<div class="script-panel__line" style="margin-bottom:0.5rem;">${i}</div>`).join('')}</div>`;
  if (style === 'freestyle')     return html`<div class="script-panel"><div class="script-panel__line">${content.freestyle || ''}</div></div>`;
  return '';
}

/* ══════════════════════════════════════════════
   BRANCH + OUTCOME HANDLERS
   ══════════════════════════════════════════════ */
function handleBranch(key) {
  activeBranch = key;
  history.push(key);
  if (stage()._keyHandler) { document.removeEventListener('keydown', stage()._keyHandler); stage()._keyHandler = null; }
  const ob = document.getElementById('outcome-buttons');
  if (ob) {
    ob.hidden = false;
    ob.innerHTML = OUTCOMES.map(o => `<button class="outcome-btn ${o.cls}" data-outcome="${o.value}">${o.label}</button>`).join('');
    ob.querySelectorAll('[data-outcome]').forEach(b => b.addEventListener('click', () => logOutcome(b.dataset.outcome)));
  }
  render(activeStyle);
}

function logOutcome(outcome) {
  const p = liveQueue[liveIndex];
  if (!p) return;
  const notes = (document.getElementById('call-notes') || {}).value || '';
  queueSync({ contact_id: p.contact_id, business_name: p.business_name, outcome, branch: activeBranch, mode: activeMode, notes, timestamp: new Date().toISOString() });
  renderScreen(html`
    <div class="screen__eyebrow">Logged</div>
    <div style="text-align:center;padding:1.5rem 0.5rem;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">${outcomeEmoji(outcome)}</div>
      <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:800;margin-bottom:0.25rem;">${escapeHTML(p.business_name||'')}</div>
      <div style="font-size:0.85rem;color:var(--color-white-dim);margin-bottom:1.25rem;">Logged as <b style="color:var(--color-accent)">${outcome}</b></div>
      ${liveIndex < liveQueue.length - 1 ? html`<button id="next-btn" class="action-btn action-btn--primary" style="width:100%;padding:0.75rem;font-size:1rem;">Next Dial →</button>` : html`<div style="font-size:0.9rem;color:#22c55e;font-weight:700;">✓ Queue complete</div>`}
    </div>
  `);
  const nb = document.getElementById('next-btn');
  if (nb) nb.addEventListener('click', () => {
    liveIndex++; activeBranch = null; activeStyle = 'word_for_word';
    document.getElementById('outcome-buttons').hidden = true;
    renderLiveCard(liveQueue[liveIndex]);
    renderStart();
  });
}

/* ══════════════════════════════════════════════
   LOAD DIALS
   ══════════════════════════════════════════════ */
function loadDials() {
  const modeLabel = activeMode === 'merch_opener' ? 'Merch Opener' : 'Other Verticals';
  renderScreen(html`
    <div class="screen__eyebrow">Load Queue — ${modeLabel}</div>
    <div class="script-panel">
      <div style="margin-bottom:0.6rem;font-size:0.82rem;color:var(--color-white-dim);line-height:1.6;">
        Paste a JSON array from HubSpot or the lead prospector.<br>
        Required fields: <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.72rem;">contact_id, business_name, phone</code>
        ${activeMode === 'other_verticals' ? ' + <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.72rem;">vertical</code>' : ''}
      </div>
      <textarea id="dial-paste" class="notes-area" style="min-height:100px;width:100%;box-sizing:border-box;font-size:0.7rem;font-family:monospace;" placeholder='[{"contact_id":"123","first_name":"Maria","business_name":"Rosarios Kitchen","phone":"(563) 555-0001","vertical":"Restaurant","city":"Dubuque","state":"IA"}]'></textarea>
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:0.45rem;">
      <button id="parse-btn" class="action-btn action-btn--primary" style="flex:1;">Load Queue</button>
      <button id="cancel-btn" class="action-btn">Cancel</button>
    </div>
    <div style="margin-top:0.6rem;font-size:0.72rem;color:var(--color-white-dim);">💡 No JSON? Use manual entry below.</div>
    <div style="display:flex;gap:0.5rem;margin-top:0.35rem;">
      <input id="manual-biz" type="text" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.38rem 0.55rem;font-size:0.82rem;color:var(--color-white);font-family:inherit;" placeholder="Business name" />
      ${activeMode === 'other_verticals' ? '<input id="manual-vert" type="text" style="width:130px;background:rgba(255,255,255,0.06);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.38rem 0.55rem;font-size:0.82rem;color:var(--color-white);font-family:inherit;" placeholder="Vertical" />' : '<input id="manual-vert" type="text" style="width:130px;background:rgba(255,255,255,0.06);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.38rem 0.55rem;font-size:0.82rem;color:var(--color-white);font-family:inherit;" placeholder="Trade (e.g. Roofer)" />'}
      <button id="manual-go" class="action-btn">Go</button>
    </div>
  `);

  document.getElementById('parse-btn').addEventListener('click', () => {
    try {
      const parsed = JSON.parse(document.getElementById('dial-paste').value.trim());
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty array');
      liveQueue = parsed; liveIndex = 0; activeBranch = null;
      renderLiveCard(liveQueue[0]); renderStart();
    } catch(e) { alert('Could not parse JSON.\n\n' + e.message); }
  });
  document.getElementById('cancel-btn').addEventListener('click', renderStart);
  document.getElementById('manual-go').addEventListener('click', () => {
    const biz  = document.getElementById('manual-biz').value.trim();
    const vert = document.getElementById('manual-vert').value.trim();
    if (!biz) return;
    const defaultVert = activeMode === 'merch_opener' ? (vert || 'Contractor') : vert;
    liveQueue = [{ contact_id: 'manual-' + Date.now(), business_name: biz, vertical: defaultVert, phone: '', first_name: '', city: '', state: '' }];
    liveIndex = 0; activeBranch = null;
    renderLiveCard(liveQueue[0]); renderStart();
  });
}

/* ══════════════════════════════════════════════
   QUEUE PREVIEW
   ══════════════════════════════════════════════ */
function showPreview() {
  renderScreen(html`
    <div class="screen__eyebrow">Queue — ${liveQueue.length} dials</div>
    <div style="overflow-y:auto;max-height:320px;display:flex;flex-direction:column;gap:0.3rem;">
      ${liveQueue.map((p, i) => html`
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.38rem 0.5rem;background:${i===liveIndex?'rgba(227,107,30,0.12)':'rgba(255,255,255,0.03)'};border:1px solid ${i===liveIndex?'rgba(227,107,30,0.3)':'var(--color-border)'};border-radius:var(--radius-sm);cursor:pointer;" data-jump="${i}">
          <span style="font-size:0.65rem;font-weight:800;color:${i===liveIndex?'var(--color-accent)':'var(--color-white-dim)'};min-width:1.4rem;">${i+1}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(p.business_name||'—')}</div>
            <div style="font-size:0.63rem;color:var(--color-white-dim);">${escapeHTML(p.vertical||'')} · ${escapeHTML(p.city||'')}</div>
          </div>
          ${i===liveIndex?'<span style="font-size:0.6rem;color:var(--color-accent);font-weight:800;">NOW</span>':''}
        </div>
      `).join('')}
    </div>
    <button id="close-preview" class="action-btn" style="width:100%;margin-top:0.5rem;">← Back</button>
  `);
  stage().querySelectorAll('[data-jump]').forEach(row => {
    row.addEventListener('click', () => {
      liveIndex = parseInt(row.dataset.jump, 10);
      activeBranch = null; renderLiveCard(liveQueue[liveIndex]); renderStart();
    });
  });
  document.getElementById('close-preview').addEventListener('click', renderStart);
}

/* ══════════════════════════════════════════════
   RIGHT-SIDE PANELS (no queue loaded)
   ══════════════════════════════════════════════ */
let _lastVertSel = Object.keys(VERTICAL_INTEL)[0]; // persist dropdown selection

function _inputStyle() {
  return 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:4px 7px;font-size:0.76rem;color:var(--color-white);font-family:inherit;outline:none;';
}

/* Returns intel HTML for the body (merch or vertical, based on activeMode) */
function renderIntelHTML() {
  if (activeMode === 'merch_opener') {
    return '<div style="font-size:0.68rem;font-weight:800;font-family:var(--font-display);color:var(--color-white-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">👕 Merch Reference</div>' +
      '<div class="irow"><span class="ikey ik-g">Products</span><span class="ival ival--hi">Screen printed tees, hoodies, hats — contractor crews</span></div>' +
      '<div class="irow"><span class="ikey ik-a">Min Order</span><span class="ival">~12 pieces · Quick turnaround · Competitive pricing</span></div>' +
      '<div class="irow"><span class="ikey ik-b">Angle</span><span class="ival">Crew on a job site = rolling billboard. Quality gear that actually gets worn.</span></div>' +
      '<div class="irow"><span class="ikey" style="background:rgba(96,165,250,0.12);border-color:rgba(96,165,250,0.3);color:#60a5fa;min-width:3rem;">Transition</span><span class="ival">If warm → "Our main thing is digital marketing for contractors — happy to have that conversation too."</span></div>';
  }
  const vert      = _lastVertSel;
  const intel     = VERTICAL_INTEL[vert] || VERTICAL_INTEL_DEFAULT;
  const timeHint  = VERTICAL_WINDOWS[vert] || '';
  const vertMenuItems = Object.keys(VERTICAL_INTEL).map(function(v) {
    const active = v === vert;
    return '<div class="vert-opt" data-vert="' + escapeHTML(v) + '" style="padding:6px 10px;font-size:0.8rem;cursor:pointer;' +
      (active ? 'background:rgba(227,107,30,0.12);color:var(--color-accent);font-weight:700;' : 'color:var(--color-white);') +
      '">' + escapeHTML(v) + '</div>';
  }).join('');
  return '<div style="font-size:0.68rem;font-weight:800;font-family:var(--font-display);color:var(--color-white-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Vertical Intel</div>' +
    '<div id="vert-picker-wrap" style="position:relative;margin-bottom:6px;">' +
      '<button id="vert-picker-btn" style="width:100%;background:rgba(255,255,255,0.06);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:5px 10px;font-size:0.82rem;color:var(--color-white);font-family:inherit;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;">' +
        '<span>' + escapeHTML(vert) + '</span>' +
        '<span style="font-size:0.65rem;opacity:0.5;">▾</span>' +
      '</button>' +
      '<div id="vert-picker-menu" style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:300;background:#141414;border:1px solid rgba(227,107,30,0.35);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto;box-shadow:0 6px 20px rgba(0,0,0,0.6);">' +
        vertMenuItems +
      '</div>' +
    '</div>' +
    (timeHint ? '<div style="font-size:0.7rem;color:var(--color-accent);font-weight:700;margin-bottom:4px;">' + escapeHTML(timeHint) + '</div>' : '') +
    '<div class="irow"><span class="ikey ik-g">Quick Win</span><span class="ival ival--hi">' + escapeHTML(intel.win) + '</span></div>' +
    '<div class="irow"><span class="ikey ik-a">Hook</span><span class="ival ival--hook" id="hook-copy-btn" title="Click to copy">' + escapeHTML(intel.hook) + '</span></div>' +
    '<div class="irow"><span class="ikey ik-b">DM Note</span><span class="ival">' + escapeHTML(intel.dm) + '</span></div>' +
    '<div class="irow"><span class="ikey" style="background:rgba(96,165,250,0.12);border-color:rgba(96,165,250,0.3);color:#60a5fa;min-width:3rem;">Pitch</span><span class="ival">' + escapeHTML(intel.pitch) + '</span></div>';
}

/* Google Places search — routed through Cloudflare Worker to avoid browser CORS block */
async function searchPlaces(query) {
  _lookup.loading = true;
  _lookup.error   = '';
  _lookup.results = [];
  _lookup.selected = null;
  renderRightPanel();
  try {
    const res = await fetch('https://unc-sales-os-sync.ricky-a17.workers.dev/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-unc-key': (function(){try{var k=localStorage.getItem('unc_worker_key');return (k&&k.trim())||'';}catch(e){return '';}})()
      },
      body: JSON.stringify({ query: query })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Search failed');
    _lookup.results = data.places || [];
    if (!_lookup.results.length) _lookup.error = 'No results found.';
  } catch(e) {
    _lookup.error = 'Search failed: ' + e.message;
  }
  _lookup.loading = false;
  renderRightPanel();
}

/* Extract city + state abbreviation from a formatted address string */
function parseCity(addr) {
  if (!addr) return { city: '', state: '' };
  const parts = addr.split(',').map(s => s.trim());
  // e.g. "123 Main St, Dubuque, IA 52001, USA"
  if (parts.length >= 3) {
    return { city: parts[parts.length - 3] || '', state: (parts[parts.length - 2] || '').split(' ')[0] || '' };
  }
  return { city: '', state: '' };
}

/* Unified right-side panel — search bar always on top, body switches by lookup state */
function renderRightPanel() {
  const card = document.getElementById('prospect-card');
  if (!card || liveQueue.length) return;

  const searchBar =
    '<div style="font-size:0.68rem;font-weight:800;font-family:var(--font-display);color:var(--color-white-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">🔍 Prospect Lookup</div>' +
    '<div style="display:flex;gap:5px;margin-bottom:8px;">' +
      '<input id="lookup-input" type="text" value="' + escapeHTML(_lookup.query) + '" placeholder="Business name + city…" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:5px 8px;font-size:0.78rem;color:var(--color-white);font-family:inherit;outline:none;" />' +
      '<button id="lookup-btn" style="background:var(--color-accent);border:none;border-radius:var(--radius-sm);color:#fff;font-size:0.72rem;font-weight:800;padding:5px 10px;cursor:pointer;font-family:var(--font-display);">GO</button>' +
    '</div>';

  let body = '';

  if (_lookup.loading) {
    body = '<div style="text-align:center;padding:1rem 0;font-size:0.75rem;color:var(--color-white-dim);">Searching…</div>';

  } else if (_lookup.selected) {
    const p   = _lookup.selected;
    const loc = parseCity(p.formattedAddress || '');
    const is  = _inputStyle();
    body =
      '<div style="background:rgba(227,107,30,0.07);border:1px solid rgba(227,107,30,0.25);border-radius:var(--radius-sm);padding:8px;">' +
        '<div style="font-size:0.65rem;font-weight:800;font-family:var(--font-display);color:var(--color-accent);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Edit & Load</div>' +
        '<div style="display:flex;flex-direction:column;gap:5px;">' +
          '<input id="lk-biz"      type="text" value="' + escapeHTML((p.displayName && p.displayName.text) || '') + '" placeholder="Business name"       style="' + is + '" />' +
          '<input id="lk-fname"    type="text" value=""   placeholder="Owner first name"     style="' + is + '" />' +
          '<input id="lk-phone"    type="text" value="' + escapeHTML(p.nationalPhoneNumber || '') + '" placeholder="Phone"             style="' + is + '" />' +
          '<input id="lk-website"  type="text" value="' + escapeHTML(p.websiteUri || '')          + '" placeholder="Website"           style="' + is + '" />' +
          '<input id="lk-vertical" type="text" value=""   placeholder="Vertical / trade type" style="' + is + '" />' +
          '<div style="display:flex;gap:5px;">' +
            '<input id="lk-city"  type="text" value="' + escapeHTML(loc.city)  + '" placeholder="City"  style="' + is + '" />' +
            '<input id="lk-state" type="text" value="' + escapeHTML(loc.state) + '" placeholder="ST"    style="' + is + 'max-width:56px;" />' +
          '</div>' +
        '</div>' +
        (p.rating ? '<div style="font-size:0.65rem;color:var(--color-white-dim);margin-top:5px;">⭐ ' + p.rating + ' (' + (p.userRatingCount || 0) + ' reviews)</div>' : '') +
        '<button id="lk-load-btn"  style="width:100%;margin-top:8px;background:var(--color-accent);border:none;border-radius:var(--radius-sm);color:#fff;font-size:0.8rem;font-weight:800;padding:7px;cursor:pointer;font-family:var(--font-display);">📞 Load &amp; Dial</button>' +
        '<button id="lk-back-btn"  style="width:100%;margin-top:4px;background:transparent;border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-white-dim);font-size:0.72rem;padding:4px;cursor:pointer;font-family:var(--font-display);">← Back to results</button>' +
      '</div>';

  } else if (_lookup.results.length) {
    body =
      '<div style="display:flex;flex-direction:column;gap:3px;max-height:210px;overflow-y:auto;">' +
        _lookup.results.map(function(pl, i) {
          return '<div class="lookup-result" data-idx="' + i + '" style="padding:5px 7px;border:1px solid var(--color-border);border-radius:var(--radius-sm);cursor:pointer;background:rgba(255,255,255,0.02);">' +
            '<div style="font-size:0.76rem;font-weight:700;color:var(--color-white);">' + escapeHTML((pl.displayName && pl.displayName.text) || '—') + '</div>' +
            '<div style="font-size:0.63rem;color:var(--color-white-dim);margin-top:1px;">' + escapeHTML(pl.formattedAddress || '') + '</div>' +
            (pl.nationalPhoneNumber ? '<div style="font-size:0.63rem;color:var(--color-white-dim);">' + escapeHTML(pl.nationalPhoneNumber) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>' +
      '<div style="font-size:0.63rem;color:var(--color-white-dim);margin-top:4px;padding-bottom:2px;">Click a result to select and edit.</div>';

  } else if (_lookup.error) {
    body = '<div style="font-size:0.75rem;color:#f87171;padding:0.5rem 0;">' + escapeHTML(_lookup.error) + '</div>';

  } else {
    body = renderIntelHTML();
  }

  card.innerHTML =
    '<div class="card-head">' + searchBar + '</div>' +
    '<div class="card-intel">' + body + '</div>';
  card.hidden = false;

  /* ── wire search bar ── */
  const input = document.getElementById('lookup-input');
  const goBtn = document.getElementById('lookup-btn');
  if (input && goBtn) {
    const doSearch = function() {
      const q = input.value.trim();
      if (!q) return;
      _lookup.query = q;
      searchPlaces(q);
    };
    goBtn.addEventListener('click', doSearch);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });
  }

  /* ── wire results list ── */
  card.querySelectorAll('.lookup-result').forEach(function(el) {
    el.addEventListener('mouseenter', function() { el.style.borderColor = 'rgba(227,107,30,0.4)'; el.style.background = 'rgba(227,107,30,0.06)'; });
    el.addEventListener('mouseleave', function() { el.style.borderColor = 'var(--color-border)'; el.style.background = 'rgba(255,255,255,0.02)'; });
    el.addEventListener('click', function() {
      _lookup.selected = _lookup.results[parseInt(el.dataset.idx, 10)];
      renderRightPanel();
    });
  });

  /* ── wire Load & Dial ── */
  const loadBtn = document.getElementById('lk-load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', function() {
      const biz     = (document.getElementById('lk-biz')      || {}).value || '';
      const fname   = (document.getElementById('lk-fname')    || {}).value || '';
      const phone   = (document.getElementById('lk-phone')    || {}).value || '';
      const website = (document.getElementById('lk-website')  || {}).value || '';
      const vert    = (document.getElementById('lk-vertical') || {}).value || '';
      const city    = (document.getElementById('lk-city')     || {}).value || '';
      const state   = (document.getElementById('lk-state')    || {}).value || '';
      const pl      = _lookup.selected;
      if (!biz) return;
      liveQueue = [{
        contact_id:       'lookup-' + Date.now(),
        business_name:    biz,
        first_name:       fname,
        phone:            phone,
        website:          website,
        email:            '',
        vertical:         vert,
        city:             city,
        state:            state,
        gbp_review_count: pl && pl.userRatingCount ? pl.userRatingCount : null,
        gbp_rating:       pl && pl.rating ? pl.rating : null
      }];
      liveIndex    = 0;
      activeBranch = null;
      _lookup      = { query: '', results: [], selected: null, loading: false, error: '' };
      renderLiveCard(liveQueue[0]);
      renderStart();
    });
  }

  /* ── wire back-to-results ── */
  const backBtn = document.getElementById('lk-back-btn');
  if (backBtn) backBtn.addEventListener('click', function() { _lookup.selected = null; renderRightPanel(); });

  /* ── wire custom vert-picker (default other_verticals state only) ── */
  const pickerBtn  = document.getElementById('vert-picker-btn');
  const pickerMenu = document.getElementById('vert-picker-menu');
  if (pickerBtn && pickerMenu) {
    pickerBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      pickerMenu.style.display = pickerMenu.style.display === 'none' ? 'block' : 'none';
    });
    pickerMenu.querySelectorAll('.vert-opt').forEach(function(opt) {
      opt.addEventListener('mouseenter', function() {
        opt.style.background = 'rgba(227,107,30,0.1)';
        opt.style.color = 'var(--color-accent)';
      });
      opt.addEventListener('mouseleave', function() {
        const isActive = opt.dataset.vert === _lastVertSel;
        opt.style.background = isActive ? 'rgba(227,107,30,0.12)' : '';
        opt.style.color = isActive ? 'var(--color-accent)' : 'var(--color-white)';
      });
      opt.addEventListener('click', function() {
        _lastVertSel = opt.dataset.vert;
        pickerMenu.style.display = 'none';
        renderRightPanel();
      });
    });
    document.addEventListener('click', function _closeVP(e) {
      const wrap = document.getElementById('vert-picker-wrap');
      if (!wrap || !wrap.contains(e.target)) {
        if (pickerMenu) pickerMenu.style.display = 'none';
        document.removeEventListener('click', _closeVP);
      }
    });
  }

  /* ── wire hook copy (default other_verticals state only) ── */
  const hcb = document.getElementById('hook-copy-btn');
  if (hcb) hcb.addEventListener('click', function() {
    navigator.clipboard.writeText(hcb.textContent.trim());
    hcb.style.color = '#22c55e';
    setTimeout(function() { hcb.style.color = ''; }, 800);
  });
}

/* ══════════════════════════════════════════════
   LIVE CARD
   ══════════════════════════════════════════════ */
function renderLiveCard(prospect) {
  if (!prospect) return;
  if (Shell._state) {
    Shell._state.contact = {
      id: prospect.contact_id, first_name: prospect.first_name||'', last_name: prospect.last_name||'',
      business_name: prospect.business_name, phone: prospect.phone, email: prospect.email||'',
      website: prospect.website||'', trade: prospect.vertical||prospect.trade_type||'',
      city: prospect.city, state: prospect.state
    };
  }
  const card = document.getElementById('prospect-card');
  if (!card) return;

  const portalId  = (Shell._state&&Shell._state.hubConfig&&Shell._state.hubConfig.portal_id)||'245833525';
  const hubURL    = 'https://app-na2.hubspot.com/contacts/'+portalId+'/contact/'+prospect.contact_id;
  const vertLabel = (prospect.vertical||prospect.trade_type||prospect.trade||'').trim();
  const intel     = VERTICAL_INTEL[vertLabel] || VERTICAL_INTEL_DEFAULT;
  const timeHint  = VERTICAL_WINDOWS[vertLabel] || '';
  const cityState = [prospect.city, prospect.state].filter(Boolean).join(', ');
  const lastOut   = prospect.last_call_outcome || '';
  const lastTouchHTML = lastOut
    ? `<span style="font-size:0.7rem;padding:0.12rem 0.38rem;border-radius:3px;background:rgba(227,107,30,0.12);border:1px solid rgba(227,107,30,0.25);color:var(--color-accent);font-weight:700;">${escapeHTML(lastOut)}</span>`
    : `<span style="font-size:0.7rem;color:var(--color-white-dim);">First contact</span>`;

  card.innerHTML =
    '<div class="card-head">' +
      '<div class="card-top">' +
        '<span class="card-pos">#' + (liveIndex+1) + '</span>' +
        '<span class="card-of"> of ' + (liveQueue.length||1) + '</span>' +
        '<span class="card-trade">' + escapeHTML(vertLabel||'Local Biz') + '</span>' +
        (timeHint ? '<span class="card-time">' + escapeHTML(timeHint) + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:0.28rem;margin-bottom:0.25rem;">' +
        '<div class="card-biz" style="flex:1;margin-bottom:0;">' + escapeHTML(prospect.business_name||'—') + '</div>' +
        '<button class="card-mini-btn" id="live-prev"' + (liveIndex<=0?' disabled':'') + '>‹</button>' +
        '<button class="card-mini-btn" id="live-next"' + (liveIndex>=(liveQueue.length||1)-1?' disabled':'') + '>›</button>' +
        '<button class="card-mini-btn" id="skip-btn">Skip</button>' +
        '<button class="card-mini-btn card-mini-btn--red" id="dnc-btn">DNC</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:0.4rem;">' +
        '<a href="tel:' + escapeHTML(prospect.phone||'') + '" class="card-phone">' + escapeHTML(prospect.phone||'No phone') + '</a>' +
        lastTouchHTML +
        '<a href="' + hubURL + '" target="_blank" rel="noopener" class="card-hs-btn" style="margin-left:auto;">↗ HubSpot</a>' +
      '</div>' +
    '</div>' +
    (function(){
      const ok  = String(prospect.best_phone_verified||'').toLowerCase()==='true'||String(prospect.best_phone_verified)==='1';
      const dm  = String(prospect.decision_maker_known||'').toLowerCase()==='true'||String(prospect.decision_maker_known)==='1';
      const gbp = prospect.gbp_review_count ? parseInt(prospect.gbp_review_count,10) : null;
      const gap = prospect.website_gaps||'';
      let b = '';
      b += ok  ? '<span class="badge bg">✓ Phone verified</span>' : '<span class="badge ba">Phone unverified</span>';
      b += dm  ? '<span class="badge bg">✓ DM known</span>'       : '<span class="badge ba">DM unknown</span>';
      if (gbp!==null) b += '<span class="badge bb">⭐ '+gbp+' reviews</span>';
      if (gap) b += '<span class="badge br" title="'+escapeHTML(gap)+'">⚠ '+escapeHTML(gap.length>20?gap.slice(0,20)+'…':gap)+'</span>';
      if (lastOut&&lastOut!=='COLD') b += '<span class="badge ba">'+escapeHTML(lastOut)+'</span>';
      return '<div class="card-badges">'+b+'</div>';
    })() +
    '<div class="card-intel">' +
      (activeMode === 'other_verticals' ? (
        '<div class="irow"><span class="ikey ik-g">Quick Win</span><span class="ival ival--hi">' + escapeHTML(prospect.quick_win||intel.win) + '</span></div>' +
        '<div class="irow"><span class="ikey ik-a">Hook</span><span class="ival ival--hook" id="hook-copy-btn" title="Click to copy">' + escapeHTML(prospect.ai_hook||intel.hook) + '</span></div>' +
        '<div class="irow"><span class="ikey ik-b">DM Note</span><span class="ival">' + escapeHTML(intel.dm) + '</span></div>'
      ) : (
        '<div class="irow"><span class="ikey ik-g">Goal</span><span class="ival ival--hi">Get the email for a quote OR plant the marketing seed</span></div>' +
        '<div class="irow"><span class="ikey ik-a">Angle</span><span class="ival">Quality branded merch → crew visibility → "we also do digital marketing for contractors"</span></div>' +
        '<div class="irow"><span class="ikey ik-b">Min Order</span><span class="ival">~12 pieces · Hoodies, polos, tees, hats, truck magnets</span></div>'
      )) +
      (prospect.email   ? '<div class="drow"><span class="dkey">Email:</span><span class="dval"><a href="mailto:'+escapeHTML(prospect.email)+'" style="color:var(--color-white-dim);">'+escapeHTML(prospect.email)+'</a></span></div>' : '') +
      (prospect.website ? '<div class="drow"><span class="dkey">Site:</span><span class="dval"><a href="'+escapeHTML(prospect.website)+'" target="_blank" rel="noopener" style="color:#60a5fa;">'+escapeHTML(prospect.website.replace(/^https?:\/\//,''))+'</a></span></div>' : '') +
      (cityState        ? '<div class="drow"><span class="dkey">Location:</span><span class="dval">'+escapeHTML(cityState)+'</span></div>' : '') +
    '</div>';

  card.hidden = false;
  const cnp = document.getElementById('call-notes-panel');
  if (cnp) cnp.hidden = false;

  const hcb = document.getElementById('hook-copy-btn');
  if (hcb) hcb.addEventListener('click', () => { navigator.clipboard.writeText(hcb.textContent.trim()); hcb.style.color='#22c55e'; setTimeout(()=>hcb.style.color='',800); });

  document.getElementById('live-prev').addEventListener('click', () => { if (liveIndex>0) { liveIndex--; activeBranch=null; renderLiveCard(liveQueue[liveIndex]); renderStart(); } });
  document.getElementById('live-next').addEventListener('click', () => { if (liveIndex<liveQueue.length-1) { liveIndex++; activeBranch=null; renderLiveCard(liveQueue[liveIndex]); renderStart(); } });
  document.getElementById('skip-btn').addEventListener('click', () => {
    queueSync({ contact_id: prospect.contact_id, business_name: prospect.business_name, outcome: 'SKIP', branch: 'skip', mode: activeMode, notes: '', timestamp: new Date().toISOString() });
    if (liveIndex<liveQueue.length-1) { liveIndex++; activeBranch=null; renderLiveCard(liveQueue[liveIndex]); renderStart(); }
  });
  document.getElementById('dnc-btn').addEventListener('click', () => {
    if (!confirm('Mark ' + (prospect.business_name||'this contact') + ' as DNC?')) return;
    logOutcome('DNC');
  });

  syncNotes(prospect.contact_id);
}

/* ══════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════ */
async function boot() {
  await Shell.init({ cockpit: 'niche-outreach' });
  Shell.bindNotes();
  Shell.onReset(renderStart);

  const goBack = () => {
    if (history.length) {
      history.pop(); renderStart();
    } else {
      // In workspace iframe — don't navigate away, just reset to start
      if (window.parent !== window) { renderStart(); }
      else { window.location.href = '/sales-ops/workspace/'; }
    }
  };

  Shell.onBack(goBack);
  const backBtn    = document.getElementById('nav-back');
  const restartBtn = document.getElementById('nav-restart');
  if (backBtn)    backBtn.addEventListener('click', goBack);
  if (restartBtn) restartBtn.addEventListener('click', () => {
    activeBranch=null; activeStyle='word_for_word'; history.length=0;
    document.getElementById('outcome-buttons').hidden=true;
    renderStart();
  });

  wireModeBar();
  renderStart();
}
// ── WORKSPACE → COCKPIT EVENT BRIDGE ────────────────────────────────────────
window.addEventListener('unc:queue-injected', function(ev) {
  var prospects = ev.detail && ev.detail.prospects;
  if (!Array.isArray(prospects) || !prospects.length) return;
  liveQueue.length = 0;
  prospects.forEach(function(p) { liveQueue.push(p); });
  liveIndex = (ev.detail && typeof ev.detail.index === 'number' && ev.detail.index >= 0 && ev.detail.index < liveQueue.length) ? ev.detail.index : 0;
  renderStart();
});

// Append without touching the active call
window.addEventListener('unc:queue-appended', function(ev) {
  var p = ev.detail && ev.detail.prospect;
  if (!p) return;
  var exists = liveQueue.some(function(x) { return String(x.contact_id) === String(p.contact_id); });
  if (!exists) liveQueue.push(p);
  if (liveQueue.length === 1) { liveIndex = 0; renderStart(); }
});

window.addEventListener('unc:prospect-loaded', function(ev) {
  // Legacy single-load: append-or-find + jump. Never wipes the queue.
  var p = ev.detail && ev.detail.prospect;
  if (!p) return;
  var idx = -1;
  for (var i = 0; i < liveQueue.length; i++) { if (String(liveQueue[i].contact_id) === String(p.contact_id)) { idx = i; break; } }
  if (idx === -1) { liveQueue.push(p); idx = liveQueue.length - 1; }
  liveIndex = idx;
  renderStart();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
