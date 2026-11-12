import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity as ActivityIcon, CalendarDays, Flame, Gauge, Mountain, RotateCcw, Route, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActivityRow, ChartCard, Delta, Kpi } from '@/components/common'
import { useStore } from '@/lib/store'
import {
  type Activity, type Gran, MAIN_SPORTS, SPORT_COLORS, WEEKDAYS, addDays, allBuckets, autoGran, bucketKey, bucketLabel, bucketRange,
  MONTHS, daysBetween, parseYmd, dayKey, fmtDate, fmtDur, fmtHours, fmtInt, fmtKm, fmtNum, longestStreak, sportOf, sumBy, todayStr,
} from '@/lib/data'

type Metric = 'dist' | 'time' | 'up' | 'count' | 'load'
const M: Record<Metric, { label: string; unit: string; val: (a: Activity) => number; fmt: (v: number) => string }> = {
  dist: { label: 'Distanse', unit: 'km', val: (a) => a.dist / 1000, fmt: (v) => fmtNum(v, 1) + ' km' },
  time: { label: 'Tid', unit: 't', val: (a) => a.mov / 3600, fmt: (v) => fmtNum(v, 1) + ' t' },
  up: { label: 'Høydemeter', unit: 'm', val: (a) => a.up, fmt: (v) => fmtInt(v) + ' m' },
  load: { label: 'Belastning', unit: 'TRIMP', val: (a) => a.load, fmt: (v) => fmtInt(v) },
  count: { label: 'Økter', unit: 'økter', val: () => 1, fmt: (v) => fmtInt(v) },
}

type DayInfo = { h: number; n: number; km: number; up: number; sports: string[]; ids: string[] }
const LEVELS = [0, 0.25, 0.45, 0.7, 1]
const lvl = (v: number) => (v === 0 ? 0 : v < 1 ? 1 : v < 2 ? 2 : v < 3.5 ? 3 : 4)
const DAYS_LONG = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']

function HeatStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground truncate text-[11px]">{sub}</p>}
    </div>
  )
}

