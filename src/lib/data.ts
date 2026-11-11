export type Activity = {
  id: string; d: string; n: string; t: string
  dist: number; mov: number; el: number; up: number
  hr: number | null; mhr: number | null; cal: number | null; vmax: number | null; w: number | null
}

export const SPORT_COLORS: Record<string, string> = {
  Løpetur: 'oklch(0.7 0.19 45)',
  Langrenn: 'oklch(0.68 0.15 235)',
  Rulleski: 'oklch(0.72 0.16 160)',
  Sykkeltur: 'oklch(0.75 0.16 95)',
  Styrketrening: 'oklch(0.65 0.2 305)',
  Treningsøkt: 'oklch(0.68 0.19 0)',
  Annet: 'oklch(0.65 0.02 260)',
}
export const MAIN_SPORTS = ['Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur', 'Styrketrening', 'Treningsøkt']
export const sportOf = (t: string) => (MAIN_SPORTS.includes(t) ? t : 'Annet')

export const fmtKm = (m: number, d = 1) => (m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d })
export const fmtInt = (n: number) => Math.round(n).toLocaleString('nb-NO')
export const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
  return h ? `${h}t ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`
}
export const fmtHours = (s: number) => (s / 3600).toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' t'
export const fmtPace = (distM: number, sec: number) => {
  if (!distM) return '–'
  const p = sec / (distM / 1000)
  return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')} /km`
}
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })

export const dayKey = (iso: string) => iso.slice(0, 10)
export function isoWeekKey(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export function longestStreak(days: string[]) {
  const set = [...new Set(days)].sort()
  let best = 0, cur = 0, bestEnd = '', prev = 0
  for (const s of set) {
    const t = new Date(s + 'T00:00:00Z').getTime()
    cur = prev && t - prev === 86400000 ? cur + 1 : 1
    if (cur > best) { best = cur; bestEnd = s }
    prev = t
  }
  return { best, bestEnd }
}
