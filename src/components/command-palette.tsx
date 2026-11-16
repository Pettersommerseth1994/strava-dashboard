import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { CornerDownLeft, Moon, RotateCcw, Search, Sparkles, Sun } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SportDot } from '@/components/common'
import { type ShellActions, VIEWS } from '@/components/shell'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { fmtDate, fmtDur, fmtKm } from '@/lib/data'

type Item = { id: string; group: string; label: string; hint?: string; icon?: ComponentType<{ className?: string }>; sport?: string; run: () => void }

/** Kommandopalett (⌘K): hopp til en side, finn en økt eller kjør en handling */
export function CommandPalette({ open, onOpenChange, a }: { open: boolean; onOpenChange: (o: boolean) => void; a: ShellActions }) {
  const { all, open: openAct, filtered, resetFilters } = useStore()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) { setQ(''); setIdx(0) } }, [open])

  const items = useMemo<Item[]>(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const hit = (s: string) => words.every((w) => s.toLowerCase().includes(w))
    const close = (f: () => void) => () => { onOpenChange(false); f() }

    const pages: Item[] = VIEWS.filter((v) => hit(`${v.label} ${v.desc} ${v.group}`))
      .map((v) => ({ id: `v-${v.k}`, group: 'Gå til', label: v.label, hint: v.desc, icon: v.icon, run: close(() => a.go(v.k)) }))

    const sessions: Item[] = []
    for (let i = all.length - 1; i >= 0 && sessions.length < (words.length ? 8 : 5); i--) {
      const s = all[i]
      if (words.length && !hit(`${s.n} ${s.t} ${fmtDate(s.d)} ${s.d.slice(0, 10)}`)) continue
      sessions.push({
        id: `a-${s.id}`, group: words.length ? 'Økter' : 'Siste økter', label: s.n, sport: s.t,
        hint: [fmtDate(s.d), s.t, s.dist ? `${fmtKm(s.dist)} km` : null, fmtDur(s.mov)].filter(Boolean).join(' · '),
        run: close(() => openAct(s.id)),
      })
    }

    const actions: Item[] = [
      { id: 'x-insight', group: 'Handlinger', label: a.insight ? 'Skjul innsikt' : 'Vis en innsikt', icon: Sparkles, run: close(a.toggleInsight) },
      { id: 'x-theme', group: 'Handlinger', label: a.dark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema', icon: a.dark ? Sun : Moon, run: close(a.toggleTheme) },
      ...(filtered ? [{ id: 'x-reset', group: 'Handlinger', label: 'Nullstill filtre', hint: 'Alle tider og alle idretter', icon: RotateCcw, run: close(resetFilters) }] : []),
    ].filter((x) => hit(`${x.label} ${x.hint ?? ''}`))

    return [...pages, ...sessions, ...actions]
  }, [q, all, a, filtered, resetFilters, openAct, onOpenChange])

  const cur = Math.min(idx, Math.max(0, items.length - 1))
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.scrollIntoView({ block: 'nearest' }) }, [cur])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((cur + 1) % Math.max(1, items.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((cur - 1 + items.length) % Math.max(1, items.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[cur]?.run() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Søk</DialogTitle>
        <DialogDescription className="sr-only">Søk etter sider, økter og handlinger. Bruk piltastene og Enter.</DialogDescription>
        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0) }} onKeyDown={onKey}
            placeholder="Søk etter økt, dato, idrett eller side …" aria-label="Søk" role="combobox" aria-expanded aria-controls="cmd-list"
            className="placeholder:text-muted-foreground h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
          <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:block">Esc</kbd>
        </div>
        <div ref={list} id="cmd-list" role="listbox" className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5">
          {items.length === 0 && <p className="text-muted-foreground px-3 py-8 text-center text-sm">Ingen treff på «{q}».</p>}
          {items.map((it, i) => (
            <div key={it.id}>
              {(i === 0 || items[i - 1].group !== it.group) && <p className="text-muted-foreground px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">{it.group}</p>}
              <button role="option" aria-selected={i === cur} data-i={i} onMouseMove={() => setIdx(i)} onClick={it.run}
                className={cn('flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm', i === cur && 'bg-foreground/[0.08]')}>
                {it.sport ? <SportDot t={it.sport} className="mx-[3px]" /> : it.icon ? <it.icon className="text-muted-foreground size-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.label}</span>
                  {it.hint && <span className="text-muted-foreground block truncate text-xs tabular-nums">{it.hint}</span>}
                </span>
                {i === cur && <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" />}
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
