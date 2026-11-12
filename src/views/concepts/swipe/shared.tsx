/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { type Activity, type Detail, MAIN_SPORTS, fmtNum, fmtPaceSec, isFoot, sportOf } from '@/lib/data'
import { cn } from '@/lib/utils'
import { type LatLon, type MediaMap, type TrackMap, trimPrivacy } from '../local'

// ---------- banken (lagres i localStorage) ----------

/** Et øyeblikksbilde av økten slik den var da den ble lagret – data, kart og nøkkeltall */
export type Snap = {
  n: string; t: string; d: string; dist: number; mov: number; up: number
  hr?: number; zones?: number[]; track?: LatLon[]; img?: string
}
export type Saved = { id: string; at: number; fav?: boolean; snap: Snap }
type BankState = { saved: Saved[]; skipped: string[] }

const KEY = 'okt-bank-v1'
function read(): BankState {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? ''); if (s && Array.isArray(s.saved)) return { saved: s.saved, skipped: s.skipped ?? [] } } catch { /* tom */ }
  return { saved: [], skipped: [] }
}
let state: BankState = read()
const subs = new Set<() => void>()
function set(fn: (s: BankState) => BankState) {
  state = fn(state)
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* privat modus o.l. */ }
  subs.forEach((f) => f())
}
export const bank = {
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
  save: (id: string, snap: Snap, fav = false) => set((s) => ({ ...s, saved: [{ id, at: Date.now(), fav, snap }, ...s.saved.filter((x) => x.id !== id)] })),
  skip: (id: string) => set((s) => ({ ...s, skipped: [...s.skipped.filter((x) => x !== id), id] })),
  remove: (id: string) => set((s) => ({ saved: s.saved.filter((x) => x.id !== id), skipped: s.skipped.filter((x) => x !== id) })),
  toggleFav: (id: string) => set((s) => ({ ...s, saved: s.saved.map((x) => (x.id === id ? { ...x, fav: !x.fav } : x)) })),
  resetSkipped: () => set((s) => ({ ...s, skipped: [] })),
  clear: () => set(() => ({ saved: [], skipped: [] })),
}
export const useBank = () => useSyncExternalStore(bank.subscribe, bank.get)

/** Lager øyeblikksbildet som lagres i banken (spor med personvernsone, maks 70 punkter) */
export function snapOf(a: Activity, tracks?: TrackMap, media?: MediaMap): Snap {
  const raw = tracks?.[a.id]
  const trimmed = raw ? trimPrivacy(raw) : []
  const step = Math.max(1, Math.ceil(trimmed.length / 70))
  const track = trimmed.length >= 2 ? trimmed.filter((_, i) => i % step === 0) : undefined
  const img = media?.[a.id]?.find((m) => m.k === 'img')?.f
  return { n: a.n, t: a.t, d: a.d, dist: a.dist, mov: a.mov, up: a.up, hr: a.hr, zones: a.zones, track, img }
}

// ---------- tagger ----------

export const TAGS = ['lang tur', 'terskel', 'rolig', 'bakker', 'morgen', 'kveld', 'favoritt'] as const
export type Tag = (typeof TAGS)[number]

/** Median distanse per idrett – brukes for å avgjøre hva som er «lang tur» */
export function useMedians(all: Activity[]) {
  return useMemo(() => {
    const by = new Map<string, number[]>()
    for (const a of all) if (a.dist > 0) { const k = sportOf(a.t); if (!by.has(k)) by.set(k, []); by.get(k)!.push(a.dist) }
    return Object.fromEntries([...by].map(([k, v]) => [k, median(v)])) as Record<string, number>
  }, [all])
}

export function tagsOf(s: Snap, medians: Record<string, number>, fav?: boolean): Tag[] {
  const out: Tag[] = []
  const med = medians[sportOf(s.t)] ?? 0
  if ((med && s.dist >= med * 1.6) || s.mov >= 100 * 60) out.push('lang tur')
  const z = s.zones && s.zones.reduce((x, y) => x + y, 0) > 0 ? s.zones : null
  if (z) {
    const tot = z.reduce((x, y) => x + y, 0)
    const hard = (z[3] + z[4] + (z[5] ?? 0)) / tot, easy = (z[0] + z[1]) / tot
    if (hard >= 0.25) out.push('terskel')
    else if (easy >= 0.75) out.push('rolig')
  } else if (s.hr) {
    if (s.hr >= 165) out.push('terskel'); else if (s.hr < 140) out.push('rolig')
  }
  if (s.dist > 2000 && s.up / (s.dist / 1000) >= 18) out.push('bakker')
  const h = +s.d.slice(11, 13)
  if (h < 9) out.push('morgen'); else if (h >= 18) out.push('kveld')
  if (fav) out.push('favoritt')
  return out
}

