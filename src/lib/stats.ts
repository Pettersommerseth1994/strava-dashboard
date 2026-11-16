import { type Activity, isoWeekKey, dayKey } from '@/lib/data'

export function longestStreak(days: string[]) {
  const set = [...new Set(days)].sort()
  let best = 0, cur = 0, end = '', prev = 0
  for (const s of set) {
    const t = new Date(s + 'T00:00:00Z').getTime()
    cur = prev && t - prev === 86400000 ? cur + 1 : 1
    if (cur > best) { best = cur; end = s }
    prev = t
  }
  return { best, end }
}

export const maxBy = (pool: Activity[], f: (a: Activity) => number | null | undefined) =>
  pool.reduce<Activity | undefined>((b, a) => { const v = f(a); return v != null && v > 0 && (!b || v > (f(b) ?? 0)) ? a : b }, undefined)
export const minBy = (pool: Activity[], f: (a: Activity) => number | null | undefined) =>
  pool.reduce<Activity | undefined>((b, a) => { const v = f(a); return v != null && v > 0 && (!b || v < (f(b) ?? Infinity)) ? a : b }, undefined)

export function sum(pool: Activity[], f: (a: Activity) => number | null | undefined) {
  let t = 0; for (const a of pool) t += f(a) ?? 0; return t
}

export function topGroups(pool: Activity[], key: (a: Activity) => string, val: (a: Activity) => number) {
  const m = new Map<string, number>()
  for (const a of pool) m.set(key(a), (m.get(key(a)) ?? 0) + val(a))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
export const weekGroups = (p: Activity[], v: (a: Activity) => number) => topGroups(p, (a) => isoWeekKey(a.d), v)
export const dayGroups = (p: Activity[], v: (a: Activity) => number) => topGroups(p, (a) => dayKey(a.d), v)

/** Estimert treningsbelastning (TRIMP) per økt */
export function trimp(a: Activity) {
  const min = a.mov / 60
  const x = a.hr ? Math.min(1, Math.max(0, (a.hr - 50) / (190 - 50))) : 0.45
  return min * x * 0.64 * Math.exp(1.92 * x)
}

/** CTL (42d), ATL (7d) og form per dag */
export function loadSeries(all: Activity[], from: string, to: string) {
  const daily = new Map<string, number>()
  for (const a of all) daily.set(dayKey(a.d), (daily.get(dayKey(a.d)) ?? 0) + trimp(a))
  const start = all.length ? dayKey(all[0].d) : from
  let ctl = 0, atl = 0
  const out: { day: string; ctl: number; atl: number; form: number; load: number }[] = []
  for (let t = new Date(start + 'T00:00:00Z').getTime(); t <= new Date(to + 'T00:00:00Z').getTime(); t += 86400000) {
    const k = new Date(t).toISOString().slice(0, 10)
    const l = daily.get(k) ?? 0
    const form = ctl - atl
    ctl += (l - ctl) / 42; atl += (l - atl) / 7
    if (k >= from) out.push({ day: k, ctl: Math.round(ctl), atl: Math.round(atl), form: Math.round(form), load: Math.round(l) })
  }
  return out
}
