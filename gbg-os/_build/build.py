"""Generates the static GBG OS pages into urban-backstage-site/gbg-os/.
Run from anywhere: python3 gbg-os/_build/build.py
Edit content here (checklists, statuses), rebuild. Bump V when os.css or os.js change."""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = "7"  # cache bust, bump on every os.css / os.js change

def doc(i): return f"https://docs.google.com/document/d/{i}/edit"
def fil(i): return f"https://drive.google.com/file/d/{i}/view"
def fold(i): return f"https://drive.google.com/drive/folders/{i}"

D = {
    "hq": doc("1R3jvBTTK_eSQb4Yh4PCa3Rk0WFmJwf47LIj6737Vgvk"),
    "master": doc("1DBxpQBBO2YPC6TRFUw1cA65w7lcXLR-v4IzegVY7czw"),
    "compliance": doc("1Ok2Yg58FF2Av5oauv1NVbPp4r0_rLsPNzCu_P66bmO8"),
    "lawyer": doc("1626JkBxmVX12S8yHJ1FDgh5pGEncH0EcVv_2feElaFo"),
    "referral": doc("1Nm00JwE68B90orUFb9s6m5_HrF5pphLtihYgvl4LGso"),
    "marketing": doc("18YNve8aJuepSWELM48xfWh10UK7gyxqPVcvV6Tshl_M"),
    "reviews": doc("1LAMUFncdR_HDENggDnf2LVZ8WxT5MwkXBnAAKjdPshM"),
    "seasonal": doc("1RlPadkrls6FRAmizvS2qORAiwoL8DRbqyvr8UOSCxys"),
    "sop_consult": doc("1hxQiF6rp6lknxR79YN-bxx3s7Gr2TbjPcLsoZWf8gJ4"),
    "sop_golive": doc("14VIqXQ2s7nDuETeQpwKX-zebRs_RmOTzm5llzD7Qa7Q"),
    "sop_rhythm": doc("1thxuI5QLqAqEl4CqPvSe0JG3XiBBz3cCO9VEywzFup4"),
    "sop_closeout": doc("1vIzIiepDbF5PbWcYNzFID6Dp1qWy8D8tUyOUws4SH-I"),
    "sop_lights": doc("1Mq-rDxcaVQM7ErgTVCgsF0ygP7RAqS5n1oTPOVIhfJM"),
    "sop_sealing": doc("1ZtezaTnhXIQOVvaa8p-IHhzMntuItnR7jCubCgQiMZw"),
    "sop_lead": doc("1aWetnYIBO0KXN35dfZ2sxcdKMR9cDRefdKUibud7d8Q"),
    "gates": fil("1-GTb2qLHLQoctqYSbpP0MhPydi4JMokJ"),
    "budget": fil("1hPuLME8viqRqAFHdus43JK8ela6E8Wwm"),
    "street": fil("1gZhCFdpUdJKFAi0M0quYSd4oQQfD-Wy9"),
    "estimate": fil("1_3Fj6_2op4ljVeR5pR0UffeQLiKSXmov"),
    "root": fold("1y9UZ9i5jFefvGgmUrxSM18JmbZDUGQA6"),
    "f_sops": fold("1-nIuc8HSuSVUzwBYC1ZVy4_SEG0dKKaH"),
    "f_trackers": fold("1Ew6L8LZXqgqXKUmwnSSPB5qBYBbdglKV"),
    "f_fin": fold("11T0IR0pol5-e6F6641MLAiFlYkp-ybT0"),
    "f_unc_client": fold("1kusjwOwA_clhr_kqbOYU8ETj6RZZQH_7"),
}
EXT = 'target="_blank" rel="noopener"'

def chip(label, href, cls=""):
    c = f' class="{cls}"' if cls else ""
    ext = f" {EXT}" if href.startswith("http") else ""
    return f'<a{c} href="{href}"{ext}>{label}</a>'