function Heatmap({ acts, to, onDay }: { acts: Activity[]; to: string; onDay: (d: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth }, [to])
  const today = todayStr()
  const end = addDays(to, 6 - ((new Date(to + 'T00:00:00Z').getUTCDay() + 6) % 7))
  const start = addDays(end, -53 * 7 + 1)
  const byDay = useMemo(() => {
    const m = new Map<string, DayInfo>()
    for (const a of acts) {
      const k = dayKey(a.d)
      if (k < start || k > to) continue
      const o = m.get(k) ?? { h: 0, n: 0, km: 0, up: 0, sports: [], ids: [] }
      o.h += a.mov / 3600; o.n++; o.km += a.dist / 1000; o.up += a.up; o.ids.push(a.id)
      if (!o.sports.includes(a.t)) o.sports.push(a.t)
      m.set(k, o)
    }
    return m
  }, [acts, start, to])
  const cells = Array.from({ length: 53 * 7 }, (_, i) => { const k = addDays(start, i); return { k, d: byDay.get(k), future: k > to } })
  const months = Array.from({ length: 53 }, (_, w) => {
    const k = addDays(start, w * 7)
    const prev = w ? addDays(start, (w - 1) * 7) : ''
    return !prev || k.slice(5, 7) !== prev.slice(5, 7) ? MONTHS[+k.slice(5, 7) - 1] : ''
  })

  const stats = useMemo(() => {
    const vals = [...byDay.entries()]
    const days = daysBetween(start, to) + 1
    const h = vals.reduce((x, [, v]) => x + v.h, 0)
    const best = vals.sort((a, b) => b[1].h - a[1].h)[0]
    const st = longestStreak([...byDay.keys()])
    const wd = [0, 0, 0, 0, 0, 0, 0]; for (const [k, v] of byDay) wd[(parseYmd(k).getUTCDay() + 6) % 7] += v.h
    let cur = 0; for (let d = to; byDay.has(d); d = addDays(d, -1)) cur++
    return { active: byDay.size, days, h, best, st, wd: wd.indexOf(Math.max(...wd)), cur }
  }, [byDay, start, to])

  const hv = hover ? byDay.get(hover) : undefined
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <HeatStat label="Aktive dager" value={`${stats.active}`} sub={`${Math.round((stats.active / stats.days) * 100)} % av ${stats.days} dager`} />
        <HeatStat label="Treningstid" value={fmtHours(stats.h * 3600)} sub={`${fmtNum(stats.h / (stats.days / 7), 1)} t per uke i snitt`} />
        <HeatStat label="Lengste serie" value={`${stats.st.best} dager`} sub={stats.st.best ? `${fmtDate(stats.st.bestStart)} – ${fmtDate(stats.st.bestEnd)}` : ''} />
        <HeatStat label="Nåværende serie" value={`${stats.cur} ${stats.cur === 1 ? 'dag' : 'dager'}`} sub={stats.cur ? `til og med ${fmtDate(to)}` : 'hviledag sist'} />
        <HeatStat label="Travleste dag" value={stats.best ? fmtDur(stats.best[1].h * 3600) : '–'} sub={stats.best ? fmtDate(stats.best[0]) : ''} />
        <HeatStat label="Mest aktive ukedag" value={DAYS_LONG[stats.wd][0].toUpperCase() + DAYS_LONG[stats.wd].slice(1)} sub="etter treningstid" />
      </div>

      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="grid min-w-[760px] gap-[3px]" style={{ gridTemplateColumns: '1.75rem repeat(53, minmax(0, 1fr))' }} onMouseLeave={() => setHover(null)}>
          <div />
          {months.map((m, w) => <div key={w} className="text-muted-foreground h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap">{m}</div>)}
          {Array.from({ length: 7 }, (_, r) => (
            <Fragment key={r}>
              <div className="text-muted-foreground flex items-center text-[10px]">{r % 2 === 0 ? WEEKDAYS[r] : ''}</div>
              {Array.from({ length: 53 }, (_, w) => {
                const c = cells[w * 7 + r]
                if (c.future) return <div key={w} className="aspect-square" />
                const l = lvl(c.d?.h ?? 0)
                return (
                  <button
                    key={w}
                    onMouseEnter={() => setHover(c.k)}
                    onFocus={() => setHover(c.k)}
                    onClick={() => c.d && onDay(c.k)}
                    aria-label={`${fmtDate(c.k)}: ${c.d ? `${c.d.n} økter, ${fmtDur(c.d.h * 3600)}` : 'hvile'}`}
                    style={l ? { background: `color-mix(in oklch, var(--brand) ${LEVELS[l] * 100}%, transparent)` } : undefined}
                    className={`aspect-square rounded-[3px] transition-transform ${l ? '' : 'bg-muted'} ${c.d ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${hover === c.k ? 'ring-foreground ring-1' : ''} ${c.k === today ? 'ring-foreground/60 ring-1 ring-offset-1 ring-offset-[var(--card)]' : ''}`}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
        <div className="min-h-5 min-w-0 flex-1">
          {hover ? (
            <p className="truncate">
              <span className="font-medium capitalize">{DAYS_LONG[(parseYmd(hover).getUTCDay() + 6) % 7]} {fmtDate(hover)}</span>
              {hv ? (
                <span className="text-muted-foreground"> · {hv.n} {hv.n === 1 ? 'økt' : 'økter'} · {fmtDur(hv.h * 3600)}{hv.km > 0.5 ? ` · ${fmtNum(hv.km, 1)} km` : ''}{hv.up > 50 ? ` · ${fmtInt(hv.up)} hm` : ''} · {hv.sports.join(', ')}</span>
              ) : <span className="text-muted-foreground"> · hviledag</span>}
            </p>
          ) : <p className="text-muted-foreground">Hold musepekeren over en dag for detaljer. Trykk for å åpne økten eller dagen.</p>}
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5">
          <span>Mindre</span>
          {LEVELS.map((o, i) => <i key={i} className={`size-3 rounded-[3px] ${i ? '' : 'bg-muted'}`} style={i ? { background: `color-mix(in oklch, var(--brand) ${o * 100}%, transparent)` } : undefined} title={['Hvile', '< 1 t', '1–2 t', '2–3,5 t', '> 3,5 t'][i]} />)}
          <span>Mer</span>
        </div>
      </div>
    </div>
  )
}

export function Overview() {
  const { acts, prevActs, compare, range, prevRange, all, goRange, open, sports, setSports, sportActs, period, setPeriod } = useStore()
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

  const isDefault = period.kind === 'all' && gran === 'auto' && metric === 'dist'
  const resetChart = () => { setPeriod({ kind: 'all', offset: 0 }); setGran('auto'); setMetric('dist') }

  const onBar = (st: unknown) => {
    const i = (st as { activeTooltipIndex?: number })?.activeTooltipIndex
    if (i == null) return
    const k = buckets[+i]?.k as string | undefined
    if (k && g !== 'day') { const [f, t] = bucketRange(k, g); goRange(f, t) }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
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
          <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
            <Button variant="outline" size="icon-sm" onClick={resetChart} disabled={isDefault} aria-label="Tilbake til standardvisning" title="Tilbake til alle år, per år">
              <RotateCcw />
            </Button>
            <div className="bg-foreground/20 mx-1.5 hidden h-5 w-px sm:block" aria-hidden />
            <ToggleGroup value={[gran]} onValueChange={(v) => v[0] && setGran(v[0] as Gran | 'auto')} variant="outline" size="sm">
              {([['auto', 'Auto'], ['day', 'Dag'], ['week', 'Uke'], ['month', 'Mnd'], ['year', 'År']] as const).map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="bg-foreground/20 mx-1.5 hidden h-5 w-px sm:block" aria-hidden />
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
            <YAxis tickLine={false} axisLine={false} width={metric === 'load' ? 88 : 72} tickFormatter={(v: number) => `${fmtInt(v)}\u00a0${m.unit}`} />
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
          <ChartContainer config={{ v: { label: m.label, color: 'var(--sp-roller)' } }} className="h-56 w-full">
            <BarChart data={weekday}><CartesianGrid vertical={false} /><XAxis dataKey="d" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={4} /></BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Tid på døgnet" desc={`${m.label} etter starttidspunkt`}>
          <ChartContainer config={{ v: { label: m.label, color: 'var(--sp-roller)' } }} className="h-56 w-full">
            <BarChart data={hours}><CartesianGrid vertical={false} /><XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="v" fill="var(--color-v)" radius={3} /></BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <ChartCard title="Aktivitetskalender" desc={`Treningstid per dag, siste 53 uker til ${fmtDate(range.to > today ? today : range.to)}${sports.length ? ` · ${sports.join(", ")}` : ""}`}>
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
