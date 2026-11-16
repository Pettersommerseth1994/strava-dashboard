import { useState } from 'react'
import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows, Layers, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { MAIN_SPORTS, type PeriodKind, SPORT_COLORS, fmtDate, todayStr } from '@/lib/data'

const PRESETS: { title: string; items: [PeriodKind, string][] }[] = [
  { title: 'Kalender', items: [['week', 'Uke'], ['month', 'Måned'], ['quarter', 'Kvartal'], ['year', 'År'], ['ytd', 'Hittil i år']] },
  { title: 'Rullerende', items: [['30d', 'Siste 30 dager'], ['90d', 'Siste 90 dager'], ['12m', 'Siste 12 måneder']] },
  { title: 'Alt', items: [['all', 'Alle tider']] },
]

export type FilterSet = { period?: boolean; sport?: boolean; compare?: boolean }

/** Globale filtre. Hver visning oppgir hvilke som gjelder der, så bare de vises. */
export function PeriodBar({ show = { period: true, sport: true, compare: true } }: { show?: FilterSet }) {
  const { period, setPeriod, range, prevRange, compare, setCompare, sports, setSports, all, filtered, resetFilters } = useStore()
  const [open, setOpen] = useState(false)
  const navigable = !['all', 'custom'].includes(period.kind)
  const sportList = [...MAIN_SPORTS, ...(all.some((a) => !MAIN_SPORTS.includes(a.t)) ? ['Annet'] : [])]
  const sportLabel = sports.length === 0 ? 'Alle idretter' : sports.length === 1 ? sports[0] : `${sports.length} idretter`
  const label = period.kind === 'custom' ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : range.label
  const showReset = filtered && ((show.period && period.kind !== 'all') || (show.sport && sports.length > 0))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {show.period && (
        <div className="bg-background/40 flex h-8 shrink-0 items-center rounded-lg border">
          <Button variant="ghost" size="icon-sm" className="h-full rounded-r-none" disabled={!navigable} onClick={() => setPeriod({ ...period, offset: period.offset - 1 })} aria-label="Forrige periode"><ChevronLeft /></Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={<button className="hover:bg-muted/60 flex h-full items-center gap-1.5 px-2 text-[0.8rem] font-medium whitespace-nowrap tabular-nums" aria-label="Velg periode" />}>
              <CalendarRange className="text-muted-foreground size-3.5" />{label}<ChevronDown className="text-muted-foreground size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[19rem] gap-0 p-1.5">
              {PRESETS.map((g) => (
                <div key={g.title} className="pb-1">
                  <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide uppercase">{g.title}</p>
                  {g.items.map(([k, l]) => (
                    <button key={k} onClick={() => { setPeriod({ kind: k, offset: 0 }); setOpen(false) }}
                      className={cn('hover:bg-muted flex h-8 w-full items-center justify-between rounded-md px-2 text-sm', period.kind === k && 'bg-muted font-medium')}>
                      {l}{period.kind === k && <Check className="size-4 text-[var(--brand)]" />}
                    </button>
                  ))}
                </div>
              ))}
              <div className="border-t px-2 pt-2 pb-1.5">
                <p className="text-muted-foreground pb-1.5 text-[11px] font-medium tracking-wide uppercase">Egendefinert</p>
                <div className="flex items-center gap-1.5">
                  <Input type="date" aria-label="Fra dato" className="h-8 min-w-0 flex-1 px-2 text-xs" value={period.kind === 'custom' ? period.from ?? range.from : range.from} max={todayStr()}
                    onChange={(e) => e.target.value && setPeriod({ kind: 'custom', offset: 0, from: e.target.value, to: range.to < e.target.value ? e.target.value : range.to })} />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input type="date" aria-label="Til dato" className="h-8 min-w-0 flex-1 px-2 text-xs" value={period.kind === 'custom' ? period.to ?? range.to : range.to > todayStr() ? todayStr() : range.to} max={todayStr()}
                    onChange={(e) => e.target.value && setPeriod({ kind: 'custom', offset: 0, to: e.target.value, from: range.from > e.target.value ? e.target.value : range.from })} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-sm" className="h-full rounded-l-none" disabled={!navigable || period.offset >= 0} onClick={() => setPeriod({ ...period, offset: period.offset + 1 })} aria-label="Neste periode"><ChevronRight /></Button>
        </div>
      )}

      {show.sport && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={cn('h-8 shrink-0 gap-1.5', sports.length > 0 && 'border-[var(--brand)]/50')} />}>
            <Layers className="text-muted-foreground" /><span className="max-md:hidden">{sportLabel}</span><span className="md:hidden">{sports.length ? sportLabel : 'Idrett'}</span><ChevronDown className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => setSports([])}>
              <Check className={cn(sports.length ? 'opacity-0' : '')} />Alle idretter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sportList.map((s) => (
              <DropdownMenuCheckboxItem key={s} checked={sports.includes(s)} closeOnClick={false}
                onCheckedChange={(on) => setSports(on ? [...sports, s] : sports.filter((x) => x !== s))}>
                <i className="size-2 rounded-full" style={{ background: SPORT_COLORS[s] }} />{s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {show.compare && (
        <Button variant={compare && prevRange ? 'secondary' : 'ghost'} size="sm" className="h-8 shrink-0 gap-1.5" disabled={!prevRange} onClick={() => setCompare(!compare)} aria-pressed={compare} aria-label="Sammenlign med forrige periode"
          title={prevRange ? `Sammenlign med ${prevRange.label.toLowerCase()}` : 'Velg en periode for å sammenligne med den forrige'}>
          <GitCompareArrows className={compare && prevRange ? '' : 'text-muted-foreground'} /><span className="hidden xl:inline">Sammenlign</span>
        </Button>
      )}

      {showReset && (
        <Button variant="ghost" size="sm" className="text-muted-foreground h-8 shrink-0 gap-1 px-2" onClick={resetFilters} title="Tilbake til alle tider og alle idretter">
          <X />Nullstill
        </Button>
      )}
    </div>
  )
}
