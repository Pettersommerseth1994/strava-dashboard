"""Konverterer Strava-eksport (activities.csv) til public/data.json.
Bruk: python3 -I scripts/build-data.py <sti/til/activities.csv> public/data.json
Ingen GPS-spor, e-post, vekt eller personlige notater tas med."""
import csv, json, sys
from datetime import datetime

MONTHS = {'jan.':1,'feb.':2,'mars':3,'apr.':4,'mai':5,'juni':6,'juli':7,'aug.':8,'sep.':9,'okt.':10,'nov.':11,'des.':12}

def num(v):
    v = (v or '').strip().replace(',', '.')
    try: return float(v)
    except ValueError: return None

def parse_date(s):
    d, m, y, t = s.replace(',', '').split()
    hh, mm, ss = t.split('.')
    return datetime(int(y), MONTHS[m], int(d.rstrip('.')), int(hh), int(mm), int(ss))

rows = list(csv.reader(open(sys.argv[1], encoding='utf-8')))[1:]
out = []
for r in rows:
    dt = parse_date(r[1])
    dist = num(r[17]) or 0
    moving = num(r[16]) or num(r[15]) or 0
    out.append({
        'id': r[0], 'd': dt.strftime('%Y-%m-%dT%H:%M:%S'), 'n': r[2], 't': r[3],
        'dist': round(dist), 'mov': round(moving), 'el': round(num(r[15]) or 0),
        'up': round(num(r[20]) or 0), 'hr': num(r[31]), 'mhr': num(r[30]),
        'cal': num(r[34]), 'vmax': num(r[18]), 'w': num(r[33]),
    })
out.sort(key=lambda a: a['d'])
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'aktiviteter')
