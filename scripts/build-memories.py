#!/usr/bin/env python3
"""
Lager publiserbare minner (bilder, videoer og kartspor) for fanen «Minner».

Bruk: python3 -I scripts/build-memories.py local-data public/minner
(kjør scripts/build-local.py først – den lager local-data/)

Krever macOS: sips (bilder), avconvert (video) og qlmanage (plakatbilder).

Skriver til public/minner/:
  media.json  – { aktivitets-id: [{ f, k: 'img'|'vid', w, h }] }
  img/        – bilder, maks 1600 px
  thumb/      – bilder, maks 480 px
  vid/        – videoer, H.264 innenfor 640 × 480 (sideforholdet beholdes)
  poster/     – plakatbilde per video (jpg)
  tracks.json – GPS-spor der de første og siste 400 m er fjernet (personvernsone)
"""
import json, math, os, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

PRIVACY_M = 400
MAX_PTS = 120


def run(*a):
    return subprocess.run(a, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)


def dims(path):
    out = run('sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path).stdout
    w = h = 0
    for line in out.splitlines():
        if 'pixelWidth' in line: w = int(line.split()[-1])
        if 'pixelHeight' in line: h = int(line.split()[-1])
    return w, h


def meters(a, b):
    r = math.pi / 180
    dla, dlo = (b[0] - a[0]) * r, (b[1] - a[1]) * r
    s = math.sin(dla / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin(dlo / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(s))


def trim(pts, m=PRIVACY_M):
    if len(pts) < 4: return []
    i, acc = 0, 0.0
    while i < len(pts) - 1 and acc < m: acc += meters(pts[i], pts[i + 1]); i += 1
    j, acc = len(pts) - 1, 0.0
    while j > i and acc < m: acc += meters(pts[j], pts[j - 1]); j -= 1
    return pts[i:j + 1] if j - i >= 2 else []


def simplify(pts, n=MAX_PTS):
    if len(pts) <= n: return pts
    step = (len(pts) - 1) / (n - 1)
    return [pts[round(i * step)] for i in range(n)]


def do_image(src, out, f):
    img = os.path.join(out, 'img', f)
    if not os.path.exists(img):
        run('sips', '-Z', '1600', '-s', 'formatOptions', '78', os.path.join(src, 'media', f), '--out', img)
    th = os.path.join(out, 'thumb', f)
    if not os.path.exists(th):
        run('sips', '-Z', '480', '-s', 'formatOptions', '75', img, '--out', th)
    return dims(img)


def do_video(src, out, f):
    vid = os.path.join(out, 'vid', f)
    if not os.path.exists(vid):
        run('avconvert', '-s', os.path.join(src, 'media', f), '-o', vid, '-p', 'Preset640x480', '--replace')
    poster = os.path.join(out, 'poster', f.rsplit('.', 1)[0] + '.jpg')
    if not os.path.exists(poster):
        with tempfile.TemporaryDirectory() as t:
            run('qlmanage', '-t', '-s', '960', '-o', t, vid)
            png = os.path.join(t, f + '.png')
            if os.path.exists(png):
                run('sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', png, '--out', poster)
    return dims(poster) if os.path.exists(poster) else (0, 0)


def main():
    src, out = sys.argv[1], sys.argv[2]
    for d in ('img', 'thumb', 'vid', 'poster'):
        os.makedirs(os.path.join(out, d), exist_ok=True)
    media = json.load(open(os.path.join(src, 'media.json')))
    tracks = json.load(open(os.path.join(src, 'tracks.json')))

    jobs = [(aid, m) for aid, items in media.items() for m in items]
    def work(job):
        aid, m = job
        w, h = (do_video if m['k'] == 'vid' else do_image)(src, out, m['f'])
        return aid, {**m, 'w': w, 'h': h}
    res = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for aid, m in ex.map(work, jobs):
            if m['w'] and m['h']:
                res.setdefault(aid, []).append(m)

    pub_tracks = {}
    for aid, pts in tracks.items():
        t = simplify(trim(pts))
        if len(t) >= 2:
            pub_tracks[aid] = [[round(a, 4), round(b, 4)] for a, b in t]

    json.dump(res, open(os.path.join(out, 'media.json'), 'w'), separators=(',', ':'))
    json.dump(pub_tracks, open(os.path.join(out, 'tracks.json'), 'w'), separators=(',', ':'))
    print(f'{sum(len(v) for v in res.values())} medier fra {len(res)} økter, {len(pub_tracks)} spor med personvernsone')


if __name__ == '__main__':
    main()
