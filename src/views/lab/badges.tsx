import { useMemo, useState, type ComponentType } from 'react'
import { Award, Clock, Flame, Medal, Moon, Mountain, MountainSnow, Route, Shapes, Snowflake, Sunrise, Timer, Trophy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '@/lib/store'
import { TODAY } from './shared'
import { type Activity, dayKey, daysBetween, fmtClock, fmtDate, fmtInt, fmtNum, isoWeek } from '@/lib/data'

type Result = { done: boolean; date?: string; actId?: string; progress: number; now: string }
type Badge = { id: string; icon: ComponentType<{ className?: string }>; title: string; rule: string; calc: (s: Activity[]) => Result }

const run = (a: Activity) => a.t === 'Løpetur'
const hour = (a: Activity) => Number(a.d.slice(11, 13))

/** Første aktivitet der en løpende sum krysser terskelen */
function crossing(s: Activity[], f: (a: Activity) => number, goal: number, unit: (v: number) => string): Result {
  let sum = 0
  for (const a of s) { sum += f(a); if (sum >= goal) return { done: true, date: a.d, actId: a.id, progress: 1, now: unit(sum) } }
  return { done: false, progress: sum / goal, now: unit(sum) }
}
/** Første enkeltøkt som oppfyller kravet, ellers beste forsøk */
function single(s: Activity[], f: (a: Activity) => number | null, goal: number, unit: (v: number) => string, lowerIsBetter = false): Result {
  let best: number | null = null
  for (const a of s) {
    const v = f(a); if (v == null) continue
    if (lowerIsBetter ? v <= goal : v >= goal) return { done: true, date: a.d, actId: a.id, progress: 1, now: unit(v) }
    if (best == null || (lowerIsBetter ? v < best : v > best)) best = v
  }
  return { done: false, progress: best == null ? 0 : lowerIsBetter ? goal / best : best / goal, now: best == null ? 'Ingen forsøk ennå' : `Beste: ${unit(best)}` }
}
const count = (n: number) => (s: Activity[]) => crossing(s, () => 1, n, (v) => `${fmtInt(v)} økter`)

const BADGES: Badge[] = [
  { id: 'n100', icon: Medal, title: '100 økter', rule: 'Logg 100 økter totalt.', calc: count(100) },
  { id: 'n500', icon: Award, title: '500 økter', rule: 'Logg 500 økter totalt.', calc: count(500) },
  { id: 'n1000', icon: Trophy, title: '1 000 økter', rule: 'Logg 1 000 økter totalt.', calc: count(1000) },
  { id: 'everest', icon: Mountain, title: 'Everest-klubben', rule: 'Klatre 8 849 høydemeter totalt – Mount Everest fra havnivå.', calc: (s) => crossing(s, (a) => a.up, 8849, (v) => `${fmtInt(v)} hm`) },
  { id: 'everest10', icon: MountainSnow, title: '10 × Everest', rule: 'Klatre 88 490 høydemeter totalt.', calc: (s) => crossing(s, (a) => a.up, 88490, (v) => `${fmtInt(v)} hm`) },
  { id: 'marathon', icon: Route, title: 'Maratondistanse', rule: 'Fullfør minst 42,2 km i én økt, uansett idrett.', calc: (s) => single(s, (a) => a.dist, 42195, (v) => `${fmtNum(v / 1000, 1)} km`) },
  { id: 'sub25', icon: Zap, title: 'Sub 25 på 5 km', rule: 'Løp 5 km på under 25:00 (beste 5 km i en løpetur).', calc: (s) => single(s, (a) => (run(a) && a.be?.['5k'] ? a.be['5k'][0] : null), 1500, (v) => fmtClock(v), true) },
  { id: 'long', icon: Clock, title: 'Langkjøring', rule: 'Vær i bevegelse i minst 4 timer i én økt.', calc: (s) => single(s, (a) => a.mov, 4 * 3600, (v) => `${fmtNum(v / 3600, 1)} t`) },
  { id: 'climb', icon: Mountain, title: 'Fjellgeit', rule: 'Klatre 1 500 høydemeter i én økt.', calc: (s) => single(s, (a) => a.up, 1500, (v) => `${fmtInt(v)} hm`) },
  {
    id: 'streak30', icon: Flame, title: '30 dager på rad', rule: 'Tren minst én økt hver dag i 30 dager.', calc: (s) => {
      let cur = 0, best = 0, prev = ''
      for (const a of s) {
        const d = dayKey(a.d); if (d === prev) continue
        cur = prev && daysBetween(prev, d) === 1 ? cur + 1 : 1; prev = d; best = Math.max(best, cur)
        if (cur >= 30) return { done: true, date: a.d, actId: a.id, progress: 1, now: '30 dager' }
      }
      return { done: false, progress: best / 30, now: `Lengste: ${best} dager` }
    },
  },
  {
    id: 'allround', icon: Shapes, title: 'Allsidig', rule: 'Gjør fire ulike idretter i løpet av én uke.', calc: (s) => {
      const weeks = new Map<string, Set<string>>(); let best = 0
      for (const a of s) {
        const k = `${a.d.slice(0, 4)}-${isoWeek(dayKey(a.d))}`
        if (!weeks.has(k)) weeks.set(k, new Set()); const w = weeks.get(k)!; w.add(a.t); best = Math.max(best, w.size)
        if (w.size >= 4) return { done: true, date: a.d, actId: a.id, progress: 1, now: `${w.size} idretter` }
      }
      return { done: false, progress: best / 4, now: `Flest: ${best} idretter` }
    },
  },
  { id: 'early', icon: Sunrise, title: 'Morgenfugl', rule: 'Start 10 økter før klokka 06.', calc: (s) => crossing(s, (a) => (hour(a) < 6 ? 1 : 0), 10, (v) => `${v} økter`) },
  { id: 'night', icon: Moon, title: 'Nattugle', rule: 'Start 10 økter klokka 21 eller senere.', calc: (s) => crossing(s, (a) => (hour(a) >= 21 ? 1 : 0), 10, (v) => `${v} økter`) },
  { id: 'cold', icon: Snowflake, title: 'Iskald', rule: 'Tren ute i −15 °C eller kaldere.', calc: (s) => single(s, (a) => (a.temp == null ? null : -a.temp), 15, (v) => `${fmtNum(-v, 1)} °C`) },
  {
    id: 'run1000', icon: Timer, title: '1 000 km løping på ett år', rule: 'Løp 1 000 km i løpet av ett kalenderår.', calc: (s) => {
      const per = new Map<string, number>(); let best = 0
      for (const a of s) {
        if (!run(a)) continue
        const y = a.d.slice(0, 4), v = (per.get(y) ?? 0) + a.dist / 1000; per.set(y, v); best = Math.max(best, v)
        if (v >= 1000) return { done: true, date: a.d, actId: a.id, progress: 1, now: `1 000 km i ${y}` }
      }
      return { done: false, progress: best / 1000, now: `Beste år: ${fmtInt(best)} km` }
    },
  },
]

export function Badges() {
  const { all, open } = useStore()
  const sorted = useMemo(() => [...all].sort((a, b) => a.d.localeCompare(b.d)), [all])
  const res = useMemo(() => BADGES.map((b) => ({ b, r: b.calc(sorted) })), [sorted])
  const [sel, setSel] = useState<string | null>(null)
  const cur = res.find((x) => x.b.id === sel)
  const unlocked = res.filter((x) => x.r.done).length
  const recent = res.filter((x) => x.r.done && x.r.date && daysBetween(dayKey(x.r.date), TODAY) <= 90)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm"><b className="text-2xl font-bold tabular-nums">{unlocked}</b><span className="text-muted-foreground"> av {res.length} låst opp</span></p>
        <div className="bg-muted h-2 min-w-32 flex-1 overflow-hidden rounded-full"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(unlocked / res.length) * 100}%` }} /></div>
        {recent.length > 0 && <p className="text-muted-foreground w-full text-xs">Nylig: {recent.map((x) => x.b.title).join(', ')}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {res.map(({ b, r }) => {
          const Icon = b.icon
          return (
            <button key={b.id} onClick={() => setSel(b.id)}
              className={`group flex min-h-28 cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${r.done ? 'border-[color-mix(in_oklch,var(--brand)_45%,transparent)] bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]' : 'opacity-70'}`}>
              <span className={`grid size-11 place-items-center rounded-full ${r.done ? 'bg-[var(--brand)] text-white shadow-[0_0_0_4px_color-mix(in_oklch,var(--brand)_20%,transparent)]' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="size-5" />
              </span>
              <span className="text-xs leading-tight font-medium">{b.title}</span>
              {r.done
                ? <span className="text-muted-foreground text-[10.5px] tabular-nums">{fmtDate(r.date!)}</span>
                : <span className="bg-muted mt-auto h-1 w-full overflow-hidden rounded-full"><span className="bg-foreground/40 block h-full" style={{ width: `${Math.min(100, r.progress * 100)}%` }} /></span>}
            </button>
          )
        })}
      </div>
      <Dialog open={!!cur} onOpenChange={(o) => !o && setSel(null)}>
        {cur && (
          <DialogContent>
            <DialogHeader className="items-center text-center">
              <span className={`mb-2 grid size-16 place-items-center rounded-full ${cur.r.done ? 'bg-[var(--brand)] text-white' : 'bg-muted text-muted-foreground'}`}><cur.b.icon className="size-8" /></span>
              <DialogTitle className="text-lg">{cur.b.title}</DialogTitle>
              <DialogDescription>{cur.b.rule}</DialogDescription>
            </DialogHeader>
            {cur.r.done ? (
              <p className="text-center text-sm">Låst opp <b>{fmtDate(cur.r.date!)}</b></p>
            ) : (
              <div className="space-y-1.5">
                <div className="bg-muted h-2 overflow-hidden rounded-full"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, cur.r.progress * 100)}%` }} /></div>
                <p className="text-muted-foreground flex justify-between text-xs"><span>{cur.r.now}</span><span className="tabular-nums">{fmtInt(Math.min(99, cur.r.progress * 100))} %</span></p>
              </div>
            )}
            {cur.r.actId && <Button className="h-10 w-full cursor-pointer" onClick={() => { const id = cur.r.actId!; setSel(null); open(id) }}>Åpne økten</Button>}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