def page(slug, pid, title, eyebrow, h1, lede, body):
    depth = "../" if slug else ""
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>{title} | GBG OS</title>
<link rel="icon" href="/gbg-os/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/gbg-os/assets/os.css?v={V}">
<script src="/gbg-os/assets/os.js?v={V}"></script>
<script src="/gbg-os/assets/api.js?v={V}"></script>
</head>
<body data-venture="gbg" data-page="{pid}">
<nav class="os-nav" id="os-nav"></nav>
<div class="wrap">
  <section class="hero">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <p>{lede}</p>
  </section>
{body}
  <footer>GBG DUBUQUE | Internal ops, not indexed. Amounts, ownership and anything personal live in Drive, never on these pages.</footer>
</div>
</body>
</html>
"""
    out = ROOT / slug / "index.html" if slug else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

def sh(t): return f'  <div class="sh"><h2>{t}</h2><div class="rule"></div></div>\n'

# ---------- HUB ----------
hub = sh("Pulse") + f"""  <div class="stats">
    <div class="stat"><div class="k">Days to launch</div><div class="v or" data-countdown>&nbsp;</div><div class="s">Target April 1, 2027</div></div>
    <div class="stat"><div class="k">Your open tasks</div><div class="v" data-k="mine">&middot;</div><div class="s"><span data-k="open">&middot;</span> open for the team</div></div>
    <div class="stat"><div class="k">Overdue</div><div class="v" data-k="overdue">&middot;</div><div class="s"><span data-k="week">&middot;</span> due in the next 7 days</div></div>
    <div class="stat"><div class="k">Jobs in pipeline</div><div class="v" data-k="jobs">&middot;</div><div class="s"><span data-k="booked">&middot;</span> booked</div></div>
  </div>
  <div class="grid" style="margin-top:14px" data-live="hub">
    <div class="card"><div class="card-top"><h3>Due now</h3><a class="tag or" href="/gbg-os/tasks/">All tasks</a></div><div data-live="tasks" data-owner="mine" data-short="1"></div></div>
    <div class="card"><div class="card-top"><h3>Key dates</h3></div><ul class="mini" data-live="keydates"></ul>
      <h3 style="margin-top:18px">Recent activity</h3><ul class="mini" data-live="recent"></ul>
      <p class="whoami">Click any task to edit it. <span data-live="hello"></span> &middot; <button class="linkbtn" data-signout>Sign out</button></p></div>
  </div>
""" + sh("Sections") + f"""  <div class="grid">
    <a class="card" href="/gbg-os/tasks/"><div class="card-top"><h3>Tasks</h3><span class="tag or">Live</span></div><p>Every launch to do with an owner and a date. Check them off as you go.</p></a>
    <a class="card" href="/gbg-os/launch/"><div class="card-top"><h3>Launch</h3></div><p>Roadmap to April 1, next actions, open decisions, and everything to verify before the first job.</p></a>
    <a class="card" href="/gbg-os/services/"><div class="card-top"><h3>Services</h3></div><p>What we do in house, what goes to partners, and the gate each service has to clear before it books.</p></a>
    <a class="card" href="/gbg-os/jobs/"><div class="card-top"><h3>Jobs</h3><span class="tag or">Live</span></div><p>Lead to review pipeline. Add leads, move jobs, site form leads land here.</p></a>
    <a class="card" href="/gbg-os/playbook/"><div class="card-top"><h3>Playbook</h3></div><p>Operating rules, brand, and every SOP in one spot.</p></a>
    <a class="card" href="/gbg-os/web/"><div class="card-top"><h3>Website &amp; Content</h3></div><p>Site, repo, hosting, social pages, blog drafts.</p></a>
    <a class="card" href="/gbg-os/finance/"><div class="card-top"><h3>Finance</h3></div><p>Budget, equipment and launch gate trackers. Links to Drive only.</p></a>
  </div>
