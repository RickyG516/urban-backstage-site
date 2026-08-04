import re, os, json, sys
trade=sys.argv[1]; idx=open('/root/ubs/demo/index.html').read(); rows=[]
for d in sorted(os.listdir('/root/ubs/demo')):
    p=f'/root/ubs/demo/{d}/index.html'
    if not os.path.isfile(p): continue
    head=open(p).readline(); txt=open(p).read()
    tr=re.search(r'trade:\s*([a-z-]+)',head)
    if not tr or tr.group(1)!=trade: continue
    m=re.search(r'href="/demo/'+re.escape(d)+r'/"[^>]*>([^<]+)</a></td><td>[^<]*</td><td>([^<]+)</td>', idx)
    rows.append(dict(slug=d, name=m.group(1) if m else d, loc=m.group(2) if m else ''))
json.dump(rows, open(f'/tmp/{trade}.json','w'), indent=1)
print(trade, len(rows))
