export type Be = Record<string, [number, number | null]>
export type Activity = {
  id: string; d: string; n: string; t: string
  dist: number; mov: number; el: number; up: number; down?: number
  hr?: number; mhr?: number; cal?: number; vmax?: number; w?: number; cad?: number
  re?: number; temp?: number; gear?: string
  te?: number; ate?: number; stride?: number; vo?: number; gct?: number; np?: number
  rhr?: number; hrmax?: number; thr?: number; zones?: number[]
  be?: Be; vdot?: number; load: number; det?: 1
}
export type Detail = {
  t: number[]; d?: number[]; v?: (number | null)[]; hr?: (number | null)[]; alt?: (number | null)[]
  cad?: (number | null)[]; pw?: (number | null)[]; splits?: [number, number | null, number | null][]
}

export const SPORT_COLORS: Record<string, string> = {
  Løpetur: 'var(--sp-run)',
  Langrenn: 'var(--sp-ski)',
  Rulleski: 'var(--sp-roller)',
  Sykkeltur: 'var(--sp-bike)',
  Styrketrening: 'var(--sp-strength)',
  Treningsøkt: 'var(--sp-workout)',
  Annet: 'var(--sp-other)',
}
export const MAIN_SPORTS = ['Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur', 'Styrketrening', 'Treningsøkt']
export const sportOf = (t: string) => (MAIN_SPORTS.includes(t) ? t : 'Annet')
export const sportColor = (t: string) => SPORT_COLORS[sportOf(t)]
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
export const MONTHS_LONG = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
export const WEEKDAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']
export const ZONE_COLORS = ['var(--z1)', 'var(--z2)', 'var(--z3)', 'var(--z4)', 'var(--z5)', 'var(--z6)']
export const isFoot = (t: string) => t === 'Løpetur' || t === 'Gåtur'

