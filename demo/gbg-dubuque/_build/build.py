#!/usr/bin/env python3
"""
GBG Dubuque site generator.

  python build.py            -> STAGING build (noindex, canonicals on urbanbackstage.com/gbg)
  python build.py --prod     -> PRODUCTION build (indexable, canonicals on https://gbgdubuque.com)

Run from anywhere; writes into the parent (gbg/) folder. This folder starts with an
underscore so GitHub Pages/Jekyll does not publish it.
"""
import os, sys, json, random, datetime, html

PROD = '--prod' in sys.argv
BASE = 'https://gbgdubuque.com' if PROD else 'https://urbanbackstage.com/gbg'
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TODAY = datetime.date.today().isoformat()

PHONE_DISPLAY = '(515) 344-4053'
PHONE_TEL = '+15153444053'
EMAIL = 'info@gbgdubuque.com'
GEO = (42.5006, -90.6646)
RADIUS_M = 48280  # 30 miles

def esc(s): return html.escape(s, quote=True)

# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------
TOWNS = {
    'Iowa': ['Dubuque', 'Asbury', 'Peosta', 'Epworth', 'Farley', 'Key West', 'Sherrill', 'Holy Cross', 'Dyersville', 'Cascade', 'Bellevue'],
    'Illinois': ['East Dubuque', 'Galena', 'Hanover', 'Elizabeth', 'Scales Mound', 'Stockton'],
    'Wisconsin': ['Hazel Green', 'Cuba City', 'Dickeyville', 'Potosi', 'Platteville'],
}
STATE_ABBR = {'Iowa': 'IA', 'Illinois': 'IL', 'Wisconsin': 'WI'}

