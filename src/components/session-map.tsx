import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type Detail, fmtNum, fmtPaceSec } from '@/lib/data'
import type { LatLon } from '@/views/concepts/local'
import { MapBox, cumDist, interp, mix, pointAt, rgb, useLeafletMap, usePalette } from '@/views/concepts/map/shared'

type Metric = 'rute' | 'puls' | 'fart' | 'hoyde'
/** Sporene er trimmet 400 m i hver ende før publisering (personvernsone) */
const TRIM = 400

const cache = new Map<string, Promise<LatLon[] | null>>()
function loadTrack(id: string) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`${import.meta.env.BASE_URL}minner/t/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return cache.get(id)!
}

/** Kart over én økt. Ruta kan fargelegges etter puls, fart eller høyde. Vises bare når økta har GPS-spor. */
export default function SessionMap({ id, det, foot }: { id: string; det: Detail | null; foot: boolean }) {
  const [track, setTrack] = useState<{ id: string; pts: LatLon[] | null } | null>(null)
  useEffect(() => { let on = true; loadTrack(id).then((pts) => on && setTrack({ id, pts })); return () => { on = false } }, [id])
  const pts = track?.id === id ? track.pts : null
  if (!pts || pts.length < 2) return null
  return <Inner key={id} pts={pts} det={det} foot={foot} />
}

function Inner({ pts, det, foot }: { pts: LatLon[]; det: Detail | null; foot: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const touch = useMemo(() => matchMedia('(pointer: coarse)').matches, [])

  const has = (k: 'hr' | 'v' | 'alt') => !!det?.d?.length && !!det[k]?.some((x) => x != null && x > 0)
  const options = ([['rute', 'Rute', true], ['puls', 'Puls', has('hr')], ['fart', foot ? 'Tempo' : 'Fart', has('v')], ['hoyde', 'Høyde', has('alt')]] as [Metric, string, boolean][]).filter((o) => o[2])
  const [metric, setMetric] = useState<Metric>('rute')
  const m: Metric = options.some((o) => o[0] === metric) ? metric : 'rute'

  const cum = useMemo(() => cumDist(pts), [pts])
  const total = cum[cum.length - 1] || 1

  // Verdi per sporpunkt: sporet starter ca. 400 m ut i økta, så vi legger til det før oppslag i øktserien
  const vals = useMemo(() => {
    if (m === 'rute' || !det?.d?.length) return null
    const dmax = det.d[det.d.length - 1] || 1
    const scale = Math.max(0.2, (dmax - 2 * TRIM) / total)
    const ys = m === 'puls' ? det.hr : m === 'fart' ? det.v : det.alt
    return cum.map((c) => interp(det.d!, ys, Math.min(dmax, TRIM + c * scale)))
  }, [m, det, cum, total])

  const range = useMemo(() => {
    const v = (vals ?? []).filter((x): x is number => x != null && x > 0).sort((p, q) => p - q)
    return v.length ? ([v[Math.floor(v.length * 0.05)], v[Math.floor(v.length * 0.95)]] as const) : null
  }, [vals])

  useEffect(() => {
    if (!map) return
    layer.current?.remove()
    const g = L.layerGroup().addTo(map)
    const renderer = L.canvas()
    L.polyline(pts, { renderer, color: rgb(pal.dark ? [0, 0, 0] : [255, 255, 255], 0.55), weight: 9, interactive: false }).addTo(g)
    if (vals && range) {
      for (let i = 0; i < pts.length - 1; i++) {
        const v = vals[i]
        const t = v != null ? Math.max(0, Math.min(1, (v - range[0]) / (range[1] - range[0] || 1))) : 0.5
        L.polyline([pts[i], pts[i + 1]], { renderer, color: rgb(mix(pal.cool, pal.brand, t)), weight: 5, interactive: false }).addTo(g)
      }
    } else {
      L.polyline(pts, { renderer, color: rgb(pal.brand), weight: 5, interactive: false }).addTo(g)
    }
    // Kilometermerker (regnet fra start av økta, derfor + 400 m)
    const full = total + 2 * TRIM
    const step = full > 30000 ? 5000 : full > 12000 ? 2000 : 1000
    for (let k = step; k < full - TRIM; k += step) {
      if (k <= TRIM) continue
      const p = pointAt(pts, cum, (k - TRIM) / total)
      L.marker(p, {
        interactive: false,
        icon: L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html: `<div style="width:20px;height:20px;border-radius:999px;background:${rgb(pal.fg)};color:${pal.dark ? '#111' : '#fff'};font:600 10px/20px system-ui;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">${k / 1000}</div>` }),
      }).addTo(g)
    }
    layer.current = g
    if (!fitted.current) { map.fitBounds(L.latLngBounds(pts), { padding: [22, 22] }); fitted.current = true }
  }, [map, pts, cum, total, vals, range, pal])

  const fmt = (v: number) => (m === 'puls' ? `${Math.round(v)} bpm` : m === 'hoyde' ? `${Math.round(v)} m` : foot ? `${fmtPaceSec(1000 / Math.max(0.5, v))} /km` : `${fmtNum(v * 3.6, 1)} km/t`)

  return (
    <section aria-label="Kart">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Kart</h3>
        {options.length > 1 && (
          <ToggleGroup value={[m]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm" aria-label="Fargelegg ruta">
            {options.map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}
          </ToggleGroup>
        )}
      </div>
      <MapBox boxRef={box} className="h-64 sm:h-80" />
      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        {range && vals ? (
          <span className="flex items-center gap-1.5 tabular-nums">
            {fmt(range[0])}
            <i className="h-1.5 w-20 rounded-full" style={{ background: `linear-gradient(to right, ${rgb(pal.cool)}, ${rgb(pal.brand)})` }} />
            {fmt(range[1])}
          </span>
        ) : <span>Tallene på ruta er kilometer</span>}
        <span>{touch ? 'Bruk to fingre for å flytte kartet · ' : ''}© OpenStreetMap</span>
      </div>
    </section>
  )
}
