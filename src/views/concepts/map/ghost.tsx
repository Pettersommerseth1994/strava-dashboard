import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Ghost, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { type Activity, type Detail, fmtClock, fmtDate, fmtDur, fmtInt, fmtKm } from '@/lib/data'
import { meters, trimPrivacy, useLocalData, type LatLon, type TrackMap } from '../local'
import { Loading, MapBox, PrivacyToggle, RouteThumb, cumDist, interp, pointAt, rgb, useDetail, useLeafletMap, usePalette, withTracks } from './shared'

type Group = { key: string; acts: Activity[]; rep: LatLon[] }

/** Grupperer økter som går (nesten) samme rute: start, midtpunkt og slutt innen ~300 m og lik distanse ±10 % */
function groupRoutes(acts: Activity[], tracks: TrackMap): Group[] {
  const groups: (Group & { s: LatLon; m: LatLon; e: LatLon; dist: number; t: string })[] = []
  for (const a of [...acts].sort((x, y) => (x.d < y.d ? -1 : 1))) {
    const tr = trimPrivacy(tracks[a.id])
    if (tr.length < 6 || a.dist < 2000) continue
    const cum = cumDist(tr)
    const s = tr[0], e = tr[tr.length - 1], m = pointAt(tr, cum, 0.5)
    const g = groups.find((g) => g.t === a.t && Math.abs(g.dist - a.dist) / g.dist <= 0.1 && meters(g.s, s) < 300 && meters(g.e, e) < 300 && meters(g.m, m) < 400)
    if (g) g.acts.push(a)
    else groups.push({ key: a.id, acts: [a], rep: tracks[a.id], s, m, e, dist: a.dist, t: a.t })
  }
  return groups.filter((g) => g.acts.length >= 2).sort((a, b) => b.acts.length - a.acts.length)
}

const distAt = (det: Detail | null, a: Activity, s: number) => Math.min(a.dist, det?.d?.length ? interp(det.t, det.d, s) ?? 0 : (s / (a.mov || 1)) * a.dist)
const timeAtDist = (det: Detail | null, a: Activity, d: number) => (det?.d?.length ? interp(det.d, det.t, d) ?? 0 : (d / (a.dist || 1)) * a.mov)

export function GhostRace() {
  const d = useLocalData()
  if (!d) return <Loading />
  return <Inner tracks={d.tracks} />
}

function Inner({ tracks }: { tracks: TrackMap }) {
  const { all } = useStore()
  const groups = useMemo(() => groupRoutes(withTracks(all, tracks), tracks), [all, tracks])
  const [gk, setGk] = useState(groups[0]?.key ?? '')
  const g = groups.find((x) => x.key === gk) ?? groups[0]
  const byTime = useMemo(() => (g ? [...g.acts].sort((a, b) => a.mov - b.mov) : []), [g])
  const latest = g ? [...g.acts].sort((a, b) => (a.d < b.d ? 1 : -1))[0] : undefined
  const [youId, setYou] = useState('')
  const [ghostId, setGhost] = useState('')
  useEffect(() => {
    if (!g || !latest) return
    setYou(latest.id)
    setGhost((byTime.find((x) => x.id !== latest.id) ?? byTime[0]).id)
  }, [gk]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!groups.length) return <p className="text-muted-foreground py-10 text-center text-sm">Fant ingen ruter du har gått flere ganger.</p>
  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          {groups.slice(0, 12).map((x) => {
            const last = [...x.acts].sort((a, b) => (a.d < b.d ? 1 : -1))[0]
            return (
              <button key={x.key} onClick={() => setGk(x.key)} className={`flex w-28 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${x.key === g?.key ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'hover:bg-muted'}`}>
                <RouteThumb pts={trimPrivacy(x.rep)} size={52} color={x.key === g?.key ? 'var(--brand)' : 'var(--muted-foreground)'} />
                <span className="w-full truncate text-center text-[11px] font-medium">{last.n}</span>
                <span className="text-muted-foreground text-[10px] tabular-nums">{x.acts.length}× · {fmtKm(last.dist, 1)} km</span>
              </button>
            )
          })}
        </div>
      </div>
      {g && g.acts.some((a) => a.id === youId) && g.acts.some((a) => a.id === ghostId) && <Race key={`${youId}-${ghostId}`} g={g} byTime={byTime} youId={youId} ghostId={ghostId} setYou={setYou} setGhost={setGhost} tracks={tracks} />}
    </div>
  )
}

