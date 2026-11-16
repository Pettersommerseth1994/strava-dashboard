import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Range, presets, step, today, weekFromInput, weekToInput, parse } from '@/lib/period'
import { SPORT_COLORS } from '@/lib/data'

const QUICK = [
  ['week', 'Uke'], ['month', 'Måned'], ['d30', '30 d'], ['d90', '90 d'], ['ytd', 'YTD'], ['d365', '12 mnd'], ['all', 'Alt'],
] as const

export function PeriodBar({ range, setRange, min, years, sports, allSports, setSports }: {
  range: Range; setRange: (r: Range) => void; min: string; years: number[]
  sports: string[]; allSports: string[]; setSports: (s: string[]) => void
}) {
  const t = today()
  const active = range.kind === 'week' && range.from === presets.week().from ? 'week'
    : range.kind === 'month' && range.from === presets.month(+t.slice(0, 4), +t.slice(5, 7) - 1).from ? 'month'
    : range.kind === 'ytd' ? 'ytd' : range.kind === 'all' ? 'all'
    : range.kind === 'rolling' ? `d${Math.round((parse(range.to).getTime() - parse(range.from).getTime()) / 86400000) + 1}` : ''
  const pick = (k: string) => {
    if (k === 'week') setRange(presets.week())
    else if (k === 'month') setRange(presets.month(+t.slice(0, 4), +t.slice(5, 7) - 1))
    else if (k === 'ytd') setRange(presets.ytd())
    else if (k === 'all') setRange(presets.all(min))
    else if (k.startsWith('d')) setRange(presets.rolling(+k.slice(1)))
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup value={active ? [active] : []} onValueChange={(v) => v[0] && pick(v[0])} variant="outline" size="sm">
          {QUICK.map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}
        </ToggleGroup>
        <Select value={range.kind === 'year' ? range.from.slice(0, 4) : ''} onValueChange={(v) => v && setRange(presets.year(+v))} items={years.map((y) => ({ value: String(y), label: String(y) }))}>
          <SelectTrigger size="sm" className="w-24"><SelectValue placeholder="År" /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="month" className="h-8 w-40" min={min.slice(0, 7)} max={t.slice(0, 7)} value={range.kind === 'month' ? range.from.slice(0, 7) : ''} onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); if (y && m) setRange(presets.month(y, m - 1)) }} aria-label="Velg måned" />
        <Input type="week" className="h-8 w-40" value={range.kind === 'week' ? weekToInput(range) : ''} onChange={(e) => e.target.value && setRange(weekFromInput(e.target.value))} aria-label="Velg uke" />
        <div className="flex items-center gap-1">
          <Input type="date" className="h-8 w-36" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange(presets.custom(e.target.value, range.to))} aria-label="Fra" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" className="h-8 w-36" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange(presets.custom(range.from, e.target.value))} aria-label="Til" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setRange(step(range, -1))} aria-label="Forrige periode"><ChevronLeft /></Button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{range.label}</span>
          <Button variant="outline" size="icon-sm" onClick={() => setRange(step(range, 1))} aria-label="Neste periode"><ChevronRight /></Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Idrett:</span>
        <ToggleGroup multiple value={sports} onValueChange={setSports} size="sm" variant="outline" className="flex-wrap">
          {allSports.map((s) => (
            <ToggleGroupItem key={s} value={s} className="gap-1.5"><i className="size-2 rounded-full" style={{ background: SPORT_COLORS[s] ?? SPORT_COLORS.Annet }} />{s}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        {sports.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSports([])}>Nullstill</Button>}
      </div>
    </div>
  )
}
