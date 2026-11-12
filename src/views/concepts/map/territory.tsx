import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { type Activity, fmtDate, fmtInt } from '@/lib/data'
import { meters, trimPrivacy, useLocalData, type LatLon, type TrackMap } from '../local'
import { Stat } from '../../lab/shared'
import { Loading, MapBox, PrivacyToggle, rgb, useLeafletMap, usePalette, withTracks } from './shared'

const D_LAT = 1 / 111.32 // ≈ 1 km
const SPORTS = ['Alle', 'Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur']
type View = 'alle' | 'nye' | 'klynge'
type Cell = { i: number; j: number; n: number; first: string; firstId: string }

/** Ruter (≈1 km) som et spor har vært innom – fyller inn mellom punkter hvert ~250 m */
function cellsOf(pts: LatLon[], dLon: number) {
  const out = new Set<string>()
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[k + 1] ?? a
    const steps = Math.max(1, Math.ceil(meters(a, b) / 250))
    for (let s = 0; s < steps; s++) {
      const la = a[0] + ((b[0] - a[0]) * s) / steps, lo = a[1] + ((b[1] - a[1]) * s) / steps
      out.add(`${Math.floor(la / D_LAT)},${Math.floor(lo / dLon)}`)
    }
  }
  return out
}

function analyse(acts: Activity[], tracks: TrackMap, privacy: boolean, year: string) {
  const sample = acts.flatMap((a) => tracks[a.id].filter((_, i) => i % 20 === 0).map((p) => p[0])).sort((a, b) => a - b)
  const refLat = sample[Math.floor(sample.length / 2)] ?? 63
  const dLon = D_LAT / Math.cos((refLat * Math.PI) / 180)
  const cells = new Map<string, Cell>()
  for (const a of [...acts].sort((x, y) => (x.d < y.d ? -1 : 1))) {
    const pts = privacy ? trimPrivacy(tracks[a.id]) : tracks[a.id]
    if (pts.length < 2) continue
    for (const key of cellsOf(pts, dLon)) {
      const c = cells.get(key)
      if (c) c.n++
      else { const [i, j] = key.split(',').map(Number); cells.set(key, { i, j, n: 1, first: a.d, firstId: a.id }) }
    }
  }
  // største sammenhengende klynge (4-naboer)
  const seen = new Set<string>()
  let best: string[] = []
  for (const k of cells.keys()) {
    if (seen.has(k)) continue
    const comp: string[] = [], q = [k]
    seen.add(k)
    while (q.length) {
      const cur = q.pop()!
      comp.push(cur)
      const [i, j] = cur.split(',').map(Number)
      for (const n of [`${i + 1},${j}`, `${i - 1},${j}`, `${i},${j + 1}`, `${i},${j - 1}`]) if (cells.has(n) && !seen.has(n)) { seen.add(n); q.push(n) }
    }
    if (comp.length > best.length) best = comp
  }
  // største kvadrat av besøkte ruter (dynamisk programmering)
  const sq = new Map<string, number>()
  let maxSq = 0
  for (const c of [...cells.values()].sort((a, b) => a.i - b.i || a.j - b.j)) {
    const v = 1 + Math.min(sq.get(`${c.i - 1},${c.j}`) ?? 0, sq.get(`${c.i},${c.j - 1}`) ?? 0, sq.get(`${c.i - 1},${c.j - 1}`) ?? 0)
    sq.set(`${c.i},${c.j}`, v)
    if (v > maxSq) maxSq = v
  }
  const fresh = [...cells.values()].filter((c) => c.first.startsWith(year))
  return { cells, dLon, cluster: new Set(best), maxSq, fresh }
}

export function Territory() {
  const d = useLocalData()
  if (!d) return <Loading />
  return <Inner tracks={d.tracks} />
}

