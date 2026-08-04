#!/usr/bin/env python3
"""Build a complete spec mockup page from prospect data + a style pack.

Cloning an existing page is how a library turns into one template. This emits a
fresh page driven by the pack (fonts, layout skeleton, hero treatment) and the
prospect's own words, and satisfies every line of the spec-mockup-engine Step 5
baseline gate.
"""
import sys, json, html
sys.path.insert(0,"/root/ubs/tools")
from scenes import BUILDERS
import gen_assets as G

PACKS = {
 "P11": dict(disp="Big Shoulders Display", body="Libre Franklin", dw="700;800", bw="400;600"),
 "P19": dict(disp="Titillium Web",         body="Mulish",         dw="600;700", bw="400;600"),
 "P18": dict(disp="Cabin Condensed",       body="Merriweather Sans", dw="600;700", bw="400;600"),
}

def esc(x): return html.escape(x, quote=True)

def build(d):
    pk = PACKS[d["pack"]]; slug=d["slug"]; A=d["accent"]; DK=d["dark"]; OFF=d["off"]
    # ---- assets
    svg = BUILDERS[d["trade"]](DK, A, OFF, d["seed"], variant=d.get("variant"))
    open(f"/root/ubs/demo/{slug}/motion.svg","w").write(svg)
    open(f"/root/ubs/demo/{slug}/motion-hero.svg","w").write(
        svg.replace('viewBox="0 0 1200 900" width="1200" height="900"',
                    'viewBox="-390 235 1330 445" width="1330" height="445" preserveAspectRatio="xMidYMid slice"',1))
    open(f"/root/ubs/demo/{slug}/radius.svg","w").write(G.radius(DK,A,OFF,d["seed"]))
    open(f"/root/ubs/demo/{slug}/texture.svg","w").write(G.texture(DK,A,OFF,d["seed"]))

    tel = "".join(c for c in d["phone"] if c.isdigit())
    svcs = "".join(
      f'<div class="card reveal"><h3>{esc(s[0])}</h3><p>{esc(s[1])}</p></div>' for s in d["services"])
    faqs = "".join(
      f'<details class="q"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in d["faq"])
    chips = "".join(f'<span class="chip">{esc(t)}</span>' for t in d["areas"])
    trust = "".join(f'<div class="tcard"><strong>{esc(t[0])}</strong><span>{esc(t[1])}</span></div>' for t in d["trust"])

    heroSrc = d.get("heroSrc","motion-hero.svg")
    figs = d.get("figs")
    return f'''<!-- style-pack: {d["pack"]} | trade: {d["trade"]} | accent: {A} -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>{esc(d["name"])} | {esc(d["tagline"])} | {esc(d["city"])}</title>
<meta name="description" content="{esc(d["meta"])}">
<link href="https://fonts.googleapis.com/css2?family={pk['disp'].replace(' ','+')}:wght@{pk['dw']}&family={pk['body'].replace(' ','+')}:wght@{pk['bw']}&display=swap" rel="stylesheet">
<style>
:root{{--dark:{DK};--accent:{A};--off:{OFF};--muted:#9aa3a0}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{font-family:'{pk["body"]}',system-ui,sans-serif;background:var(--off);color:var(--dark);line-height:1.65;overflow-x:hidden}}
h1,h2,h3{{font-family:'{pk["disp"]}',system-ui,sans-serif;font-weight:700;letter-spacing:.02em;line-height:1.1}}
a{{color:inherit;text-decoration:none}}
img{{display:block;max-width:100%}}
.wrap{{max-width:1120px;margin:0 auto;padding:0 24px}}
nav.top{{position:sticky;top:0;z-index:900;display:flex;align-items:center;justify-content:space-between;
  gap:16px;padding:14px 24px;background:{DK};border-bottom:3px solid {A}}}
nav.top .mark{{font-family:'{pk["disp"]}';font-weight:800;color:#fff;font-size:1.12rem;letter-spacing:.03em}}
nav.top .mark em{{color:{A};font-style:normal}}
nav.top .links{{display:flex;gap:20px;align-items:center;font-size:.92rem;color:#dfe3e1}}
nav.top .call{{background:{A};color:{DK};font-weight:700;padding:9px 18px;border-radius:4px;white-space:nowrap}}
@media(max-width:820px){{nav.top .links a:not(.call){{display:none}}}}
/* ---- HERO ({d["pack"]}) ---- */
.hero{{position:relative;min-height:86vh;display:flex;align-items:flex-end;overflow:hidden;background:{DK}}}
.hero-photo{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
  animation:kb 26s ease-in-out infinite alternate}}
@keyframes kb{{0%{{transform:scale(1)}}100%{{transform:scale(1.14)}}}}
@media (prefers-reduced-motion: reduce){{.hero-photo{{animation:none}}}}
.hero::after{{content:"";position:absolute;inset:0;z-index:1;background:
  radial-gradient(ellipse at 28% 72%,rgba(0,0,0,.72),rgba(0,0,0,.34) 55%,transparent 80%),
  linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.20) 45%,rgba(0,0,0,.80) 100%)}}
.hero-in{{position:relative;z-index:2;color:#fff;padding:0 clamp(24px,6vw,80px) clamp(52px,9vh,96px);max-width:760px}}
.kick{{display:inline-block;color:{A};border:1px solid {A};border-radius:3px;padding:6px 15px;
  font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;margin-bottom:18px}}
.hero h1{{font-size:clamp(2.1rem,5.6vw,3.7rem);margin-bottom:16px;text-shadow:0 3px 20px rgba(0,0,0,.45)}}
.hero h1 span{{color:{A}}}
.hero p{{font-size:1.12rem;color:#e6eae8;max-width:560px;margin-bottom:30px}}
.btn{{display:inline-block;background:{A};color:{DK};font-weight:700;padding:15px 34px;border-radius:4px;
  border:2px solid {A};transition:.2s}}
.btn:hover{{background:transparent;color:{A}}}
/* ---- sections ---- */
section{{padding:82px 0}}
.lab{{display:block;text-align:center;color:{A};letter-spacing:.18em;text-transform:uppercase;font-size:.78rem;margin-bottom:10px}}
.st{{text-align:center;font-size:clamp(1.6rem,3.6vw,2.4rem);margin-bottom:14px}}
.ss{{text-align:center;max-width:620px;margin:0 auto 50px;color:#5d6663}}
.grid3{{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}}
@media(max-width:820px){{.grid3{{grid-template-columns:1fr}}}}
.card{{background:#fff;border:1px solid #e3e6e3;border-top:4px solid {A};border-radius:6px;padding:30px 24px}}
.card h3{{font-size:1.06rem;margin-bottom:10px}}
.card p{{font-size:.95rem;color:#5d6663}}
.reveal{{opacity:0;transform:translateY(28px);transition:.7s}}
.reveal.on{{opacity:1;transform:none}}
/* gallery */
.gal{{background:#eef0ed}}
.gg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}}
.gg figure{{margin:0}}
.gg img{{aspect-ratio:4/3;object-fit:cover;border-radius:6px;background:{DK};width:100%}}
.gg figcaption{{margin-top:.7rem;font-size:.86rem;line-height:1.45;color:#4d534f}}
.gg figcaption strong{{display:block;color:{DK};margin-bottom:.15rem}}
.ask{{max-width:640px;margin:2rem auto 0;padding:1.1rem 1.3rem;border:1px dashed {A};border-radius:8px;
  font-size:.92rem;color:#40463f;background:rgba(255,255,255,.5)}}
.ask strong{{color:{A}}}
/* trust + area */
.trust{{background:{DK};color:#e8ebe9}}
.trust .st,.trust .ss{{color:#fff}}
.tgrid{{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}}
@media(max-width:820px){{.tgrid{{grid-template-columns:1fr}}}}
.tcard{{border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:26px 22px;text-align:center}}
.tcard strong{{display:block;font-family:'{pk["disp"]}';font-size:1.5rem;color:{A};margin-bottom:6px}}
.tcard span{{font-size:.92rem;color:#c2c9c6}}
.chips{{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:820px;margin:0 auto}}
.chip{{border:1px solid {A}55;color:{A};padding:10px 20px;border-radius:26px;font-size:.9rem;background:{A}0f}}
/* faq */
.q{{border-bottom:1px solid #dfe2df;padding:16px 0}}
.q summary{{cursor:pointer;font-weight:600;font-family:'{pk["disp"]}';font-size:1.02rem}}
.q p{{margin-top:10px;color:#5d6663;font-size:.95rem}}
/* contact */
.cwrap{{display:grid;grid-template-columns:1fr 1fr;gap:34px}}
@media(max-width:820px){{.cwrap{{grid-template-columns:1fr}}}}
.form{{background:#fff;border:1px solid #e3e6e3;border-radius:8px;padding:28px}}
.form label{{display:block;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 6px;color:#5d6663}}
.form input,.form textarea,.form select{{width:100%;padding:12px;border:1px solid #d8dcd8;border-radius:4px;font:inherit}}
.form button{{margin-top:20px;width:100%;background:{A};color:{DK};border:none;padding:15px;border-radius:4px;
  font-weight:700;font-size:1rem;cursor:pointer}}
.callbox{{background:{DK};color:#fff;border-radius:8px;padding:30px}}
.callbox a.big{{display:inline-block;background:{A};color:{DK};font-weight:700;padding:14px 26px;border-radius:4px;margin-top:12px}}
footer{{background:{DK};color:#9aa3a0;text-align:center;padding:30px 24px;font-size:.86rem}}
/* sticky mobile call bar */
.sticky{{display:none}}
@media(max-width:768px){{.sticky{{display:block;position:fixed;left:0;right:0;bottom:0;z-index:950;background:{A};
  color:{DK};text-align:center;padding:15px;font-weight:700}}body{{padding-bottom:58px}}}}
/* kobe */
#kobe{{position:fixed;right:18px;bottom:18px;z-index:940}}
#kobe-btn{{background:{A};color:{DK};border:none;border-radius:26px;padding:13px 22px;font-weight:700;cursor:pointer}}
#kobe-panel{{position:absolute;right:0;bottom:54px;width:290px;background:#fff;border:1px solid #dcdfdc;
  border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.2);overflow:hidden}}
#kobe-head{{background:{DK};color:#fff;padding:11px 14px;font-weight:600;font-size:.9rem}}
#kobe-body{{padding:12px;max-height:210px;overflow:auto;font-size:.88rem}}
#kobe-form{{display:flex;border-top:1px solid #e3e6e3}}
#kobe-form input{{flex:1;border:none;padding:11px;font:inherit}}
#kobe-form button{{border:none;background:{A};color:{DK};padding:0 15px;font-weight:700;cursor:pointer}}
@media(max-width:768px){{#kobe{{bottom:70px}}}}
@media print{{
  nav.top{{position:static}} .sticky,#kobe{{display:none!important}}
  .hero-photo{{animation:none}} .reveal{{opacity:1;transform:none}}
  .card,.gg figure,.tcard{{break-inside:avoid}} .hero{{min-height:auto}}
}}
</style>
</head>
<body>
<nav class="top">
  <a href="#" class="mark">{esc(d["markA"])} <em>{esc(d["markB"])}</em></a>
  <div class="links">
    <a href="#services">Services</a><a href="#work">Work</a><a href="#area">Service Area</a><a href="#faq">FAQ</a>
    <a class="call" href="tel:+1{tel}">{esc(d["phone"])}</a>
  </div>
</nav>

<section class="hero">
  <img class="hero-photo" src="{heroSrc}" alt="{esc(d["heroAlt"])}">
  <div class="hero-in">
    <span class="kick">{esc(d["city"])}</span>
    <h1>{d["h1"]}</h1>
    <p>{esc(d["sub"])}</p>
    <a class="btn" href="#contact">{esc(d["cta"])}</a>
  </div>
</section>

<section id="services">
  <div class="wrap">
    <span class="lab">What we do</span>
    <h2 class="st">{esc(d["svcTitle"])}</h2>
    <p class="ss">{esc(d["svcSub"])}</p>
    <div class="grid3">{svcs}</div>
  </div>
</section>

<section class="trust">
  <div class="wrap">
    <span class="lab">Why people call us back</span>
    <h2 class="st">{esc(d["trustTitle"])}</h2>
    <p class="ss">{esc(d["trustSub"])}</p>
    <div class="tgrid">{trust}</div>
  </div>
</section>

<section id="work" class="gal">
  <div class="wrap">
    <span class="lab">The work</span>
    <h2 class="st">{esc(d["galTitle"])}</h2>
    <div class="gg">
      {"".join(f'<figure><img src="{f[0]}" loading="lazy" alt="{esc(f[1])}"><figcaption><strong>{esc(f[2])}</strong>{esc(f[3])}</figcaption></figure>' for f in (figs or [("motion.svg",d["galAlt"][0],d["gal"][0][0],d["gal"][0][1]),("radius.svg",d["galAlt"][1],d["gal"][1][0],d["gal"][1][1]),("texture.svg",d["galAlt"][2],d["gal"][2][0],d["gal"][2][1])]))}
    </div>
    <p class="ask"><strong>This is where your job photos go.</strong> {esc(d["askLine"])}</p>
  </div>
</section>

<section id="area">
  <div class="wrap">
    <span class="lab">Where we work</span>
    <h2 class="st">{esc(d["areaTitle"])}</h2>
    <p class="ss">{esc(d["areaSub"])}</p>
    <div class="chips">{chips}</div>
  </div>
</section>

<section id="faq">
  <div class="wrap" style="max-width:820px">
    <span class="lab">Straight answers</span>
    <h2 class="st">Questions we get a lot</h2>
    <div style="margin-top:30px">{faqs}</div>
  </div>
</section>

<section id="contact">
  <div class="wrap">
    <span class="lab">Get in touch</span>
    <h2 class="st">{esc(d["contactTitle"])}</h2>
    <p class="ss">{esc(d["contactSub"])}</p>
    <div class="cwrap">
      <div class="callbox">
        <h3 style="color:#fff;font-size:1.3rem;margin-bottom:10px">Quickest way is a call</h3>
        <p style="color:#c2c9c6;font-size:.95rem">{esc(d["callLine"])}</p>
        <a class="big" href="tel:+1{tel}">{esc(d["phone"])}</a>
        <p style="color:#8d9793;font-size:.85rem;margin-top:18px">{esc(d["name"])} &middot; {esc(d["city"])}</p>
      </div>
      <form class="form" onsubmit="event.preventDefault();this.innerHTML='<p style=\\'padding:30px 0;text-align:center\\'>Thanks &mdash; we&rsquo;ll be in touch shortly.</p>'">
        <label for="n">Name</label><input id="n" name="name" placeholder="Your name">
        <label for="p">Phone</label><input id="p" name="phone" type="tel" placeholder="(563) 555-0100">
        <label for="s">What do you need?</label>
        <select id="s" name="service">{''.join(f'<option>{esc(x[0])}</option>' for x in d["services"])}<option>Something else</option></select>
        <label for="m">Details</label><textarea id="m" name="message" rows="4" placeholder="Tell us about the job"></textarea>
        <button type="submit">Send it over</button>
      </form>
    </div>
  </div>
</section>

<footer>{esc(d["name"])} &middot; {esc(d["city"])} &middot; <a href="tel:+1{tel}">{esc(d["phone"])}</a></footer>
<a class="sticky" href="tel:+1{tel}">Call {esc(d["phone"])}</a>

<div id="kobe">
  <button id="kobe-btn" aria-label="Chat with us">Chat</button>
  <div id="kobe-panel" hidden>
    <div id="kobe-head">Chat with {esc(d["markA"])}</div>
    <div id="kobe-body"><p>{esc(d["kobe"])}</p></div>
    <form id="kobe-form"><input placeholder="Type a message" aria-label="Message"><button>Send</button></form>
  </div>
</div>
<div class="spec-flag" style="position:fixed;left:14px;bottom:14px;z-index:930;background:rgba(0,0,0,.72);
  color:{A};font-size:.72rem;padding:6px 12px;border-radius:4px;border:1px solid {A}55">Speculative preview build &mdash; Urban Niche Co.</div>
<script>
(function(){{
 var o=new IntersectionObserver(function(es){{es.forEach(function(e){{if(e.isIntersecting)e.target.classList.add('on')}})}},{{threshold:.12}});
 document.querySelectorAll('.reveal').forEach(function(el){{o.observe(el)}});
 setTimeout(function(){{document.querySelectorAll('.reveal').forEach(function(el){{el.classList.add('on')}})}},2500);
 var b=document.getElementById('kobe-btn'),p=document.getElementById('kobe-panel');
 b.onclick=function(){{p.hidden=!p.hidden}};
 document.getElementById('kobe-form').onsubmit=function(e){{e.preventDefault();
  var i=this.querySelector('input'),d=document.getElementById('kobe-body');
  if(!i.value.trim())return;
  var u=document.createElement('p');u.style.cssText='margin:8px 0;font-weight:600';u.textContent=i.value;d.appendChild(u);i.value='';
  var r=document.createElement('p');r.style.cssText='margin:8px 0';r.textContent="Thanks \\u2014 we'll get right back to you. For anything urgent, give us a call.";
  setTimeout(function(){{d.appendChild(r);d.scrollTop=d.scrollHeight}},600)}};
}})();
</script>
</body>
</html>'''

if __name__ == "__main__":
    import os
    for d in json.load(open(sys.argv[1])):
        os.makedirs(f"/root/ubs/demo/{d['slug']}", exist_ok=True)
        open(f"/root/ubs/demo/{d['slug']}/index.html","w").write(build(d))
        print("built", d["slug"])