function Race({ g, byTime, youId, ghostId, setYou, setGhost, tracks }: { g: Group; byTime: Activity[]; youId: string; ghostId: string; setYou: (s: string) => void; setGhost: (s: string) => void; tracks: TrackMap }) {
  const you = g.acts.find((a) => a.id === youId)!, ghost = g.acts.find((a) => a.id === ghostId)!
  const dy = useDetail(youId), dg = useDetail(ghostId)
  const [privacy, setPrivacy] = useState(true)
  const [s, setS] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(30)
  const tmax = Math.max(you.mov, ghost.mov, dy?.t.at(-1) ?? 0, dg?.t.at(-1) ?? 0)
  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const refs = useRef<{ g?: L.LayerGroup; you?: L.CircleMarker; ghost?: L.CircleMarker }>({})

  const geo = useMemo(() => [you, ghost].map((a) => {
    const full = tracks[a.id], cum = cumDist(full), total = cum.at(-1) || 1
    const tr = privacy ? trimPrivacy(full) : full
    const i0 = tr.length ? full.indexOf(tr[0]) : 0, i1 = tr.length ? i0 + tr.length - 1 : 0
    return { full, cum, total, i0, i1, f0: cum[i0] / total, f1: cum[i1] / total }
  }), [you, ghost, tracks, privacy])

  useEffect(() => {
    if (!map) return
    refs.current.g?.remove()
    const lg = L.layerGroup().addTo(map), renderer = L.canvas()
    const [y, gh] = geo
    L.polyline(gh.full.slice(gh.i0, gh.i1 + 1), { renderer, color: rgb(pal.fg, 0.25), weight: 4, dashArray: '4 6', interactive: false }).addTo(lg)
    L.polyline(y.full.slice(y.i0, y.i1 + 1), { renderer, color: rgb(pal.brand, 0.45), weight: 5, interactive: false }).addTo(lg)
    refs.current = {
      g: lg,
      ghost: L.circleMarker(gh.full[gh.i0], { renderer, radius: 8, color: rgb(pal.fg), weight: 2, dashArray: '2 3', fillColor: rgb(pal.fg), fillOpacity: 0.35, opacity: 0, interactive: false }).addTo(lg),
      you: L.circleMarker(y.full[y.i0], { renderer, radius: 8, color: '#fff', weight: 3, fillColor: rgb(pal.brand), fillOpacity: 1, opacity: 0, interactive: false }).addTo(lg),
    }
    map.fitBounds(L.latLngBounds(y.full.slice(y.i0, y.i1 + 1)), { padding: [28, 28] })
  }, [map, geo, pal])

  const dYou = distAt(dy, you, s), dGhost = distAt(dg, ghost, s)
  useEffect(() => {
    const place = (m: L.CircleMarker | undefined, gi: (typeof geo)[number], d: number, a: Activity, fill: number) => {
      if (!m) return
      const f = d / (a.dist || 1)
      const inside = f >= gi.f0 && f <= gi.f1
      m.setLatLng(pointAt(gi.full, gi.cum, f)).setStyle({ opacity: inside ? 1 : 0, fillOpacity: inside ? fill : 0 })
    }
    place(refs.current.ghost, geo[1], dGhost, ghost, 0.35)
    place(refs.current.you, geo[0], dYou, you, 1)
  }, [dYou, dGhost, geo, you, ghost])

  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now
      setS((v) => { const n = v + dt * speed; if (n >= tmax) { setPlaying(false); return tmax } return n })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, tmax])

  // ledelse: sammenlign andel av ruta, uttrykt i meter langs «din» distanse
  const fy = dYou / (you.dist || 1), fg = dGhost / (ghost.dist || 1)
  const gapM = (fy - fg) * you.dist
  const leadIsYou = fy > fg
  const trailer = leadIsYou ? ghost : you
  const gapS = Math.max(0, timeAtDist(leadIsYou ? dg : dy, trailer, Math.max(fy, fg) * trailer.dist) - s)
  const done = s >= tmax
  const winner = you.mov < ghost.mov ? 'Du' : 'Spøkelset'
  const opts = byTime.map((a) => ({ value: a.id, label: `${fmtDate(a.d)} · ${fmtDur(a.mov)}` }))

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium"><i className="size-2.5 rounded-full bg-[var(--brand)]" />Du</span>
          <Select value={youId} onValueChange={(v) => v && setYou(v)} items={opts}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium"><Ghost className="size-3.5" />Spøkelse</span>
          <Select value={ghostId} onValueChange={(v) => v && setGhost(v)} items={opts}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </div>
      <div className={`rounded-xl border px-4 py-3 ${gapM >= 0 ? 'border-[var(--brand)]/40 bg-[var(--brand)]/10' : 'bg-muted/40'}`}>
        <p className="text-lg leading-tight font-semibold tabular-nums">
          {s === 0 ? 'Klar … trykk start' : done ? `${winner} vant med ${fmtClock(Math.abs(you.mov - ghost.mov))}` : Math.abs(gapM) < 5 ? 'Helt likt!' : gapM > 0 ? `Du leder med ${fmtInt(gapM)} m` : `Spøkelset leder med ${fmtInt(-gapM)} m`}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {s > 0 && !done && Math.abs(gapM) >= 5 ? `≈ ${fmtClock(gapS)} · ` : ''}{fmtClock(s)} · du {fmtKm(dYou, 2)} km · spøkelset {fmtKm(dGhost, 2)} km
        </p>
      </div>
      <MapBox boxRef={box} />
      <div className="flex items-center gap-2">
        <Button size="icon" onClick={() => { if (done) setS(0); setPlaying(!playing) }} aria-label={playing ? 'Pause' : 'Start'}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="outline" onClick={() => { setS(0); setPlaying(false) }} aria-label="Start på nytt"><RotateCcw /></Button>
        <input type="range" min={0} max={tmax} step={1} value={s} onChange={(e) => setS(+e.target.value)} aria-label="Spol" className="h-10 min-w-0 flex-1 cursor-pointer accent-[var(--brand)]" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup value={[String(speed)]} onValueChange={(v) => v[0] && setSpeed(+v[0])} variant="outline" size="sm">
          {[10, 30, 60].map((x) => <ToggleGroupItem key={x} value={String(x)}>{x}×</ToggleGroupItem>)}
        </ToggleGroup>
        <PrivacyToggle on={privacy} set={setPrivacy} />
      </div>
      <p className="text-muted-foreground text-xs">{g.acts.length} økter på denne ruta · raskeste {fmtDur(byTime[0].mov)} ({fmtDate(byTime[0].d)}) · tregeste {fmtDur(byTime.at(-1)!.mov)}</p>
    </div>
  )
}
