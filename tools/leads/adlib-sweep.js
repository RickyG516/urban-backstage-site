await new Promise(r=>setTimeout(r,5000));
for(let i=0;i<3;i++){window.scrollTo(0,document.body.scrollHeight);await new Promise(r=>setTimeout(r,1500));}
const seen=new Set(); const out=[];
for(const d of [...document.querySelectorAll('div')]){
  const t=d.innerText||''; const ids=t.match(/Library ID: \d+/g); if(!ids||ids.length!==1) continue;
  if(seen.has(ids[0])) continue;
  if([...d.children].some(c=>(c.innerText||'').includes(ids[0]) && (c.innerText||'').length>200)) continue;
  seen.add(ids[0]);
  const lines=t.split('\n').map(s=>s.trim()).filter(Boolean);
  const si=lines.findIndex(l=>l==='Sponsored'); const adv=si>0?lines[si-1]:'?';
  const ext=[...d.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/l\.facebook\.com\/l\.php|^https?:\/\/(?!(www\.|l\.|web\.|m\.)?facebook\.com)/.test(h));
  const cta=lines.filter(l=>/^(Call now|Send message|Learn more|Get quote|Book now|Send WhatsApp message|Contact us|Sign up|Shop now|Get offer|Apply now)$/i.test(l));
  out.push([adv.slice(0,40),cta[0]||'-',ext.length?'L':'NOLINK',(lines.find(l=>/^Started running/.test(l))||'').replace('Started running on ','')]);
}
const u=new Set(); const rows=out.filter(r=>{const k=r[0]; if(u.has(k)) return false; u.add(k); return true;});
'ADS '+out.length+' uniq '+rows.length+'\n'+rows.map(r=>r.join(' ~ ')).join('\n')