SERVICES = [
  dict(slug='permanent-lights', name='Permanent Lights', short='Custom-fit architectural lighting that traces your roofline. Installed once, on every night of the year.',
       inhouse=True, art='lights',
       title='Permanent Lighting Installation in Dubuque, IA | GBG Dubuque',
       desc='Permanent roofline lighting in Dubuque, Iowa and the tri-state area. Custom-fit, phone-controlled, any color for any holiday. Get a private estimate.',
       h1a='Permanent lights,', h1b='designed around your home.',
       lead='A clean, custom-fit line of light along your eaves and gables. Warm white for everyday elegance, then any color or pattern for every holiday, controlled from your phone. No ladders, no tangled strands, nothing to take down in January.',
       bullets=['Custom-fit to your home’s exact roofline','Blends into the trim during the day','Change colors, patterns and speed from your phone','One install replaces every seasonal light job','Serving Dubuque and communities within about 30 miles'],
       steps=[('Consult','We walk your property and talk through the look you want.'),('Design','We map your roofline and plan the layout.'),('Install','Clean, careful installation and a walkthrough of your controls.')],
       faqs=[('Do permanent lights have to come down each season?','No. Permanent lights are installed once along your roofline and stay up all year. They are designed to blend into the trim during the day.'),
             ('Can I change the colors and patterns?','Yes. Colors, patterns and schedules are controlled from your phone, so you can switch from warm white to holiday colors in seconds. Try the light studio on this page to preview the idea.'),
             ('Are permanent lights worth it in an Iowa winter?','Permanent lighting is built to stay up through the season, and Dubuque’s long, dark winters are when a well-lit home stands out most. We will walk through durability and what to expect during your estimate.'),
             ('Do you install permanent lights outside Dubuque?','Yes. We serve Dubuque and communities within roughly 30 miles, including parts of Iowa, Illinois and Wisconsin. See our service areas page.')],
       kw='permanent lights Dubuque, permanent holiday lighting Dubuque Iowa, permanent roofline lighting, trimlight alternative Dubuque'),
  dict(slug='driveway-sealing', name='Driveway Sealing', short='Cleaned, repaired and sealed to a deep, even finish that protects your driveway and frames your home.',
       inhouse=True, art='seal',
       title='Driveway Sealing in Dubuque, IA | GBG Dubuque',
       desc='Professional driveway sealing in Dubuque, Iowa and the tri-state area. Deep clean, crack repair and an even sealed finish that protects your driveway.',
       h1a='Driveway sealing,', h1b='the finish that frames the house.',
       lead='A driveway is the first thing people see. We clean it, repair the cracks and seal it to a deep, uniform finish that protects the surface through Iowa freeze-thaw cycles and sharpens the whole property.',
       bullets=['Deep clean to remove dirt, oil and growth','Cracks repaired before anything is sealed','Even coat with clean edges and no missed corners','Helps protect against water, salt and freeze-thaw wear','Serving Dubuque and communities within about 30 miles'],
       steps=[('Clean','Deep clean to remove dirt, oil and growth.'),('Repair','Cracks filled before anything is sealed.'),('Seal','Even coat, clean edges, no missed corners.')],
       faqs=[('When is the best time to seal a driveway in Iowa?','Sealing works best in warm, dry weather, typically late spring through early fall. We will recommend timing when we see your driveway.'),
             ('How long until I can drive on a sealed driveway?','Most driveways need roughly 24 to 48 hours to cure depending on weather. We will tell you exactly when yours is ready.'),
             ('How often should a driveway be sealed?','It depends on the surface, traffic and exposure. During your estimate we will assess the condition and tell you honestly whether it needs sealing now or can wait.'),
             ('Do you seal driveways outside Dubuque?','Yes. We serve Dubuque and communities within roughly 30 miles across Iowa, Illinois and Wisconsin.')],
       kw='driveway sealing Dubuque, driveway sealcoating Dubuque Iowa, asphalt driveway sealing, crack repair Dubuque'),
  dict(slug='yard-spraying', name='Yard Spraying', short='Recurring lawn treatment to keep the yard looking its best all season.',
       inhouse=True, art='yard',
       title='Recurring Yard Spraying in Dubuque, IA | GBG Dubuque',
       desc='Recurring yard spraying in Dubuque, Iowa and nearby towns. Scheduled lawn treatments that keep your yard thick, green and weed-resistant all season.',
       h1a='Yard spraying,', h1b='on a schedule you never think about.',
       lead='A great lawn is built over a season, not a weekend. Our recurring yard spraying program keeps treatments on schedule so your yard stays thick, green and clean-edged from spring through fall.',
       bullets=['Recurring visits so nothing gets missed','Consistent treatment through the growing season','One team coordinating lawn, driveway and exterior care','Serving Dubuque and communities within about 30 miles'],
       steps=[('Assess','We look at your lawn and set a plan.'),('Treat','Scheduled applications through the season.'),('Maintain','Ongoing visits so results build over time.')],
       faqs=[('What does a recurring yard spraying program include?','We will confirm the exact treatments and schedule for your lawn during your estimate, so the plan fits your yard rather than a one-size-fits-all package.'),
             ('How often will you spray?','Recurring programs follow a set schedule through the growing season. We will share the timeline when we quote your yard.'),
             ('Can I bundle yard spraying with other services?','Yes. Many homeowners pair recurring lawn care with driveway sealing, trash can cleaning or permanent lighting so one team handles everything.')],
       kw='yard spraying Dubuque, lawn treatment Dubuque Iowa, recurring lawn care Dubuque'),
  dict(slug='trash-can-cleaning', name='Trash Can Cleaning', short='Recurring cleaning so bins stay fresh and out of sight.',
       inhouse=True, art='trash',
       title='Trash Can Cleaning in Dubuque, IA | GBG Dubuque',
       desc='Recurring trash can cleaning in Dubuque, Iowa and nearby towns. Sanitized, deodorized bins on a schedule so your curb stays clean.',
       h1a='Trash can cleaning,', h1b='fresh bins, zero effort.',
       lead='Nobody enjoys scrubbing bins. We clean and deodorize your cans on a recurring schedule so the smell, the grime and the chore all disappear.',
       bullets=['Recurring schedule that fits your pickup day','Cans cleaned and deodorized','Pairs well with yard spraying and driveway care','Serving Dubuque and communities within about 30 miles'],
       steps=[('Schedule','Pick a cadence that fits your pickup day.'),('Clean','Bins cleaned and deodorized on site.'),('Repeat','We come back on schedule, automatically.')],
       faqs=[('How often should trash cans be cleaned?','Many households choose a recurring cadence. We will set a schedule that fits your pickup day and how often you would like fresh bins.'),
             ('Do I need to be home?','Not usually. We will confirm the details when you book so the process is easy for you.'),
             ('Do you serve towns outside Dubuque?','Yes, within roughly 30 miles of Dubuque across Iowa, Illinois and Wisconsin. Check the service areas page.')],
       kw='trash can cleaning Dubuque, bin cleaning Dubuque Iowa, recurring trash can cleaning'),
  dict(slug='epoxy-coating', name='Epoxy Coating', short='Durable, polished floors for garages and more.',
       inhouse=True, art='epoxy',
       title='Epoxy Garage Floor Coating in Dubuque, IA | GBG Dubuque',
       desc='Epoxy floor coating for garages in Dubuque, Iowa and nearby towns. A durable, polished finish that resists stains and transforms your garage.',
       h1a='Epoxy coating,', h1b='a garage floor worth parking on.',
       lead='Bare concrete stains, dusts and cracks. A quality epoxy coating turns your garage floor into a durable, polished surface that is easier to clean and a lot better to look at.',
       bullets=['Durable, polished, easy-to-clean finish','Resists stains and everyday wear','Finish options to match your home','Serving Dubuque and communities within about 30 miles'],
       steps=[('Prep','Surface prepared so the coating bonds properly.'),('Coat','Epoxy applied evenly for a smooth, polished look.'),('Cure','Finished floor cures before it goes back into service.')],
       faqs=[('How long does an epoxy garage floor last?','Longevity depends on prep, product and use. We will explain what to expect for your garage when we quote the job.'),
             ('Can epoxy be applied to any garage floor?','Most garage slabs can be coated once properly prepared. We will inspect yours during the estimate and tell you what it needs.'),
             ('How long before I can park on it?','Cure time depends on the product and conditions. We will give you a clear timeline before we start.')],
       kw='epoxy garage floor Dubuque, epoxy coating Dubuque Iowa, garage floor coating'),
  dict(slug='painting', name='Painting', short='Exterior painting by a vetted local pro, coordinated by us.',
       inhouse=False, art='paint',
       title='Exterior Painting in Dubuque, IA | GBG Dubuque',
       desc='Exterior painting in Dubuque, Iowa coordinated by GBG with a trusted local painting partner. One point of contact from estimate to finished walls.',
       h1a='Exterior painting,', h1b='coordinated by people you already trust.',
       lead='We do not paint in-house, and we would rather tell you that than pretend otherwise. When you need exterior painting, we bring in a vetted local painting partner and coordinate the whole job so you only deal with GBG.',
       bullets=['A vetted local painting partner, not a random sub','One point of contact from estimate to finish','We coordinate scheduling so it fits around your other exterior work','Serving Dubuque and communities within about 30 miles'],
       steps=[('Request','Tell us about the project.'),('Coordinate','We connect you with our trusted painting partner.'),('Finish','We keep the job on track through completion.')],
       faqs=[('Does GBG paint in-house?','No. Painting is handled by a trusted local partner that we coordinate for you. You get one point of contact and we stay involved from estimate to finish.'),
             ('Who do I pay?','We will confirm exactly how billing works when we set up your project so there are no surprises.'),
             ('Can painting be bundled with other exterior work?','Yes. We can sequence painting alongside driveway sealing, lighting or other work so everything fits together.')],
       kw='exterior painting Dubuque, house painters Dubuque Iowa, exterior house painting'),
  dict(slug='landscaping', name='Landscaping', short='Design and installation from an established Dubuque team.',
       inhouse=False, art='land',
       title='Landscaping in Dubuque, IA | GBG Dubuque',
       desc='Landscape design and installation in Dubuque, Iowa coordinated by GBG with an established local landscaping partner. One point of contact.',
       h1a='Landscaping,', h1b='designed to match the house.',
       lead='Great exterior work works together. For landscape design and installation we coordinate with an established local landscaping team, so your beds, plantings and hardscape fit the rest of the property.',
       bullets=['An established local landscaping partner','One point of contact from concept to completion','Coordinated with lighting, sealing and other exterior work','Serving Dubuque and communities within about 30 miles'],
       steps=[('Vision','Share what you want the property to feel like.'),('Coordinate','We connect you with our landscaping partner.'),('Install','We keep the project moving to the finish.')],
       faqs=[('Does GBG do landscaping in-house?','No. Landscaping is delivered by a trusted local partner that we coordinate for you, with GBG as your single point of contact.'),
             ('Can landscaping be planned around permanent lighting?','Yes, and it is a good idea. Coordinating them means plantings and lighting complement each other.'),
             ('What areas do you serve?','Dubuque and communities within about 30 miles across Iowa, Illinois and Wisconsin.')],
       kw='landscaping Dubuque, landscape design Dubuque Iowa, landscapers near Dubuque'),
  dict(slug='tree-service', name='Tree Service', short='Trimming and removal by experienced local arborists.',
       inhouse=False, art='tree',
       title='Tree Service in Dubuque, IA | GBG Dubuque',
       desc='Tree trimming and removal in Dubuque, Iowa coordinated by GBG with an experienced local tree service partner. One point of contact.',
       h1a='Tree service,', h1b='handled by experienced hands.',
       lead='Trees are not a DIY job. For trimming and removal we coordinate with an experienced local tree service so the work is done safely, cleanly and on your schedule, with GBG as your single point of contact.',
       bullets=['An experienced local tree service partner','One point of contact from estimate to cleanup','Coordinated with the rest of your exterior work','Serving Dubuque and communities within about 30 miles'],
       steps=[('Request','Tell us which trees and what you need.'),('Coordinate','We connect you with our tree service partner.'),('Cleanup','We make sure the job is finished properly.')],
       faqs=[('Does GBG remove trees itself?','No. Tree service is delivered by a trusted local partner that we coordinate for you. GBG stays your single point of contact.'),
             ('Can tree work be scheduled around other exterior projects?','Yes. We sequence it so trimming happens before lighting, sealing or landscaping where that makes sense.'),
             ('What areas do you serve?','Dubuque and communities within about 30 miles across Iowa, Illinois and Wisconsin.')],
       kw='tree service Dubuque, tree trimming Dubuque Iowa, tree removal Dubuque'),
]
SVC = {s['slug']: s for s in SERVICES}

HOME_FAQ = [
  ('Do permanent lights have to come down each season?','No. Permanent lights are installed once along your roofline and stay up all year, designed to blend into the trim by day.'),
  ('Can I change the colors?','Yes. Colors, patterns and schedules are controlled from your phone, so you can go from warm white to holiday colors in seconds.'),
  ('When is the best time to seal a driveway in Iowa?','Warm, dry weather works best, typically late spring through early fall. We will recommend timing once we have seen your driveway.'),
  ('How long until I can drive on a sealed driveway?','Most driveways need roughly 24 to 48 hours to cure depending on weather. We will tell you exactly when yours is ready.'),
  ('What areas do you serve?','Dubuque and communities within roughly 30 miles, including parts of Iowa, Illinois and Wisconsin. See our service areas page or call to confirm your address.'),
]

# --------------------------------------------------------------------------
# Shared partials
# --------------------------------------------------------------------------
LOGO = ('<svg viewBox="0 0 90 90" aria-hidden="true"><g fill="#e36b1e">'
        '<rect x="4" y="60" width="24" height="24" rx="2"/><rect x="33" y="60" width="24" height="24" rx="2"/><rect x="62" y="60" width="24" height="24" rx="2"/>'
        '<rect x="18.5" y="32" width="24" height="24" rx="2"/><rect x="47.5" y="32" width="24" height="24" rx="2"/>'
        '<rect x="33" y="4" width="24" height="24" rx="2"/></g></svg>')

