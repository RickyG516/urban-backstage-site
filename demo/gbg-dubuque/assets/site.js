/* GBG Dubuque — shared site script (nav, reveal, light show engine, seal animation, forms) */
(function(){
'use strict';
var NS='http://www.w3.org/2000/svg';
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var CFG=window.GBG||{};
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function el(name,attrs,parent){var n=document.createElementNS(NS,name);for(var k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function mod(a,n){return ((a%n)+n)%n}

/* ---------- stars ---------- */
$$('[data-stars]').forEach(function(box){
  var n=+box.getAttribute('data-stars');
  for(var i=0;i<n;i++){
    var s=document.createElement('i'),z=Math.random()*1.6+.8;
    s.style.left=(Math.random()*100)+'%';s.style.top=(Math.random()*100)+'%';
    s.style.width=s.style.height=z+'px';
    s.style.animationDelay=(Math.random()*4)+'s';s.style.animationDuration=(3+Math.random()*4)+'s';
    box.appendChild(s);
  }
});
$$('.card .dots').forEach(function(dots){
  for(var d=0;d<14;d++){var i=document.createElement('i');i.style.left=(6+d*6.6)+'%';i.style.top=(74+Math.abs(Math.sin(d*.9))*10)+'px';i.style.animationDelay=(d*.18)+'s';dots.appendChild(i)}
});

/* ---------- nav + menu ---------- */
var nav=$('#nav'),menu=$('#menu'),menuBtn=$('#menuBtn');
function onScroll(){if(nav)nav.classList.toggle('solid',window.scrollY>40)}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();
function setMenu(open){
  document.body.classList.toggle('menu-open',open);
  menuBtn.setAttribute('aria-expanded',open?'true':'false');
  menuBtn.setAttribute('aria-label',open?'Close menu':'Open menu');
  if(open){menu.removeAttribute('inert');var f=$('a',menu);if(f)setTimeout(function(){f.focus({preventScroll:true})},60)}
  else{menu.setAttribute('inert','')}
}
if(menu&&menuBtn){
  menu.setAttribute('inert','');
  menuBtn.addEventListener('click',function(){setMenu(!document.body.classList.contains('menu-open'))});
  $$('a',menu).forEach(function(a){a.addEventListener('click',function(){setMenu(false)})});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.body.classList.contains('menu-open')){setMenu(false);menuBtn.focus()}});
}

/* ---------- reveal ---------- */
var io=new IntersectionObserver(function(entries){
  entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
},{threshold:.12});
$$('.rv').forEach(function(n){io.observe(n)});

/* ---------- pointer parallax (hero) ---------- */
var heroEl=$('.hero');
if(heroEl&&!reduce&&window.matchMedia('(pointer:fine)').matches){
  heroEl.addEventListener('mousemove',function(e){
    var r=heroEl.getBoundingClientRect();
    heroEl.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));
    heroEl.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3));
  });
}

/* =====================================================================
   HOUSE + LIGHT SHOW ENGINE
   ===================================================================== */
var ROOFS=[
  [[170,390],[250,310],[500,310],[580,390]],
  [[1430,390],[1350,310],[1100,310],[1020,390]],
  [[580,340],[800,150],[1020,340]]
];
var GUTTERS=[[[170,390],[580,390]],[[1020,390],[1430,390]]];

