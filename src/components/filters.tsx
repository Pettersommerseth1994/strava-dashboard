import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { useStore } from '@/lib/store'
import { MAIN_SPORTS, type PeriodKind, SPORT_COLORS, addDays, todayStr } from '@/lib/data'

const KINDS: [PeriodKind, string][] = [
  ['week', 'Uke'], ['month', 'Måned'], ['quarter', 'Kvartal'], ['ytd', 'Hittil i år'], ['year', 'År'],
  ['30d', '30 d'], ['90d', '90 d'], ['12m', '12 mnd'], ['all', 'Alle'], ['custom', 'Egendefinert'],
]

export function PeriodBar() {
  const { period, setPeriod, range, compare, setCompare, sports, setSports, all } = useStore()
  const navigable = !['all', 'custom'].includes(period.kind)
  const sportList = [...MAIN_SPORTS, ...(all.some((a) => !MAIN_SPORTS.includes(a.t)) ? ['Annet'] : [])]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto">
          <ToggleGroup
            value={[period.kind]} variant="outline" size="sm"
            onValueChange={(v) => { const k = v[0] as PeriodKind | undefined; if (!k) return
              setPeriod(k === 'custom' ? { kind: 'custom', offset: 0, from: range.from, to: range.to } : { kind: k, offset: 0 }) }}
          >
            {KINDS.map(([k, l]) => <ToggleGroupItem key={k} value={k} className="whitespace-nowrap">{l}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={!navigable} onClick={() => setPeriod({ ...period, offset: period.offset - 1 })} aria-label="Forrige"><ChevronLeft /></Button>
          <div className="min-w-40 px-2 text-center text-sm font-medium">{range.label}</div>
          <Button variant="outline" size="icon-sm" disabled={!navigable || period.offset >= 0} onClick={() => setPeriod({ ...period, offset: period.offset + 1 })} aria-label="Neste"><ChevronRight /></Button>
        </div>
        {period.kind === 'custom' && (
          <div className="flex items-center gap-1">
            <Input type="date" className="h-8 w-36" value={period.from ?? range.from} max={todayStr()} onChange={(e) => e.target.value && setPeriod({ ...period, from: e.target.value, to: (period.to ?? range.to) < e.target.value ? e.target.value : period.to })} />
            <span className="text-muted-foreground">–</span>
            <Input type="date" className="h-8 w-36" value={period.to ?? range.to} max={todayStr()} onChange={(e) => e.target.value && setPeriod({ ...period, to: e.target.value, from: (period.from ?? range.from) > e.target.value ? e.target.value : period.from })} />
            <Button variant="ghost" size="sm" onClick={() => setPeriod({ ...period, from: addDays(range.to, -6), to: range.to })}>7 d</Button>
          </div>
        )}
        <label className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
          <Switch checked={compare} onCheckedChange={setCompare} /> Sammenlign med forrige
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setSports([])} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${sports.length === 0 ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>Alle idretter</button>
        {sportList.map((s) => {
          const on = sports.includes(s)
          return (
            <button key={s} onClick={() => setSports(on ? sports.filter((x) => x !== s) : [...sports, s])}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-muted ring-1 ring-current' : 'hover:bg-muted/60'}`}>
              <i className="size-2 rounded-full" style={{ background: SPORT_COLORS[s] }} />{s}
            </button>
          )
        })}
      </div>
    </div>
  )
}
