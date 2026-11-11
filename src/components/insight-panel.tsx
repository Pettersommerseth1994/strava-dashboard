import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, HeartPulse, Shuffle, Sparkles, Trophy, TrendingUp, Repeat, Smile, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { buildInsights, type Insight } from '@/lib/insights'

const ICON = { trend: TrendingUp, record: Trophy, habit: Repeat, fun: Smile, health: HeartPulse } as const

function shuffled<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function InsightPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { all, open: openAct, goRange } = useStore()
  const insights = useMemo(() => buildInsights(all), [all])
  const [deck, setDeck] = useState<Insight[]>(() => shuffled(insights))
  const [i, setI] = useState(0)
  const [spin, setSpin] = useState(0)
  useEffect(() => { setDeck(shuffled(insights)); setI(0) }, [insights])
  const cur = deck[i % Math.max(1, deck.length)]
  const next = () => {
    setSpin((s) => s + 1)
    if (i + 1 >= deck.length) { const d = shuffled(insights); if (d[0]?.id === cur?.id) d.push(d.shift()!); setDeck(d); setI(0) } else setI(i + 1)
  }
  if (!cur) return null
  const Icon = ICON[cur.kind]
  return (
    <aside
      aria-live="polite"
      className={cn(
        'bg-popover/95 text-popover-foreground fixed right-4 bottom-4 z-30 w-[calc(100%-2rem)] rounded-2xl border shadow-2xl backdrop-blur transition-all duration-500 ease-out sm:right-6 sm:bottom-6 sm:w-80',
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0',
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"><Sparkles className="size-3.5 text-[var(--brand)]" />Innsikt</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Lukk innsikt"><X /></Button>
        </div>
      </div>
      <div key={cur.id + spin} className="animate-in fade-in slide-in-from-right-4 space-y-2 px-4 py-4 duration-300">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"><Icon className="size-3.5" />{cur.label}</p>
        <p className="text-[15px] leading-snug font-medium text-balance">{cur.text}</p>
        {cur.sub && <p className="text-muted-foreground text-xs leading-relaxed">{cur.sub}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        {cur.actId ? (
          <Button variant="ghost" size="sm" onClick={() => openAct(cur.actId!)}>Åpne økten<ArrowUpRight /></Button>
        ) : cur.range ? (
          <Button variant="ghost" size="sm" onClick={() => goRange(cur.range![0], cur.range![1])}>Vis perioden<ArrowUpRight /></Button>
        ) : <span />}
        <Button size="sm" onClick={next} className="gap-1.5"><Shuffle className={cn('transition-transform duration-500', spin % 2 ? 'rotate-180' : '')} />Ny innsikt</Button>
      </div>
    </aside>
  )
}