function buildHouse(svg,viewBox){
  svg.setAttribute('viewBox',viewBox||'0 0 1600 600');
  var bulbs=[];
  el('rect',{'class':'gnd',x:-3000,y:520,width:7600,height:600,fill:'url(#gg)'},svg);
  el('polygon',{'class':'roof',points:'560,344 800,138 1040,344'},svg);
  el('rect',{'class':'wall',x:580,y:340,width:440,height:180},svg);
  el('polygon',{'class':'roof',points:ROOFS[0].map(function(p){return p.join(',')}).join(' ')},svg);
  el('polygon',{'class':'roof',points:ROOFS[1].map(function(p){return p.join(',')}).join(' ')},svg);
  el('rect',{'class':'wall',x:170,y:390,width:410,height:130},svg);
  el('rect',{'class':'wall',x:1020,y:390,width:410,height:130},svg);
  [[580,340,440,180],[170,390,410,130],[1020,390,410,130]].forEach(function(r){
    el('rect',{x:r[0],y:r[1],width:r[2],height:r[3],fill:'url(#wallglow)'},svg);
  });
  el('rect',{'class':'wall',x:905,y:200,width:44,height:90},svg);
  el('rect',{'class':'trim',x:899,y:194,width:56,height:8},svg);
  var W=[[625,380,44,70],[705,380,44,70],[851,380,44,70],[931,380,44,70],[228,428,44,60],[328,428,44,60],[428,428,44,60]];
  var seed=3;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
  function win(x,y,w,h,off){
    el('rect',{'class':'win'+(off?' off':''),x:x,y:y,width:w,height:h,rx:2},svg);
    el('line',{'class':'mull',x1:x+w/2,y1:y,x2:x+w/2,y2:y+h},svg);
    el('line',{'class':'mull',x1:x,y1:y+h*.5,x2:x+w,y2:y+h*.5},svg);
  }
  W.forEach(function(w){win(w[0],w[1],w[2],w[3],rnd()>.62);if(w[0]<560)win(1600-w[0]-w[2],w[1],w[2],w[3],rnd()>.62)});
  el('circle',{'class':'win',cx:800,cy:242,r:22},svg);
  el('line',{'class':'mull',x1:778,y1:242,x2:822,y2:242},svg);
  el('line',{'class':'mull',x1:800,y1:220,x2:800,y2:264},svg);
  el('path',{'class':'door',d:'M772 520 V468 a28 28 0 0 1 56 0 V520 Z'},svg);
  el('rect',{'class':'trim',x:-3000,y:518,width:7600,height:2},svg);

  function along(pts){
    var out=[];
    for(var i=0;i<pts.length-1;i++){
      var a=pts[i],b=pts[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(len/22));
      for(var k=(i===0?0:1);k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);
    }
    return out;
  }
  var pts=[];
  ROOFS.concat(GUTTERS).forEach(function(seg){pts=pts.concat(along(seg))});
  pts.sort(function(a,b){return a[0]-b[0]});
  var glow=el('g',{filter:'url(#bloom)'},svg),crisp=el('g',{},svg);
  var n=pts.length;
  pts.forEach(function(p,idx){
    var g=el('circle',{cx:p[0],cy:p[1],r:11,fill:'#000',opacity:0},glow);
    var b=el('circle',{cx:p[0],cy:p[1],r:3.1,fill:'#000',opacity:0},crisp);
    bulbs.push({i:idx,n:n,x:p[0]/1600,ph:(Math.sin(idx*12.9898)*43758.5453)%1,g:g,b:b});
  });
  svg._bulbs=bulbs;
  return svg;
}

/* ----- colour helpers ----- */
function hex(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]}
function mix(a,b,u){return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]}
function hsl(h,s,l){h=mod(h,360)/360;var q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  function f(t){t=mod(t,1);if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}
  return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255]}
