"""Generates the static GBG OS pages into urban-backstage-site/gbg-os/.
Run from anywhere: python3 gbg-os/_build/build.py
Edit content here (checklists, statuses), rebuild. Bump V when os.css or os.js change."""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = "13"  # cache bust, bump on every os.css / os.js change

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
      <h3 style="margin-top:18px">Recently closed</h3><div data-live="closed"></div>
      <h3 style="margin-top:18px">Recent activity</h3><ul class="mini" data-live="recent"></ul>
      <p class="whoami">Click any task to edit it. <span data-live="hello"></span> &middot; <button class="linkbtn" data-signout>Sign out</button></p></div>
  </div>
""" + sh("Sections") + f"""  <div class="grid">
    <a class="card" href="/gbg-os/start/"><div class="card-top"><h3>Start here</h3><span class="tag or">New</span></div><p>How everything works and every tool we use, in one place.</p></a>
    <a class="card" href="/gbg-os/roles/"><div class="card-top"><h3>Roles</h3><span class="tag or">New</span></div><p>Rate every role 1 to 10. Scores stay hidden until all three of us finish.</p></a>
    <a class="card" href="/gbg-os/gear/"><div class="card-top"><h3>Gear</h3><span class="tag or">Live</span></div><p>Check off the tools you own. See which service is cheapest to start.</p></a>
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
contacts = """  <div class="stats">
    <div class="stat"><div class="k">Customers</div><div class="v or" data-cc="customers">&middot;</div></div>
    <div class="stat"><div class="k">Partners</div><div class="v" data-cc="partners">&middot;</div></div>
    <div class="stat"><div class="k">Vendors</div><div class="v" data-cc="vendors">&middot;</div></div>
    <div class="stat"><div class="k">Archived</div><div class="v" data-cc="archived">&middot;</div></div>
  </div>
  <div class="ctools">
    <input class="search" data-search placeholder="Search name, phone, email, address, city, notes">
    <div class="filters" data-cview>
      <button class="on" data-view="active">Active</button><button data-view="archived">Archived</button><button data-view="all">All</button>
      <span class="sep"></span>
      <button class="on" data-kind="">Everyone</button><button data-kind="customer">Customers</button><button data-kind="partner">Partners</button><button data-kind="vendor">Vendors</button>
    </div>
  </div>
  <div class="bulk" data-bulk hidden></div>
  <div class="card"><div data-live="contacts"><p class="loading">Loading…</p></div></div>
""" + sh("Add a contact") + """  <form class="card form" data-form="contact">
    <input name="name" placeholder="Name" required><input name="phone" placeholder="Phone"><input name="email" placeholder="Email">
    <input name="address" placeholder="Address"><input name="neighborhood" placeholder="Neighborhood">
    <select name="kind"><option value="customer">Customer</option><option value="partner">Partner</option><option value="vendor">Vendor</option></select>
    <input name="notes" placeholder="Notes" class="wide">
    <button type="submit">Add contact</button>
  </form>
  <div class="note"><b>Tick the boxes to archive or delete in bulk.</b> Archive hides someone and their jobs, and you can bring them back. Delete is for test entries and mistakes: it removes the contact, their jobs and the tasks on those jobs.</div>
"""
page("contacts", "contacts", "Contacts", "Contacts", "Every <span>person</span>",
     "Customers, partners and vendors. Click a name to open the full record.", contacts)