// ---------- tall og format ----------

export function median(v: number[]) {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
/** Tempo (min/km) for løp og gange, ellers fart (km/t) – input i sek per km */
export const fmtTempo = (t: string, secPerKm: number) => (!isFinite(secPerKm) || secPerKm <= 0 ? '–' : isFoot(t) ? `${fmtPaceSec(secPerKm)} /km` : `${fmtNum(3600 / secPerKm, 1)} km/t`)
export const secPerKm = (s: { dist: number; mov: number }) => (s.dist > 0 ? s.mov / (s.dist / 1000) : 0)
export const SPORT_CHOICES = ['Alle', ...MAIN_SPORTS.filter((s) => !['Styrketrening', 'Treningsøkt'].includes(s))]

/** Seedet stokking slik at bunken holder seg stabil mellom renderinger */
export function shuffle<T>(arr: T[], seed: number) {
  let s = Math.floor(seed * 2 ** 31) || 1
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ---------- detaljer (splits m.m.) ----------

const detCache = new Map<string, Promise<Detail | null>>()
export function loadDetail(id: string) {
  if (!detCache.has(id)) detCache.set(id, fetch(`${import.meta.env.BASE_URL}act/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return detCache.get(id)!
}
export function useDetail(id: string | null | undefined) {
  const [d, setD] = useState<{ id: string; det: Detail | null } | null>(null)
  useEffect(() => { if (!id) return; let on = true; loadDetail(id).then((det) => on && setD({ id, det })); return () => { on = false } }, [id])
  return id && d?.id === id ? d.det : null
}

// ---------- små byggeklosser ----------

/** Rute tegnet som SVG fra GPS-punkter – ingen kartfliser, ingen nettverkskall */
export function RouteSvg({ pts, className, stroke = 'var(--brand)', width = 2.5, glow }: { pts?: LatLon[]; className?: string; stroke?: string; width?: number; glow?: boolean }) {
  const d = useMemo(() => {
    if (!pts || pts.length < 2) return ''
    const k = Math.cos((pts[0][0] * Math.PI) / 180)
    const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const span = Math.max(x1 - x0, y1 - y0) || 1e-6
    const ox = (100 - ((x1 - x0) / span) * 88) / 2, oy = (100 - ((y1 - y0) / span) * 88) / 2
    return xs.map((x, i) => `${i ? 'L' : 'M'}${(ox + ((x - x0) / span) * 88).toFixed(2)},${(oy + ((ys[i] - y0) / span) * 88).toFixed(2)}`).join('')
  }, [pts])
  if (!d) return null
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {glow && <path d={d} fill="none" stroke={stroke} strokeOpacity={0.25} strokeWidth={width * 3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Chip({ on, onClick, children, className }: { on?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors', on ? 'bg-foreground text-background border-transparent' : 'hover:bg-muted', className)}>
      {children}
    </button>
  )
}

export function TagPill({ tag }: { tag: string }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tag === 'favoritt' ? 'bg-[var(--brand)] text-white' : 'bg-muted text-muted-foreground')}>{tag}</span>
}

/** Liten søylerad – brukes til km-splits og planer */
export function MiniBars({ values, max, min, color = 'var(--sp-roller)', highlight, className, invert }: { values: number[]; max?: number; min?: number; color?: string; highlight?: number; className?: string; invert?: boolean }) {
  if (!values.length) return null
  const hi = max ?? Math.max(...values), lo = min ?? Math.min(...values) * 0.9
  const span = hi - lo || 1
  return (
    <div className={cn('flex h-10 items-end gap-[2px]', className)}>
      {values.map((v, i) => {
        const r = invert ? (hi - v) / span : (v - lo) / span
        return <div key={i} className="min-w-[3px] flex-1 rounded-t-[2px]" style={{ height: `${Math.max(8, Math.min(100, 15 + r * 85))}%`, background: i === highlight ? 'var(--brand)' : color }} />
      })}
    </div>
  )
}