function palAt(pal,u){var n=pal.length;if(n===1)return pal[0];var x=mod(u,1)*n,i=Math.floor(x),f=x-i;return mix(pal[i%n],pal[(i+1)%n],f)}
function hash(n){n=Math.sin(n*127.1)*43758.5453;return n-Math.floor(n)}
function rgb(c){return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'}

var PATTERNS={
  solid:{label:'Solid',fn:function(b,t,P){return [P.pal[0],1]}},
  breathe:{label:'Breathe',fn:function(b,t,P){return [palAt(P.pal,b.x*.5+t*.04),.42+.58*(.5+.5*Math.sin(t*1.5))]}},
  chase:{label:'Chase',fn:function(b,t,P){var k=Math.floor(b.i/3-t*5);return [P.pal[mod(k,P.pal.length)],1]}},
  twinkle:{label:'Twinkle',fn:function(b,t,P){var s=Math.sin(t*2.2+b.ph*6.283);return [P.pal[b.i%P.pal.length],.16+.84*Math.pow(Math.max(0,s),2)]}},
  march:{label:'March',fn:function(b,t,P){var on=mod(b.i-Math.floor(t*9),4)===0;return [P.pal[Math.floor(b.i/4)%P.pal.length],on?1:.2]}},
  wipe:{label:'Color wipe',fn:function(b,t,P){var L=P.pal.length,ph=t*.28,cur=Math.floor(ph),fr=ph-cur,front=fr*1.35-.15;return [b.x<front?P.pal[mod(cur+1,L)]:P.pal[mod(cur,L)],1]}},
  alternate:{label:'Alternate',fn:function(b,t,P){return [P.pal[mod(b.i+Math.floor(t*1.6),2)%P.pal.length],1]}},
  pulse:{label:'Pulse from center',fn:function(b,t,P){var d=Math.abs(b.x-.5)*2,w=.5+.5*Math.sin(6.283*(t*.45-d*.8));return [palAt(P.pal,d*.7+t*.04),.22+.78*w]}},
  flow:{label:'Rainbow flow',fn:function(b,t,P){return [hsl(b.x*300-t*70,.9,.6),1]}},
  sparkle:{label:'Sparkle',fn:function(b,t,P){var f=hash(b.i*7.3+Math.floor(t*5));return f>.86?[P.pal[1%P.pal.length],1]:[P.pal[0],.55]}}
};

var THEMES=[
  {id:'warm',name:'Warm Welcome',pal:['#ffd9a0','#ffc470'],pat:'breathe',spd:.6},
  {id:'holiday',name:'Classic Holiday',pal:['#ff3b30','#2fd56f','#ffd9a0'],pat:'chase',spd:1},
  {id:'frost',name:'Winter Frost',pal:['#e3edff','#8fc4ff','#ffffff'],pat:'twinkle',spd:1},
  {id:'july',name:'Fourth of July',pal:['#ff3b3b','#ffffff','#3d7bff'],pat:'march',spd:1.1},
  {id:'fall',name:'Fall Harvest',pal:['#ff7a18','#ffb13d','#c2371c'],pat:'wipe',spd:.8},
  {id:'halloween',name:'Halloween',pal:['#ff7a18','#a24bff'],pat:'alternate',spd:.8},
  {id:'valentine',name:'Valentine',pal:['#ff4d8d','#ff2a44','#ffc0d6'],pat:'pulse',spd:.9},
  {id:'stpat',name:"St. Paddy's",pal:['#2fd56f','#ffd24a','#ffffff'],pat:'chase',spd:1.4},
  {id:'gameday',name:'Game Day',pal:['#ffc72c','#ffffff','#ffc72c'],pat:'sparkle',spd:1.4},
  {id:'party',name:'Party Mode',pal:['#ff3b30','#3d7bff','#2fd56f'],pat:'flow',spd:1.2}
];
function themeById(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return THEMES[i];return THEMES[0]}
function seasonalId(){
  var m=new Date().getMonth();
  if(m===11||m===0)return 'holiday';
  if(m===1)return 'valentine';
  if(m===2)return 'stpat';
  if(m===5||m===6)return 'july';
  if(m===8||m===9)return 'fall';
  if(m===10)return 'halloween';
  return 'warm';
}
function toPal(list){return list.map(function(c){return typeof c==='string'?hex(c):c})}

function LightShow(svg,opts){
  opts=opts||{};
  this.svg=svg;this.bulbs=svg._bulbs;
  this.spd=1;this.T=0;this.day=false;this.running=false;this.visible=true;this.raf=0;
  this.born=performance.now();this.last=performance.now();
  this.prevCol=[];this.prevBri=[];this.curCol=[];this.curBri=[];
  this.xf=1;this.xfStart=0;
  this.onTheme=opts.onTheme||null;
  this.show=null;this.showIdx=0;this.showMs=opts.showMs||9000;this.showTimer=0;
  this.cfg=null;
  this.themeIdx=0;
  var self=this;
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){self.visible=en[0].isIntersecting;if(self.visible)self.start();else self.stop()},{threshold:0}).observe(svg);
  }
}
LightShow.prototype.set=function(cfg,silent){
  // freeze previous frame for crossfade
  this.prevCol=this.curCol.slice();this.prevBri=this.curBri.slice();
  this.xf=0;this.xfStart=performance.now();
  this.cfg={id:cfg.id||'custom',name:cfg.name||'Custom',pal:cfg.pal,rgb:toPal(cfg.pal),pat:cfg.pat,spd:cfg.spd};
  this.spd=cfg.spd;
  if(!silent&&this.onTheme)this.onTheme(this.cfg);
  if(reduce)this.renderOnce();
};
LightShow.prototype.setTheme=function(t,silent){this.set({id:t.id,name:t.name,pal:t.pal,pat:t.pat,spd:t.spd},silent)};
LightShow.prototype.setDay=function(on){this.day=on;if(reduce||!this.running)this.renderOnce()};
LightShow.prototype.startShow=function(ms){
  var self=this;this.stopShow();this.showMs=ms||this.showMs;
  this.show=true;
  this.showTimer=setInterval(function(){
    if(!self.visible)return;
    self.themeIdx=(self.themeIdx+1)%THEMES.length;
    self.setTheme(THEMES[self.themeIdx]);
  },this.showMs);
};
LightShow.prototype.stopShow=function(){this.show=false;clearInterval(this.showTimer)};
LightShow.prototype.frame=function(now,tOverride){
  var cfg=this.cfg;if(!cfg)return;
  var pat=PATTERNS[cfg.pat]||PATTERNS.solid,P={pal:cfg.rgb};
  var T=tOverride!=null?tOverride:this.T;
  var el_=(now-this.born)/1000;
  var u=this.xf>=1?1:clamp((now-this.xfStart)/1100,0,1);
  if(u>=1)this.xf=1;
  var ease=u*u*(3-2*u);
  var bl=this.bulbs;
  for(var k=0;k<bl.length;k++){
    var b=bl[k],r=pat.fn(b,T,P),c=r[0],br=r[1];
    if(u<1&&this.prevCol[k]){c=mix(this.prevCol[k],c,ease);br=this.prevBri[k]+(br-this.prevBri[k])*ease}
    // ignition sweep on first load
    var ig=tOverride!=null?1:clamp((el_-.35-b.x*1.4)/.45,0,1);
    br*=ig;
    this.curCol[k]=c;this.curBri[k]=br;
    var col,gl;
    if(this.day){col='rgb(138,135,128)';br=.4*ig;gl=0}
    else{col=rgb(c);gl=br*.6}
    b.b.setAttribute('fill',col);b.b.setAttribute('opacity',br.toFixed(3));
    b.g.setAttribute('fill',col);b.g.setAttribute('opacity',gl.toFixed(3));
  }
  var mid=bl[bl.length>>1];
  if(mid&&!this.day)this.svg.style.setProperty('--lc',rgb(this.curCol[bl.length>>1]||[255,217,160]));
};
LightShow.prototype.renderOnce=function(){this.frame(performance.now()+5000,3)};
LightShow.prototype.loop=function(){
  var self=this;
  this.raf=requestAnimationFrame(function tick(){
    if(!self.running)return;
    var now=performance.now();
    if(now-self.last>=33){var dt=(now-self.last)/1000;self.last=now;self.T+=dt*self.spd;self.frame(now)}
    self.raf=requestAnimationFrame(tick);
  });
};
LightShow.prototype.start=function(){
  if(reduce){this.renderOnce();return}
  if(this.running)return;this.running=true;this.last=performance.now();this.loop();
};
LightShow.prototype.stop=function(){this.running=false;cancelAnimationFrame(this.raf)};