""" + sh("Quick launch") + f"""  <div class="chips">
    {chip("Launch HQ index", D["hq"], "drive")}
    {chip("Master launch plan", D["master"], "drive")}
    {chip("GBG Drive", D["root"], "drive")}
    {chip("UNC marketing folder", D["f_unc_client"], "drive")}
    {chip("gbgdubuque.com", "https://gbgdubuque.com/")}
    {chip("Facebook page", "https://www.facebook.com/profile.php?id=61596672201884")}
    {chip("Instagram", "https://www.instagram.com/gbgdubuque/")}
    {chip("Repo", "https://github.com/RickyG516/gbg-dubuque-site")}
    {chip("Netlify", "https://app.netlify.com/")}
  </div>
"""
page("", "hub", "Hub", "GBG Dubuque", "GBG <span>OS</span>",
     "One front door to everything that runs GBG. Exterior services, Dubuque, target launch April 1, 2027.", hub)

# ---------- LAUNCH ----------
def checklist(items):
    DONE = ' class="done"'
    rows = "".join(f'<li{DONE if d else ""}><span class="box"></span><span>{t}</span></li>' for t, d in items)
    return f'<ul class="check">{rows}</ul>'

launch = sh("Roadmap") + """  <div class="phases">
    <div class="phase now"><div class="when">Now to Dec 31</div><h3>Build the base</h3><ul>
      <li>Starter fund built</li><li>Lawyer consult on LLC and trust structure</li><li>Launch order: lights, sealing, spraying</li>
      <li>Website live on gbgdubuque.com</li><li>Contact form to HubSpot</li><li>Review plan started</li>
      <li>Referral agreements with partners</li><li>Weekly blog drafts</li></ul></div>
    <div class="phase"><div class="when">Jan to Mar 2027</div><h3>Get ready</h3><ul>
      <li>Google Business Profile verified, local 563 number</li><li>Insurance and licenses in place</li>
      <li>Real photos and first reviews</li></ul></div>
    <div class="phase"><div class="when">April 1, 2027</div><h3>Launch</h3><ul>
      <li>First job booked</li><li>First equipment buys, from booked jobs only</li><li>Review farm active</li></ul></div>
    <div class="phase"><div class="when">Year 2+</div><h3>Scale what sticks</h3><ul>
      <li>Ideas: detailing, carpet and upholstery, fence staining</li><li>More trades under GBG</li></ul></div>
  </div>
""" + '  <div class="grid" style="margin-top:14px">\n' + \
f"""    <div class="card"><div class="card-top"><h3>Due now, everyone</h3><a class="tag or" href="/gbg-os/tasks/">All tasks</a></div><div data-live="tasks" data-owner="all" data-short="1"></div></div>
    <div class="card"><div class="card-top"><h3>Verify before launch</h3><span class="tag stop">Blocks booking</span></div>{checklist([
        ("Licensing and insurance for each service", False),
        ("Yard spraying: pesticide applicator certification (confirm with IDALS)", False),
        ("Permanent lights: confirm no electrical license needed, insurance covers heights", False),
        ("Iowa sales tax on sealing, cleaning, epoxy, lights (Iowa DOR)", False),
        ("Dubuque solicitor license, door hanger exemption", False),
        ("Yard sign rules", False),
        ("info@gbgdubuque.com inbox works", False)])}</div>
    <div class="card"><div class="card-top"><h3>Open decisions</h3></div><ul>
      <li>Who gets access to the GBG project</li><li>LLC and trust structure, after the lawyer consult</li>
      <li>Spend approval limit per owner</li><li>Phone setup: AI line or a direct number</li></ul>
      <div class="chips">{chip("Compliance checklist", D["compliance"], "drive")}{chip("Lawyer questions", D["lawyer"], "drive")}{chip("Launch gates and KPIs", D["gates"], "drive")}</div></div>
  </div>
