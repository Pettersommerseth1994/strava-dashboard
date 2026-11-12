import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, Scatter, XAxis, YAxis } from 'recharts'
import { Award, Calendar, Flame, HeartPulse, Mountain, Route, Thermometer, Timer, Trophy, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChartCard, SportDot, hitDot } from '@/components/common'
import { Badges } from '@/components/badges'
import { useStore } from '@/lib/store'
import {
  type Activity, BE_DIST, BE_LABELS, METRICS, METRIC, bucketKey, bucketRange, dayKey, fmtClock, fmtDate, fmtDur, fmtHours, fmtInt, fmtKm, fmtMonth, fmtNum,
  fmtPace, fmtSpeed, longestStreak, sportColor, ts, isFoot,
} from '@/lib/data'

const SPORTS = ['Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur', 'Alle']

function RecCard({ icon: Icon, title, value, a, sub, onClick }: { icon: typeof Route; title: string; value: string; a?: Activity; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-w-0 text-left">
      <Card size="sm" className="hover:ring-foreground/30 relative h-full overflow-hidden transition-shadow hover:ring-1">
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: a ? sportColor(a.t) : 'var(--border)' }} />
        <CardContent className="min-w-0 pl-4 sm:pl-5">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase sm:text-xs"><Icon className="size-3.5 shrink-0" /><span className="truncate">{title}</span></div>
          <p className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{value}</p>
          <p className="mt-1 truncate text-sm">{a ? a.n : sub}</p>
          <p className="text-muted-foreground text-xs">{a ? `${a.t} · ${fmtDate(a.d)}` : ''}</p>
        </CardContent>
      </Card>
    </button>
  )
}

