import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { ExternalLink, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { type Activity, type Detail, fmtDate, fmtDur, fmtInt, fmtKm, fmtNum, fmtPaceSec, isFoot } from '@/lib/data'
import { useLocalData, type LatLon, type TrackMap } from '../local'
import { Loading, MapBox, PrivacyToggle, RouteThumb, cumDist, interp, mix, pointAt, rgb, trackOf, useDetail, useLeafletMap, usePalette, withTracks } from './shared'

type Metric = 'fart' | 'puls' | 'hoyde'

export function ColoredSession() {
  const d = useLocalData()
  if (!d) return <Loading />
  return <Inner tracks={d.tracks} />
}

/** Verdi per sporpunkt, hentet fra øktserien via andel av distansen */
function valuesFor(full: LatLon[], cum: number[], det: Detail | null, m: Metric): (number | null)[] {
  if (!det?.d?.length) return full.map(() => null)
  const total = cum[cum.length - 1] || 1, dmax = det.d[det.d.length - 1] || 1
  const ys = m === 'fart' ? det.v : m === 'puls' ? det.hr : det.alt
  return cum.map((c) => interp(det.d!, ys, (c / total) * dmax))
}

function Inner({ tracks }: { tracks: TrackMap }) {
  const { all, open } = useStore()
  const gps = useMemo(() => withTracks(all, tracks), [all, tracks])
  const recent = useMemo(() => gps.filter((a) => a.dist > 2000).slice(0, 14), [gps])
  const [id, setId] = useState(() => recent[0]?.id ?? null)
  const [metric, setMetric] = useState<Metric>('fart')
  const [privacy, setPrivacy] = useState(true)
  const [hover, setHover] = useState<number | null>(null) // andel 0–1
  const a = gps.find((x) => x.id === id) ?? null
  const det = useDetail(id)
  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const layer = useRef<L.LayerGroup | null>(null)
  const dot = useRef<L.CircleMarker | null>(null)

  const geo = useMemo(() => {
    if (!id) return null
    const full = tracks[id]
    const cum = cumDist(full)
    const shown = trackOf(tracks, id, privacy) ?? []
    const i0 = shown.length ? full.indexOf(shown[0]) : 0
    const i1 = shown.length ? i0 + shown.length - 1 : full.length - 1
    const total = cum[cum.length - 1] || 1
    return { full, cum, i0, i1, f0: cum[i0] / total, f1: cum[i1] / total, total }
  }, [id, tracks, privacy])

  const vals = useMemo(() => (geo ? valuesFor(geo.full, geo.cum, det, metric) : []), [geo, det, metric])
  const range = useMemo(() => {
    const v = vals.filter((x): x is number => x != null && x > 0).sort((p, q) => p - q)
    if (!v.length) return null
    return [v[Math.floor(v.length * 0.05)], v[Math.floor(v.length * 0.95)]] as const
  }, [vals])

  useEffect(() => {
    if (!map || !geo) return
    layer.current?.remove()
    const g = L.layerGroup().addTo(map)
    const renderer = L.canvas({ tolerance: 6 })
    const { full, cum, i0, i1, total } = geo
    // underlag + segmenter farget etter verdi
    L.polyline(full.slice(i0, i1 + 1), { renderer, color: rgb(pal.fg, 0.35), weight: 8, interactive: false }).addTo(g)
    for (let i = i0; i < i1; i++) {
      const v = vals[i]
      const t = range && v != null ? (v - range[0]) / (range[1] - range[0] || 1) : 0.5
      L.polyline([full[i], full[i + 1]], { renderer, color: rgb(mix(pal.cool, pal.brand, t)), weight: 5, interactive: false }).addTo(g)
    }
    // kilometermerker innenfor det synlige sporet
    const kmStep = total > 30000 ? 5000 : total > 12000 ? 2000 : 1000
    for (let k = kmStep; k < total; k += kmStep) {
      if (k < cum[i0] || k > cum[i1]) continue
      const p = pointAt(full, cum, k / total)
      L.marker(p, { interactive: false, icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div style="width:22px;height:22px;border-radius:999px;background:${rgb(pal.fg)};color:${pal.dark ? '#111' : '#fff'};font:600 10px/22px system-ui;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">${k / 1000}</div>` }) }).addTo(g)
    }
    dot.current = L.circleMarker(full[i0], { renderer, radius: 7, color: '#fff', weight: 2, fillColor: rgb(pal.brand), interactive: false, opacity: 0, fillOpacity: 0 }).addTo(g)
    layer.current = g
    map.fitBounds(L.latLngBounds(full.slice(i0, i1 + 1)), { padding: [24, 24] })
  }, [map, geo, vals, range, pal])

  // synk punkt på kartet med høydeprofilen
  useEffect(() => {
    const m = dot.current
    if (!m || !geo) return
    if (hover == null || hover < geo.f0 || hover > geo.f1) { m.setStyle({ opacity: 0, fillOpacity: 0 }); return }
    m.setLatLng(pointAt(geo.full, geo.cum, hover)).setStyle({ opacity: 1, fillOpacity: 1 })
  }, [hover, geo])

  const foot = a ? isFoot(a.t) : true
  const fmtV = (v: number) => (metric === 'fart' ? (foot ? `${fmtPaceSec(1000 / v)} /km` : `${fmtNum(v * 3.6, 1)} km/t`) : metric === 'puls' ? `${fmtInt(v)} bpm` : `${fmtInt(v)} moh`)
  const hv = hover != null && det?.d ? { f: hover, d: hover * (det.d[det.d.length - 1] ?? 0), v: interp(det.d, metric === 'fart' ? det.v : metric === 'puls' ? det.hr : det.alt, hover * (det.d[det.d.length - 1] ?? 0)) } : null

  const pickRandom = () => { const c = gps.filter((x) => x.dist > 3000); setId(c[Math.floor(Math.random() * c.length)]?.id ?? id) }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          {recent.map((x) => (
            <button key={x.id} onClick={() => setId(x.id)} title={`${x.n} · ${fmtDate(x.d)}`}
              className={`flex w-24 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-left transition-colors ${x.id === id ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'hover:bg-muted'}`}>
              <RouteThumb pts={trackOf(tracks, x.id, privacy) ?? tracks[x.id]} size={52} color={x.id === id ? 'var(--brand)' : 'var(--muted-foreground)'} />
              <span className="w-full truncate text-[11px] font-medium">{x.n}</span>
              <span className="text-muted-foreground w-full truncate text-[10px] tabular-nums">{fmtDate(x.d).replace(/ \d{4}$/, '')} · {fmtKm(x.dist, 0)} km</span>
            </button>
          ))}
          <button onClick={pickRandom} className="hover:bg-muted flex w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-2 text-xs"><Shuffle className="size-4" />Tilfeldig</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm">
          <ToggleGroupItem value="fart">{foot ? 'Pace' : 'Fart'}</ToggleGroupItem>
          <ToggleGroupItem value="puls">Puls</ToggleGroupItem>
          <ToggleGroupItem value="hoyde">Høyde</ToggleGroupItem>
        </ToggleGroup>
        <PrivacyToggle on={privacy} set={setPrivacy} />
      </div>
      {a && <SessionHead a={a} onOpen={() => open(a.id)} />}
      <MapBox boxRef={box} />
      {range && (
        <div className="flex items-center gap-2 text-[11px] tabular-nums">
          <span className="text-muted-foreground">{metric === 'fart' && foot ? 'Rolig' : 'Lav'} {fmtV(range[0])}</span>
          <div className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${rgb(pal.cool)}, ${rgb(pal.brand)})` }} />
          <span className="text-muted-foreground">{fmtV(range[1])} {metric === 'fart' && foot ? 'Raskt' : 'Høy'}</span>
        </div>
      )}
      {det?.d && det.alt && <Profile det={det} hover={hover} setHover={setHover} f0={geo?.f0 ?? 0} f1={geo?.f1 ?? 1} />}
      <p className="text-muted-foreground min-h-4 text-xs tabular-nums">
        {hv ? <>Ved {fmtKm(hv.d, 2)} km · <b className="text-foreground">{hv.v != null ? fmtV(hv.v) : '–'}</b></> : 'Dra over høydeprofilen for å følge punktet på kartet.'}
      </p>
    </div>
  )
}

function SessionHead({ a, onOpen }: { a: Activity; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{a.n}</p>
        <p className="text-muted-foreground truncate text-xs tabular-nums">{a.t} · {fmtDate(a.d)} · {fmtKm(a.dist)} km · {fmtDur(a.mov)}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}><ExternalLink />Åpne</Button>
    </div>
  )
}