function Inner({ tracks }: { tracks: TrackMap }) {
  const { all, open } = useStore()
  const year = String(new Date().getFullYear())
  const [sport, setSport] = useState('Alle')
  const [privacy, setPrivacy] = useState(true)
  const [view, setView] = useState<View>('alle')
  const [sel, setSel] = useState<Cell | null>(null)
  const acts = useMemo(() => withTracks(all, tracks).filter((a) => sport === 'Alle' || a.t === sport), [all, tracks, sport])
  const res = useMemo(() => analyse(acts, tracks, privacy, year), [acts, tracks, privacy, year])
  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const layer = useRef<L.LayerGroup | null>(null)
  const fitKey = useRef('')

  useEffect(() => {
    if (!map) return
    layer.current?.remove()
    const g = L.layerGroup().addTo(map)
    const renderer = L.canvas({ padding: 0.5 })
    const maxN = Math.max(1, ...[...res.cells.values()].map((c) => c.n))
    for (const [k, c] of res.cells) {
      const isNew = c.first.startsWith(year), inCl = res.cluster.has(k)
      const dim = (view === 'nye' && !isNew) || (view === 'klynge' && !inCl)
      const t = Math.log(1 + c.n) / Math.log(1 + maxN)
      L.rectangle([[c.i * D_LAT, c.j * res.dLon], [(c.i + 1) * D_LAT, (c.j + 1) * res.dLon]], {
        renderer, weight: !dim && (view === 'nye' ? isNew : view === 'klynge' ? false : isNew) ? 1.5 : 0.5,
        color: !dim && view !== 'klynge' && isNew ? rgb(pal.fg, 0.9) : rgb(pal.brand, dim ? 0.08 : 0.5),
        fillColor: rgb(pal.brand), fillOpacity: dim ? 0.04 : 0.12 + t * 0.6,
      }).on('click', () => setSel(c)).addTo(g)
    }
    layer.current = g
    const key = `${sport}|${privacy}`
    if (fitKey.current !== key && res.cluster.size) {
      const cl = [...res.cluster].map((k) => k.split(',').map(Number))
      const la = cl.map((x) => x[0]), lo = cl.map((x) => x[1])
      map.fitBounds([[Math.min(...la) * D_LAT, Math.min(...lo) * res.dLon], [(Math.max(...la) + 1) * D_LAT, (Math.max(...lo) + 1) * res.dLon]], { padding: [12, 12] })
      fitKey.current = key
    }
  }, [map, res, pal, view, sport, privacy, year])

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2">
          <ToggleGroup value={[sport]} onValueChange={(v) => v[0] && setSport(v[0])} variant="outline" size="sm">
            {SPORTS.map((s) => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
          </ToggleGroup>
          <div className="bg-foreground/20 mx-1 h-5 w-px" />
          <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as View)} variant="outline" size="sm">
            <ToggleGroupItem value="alle">Alle ruter</ToggleGroupItem>
            <ToggleGroupItem value="nye">Nye i {year}</ToggleGroupItem>
            <ToggleGroupItem value="klynge">Største klynge</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Unike ruter" value={fmtInt(res.cells.size)} sub="≈ 1 × 1 km" />
        <Stat label={`Nye i ${year}`} value={fmtInt(res.fresh.length)} sub={`${Math.round((res.fresh.length / Math.max(1, res.cells.size)) * 100)} % av alle`} />
        <Stat label="Største klynge" value={fmtInt(res.cluster.size)} sub="sammenhengende ruter" />
        <Stat label="Største kvadrat" value={`${res.maxSq} × ${res.maxSq}`} sub="km, helt fylt" />
      </div>
      <div className="flex justify-end"><PrivacyToggle on={privacy} set={setPrivacy} /></div>
      <MapBox boxRef={box} className="h-[22rem] sm:h-[30rem]" />
      <p className="text-muted-foreground min-h-4 text-xs tabular-nums">
        {sel ? <>Rute besøkt <b className="text-foreground">{sel.n}</b> {sel.n === 1 ? 'gang' : 'ganger'} · først erobret {fmtDate(sel.first)} · <button className="cursor-pointer text-[var(--brand)] underline-offset-2 hover:underline" onClick={() => open(sel.firstId)}>åpne første økt</button></> : 'Trykk på en rute for å se når du erobret den. Mørkere = flere besøk, hvit kant = ny i år.'}
      </p>
    </div>
  )
}
