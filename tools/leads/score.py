#!/usr/bin/env python3
"""Score and rank a day's no-website contractor scan into the daily lead list.

Input: tools/leads/scan-YYYY-MM-DD.json, a list of rows from the Google Maps scan
(see tools/leads/RUNBOOK.md). Each row: name, stars, reviews, phone, category,
query, near, state, plus optional fields the runbook adds: ads (true/false),
verified (true when the place page confirmed NO website), fb (page URL),
address, photos, dup_hubspot (text), dup_status (text).

Output: tools/leads/list-YYYY-MM-DD.json (ranked) and a CSV next to it.

Score, 100 points, every piece measurable from the scan (Ricky, 2026-11-26):
  reviews   0-35  proof the business is real and busy
  ads       0-25  running Meta ads with no website = paying for attention they can't catch
  trade     0-15  high-ticket first
  contact   0-15  phone present (+ Facebook page found)
  rating    0-10  4.8+ = 10, 4.5+ = 7, 4.0+ = 4, below = 0 (no reviews = 0)
Tier A 70+, Tier B 50-69, Tier C below. Dups (already in HubSpot / demo pool) are
kept in the file with the flag but sorted to the bottom.
"""
import csv, json, re, sys, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))

TRADE = {  # category / query keyword -> (HubSpot trade_type, points)
    'roof': ('Roofer', 15), 'remodel': ('Remodeler', 15), 'general contractor': ('General Contractor', 15),
    'construction': ('General Contractor', 15), 'concrete': ('Concrete', 15), 'masonry': ('Masonry', 15),
    'excavat': ('Other', 13), 'siding': ('Other', 13), 'hvac': ('HVAC', 12), 'heating': ('HVAC', 12),
    'electric': ('Electrician', 12), 'plumb': ('Plumber', 12), 'landscap': ('Landscaper', 9),
    'lawn': ('Landscaper', 7), 'paint': ('Painter', 9), 'tree': ('Tree Service', 9), 'stump': ('Tree Service', 9),
    'logging': ('Tree Service', 9), 'pest': ('Pest Control', 6), 'pressure': ('Pressure Washing', 6),
    'floor': ('Flooring', 6), 'insulat': ('Insulation', 6), 'gutter': ('Other', 6), 'fenc': ('Other', 6),
}


def trade_of(row):
    text = (row.get('category', '') + ' ' + row.get('query', '') + ' ' + row.get('name', '')).lower()
    for k, v in TRADE.items():
        if k in text:
            return v
    return ('Other', 5)


def score(row):
    n = int(row.get('reviews') or 0)
    s = float(row.get('stars') or 0)
    rev = 35 if n >= 50 else 30 if n >= 25 else 24 if n >= 15 else 18 if n >= 8 else 10 if n >= 4 else 4 if n >= 1 else 0
    ads = 25 if row.get('ads') else 0
    trade, tp = trade_of(row)
    contact = (10 if row.get('phone') else 0) + (5 if row.get('fb') else 0)
    rating = 10 if s >= 4.8 else 7 if s >= 4.5 else 4 if s >= 4.0 else 0
    total = rev + ads + tp + contact + rating
    row['trade_type'] = trade
    row['score'] = total
    row['tier'] = 'A' if total >= 70 else 'B' if total >= 50 else 'C'
    return total


def main(date):
    src = os.path.join(HERE, f'scan-{date}.json')
    rows = json.load(open(src, encoding='utf-8'))
    for r in rows:
        score(r)
    dup = lambda r: bool(r.get('dup_hubspot') or r.get('dup_status'))
    rows.sort(key=lambda r: (dup(r), -r['score'], -int(r.get('reviews') or 0)))
    out = os.path.join(HERE, f'list-{date}.json')
    json.dump(rows, open(out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    cols = ['tier', 'score', 'name', 'trade_type', 'phone', 'stars', 'reviews', 'ads', 'near', 'state', 'address', 'fb', 'verified', 'dup_hubspot', 'dup_status', 'query']
    with open(out.replace('.json', '.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, '') for c in cols})
    tiers = {t: sum(1 for r in rows if r['tier'] == t and not dup(r)) for t in 'ABC'}
    print(f'{len(rows)} rows -> {out}  A={tiers["A"]} B={tiers["B"]} C={tiers["C"]} dups={sum(dup(r) for r in rows)}')
    for r in rows:
        print(f"{r['tier']} {r['score']:3d}  {r['name'][:40]:40s} {r['trade_type']:18s} {r.get('stars','')}/{r.get('reviews','')}  {r.get('phone','')}  {r.get('near','')}, {r.get('state','')}{'  ADS' if r.get('ads') else ''}{'  DUP:'+str(r.get('dup_hubspot') or r.get('dup_status')) if dup(r) else ''}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat())