"""
page("launch", "launch", "Launch", "Launch", "Road to <span>April</span>",
     "Book jobs first, buy equipment after. Everyone keeps their current job in year one.", launch)

# ---------- SERVICES ----------
svc = [
    ("Permanent lights", "Lead service", "wait", "Gathering interest",
     ["Plug in only: tape and clips, no wiring", "Season is Nov to Jan, pre sell fall 2027", "Social leads with lights"],
     [("Consult SOP", D["sop_lights"])]),
    ("Driveway sealing", "Launch order #2", "wait", "Supplier open",
     ["Low tool cost, strong referral source", "Supplier fields still blank in the job day SOP"],
     [("Job day SOP", D["sop_sealing"]), ("Estimate calculator", D["estimate"])]),
    ("Yard spraying", "Recurring", "stop", "Cert needed",
     ["Recurring contracts are the cash base", "No pesticide applicator certification yet"], []),
    ("Trash can cleaning", "Recurring", "wait", "Planning",
     ["Route based, monthly recurring"], []),
    ("Epoxy", "High ticket", "wait", "Planning",
     ["Done before, high margin", "Plays off the contractor network"], []),
    ("Junk removal", "Added Nov 12", "wait", "Planning",
     ["Hauling only", "No hoarder homes, nothing hazardous", "Trucks and trailer access already there"], []),
]
cards = ""
for name, role, cls, status, notes, links in svc:
    lis = "".join(f"<li>{n}</li>" for n in notes)
    ch = "".join(chip(l, h, "drive") for l, h in links)
    cards += f'    <div class="card"><div class="card-top"><h3>{name}</h3><span class="tag {cls}">{status}</span></div><p style="color:#e36b1e;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin:0 0 6px">{role}</p><ul>{lis}</ul><div class="chips">{ch}</div></div>\n'
partners = ""
for trade, biz, site in [("Painting", "Fuehrer Painting", "https://fuehrerpaintingllc.com/"),
                         ("Landscaping", "New View Landscaping", "https://newviewdbq.com/"),
                         ("Tree work", "Kutsch Tree Service", "https://kutschtreeservicedbq.com/")]:
    partners += f'    <div class="card"><div class="card-top"><h3>{trade}</h3><span class="tag ref">Partner</span></div><p>Routed to {biz}.</p><div class="chips">{chip("Their site", site)}</div></div>\n'
services = sh("In house") + f'  <div class="grid">\n{cards}  </div>\n' + sh("Partner routing") + \
    f'  <div class="grid">\n{partners}  </div>\n' + \
    f'  <div class="note"><b>Position:</b> GBG is the coordination hub, not a do everything crew. See it on the site? We set you up with the right people.<div class="chips" style="margin-top:10px">{chip("Referral program", D["referral"], "drive")}</div></div>\n'
page("services", "services", "Services", "Services", "What we <span>run</span>",
     "In house work, partner trades, and the gate each one has to clear before it books.", services)

# ---------- JOBS ----------
jobs = sh("Pipeline") + """  <div class="board" data-live="board"><p class="loading">Loading…</p></div>
""" + sh("Add a lead") + """  <form class="card form" data-form="lead">
    <input name="name" placeholder="Name" required><input name="phone" placeholder="Phone"><input name="email" placeholder="Email">
    <input name="address" placeholder="Address or street">
    <select name="service"><option value="">Service</option><option>Permanent lights</option><option>Driveway sealing</option><option>Yard spraying</option><option>Trash can cleaning</option><option>Epoxy</option><option>Junk removal</option><option>Painting (partner)</option><option>Landscaping (partner)</option><option>Tree work (partner)</option></select>
    <select name="source"><option value="other">How they found us</option><option value="hanger">Door hanger</option><option value="facebook">Facebook</option><option value="referral">Referral</option><option value="phone">Called in</option><option value="form">Website</option><option value="other">Other</option></select>
    <input name="notes" placeholder="Notes" class="wide">
    <button type="submit">Add lead</button>
  </form>
  <div class="note"><b>Website leads land here on their own.</b> Customer details live in the CRM database behind your PIN, never in this page's HTML.</div>
""" + sh("How a job moves") + f"""  <div class="chips">
    {chip("Lead response SOP", D["sop_lead"], "drive")}{chip("Sales consult and estimate SOP", D["sop_consult"], "drive")}
    {chip("Closeout and review SOP", D["sop_closeout"], "drive")}{chip("Street log", D["street"], "drive")}
  </div>
