import { type Activity, todayStr } from '@/lib/data'

export const TODAY = todayStr()
export const YEAR = Number(TODAY.slice(0, 4))

/** Dag i året (1-basert) for en ISO-dato */
export function doy(iso: string) {
  const y = Number(iso.slice(0, 4))
  return Math.floor((Date.UTC(y, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(y, 0, 1)) / 86400000) + 1
}
export const daysInYear = (y: number) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365)
export const inYear = (acts: Activity[], y: number) => acts.filter((a) => a.d.startsWith(String(y)))
/** Aktiviteter i år y fram til og med samme dag i året som i dag */
export const ytd = (acts: Activity[], y: number, upTo = doy(TODAY)) => inYear(acts, y).filter((a) => doy(a.d) <= upTo)
