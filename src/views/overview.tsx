import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity as ActivityIcon, CalendarDays, Flame, Gauge, Mountain, Route, Timer } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActivityRow, ChartCard, Delta, Kpi } from '@/components/common'
import { useStore } from '@/lib/store'
import {
  type Activity, type Gran, MAIN_SPORTS, SPORT_COLORS, WEEKDAYS, addDays, allBuckets, autoGran, bucketKey, bucketLabel, bucketRange,
  dayKey, fmtDate, fmtDur, fmtHours, fmtInt, fmtKm, fmtNum, longestStreak, sportOf, sumBy, todayStr,
} from '@/lib/data'

type Metric = 'dist' | 'time' | 'up' | 'count' | 'load'
const M: Record<Metric, { label: string; val: (a: Activity) => number; fmt: (v: number) => string }> = {
  dist: { label: 'Distanse', val: (a) => a.dist / 1000, fmt: (v) => fmtNum(v, 1) + ' km' },
  time: { label: 'Tid', val: (a) => a.mov / 3600, fmt: (v) => fmtNum(v, 1) + ' t' },
  up: { label: 'Høydemeter', val: (a) => a.up, fmt: (v) => fmtInt(v) + ' m' },
  load: { label: 'Belastning', val: (a) => a.load, fmt: (v) => fmtInt(v) },
  count: { label: 'Økter', val: () => 1, fmt: (v) => fmtInt(v) },
}

function Heatmap({ acts, to, onDay }: { acts: Activity[]; to: string; onDay: (d: string) => void }) {
  const byDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of acts) m.set(dayKey(a.d), (m.get(dayKey(a.d)) ?? 0) + a.mov / 3600)
    return m
  }, [acts])
  const end = addDays(to, 6 - ((new Date(to + 'T00:00:00Z').getUTCDay() + 6) % 7))
  const start = addDays(end, -53 * 7 + 1)
  const cells = Array.from({ length: 53 * 7 }, (_, i) => { const k = addDays(start, i); return { k, v: byDay.get(k) ?? 0, future: k > to } })
  const lvl = (v: number) => (v === 0 ? 0 : v < 1 ? 1 : v < 2 ? 2 : v < 3.5 ? 3 : 4)
  const bg = ['bg-muted', 'bg-orange-200 dark:bg-orange-950', 'bg-orange-300 dark:bg-orange-800', 'bg-orange-500 dark:bg-orange-600', 'bg-red-600 dark:bg-orange-400']
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map((c) => c.future ? <div key={c.k} className="size-3" /> : (
          <button key={c.k} onClick={() => c.v > 0 && onDay(c.k)} title={`${fmtDate(c.k)} · ${c.v ? fmtNum(c.v, 1) + ' t' : 'hvile'}`} className={`size-3 rounded-[3px] ${bg[lvl(c.v)]} ${c.v ? 'hover:ring-foreground cursor-pointer hover:ring-1' : 'cursor-default'}`} />
        ))}
      </div>
    </div>
  )
}

