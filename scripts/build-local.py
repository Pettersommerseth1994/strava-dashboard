#!/usr/bin/env python3
"""
Lager LOKALE data for konseptene (bilder, videoer og GPS-spor).

Bruk: python3 -I scripts/build-local.py <eksportmappe> local-data

Skriver til local-data/ (ligger i .gitignore og kopieres aldri til dist):
  media.json   – { aktivitets-id: [{ "f": filnavn, "k": "img" | "vid" }] }
  tracks.json  – { aktivitets-id: [[lat, lon], ...] }  (maks 160 punkter per økt)
  thumbs/      – nedskalerte bilder (480 px) laget med macOS sips
Originalfilene (bilder og videoer) serveres rett fra eksportmappen av dev-serveren.

Krever: pip install fitdecode
"""
import csv, gzip, json, os, subprocess, sys
from multiprocessing import Pool

import fitdecode

SEMI = 180 / 2**31
MAX_PTS = 160


def simplify(pts, n=MAX_PTS):
    if len(pts) <= n:
        return pts
    step = (len(pts) - 1) / (n - 1)
    return [pts[round(i * step)] for i in range(n)]


def read_track(args):
    aid, path = args
    pts = []
    try:
        opener = gzip.open if path.endswith('.gz') else open
        if '.fit' in path:
            with opener(path, 'rb') as g, fitdecode.FitReader(g) as r:
                for fr in r:
                    if not isinstance(fr, fitdecode.FitDataMessage) or fr.name != 'record':
                        continue
                    if not (fr.has_field('position_lat') and fr.has_field('position_long')):
                        continue
                    la, lo = fr.get_value('position_lat'), fr.get_value('position_long')
                    if la is None or lo is None:
                        continue
                    pts.append([round(la * SEMI, 5), round(lo * SEMI, 5)])
        elif '.gpx' in path:
            import re
            with opener(path, 'rt', encoding='utf-8', errors='ignore') as f:
                for m in re.finditer(r'lat="([-\d.]+)"\s+lon="([-\d.]+)"', f.read()):
                    pts.append([round(float(m.group(1)), 5), round(float(m.group(2)), 5)])
    except Exception:
        return aid, None
    pts = [p for p in pts if abs(p[0]) > 0.01 or abs(p[1]) > 0.01]
    return aid, simplify(pts) if len(pts) >= 2 else None


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(out, 'thumbs'), exist_ok=True)
    rows = list(csv.reader(open(os.path.join(src, 'activities.csv'), encoding='utf-8')))[1:]

    media, jobs = {}, []
    for r in rows:
        aid = r[0]
        if len(r) > 102 and r[102].strip():
            files = [m.split('/')[-1] for m in r[102].split('|') if m.strip()]
            files = [f for f in files if os.path.exists(os.path.join(src, 'media', f))]
            if files:
                media[aid] = [{'f': f, 'k': 'vid' if f.lower().endswith(('.mp4', '.mov')) else 'img'} for f in files]
        if len(r) > 12 and r[12].strip():
            jobs.append((aid, os.path.join(src, r[12])))

    with Pool() as p:
        tracks = {aid: t for aid, t in p.map(read_track, jobs, chunksize=16) if t}

    for items in media.values():
        for m in items:
            if m['k'] == 'img':
                dst = os.path.join(out, 'thumbs', m['f'])
                if not os.path.exists(dst):
                    subprocess.run(['sips', '-Z', '480', os.path.join(src, 'media', m['f']), '--out', dst],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    json.dump(media, open(os.path.join(out, 'media.json'), 'w'), separators=(',', ':'))
    json.dump(tracks, open(os.path.join(out, 'tracks.json'), 'w'), separators=(',', ':'))
    n_img = sum(m['k'] == 'img' for v in media.values() for m in v)
    n_vid = sum(m['k'] == 'vid' for v in media.values() for m in v)
    print(f'{len(media)} økter med media ({n_img} bilder, {n_vid} videoer), {len(tracks)} GPS-spor')


if __name__ == '__main__':
    main()