// ---------- formatering ----------
const nb = (n: number, d = 0) => n.toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d })
export const fmtNum = nb
export const fmtInt = (n: number) => nb(Math.round(n))
export const fmtKm = (m: number, d = 1) => nb(m / 1000, d)
export const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
  return h ? `${h}t ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`
}
export const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
export const fmtHours = (s: number) => nb(s / 3600, s < 36000 ? 1 : 0) + ' t'
export const fmtPaceSec = (secPerKm: number) => {
  let m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60)
  if (s === 60) { m++; s = 0 }
  return `${m}:${String(s).padStart(2, '0')}`
}
export const fmtPace = (distM: number, sec: number) => (distM > 0 ? fmtPaceSec(sec / (distM / 1000)) + ' /km' : '–')
export const avgSpeed = (a: Activity) => (a.mov > 0 ? a.dist / a.mov : 0)
export const fmtSpeed = (a: Activity) => (!a.dist ? '–' : isFoot(a.t) ? fmtPace(a.dist, a.mov) : `${nb(avgSpeed(a) * 3.6, 1)} km/t`)
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' kl. ' + iso.slice(11, 16)
export const fmtMonth = (k: string) => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`
export const ts = (iso: string) => new Date(iso).getTime()

// ---------- datoer ----------
export const ymd = (d: Date) => d.toISOString().slice(0, 10)
export const parseYmd = (s: string) => new Date(s + 'T00:00:00Z')
export const addDays = (s: string, n: number) => ymd(new Date(parseYmd(s).getTime() + n * 86400000))
export const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000)
export const todayStr = () => { const d = new Date(); return ymd(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))) }
export const dayKey = (iso: string) => iso.slice(0, 10)
export const weekStart = (s: string) => addDays(s, -((parseYmd(s).getUTCDay() + 6) % 7))
export function isoWeek(s: string) {
  const d = parseYmd(s)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const y = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const w = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return { y, w }
}

export type PeriodKind = 'week' | 'month' | 'quarter' | 'ytd' | 'year' | '30d' | '90d' | '12m' | 'all' | 'custom'
export type Period = { kind: PeriodKind; offset: number; from?: string; to?: string }
export type Range = { from: string; to: string; label: string; days: number }

export function resolvePeriod(p: Period, first: string, today = todayStr()): { cur: Range; prev: Range | null } {
  const mk = (from: string, to: string, label: string): Range => ({ from, to, label, days: daysBetween(from, to) + 1 })
  const ty = +today.slice(0, 4), tm = +today.slice(5, 7)
  const monthRange = (y: number, m: number) => {
    const from = ymd(new Date(Date.UTC(y, m, 1))); const to = ymd(new Date(Date.UTC(y, m + 1, 0)))
    return mk(from, to, `${MONTHS_LONG[+from.slice(5, 7) - 1]} ${from.slice(0, 4)}`)
  }
  const o = p.offset
  switch (p.kind) {
    case 'week': {
      const f = (n: number) => { const s = addDays(weekStart(today), 7 * n); const w = isoWeek(s); return mk(s, addDays(s, 6), `Uke ${w.w}, ${w.y}`) }
      return { cur: f(o), prev: f(o - 1) }
    }
    case 'month': return { cur: monthRange(ty, tm - 1 + o), prev: monthRange(ty, tm - 2 + o) }
    case 'quarter': {
      const q = Math.floor((tm - 1) / 3) + o
      const f = (qq: number) => {
        const from = ymd(new Date(Date.UTC(ty, qq * 3, 1))); const to = ymd(new Date(Date.UTC(ty, qq * 3 + 3, 0)))
        return mk(from, to, `K${Math.floor((+from.slice(5, 7) - 1) / 3) + 1} ${from.slice(0, 4)}`)
      }
      return { cur: f(q), prev: f(q - 1) }
    }
    case 'year': return { cur: mk(`${ty + o}-01-01`, `${ty + o}-12-31`, String(ty + o)), prev: mk(`${ty + o - 1}-01-01`, `${ty + o - 1}-12-31`, String(ty + o - 1)) }
    case 'ytd': {
      const md = today.slice(4)
      const y = ty + o
      return { cur: mk(`${y}-01-01`, `${y}${md}`, `Hittil i ${y}`), prev: mk(`${y - 1}-01-01`, `${y - 1}${md}`, `Samme periode ${y - 1}`) }
    }
    case '30d': case '90d': case '12m': {
      const n = p.kind === '30d' ? 30 : p.kind === '90d' ? 90 : 365
      const to = addDays(today, o * n)
      return { cur: mk(addDays(to, -n + 1), to, `Siste ${p.kind === '12m' ? '12 måneder' : n + ' dager'}`), prev: mk(addDays(to, -2 * n + 1), addDays(to, -n), 'Forrige periode') }
    }
    case 'custom': {
      const f = p.from ?? first, t = p.to ?? today
      const n = daysBetween(f, t) + 1
      return { cur: mk(f, t, f === t ? fmtDate(f) : `${fmtDate(f)} – ${fmtDate(t)}`), prev: mk(addDays(f, -n), addDays(f, -1), 'Forrige periode') }
    }
    default: return { cur: mk(first, today, 'Alle tider'), prev: null }
  }
}

// ---------- aggregering ----------
export type Gran = 'day' | 'week' | 'month' | 'year'
export const bucketKey = (iso: string, g: Gran) =>
  g === 'day' ? iso.slice(0, 10) : g === 'week' ? weekStart(iso.slice(0, 10)) : g === 'month' ? iso.slice(0, 7) : iso.slice(0, 4)
export function bucketRange(k: string, g: Gran): [string, string] {
  if (g === 'day') return [k, k]
  if (g === 'week') return [k, addDays(k, 6)]
  if (g === 'month') return [k + '-01', ymd(new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)))]
  return [k + '-01-01', k + '-12-31']
}
export function bucketLabel(k: string, g: Gran) {
  if (g === 'day') return `${+k.slice(8)}. ${MONTHS[+k.slice(5, 7) - 1]}`
  if (g === 'week') { const w = isoWeek(k); return `u${w.w} ${String(w.y).slice(2)}` }
  if (g === 'month') return fmtMonth(k)
  return k
}
export function allBuckets(from: string, to: string, g: Gran) {
  const out: string[] = []
  let cur = bucketKey(from + 'T00:00', g)
  const end = bucketKey(to + 'T00:00', g)
  let guard = 0
  while (cur <= end && guard++ < 5000) {
    out.push(cur)
    if (g === 'day') cur = addDays(cur, 1)
    else if (g === 'week') cur = addDays(cur, 7)
    else if (g === 'month') { const y = +cur.slice(0, 4), m = +cur.slice(5, 7); cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` }
    else cur = String(+cur + 1)
  }
  return out
}
export const autoGran = (days: number): Gran => (days <= 62 ? 'day' : days <= 400 ? 'week' : days <= 1500 ? 'month' : 'year')

