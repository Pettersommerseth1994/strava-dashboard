import { useMemo, useState } from 'react'
import { Lightbulb, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { type Activity, fmtDate, fmtInt, fmtKm } from '@/lib/data'
import { cn } from '@/lib/utils'
import { trimPrivacy, useLocalData } from '../local'
import { RouteSvg, shuffle } from './shared'

const ROUNDS = 10
const BEST_KEY = 'gjett-okten-best'
type Round = { answer: Activity; options: Activity[] }

/** «Gjett økten»: se ruteformen og gjett hvilken økt det var */
export function Quiz() {
  const { all, open } = useStore()
  const local = useLocalData()
  const [seed, setSeed] = useState(() => Math.random())
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [hints, setHints] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 } })

  const rounds = useMemo<Round[]>(() => {
    if (!local) return []
    const pool = all.filter((a) => a.dist > 2000 && (local.tracks[a.id]?.length ?? 0) > 20)
    const picks = shuffle(pool, seed).slice(0, ROUNDS)
    return picks.map((answer, k) => {
      const same = pool.filter((a) => a.t === answer.t && a.id !== answer.id && Math.abs(a.dist - answer.dist) < answer.dist * 0.6)
      const others = shuffle(same.length >= 3 ? same : pool.filter((a) => a.id !== answer.id), seed + k + 1).slice(0, 3)
      return { answer, options: shuffle([answer, ...others], seed + k + 0.5) }
    })
  }, [all, local, seed])

  const done = i >= rounds.length && rounds.length > 0
  const r = rounds[i]
  const track = useMemo(() => (r && local ? trimPrivacy(local.tracks[r.answer.id]) : undefined), [r, local])

  const choose = (id: string) => {
    if (chosen || !r) return
    setChosen(id)
    if (id === r.answer.id) { const pts = hints === 0 ? 3 : hints === 1 ? 2 : 1; setScore((s) => s + pts); setStreak((s) => s + 1) } else setStreak(0)
  }
  const next = () => {
    setChosen(null); setHints(0)
    const ni = i + 1
    setI(ni)
    if (ni >= rounds.length && score > best) { setBest(score); try { localStorage.setItem(BEST_KEY, String(score)) } catch { /* ignore */ } }
  }
  const restart = () => { setSeed(Math.random()); setI(0); setScore(0); setStreak(0); setHints(0); setChosen(null) }

  if (!local) return <p className="text-muted-foreground text-sm">Laster ruter …</p>
  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-4 rounded-3xl border p-6 text-center">
        <Trophy className="mx-auto size-10 text-[var(--brand)]" />
        <p className="text-4xl font-black tabular-nums">{score}<span className="text-muted-foreground text-lg font-medium"> / {ROUNDS * 3}</span></p>
        <p className="text-sm">{score >= 24 ? 'Du kjenner rutene dine utenat! 🗺️' : score >= 15 ? 'Godt jobbet – du har god stedsans.' : 'Rutene ligner jo litt på hverandre …'}</p>
        <p className="text-muted-foreground text-xs">Beste resultat: {Math.max(best, score)}</p>
        <Button className="h-10" onClick={restart}><RotateCcw />Spill igjen</Button>
      </div>
    )
  }
  if (!r) return null
  const hint = (k: number) => k === 0 ? `${r.answer.t}` : k === 1 ? `${fmtKm(r.answer.dist)} km` : `${fmtInt(r.answer.up)} høydemeter`

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between text-sm tabular-nums">
        <span className="text-muted-foreground">Runde {i + 1} av {rounds.length}</span>
        <span>{streak >= 2 && <span className="mr-2">🔥 {streak}</span>}<b>{score}</b> poeng</span>
      </div>
      <div className="bg-muted/40 relative aspect-square overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brand)_15%,transparent),transparent_70%)]">
        <RouteSvg pts={track} glow width={3.5} className="absolute inset-6 size-[calc(100%-3rem)]" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {Array.from({ length: hints }, (_, k) => <span key={k} className="rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">{hint(k)}</span>)}
        </div>
        {!chosen && hints < 3 && (
          <Button size="sm" variant="secondary" className="absolute right-3 bottom-3 h-9" onClick={() => setHints((h) => h + 1)}><Lightbulb />Hint (−1 poeng)</Button>
        )}
      </div>
      <p className="text-center text-sm font-medium">Hvilken økt er dette?</p>
      <div className="grid gap-2">
        {r.options.map((o) => {
          const right = chosen && o.id === r.answer.id, wrong = chosen === o.id && o.id !== r.answer.id
          return (
            <button key={o.id} type="button" onClick={() => choose(o.id)} disabled={!!chosen}
              className={cn('flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
                !chosen && 'hover:bg-muted', right && 'border-transparent bg-[var(--brand)] text-white', wrong && 'bg-muted line-through opacity-70')}>
              <span className="min-w-0"><span className="block truncate font-medium">{o.n}</span><span className={cn('text-xs', right ? 'text-white/80' : 'text-muted-foreground')}>{fmtDate(o.d)}</span></span>
              {chosen && <span className="shrink-0 text-xs tabular-nums">{fmtKm(o.dist)} km</span>}
            </button>
          )
        })}
      </div>
      {chosen && (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-muted-foreground h-10 text-sm underline-offset-2 hover:underline" onClick={() => open(r.answer.id)}>Åpne økten</button>
          <Button className="h-10" onClick={next}>{i + 1 >= rounds.length ? 'Se resultat' : 'Neste'}</Button>
        </div>
      )}
    </div>
  )
}