/* ----- hero + studio wiring ----- */
CFG.shows=CFG.shows||[];window.GBG=CFG;
var heroSvg=$('#heroHouse');
if(heroSvg){
  buildHouse(heroSvg,window.innerWidth<700?'230 90 1140 440':'110 70 1380 480');
  var heroNow=$('#heroNow');
  var hs=new LightShow(heroSvg,{onTheme:function(c){if(heroNow)heroNow.textContent=c.name}});
  var start=seasonalId();
  hs.themeIdx=THEMES.indexOf(themeById(start));
  hs.setTheme(themeById(start),false);
  hs.start();hs.startShow(9000);CFG.shows.push(hs);
}

var studioSvg=$('#demoHouse');
if(studioSvg){
  buildHouse(studioSvg,'90 60 1420 500');
  var stage=$('#stage'),themesBox=$('#themes'),patSel=$('#pattern'),spdIn=$('#speed'),spdOut=$('#speedVal'),
      cols=[$('#c0'),$('#c1'),$('#c2')],showBtn=$('#showBtn'),dayBtn=$('#dayBtn'),nowEl=$('#studioNow'),bookLook=$('#bookLook');
  var ss=new LightShow(studioSvg,{onTheme:function(c){syncUI(c)}});
  var current=null,chipEls={};
  Object.keys(PATTERNS).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=PATTERNS[k].label;patSel.appendChild(o)});
  THEMES.forEach(function(t){
    var b=document.createElement('button');b.type='button';b.className='chip';b.setAttribute('aria-pressed','false');
    var sw=document.createElement('span');sw.className='sw';
    sw.style.setProperty('--sw',t.pal.length>1?'linear-gradient(90deg,'+t.pal.join(',')+')':t.pal[0]);
    b.appendChild(sw);b.appendChild(document.createTextNode(t.name));
    b.addEventListener('click',function(){userTouched();ss.themeIdx=THEMES.indexOf(t);ss.setTheme(t)});
    themesBox.appendChild(b);chipEls[t.id]=b;
  });
  function pad3(pal){var o=[];for(var i=0;i<3;i++)o.push(pal[i%pal.length]);return o}
  function fullHex(c){if(c.charAt(0)!=='#')return '#ffffff';if(c.length===4)return '#'+c.substr(1).split('').map(function(x){return x+x}).join('');return c}
  function syncUI(c){
    current=c;
    Object.keys(chipEls).forEach(function(id){chipEls[id].setAttribute('aria-pressed',id===c.id?'true':'false')});
    patSel.value=c.pat;spdIn.value=c.spd;spdOut.textContent=(+c.spd).toFixed(1)+'x';
    pad3(c.pal).forEach(function(h,i){cols[i].value=fullHex(h)});
    nowEl.textContent=c.name;
    var msg='I would like the “'+c.name+'” look ('+PATTERNS[c.pat].label.toLowerCase()+', '+(+c.spd).toFixed(1)+'x speed, colors '+c.pal.join(' / ')+') on my home.';
    if(bookLook)bookLook.setAttribute('data-msg',msg);
  }
  function userTouched(){ss.stopShow();showBtn.setAttribute('aria-pressed','false')}
  function custom(){
    userTouched();
    var pal=cols.map(function(c){return c.value});
    ss.set({id:'custom',name:'Custom',pal:pal,pat:patSel.value,spd:+spdIn.value});
  }
  patSel.addEventListener('change',custom);
  spdIn.addEventListener('input',custom);
  cols.forEach(function(c){c.addEventListener('input',custom)});
  showBtn.addEventListener('click',function(){
    var on=showBtn.getAttribute('aria-pressed')!=='true';
    showBtn.setAttribute('aria-pressed',on?'true':'false');
    if(on){ss.startShow(7000)}else ss.stopShow();
  });
  dayBtn.addEventListener('click',function(){
    var on=dayBtn.getAttribute('aria-pressed')!=='true';
    dayBtn.setAttribute('aria-pressed',on?'true':'false');
    dayBtn.textContent=on?'View by night':'View by day';
    stage.classList.toggle('day',on);studioSvg.classList.toggle('day',on);ss.setDay(on);
  });
  if(bookLook)bookLook.addEventListener('click',function(){
    var f=$('#quote');if(!f)return;
    var m=f.elements.message;if(m&&bookLook.getAttribute('data-msg'))m.value=bookLook.getAttribute('data-msg');
    if(f.elements.service)f.elements.service.value='Permanent Lights';
  });
  var first=themeById(seasonalId());ss.themeIdx=THEMES.indexOf(first);
  ss.setTheme(first);ss.start();CFG.shows.push(ss);
  if(!reduce){ss.startShow(8000);showBtn.setAttribute('aria-pressed','true')}
}