def url(path=''):
    return BASE + ('/' + path if path else '/')

def svg_defs():
    return ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
            '<filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>'
            '<linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0a0d"/><stop offset="1" stop-color="#040405"/></linearGradient>'
            '<linearGradient id="wallglow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--lc,#ffd9a0)" stop-opacity=".16"/>'
            '<stop offset="1" style="stop-color:var(--lc,#ffd9a0)" stop-opacity="0"/></linearGradient></defs></svg>')

def head(page, r):
    """page: dict(title, desc, path, og_type, schema[list of dicts], kw)"""
    canon = url(page['path'])
    robots = '<meta name="robots" content="index,follow,max-image-preview:large">' if PROD else '<meta name="robots" content="noindex,nofollow">'
    ld = ''.join('<script type="application/ld+json">%s</script>\n' % json.dumps(s, ensure_ascii=False, separators=(',', ':')) for s in page['schema'])
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(page['title'])}</title>
<meta name="description" content="{esc(page['desc'])}">
{robots}
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#0c0c0e">
<meta property="og:site_name" content="GBG Dubuque">
<meta property="og:title" content="{esc(page['title'])}">
<meta property="og:description" content="{esc(page['desc'])}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{BASE}/assets/og.png">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(page['title'])}">
<meta name="twitter:description" content="{esc(page['desc'])}">
<meta name="twitter:image" content="{BASE}/assets/og.png">
<meta name="geo.region" content="US-IA">
<meta name="geo.placename" content="Dubuque">
<meta name="geo.position" content="{GEO[0]};{GEO[1]}">
<meta name="ICBM" content="{GEO[0]}, {GEO[1]}">
<link rel="icon" href="{r}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{r}assets/site.css?v=3">
{ld}</head>
<body>
<script>document.documentElement.classList.add('js');window.GBG={{email:{json.dumps(EMAIL)}}}</script>
'''

def nav(r):
    feat = ''
    for i, s in enumerate(SERVICES[:2]):
        feat += f'<a class="big" href="{r}{s["slug"]}/" style="--i:{i}"><b>{esc(s["name"])}</b><span>{esc(s["short"])}</span></a>'
    more = ''
    for i, s in enumerate(SERVICES[2:]):
        tag = 'In-house' if s['inhouse'] else 'Trusted partner'
        more += f'<a class="sm" href="{r}{s["slug"]}/" style="--i:{i}">{esc(s["name"])}<i>{tag}</i></a>'
    return f'''<a class="skip" href="#main">Skip to content</a>
<nav class="top" id="nav" aria-label="Main">
  <div class="wrap">
    <a href="{r or './'}" class="brand" aria-label="GBG Dubuque home">{LOGO}<div><b>GBG</b><span>DUBUQUE</span></div></a>
    <div class="nav-r">
      <a class="tel" href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a>
      <a class="btn btn-primary" href="{r}#contact">Private Estimate</a>
      <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="menu" id="menu">
  <div class="wrap menu-grid">
    <div class="menu-col"><h4 style="--i:0">Featured</h4>{feat}</div>
    <div class="menu-col"><h4 style="--i:0">More services</h4>{more}</div>
    <div class="menu-col">
      <h4 style="--i:0">Company</h4>
      <a class="sm" href="{r}service-areas/" style="--i:1">Service areas</a>
      <a class="sm" href="{r}careers/" style="--i:2">Careers</a>
      <a class="sm" href="{r}#contact" style="--i:3">Request an estimate</a>
      <a class="mcall" href="tel:{PHONE_TEL}" style="--i:4">{PHONE_DISPLAY}</a>
      <p class="mnote" style="--i:5">Locally owned. Serving Dubuque and communities within about 30 miles.</p>
    </div>
  </div>
</div>
'''

def sticky(r):
    return f'<div class="sticky"><a class="btn btn-ghost" href="tel:{PHONE_TEL}">Call</a><a class="btn btn-primary" href="{r}#contact">Free estimate</a></div>\n'

def footer(r):
    svc = ''.join(f'<li><a href="{r}{s["slug"]}/">{esc(s["name"])}</a></li>' for s in SERVICES)
    towns = ''.join(f'<li><a href="{r}service-areas/">{t}, {STATE_ABBR[st]}</a></li>' for t in ['Dubuque', 'Asbury', 'Peosta', 'East Dubuque', 'Galena', 'Dyersville'] for st in TOWNS if t in TOWNS[st])
    return f'''<footer>
  <div class="wrap">
    <div class="fgrid">
      <div>
        <a class="brand" href="{r or './'}">{LOGO}<div><b>GBG</b><span>DUBUQUE</span></div></a>
        <p style="margin-top:1rem;max-width:22rem">Permanent lighting and driveway sealing for Dubuque, Iowa and communities within about 30 miles. Locally owned. Built in North Dubuque.</p>
      </div>
      <div><h4>Services</h4><ul>{svc}</ul></div>
      <div><h4>Areas</h4><ul>{towns}<li><a href="{r}service-areas/">All service areas</a></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="{r}careers/">Careers</a></li><li><a href="{r}#contact">Request an estimate</a></li><li><a href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a></li></ul></div>
    </div>
    <div class="legal"><span>&copy; {datetime.date.today().year} GBG Dubuque &middot; Dubuque, Iowa</span><span>Trusted-partner services are coordinated by GBG and performed by independent local businesses.</span></div>
  </div>
</footer>
<script src="{r}assets/site.js?v=3" defer></script>
</body>
</html>
'''

def lead_form(default_service='Permanent Lights', form_name='estimate', careers=False):
    if careers:
        opts = ''.join(f'<option>{o}</option>' for o in ['Lighting installation technician', 'Sealing / exterior crew', 'Crew lead', 'Estimator / sales', 'Something else'])
        body = f'''
      <div class="row2"><label>Name<input name="name" required autocomplete="name"></label><label>Phone<input name="phone" type="tel" required autocomplete="tel"></label></div>
      <label>Email<input name="email" type="email" autocomplete="email"></label>
      <label>Role you are interested in<select name="service">{opts}</select></label>
      <label>Tell us about yourself<textarea name="message" placeholder="Experience, availability, anything we should know"></textarea></label>
      <button class="btn btn-primary" type="submit" data-label="Send my application">Send my application</button>'''
        subject = 'Careers application'
    else:
        names = [s['name'] for s in SERVICES] + ['More than one', 'Not sure yet']
        opts = ''.join(f'<option{" selected" if n == default_service else ""}>{n}</option>' for n in names)
        body = f'''
      <div class="row2"><label>Name<input name="name" required autocomplete="name"></label><label>Phone<input name="phone" type="tel" required autocomplete="tel"></label></div>
      <div class="row2"><label>Email<input name="email" type="email" autocomplete="email"></label><label>Town<input name="town" placeholder="e.g. Dubuque, Galena, Peosta" autocomplete="address-level2"></label></div>
      <label>Interested in<select name="service">{opts}</select></label>
      <label>Anything we should know?<textarea name="message"></textarea></label>
      <button class="btn btn-primary" type="submit" data-label="Request my estimate">Request my estimate</button>'''
        subject = 'Estimate request'
    ok = 'Thank you. We received your message and will follow up personally.' if not careers else 'Thank you. We received your application and will be in touch.'
    return f'''<form class="q" id="quote" name="{form_name}" method="POST" data-netlify="true" netlify-honeypot="bot-field" data-lead data-subject="{subject}">
      <input type="hidden" name="form-name" value="{form_name}">
      <p class="hp"><label>Leave this empty<input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="ok" role="status">{ok}</div>
      <div class="fields" style="display:grid;gap:14px">{body}
      <p class="fine">We only use your details to respond to this request.</p></div>
    </form>'''

def contact_section(default_service='Permanent Lights', heading='Let’s take a look at your home.'):
    return f'''<section class="sec contact" id="contact">
  <div class="wrap cgrid">
    <div>
      <div class="eyebrow rv">Private estimate</div>
      <h2 class="rv d1">{heading}</h2>
      <p class="lead rv d2">Tell us a little about the property and what you have in mind. We will follow up personally to schedule a visit. Serving Dubuque and communities within about 30 miles.</p>
      <a class="big-phone rv d2" href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a>
      <p class="fine rv d3" style="margin-top:.6rem">Now booking the 2027 season.</p>
    </div>
    <div class="rv d1">{lead_form(default_service)}</div>
  </div>
