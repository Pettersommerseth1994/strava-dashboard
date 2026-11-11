"""Konverterer Strava-eksport til public/data.json + public/act/<id>.json.

Bruk:  python3 -I scripts/build-data.py <eksportmappe> public
Krever: pip install fitdecode
Ingen GPS-spor, e-post, vekt eller personlige notater tas med.
"""
import csv, gzip, json, math, os, sys
from datetime import datetime
from multiprocessing import Pool

import fitdecode

MONTHS = {'jan.':1,'feb.':2,'mars':3,'apr.':4,'mai':5,'juni':6,'juli':7,'aug.':8,'sep.':9,'okt.':10,'nov.':11,'des.':12}
TARGETS = {'1k':1000,'1mi':1609.344,'3k':3000,'5k':5000,'10k':10000,'15k':15000,'hm':21097.5,'m':42195}
BEST_SPORTS = {'Løpetur','Langrenn','Rulleski','Sykkeltur','Gåtur'}
EXPORT = sys.argv[1]
OUT = sys.argv[2]

def num(v):
    v = (v or '').strip().replace(',', '.')
    try: return float(v)
    except ValueError: return None

def parse_date(s):
    d, m, y, t = s.replace(',', '').split()
    hh, mm, ss = t.split('.')
    return datetime(int(y), MONTHS[m], int(d.rstrip('.')), int(hh), int(mm), int(ss))

def vdot(dist_m, sec):
    t = sec / 60.0
    v = dist_m / t
    vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
    pct = 0.8 + 0.1894393 * math.exp(-0.012778 * t) + 0.2989558 * math.exp(-0.1932605 * t)
    return vo2 / pct

def best_efforts(tm, dist, hr):
    """Raskeste sammenhengende innsats for hver standarddistanse (to-peker med interpolasjon)."""
    n = len(dist)
    out = {}
    if n < 2: return out
    total = dist[-1]
    for key, D in TARGETS.items():
        if total < D: continue
        best = None; bhr = None; j = 0
        for i in range(1, n):
            target = dist[i] - D
            if target < dist[0]: continue
            while j + 1 < i and dist[j + 1] <= target: j += 1
            dd = dist[j + 1] - dist[j]
            ts = tm[j] + ((target - dist[j]) / dd * (tm[j + 1] - tm[j]) if dd > 0 else 0)
            dt = tm[i] - ts
            if dt > 0 and (best is None or dt < best):
                best = dt
                h = [x for x in hr[j:i + 1] if x]
                bhr = sum(h) / len(h) if h else None
        if best:
            out[key] = [round(best, 1), round(bhr) if bhr else None]
    return out

def parse_fit(path, sport):
    recs = []; sess = {}; zones = None; rhr = None; hrmax = None; threshold = None
    with gzip.open(path, 'rb') as g, fitdecode.FitReader(g) as r:
        for fr in r:
            if not isinstance(fr, fitdecode.FitDataMessage): continue
            if fr.name == 'record':
                d = {f.name: f.value for f in fr.fields}
                recs.append(d)
            elif fr.name == 'session':
                sess = {f.name: f.value for f in fr.fields}
            elif fr.name == 'user_profile':
                rhr = fr.get_value('resting_heart_rate', fallback=None) or rhr
            elif fr.name == 'time_in_zone':
                if fr.get_value('reference_mesg', fallback=None) == 'session':
                    z = fr.get_value('time_in_hr_zone', fallback=None)
                    if z:
                        zones = [round(x) for x in z]
                        hrmax = fr.get_value('max_heart_rate', fallback=None)
                        threshold = fr.get_value('threshold_heart_rate', fallback=None)
                        rhr = fr.get_value('resting_heart_rate', fallback=None) or rhr
    res = {}
    if sess.get('total_training_effect'): res['te'] = round(sess['total_training_effect'], 1)
    if sess.get('total_anaerobic_training_effect'): res['ate'] = round(sess['total_anaerobic_training_effect'], 1)
    if sess.get('avg_step_length'): res['stride'] = round(sess['avg_step_length'] / 1000, 2)
    if sess.get('avg_vertical_oscillation'): res['vo'] = round(sess['avg_vertical_oscillation'] / 10, 1)
    if sess.get('avg_stance_time'): res['gct'] = round(sess['avg_stance_time'])
    if sess.get('normalized_power'): res['np'] = sess['normalized_power']
    if rhr: res['rhr'] = rhr
    if hrmax: res['hrmax'] = hrmax
    if threshold: res['thr'] = threshold
    if zones:
        z = zones[:6]
        if len(zones) > 6: z[5] += sum(zones[6:])
        res['zones'] = z
    # tidsserier
    t0 = None; tm = []; dist = []; spd = []; hr = []; alt = []; cad = []; pw = []; cm = 0.0; prev = None
    for d in recs:
        ts = d.get('timestamp')
        if ts is None: continue
        if prev is not None: cm += min((ts - prev).total_seconds(), 10.0)
        prev = ts
        dd = d.get('distance')
        if dd is None and dist: dd = dist[-1]
        tm.append(cm); dist.append(dd if dd is not None else 0.0)
        hr.append(d.get('heart_rate')); alt.append(d.get('enhanced_altitude'))
        cad.append(d.get('cadence')); pw.append(d.get('power')); spd.append(d.get('enhanced_speed'))
    detail = None
    if len(tm) > 5:
        if sport in BEST_SPORTS and dist[-1] > 900:
            be = best_efforts(tm, dist, hr)
            if be: res['be'] = be
            if sport == 'Løpetur':
                vs = [vdot(TARGETS[k], v[0]) for k, v in be.items() if k in ('3k','5k','10k','15k','hm') and v[0] > 0]
                if vs: res['vdot'] = round(max(vs), 1)
        n = len(tm)
        step = max(1, math.ceil(n / 150))
        cols = {'t': [], 'd': [], 'v': [], 'hr': [], 'alt': [], 'cad': [], 'pw': []}
        for a in range(0, n, step):
            b = min(n, a + step)
            seg_t = tm[b - 1] - tm[a]
            cols['t'].append(round(tm[a]))
            cols['d'].append(round(dist[a]))
            if dist[-1] > 0:
                cols['v'].append(round((dist[b - 1] - dist[a]) / seg_t, 2) if seg_t > 0 else None)
            def avg(arr):
                x = [q for q in arr[a:b] if q is not None]
                return sum(x) / len(x) if x else None
            h = avg(hr); cols['hr'].append(round(h) if h is not None else None)
            al = avg(alt); cols['alt'].append(round(al, 1) if al is not None else None)
            c = avg(cad); cols['cad'].append(round(c) if c is not None else None)
            p = avg(pw); cols['pw'].append(round(p) if p is not None else None)
        detail = {k: v for k, v in cols.items() if any(x is not None for x in v)}
        # km-splitter
        if dist[-1] >= 1000:
            splits = []; nxt = 1000; j = 0; last_t = 0.0; last_a = alt[0]
            hs = []
            for i in range(1, n):
                if hr[i]: hs.append(hr[i])
                while dist[i] >= nxt:
                    dd = dist[i] - dist[i - 1]
                    f = (nxt - dist[i - 1]) / dd if dd > 0 else 1
                    t_at = tm[i - 1] + f * (tm[i] - tm[i - 1])
                    a_at = alt[i] if alt[i] is not None else last_a
                    splits.append([round(t_at - last_t, 1), round(sum(hs) / len(hs)) if hs else None,
                                   round(a_at - last_a) if (a_at is not None and last_a is not None) else None])
                    last_t = t_at; last_a = a_at; hs = []; nxt += 1000
            detail['splits'] = splits
    return res, detail

