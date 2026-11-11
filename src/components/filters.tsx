import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { MAIN_SPORTS, type PeriodKind, SPORT_COLORS, todayStr } from '@/lib/data'

const KINDS: [PeriodKind, string][] = [
  ['week', 'Uke'], ['month', 'Måned'], ['quarter', 'Kvartal'], ['ytd', 'Hittil i år'], ['year', 'År'],
  ['30d', 'Siste 30 dager'], ['90d', 'Siste 90 dager'], ['12m', 'Siste 12 måneder'], ['all', 'Alle tider'], ['custom', 'Egendefinert'],
]

export function PeriodBar() {
  const { period, setPeriod, range, compare, setCompare, sports, setSports, all } = useStore()
  const navigable = !['all', 'custom'].includes(period.kind)
  const sportList = [...MAIN_SPORTS, ...(all.some((a) => !MAIN_SPORTS.includes(a.t)) ? ['Annet'] : [])]
  const sportLabel = sports.length === 0 ? 'Alle idretter' : sports.length === 1 ? sports[0] : `${sports.length} idretter`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <CalendarRange className="text-muted-foreground" />{KINDS.find((k) => k[0] === period.kind)?.[1]}<ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuRadioGroup value={period.kind} onValueChange={(v) => {
            const k = v as PeriodKind
            setPeriod(k === 'custom' ? { kind: 'custom', offset: 0, from: range.from, to: range.to } : { kind: k, offset: 0 })
          }}>
            {KINDS.map(([k, l], i) => (
              <div key={k}>
                {(i === 5 || i === 8) && <DropdownMenuSeparator />}
                <DropdownMenuRadioItem value={k}>{l}</DropdownMenuRadioItem>
              </div>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex h-7 items-center rounded-md border">
        <Button variant="ghost" size="icon-sm" className="rounded-r-none" disabled={!navigable} onClick={() => setPeriod({ ...period, offset: period.offset - 1 })} aria-label="Forrige periode"><ChevronLeft /></Button>
        <span className="min-w-28 px-2 text-center text-[0.8rem] font-medium tabular-nums">{range.label}</span>
        <Button variant="ghost" size="icon-sm" className="rounded-l-none" disabled={!navigable || period.offset >= 0} onClick={() => setPeriod({ ...period, offset: period.offset + 1 })} aria-label="Neste periode"><ChevronRight /></Button>
      </div>

      {period.kind === 'custom' && (
        <div className="flex items-center gap-1">
          <Input type="date" className="h-7 w-34 text-xs" value={period.from ?? range.from} max={todayStr()} onChange={(e) => e.target.value && setPeriod({ ...period, from: e.target.value, to: (period.to ?? range.to) < e.target.value ? e.target.value : period.to })} />
          <span className="text-muted-foreground text-xs">–</span>
          <Input type="date" className="h-7 w-34 text-xs" value={period.to ?? range.to} max={todayStr()} onChange={(e) => e.target.value && setPeriod({ ...period, to: e.target.value, from: (period.from ?? range.from) > e.target.value ? e.target.value : period.from })} />
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <Layers className="text-muted-foreground" />{sportLabel}<ChevronDown className="text-muted-foreground" />
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

      <Button variant={compare ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setCompare(!compare)} aria-pressed={compare} title="Sammenlign med forrige periode">
        <GitCompareArrows className={compare ? '' : 'text-muted-foreground'} /><span className="hidden sm:inline">Sammenlign</span>
      </Button>
    </div>
  )
}