</section>
'''

def faq_html(faqs):
    return '<div class="faq rv">' + ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faqs) + '</div>'

def faq_ld(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}

def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def all_cities():
    out = []
    for st, towns in TOWNS.items():
        for t in towns:
            out.append({"@type": "City", "name": f"{t}, {STATE_ABBR[st]}", "containedInPlace": {"@type": "AdministrativeArea", "name": st}})
    return out

def business_ld(full=False):
    d = {"@context": "https://schema.org", "@type": "HomeAndConstructionBusiness", "@id": BASE + "/#business",
         "name": "GBG Dubuque", "url": BASE + "/", "telephone": PHONE_TEL, "email": EMAIL,
         "image": BASE + "/assets/og.png", "logo": BASE + "/assets/favicon.svg",
         "description": "Permanent lighting and driveway sealing for Dubuque, Iowa and communities within about 30 miles. Also yard spraying, trash can cleaning and epoxy coating, with trusted partners for painting, landscaping and tree service.",
         "address": {"@type": "PostalAddress", "addressLocality": "Dubuque", "addressRegion": "IA", "addressCountry": "US"},
         "geo": {"@type": "GeoCoordinates", "latitude": GEO[0], "longitude": GEO[1]},
         "areaServed": [{"@type": "GeoCircle", "geoMidpoint": {"@type": "GeoCoordinates", "latitude": GEO[0], "longitude": GEO[1]}, "geoRadius": RADIUS_M}] + all_cities(),
         "knowsAbout": ["Permanent lighting", "Driveway sealing", "Yard spraying", "Epoxy coating"]}
    if full:
        d["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": "GBG Dubuque services",
            "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s['name'], "url": url(s['slug'] + '/')}} for s in SERVICES]}
    return d

def service_ld(s):
    return {"@context": "https://schema.org", "@type": "Service", "@id": url(s['slug'] + '/') + '#service',
            "name": s['name'] + ' in Dubuque, Iowa', "serviceType": s['name'], "description": s['desc'],
            "url": url(s['slug'] + '/'), "provider": {"@id": BASE + "/#business"},
            "areaServed": [{"@type": "GeoCircle", "geoMidpoint": {"@type": "GeoCoordinates", "latitude": GEO[0], "longitude": GEO[1]}, "geoRadius": RADIUS_M}] + all_cities()}

# --------------------------------------------------------------------------
# Animated art (all SVG, no photos)
# --------------------------------------------------------------------------
def grass_blades(seed, x0, x1, y0, y1, n, color, hmin=8, hmax=22):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x = rnd.uniform(x0, x1); y = rnd.uniform(y0, y1); h = rnd.uniform(hmin, hmax); dx = rnd.uniform(-5, 5)
        out.append(f'<path d="M{x:.0f} {y:.0f} q{dx/2:.0f} {-h/2:.0f} {dx:.0f} {-h:.0f}"/>')
    return f'<g stroke="{color}" stroke-width="1.6" fill="none" stroke-linecap="round">' + ''.join(out) + '</g>'

def art_wrap(inner, label, cap=''):
    c = f'<div class="cap">{cap}</div>' if cap else ''
    return f'<div class="art">{c}<svg viewBox="0 0 800 450" role="img" aria-label="{esc(label)}" preserveAspectRatio="xMidYMid slice">{inner}</svg></div>'

def art_yard():
    dur = '8s'
    inner = f'''<rect width="800" height="450" fill="#0d1016"/>
<rect y="240" width="800" height="210" fill="#3d3b1f"/>
{grass_blades(1,0,800,250,440,140,'#7a7440')}
<defs><clipPath id="clY"><rect x="0" y="230" width="0" height="230"><animate attributeName="width" values="0;800;800;0" keyTimes="0;.62;.92;1" dur="{dur}" repeatCount="indefinite"/></rect></clipPath></defs>
<g clip-path="url(#clY)"><rect y="240" width="800" height="210" fill="#1c5a2a"/>{grass_blades(2,0,800,250,440,240,'#42b455')}</g>
<g><animateTransform attributeName="transform" type="translate" values="0 0;800 0;800 0;0 0" keyTimes="0;.62;.92;1" dur="{dur}" repeatCount="indefinite"/>
<rect x="-30" y="200" width="60" height="16" rx="4" fill="#e36b1e"/><rect x="-4" y="216" width="8" height="22" fill="#e36b1e"/>
{''.join(f'<circle cx="{dx}" cy="238" r="3" fill="#9fd8ff"><animate attributeName="cy" values="230;300" dur="0.9s" begin="{i*0.13:.2f}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" begin="{i*0.13:.2f}s" repeatCount="indefinite"/></circle>' for i, dx in enumerate([-24, -14, -6, 0, 6, 14, 24]))}
</g>'''
    return art_wrap(inner, 'Animation of a lawn turning lush green as a sprayer passes', 'Recurring treatment')

def art_trash():
    dur = '7s'
    bin_path = '<path d="M330 150 h140 l-10 210 a12 12 0 0 1 -12 11 h-96 a12 12 0 0 1 -12 -11 z"/><rect x="316" y="128" width="168" height="24" rx="8"/><rect x="376" y="112" width="48" height="18" rx="6"/>'
    inner = f'''<rect width="800" height="450" fill="#0d1016"/><rect y="372" width="800" height="78" fill="#15161b"/>
<defs><clipPath id="clT"><rect x="250" y="100" width="300" height="0"><animate attributeName="height" values="0;280;280;0" keyTimes="0;.6;.9;1" dur="{dur}" repeatCount="indefinite"/></rect></clipPath></defs>
<g fill="#4a4034" stroke="#2a241c" stroke-width="2">{bin_path}</g>
<g stroke="#2a2118" stroke-width="5" opacity=".7" stroke-linecap="round"><path d="M360 190 l4 60"/><path d="M400 180 l-3 90"/><path d="M440 200 l5 50"/><path d="M380 290 l3 40"/></g>
<g clip-path="url(#clT)"><g fill="#2e3440" stroke="#5b6478" stroke-width="2">{bin_path}</g><path d="M340 165 h20" stroke="#8fa0c0" stroke-width="3" stroke-linecap="round" opacity=".6"/></g>
<g stroke="#9fd8ff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8">
{''.join(f'<path d="M{150+i*30} {100+ (i%2)*20} q120 {-40+i*8} {230} {40+i*10}" stroke-dasharray="6 10"><animate attributeName="stroke-dashoffset" values="0;-64" dur="0.8s" repeatCount="indefinite"/></path>' for i in range(4))}
</g>
<g fill="#fff">{''.join(f'<path d="M{x} {y} l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3z"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.6;.7;.85;1" dur="{dur}" begin="{i*0.15:.2f}s" repeatCount="indefinite"/></path>' for i, (x, y) in enumerate([(300, 180), (500, 250), (470, 160), (340, 330)]))}</g>'''
    return art_wrap(inner, 'Animation of a trash can being washed clean', 'Recurring cleaning')

def art_epoxy():
    dur = '8s'
    rnd = random.Random(5)
    flakes = ''.join(f'<circle cx="{rnd.uniform(120,680):.0f}" cy="{rnd.uniform(310,430):.0f}" r="{rnd.uniform(1.2,2.6):.1f}" fill="{rnd.choice(["#e36b1e","#f2efe9","#3a3a40","#8a8a92"])}"/>' for _ in range(160))
    floor = 'M0 450 L120 300 L680 300 L800 450 Z'
    inner = f'''<rect width="800" height="450" fill="#0d1016"/>