export function longestStreak(days: string[]) {
  const set = [...new Set(days)].sort()
  let best = 0, cur = 0, bestEnd = '', prev = ''
  for (const s of set) {
    cur = prev && daysBetween(prev, s) === 1 ? cur + 1 : 1
    if (cur > best) { best = cur; bestEnd = s }
    prev = s
  }
  return { best, bestEnd, bestStart: bestEnd ? addDays(bestEnd, -(best - 1)) : '' }
}

// ---------- metrikker ----------
export type MetricDef = { key: string; label: string; unit: string; get: (a: Activity) => number | null; fmt: (v: number) => string; reversed?: boolean }
const pos = (v: number | undefined | null) => (v && v > 0 ? v : null)
export const METRICS: MetricDef[] = [
  { key: 'pace', label: 'Pace', unit: 'min/km', get: (a) => (a.dist > 500 && a.mov > 0 ? a.mov / (a.dist / 1000) : null), fmt: fmtPaceSec, reversed: true },
  { key: 'speed', label: 'Snittfart', unit: 'km/t', get: (a) => (a.dist > 500 && a.mov > 0 ? (a.dist / a.mov) * 3.6 : null), fmt: (v) => nb(v, 1) },
  { key: 'dist', label: 'Distanse', unit: 'km', get: (a) => (a.dist > 0 ? a.dist / 1000 : null), fmt: (v) => nb(v, 1) },
  { key: 'time', label: 'Tid', unit: 'min', get: (a) => (a.mov > 0 ? a.mov / 60 : null), fmt: (v) => nb(v, 0) },
  { key: 'up', label: 'Høydemeter', unit: 'm', get: (a) => pos(a.up), fmt: (v) => nb(v, 0) },
  { key: 'hr', label: 'Snittpuls', unit: 'bpm', get: (a) => pos(a.hr), fmt: (v) => nb(v, 0) },
  { key: 'mhr', label: 'Makspuls', unit: 'bpm', get: (a) => (a.mhr && a.mhr < 230 ? a.mhr : null), fmt: (v) => nb(v, 0) },
  { key: 'rhr', label: 'Hvilepuls', unit: 'bpm', get: (a) => pos(a.rhr), fmt: (v) => nb(v, 0) },
  { key: 'eff', label: 'Aerob effektivitet', unit: 'm/min per slag', get: (a) => (a.hr && a.dist > 3000 && a.mov > 0 ? a.dist / (a.mov / 60) / a.hr : null), fmt: (v) => nb(v, 2) },
  { key: 'vdot', label: 'VO2 maks (VDOT)', unit: '', get: (a) => effortVdot(a), fmt: (v) => nb(v, 1) },
  { key: 'cal', label: 'Kalorier', unit: 'kcal', get: (a) => pos(a.cal), fmt: (v) => nb(v, 0) },
  { key: 'load', label: 'Treningsbelastning', unit: 'TRIMP', get: (a) => pos(a.load), fmt: (v) => nb(v, 0) },
  { key: 'te', label: 'Aerob treningseffekt', unit: '/5', get: (a) => pos(a.te), fmt: (v) => nb(v, 1) },
  { key: 'cad', label: 'Kadens', unit: 'spm', get: (a) => pos(a.cad), fmt: (v) => nb(v, 0) },
  { key: 'stride', label: 'Steglengde', unit: 'm', get: (a) => pos(a.stride), fmt: (v) => nb(v, 2) },
  { key: 'gct', label: 'Bakkekontakt', unit: 'ms', get: (a) => pos(a.gct), fmt: (v) => nb(v, 0) },
  { key: 'w', label: 'Snitt watt', unit: 'W', get: (a) => pos(a.w), fmt: (v) => nb(v, 0) },
  { key: 'vmax', label: 'Toppfart', unit: 'km/t', get: (a) => (a.vmax ? a.vmax * 3.6 : null), fmt: (v) => nb(v, 1) },
  { key: 'temp', label: 'Temperatur', unit: '°C', get: (a) => a.temp ?? null, fmt: (v) => nb(v, 0) },
  { key: 're', label: 'Relative Effort', unit: '', get: (a) => pos(a.re), fmt: (v) => nb(v, 0) },
]
/** VDOT (Daniels) fra beste innsats 3–21 km der pulsen viser hard innsats (≥ 80 % av makspuls) */
export function effortVdot(a: Activity): number | null {
  if (!a.be) return null
  let best: number | null = null
  for (const k of ['3k', '5k', '10k', '15k', 'hm']) {
    const e = a.be[k]; if (!e) continue
    if (e[1] != null && e[1] < 0.8 * (a.hrmax || 206)) continue
    const t = e[0] / 60, v = BE_DIST[k] / t
    const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
    const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
    const r = vo2 / pct
    if (r > 30 && (best == null || r > best)) best = r
  }
  return best
}
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>

