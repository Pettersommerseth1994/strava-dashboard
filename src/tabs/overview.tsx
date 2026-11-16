import { useMemo, useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity as ActivityIcon, ArrowDown, ArrowUp, CalendarDays, Flame, Mountain, Route, Timer, HeartPulse, Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useApp } from '@/lib/ctx'
import { type Activity, MAIN_SPORTS, SPORT_COLORS, WEEKDAYS, dayKey, fmtDate, fmtHours, fmtInt, sportOf } from '@/lib/data'
import { type Gran, autoGran, bucketKeys, keyOf, labelOf } from '@/lib/buckets'
import { presets } from '@/lib/period'
import { loadSeries, longestStreak, sum } from '@/lib/stats'

type Metric = 'dist' | 'time' | 'up' | 'count'
export const METRICS: Record<Metric, { label: string; val: (a: Activity) => number; fmt: (v: number) => string }> = {
  dist: { label: 'Distanse', val: (a) => a.dist / 1000, fmt: (v) => fmtInt(v) + ' km' },
  time: { label: 'Tid', val: (a) => a.mov / 3600, fmt: (v) => v.toFixed(1) + ' t' },
  up: { label: 'Høydemeter', val: (a) => a.up, fmt: (v) => fmtInt(v) + ' m' },
  count: { label: 'Økter', val: () => 1, fmt: (v) => fmtInt(v) },
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return null
  const p = ((cur - prev) / prev) * 100
  const up = p >= 0
  return <span className={`inline-flex items-center text-xs font-medium ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{Math.abs(p).toFixed(0)}%</span>
}

function Kpi({ icon: Icon, label, value, sub, cur, prev }: { icon: typeof Route; label: string; value: string; sub?: string; cur?: number; prev?: number }) {
  return (
    <Card size="sm"><CardContent className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">{cur != null && prev != null && <Delta cur={cur} prev={prev} />}{sub}</p>
      </div>
      <div className="bg-muted text-muted-foreground rounded-lg p-2"><Icon className="size-4" /></div>
    </CardContent></Card>
  )
}

function Heatmap({ acts, year, onDay }: { acts: Activity[]; year: number; onDay: (d: string) => void }) {
  const byDay = useMemo(() => { const m = new Map<string, number>(); for (const a of acts) m.set(dayKey(a.d), (m.get(dayKey(a.d)) ?? 0) + a.mov / 3600); return m }, [acts])
  const start = new Date(Date.UTC(year, 0, 1))
  const offset = (start.getUTCDay() + 6) % 7
  const cells: { key: string; v: number }[] = []
  for (let i = -offset; i < 371; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    if (d.getUTCFullYear() > year && (cells.length % 7) === 0) break
    const key = d.toISOString().slice(0, 10)
    cells.push({ key, v: d.getUTCFullYear() === year ? (byDay.get(key) ?? 0) : -1 })
  }
  const level = (v: number) => (v < 0 ? -1 : v === 0 ? 0 : v < 1 ? 1 : v < 2 ? 2 : v < 3.5 ? 3 : 4)
  const bg = ['bg-muted', 'bg-orange-200 dark:bg-orange-950', 'bg-orange-300 dark:bg-orange-800', 'bg-orange-500 dark:bg-orange-600', 'bg-red-600 dark:bg-orange-400']
  return (
    <div className="overflow-x-auto pb-1"><div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
      {cells.map((c) => { const l = level(c.v); return l < 0 ? <div key={c.key} className="size-3" /> : (
        <button key={c.key} disabled={!c.v} onClick={() => onDay(c.key)} title={`${fmtDate(c.key)} · ${c.v ? c.v.toFixed(1) + ' t' : 'hvile'}`} className={`size-3 rounded-[3px] ${bg[l]} ${c.v ? 'cursor-pointer hover:ring-2 hover:ring-foreground/40' : ''}`} />
      ) })}
    </div></div>
  )
}

export function Overview() {
  const { all, acts, prevActs, range, setRange, open, sports, setSports } = useApp()
  const [metric, setMetric] = useState<Metric>('dist')
  const [gran, setGran] = useState<Gran | 'auto'>('auto')
  const g = gran === 'auto' ? autoGran(range.from, range.to) : gran
  const m = METRICS[metric]

  const k = useMemo(() => {
    const days = new Set(acts.map((a) => dayKey(a.d)))
    const hrs = acts.filter((a) => a.hr)
    return {
      dist: sum(acts, (a) => a.dist), time: sum(acts, (a) => a.mov), up: sum(acts, (a) => a.up), cal: sum(acts, (a) => a.cal),
      days: days.size, streak: longestStreak([...days]),
      avgHr: hrs.length ? sum(hrs, (a) => (a.hr ?? 0) * a.mov) / sum(hrs, (a) => a.mov) : 0,
    }
  }, [acts])
  const pk = useMemo(() => ({ dist: sum(prevActs, (a) => a.dist), time: sum(prevActs, (a) => a.mov), up: sum(prevActs, (a) => a.up), cal: sum(prevActs, (a) => a.cal), n: prevActs.length }), [prevActs])

  const present = useMemo(() => MAIN_SPORTS.concat('Annet').filter((s) => acts.some((a) => sportOf(a.t) === s)), [acts])
  const cfg = useMemo(() => Object.fromEntries(present.map((s) => [s, { label: s, color: SPORT_COLORS[s] }])) as ChartConfig, [present])

  const buckets = useMemo(() => {
    const from = range.kind === 'all' && all.length ? all[0].d.slice(0, 10) : range.from
    const keys = bucketKeys(from, range.to, g)
    const rows = new Map(keys.map((key) => [key, { key, label: labelOf(key, g), ...Object.fromEntries(present.map((s) => [s, 0])) } as Record<string, number | string>]))
    for (const a of acts) { const r = rows.get(keyOf(a, g)); if (r) r[sportOf(a.t)] = (r[sportOf(a.t)] as number) + m.val(a) }
    return [...rows.values()]
  }, [acts, present, m, g, range, all])

  const drill = (key: string) => {
    if (g === 'month') setRange(presets.month(+key.slice(0, 4), +key.slice(5, 7) - 1))
    else if (g === 'week') setRange(presets.week(key))
    else { const ids = acts.filter((a) => dayKey(a.d) === key).map((a) => a.id); if (ids.length) open({ kind: 'list', title: fmtDate(key), ids }) }
  }

  const split = useMemo(() => present.map((s) => ({ sport: s, v: acts.filter((a) => sportOf(a.t) === s).reduce((x, a) => x + m.val(a), 0), fill: SPORT_COLORS[s] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v), [acts, present, m])

  const load = useMemo(() => loadSeries(all, range.from, range.to > fmtToday() ? fmtToday() : range.to), [all, range])
  const weekday = useMemo(() => { const r = WEEKDAYS.map((d) => ({ d, v: 0 })); for (const a of acts) r[(new Date(a.d).getDay() + 6) % 7].v += m.val(a); return r }, [acts, m])
  const hours = useMemo(() => { const r = Array.from({ length: 24 }, (_, h) => ({ h: String(h), v: 0 })); for (const a of acts) r[+a.d.slice(11, 13)].v += m.val(a); return r }, [acts, m])
  const heatYear = +range.to.slice(0, 4) > new Date().getFullYear() ? new Date().getFullYear() : +range.to.slice(0, 4)

  if (!acts.length) return <p className="text-muted-foreground py-20 text-center">Ingen økter i denne perioden.</p>
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi icon={Route} label="Distanse" value={`${fmtInt(k.dist / 1000)} km`} cur={k.dist} prev={pk.dist} sub={`${(k.dist / 40075000).toFixed(2).replace('.', ',')} × jorda`} />
        <Kpi icon={Timer} label="Tid" value={fmtHours(k.time)} cur={k.time} prev={pk.time} sub={`${(k.time / 86400).toFixed(1).replace('.', ',')} døgn`} />
        <Kpi icon={Mountain} label="Høydemeter" value={`${fmtInt(k.up)} m`} cur={k.up} prev={pk.up} sub={`${(k.up / 8849).toFixed(1).replace('.', ',')} × Everest`} />
        <Kpi icon={ActivityIcon} label="Økter" value={fmtInt(acts.length)} cur={acts.length} prev={pk.n} sub={`${k.days} aktive dager`} />
        <Kpi icon={Flame} label="Kalorier" value={fmtInt(k.cal)} cur={k.cal} prev={pk.cal} sub="kcal" />
        <Kpi icon={HeartPulse} label="Snittpuls" value={k.avgHr ? `${Math.round(k.avgHr)} bpm` : '–'} sub="tidsvektet" />
        <Kpi icon={CalendarDays} label="Lengste serie" value={`${k.streak.best} d`} sub={k.streak.end ? `til ${fmtDate(k.streak.end)}` : ''} />
      </section>
      <p className="text-muted-foreground -mt-3 text-xs">Piler viser endring mot forrige tilsvarende periode.</p>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div><CardTitle>Utvikling i perioden</CardTitle><CardDescription>Trykk på en stolpe for å dykke ned ({g === 'month' ? 'måned' : g === 'week' ? 'uke' : 'dag'})</CardDescription></div>
          <div className="flex flex-wrap gap-2">
            <ToggleGroup value={[gran]} onValueChange={(v) => v[0] && setGran(v[0] as Gran | 'auto')} variant="outline" size="sm">
              {(['auto', 'day', 'week', 'month'] as const).map((x) => <ToggleGroupItem key={x} value={x}>{{ auto: 'Auto', day: 'Dag', week: 'Uke', month: 'Måned' }[x]}</ToggleGroupItem>)}
            </ToggleGroup>
            <ToggleGroup value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm">
              {(Object.keys(METRICS) as Metric[]).map((x) => <ToggleGroupItem key={x} value={x}>{METRICS[x].label}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={cfg} className="h-72 w-full">
            <BarChart data={buckets}>
              <CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} /><YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {present.map((s) => <Bar key={s} dataKey={s} stackId="a" fill={`var(--color-${s})`} className="cursor-pointer" onClick={(d: { payload?: { key: string } }) => d.payload && drill(d.payload.key)} />)}
            </BarChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">{present.map((s) => <span key={s} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: SPORT_COLORS[s] }} />{s}</span>)}</div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="size-4" />Form og belastning</CardTitle><CardDescription>Estimert fra varighet og puls: fitness (42 d), tretthet (7 d) og form (fitness − tretthet)</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={{ ctl: { label: 'Fitness', color: 'oklch(0.68 0.15 235)' }, atl: { label: 'Tretthet', color: 'oklch(0.7 0.19 45)' }, form: { label: 'Form', color: 'oklch(0.72 0.16 160)' } }} className="h-64 w-full">
              <ComposedChart data={load}>
                <CartesianGrid vertical={false} /><XAxis dataKey="day" tickFormatter={(v) => fmtDate(v).replace(/ \d{4}$/, '')} tickLine={false} axisLine={false} minTickGap={40} /><YAxis tickLine={false} axisLine={false} width={34} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDate(String(v))} />} />
                <Area dataKey="ctl" stroke="var(--color-ctl)" fill="var(--color-ctl)" fillOpacity={0.15} strokeWidth={2} dot={false} />
                <Line dataKey="atl" stroke="var(--color-atl)" strokeWidth={2} dot={false} />
                <Line dataKey="form" stroke="var(--color-form)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Idrettsfordeling</CardTitle><CardDescription>{m.label} · trykk for å filtrere</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="mx-auto h-44 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="sport" />} />
                <Pie data={split} dataKey="v" nameKey="sport" innerRadius={48} outerRadius={78} strokeWidth={2}>
                  {split.map((x) => <Cell key={x.sport} fill={x.fill} className="cursor-pointer" onClick={() => setSports([x.sport === 'Annet' ? 'Gåtur' : x.sport])} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1 text-sm">
              {split.map((x) => <li key={x.sport}><button className="hover:bg-muted flex w-full items-center justify-between rounded px-1" onClick={() => setSports(sports.includes(x.sport) ? [] : [x.sport === 'Annet' ? 'Gåtur' : x.sport])}><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: x.fill }} />{x.sport}</span><span className="text-muted-foreground tabular-nums">{m.fmt(x.v)}</span></button></li>)}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Aktivitetskalender {heatYear}</CardTitle><CardDescription>Treningstid per dag · trykk på en dag for å se øktene</CardDescription></CardHeader>
        <CardContent><Heatmap acts={all.filter((a) => sports.length === 0 || sports.includes(a.t))} year={heatYear} onDay={(d) => { const ids = all.filter((a) => dayKey(a.d) === d && (sports.length === 0 || sports.includes(a.t))).map((a) => a.id); open({ kind: 'list', title: fmtDate(d), ids }) }} /></CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Ukedag</CardTitle><CardDescription>{m.label}</CardDescription></CardHeader><CardContent>
          <ChartContainer config={{ v: { label: m.label, color: 'oklch(0.7 0.19 45)' } }} className="h-48 w-full"><BarChart data={weekday}><CartesianGrid vertical={false} /><XAxis dataKey="d" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={4} /></BarChart></ChartContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Tid på døgnet</CardTitle><CardDescription>Starttidspunkt · {m.label}</CardDescription></CardHeader><CardContent>
          <ChartContainer config={{ v: { label: m.label, color: 'oklch(0.68 0.15 235)' } }} className="h-48 w-full"><BarChart data={hours}><CartesianGrid vertical={false} /><XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={3} /></BarChart></ChartContainer>
        </CardContent></Card>
      </div>
    </div>
  )
}
const fmtToday = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10) }