<rect x="120" y="60" width="560" height="240" fill="#15161b"/>
<g stroke="#23242b" stroke-width="2" fill="none"><rect x="150" y="90" width="500" height="180"/>{''.join(f'<line x1="{x}" y1="90" x2="{x}" y2="270"/>' for x in range(250,650,100))}</g>
<path d="{floor}" fill="#5c5c62"/>
<g stroke="#2b2b30" stroke-width="2" fill="none"><path d="M260 340 l30 25 l-14 30 l40 40"/><path d="M560 330 l-30 30 l10 34"/></g>
<defs><clipPath id="clE"><rect x="0" y="290" width="0" height="170"><animate attributeName="width" values="0;800;800;0" keyTimes="0;.6;.92;1" dur="{dur}" repeatCount="indefinite"/></rect></clipPath>
<linearGradient id="glE" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26262c"/><stop offset=".5" stop-color="#3a3a42"/><stop offset="1" stop-color="#1c1c22"/></linearGradient></defs>
<g clip-path="url(#clE)"><path d="{floor}" fill="url(#glE)"/>{flakes}
<rect x="-200" y="300" width="70" height="150" fill="#fff" opacity=".13" transform="skewX(-30)"><animate attributeName="x" values="-200;900;-200" dur="4s" repeatCount="indefinite"/></rect></g>'''
    return art_wrap(inner, 'Animation of a garage floor receiving a glossy epoxy coating', 'Polished finish')

def art_paint():
    dur = '8s'
    wall = 'x="140" y="70" width="520" height="290"'
    detail = '<g stroke="#00000055" stroke-width="3" fill="none"><rect x="200" y="130" width="90" height="110"/><rect x="510" y="130" width="90" height="110"/><path d="M360 360 V220 h80 V360"/></g>'
    inner = f'''<rect width="800" height="450" fill="#0d1016"/><rect y="360" width="800" height="90" fill="#15161b"/>
<rect {wall} fill="#6f6252"/><g stroke="#8a7c68" stroke-width="2" opacity=".6"><path d="M170 100 l30 12"/><path d="M460 90 l40 18"/><path d="M330 300 l34 -10"/><path d="M590 300 l30 14"/></g>{detail}
<defs><clipPath id="clP"><rect x="130" y="60" width="0" height="310"><animate attributeName="width" values="0;540;540;0" keyTimes="0;.6;.92;1" dur="{dur}" repeatCount="indefinite"/></rect></clipPath></defs>
<g clip-path="url(#clP)"><rect {wall} fill="#26262d"/>{detail}<rect x="140" y="70" width="520" height="10" fill="#e36b1e" opacity=".85"/></g>
<g><animateTransform attributeName="transform" type="translate" values="130 0;670 0;670 0;130 0" keyTimes="0;.6;.92;1" dur="{dur}" repeatCount="indefinite"/>
<g><animateTransform attributeName="transform" additive="sum" type="translate" values="0 90;0 320;0 90" dur="1.6s" repeatCount="indefinite"/>
<rect x="-10" y="-14" width="52" height="28" rx="8" fill="#e36b1e"/><path d="M42 0 h16 v30" stroke="#b8b8c0" stroke-width="4" fill="none"/><rect x="52" y="30" width="12" height="40" rx="4" fill="#8a8a92"/></g></g>'''
    return art_wrap(inner, 'Animation of a wall being repainted', 'Trusted partner')

def art_land():
    rnd = random.Random(8)
    bushes = ''
    for i, (x, r) in enumerate([(130, 46), (250, 34), (560, 40), (690, 52), (430, 28)]):
        bushes += f'<g class="grow" style="--dl:{i*.5}s"><circle cx="{x}" cy="{370-r*.6:.0f}" r="{r}" fill="#1f5a2b"/><circle cx="{x-r*.5:.0f}" cy="{370-r*.3:.0f}" r="{r*.7:.0f}" fill="#2a7a3a"/><circle cx="{x+r*.5:.0f}" cy="{370-r*.3:.0f}" r="{r*.65:.0f}" fill="#34903f"/></g>'
    flowers = ''.join(f'<g class="grow" style="--dl:{1+i*.25}s"><circle cx="{x}" cy="352" r="6" fill="{c}"/><path d="M{x} 358 v14" stroke="#2a7a3a" stroke-width="2"/></g>' for i, (x, c) in enumerate([(190, '#ff8a3d'), (330, '#f2efe9'), (370, '#ffd9a0'), (500, '#ff8a3d'), (620, '#f2efe9')]))
    stones = ''.join(f'<ellipse class="grow" style="--dl:{.2+i*.2}s" cx="{400+ (i%2)*14}" cy="{445-i*13}" rx="{46-i*4}" ry="{9-i*.6:.1f}" fill="#3c3c44"/>' for i in range(5))
    inner = f'''<rect width="800" height="450" fill="#0d1016"/><rect y="372" width="800" height="78" fill="#13210f"/>
<g class="grow" style="--dl:.3s"><rect x="596" y="200" width="14" height="170" fill="#4a3a2a"/><circle cx="603" cy="180" r="62" fill="#1f5a2b"/><circle cx="570" cy="205" r="42" fill="#2a7a3a"/><circle cx="638" cy="200" r="46" fill="#34903f"/></g>
{bushes}{flowers}{stones}'''
    return art_wrap(inner, 'Animation of a garden growing in', 'Trusted partner')

def art_tree():
    canopy_over = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in [(400,150,90),(330,190,70),(470,190,72),(290,140,55),(510,140,58),(400,90,60),(350,230,50),(450,232,52)])
    canopy_trim = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in [(400,160,70),(340,195,52),(460,195,54)])
    inner = f'''<rect width="800" height="450" fill="#0d1016"/><rect y="372" width="800" height="78" fill="#13210f"/>