/* =====================================================================
   DRIVEWAY SEALING ANIMATION
   ===================================================================== */
var seal=$('#seal');
if(seal){
  var Y0=120,H=400;
  var cpC=$('#cpClean rect',seal),cpR=$('#cpRepair rect',seal),cpS=$('#cpSeal rect',seal);
  var bC=$('#barClean',seal),bR=$('#barRepair',seal),bS=$('#barSeal',seal);
  var rng=$('#sealRange'),stageLbl=$('#sealStage'),chips=$$('.stepchips .chip',seal);
  var t=reduce?1:0,auto=!reduce,hold=0,resumeAt=0,visible=true,lastT=performance.now(),raf=0;
  var NAMES=['Before','Step 1 · Clean','Step 2 · Repair','Step 3 · Seal','After'];
  function bar(b,p){
    if(p<=0||p>=1){b.setAttribute('opacity',0);return}
    b.setAttribute('opacity',1);b.setAttribute('transform','translate(0,'+(Y0+p*H-4)+')');
  }
  function render(){
    var p1=clamp(t/.34,0,1),p2=clamp((t-.26)/.34,0,1),p3=clamp((t-.52)/.48,0,1);
    cpC.setAttribute('height',p1*H);cpR.setAttribute('height',p2*H);cpS.setAttribute('height',p3*H);
    bar(bC,p1);bar(bR,p2);bar(bS,p3);
    var stage=t<=0?0:t<.34?1:t<.6?2:t<1?3:4;
    stageLbl.textContent=NAMES[stage];
    chips.forEach(function(c,i){c.setAttribute('aria-pressed',(stage===i+1)?'true':'false')});
    rng.value=Math.round(t*100);
  }
  function tick(now){
    var dt=(now-lastT)/1000;lastT=now;
    if(!auto&&resumeAt&&now>resumeAt){auto=true;resumeAt=0}
    if(auto&&visible){
      if(t>=1){hold+=dt;if(hold>2.4){t=0;hold=0}}
      else t=Math.min(1,t+dt/10);
    }
    render();
    raf=requestAnimationFrame(tick);
  }
  rng.addEventListener('input',function(){auto=false;t=rng.value/100;resumeAt=performance.now()+6000;render()});
  chips.forEach(function(c,i){c.addEventListener('click',function(){auto=false;t=[.17,.43,.8][i];resumeAt=performance.now()+7000;render()})});
  if('IntersectionObserver' in window){new IntersectionObserver(function(en){visible=en[0].isIntersecting},{threshold:.1}).observe(seal)}
  render();
  if(!reduce)raf=requestAnimationFrame(tick);
}

