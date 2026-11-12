import { useMemo, useState } from 'react'
import { CalendarHeart, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { MONTHS_LONG, addDays, fmtDate, todayStr } from '@/lib/data'
import { type Mem, Loading, MemThumb, SportPill, dayDiff, statLine, useMemories } from './common'

const WINDOW = 3 // ± dager rundt samme dato

/** 2 · Tilbakeblikk – «på denne dagen» i tidligere år */
export function Throwback() {
  const items = useMemories()
  const { open } = useStore()
  const [day, setDay] = useState(todayStr())
  const [sel, setSel] = useState(0)

  const groups = useMemo(() => {
    if (!items) return null
    const y = +day.slice(0, 4)
    const hit = (window: number) => {
      const by = new Map<number, Mem[]>()
      for (const m of items) {
        const my = +m.a.d.slice(0, 4)
        if (my >= y || dayDiff(m.a.d, day) > window) continue
        if (!by.has(my)) by.set(my, [])
        by.get(my)!.push(m)
      }
      return [...by.entries()].sort((a, b) => b[0] - a[0])
    }
    const exact = hit(WINDOW)
    if (exact.length) return { exact: true, list: exact }
    // Ingen treff: finn nærmeste dato med minner
    const best = [...items].filter((m) => +m.a.d.slice(0, 4) < y).sort((a, b) => dayDiff(a.a.d, day) - dayDiff(b.a.d, day))[0]
    if (!best) return { exact: false, list: [] as [number, Mem[]][] }
    const w = Math.ceil(dayDiff(best.a.d, day))
    return { exact: false, list: hit(w + 1) }
  }, [items, day])

  if (!items || !groups) return <Loading />
  if (!items.length) return <Loading empty />

  const label = `${+day.slice(8, 10)}. ${MONTHS_LONG[+day.slice(5, 7) - 1]}`
  const flat = groups.list.flatMap(([, ms]) => ms)
  const cur = flat[Math.min(sel, flat.length - 1)]
  const shift = (n: number) => { setDay(addDays(day, n)); setSel(0) }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Dagen før"><ChevronLeft /></Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold"><CalendarHeart className="size-4 text-[var(--brand)]" />På denne dagen · {label}</p>
          <p className="text-muted-foreground text-xs">{groups.exact ? `Minner fra ± ${WINDOW} dager i tidligere år` : 'Ingen minner akkurat nå – her er de nærmeste'}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Dagen etter"><ChevronRight /></Button>
      </div>

      {!cur ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Ingen tidligere år med bilder rundt denne datoen.</p>
      ) : (
        <>
          <button onClick={() => open(cur.id)} className="relative block h-60 w-full cursor-pointer overflow-hidden rounded-2xl bg-black text-left sm:h-72">
            <MemThumb key={cur.key} m={cur} playing={cur.k === 'vid'} fit="cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" />
            <span className="absolute top-3 left-3 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-bold text-white shadow">
              For {+day.slice(0, 4) - +cur.a.d.slice(0, 4)} år siden
            </span>
            <span className="absolute top-3 right-3"><SportPill a={cur.a} /></span>
            <span className="absolute inset-x-0 bottom-0 p-4 text-white">
              <span className="block text-xs text-white/70">{fmtDate(cur.a.d)}</span>
              <span className="block text-lg leading-snug font-semibold">{cur.a.n}</span>
              <span className="block text-sm text-white/85 tabular-nums">{statLine(cur.a)}</span>
            </span>
          </button>
          {flat.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {groups.list.map(([yr, ms]) => (
                <div key={yr} className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground w-10 text-xs font-semibold tabular-nums">{yr}</span>
                  {ms.map((m) => {
                    const i = flat.indexOf(m)
                    return (
                      <button key={m.key} onClick={() => setSel(i)} aria-label={m.a.n}
                        className={`size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-2 transition ${i === sel ? 'ring-[var(--brand)]' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                        <MemThumb m={m} />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