export function Overview() {
  const { acts, prevActs, compare, range, prevRange, all, goRange, open, sports, setSports, sportActs } = useStore()
  const [metric, setMetric] = useState<Metric>('dist')
  const [gran, setGran] = useState<Gran | 'auto'>('auto')
  const today = todayStr()
  const g: Gran = gran === 'auto' ? autoGran(range.days) : gran
  const s = useMemo(() => sumBy(acts), [acts])
  const p = useMemo(() => sumBy(prevActs), [prevActs])
  const streak = useMemo(() => longestStreak(acts.map((a) => dayKey(a.d))), [acts])
  const showP = compare && !!prevRange
  const dl = (c: number, pr: number) => (showP ? <Delta cur={c} prev={pr} /> : null)
  const m = M[metric]

  const present = useMemo(() => MAIN_SPORTS.concat('Annet').filter((k) => acts.some((a) => sportOf(a.t) === k)), [acts])
  const cfg = useMemo(() => Object.fromEntries(present.map((k) => [k, { label: k, color: SPORT_COLORS[k] }])) as ChartConfig, [present])

  const buckets = useMemo(() => {
    const keys = allBuckets(range.from, range.to > today ? today : range.to, g)
    const rows = new Map(keys.map((k) => { const r: Record<string, number | string> = { k, label: bucketLabel(k, g) }; present.forEach((x) => (r[x] = 0)); return [k, r] }))
    for (const a of acts) { const r = rows.get(bucketKey(a.d, g)); if (r) r[sportOf(a.t)] = (r[sportOf(a.t)] as number) + m.val(a) }
    return [...rows.values()]
  }, [acts, range, g, present, m, today])

  const split = useMemo(() => present.map((k) => ({ sport: k, v: acts.filter((a) => sportOf(a.t) === k).reduce((x, a) => x + m.val(a), 0), fill: SPORT_COLORS[k] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v), [acts, present, m])
  const weekday = useMemo(() => { const r = WEEKDAYS.map((d) => ({ d, v: 0 })); for (const a of acts) r[(new Date(a.d).getDay() + 6) % 7].v += m.val(a); return r }, [acts, m])
  const hours = useMemo(() => { const r = Array.from({ length: 24 }, (_, h) => ({ h: String(h), v: 0 })); for (const a of acts) r[+a.d.slice(11, 13)].v += m.val(a); return r }, [acts, m])
  const recent = useMemo(() => [...acts].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8), [acts])

  const [tg, setTg] = useState<Gran>('month')
  const table = useMemo(() => {
    const mp = new Map<string, Activity[]>()
    for (const a of sportActs) { const k = bucketKey(a.d, tg); if (!mp.has(k)) mp.set(k, []); mp.get(k)!.push(a) }
    return [...mp.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 36).map(([k, v]) => ({ k, ...sumBy(v) }))
  }, [sportActs, tg])

  const onBar = (st: unknown) => {
    const i = (st as { activeTooltipIndex?: number })?.activeTooltipIndex
    if (i == null) return
    const k = buckets[+i]?.k as string | undefined
    if (k && g !== 'day') { const [f, t] = bucketRange(k, g); goRange(f, t) }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi icon={Route} label="Distanse" value={`${fmtInt(s.dist / 1000)} km`} delta={dl(s.dist, p.dist)} sub={showP ? `fra ${fmtInt(p.dist / 1000)} km` : `${fmtNum(s.dist / 40075000, 2)} × jorda`} />
        <Kpi icon={Timer} label="Tid" value={fmtHours(s.mov)} delta={dl(s.mov, p.mov)} sub={showP ? `fra ${fmtHours(p.mov)}` : `${fmtNum(s.mov / 86400, 1)} døgn`} />
        <Kpi icon={Mountain} label="Høydemeter" value={`${fmtInt(s.up)} m`} delta={dl(s.up, p.up)} sub={showP ? `fra ${fmtInt(p.up)} m` : `${fmtNum(s.up / 8849, 1)} × Everest`} />
        <Kpi icon={ActivityIcon} label="Økter" value={fmtInt(s.count)} delta={dl(s.count, p.count)} sub={showP ? `fra ${p.count}` : `${fmtNum(s.count / Math.max(1, range.days / 7), 1)} per uke`} />
        <Kpi icon={CalendarDays} label="Aktive dager" value={`${s.days}`} delta={dl(s.days, p.days)} sub={`serie ${streak.best} d`} />
        <Kpi icon={Flame} label="Kalorier" value={fmtInt(s.cal)} delta={dl(s.cal, p.cal)} sub="kcal" />
        <Kpi icon={Gauge} label="Belastning" value={fmtInt(s.load)} delta={dl(s.load, p.load)} sub="TRIMP" />
      </section>

      <ChartCard
        title="Utvikling over tid"
        desc={`Trykk på en søyle for å zoome inn · ${g === 'day' ? 'per dag' : g === 'week' ? 'per uke' : g === 'month' ? 'per måned' : 'per år'}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ToggleGroup value={[gran]} onValueChange={(v) => v[0] && setGran(v[0] as Gran | 'auto')} variant="outline" size="sm">
              {([['auto', 'Auto'], ['day', 'Dag'], ['week', 'Uke'], ['month', 'Mnd'], ['year', 'År']] as const).map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}
            </ToggleGroup>
            <ToggleGroup value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm">
              {(Object.keys(M) as Metric[]).map((k) => <ToggleGroupItem key={k} value={k}>{M[k].label}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        }
      >
        <ChartContainer config={cfg} className="h-72 w-full">
          <BarChart data={buckets} onClick={onBar} className={g !== 'day' ? 'cursor-pointer' : ''}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {present.map((k) => <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} />)}
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Idrettsfordeling" desc={`${m.label} · trykk for å filtrere`}>
          <ChartContainer config={cfg} className="mx-auto h-44 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="sport" />} />
              <Pie data={split} dataKey="v" nameKey="sport" innerRadius={46} outerRadius={76} strokeWidth={2} onClick={(d) => { const sp = (d as { sport?: string }).sport; if (sp) setSports(sports.length === 1 && sports[0] === sp ? [] : [sp]) }} className="cursor-pointer">
                {split.map((x) => <Cell key={x.sport} fill={x.fill} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="mt-2 space-y-1 text-sm">
            {split.map((x) => (
              <li key={x.sport}><button onClick={() => setSports([x.sport])} className="hover:bg-muted/60 flex w-full items-center justify-between rounded px-1"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: x.fill }} />{x.sport}</span><span className="text-muted-foreground tabular-nums">{m.fmt(x.v)}</span></button></li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Ukedag" desc={m.label}>
          <ChartContainer config={{ v: { label: m.label, color: 'oklch(0.72 0.19 45)' } }} className="h-56 w-full">
            <BarChart data={weekday}><CartesianGrid vertical={false} /><XAxis dataKey="d" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={4} /></BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Tid på døgnet" desc={`${m.label} etter starttidspunkt`}>
          <ChartContainer config={{ v: { label: m.label, color: 'oklch(0.7 0.15 235)' } }} className="h-56 w-full">
            <BarChart data={hours}><CartesianGrid vertical={false} /><XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={3} /></BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <ChartCard title="Aktivitetskalender" desc="Treningstid per dag, 53 uker bakover fra periodens slutt · trykk på en dag">
        <Heatmap acts={sportActs} to={range.to > today ? today : range.to} onDay={(d) => { const day = sportActs.filter((a) => dayKey(a.d) === d); if (day.length === 1) open(day[0].id); else goRange(d, d) }} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Siste økter i perioden" desc="Trykk for detaljer">
          <div className="-mx-2">
            {recent.length === 0 && <p className="text-muted-foreground px-2 text-sm">Ingen økter.</p>}
            {recent.map((a) => <ActivityRow key={a.id} a={a} onClick={() => open(a.id)} right={<span className="text-right text-xs tabular-nums">{a.dist ? `${fmtKm(a.dist)} km` : fmtDur(a.mov)}<br /><span className="text-muted-foreground">{fmtDur(a.mov)}</span></span>} />)}
          </div>
        </ChartCard>
        <ChartCard title="Periodeoversikt" desc="Trykk på en rad for å zoome inn (idrettsfilter gjelder)"
          action={<ToggleGroup value={[tg]} onValueChange={(v) => v[0] && setTg(v[0] as Gran)} variant="outline" size="sm">{([['week', 'Uke'], ['month', 'Måned'], ['year', 'År']] as const).map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}</ToggleGroup>}>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Periode</TableHead><TableHead className="text-right">Økter</TableHead><TableHead className="text-right">km</TableHead><TableHead className="text-right">Tid</TableHead><TableHead className="text-right">Høyde</TableHead></TableRow></TableHeader>
              <TableBody>
                {table.map((r) => (
                  <TableRow key={r.k} className="cursor-pointer" onClick={() => { const [f, t] = bucketRange(r.k, tg); goRange(f, t) }}>
                    <TableCell className="font-medium">{bucketLabel(r.k, tg)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.dist / 1000)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(r.mov)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.up)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </div>
      <p className="text-muted-foreground text-xs">Totalt i historikken: {fmtInt(all.length)} økter.</p>
    </div>
  )
}