/** Høydeprofil som SVG, med pekerposisjon som andel av distansen */
function Profile({ det, hover, setHover, f0, f1 }: { det: Detail; hover: number | null; setHover: (f: number | null) => void; f0: number; f1: number }) {
  const W = 600, H = 90
  const path = useMemo(() => {
    const d = det.d!, alt = det.alt!
    const pts = d.map((x, i) => [x, alt[i]] as const).filter((p): p is readonly [number, number] => p[1] != null)
    if (pts.length < 2) return null
    const dmax = d[d.length - 1] || 1
    const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]))
    const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 14)
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${((p[0] / dmax) * W).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
    return { line, area: `${line}L${W},${H}L0,${H}Z`, lo, hi }
  }, [det])
  if (!path) return null
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full cursor-crosshair touch-none rounded-lg" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        <rect x={0} y={0} width={f0 * W} height={H} className="fill-muted/60" />
        <rect x={f1 * W} y={0} width={W - f1 * W} height={H} className="fill-muted/60" />
        <path d={path.area} fill="var(--brand)" fillOpacity={0.15} />
        <path d={path.line} fill="none" stroke="var(--brand)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {hover != null && <line x1={hover * W} x2={hover * W} y1={0} y2={H} stroke="var(--foreground)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="text-muted-foreground pointer-events-none absolute top-1 left-2 text-[10px] tabular-nums">{fmtInt(path.hi)} moh</span>
      <span className="text-muted-foreground pointer-events-none absolute bottom-1 left-2 text-[10px] tabular-nums">{fmtInt(path.lo)} moh</span>
    </div>
  )
}