/* =====================================================================
   FORMS (Netlify Forms when deployed there; mailto fallback everywhere else)
   ===================================================================== */
var qs=new URLSearchParams(location.search);
$$('form[data-lead]').forEach(function(form){
  var svc=qs.get('service');if(svc&&form.elements.service){for(var i=0;i<form.elements.service.options.length;i++)if(form.elements.service.options[i].value===svc)form.elements.service.value=svc}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(form.elements['bot-field']&&form.elements['bot-field'].value)return;
    var fd=new FormData(form),body=new URLSearchParams(fd).toString();
    var btn=$('button[type=submit]',form);if(btn){btn.disabled=true;btn.textContent='Sending...'}
    function done(){form.classList.add('sent');var ok=$('.ok',form);if(ok){ok.setAttribute('tabindex','-1');ok.focus()}}
    function fallback(){
      var lines=[];fd.forEach(function(v,k){if(k!=='form-name'&&k!=='bot-field'&&v)lines.push(k+': '+v)});
      var subj=(form.getAttribute('data-subject')||'Website inquiry')+(form.elements.service?': '+form.elements.service.value:'');
      window.location.href='mailto:'+(CFG.email||'info@gbgdubuque.com')+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(lines.join('\n'));
      if(btn){btn.disabled=false;btn.textContent=btn.getAttribute('data-label')||'Send'}
    }
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
      .then(function(r){if(!r.ok)throw new Error('x');done()})
      .catch(fallback);
  });
});
$$('[data-service]').forEach(function(a){
  a.addEventListener('click',function(){var f=$('#quote');if(f&&f.elements.service)f.elements.service.value=a.getAttribute('data-service')});
});
})();