export const BE_LABELS: Record<string, string> = { '1k': '1 km', '1mi': '1 mile', '3k': '3 km', '5k': '5 km', '10k': '10 km', '15k': '15 km', hm: 'Halvmaraton', m: 'Maraton' }
export const BE_DIST: Record<string, number> = { '1k': 1000, '1mi': 1609.344, '3k': 3000, '5k': 5000, '10k': 10000, '15k': 15000, hm: 21097.5, m: 42195 }

export function rolling(points: { x: number; y: number }[], window: number) {
  const s = [...points].sort((a, b) => a.x - b.x)
  return s.map((p, i) => { const sl = s.slice(Math.max(0, i - window + 1), i + 1); return { x: p.x, y: sl.reduce((a, b) => a + b.y, 0) / sl.length } })
}

export function sumBy(acts: Activity[]) {
  const days = new Set(acts.map((a) => dayKey(a.d)))
  return {
    count: acts.length, dist: acts.reduce((x, a) => x + a.dist, 0), mov: acts.reduce((x, a) => x + a.mov, 0),
    up: acts.reduce((x, a) => x + a.up, 0), cal: acts.reduce((x, a) => x + (a.cal ?? 0), 0),
    load: acts.reduce((x, a) => x + a.load, 0), days: days.size,
  }
}

export function toCsv(acts: Activity[]) {
  const head = ['dato', 'navn', 'idrett', 'distanse_km', 'bevegelsestid_s', 'hoydemeter', 'snittpuls', 'makspuls', 'kalorier', 'belastning']
  const q = (s: string | number | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`
  return [head.join(','), ...acts.map((a) => [a.d, a.n, a.t, (a.dist / 1000).toFixed(2), a.mov, a.up, a.hr ?? '', a.mhr ?? '', a.cal ?? '', a.load].map(q).join(','))].join('\n')
}

/** Raskeste realistiske tempo (sek/km) per idrett – raskere beste-innsats er GPS-glipp */
const MIN_PACE: Record<string, number> = { Løpetur: 160, Gåtur: 160, Langrenn: 60, Rulleski: 60, Sykkeltur: 40 }

/** Fjerner umulige beste-innsatser (GPS-hopp) slik at de ikke blir rekorder */
const MAX_SPEED: Record<string, number> = { Løpetur: 9, Gåtur: 9, Langrenn: 25, Rulleski: 25, Sykkeltur: 30 } // m/s

export function sanitize(all: Activity[]): Activity[] {
  for (const a of all) {
    if (a.vmax && a.vmax > (MAX_SPEED[a.t] ?? 30)) a.vmax = undefined
    if (!a.be) continue
    const min = MIN_PACE[a.t] ?? 40
    for (const k of Object.keys(a.be)) if (a.be[k][0] / (BE_DIST[k] / 1000) < min) delete a.be[k]
    if (!Object.keys(a.be).length) a.be = undefined
  }
  return all
}