<g class="treeswing"><rect x="386" y="230" width="28" height="145" fill="#4a3a2a"/>
<g fill="#1f5a2b" stroke="#164420" stroke-width="2"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.4;.55;.9;1" dur="8s" repeatCount="indefinite"/>{canopy_over}</g>
<g fill="#2a7a3a" stroke="#1f5a2b" stroke-width="2"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.4;.55;.9;1" dur="8s" repeatCount="indefinite"/>{canopy_trim}</g></g>
{''.join(f'<g fill="#3a2c1f"><rect x="-14" y="-3" width="28" height="6" rx="3"><animateTransform attributeName="transform" type="translate" values="{x} 210;{x+dx} 380" keyTimes="0;1" dur="1.4s" begin="{i*.9+3:.1f}s;{i*.9+11:.1f}s" repeatCount="1" fill="freeze"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" dur="1.4s" begin="{i*.9+3:.1f}s;{i*.9+11:.1f}s"/></rect></g>' for i, (x, dx) in enumerate([(300, -40), (500, 50), (400, -10)]))}'''
    return art_wrap(inner, 'Animation of an overgrown tree being trimmed', 'Trusted partner')

def art_lights_placeholder():
    return ''

# --------------------------------------------------------------------------
# Light studio + seal partials
# --------------------------------------------------------------------------
def studio_html(big=False):
    return f'''<div class="stage" id="stage">
        <div class="stars" data-stars="34"></div>
        <svg class="house" id="demoHouse" role="img" aria-label="Interactive preview of permanent lights with customizable colors and patterns" preserveAspectRatio="xMidYMax meet"></svg>
        <div class="now"><span>Now showing&nbsp;<b id="studioNow"></b></span></div>
      </div>
      <div class="studio">
        <div><span class="lbl">Themes</span><div class="chips" id="themes" role="group" aria-label="Light themes"></div></div>
        <div class="ctl-row">
          <div><label class="lbl" for="pattern">Pattern</label><select id="pattern"></select></div>
          <div><label class="lbl" for="speed">Cadence <span id="speedVal">1.0x</span></label><input type="range" id="speed" min="0.3" max="3" step="0.1" value="1"></div>
        </div>
        <div><span class="lbl">Colors</span><div class="swatches"><input type="color" id="c0" aria-label="Color 1" value="#ffd9a0"><input type="color" id="c1" aria-label="Color 2" value="#ffd9a0"><input type="color" id="c2" aria-label="Color 3" value="#ffd9a0"></div></div>
        <div class="chips">
          <button class="chip" id="showBtn" type="button" aria-pressed="false">Auto-cycle themes</button>
          <button class="chip" id="dayBtn" type="button" aria-pressed="false">View by day</button>
          <a class="btn btn-primary" id="bookLook" href="#contact" style="padding:.55rem 1.1rem;font-size:.82rem" data-service="Permanent Lights">Book this look</a>
        </div>
        <p class="hint">Illustration for preview. Your installation is designed around your actual home, and colors, patterns and schedules are controlled from your phone.</p>
      </div>'''

def seal_html():
    poly = '380,120 620,120 720,520 280,520'
    cracks = 'M410 150 l18 60 l-14 40 l32 70 l-8 60 l30 70 M560 140 l-16 70 l22 50 l-12 80 l30 60 M330 330 l60 -14 l40 18 M600 400 l-70 10'
    rnd = random.Random(12)
    weeds = ''.join(f'<path d="M{x} {y} q3 -10 0 -16 M{x} {y} q-5 -8 -8 -12 M{x} {y} q6 -8 9 -13"/>' for x, y in [(428, 210), (414, 250), (546, 210), (534, 260), (390, 316), (600, 396)])
    stains = '<ellipse cx="470" cy="350" rx="60" ry="30" fill="#2a2a2e" opacity=".55"/><ellipse cx="560" cy="250" rx="40" ry="18" fill="#2a2a2e" opacity=".4"/><ellipse cx="420" cy="180" rx="30" ry="14" fill="#333338" opacity=".4"/>'
    return f'''<div class="art seal" id="seal">
        <div class="cap" id="sealStage">Before</div>
        <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Animation of a driveway being cleaned, repaired and sealed">
          <defs>
            <clipPath id="cpDrive"><polygon points="{poly}"/></clipPath>
            <clipPath id="cpClean"><rect x="0" y="120" width="1000" height="0"/></clipPath>
            <clipPath id="cpRepair"><rect x="0" y="120" width="1000" height="0"/></clipPath>
            <clipPath id="cpSeal"><rect x="0" y="120" width="1000" height="0"/></clipPath>
            <linearGradient id="sheenS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
          </defs>
          <rect width="1000" height="560" fill="#0d1610"/>
          {grass_blades(3,0,1000,20,110,90,'#2c5a32',6,16)}
          <rect x="0" y="0" width="1000" height="120" fill="#16211a" opacity=".55"/>
          <g fill="#101014" stroke="#2b2b31" stroke-width="2"><rect x="290" y="0" width="420" height="120"/></g>
          <g stroke="#2b2b31" stroke-width="2" fill="none"><rect x="320" y="30" width="170" height="90"/><rect x="510" y="30" width="170" height="90"/>{''.join(f'<line x1="{x}" y1="30" x2="{x}" y2="120"/>' for x in (376, 433, 566, 623))}</g>
          <g clip-path="url(#cpDrive)">
            <rect x="0" y="120" width="1000" height="400" fill="#66666c"/>
            {stains}
            <g stroke="#1e1e21" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="{cracks}"/></g>
            <g stroke="#4f8a3a" stroke-width="2" fill="none" stroke-linecap="round">{weeds}</g>
            <g clip-path="url(#cpClean)"><rect x="0" y="120" width="1000" height="400" fill="#8b8b93"/><g stroke="#3a3a40" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="{cracks}"/></g></g>
            <g clip-path="url(#cpRepair)"><rect x="0" y="120" width="1000" height="400" fill="#7f7f87"/><g stroke="#9c9ca5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"><path d="{cracks}"/></g></g>
            <g clip-path="url(#cpSeal)"><rect x="0" y="120" width="1000" height="400" fill="#0b0b0d"/><rect x="0" y="120" width="1000" height="400" fill="url(#sheenS)"/></g>
            <g id="barClean" opacity="0"><rect x="0" y="0" width="1000" height="8" fill="#7fd0ff" opacity=".9"/><rect x="0" y="-6" width="1000" height="20" fill="#7fd0ff" opacity=".18"/></g>
            <g id="barRepair" opacity="0"><rect x="0" y="0" width="1000" height="8" fill="#ffd9a0" opacity=".9"/><rect x="0" y="-6" width="1000" height="20" fill="#ffd9a0" opacity=".18"/></g>
            <g id="barSeal" opacity="0"><rect x="0" y="0" width="1000" height="8" fill="#e36b1e"/><rect x="0" y="-8" width="1000" height="24" fill="#e36b1e" opacity=".25"/></g>
          </g>
          <polygon points="{poly}" fill="none" stroke="#2f2f36" stroke-width="2"/>
          <rect x="0" y="520" width="1000" height="40" fill="#16161a"/><rect x="0" y="518" width="1000" height="4" fill="#3a3a42"/>
          <g stroke="#3a3a42" stroke-width="3" stroke-dasharray="26 22">
            <line x1="0" y1="540" x2="1000" y2="540"/></g>
        </svg>
      </div>
      <div class="scrub">
        <input type="range" id="sealRange" min="0" max="100" value="0" aria-label="Scrub through the sealing process">
        <div class="stepchips"><button class="chip" type="button" aria-pressed="false">1 &middot; Clean</button><button class="chip" type="button" aria-pressed="false">2 &middot; Repair</button><button class="chip" type="button" aria-pressed="false">3 &middot; Seal</button></div>
        <p class="hint">Illustration for preview. Drag to scrub through the process.</p>
      </div>'''

# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------
def write(path, content):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

def more_services_grid(r, exclude=()):
    out = '<div class="grid6">'
    n = 0
    for s in SERVICES:
        if s['slug'] in exclude: continue
        tag = '<span class="pill in">In-house</span>' if s['inhouse'] else '<span class="pill pt">Trusted partner</span>'
        out += f'<a class="mini rv d{n%3}" href="{r}{s["slug"]}/">{tag}<h3>{esc(s["name"])}</h3><p>{esc(s["short"])}</p><span class="go">Learn more &rarr;</span></a>'
        n += 1
    return out + '</div>'

def town_chips():
    return '<div class="towns">' + ''.join(f'<span>{t}, {STATE_ABBR[st]}</span>' for st, ts in TOWNS.items() for t in ts) + '</div>'

def build_home():
    r = ''
    page = dict(title='Permanent Lights & Driveway Sealing in Dubuque, IA | GBG',
        desc='Permanent roofline lighting and driveway sealing in Dubuque, Iowa and within 30 miles. Locally owned, custom colors and patterns. Get a private estimate.',
        path='', schema=[business_ld(True),
            {"@context": "https://schema.org", "@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": "GBG Dubuque", "publisher": {"@id": BASE + "/#business"}},
            faq_ld(HOME_FAQ)])
    h = head(page, r) + svg_defs() + nav(r)
    h += f'''<main id="main">