def work(args):
    aid, sport, fn = args
    path = os.path.join(EXPORT, fn)
    if not fn.endswith('.fit.gz') or not os.path.exists(path):
        return aid, {}, None
    try:
        return (aid,) + parse_fit(path, sport)
    except Exception as e:
        print('FEIL', aid, e, file=sys.stderr)
        return aid, {}, None

def trimp(a, ex):
    hrmax = ex.get('hrmax') or 206; rhr = ex.get('rhr') or 40
    mins = (a['mov'] or a['el']) / 60
    if a['t'] == 'Styrketrening': mins = a['el'] / 60
    if a['hr']:
        x = max(0.05, min(1.0, (a['hr'] - rhr) / (hrmax - rhr)))
    else:
        x = 0.5 if a['t'] in ('Styrketrening', 'Treningsøkt') else 0.6
    return round(mins * x * 0.64 * math.exp(1.92 * x), 1)

def main():
    rows = list(csv.reader(open(os.path.join(EXPORT, 'activities.csv'), encoding='utf-8')))[1:]
    jobs = [(r[0], r[3], r[12]) for r in rows]
    with Pool() as p:
        results = {aid: (ex, det) for aid, ex, det in p.imap_unordered(work, jobs, chunksize=8)}
    os.makedirs(os.path.join(OUT, 'act'), exist_ok=True)
    for f in os.listdir(os.path.join(OUT, 'act')): os.remove(os.path.join(OUT, 'act', f))
    out = []
    for r in rows:
        dt = parse_date(r[1])
        ex, det = results[r[0]]
        a = {
            'id': r[0], 'd': dt.strftime('%Y-%m-%dT%H:%M:%S'), 'n': r[2], 't': r[3],
            'dist': round(num(r[17]) or 0), 'mov': round(num(r[16]) or num(r[15]) or 0), 'el': round(num(r[15]) or 0),
            'up': round(num(r[20]) or 0), 'hr': num(r[31]), 'mhr': num(r[30]), 'cal': num(r[34]),
            'vmax': num(r[18]), 'w': num(r[33]), 'cad': num(r[29]), 're': num(r[8]), 'temp': num(r[56]),
            'gear': r[11] or r[68] or None, 'down': round(num(r[21]) or 0),
        }
        a.update(ex)
        a['load'] = trimp(a, ex)
        if det:
            a['det'] = 1
            json.dump(det, open(os.path.join(OUT, 'act', r[0] + '.json'), 'w'), separators=(',', ':'))
        out.append({k: v for k, v in a.items() if v not in (None, '')})
    out.sort(key=lambda a: a['d'])
    json.dump(out, open(os.path.join(OUT, 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'aktiviteter,', sum(1 for a in out if a.get('det')), 'med detaljer')

if __name__ == '__main__':
    main()
