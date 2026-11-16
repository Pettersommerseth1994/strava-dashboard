import { useMemo, useState } from 'react'
import { Flame, HeartPulse, Mountain, Route, Timer, Trophy, Zap, CalendarDays, Thermometer, Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/lib/ctx'
import { type Activity, SPORT_COLORS, dayKey, fmtDate, fmtDur, fmtInt, fmtKm, fmtPace, fmtPaceSec, fmtTime, sportOf, vdot, avgSpeed } from '@/lib/data'
import { presets } from '@/lib/period'
import { dayGroups, longestStreak, maxBy, minBy, topGroups, weekGroups } from '@/lib/stats'

type Rec = { key: string; icon: typeof Route; title: string; value: string; a?: Activity }

const EFFORTS = [['b1k', '1 km', 1000], ['b1m', '1 mile', 1609.344], ['b5k', '5 km', 5000], ['b10k', '10 km', 10000], ['bhm', 'Halvmaraton', 21097.5]] as const

export function Records() {
  const { all, acts, sports, range, open, setRange } = useApp()
  const [allTime, setAllTime] = useState(false)
  const pool = useMemo(() => (allTime ? all.filter((a) => sports.length === 0 || sports.includes(a.t)) : acts), [allTime, all, acts, sports])

  const recs = useMemo<Rec[]>(() => {
    const of = (t: string) => pool.filter((a) => a.t === t)
    const L = (title: string, t: string): Rec => { const a = maxBy(of(t), (x) => x.dist); return { key: title, icon: Route, title, value: a ? `${fmtKm(a.dist)} km` : '–', a } }
    const longT = maxBy(pool, (a) => a.mov), up = maxBy(pool, (a) => a.up)
    const hr = maxBy(pool, (a) => a.mhr), avgHr = maxBy(pool.filter((a) => a.mov > 1800), (a) => a.hr)
    const cal = maxBy(pool, (a) => a.cal), pw = maxBy(pool.filter((a) => a.mov > 1200), (a) => a.w)
    const speed = maxBy(of('Sykkeltur'), (a) => a.vmax), fastBike = maxBy(of('Sykkeltur').filter((a) => a.dist > 20000), (a) => avgSpeed(a))
    const fastSki = maxBy(of('Langrenn').filter((a) => a.dist > 10000), (a) => avgSpeed(a))
    const fastRoller = maxBy(of('Rulleski').filter((a) => a.dist > 10000), (a) => avgSpeed(a))
    const cold = minBy(pool.filter((a) => a.tmp != null).map((a) => ({ ...a, tmp: (a.tmp ?? 0) + 100 })), (a) => a.tmp)
    const coldA = cold ? pool.find((a) => a.id === cold.id) : undefined
    const hot = maxBy(pool.filter((a) => a.tmp != null && a.mov > 1800), (a) => a.tmp)
    const days = [...new Set(pool.map((a) => dayKey(a.d)))]
    const st = longestStreak(days)
    const dayNo = topGroups(pool, (a) => dayKey(a.d), () => 1)[0]
    return [
      L('Lengste løpetur', 'Løpetur'), L('Lengste langrenn', 'Langrenn'), L('Lengste rulleski', 'Rulleski'), L('Lengste sykkeltur', 'Sykkeltur'), L('Lengste gåtur', 'Gåtur'),
      { key: 't', icon: Timer, title: 'Lengste økt (tid)', value: longT ? fmtDur(longT.mov) : '–', a: longT },
      { key: 'up', icon: Mountain, title: 'Mest høydemeter', value: up ? `${fmtInt(up.up)} m` : '–', a: up },
      { key: 'cal', icon: Flame, title: 'Flest kalorier', value: cal?.cal ? `${fmtInt(cal.cal)} kcal` : '–', a: cal },
      { key: 'hr', icon: HeartPulse, title: 'Høyeste makspuls', value: hr?.mhr ? `${Math.round(hr.mhr)} bpm` : '–', a: hr },
      { key: 'ahr', icon: HeartPulse, title: 'Høyeste snittpuls (>30 min)', value: avgHr?.hr ? `${Math.round(avgHr.hr)} bpm` : '–', a: avgHr },
      { key: 'pw', icon: Zap, title: 'Høyeste snittwatt (>20 min)', value: pw?.w ? `${Math.round(pw.w)} W` : '–', a: pw },
      { key: 'sp', icon: Gauge, title: 'Toppfart sykkel', value: speed?.vmax ? `${(speed.vmax * 3.6).toFixed(1).replace('.', ',')} km/t` : '–', a: speed },
      { key: 'fb', icon: Gauge, title: 'Raskeste sykkeltur (>20 km)', value: fastBike ? `${(avgSpeed(fastBike) * 3.6).toFixed(1).replace('.', ',')} km/t` : '–', a: fastBike },
      { key: 'fs', icon: Gauge, title: 'Raskeste langrenn (>10 km)', value: fastSki ? `${(avgSpeed(fastSki) * 3.6).toFixed(1).replace('.', ',')} km/t` : '–', a: fastSki },
      { key: 'fr', icon: Gauge, title: 'Raskeste rulleski (>10 km)', value: fastRoller ? `${(avgSpeed(fastRoller) * 3.6).toFixed(1).replace('.', ',')} km/t` : '–', a: fastRoller },
      { key: 'cold', icon: Thermometer, title: 'Kaldeste økt', value: coldA?.tmp != null ? `${coldA.tmp.toFixed(0)} °C` : '–', a: coldA },
      { key: 'hot', icon: Thermometer, title: 'Varmeste økt (>30 min)', value: hot?.tmp != null ? `${hot.tmp.toFixed(0)} °C` : '–', a: hot },
      { key: 'day', icon: CalendarDays, title: 'Flest økter på én dag', value: dayNo ? `${dayNo[1]} økter` : '–', a: dayNo ? pool.find((a) => dayKey(a.d) === dayNo[0]) : undefined },
      { key: 'st', icon: CalendarDays, title: 'Lengste serie på rad', value: st.best ? `${st.best} dager` : '–', a: st.end ? pool.filter((a) => dayKey(a.d) === st.end).at(-1) : undefined },
    ].filter((r) => r.a || r.key === 'x') as Rec[]
  }, [pool])

  const periods = useMemo(() => {
    const w = weekGroups(pool, (a) => a.mov)[0], wd = weekGroups(pool, (a) => a.dist)[0]
    const m = topGroups(pool, (a) => a.d.slice(0, 7), (a) => a.dist)[0], mt = topGroups(pool, (a) => a.d.slice(0, 7), (a) => a.mov)[0], mu = topGroups(pool, (a) => a.d.slice(0, 7), (a) => a.up)[0]
    const d = dayGroups(pool, (a) => a.mov)[0], dd = dayGroups(pool, (a) => a.dist)[0]
    const y = topGroups(pool, (a) => a.d.slice(0, 4), (a) => a.dist)[0]
    return { w, wd, m, mt, mu, d, dd, y }
  }, [pool])

  const runs = pool.filter((a) => a.t === 'Løpetur')
  const dlist = (from: string, to: string, title: string) => open({ kind: 'list', title, ids: pool.filter((a) => a.d.slice(0, 10) >= from && a.d.slice(0, 10) <= to).map((a) => a.id) })
  const monthName = (k: string) => new Date(k + '-01').toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
  const weekEnd = (k: string) => new Date(new Date(k).getTime() + 6 * 86400000).toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5 text-amber-500" />Rekorder {allTime ? '· all tid' : `· ${range.label}`}</h2>
        <label className="flex items-center gap-2 text-sm"><Switch checked={allTime} onCheckedChange={setAllTime} />Vis all tid</label>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium">Beste innsatser løping <span className="text-muted-foreground font-normal">(raskeste sammenhengende strekning i en løpetur)</span></h3>
        <Card><CardContent>
          <Tabs defaultValue="b5k">
            <TabsList>{EFFORTS.map(([k, n]) => <TabsTrigger key={k} value={k}>{n}</TabsTrigger>)}</TabsList>
            {EFFORTS.map(([k, n, dist]) => {
              const top = runs.filter((a) => a[k]).sort((a, b) => (a[k] as number) - (b[k] as number)).slice(0, 10)
              return (
                <TabsContent key={k} value={k} className="pt-3">
                  {!top.length ? <p className="text-muted-foreground text-sm">Ingen {n}-innsatser i utvalget.</p> : (
                    <ol className="space-y-1.5">
                      {top.map((a, i) => (
                        <li key={a.id}><button onClick={() => open({ kind: 'activity', id: a.id })} className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors">
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-muted'}`}>{i + 1}</span>
                          <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.n}</p><p className="text-muted-foreground text-xs">{fmtDate(a.d)}</p></div>
                          <div className="text-right tabular-nums"><p className="font-semibold">{fmtTime(a[k] as number)}</p><p className="text-muted-foreground text-xs">{fmtPaceSec((a[k] as number) / (dist / 1000))} /km{dist >= 5000 ? ` · VDOT ${vdot(dist, a[k] as number).toFixed(1)}` : ''}</p></div>
                        </button></li>
                      ))}
                    </ol>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent></Card>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Personlige rekorder <span className="text-muted-foreground font-normal">– trykk for å se økten</span></h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recs.map((r) => {
            const a = r.a as Activity
            return (
              <button key={r.key} onClick={() => open({ kind: 'activity', id: a.id })} className="text-left">
                <Card size="sm" className="hover:bg-muted/40 relative h-full overflow-hidden transition-colors hover:-translate-y-0.5">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: SPORT_COLORS[sportOf(a.t)] }} />
                  <CardContent className="pl-5">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide"><r.icon className="size-3.5" />{r.title}</div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{r.value}</p>
                    <p className="mt-1 truncate text-sm">{a.n}</p>
                    <p className="text-muted-foreground text-xs">{a.t} · {fmtDate(a.d)}</p>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Toppperioder</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {periods.w && <PCard title="Beste uke (tid)" value={fmtDur(periods.w[1])} sub={`Uke fra ${fmtDate(periods.w[0])}`} onClick={() => dlist(periods.w[0], weekEnd(periods.w[0]), 'Beste uke')} onJump={() => setRange(presets.week(periods.w[0]))} />}
          {periods.wd && <PCard title="Beste uke (distanse)" value={`${fmtInt(periods.wd[1] / 1000)} km`} sub={`Uke fra ${fmtDate(periods.wd[0])}`} onClick={() => dlist(periods.wd[0], weekEnd(periods.wd[0]), 'Beste uke')} onJump={() => setRange(presets.week(periods.wd[0]))} />}
          {periods.m && <PCard title="Beste måned (distanse)" value={`${fmtInt(periods.m[1] / 1000)} km`} sub={monthName(periods.m[0])} onClick={() => setRange(presets.month(+periods.m[0].slice(0, 4), +periods.m[0].slice(5) - 1))} />}
          {periods.mt && <PCard title="Beste måned (tid)" value={fmtDur(periods.mt[1])} sub={monthName(periods.mt[0])} onClick={() => setRange(presets.month(+periods.mt[0].slice(0, 4), +periods.mt[0].slice(5) - 1))} />}
          {periods.mu && <PCard title="Beste måned (høyde)" value={`${fmtInt(periods.mu[1])} m`} sub={monthName(periods.mu[0])} onClick={() => setRange(presets.month(+periods.mu[0].slice(0, 4), +periods.mu[0].slice(5) - 1))} />}
          {periods.d && <PCard title="Beste dag (tid)" value={fmtDur(periods.d[1])} sub={fmtDate(periods.d[0])} onClick={() => dlist(periods.d[0], periods.d[0], fmtDate(periods.d[0]))} />}
          {periods.dd && <PCard title="Beste dag (distanse)" value={`${fmtKm(periods.dd[1])} km`} sub={fmtDate(periods.dd[0])} onClick={() => dlist(periods.dd[0], periods.dd[0], fmtDate(periods.dd[0]))} />}
          {periods.y && <PCard title="Beste år (distanse)" value={`${fmtInt(periods.y[1] / 1000)} km`} sub={periods.y[0]} onClick={() => setRange(presets.year(+periods.y[0]))} />}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">Månedskort bytter periode til den måneden. Raskeste løp i snitt: <Badge variant="outline">{(() => { const f = minBy(runs.filter((a) => a.dist >= 5000), (a) => a.mov / a.dist); return f ? `${fmtPace(f.dist, f.mov)} (${fmtKm(f.dist)} km)` : '–' })()}</Badge></p>
      </section>
    </div>
  )
}

function PCard({ title, value, sub, onClick, onJump }: { title: string; value: string; sub: string; onClick: () => void; onJump?: () => void }) {
  return (
    <Card size="sm" className="hover:bg-muted/40 transition-colors"><CardContent>
      <button onClick={onClick} className="block w-full text-left">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <CardDescription className="capitalize">{sub}</CardDescription>
      </button>
      {onJump && <button onClick={onJump} className="text-muted-foreground hover:text-foreground mt-1 text-xs underline">Bytt til uka</button>}
    </CardContent></Card>
  )
}