# ---------- GEAR ----------
gear = """  <div class="readiness" data-live="readiness"><p class="loading">Loading…</p></div>
  <div class="note" data-live="bestbet" style="margin-top:12px"></div>
  <div class="ctools">
    <div class="filters" data-gshow><button class="on" data-show="all">Everything</button><button data-show="need">Still need</button><button data-show="have">We have</button></div>
    <p class="hint2" style="margin:0">Tap a service card to switch lists. Check <b>I have it</b> for anything you own. More than one person can check the same item.</p>
  </div>
  <div class="card"><div data-live="gear"></div></div>
""" + sh("Add an item to this list") + """  <form class="card form" data-form="gear">
    <input name="name" placeholder="Item" required class="wide">
    <input name="category" placeholder="Category (Tools, Materials, Safety…)">
    <input name="qty" placeholder="How many">
    <select name="priority"><option value="must">Must have to start</option><option value="nice">Nice to have</option></select>
    <button type="submit">Add item</button>
  </form>
  <div class="note"><b>How the numbers work.</b> A must have counts as covered when anyone has it or it was bought for GBG. Open any item to add a low and high quote. The service cards then show what is left to spend, so we start with whatever costs the least to get going. Book jobs first, buy after.</div>
"""
page("gear", "gear", "Gear", "Gear", "What we <span>have</span>",
     "Everything we need to start driveway sealing and permanent lights, plus junk removal and trash cans for comparison.", gear)

# ---------- ROLES ----------
roles = """  <div class="rprog" data-live="rprog"><p class="loading">Loading…</p></div>
  <div class="note" style="margin-top:12px"><b>How this works.</b> Rate every role twice: how good you'd be at it, and how bad you want it. Be honest, nobody can see your scores until Ricky, Doug and Kevin have all finished. Then everyone's scores show up, we talk it through, and Ricky makes the final call if we can't agree. Change a score any time by tapping a different number.</div>
  <div data-live="roles"></div>
""" + sh("Did we miss a role?") + """  <form class="card form" data-form="rolesug">
    <input name="name" placeholder="Role name" required class="wide">
    <input name="note" placeholder="What it covers" class="wide">
    <button type="submit">Suggest it</button>
  </form>
  <div data-live="rolesug"></div>
"""
page("roles", "roles", "Roles", "Roles", "Who <span>owns</span> what",
     "Every job in the business, rated by each of us. This is how we start handing things off.", roles)

# ---------- START HERE ----------
def tool(name, href, what, who):
    link = f'<div class="chips">{chip("Open", href)}</div>' if href else ""
    return f'<div class="card tool"><div class="card-top"><h3>{name}</h3>{link}</div><p>{what}</p><p class="access">{who}</p></div>'
