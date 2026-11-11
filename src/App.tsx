import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity as ActivityIcon, Flame, Moon, Mountain, Sun, Timer, Trophy, Route, CalendarDays, Zap, HeartPulse } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  type Activity, MAIN_SPORTS, SPORT_COLORS, dayKey, fmtDate, fmtDur, fmtHours, fmtInt, fmtKm, fmtPace, isoWeekKey, longestStreak, sportOf,
} from '@/lib/data'

type Metric = 'dist' | 'time' | 'up' | 'count'
const METRICS: Record<Metric, { label: string; unit: string; val: (a: Activity) => number; fmt: (v: number) => string }> = {
  dist: { label: 'Distanse', unit: 'km', val: (a) => a.dist / 1000, fmt: (v) => fmtInt(v) + ' km' },
  time: { label: 'Tid', unit: 't', val: (a) => a.mov / 3600, fmt: (v) => v.toFixed(1) + ' t' },
  up: { label: 'Høydemeter', unit: 'm', val: (a) => a.up, fmt: (v) => fmtInt(v) + ' m' },
  count: { label: 'Økter', unit: '', val: () => 1, fmt: (v) => fmtInt(v) },
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const WEEKDAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem('theme'); if (s) return s === 'dark' } catch { /* ignore */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Route; label: string; value: string; sub?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
        </div>
        <div className="bg-muted text-muted-foreground rounded-lg p-2"><Icon className="size-4" /></div>
      </CardContent>
    </Card>
  )
}

function Record({ icon: Icon, title, value, a, sport }: { icon: typeof Route; title: string; value: string; a?: Activity; sport?: string }) {
  if (!a) return null
  const s = sport ?? sportOf(a.t)
  return (
    <Card size="sm" className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: SPORT_COLORS[s] }} />
      <CardContent className="pl-5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <Icon className="size-3.5" />{title}
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 truncate text-sm">{a.n}</p>
        <p className="text-muted-foreground text-xs">{a.t} · {fmtDate(a.d)}</p>
      </CardContent>
    </Card>
  )
}