export function Records() {
  const { all, acts, open, goRange } = useStore()
  const [scope, setScope] = useState<'all' | 'period'>('all')
  const [sport, setSport] = useState('Løpetur')
  const [beKey, setBeKey] = useState('5k')
  const [topMetric, setTopMetric] = useState('dist')

  const pool = useMemo(() => (scope === 'all' ? all : acts).filter((a) => sport === 'Alle' || a.t === sport), [all, acts, scope, sport])
  const max = (f: (a: Activity) => number | null) => pool.reduce<Activity | undefined>((b, a) => { const v = f(a); return v != null && (!b || v > (f(b) ?? -Infinity)) ? a : b }, undefined)

  const bests = useMemo(() => Object.keys(BE_LABELS).map((k) => {
    const c = pool.filter((a) => a.be?.[k]).sort((x, y) => x.be![k][0] - y.be![k][0])
    return { k, best: c[0], n: c.length }
  }).filter((r) => r.best), [pool])
  const beK = bests.some((b) => b.k === beKey) ? beKey : bests[0]?.k

  const prog = useMemo(() => {
    if (!beK) return { pts: [], pr: [] }
    const pts = pool.filter((a) => a.be?.[beK]).sort((a, b) => (a.d < b.d ? -1 : 1)).map((a) => ({ x: ts(a.d), y: a.be![beK][0], id: a.id, n: a.n, d: a.d }))
    let best = Infinity
    const pr = pts.filter((p) => p.y < best && (best = p.y, true)).map((p) => ({ ...p }))
    if (pr.length) pr.push({ ...pr[pr.length - 1], x: Date.now() })
    return { pts, pr }
  }, [pool, beK])

  const periods = useMemo(() => {
    const agg = (g: 'day' | 'week' | 'month', f: (a: Activity) => number) => {
      const m = new Map<string, number>(); for (const a of pool) { const k = bucketKey(a.d, g); m.set(k, (m.get(k) ?? 0) + f(a)) }
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    }
    return {
      week: agg('week', (a) => a.mov), month: agg('month', (a) => a.dist), day: agg('day', (a) => a.mov), weekKm: agg('week', (a) => a.dist),
      streak: longestStreak(pool.map((a) => dayKey(a.d))),
    }
  }, [pool])

  const foot = sport === 'Løpetur' || sport === 'Gåtur'
  const fastest = useMemo(() => pool.filter((a) => a.dist >= 5000 && a.mov > 0).reduce<Activity | undefined>((b, a) => (!b || a.dist / a.mov > b.dist / b.mov ? a : b), undefined), [pool])
  const top = useMemo(() => {
    const m = METRIC[topMetric]
    return pool.map((a) => ({ a, v: m.get(a) })).filter((x): x is { a: Activity; v: number } => x.v != null).sort((x, y) => (m.reversed ? x.v - y.v : y.v - x.v)).slice(0, 15)
  }, [pool, topMetric])
  const tm = METRIC[topMetric]

  const longest = max((a) => a.dist || null), longestT = max((a) => a.mov), mostUp = max((a) => a.up || null), mostCal = max((a) => a.cal ?? null)
  const maxHr = max((a) => (a.mhr && a.mhr < 230 ? a.mhr : null)), load = max((a) => a.load), hot = max((a) => a.temp ?? null)
  const cold = pool.filter((a) => a.temp != null).reduce<Activity | undefined>((b, a) => (!b || a.temp! < b.temp! ? a : b), undefined)
  const vmax = max((a) => a.vmax ?? null), topVdot = max((a) => METRIC.vdot.get(a)), power = max((a) => a.w ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
          <ToggleGroup value={[sport]} onValueChange={(v) => v[0] && setSport(v[0])} variant="outline" size="sm">
            {SPORTS.map((s) => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <ToggleGroup value={[scope]} onValueChange={(v) => v[0] && setScope(v[0] as 'all' | 'period')} variant="outline" size="sm">
          <ToggleGroupItem value="all">Hele historikken</ToggleGroupItem>
          <ToggleGroupItem value="period">Valgt periode</ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="secondary">{pool.length} økter</Badge>
      </div>

      {bests.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <ChartCard className="lg:col-span-2" title="Personlige rekorder" desc="Raskeste sammenhengende innsats i én økt · trykk for å se utviklingen">
            <Table>
              <TableHeader><TableRow><TableHead>Distanse</TableHead><TableHead className="text-right">Tid</TableHead><TableHead className="hidden text-right sm:table-cell">{foot ? 'Pace' : 'Fart'}</TableHead><TableHead className="text-right">Dato</TableHead></TableRow></TableHeader>
              <TableBody>
                {bests.map((r) => (
                  <TableRow key={r.k} className={`cursor-pointer ${r.k === beK ? 'bg-muted' : ''}`} onClick={() => setBeKey(r.k)}>
                    <TableCell className="font-medium"><span className="flex items-center gap-2"><Trophy className="size-3.5 text-[var(--brand)]" />{BE_LABELS[r.k]}</span></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <button className="hover:underline" onClick={(e) => { e.stopPropagation(); open(r.best.id) }}>{fmtClock(r.best.be![r.k][0])}</button>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{foot ? fmtPace(BE_DIST[r.k], r.best.be![r.k][0]) : `${fmtNum((BE_DIST[r.k] / r.best.be![r.k][0]) * 3.6, 1)} km/t`}</TableCell>
                    <TableCell className="text-muted-foreground text-right whitespace-nowrap">{fmtDate(r.best.d)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>
          <ChartCard className="lg:col-span-3" title={`Rekordutvikling · ${beK ? BE_LABELS[beK] : ''}`} desc="Hver prikk er en økt, trappelinjen viser rekorden gjennom tid · trykk på en prikk">
            <ChartContainer config={{ y: { label: 'Tid', color: sportColor(sport === 'Alle' ? 'Løpetur' : sport) } }} className="h-72 w-full">
              <ComposedChart>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale="time" tickLine={false} axisLine={false} tickFormatter={(v) => fmtMonth(new Date(v).toISOString())} minTickGap={40} />
                <YAxis dataKey="y" type="number" reversed domain={['auto', 'auto']} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => fmtClock(v)} />
                <ChartTooltip cursor={false} content={({ payload }) => { const p = payload?.[0]?.payload as { n?: string; d?: string; y?: number } | undefined; if (!p?.n) return null; return <div className="bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"><p className="font-medium">{p.n}</p><p className="text-muted-foreground">{fmtDate(p.d!)} · {fmtClock(p.y!)}</p></div> }} />
                <Scatter data={prog.pts} fill="var(--color-y)" fillOpacity={0.45} shape={hitDot(open, { r: 4.5, hit: 11 })} isAnimationActive={false} />
                <Line data={prog.pr} dataKey="y" type="stepAfter" stroke="var(--brand)" strokeWidth={2.5} dot={hitDot(open, { r: 5.5, hit: 16, fill: 'var(--brand)', ring: true })} activeDot={false} isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>
        </div>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Award className="size-5 text-[var(--brand)]" />Toppresultater</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <RecCard icon={Route} title="Lengste distanse" value={longest ? `${fmtKm(longest.dist, 2)} km` : '–'} a={longest} onClick={() => longest && open(longest.id)} />
          <RecCard icon={Timer} title="Lengste tid" value={longestT ? fmtDur(longestT.mov) : '–'} a={longestT} onClick={() => longestT && open(longestT.id)} />
          <RecCard icon={Mountain} title="Mest høydemeter" value={mostUp ? `${fmtInt(mostUp.up)} m` : '–'} a={mostUp} onClick={() => mostUp && open(mostUp.id)} />
          <RecCard icon={Flame} title="Flest kalorier" value={mostCal ? `${fmtInt(mostCal.cal!)} kcal` : '–'} a={mostCal} onClick={() => mostCal && open(mostCal.id)} />
          <RecCard icon={Zap} title={foot ? 'Raskeste ≥ 5 km' : 'Høyeste snittfart ≥ 5 km'} value={fastest ? fmtSpeed(fastest) : '–'} a={fastest} onClick={() => fastest && open(fastest.id)} />
          <RecCard icon={Zap} title="Toppfart" value={vmax ? `${fmtNum(vmax.vmax! * 3.6, 1)} km/t` : '–'} a={vmax} onClick={() => vmax && open(vmax.id)} />
          <RecCard icon={HeartPulse} title="Høyeste makspuls" value={maxHr ? `${fmtInt(maxHr.mhr!)} bpm` : '–'} a={maxHr} onClick={() => maxHr && open(maxHr.id)} />
          <RecCard icon={Flame} title="Høyeste belastning" value={load ? fmtInt(load.load) : '–'} a={load} onClick={() => load && open(load.id)} />
          {foot && <RecCard icon={Zap} title="Høyeste VO2 maks (VDOT)" value={topVdot ? fmtNum(METRIC.vdot.get(topVdot)!, 1) : '–'} a={topVdot} onClick={() => topVdot && open(topVdot.id)} />}
          {power && <RecCard icon={Zap} title="Høyeste snitt watt" value={`${fmtInt(power.w!)} W`} a={power} onClick={() => open(power.id)} />}
          {hot && <RecCard icon={Thermometer} title="Varmeste økt" value={`${fmtInt(hot.temp!)} °C`} a={hot} onClick={() => open(hot.id)} />}
          {cold && <RecCard icon={Thermometer} title="Kaldeste økt" value={`${fmtInt(cold.temp!)} °C`} a={cold} onClick={() => open(cold.id)} />}
          <RecCard icon={Calendar} title="Beste uke (tid)" value={periods.week ? fmtHours(periods.week[1]) : '–'} sub={periods.week ? `Uke fra ${fmtDate(periods.week[0])}` : ''} onClick={() => { if (periods.week) { const [f, t] = bucketRange(periods.week[0], 'week'); goRange(f, t) } }} />
          <RecCard icon={Calendar} title="Beste uke (distanse)" value={periods.weekKm ? `${fmtInt(periods.weekKm[1] / 1000)} km` : '–'} sub={periods.weekKm ? `Uke fra ${fmtDate(periods.weekKm[0])}` : ''} onClick={() => { if (periods.weekKm) { const [f, t] = bucketRange(periods.weekKm[0], 'week'); goRange(f, t) } }} />
          <RecCard icon={Calendar} title="Beste måned" value={periods.month ? `${fmtInt(periods.month[1] / 1000)} km` : '–'} sub={periods.month ? fmtMonth(periods.month[0]) : ''} onClick={() => { if (periods.month) { const [f, t] = bucketRange(periods.month[0], 'month'); goRange(f, t) } }} />
          <RecCard icon={Calendar} title="Lengste serie" value={`${periods.streak.best} dager`} sub={periods.streak.best ? `${fmtDate(periods.streak.bestStart)} – ${fmtDate(periods.streak.bestEnd)}` : ''} onClick={() => periods.streak.best && goRange(periods.streak.bestStart, periods.streak.bestEnd)} />
          <RecCard icon={Calendar} title="Travleste dag" value={periods.day ? fmtDur(periods.day[1]) : '–'} sub={periods.day ? fmtDate(periods.day[0]) : ''} onClick={() => periods.day && goRange(periods.day[0], periods.day[0])} />
        </div>
      </section>

      <ChartCard title="Topplister" desc="Topp 15 økter for valgt mål"
        action={
          <Select value={topMetric} onValueChange={(v) => v && setTopMetric(v)} items={METRICS.map((m) => ({ value: m.key, label: m.label }))}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        }>
        <Table>
          <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Økt</TableHead><TableHead className="hidden sm:table-cell">Dato</TableHead><TableHead className="text-right">{tm.label}</TableHead></TableRow></TableHeader>
          <TableBody>
            {top.map((x, i) => (
              <TableRow key={x.a.id} className="cursor-pointer" onClick={() => open(x.a.id)}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell><span className="flex items-center gap-2"><SportDot t={x.a.t} /><span className="max-w-xs truncate">{x.a.n}</span>{isFoot(x.a.t) ? null : <span className="text-muted-foreground text-xs">{x.a.t}</span>}</span></TableCell>
                <TableCell className="text-muted-foreground hidden whitespace-nowrap sm:table-cell">{fmtDate(x.a.d)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{tm.fmt(x.v)} <span className="text-muted-foreground text-xs font-normal">{tm.unit}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
      <ChartCard title="Merker" desc="Prestasjoner som låses opp automatisk fra treningsdataene · trykk på et merke for detaljer">
        <Badges />
      </ChartCard>
    </div>
  )
}
