import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { ExternalLink, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { fmtDate, fmtDur, fmtKm, fmtSpeed } from '@/lib/data'
import { useLocalData, type TrackMap } from '../local'
import { Loading, MapBox, RouteThumb, denseBounds, rgb, trackOf, useLeafletMap, usePalette, withTracks } from './shared'

const SPORTS = ['Alle', 'Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur']

export function Heatmap() {
  const d = useLocalData()
  if (!d) return <Loading />
  return <HeatmapInner tracks={d.tracks} />
}

function HeatmapInner({ tracks }: { tracks: TrackMap }) {
  const { all, byId, open } = useStore()
  const [sport, setSport] = useState('Alle')
  const [year, setYear] = useState('Alle')
  // Sporene er allerede trimmet med personvernsone før publisering
  const privacy = false
  const [sel, setSel] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(box)
  const pal = usePalette()
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef('')

  const gps = useMemo(() => withTracks(all, tracks), [all, tracks])
  const years = useMemo(() => ['Alle', ...[...new Set(gps.map((a) => a.d.slice(0, 4)))].sort().reverse()], [gps])
  const shown = useMemo(() => gps.filter((a) => (sport === 'Alle' || a.t === sport) && (year === 'Alle' || a.d.startsWith(year))), [gps, sport, year])
  const lines = useMemo(() => shown.map((a) => ({ a, pts: trackOf(tracks, a.id, privacy) })).filter((x) => x.pts) as { a: (typeof shown)[number]; pts: [number, number][] }[], [shown, tracks, privacy])

  // tegn alle ruter
  useEffect(() => {
    if (!map) return
    layer.current?.remove()
    const g = L.layerGroup().addTo(map)
    const renderer = L.canvas({ tolerance: 8 })
    const alpha = lines.length > 400 ? 0.22 : lines.length > 120 ? 0.32 : 0.5
    for (const { a, pts } of lines) {
      L.polyline(pts, { renderer, color: rgb(pal.brand, alpha), weight: 2, interactive: true })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); setSel(a.id) })
        .addTo(g)
    }
    if (sel) {
      const s = lines.find((x) => x.a.id === sel)
      if (s) {
        L.polyline(s.pts, { renderer, color: rgb(pal.fg, 0.9), weight: 7, interactive: false }).addTo(g)
        L.polyline(s.pts, { renderer, color: rgb(pal.brand), weight: 4, interactive: false }).addTo(g)
      }
    }
    layer.current = g
    const key = `${sport}|${year}|${privacy}`
    if (fitted.current !== key) {
      const b = denseBounds(lines.flatMap((x) => x.pts.filter((_, i) => i % 8 === 0)))
      if (b) map.fitBounds(b, { padding: [16, 16] })
      fitted.current = key
    }
  }, [map, lines, sel, pal, sport, year, privacy])

  useEffect(() => { if (!map) return; const f = () => setSel(null); map.on('click', f); return () => { map.off('click', f) } }, [map])

  const a = sel ? byId.get(sel) : null
  const km = lines.reduce((s, x) => s + x.a.dist, 0)

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2">
          <ToggleGroup value={[sport]} onValueChange={(v) => v[0] && (setSport(v[0]), setSel(null))} variant="outline" size="sm">
            {SPORTS.map((s) => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
          </ToggleGroup>
          <div className="bg-foreground/20 mx-1 h-5 w-px" />
          <ToggleGroup value={[year]} onValueChange={(v) => v[0] && (setYear(v[0]), setSel(null))} variant="outline" size="sm">
            {years.map((y) => <ToggleGroupItem key={y} value={y}>{y}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs tabular-nums"><b className="text-foreground">{lines.length}</b> ruter · {fmtKm(km, 0)} km · trykk på en rute</p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs"><ShieldCheck className="size-3.5 text-[var(--brand)]" />Start og slutt er skjult</p>
      </div>
      <div className="relative">
        <MapBox boxRef={box} className="h-[22rem] sm:h-[30rem]" />
        {a && (
          <div className="bg-popover/95 absolute right-2 bottom-2 left-2 z-[500] flex items-center gap-3 rounded-xl border p-2.5 shadow-xl backdrop-blur sm:left-auto sm:w-80">
            <RouteThumb pts={trackOf(tracks, a.id, privacy) ?? tracks[a.id]} size={48} className="bg-muted shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.n}</p>
              <p className="text-muted-foreground truncate text-xs tabular-nums">{a.t} · {fmtDate(a.d)}</p>
              <p className="text-xs tabular-nums">{fmtKm(a.dist)} km · {fmtDur(a.mov)} · {fmtSpeed(a)}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Lukk" onClick={() => setSel(null)}><X /></Button>
              <Button size="icon-sm" variant="secondary" aria-label="Åpne økten" title="Åpne økten" onClick={() => open(a.id)}><ExternalLink /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