"""
page("jobs", "jobs", "Jobs", "Jobs", "Job <span>pipeline</span>",
     "Click any card to open it: edit details, add notes and follow ups, see the history. Mark a job done and the closeout task shows up on its own.", jobs)

# ---------- CONTACTS ----------
contacts = """  <input class="search" data-search placeholder="Search name, phone, or address">
  <div class="card"><div data-live="contacts"><p class="loading">Loading…</p></div></div>
""" + sh("Add a contact") + """  <form class="card form" data-form="contact">
    <input name="name" placeholder="Name" required><input name="phone" placeholder="Phone"><input name="email" placeholder="Email">
    <input name="address" placeholder="Address"><input name="neighborhood" placeholder="Neighborhood">
    <select name="kind"><option value="customer">Customer</option><option value="partner">Partner</option><option value="vendor">Vendor</option></select>
    <input name="notes" placeholder="Notes" class="wide">
    <button type="submit">Add contact</button>
  </form>
  <div class="note"><b>Customers, partners, vendors, suppliers.</b> Click anyone to edit them, see their jobs, and read every note and change.</div>
"""
page("contacts", "contacts", "Contacts", "Contacts", "Every <span>person</span>",
     "Customers, partners and vendors. Click a name to open the full record.", contacts)

# ---------- TASKS ----------
tasks = """  <div class="filters" data-filter>
    <button class="on" data-owner="mine">Mine</button><button data-owner="all">Everyone</button>
    <button data-owner="ricky">Ricky</button><button data-owner="doug">Doug</button>
    <span class="sep"></span><button data-status="open">Open</button><button data-status="done">Done</button>
  </div>
  <div class="card"><div data-live="tasks" data-owner="mine" data-status="open"></div></div>
""" + sh("Add a task") + """  <form class="card form" data-form="task">
    <input name="title" placeholder="What needs doing" required class="wide">
    <select name="owner"><option value="ricky">Ricky</option><option value="doug">Doug</option><option value="both">Both</option></select>
    <input name="due" type="date">
    <select name="area"><option value="">Area</option><option>compliance</option><option>legal</option><option>admin</option><option>finance</option><option>marketing</option><option>website</option><option>partners</option><option>ops</option><option>sales</option></select>
    <button type="submit">Add task</button>
  </form>
"""
page("tasks", "tasks", "Tasks", "Tasks", "Who does <span>what</span>",
     "Every to do from the launch plan, the gates, the compliance list and the SOPs, dated back from April 1.", tasks)

# ---------- PLAYBOOK ----------
playbook = sh("Operating rules") + """  <div class="grid">
    <div class="card"><h3>How GBG runs</h3><ul style="margin-top:10px">
      <li>Book jobs first, buy equipment after</li><li>No trailer purchase, rent or borrow when a job books</li>
      <li>Everyone keeps their current job in year one</li><li>Owners do the work when schedules allow</li>
      <li>Scale what sticks, double down on winners</li><li>Farm reviews hard</li></ul></div>
    <div class="card"><h3>Copy rules</h3><ul style="margin-top:10px">
      <li>Tight and plain, no dashes as punctuation</li><li>No invented reviews, job counts, years, prices, or licenses</li>
      <li>No owner names or ownership on the public site</li><li>Bare domain links, never www</li></ul></div>
  </div>
""" + sh("Brand") + """  <div class="card">
    <div class="sw">
      <div><i style="background:#1a1a1a"></i><span>Charcoal #1a1a1a</span></div>
      <div><i style="background:#e36b1e"></i><span>Burnt orange #e36b1e</span></div>
      <div><i style="background:#0f0f0f"></i><span>Dark #0f0f0f</span></div>
      <div><i style="background:#f5f5f5"></i><span>Light #f5f5f5</span></div>
    </div>
    <p style="margin-top:14px">Logo: pyramid of blocks, 3, 2, 1. Tagline: Professional Exterior Services. Built in North Dubuque.</p>
  </div>
