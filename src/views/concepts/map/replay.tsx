import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CalendarClock, ExternalLink, Pause, Play, RotateCcw, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { type Activity, type Detail, addDays, daysBetween, fmtClock, fmtDate, fmtInt, fmtKm, fmtNum, fmtPaceSec, isFoot, todayStr } from '@/lib/data'
import { thumbUrl, useLocalData, type MediaMap, type TrackMap } from '../local'
import { Loading, MapBox, PrivacyToggle, cumDist, interp, pointAt, rgb, trackOf, useDetail, useLeafletMap, usePalette, withTracks } from './shared'

const SPEEDS = [1, 10, 30, 60]

export function Replay() {
  const d = useLocalData()
  if (!d) return <Loading />
  return <Inner tracks={d.tracks} media={d.media} />
}

/** Tid → distanse (m), med øktserien hvis den finnes, ellers jevn fart */
function distAt(det: Detail | null, a: Activity, s: number) {
  if (det?.d?.length && det.t.length) return interp(det.t, det.d, s) ?? 0
  return (s / (a.mov || 1)) * a.dist
}

function Inner({ tracks, media }: { tracks: TrackMap; media: MediaMap }) {
  const { all, open } = useStore()
  const today = todayStr()
  const gps = useMemo(() => withTracks(all, tracks).filter((a) => a.dist > 1500 && a.mov > 300), [all, tracks])
  const yearAgo = useMemo(() => {
    const t = addDays(today, -365)
    return [...gps].sort((x, y) => Math.abs(daysBetween(x.d.slice(0, 10), t)) - Math.abs(daysBetween(y.d.slice(0, 10), t)))[0] ?? null
  }, [gps, today])
  const onThisDay = useMemo(() => {
    const md = today.slice(5, 10)
    return gps.filter((a) => a.d.slice(0, 4) < today.slice(0, 4) && Math.abs(daysBetween(`2000-${a.d.slice(5, 10)}`, `2000-${md}`)) <= 3).slice(0, 8)
  }, [gps, today])

  const [id, setId] = useState<string | null>(() => yearAgo?.id ?? gps[0]?.id ?? null)
  const [privacy, setPrivacy] = useState(true)
  const [speed, setSpeed] = useState(30)
  const [playing, setPlaying] = useState(false)
  const [s, setS] = useState(0) // sekunder inn i økta
  const a = gps.find((x) => x.id === id) ?? null
  const det = useDetail(id)
  const tmax = det?.t?.length ? det.t[det.t.length - 1] : a?.mov ?? 0

  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const refs = useRef<{ g?: L.LayerGroup; done?: L.Polyline; dot?: L.CircleMarker }>({})

  const geo = useMemo(() => {
    if (!id) return null
    const full = tracks[id], cum = cumDist(full), total = cum[cum.length - 1] || 1
    const shown = trackOf(tracks, id, privacy) ?? []
    const i0 = shown.length ? full.indexOf(shown[0]) : 0, i1 = shown.length ? i0 + shown.length - 1 : 0
    return { full, cum, total, i0, i1, f0: cum[i0] / total, f1: cum[i1] / total }
  }, [id, tracks, privacy])

  // bytt økt → nullstill
  useEffect(() => { setS(0); setPlaying(false) }, [id])

  // tegn rute
  useEffect(() => {
    if (!map || !geo) return
    refs.current.g?.remove()
    const g = L.layerGroup().addTo(map)
    const renderer = L.canvas()
    const vis = geo.full.slice(geo.i0, geo.i1 + 1)
    L.polyline(vis, { renderer, color: rgb(pal.fg, 0.28), weight: 5, interactive: false }).addTo(g)
    refs.current = {
      g,
      done: L.polyline([], { renderer, color: rgb(pal.brand), weight: 5, interactive: false }).addTo(g),
      dot: L.circleMarker(vis[0] ?? geo.full[0], { renderer, radius: 8, color: '#fff', weight: 3, fillColor: rgb(pal.brand), fillOpacity: 1, opacity: 0, interactive: false }).addTo(g),
    }
    if (vis.length > 1) map.fitBounds(L.latLngBounds(vis), { padding: [28, 28] })
  }, [map, geo, pal])

  // oppdater posisjon
  useEffect(() => {
    const { done, dot } = refs.current
    if (!geo || !a || !done || !dot) return
    const f = Math.min(1, distAt(det, a, s) / (det?.d?.length ? det.d[det.d.length - 1] || 1 : a.dist || 1))
    const k = geo.cum.findIndex((c) => c / geo.total >= f)
    const end = Math.min(geo.i1, k < 0 ? geo.i1 : k)
    const p = pointAt(geo.full, geo.cum, f)
    const inside = f >= geo.f0 && f <= geo.f1
    done.setLatLngs(end > geo.i0 ? [...geo.full.slice(geo.i0, end), ...(inside ? [p] : [])] : [])
    dot.setLatLng(inside ? p : geo.full[geo.i0]).setStyle({ opacity: inside ? 1 : 0, fillOpacity: inside ? 1 : 0 })
  }, [s, geo, det, a])

  // animasjon
  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setS((v) => {
        const n = v + dt * speed
        if (n >= tmax) { setPlaying(false); return tmax }
        return n
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, tmax])

  const pick = (x: Activity | null | undefined) => x && setId(x.id)
  const random = () => pick(gps[Math.floor(Math.random() * gps.length)])

  const foot = a ? isFoot(a.t) : true
  const dNow = a ? distAt(det, a, s) : 0
  const v = det?.t ? interp(det.t, det.v, s) : null
  const hr = det?.t ? interp(det.t, det.hr, s) : null
  const ago = a ? daysBetween(a.d.slice(0, 10), today) : 0
  const imgs = (a && media[a.id]?.filter((m) => m.k === 'img')) || []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={a && a.id === yearAgo?.id ? 'secondary' : 'outline'} onClick={() => pick(yearAgo)}><CalendarClock />For ett år siden</Button>
        <Button size="sm" variant="outline" onClick={random}><Shuffle />Tilfeldig minne</Button>
        <PrivacyToggle on={privacy} set={setPrivacy} />
      </div>
      {onThisDay.length > 0 && (
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max items-center gap-2">
            <span className="text-muted-foreground text-xs">På denne dagen:</span>
            {onThisDay.map((x) => (
              <button key={x.id} onClick={() => setId(x.id)} className={`min-h-10 cursor-pointer rounded-full border px-3 text-xs whitespace-nowrap transition-colors ${x.id === id ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'hover:bg-muted'}`}>
                {x.d.slice(0, 4)} · {x.t} {fmtKm(x.dist, 0)} km
              </button>
            ))}
          </div>
        </div>
      )}
      {a && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-[var(--brand)] uppercase">{ago >= 365 ? `${Math.floor(ago / 365)} år siden` : `${ago} dager siden`}</p>
            <p className="truncate text-lg leading-tight font-semibold">{a.n}</p>
            <p className="text-muted-foreground truncate text-xs">{a.t} · {fmtDate(a.d)} kl. {a.d.slice(11, 16)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => open(a.id)}><ExternalLink />Åpne</Button>
        </div>
      )}
      <div className="relative">
        <MapBox boxRef={box} />
        {a && (
          <div className="pointer-events-none absolute top-2 left-2 z-[500] grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[
              ['Tid', fmtClock(s)],
              ['Distanse', `${fmtKm(dNow, 2)} km`],
              [foot ? 'Pace' : 'Fart', v && v > 0.3 ? (foot ? `${fmtPaceSec(1000 / v)} /km` : `${fmtNum(v * 3.6, 1)} km/t`) : '–'],
              ['Puls', hr ? `${fmtInt(hr)}` : '–'],
            ].map(([l, val]) => (
              <div key={l} className="bg-popover/90 rounded-lg border px-2.5 py-1 shadow backdrop-blur">
                <p className="text-muted-foreground text-[9px] font-medium tracking-wide uppercase">{l}</p>
                <p className="text-sm font-semibold tabular-nums">{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" onClick={() => { if (s >= tmax) setS(0); setPlaying(!playing) }} aria-label={playing ? 'Pause' : 'Spill av'}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="outline" onClick={() => { setS(0); setPlaying(false) }} aria-label="Start på nytt"><RotateCcw /></Button>
        <input type="range" min={0} max={tmax || 1} step={1} value={s} onChange={(e) => setS(+e.target.value)} aria-label="Spol" className="h-10 min-w-0 flex-1 cursor-pointer accent-[var(--brand)]" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <ToggleGroup value={[String(speed)]} onValueChange={(v) => v[0] && setSpeed(+v[0])} variant="outline" size="sm">
          {SPEEDS.map((x) => <ToggleGroupItem key={x} value={String(x)}>{x}×</ToggleGroupItem>)}
        </ToggleGroup>
        <span className="text-muted-foreground text-xs tabular-nums">{fmtClock(tmax)} totalt · ~{fmtClock(tmax / speed)} avspilling</span>
      </div>
      {imgs.length > 0 && (
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {imgs.map((m) => <img key={m.f} src={thumbUrl(m.f)} alt="" loading="lazy" className="h-24 w-20 shrink-0 rounded-lg object-cover" />)}
          </div>
        </div>
      )}
    </div>
  )
}