start = sh("Logging in") + """  <div class="grid">
    <div class="card"><h3>First time on a device</h3><ol class="steps">
      <li>Go to <b>urbanbackstage.com/gbg-os</b> (no www).</li>
      <li>Type your email. Cloudflare emails you a code. Type the code.</li>
      <li>On the orange GBG screen pick your name and enter your PIN. Ricky sends PINs by text, never in a doc.</li>
      <li>When your phone or browser asks to save the password, tap Save. Your PIN fills in on its own next time.</li>
      <li>That device stays logged in. Use Sign out on the Hub if it is a shared device.</li>
    </ol></div>
    <div class="card"><h3>If it won't let you in</h3><ul>
      <li>Make sure it says urbanbackstage.com, not www.</li>
      <li>No code? Check junk mail. Codes come from Cloudflare.</li>
      <li>Wrong PIN wait is a couple seconds. Try again or text Ricky.</li>
    </ul></div>
  </div>
""" + sh("What each page is for") + """  <div class="grid">
    <a class="card" href="/gbg-os/"><h3>Hub</h3><p>Your tasks due now, key dates, what just got done, and who did what.</p></a>
    <a class="card" href="/gbg-os/tasks/"><h3>Tasks</h3><p>Everything with an owner and a date. Tap the box to finish it (Undo is there if you misclick). Tap the words to change the date, owner or add notes like who you talked to. Search at the top.</p></a>
    <a class="card" href="/gbg-os/jobs/"><h3>Jobs</h3><p>Every lead from the phone line and the website lands here. Tap a card to see the customer, add notes, set a follow up, move it along. Marking a job Done creates the closeout task on its own.</p></a>
    <a class="card" href="/gbg-os/contacts/"><h3>Contacts</h3><p>Customers, partners and vendors. Search, open anyone, archive or delete. The EXAMPLE entries show how a filled out record looks.</p></a>
    <a class="card" href="/gbg-os/roles/"><h3>Roles</h3><p>Rate every role on how good you'd be and how bad you want it. Nobody sees anyone's scores until all three finish. Think we missed a role? Use the suggestion box at the bottom.</p></a>
    <a class="card" href="/gbg-os/gear/"><h3>Gear</h3><p>Check off the tools you already own. Add quotes. The cards show which service is cheapest to start.</p></a>
    <a class="card" href="/gbg-os/launch/"><h3>Launch, Services, Playbook</h3><p>The road to April, what we offer and the rules for how we work.</p></a>
  </div>
""" + sh("Rules") + """  <div class="card"><ul>
    <li><b>Money:</b> nobody spends GBG money without both owners agreeing first. No one gets paid yet. Starter money is held in UNC or a personal savings account until the GBG bank account opens in March.</li>
    <li><b>Buying gear:</b> book the job first, buy the gear after. Check the Gear page before buying so we don't double up.</li>
    <li><b>What we say in public:</b> no made up reviews, prices, job counts, years in business or licenses. Ever.</li>
    <li><b>Leads:</b> call back the same day when you can. Log what happened as a note on the job.</li>
    <li><b>Sunday 8:30 PM check in:</b> 20 minutes. Last week, this week, anything stuck.</li>
  </ul></div>
""" + sh("Every tool we use") + f"""  <div class="grid">
    {tool("GBG OS", "/gbg-os/", "This site. Tasks, jobs, contacts, gear, everything.", "Ricky, Doug, Kevin")}
    {tool("Phone line (563) 500-2494", "", "AI receptionist answers 24/7. Real calls become a lead in Jobs plus a Call back task, and email Ricky and Doug. Spam gets skipped.", "Set up by Ricky")}
    {tool("Website", "https://gbgdubuque.com/", "gbgdubuque.com. Changes go through Ricky.", "Ricky edits")}
    {tool("Facebook page", "https://www.facebook.com/gbgdubuque", "Posts are scheduled through Feb. Like and share, answer messages.", "Ricky, Doug (accept the Meta invite)")}
    {tool("Instagram", "https://www.instagram.com/gbgdubuque/", "@gbgdubuque. Messages land in the Facebook inbox.", "Ricky")}
    {tool("Meta Business Suite", "https://business.facebook.com/", "Where posts get scheduled and messages get answered.", "Ricky, Doug after the invite")}
    {tool("Google Business Profile", "https://business.google.com/", "Created, not verified yet. Needs a short video of the truck, magnet and gear.", "Ricky")}
    {tool("GBG Drive", D["root"], "SOPs, trackers, legal and money docs. Organized by department.", "Ricky, Doug")}
    {tool("Marketing files", D["f_unc_client"], "Print files, social graphics, brand assets. Use the 2026-11-24 print files.", "Ricky, Doug")}
    {tool("Google Calendar", "https://calendar.google.com/", "Sunday 8:30 PM check in and the key dates.", "Ricky")}
  </div>
  <div class="note"><b>No passwords on this page or anywhere in the OS.</b> If you need into something, ask Ricky.</div>
"""
page("start", "start", "Start here", "Start here", "Start <span>here</span>",
     "One place for how everything works and where everything lives. Bookmark this page.", start)

# ---------- TASKS ----------
tasks = """  <input class="search" data-tsearch placeholder="Search tasks: DIAL, insurance, Mark, sealer…">
  <div class="filters" data-filter>
    <button class="on" data-owner="mine">Mine</button><button data-owner="all">Everyone</button>
    <button data-owner="ricky">Ricky</button><button data-owner="doug">Doug</button><button data-owner="kevin">Kevin</button>
    <span class="sep"></span><button data-status="open">Open</button><button data-status="done">Closed, last 30 days</button>
  </div>
  <div class="card"><div data-live="tasks" data-owner="mine" data-status="open"></div></div>
""" + sh("Add a task") + """  <form class="card form" data-form="task">
    <input name="title" placeholder="What needs doing" required class="wide">
    <select name="owner"><option value="ricky">Ricky</option><option value="doug">Doug</option><option value="kevin">Kevin</option><option value="both">Both</option></select>
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
      <li>Phone is set (563) 500-2494. Email is still a placeholder</li></ul>
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