function Heatmap({ acts, year }: { acts: Activity[]; year: number }) {
  const byDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of acts) m.set(dayKey(a.d), (m.get(dayKey(a.d)) ?? 0) + a.mov / 3600)
    return m
  }, [acts])
  const start = new Date(Date.UTC(year, 0, 1))
  const offset = (start.getUTCDay() + 6) % 7
  const cells: { key: string; v: number }[] = []
  for (let i = -offset; i < 371; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    if (d.getUTCFullYear() > year && (cells.length + offset) % 7 === 0) break
    const key = d.toISOString().slice(0, 10)
    cells.push({ key, v: d.getUTCFullYear() === year ? (byDay.get(key) ?? 0) : -1 })
  }
  const level = (v: number) => (v < 0 ? -1 : v === 0 ? 0 : v < 1 ? 1 : v < 2 ? 2 : v < 3.5 ? 3 : 4)
  const bg = ['bg-muted', 'bg-orange-200 dark:bg-orange-950', 'bg-orange-300 dark:bg-orange-800', 'bg-orange-500 dark:bg-orange-600', 'bg-red-600 dark:bg-orange-400']
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map((c) => {
          const l = level(c.v)
          return l < 0 ? <div key={c.key} className="size-3" /> : (
            <div key={c.key} title={`${fmtDate(c.key)} · ${c.v ? c.v.toFixed(1) + ' t' : 'hvile'}`} className={`size-3 rounded-[3px] ${bg[l]}`} />
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [dark, toggle] = useTheme()
  const [all, setAll] = useState<Activity[] | null>(null)
  const [year, setYear] = useState('all')
  const [sport, setSport] = useState('all')
  const [metric, setMetric] = useState<Metric>('dist')

  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => r.json()).then(setAll) }, [])

  const years = useMemo(() => (all ? [...new Set(all.map((a) => a.d.slice(0, 4)))].sort().reverse() : []), [all])
  const acts = useMemo(
    () => (all ?? []).filter((a) => (year === 'all' || a.d.startsWith(year)) && (sport === 'all' || a.t === sport)),
    [all, year, sport],
  )

  const s = useMemo(() => {
    if (!acts.length) return null
    const dist = acts.reduce((x, a) => x + a.dist, 0)
    const time = acts.reduce((x, a) => x + a.mov, 0)
    const up = acts.reduce((x, a) => x + a.up, 0)
    const cal = acts.reduce((x, a) => x + (a.cal ?? 0), 0)
    const days = new Set(acts.map((a) => dayKey(a.d)))
    const max = (f: (a: Activity) => number, pool = acts) => pool.reduce<Activity | undefined>((b, a) => (!b || f(a) > f(b) ? a : b), undefined)
    const of = (t: string) => acts.filter((a) => a.t === t)
    const fastest = (t: string, minKm: number) =>
      of(t).filter((a) => a.dist >= minKm * 1000 && a.mov > 0).reduce<Activity | undefined>((b, a) => (!b || a.mov / a.dist < b.mov / b.dist ? a : b), undefined)
    const weeks = new Map<string, number>(), months = new Map<string, number>(), dayT = new Map<string, number>()
    for (const a of acts) {
      weeks.set(isoWeekKey(a.d), (weeks.get(isoWeekKey(a.d)) ?? 0) + a.mov)
      months.set(a.d.slice(0, 7), (months.get(a.d.slice(0, 7)) ?? 0) + a.dist)
      dayT.set(dayKey(a.d), (dayT.get(dayKey(a.d)) ?? 0) + a.mov)
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      dist, time, up, cal, days: days.size, streak: longestStreak([...days]),
      longestRun: max((a) => a.dist, of('Løpetur')), longestSki: max((a) => a.dist, of('Langrenn')),
      longestRoller: max((a) => a.dist, of('Rulleski')), longestBike: max((a) => a.dist, of('Sykkeltur')),
      longestTime: max((a) => a.mov), mostUp: max((a) => a.up), fastest5: fastest('Løpetur', 5), fastest10: fastest('Løpetur', 10),
      fastestHalf: fastest('Løpetur', 21), maxHr: max((a) => a.mhr ?? 0), topSpeed: max((a) => a.vmax ?? 0, of('Sykkeltur')),
      bestWeek: top(weeks), bestMonth: top(months), bestDay: top(dayT),
    }
  }, [acts])

  const present = useMemo(() => MAIN_SPORTS.concat('Annet').filter((k) => acts.some((a) => sportOf(a.t) === k)), [acts])
  const cfg = useMemo(() => Object.fromEntries(present.map((k) => [k, { label: k, color: SPORT_COLORS[k] }])) as ChartConfig, [present])
  const m = METRICS[metric]

  const monthly = useMemo(() => {
    if (!acts.length) return []
    const keys = [...new Set(acts.map((a) => a.d.slice(0, 7)))].sort()
    const first = keys[0], last = keys[keys.length - 1]
    const out: Record<string, number | string>[] = []
    let [y, mo] = first.split('-').map(Number)
    while (`${y}-${String(mo).padStart(2, '0')}` <= last) {
      const k = `${y}-${String(mo).padStart(2, '0')}`
      const row: Record<string, number | string> = { k, label: `${MONTHS[mo - 1]} ${String(y).slice(2)}` }
      for (const sp of present) row[sp] = 0
      for (const a of acts) if (a.d.startsWith(k)) row[sportOf(a.t)] = (row[sportOf(a.t)] as number) + m.val(a)
      out.push(row)
      if (++mo > 12) { mo = 1; y++ }
    }
    return out
  }, [acts, present, m])

  const split = useMemo(
    () => present.map((k) => ({ sport: k, v: acts.filter((a) => sportOf(a.t) === k).reduce((x, a) => x + m.val(a), 0), fill: SPORT_COLORS[k] })).filter((x) => x.v > 0),
    [acts, present, m],
  )

  const cumulative = useMemo(() => {
    const ys = [...new Set((all ?? []).map((a) => a.d.slice(0, 4)))].sort()
    const pool = (all ?? []).filter((a) => sport === 'all' || a.t === sport)
    const rows = Array.from({ length: 12 }, (_, i) => ({ m: MONTHS[i] } as Record<string, number | string>))
    for (const y of ys) {
      let c = 0
      const now = new Date()
      for (let i = 0; i < 12; i++) {
        if (+y === now.getFullYear() && i > now.getMonth()) break
        c += pool.filter((a) => a.d.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).reduce((x, a) => x + m.val(a), 0)
        rows[i][y] = Math.round(c * 10) / 10
      }
    }
    return { ys, rows }
  }, [all, sport, m])
  const yearColors = ['oklch(0.7 0.19 45)', 'oklch(0.68 0.15 235)', 'oklch(0.72 0.16 160)', 'oklch(0.75 0.16 95)', 'oklch(0.65 0.2 305)']

  const weekday = useMemo(() => {
    const r = WEEKDAYS.map((d) => ({ d, v: 0 }))
    for (const a of acts) r[(new Date(a.d).getDay() + 6) % 7].v += 1
    return r
  }, [acts])
  const hours = useMemo(() => {
    const r = Array.from({ length: 24 }, (_, h) => ({ h: String(h), v: 0 }))
    for (const a of acts) r[+a.d.slice(11, 13)].v += 1
    return r
  }, [acts])

  const paceTrend = useMemo(() => {
    const runs = (all ?? []).filter((a) => a.t === 'Løpetur' && a.dist >= 3000 && a.mov > 0)
    const by = new Map<string, { s: number; d: number }>()
    for (const a of runs) { const k = a.d.slice(0, 7); const o = by.get(k) ?? { s: 0, d: 0 }; o.s += a.mov; o.d += a.dist; by.set(k, o) }
    return [...by.entries()].sort().map(([k, o]) => ({ k, label: `${MONTHS[+k.slice(5) - 1]} ${k.slice(2, 4)}`, pace: Math.round((o.s / o.d) * 1000) }))
  }, [all])
  const paceFmt = (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`

  const longest = useMemo(() => [...acts].sort((a, b) => b.mov - a.mov).slice(0, 10), [acts])
  const heatYear = year === 'all' ? +(years[0] ?? new Date().getFullYear()) : +year

  if (!all) return <div className="text-muted-foreground grid min-h-screen place-items-center">Laster …</div>

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-500 p-1.5 text-white"><ActivityIcon className="size-5" /></div>
            <div>
              <h1 className="text-lg leading-tight font-semibold">Treningsdashboard</h1>
              <p className="text-muted-foreground text-xs">{fmtDate(all[0].d)} – {fmtDate(all[all.length - 1].d)} · {fmtInt(all.length)} økter</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={year} onValueChange={(v) => v && setYear(v)} items={[{ value: 'all', label: 'Alle år' }, ...years.map((y) => ({ value: y, label: y }))]}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle år</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sport} onValueChange={(v) => v && setSport(v)} items={[{ value: 'all', label: 'Alle idretter' }, ...[...new Set(all.map((a) => a.t))].sort().map((t) => ({ value: t, label: t }))]}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle idretter</SelectItem>
                {[...new Set(all.map((a) => a.t))].sort().map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={toggle} aria-label="Bytt tema">{dark ? <Sun /> : <Moon />}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {!s ? <p className="text-muted-foreground py-20 text-center">Ingen økter for dette utvalget.</p> : (<>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Route} label="Distanse" value={`${fmtInt(s.dist / 1000)} km`} sub={`${(s.dist / 40075000).toFixed(2).replace('.', ',')} × jorda rundt`} />
            <Kpi icon={Timer} label="Tid" value={fmtHours(s.time)} sub={`${(s.time / 86400).toFixed(1).replace('.', ',')} døgn`} />
            <Kpi icon={Mountain} label="Høydemeter" value={`${fmtInt(s.up)} m`} sub={`${(s.up / 8849).toFixed(1).replace('.', ',')} × Everest`} />
            <Kpi icon={ActivityIcon} label="Økter" value={fmtInt(acts.length)} sub={`${fmtInt(s.days)} aktive dager`} />
            <Kpi icon={Flame} label="Kalorier" value={fmtInt(s.cal)} sub="kcal totalt" />
            <Kpi icon={CalendarDays} label="Lengste serie" value={`${s.streak.best} dager`} sub={`til ${fmtDate(s.streak.bestEnd)}`} />
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5 text-amber-500" />Rekorder</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Record icon={Route} title="Lengste løpetur" value={s.longestRun ? `${fmtKm(s.longestRun.dist)} km` : '–'} a={s.longestRun} />
              <Record icon={Route} title="Lengste langrenn" value={s.longestSki ? `${fmtKm(s.longestSki.dist)} km` : '–'} a={s.longestSki} />
              <Record icon={Route} title="Lengste rulleski" value={s.longestRoller ? `${fmtKm(s.longestRoller.dist)} km` : '–'} a={s.longestRoller} />
              <Record icon={Route} title="Lengste sykkeltur" value={s.longestBike ? `${fmtKm(s.longestBike.dist)} km` : '–'} a={s.longestBike} />
              <Record icon={Timer} title="Lengste økt (tid)" value={s.longestTime ? fmtDur(s.longestTime.mov) : '–'} a={s.longestTime} />
              <Record icon={Mountain} title="Mest høydemeter" value={s.mostUp ? `${fmtInt(s.mostUp.up)} m` : '–'} a={s.mostUp} />
              <Record icon={Zap} title="Raskeste løp ≥ 5 km" value={s.fastest5 ? fmtPace(s.fastest5.dist, s.fastest5.mov) : '–'} a={s.fastest5} />
              <Record icon={Zap} title="Raskeste løp ≥ 10 km" value={s.fastest10 ? fmtPace(s.fastest10.dist, s.fastest10.mov) : '–'} a={s.fastest10} />
              <Record icon={Zap} title="Raskeste løp ≥ 21 km" value={s.fastestHalf ? fmtPace(s.fastestHalf.dist, s.fastestHalf.mov) : '–'} a={s.fastestHalf} />
              <Record icon={HeartPulse} title="Høyeste makspuls" value={s.maxHr?.mhr ? `${Math.round(s.maxHr.mhr)} bpm` : '–'} a={s.maxHr?.mhr ? s.maxHr : undefined} />
              <Card size="sm"><CardContent>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Beste uke · måned · dag</p>
                <p className="mt-2 text-sm"><span className="text-xl font-semibold tabular-nums">{s.bestWeek ? fmtHours(s.bestWeek[1]) : '–'}</span> <span className="text-muted-foreground">uke fra {s.bestWeek && fmtDate(s.bestWeek[0])}</span></p>
                <p className="text-sm"><span className="text-xl font-semibold tabular-nums">{s.bestMonth ? fmtInt(s.bestMonth[1] / 1000) : '–'} km</span> <span className="text-muted-foreground">{s.bestMonth && `${MONTHS[+s.bestMonth[0].slice(5) - 1]} ${s.bestMonth[0].slice(0, 4)}`}</span></p>
                <p className="text-sm"><span className="text-xl font-semibold tabular-nums">{s.bestDay ? fmtDur(s.bestDay[1]) : '–'}</span> <span className="text-muted-foreground">{s.bestDay && fmtDate(s.bestDay[0])}</span></p>
              </CardContent></Card>
              <Record icon={Zap} title="Toppfart sykkel" value={s.topSpeed?.vmax ? `${(s.topSpeed.vmax * 3.6).toFixed(1).replace('.', ',')} km/t` : '–'} a={s.topSpeed?.vmax ? s.topSpeed : undefined} />
            </div>
          </section>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div><CardTitle>Måned for måned</CardTitle><CardDescription>Fordelt på idrett</CardDescription></div>
              <ToggleGroup value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm">
                {(Object.keys(METRICS) as Metric[]).map((k) => <ToggleGroupItem key={k} value={k}>{METRICS[k].label}</ToggleGroupItem>)}
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <ChartContainer config={cfg} className="h-72 w-full">
                <BarChart data={monthly}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {present.map((k) => <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} />)}
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {present.map((k) => <span key={k} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: SPORT_COLORS[k] }} />{k}</span>)}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>År mot år</CardTitle><CardDescription>Akkumulert {m.label.toLowerCase()} per måned</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={Object.fromEntries(cumulative.ys.map((y, i) => [y, { label: y, color: yearColors[i % 5] }]))} className="h-64 w-full">
                  <LineChart data={cumulative.rows}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {cumulative.ys.map((y) => <Line key={y} dataKey={y} stroke={`var(--color-${y})`} strokeWidth={2.5} dot={false} connectNulls={false} />)}
                  </LineChart>
                </ChartContainer>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {cumulative.ys.map((y, i) => <span key={y} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: yearColors[i % 5] }} />{y}</span>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Idrettsfordeling</CardTitle><CardDescription>{m.label}</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={cfg} className="mx-auto h-48 w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="sport" />} />
                    <Pie data={split} dataKey="v" nameKey="sport" innerRadius={50} outerRadius={80} strokeWidth={2}>
                      {split.map((x) => <Cell key={x.sport} fill={x.fill} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="mt-2 space-y-1 text-sm">
                  {[...split].sort((a, b) => b.v - a.v).map((x) => (
                    <li key={x.sport} className="flex items-center justify-between"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: x.fill }} />{x.sport}</span><span className="text-muted-foreground tabular-nums">{m.fmt(x.v)}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Aktivitetskalender {heatYear}</CardTitle><CardDescription>Treningstid per dag</CardDescription></CardHeader>
            <CardContent><Heatmap acts={acts} year={heatYear} /></CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Ukedag</CardTitle><CardDescription>Antall økter</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={{ v: { label: 'Økter', color: 'oklch(0.7 0.19 45)' } }} className="h-48 w-full">
                  <BarChart data={weekday}><CartesianGrid vertical={false} /><XAxis dataKey="d" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={4} /></BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Tid på døgnet</CardTitle><CardDescription>Starttidspunkt</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={{ v: { label: 'Økter', color: 'oklch(0.68 0.15 235)' } }} className="h-48 w-full">
                  <BarChart data={hours}><CartesianGrid vertical={false} /><XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={3} /></BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Løpefart</CardTitle><CardDescription>Snittfart per måned (turer ≥ 3 km), min/km</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={{ pace: { label: 'Fart', color: 'oklch(0.72 0.16 160)' } }} className="h-48 w-full">
                  <LineChart data={paceTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} /><YAxis reversed domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={paceFmt} tickLine={false} axisLine={false} width={36} /><ChartTooltip content={<ChartTooltipContent formatter={(v) => paceFmt(Number(v)) + ' /km'} />} /><Line dataKey="pace" stroke="var(--color-pace)" strokeWidth={2.5} dot={false} /></LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Lengste økter</CardTitle><CardDescription>Topp 10 etter tid</CardDescription></CardHeader>
            <CardContent>
              <Tabs defaultValue="table"><TabsList><TabsTrigger value="table">Tabell</TabsTrigger></TabsList>
                <TabsContent value="table">
                  <Table>
                    <TableHeader><TableRow><TableHead>Økt</TableHead><TableHead>Dato</TableHead><TableHead className="text-right">Tid</TableHead><TableHead className="text-right">Distanse</TableHead><TableHead className="hidden text-right sm:table-cell">Høyde</TableHead><TableHead className="hidden text-right sm:table-cell">Puls</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {longest.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell><div className="flex items-center gap-2"><Badge variant="secondary" style={{ borderLeft: `3px solid ${SPORT_COLORS[sportOf(a.t)]}` }}>{a.t}</Badge><span className="max-w-[16rem] truncate">{a.n}</span></div></TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(a.d)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtDur(a.mov)}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.dist ? `${fmtKm(a.dist)} km` : '–'}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{a.up ? `${fmtInt(a.up)} m` : '–'}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{a.hr ? Math.round(a.hr) : '–'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>)}
        <footer className="text-muted-foreground pb-6 text-center text-xs">Data fra Strava-eksport · bygget med shadcn/ui</footer>
      </main>
    </div>
  )
}
