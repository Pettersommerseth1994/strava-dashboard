export type Kind = 'all' | 'ytd' | 'rolling' | 'week' | 'month' | 'year' | 'custom'
export type Range = { kind: Kind; from: string; to: string; label: string }

const D = 86400000
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const parse = (s: string) => new Date(s + 'T00:00:00Z')
export const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * D))
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / D)
export const today = () => {
  const n = new Date()
  return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())))
}
export const mondayOf = (s: string) => addDays(s, -((parse(s).getUTCDay() + 6) % 7))
export function isoWeek(s: string) {
  const d = parse(mondayOf(s)); d.setUTCDate(d.getUTCDate() + 3)
  const y = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const w = 1 + Math.round((d.getTime() - 3 * D - parse(mondayOf(iso(jan4))).getTime()) / (7 * D))
  return { y, w }
}
export const weekLabel = (s: string) => { const { y, w } = isoWeek(s); return `uke ${w} ${y}` }
const MN = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const fmt = (s: string) => parse(s).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function label(kind: Kind, from: string, to: string) {
  const d = parse(from)
  if (kind === 'all') return 'Hele perioden'
  if (kind === 'ytd') return `Hittil i år (${d.getUTCFullYear()})`
  if (kind === 'week') return weekLabel(from)
  if (kind === 'month') return `${MN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  if (kind === 'year') return String(d.getUTCFullYear())
  return `${fmt(from)} – ${fmt(to)}`
}
export const make = (kind: Kind, from: string, to: string): Range => ({ kind, from, to, label: label(kind, from, to) })

export const presets = {
  all: (min: string) => make('all', min, today()),
  ytd: () => { const t = today(); return make('ytd', t.slice(0, 4) + '-01-01', t) },
  rolling: (n: number) => { const t = today(); return make('rolling', addDays(t, -(n - 1)), t) },
  week: (s = today()) => { const m = mondayOf(s); return make('week', m, addDays(m, 6)) },
  month: (y: number, m: number) => { const f = `${y}-${String(m + 1).padStart(2, '0')}-01`; return make('month', f, iso(new Date(Date.UTC(y, m + 1, 0)))) },
  year: (y: number) => make('year', `${y}-01-01`, `${y}-12-31`),
  custom: (f: string, t: string) => make('custom', f, t),
}

export function step(r: Range, dir: 1 | -1): Range {
  if (r.kind === 'week') return presets.week(addDays(r.from, 7 * dir))
  if (r.kind === 'month') { const d = parse(r.from); return presets.month(d.getUTCFullYear(), d.getUTCMonth() + dir) }
  if (r.kind === 'year' || r.kind === 'ytd') return presets.year(parse(r.from).getUTCFullYear() + dir)
  const n = diffDays(r.from, r.to) + 1
  return make('custom', addDays(r.from, n * dir), addDays(r.to, n * dir))
}
export function previous(r: Range): Range {
  if (r.kind === 'ytd') { const y = parse(r.from).getUTCFullYear() - 1; return make('custom', `${y}-01-01`, `${y}${r.to.slice(4)}`) }
  if (r.kind === 'week' || r.kind === 'month' || r.kind === 'year') return step(r, -1)
  const n = diffDays(r.from, r.to) + 1
  return make('custom', addDays(r.from, -n), addDays(r.from, -1))
}
export const inRange = (dateIso: string, r: Range) => { const d = dateIso.slice(0, 10); return d >= r.from && d <= r.to }
export function weekFromInput(v: string) { // 'YYYY-Www'
  const [y, w] = v.split('-W').map(Number)
  const jan4 = `${y}-01-04`
  return presets.week(addDays(mondayOf(jan4), (w - 1) * 7))
}
export function weekToInput(r: Range) { const { y, w } = isoWeek(r.from); return `${y}-W${String(w).padStart(2, '0')}` }