""" + sh("SOPs") + f"""  <div class="chips">
    {chip("Operating rhythm", D["sop_rhythm"], "drive")}{chip("Lead response", D["sop_lead"], "drive")}
    {chip("Sales consult and estimate", D["sop_consult"], "drive")}{chip("Lights consult", D["sop_lights"], "drive")}
    {chip("Sealing job day", D["sop_sealing"], "drive")}{chip("Closeout and reviews", D["sop_closeout"], "drive")}
    {chip("Website go live", D["sop_golive"], "drive")}{chip("SOPs folder", D["f_sops"], "drive")}
  </div>
"""
page("playbook", "playbook", "Playbook", "Playbook", "How we <span>work</span>",
     "Rules, brand, and every SOP.", playbook)

# ---------- WEB & CONTENT ----------
web = sh("Website") + f"""  <div class="grid">
    <div class="card"><div class="card-top"><h3>gbgdubuque.com</h3><span class="tag go">Live</span></div><ul>
      <li>Source: RickyG516/gbg-dubuque-site, main</li><li>Netlify auto deploys on push, so batch pushes</li>
      <li>Phone and email are still placeholders</li></ul>
      <div class="chips">{chip("Open site", "https://gbgdubuque.com/")}{chip("Repo", "https://github.com/RickyG516/gbg-dubuque-site")}{chip("Netlify", "https://app.netlify.com/")}</div></div>
    <div class="card"><div class="card-top"><h3>Older copies here</h3><span class="tag wait">Legacy</span></div><ul>
      <li>/demo/ia-gbg-dubuque/ staging and /gbg/ in this repo</li><li>Production moved to its own repo Nov 13</li></ul>
      <div class="chips">{chip("Staging", "/demo/ia-gbg-dubuque/", "int")}</div></div>
  </div>
""" + sh("Content") + f"""  <div class="grid">
    <div class="card"><div class="card-top"><h3>Social</h3></div><ul>
      <li>Lights first, driveway later</li><li>Posts gather interest only, no installs booked until gates clear</li></ul>
      <div class="chips">{chip("Facebook", "https://www.facebook.com/profile.php?id=61596672201884")}{chip("Instagram", "https://www.instagram.com/gbgdubuque/")}</div></div>
    <div class="card"><div class="card-top"><h3>Blog</h3><span class="tag or">Weekly</span></div><ul>
      <li>GBG Blog Drafter, Mondays 5:47 AM Central</li><li>Drafts only, nothing publishes on its own</li></ul></div>
    <div class="card"><div class="card-top"><h3>Plans</h3></div>
      <div class="chips">{chip("Marketing plan", D["marketing"], "drive")}{chip("Review plan", D["reviews"], "drive")}{chip("Seasonal calendar 2027", D["seasonal"], "drive")}</div></div>
  </div>
"""
page("web", "web", "Website & Content", "Website &amp; Content", "Site and <span>content</span>",
     "Where the site lives, how it ships, and what's going out on social.", web)

# ---------- FINANCE ----------
finance = sh("Trackers") + f"""  <div class="grid">
    <div class="card"><h3>Startup budget and equipment</h3><p style="margin-top:8px">Fund progress and equipment quotes.</p><div class="chips">{chip("Open in Drive", D["budget"], "drive")}</div></div>
    <div class="card"><h3>Launch gates and KPIs</h3><p style="margin-top:8px">What has to be true before each service books.</p><div class="chips">{chip("Open in Drive", D["gates"], "drive")}</div></div>
    <div class="card"><h3>Driveway estimate calculator</h3><p style="margin-top:8px">Quote math for sealing jobs.</p><div class="chips">{chip("Open in Drive", D["estimate"], "drive")}</div></div>
  </div>
  <div class="chips" style="margin-top:14px">{chip("Finance & Admin folder", D["f_fin"], "drive")}{chip("Trackers folder", D["f_trackers"], "drive")}</div>
  <div class="note"><b>Why links only:</b> this domain can be read by anyone with the URL. Dollar figures, the fund balance, and ownership stay in Drive.</div>
"""
page("finance", "finance", "Finance", "Finance", "The <span>numbers</span>",
     "Every figure lives in Drive. This page points to it.", finance)
print("ok")