<header class="hero" id="top">
  <div class="stars" data-stars="70"></div>
  <div class="hero-copy wrap">
    <div class="eyebrow rv">Dubuque, Iowa &middot; Permanent Lighting &middot; Driveway Sealing</div>
    <h1 class="rv d1">Your home,<br><em>lit like it deserves.</em></h1>
    <p class="sub rv d2">Permanent lighting and flawless driveway sealing for Dubuque and communities within 30 miles. Done once. Done right.</p>
    <div class="cta rv d3"><a href="#contact" class="btn btn-primary">Request a private estimate</a><a href="#lights" class="btn btn-ghost">Design your lights</a></div>
  </div>
  <div class="hero-house"><svg class="house" id="heroHouse" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Illustration of an estate with permanent lights cycling through colors and patterns"></svg></div>
  <div class="now"><span>Now showing&nbsp;<b id="heroNow"></b></span><a href="#lights">Customize it &rarr;</a></div>
</header>

<section class="sec" id="services">
  <div class="wrap">
    <div class="eyebrow rv">What we do best</div>
    <h2 class="rv d1">Two things. Perfected.</h2>
    <p class="lead rv d2">We handle most exterior work directly, but these are the two we would put our name on first.</p>
    <div class="two">
      <a href="permanent-lights/" class="card c1 rv"><div class="dots" aria-hidden="true"></div><span class="num">01</span><h3>Permanent Lights</h3><p>Custom-fit architectural lighting that traces your roofline. Installed once, on every night of the year.</p><span class="more">Explore &rarr;</span></a>
      <a href="driveway-sealing/" class="card c2 rv d1"><div class="seal-line" aria-hidden="true"><i></i></div><span class="num">02</span><h3>Driveway Sealing</h3><p>Cleaned, repaired and sealed to a deep, even finish that protects your driveway and frames your home.</p><span class="more">Explore &rarr;</span></a>
    </div>
  </div>
</section>

<section class="sec alt" id="lights">
  <div class="wrap split">
    <div>
      <div class="eyebrow rv">01 &middot; Permanent Lights</div>
      <h2 class="rv d1">Any color. Any pattern. Any night.</h2>
      <p class="lead rv d2">A clean line of light along your eaves and gables that disappears by day. Then it goes to work: warm white on a quiet Tuesday, holiday colors in December, your team’s colors on game day.</p>
      <ul class="ticks rv d2">
        <li>Custom-fit to your home’s exact roofline</li>
        <li>Themes, patterns, speed and colors, controlled from your phone</li>
        <li>Blends into the trim during the day</li>
        <li>One install replaces every seasonal light job</li>
      </ul>
      <p class="rv d3"><a href="permanent-lights/" class="btn btn-ghost">Permanent lighting details</a></p>
    </div>
    <div class="rv d1">{studio_html()}</div>
  </div>
</section>

<section class="sec" id="driveway">
  <div class="wrap split flip">
    <div class="rv d1">{seal_html()}</div>
    <div>
      <div class="eyebrow rv">02 &middot; Driveway Sealing</div>
      <h2 class="rv d1">The finish that frames the house.</h2>
      <p class="lead rv d2">A driveway is the first thing people see. We restore it to a deep, uniform finish that protects the surface through Iowa winters and sharpens the whole property.</p>
      <div class="steps rv d2">
        <div class="step"><b>Clean</b><span>Deep clean to remove dirt, oil and growth.</span></div>
        <div class="step"><b>Repair</b><span>Cracks filled before anything is sealed.</span></div>
        <div class="step"><b>Seal</b><span>Even coat, clean edges, no missed corners.</span></div>
      </div>
      <div class="cta-row rv d3"><a href="driveway-sealing/" class="btn btn-ghost">Driveway sealing details</a><a href="#contact" class="btn btn-primary" data-service="Driveway Sealing">Get a sealing estimate</a></div>
    </div>
  </div>
</section>

<section class="sec alt" id="more">
  <div class="wrap">
    <div class="eyebrow rv">One call covers it all</div>
    <h2 class="rv d1">Everything exterior, handled.</h2>
    <p class="lead rv d2">We handle most work directly. For specialized jobs, we coordinate with trusted local partners so you only ever deal with one team.</p>
    {more_services_grid(r, ('permanent-lights','driveway-sealing'))}
  </div>
</section>

<section class="sec" id="areas">
  <div class="wrap">
    <div class="eyebrow rv">Service area</div>
    <h2 class="rv d1">Dubuque and everywhere within 30 miles.</h2>
    <p class="lead rv d2">We serve the whole tri-state neighborhood: eastern Iowa, northwest Illinois and southwest Wisconsin.</p>
    <div class="rv d2">{town_chips()}</div>
    <p style="margin-top:1.6rem" class="rv d3"><a class="btn btn-ghost" href="service-areas/">See all service areas</a></p>
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    <div class="eyebrow rv">The GBG standard</div>
    <h2 class="rv d1">Locally owned. Built in North Dubuque.</h2>
    <div class="trio">
      <div class="rv"><div class="k">I</div><h3>One point of contact</h3><p>You talk to the people who own the company, not a call center. Coordinating the whole job is our job.</p></div>
      <div class="rv d1"><div class="k">II</div><h3>Quality first</h3><p>We would rather do fewer jobs beautifully than many jobs quickly. Your home is not a volume game.</p></div>
      <div class="rv d2"><div class="k">III</div><h3>Plain, honest quotes</h3><p>Clear scope, clear price, no pressure. If we are not the right fit, we will say so.</p></div>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap"><div style="text-align:center"><div class="eyebrow rv">Questions</div><h2 class="rv d1">Good to know.</h2></div>{faq_html(HOME_FAQ)}</div>
</section>

{contact_section()}
</main>
''' + sticky(r) + footer(r)
    write('index.html', h)

def build_service(s):
    r = '../'
    others = [x for x in SERVICES if x['slug'] != s['slug']]
    page = dict(title=s['title'], desc=s['desc'], path=s['slug'] + '/',
        schema=[business_ld(False), service_ld(s), faq_ld(s['faqs']),
                crumbs_ld([('Home', url()), (s['name'], url(s['slug'] + '/'))])])
    if s['art'] == 'lights':
        art = f'<div class="rv d1">{studio_html()}</div>'
        art_block = art
    elif s['art'] == 'seal':
        art_block = f'<div class="rv d1">{seal_html()}</div>'
    else:
        art_block = '<div class="rv d1">' + globals()['art_' + s['art']]() + '</div>'
    tag = 'In-house service' if s['inhouse'] else 'Trusted partner service'
    bullets = ''.join(f'<li>{esc(b)}</li>' for b in s['bullets'])
    steps = ''.join(f'<div class="step"><b>{esc(a)}</b><span>{esc(b)}</span></div>' for a, b in s['steps'])
    related = ''.join(f'<a class="mini" href="../{o["slug"]}/"><span class="pill {"in" if o["inhouse"] else "pt"}">{"In-house" if o["inhouse"] else "Trusted partner"}</span><h3>{esc(o["name"])}</h3><p>{esc(o["short"])}</p><span class="go">Learn more &rarr;</span></a>' for o in others[:3])
    area_line = ', '.join(f'{t}' for t in ['Dubuque', 'Asbury', 'Peosta', 'Epworth', 'East Dubuque', 'Galena', 'Dyersville', 'Cuba City', 'Platteville'])
    h = head(page, r) + svg_defs() + nav(r)
    h += f'''<main id="main">
<header class="phero">
  <div class="wrap grid">
    <div>
      <div class="crumbs rv"><a href="../">Home</a><span>/</span>{esc(s['name'])}</div>
      <div class="eyebrow rv">{tag} &middot; Dubuque, Iowa</div>
      <h1 class="rv d1">{esc(s['h1a'])}<br><em>{esc(s['h1b'])}</em></h1>
      <p class="lead rv d2">{esc(s['lead'])}</p>
      <div class="cta rv d3"><a class="btn btn-primary" href="#contact" data-service="{esc(s['name'])}">Get a free estimate</a><a class="btn btn-ghost" href="tel:{PHONE_TEL}">Call {PHONE_DISPLAY}</a></div>
    </div>
    {art_block}
  </div>
