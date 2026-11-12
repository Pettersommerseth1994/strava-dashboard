import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ShieldCheck } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { Activity, Detail } from '@/lib/data'
import { TILES, meters, trimPrivacy, type LatLon, type TrackMap } from '../local'

/* ---------- tema og farger ---------- */

export function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return dark
}

/** Løser en CSS-variabel (f.eks. oklch) til rgb – canvas i Leaflet forstår ikke var(--x) */
export function cssVar(name: string, fallback = '#f28a3b'): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const x = c.getContext('2d')!
  x.fillStyle = fallback
  x.fillStyle = v
  x.fillRect(0, 0, 1, 1)
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}
export const rgb = (c: [number, number, number], a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`)
export const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * Math.max(0, Math.min(1, t)))) as [number, number, number]

/** Palett som oppdateres når tema byttes */
export function usePalette() {
  const dark = useDark()
  return useMemo(() => ({
    dark,
    brand: cssVar('--brand'),
    cool: cssVar('--sp-roller', '#7790b0'),
    ski: cssVar('--sp-ski', '#5a6f8f'),
    fg: cssVar('--foreground', dark ? '#fafafa' : '#111'),
    muted: cssVar('--muted-foreground', '#888'),
  }), [dark])
}

/* ---------- Leaflet ---------- */

/** Lager et Leaflet-kart i en div, bytter fliser ved tema og rydder opp ved avmontering */
export function useLeafletMap(ref: RefObject<HTMLDivElement | null>, opts: L.MapOptions = {}) {
  const [map, setMap] = useState<L.Map | null>(null)
  const dark = useDark()
  const tiles = useRef<L.TileLayer | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const m = L.map(ref.current, { scrollWheelZoom: false, zoomSnap: 0.25, preferCanvas: true, attributionControl: false, ...opts })
    m.setView([63.43, 10.4], 11)
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(ref.current)
    setTimeout(() => m.invalidateSize(), 50)
    setMap(m)
    return () => { ro.disconnect(); m.remove(); setMap(null) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!map) return
    tiles.current?.remove()
    tiles.current = L.tileLayer(dark ? TILES.dark : TILES.light, { attribution: TILES.attribution, maxZoom: 19 }).addTo(map)
  }, [map, dark])
  return map
}

/** Kartflate med standard høyde og avrundet ramme */
export function MapBox({ boxRef, className = 'h-80 sm:h-[26rem]' }: { boxRef: RefObject<HTMLDivElement | null>; className?: string }) {
  return <div ref={boxRef} className={`${className} bg-muted relative z-0 w-full overflow-hidden rounded-xl border`} />
}

/** Grenser rundt de mest konsentrerte punktene (kutter 5 % ytterpunkter, f.eks. reiser) */
export function denseBounds(pts: LatLon[]): L.LatLngBounds | null {
  if (!pts.length) return null
  // Finn det tetteste området (ruter på ~0,1°) og zoom til punktene innenfor ~25 km derfra
  const cells = new Map<string, number>()
  for (const p of pts) { const k = `${Math.round(p[0] * 10)},${Math.round(p[1] * 5)}`; cells.set(k, (cells.get(k) ?? 0) + 1) }
  const [best] = [...cells.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) as [number]
  const [, bLo] = [...cells.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
  const c: LatLon = [best / 10, bLo / 5]
  const near = pts.filter((p) => meters(p, c) < 25000)
  const use = near.length >= 10 ? near : pts
  const la = use.map((p) => p[0]).sort((a, b) => a - b), lo = use.map((p) => p[1]).sort((a, b) => a - b)
  const q = (a: number[], f: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * f)))]
  return L.latLngBounds([q(la, 0.03), q(lo, 0.03)], [q(la, 0.97), q(lo, 0.97)])
}

/* ---------- personvern ---------- */

export function PrivacyToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="bg-muted/50 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs">
      <Switch checked={on} onCheckedChange={set} />
      <ShieldCheck className={`size-3.5 ${on ? 'text-[var(--brand)]' : 'text-muted-foreground'}`} />
      <span>Personvernsone <span className="text-muted-foreground">(skjul start/slutt)</span></span>
    </label>
  )
}

/** Spor for en økt, med eller uten personvernsone */
export const trackOf = (tracks: TrackMap, id: string, privacy: boolean) => {
  const t = tracks[id]
  if (!t) return null
  const p = privacy ? trimPrivacy(t) : t
  return p.length >= 2 ? p : null
}

/** Kumulativ avstand langs et spor (meter) */
export function cumDist(pts: LatLon[]) {
  const c = [0]
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + meters(pts[i - 1], pts[i]))
  return c
}

/** Punkt på sporet ved en andel (0–1) av total lengde */
export function pointAt(pts: LatLon[], cum: number[], f: number): LatLon {
  const target = Math.max(0, Math.min(1, f)) * cum[cum.length - 1]
  let i = 1
  while (i < cum.length - 1 && cum[i] < target) i++
  const seg = cum[i] - cum[i - 1] || 1
  const t = (target - cum[i - 1]) / seg
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
}

/* ---------- øktdetaljer ---------- */

const detailCache = new Map<string, Promise<Detail | null>>()
export function loadDetail(id: string) {
  if (!detailCache.has(id)) detailCache.set(id, fetch(`${import.meta.env.BASE_URL}act/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return detailCache.get(id)!
}
export function useDetail(id: string | null) {
  const [d, setD] = useState<{ id: string; det: Detail | null } | null>(null)
  useEffect(() => { if (!id) return; let on = true; loadDetail(id).then((det) => on && setD({ id, det })); return () => { on = false } }, [id])
  return d && d.id === id ? d.det : null
}

/** Lineær interpolasjon i en serie (x stigende) */
export function interp(xs: number[], ys: (number | null | undefined)[] | undefined, x: number): number | null {
  if (!ys || !xs.length) return null
  if (x <= xs[0]) return ys[0] ?? null
  let i = 1
  while (i < xs.length && xs[i] < x) i++
  if (i >= xs.length) return ys[xs.length - 1] ?? null
  const a = ys[i - 1], b = ys[i]
  if (a == null || b == null) return a ?? b ?? null
  return a + ((b - a) * (x - xs[i - 1])) / (xs[i] - xs[i - 1] || 1)
}

/* ---------- små SVG-ruter ---------- */

export function RouteThumb({ pts, size = 56, color = 'var(--brand)', className = '' }: { pts: LatLon[]; size?: number; color?: string; className?: string }) {
  const d = useMemo(() => {
    if (pts.length < 2) return ''
    const k = Math.cos((pts[0][0] * Math.PI) / 180)
    const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const s = (size - 8) / Math.max(x1 - x0, y1 - y0, 1e-9)
    const ox = (size - (x1 - x0) * s) / 2, oy = (size - (y1 - y0) * s) / 2
    return pts.map((_, i) => `${i ? 'L' : 'M'}${(ox + (xs[i] - x0) * s).toFixed(1)},${(oy + (ys[i] - y0) * s).toFixed(1)}`).join('')
  }, [pts, size])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Økter med GPS-spor, nyeste først */
export function withTracks(all: Activity[], tracks: TrackMap) {
  return all.filter((a) => tracks[a.id]).sort((a, b) => (a.d < b.d ? 1 : -1))
}

export function Loading() {
  return <div className="bg-muted/40 text-muted-foreground grid h-80 place-items-center rounded-xl text-sm">Laster kartdata …</div>
}
