import { type Activity, MONTHS, isoWeekKey } from '@/lib/data'
import { addDays, diffDays, isoWeek, mondayOf, today } from '@/lib/period'

export type Gran = 'day' | 'week' | 'month'
export const autoGran = (from: string, to: string): Gran => { const n = diffDays(from, to); return n <= 45 ? 'day' : n <= 250 ? 'week' : 'month' }
export const keyOf = (a: Activity, g: Gran) => (g === 'day' ? a.d.slice(0, 10) : g === 'week' ? isoWeekKey(a.d) : a.d.slice(0, 7))
export function labelOf(k: string, g: Gran) {
  if (g === 'month') return `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`
  if (g === 'week') return `u${isoWeek(k).w} ${k.slice(2, 4)}`
  return `${+k.slice(8)}. ${MONTHS[+k.slice(5, 7) - 1]}`
}
export function bucketKeys(from: string, to: string, g: Gran) {
  const end = to > today() ? today() : to
  const out: string[] = []
  if (g === 'day') for (let d = from; d <= end; d = addDays(d, 1)) out.push(d)
  else if (g === 'week') for (let d = mondayOf(from); d <= end; d = addDays(d, 7)) out.push(d)
  else { let y = +from.slice(0, 4), m = +from.slice(5, 7); while (`${y}-${String(m).padStart(2, '0')}` <= end.slice(0, 7)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++ } } }
  return out
}