</header>

<section class="sec alt">
  <div class="wrap split">
    <div>
      <div class="eyebrow rv">What you get</div>
      <h2 class="rv d1">{esc(s['name'])} in Dubuque, done properly.</h2>
      <ul class="ticks rv d2">{bullets}</ul>
    </div>
    <div>
      <div class="eyebrow rv">How it works</div>
      <div class="steps rv d1" style="margin-top:1rem">{steps}</div>
      <p class="rv d2" style="margin-top:1.8rem;color:#b0aba2;max-width:34rem">We serve {area_line} and other communities within roughly 30 miles of Dubuque. <a href="../service-areas/" style="color:var(--accent-hi)">See all service areas</a>.</p>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap"><div style="text-align:center"><div class="eyebrow rv">Questions</div><h2 class="rv d1">{esc(s['name'])}, answered.</h2></div>{faq_html(s['faqs'])}</div>
</section>

<section class="sec alt">
  <div class="wrap">
    <div class="eyebrow rv">Also from GBG</div>
    <h2 class="rv d1">One team for the whole exterior.</h2>
    <div class="grid6" style="grid-template-columns:repeat(3,1fr)">{related}</div>
  </div>
</section>

{contact_section(s['name'])}
</main>
''' + sticky(r) + footer(r)
    write(s['slug'] + '/index.html', h)

def build_areas():
    r = '../'
    title = 'Service Areas: Dubuque, IA and Nearby Towns | GBG Dubuque'
    desc = 'GBG Dubuque serves Dubuque, Iowa and communities within about 30 miles across eastern Iowa, northwest Illinois and southwest Wisconsin. Find your town.'
    page = dict(title=title, desc=desc, path='service-areas/',
                schema=[business_ld(True), crumbs_ld([('Home', url()), ('Service areas', url('service-areas/'))])])
    blurbs = {
        'Iowa': 'Home base. We are in North Dubuque and reach the whole Dubuque County area, plus nearby Delaware and Jackson County communities.',
        'Illinois': 'Just across the river. East Dubuque, Galena and the Jo Daviess County communities are a short drive for our crews.',
        'Wisconsin': 'Southwest Wisconsin is well within reach, from Hazel Green and Cuba City down toward Platteville.',
    }
    cards = ''
    for st, ts in TOWNS.items():
        chips = ''.join(f'<span>{t}, {STATE_ABBR[st]}</span>' for t in ts)
        cards += f'<div class="mini rv"><h3>{st}</h3><p>{blurbs[st]}</p><div class="towns">{chips}</div></div>'
    svcs = ''.join(f'<li><a href="../{s["slug"]}/" style="color:var(--accent-hi)">{esc(s["name"])} in Dubuque</a></li>' for s in SERVICES)
    h = head(page, r) + svg_defs() + nav(r)
    h += f'''<main id="main">
<header class="phero"><div class="wrap">
  <div class="crumbs rv"><a href="../">Home</a><span>/</span>Service areas</div>
  <div class="eyebrow rv">Within about 30 miles of Dubuque</div>
  <h1 class="rv d1">Service areas,<br><em>across the tri-state.</em></h1>
  <p class="lead rv d2">GBG Dubuque serves Dubuque, Iowa and the surrounding communities in eastern Iowa, northwest Illinois and southwest Wisconsin. Do not see your town? Call us. If we can reach you, we will.</p>
  <div class="cta rv d3"><a class="btn btn-primary" href="#contact">Request an estimate</a><a class="btn btn-ghost" href="tel:{PHONE_TEL}">Call {PHONE_DISPLAY}</a></div>
</div></header>
<section class="sec alt"><div class="wrap"><div class="areas-grid">{cards}</div></div></section>
<section class="sec"><div class="wrap split">
  <div><div class="eyebrow rv">What we do in every one of these towns</div><h2 class="rv d1">The same standard, wherever you live.</h2>
  <p class="lead rv d2">Permanent lighting and driveway sealing are our specialties, with recurring yard care and trusted partners for the rest of the exterior.</p></div>
  <ul class="ticks rv d1">{svcs}</ul>
</div></section>
{contact_section('Not sure yet', 'Tell us where you are.')}
</main>
''' + sticky(r) + footer(r)
    write('service-areas/index.html', h)

def build_careers():
    r = '../'
    title = 'Careers at GBG Dubuque | Join the Crew'
    desc = 'Join the GBG Dubuque crew. We are building our 2027 team in Dubuque, Iowa for permanent lighting, driveway sealing and exterior services.'
    page = dict(title=title, desc=desc, path='careers/',
                schema=[business_ld(False), crumbs_ld([('Home', url()), ('Careers', url('careers/'))])])
    h = head(page, r) + svg_defs() + nav(r)
    h += f'''<main id="main">
<header class="phero"><div class="wrap">
  <div class="crumbs rv"><a href="../">Home</a><span>/</span>Careers</div>
  <div class="eyebrow rv">Now building the 2027 crew</div>
  <h1 class="rv d1">Careers,<br><em>build something local.</em></h1>
  <p class="lead rv d2">GBG is a locally owned company built in North Dubuque by three partners who care about doing the work right. As we grow into the 2027 season, we want people who take pride in the finish.</p>
</div></header>
<section class="sec alt"><div class="wrap">
  <div class="eyebrow rv">Why GBG</div><h2 class="rv d1">Work you can point at.</h2>
  <div class="trio">
    <div class="rv"><div class="k">I</div><h3>Craft over volume</h3><p>Permanent lighting and driveway sealing reward care. We build our reputation one clean finish at a time.</p></div>
    <div class="rv d1"><div class="k">II</div><h3>Owners on the job</h3><p>You will work alongside the people who own the company, not a distant management layer.</p></div>
    <div class="rv d2"><div class="k">III</div><h3>Room to grow</h3><p>We are early. People who show up and do great work grow with the company as it expands.</p></div>
  </div>
</div></section>
<section class="sec contact" id="contact"><div class="wrap cgrid">
  <div><div class="eyebrow rv">Apply</div><h2 class="rv d1">Tell us about yourself.</h2>
  <p class="lead rv d2">We are collecting interest for lighting installation, sealing and exterior crew roles, crew leads and estimating. Send a note and we will be in touch as positions open.</p>
  <a class="big-phone rv d2" href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a></div>
  <div class="rv d1">{lead_form(form_name='careers', careers=True)}</div>
</div></section>
</main>
''' + sticky(r) + footer(r)
    write('careers/index.html', h)

def build_files():
    write('assets/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><rect width="90" height="90" rx="16" fill="#1a1a1a"/><g fill="#e36b1e"><rect x="8" y="58" width="22" height="22" rx="2"/><rect x="34" y="58" width="22" height="22" rx="2"/><rect x="60" y="58" width="22" height="22" rx="2"/><rect x="21" y="33" width="22" height="22" rx="2"/><rect x="47" y="33" width="22" height="22" rx="2"/><rect x="34" y="8" width="22" height="22" rx="2"/></g></svg>')
    pages = [('', '1.0')] + [(s['slug'] + '/', '0.9' if i < 2 else '0.7') for i, s in enumerate(SERVICES)] + [('service-areas/', '0.8'), ('careers/', '0.4')]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for p, pr in pages:
        sm += f'  <url><loc>{url(p.rstrip("/")) if p else BASE + "/"}{"/" if p else ""}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>\n'
    sm += '</urlset>\n'
    write('sitemap.xml', sm)
    if PROD:
        write('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n')
    else:
        write('robots.txt', '# STAGING build. The parent domain is noindexed; production build flips this.\nUser-agent: *\nDisallow: /\n')

if __name__ == '__main__':
    build_home()
    for s in SERVICES: build_service(s)
    build_areas()
    build_careers()
    build_files()
    print('built', 'PRODUCTION' if PROD else 'STAGING', '->', OUT)
