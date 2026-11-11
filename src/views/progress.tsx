import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, Scatter, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChartCard } from '@/components/common'
import { useStore } from '@/lib/store'
import {
  type Activity, BE_DIST, BE_LABELS, METRICS, METRIC, ZONE_COLORS, addDays, allBuckets, bucketKey, bucketLabel, daysBetween, fmtClock, fmtDate, fmtMonth, fmtNum,
  fmtPaceSec, isFoot, rolling, sportColor, todayStr, ts, weekStart,
} from '@/lib/data'

type Pt = { x: number; y: number; id: string; n: string; d: string }
const xTick = (v: number) => fmtMonth(new Date(v).toISOString())

function pct(vals: number[], p: number) { const s = [...vals].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] }

export function ProgressChart({ title, desc, pts, fmt, reversed, win = 10, color, best, unit, height = 'h-64', noTrend }: {
  title: string; desc?: string; pts: Pt[]; fmt: (v: number) => string; reversed?: boolean; win?: number; color: string
  best?: 'step' | 'window90'; unit?: string; height?: string; noTrend?: boolean
}) {
  const { open } = useStore()
  const data = useMemo(() => {
    const trend = rolling(pts.map((p) => ({ x: p.x, y: p.y })), win)
    let step: { x: number; y: number }[] = []
    if (best === 'step') {
      let b = reversed ? Infinity : -Infinity
      for (const p of pts) if (reversed ? p.y < b : p.y > b) { b = p.y; step.push({ x: p.x, y: p.y }) }
      if (step.length) step.push({ x: Date.now(), y: step[step.length - 1].y })
    }
    if (best === 'window90') {
      const s = [...pts].sort((a, b) => a.x - b.x)
      step = s.map((p) => { const w = s.filter((q) => q.x <= p.x && q.x > p.x - 90 * 86400000).map((q) => q.y); return { x: p.x, y: reversed ? Math.min(...w) : Math.max(...w) } })
    }
    const ys = pts.map((p) => p.y)
    const sy = step.map((q) => q.y)
    const dom: [number, number] = ys.length ? [Math.min(pct(ys, 0.01), ...sy), Math.max(pct(ys, 0.99), ...sy)] : [0, 1]
    const pad = (dom[1] - dom[0]) * 0.1 || 1
    return { trend, step, dom: [dom[0] - pad, dom[1] + pad] as [number, number] }
  }, [pts, win, best, reversed])
  const cfg: ChartConfig = { y: { label: title, color } }
  return (
    <ChartCard title={title} desc={desc} action={<Badge variant="secondary">{pts.length} økter</Badge>}>
      <ChartContainer config={cfg} className={`${height} w-full`}>
        <ComposedChart>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false} tickFormatter={xTick} minTickGap={40} />
          <YAxis dataKey="y" type="number" reversed={reversed} domain={data.dom} allowDataOverflow tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(v)} />
          <ChartTooltip cursor={false} content={({ payload }) => {
            const p = payload?.[0]?.payload as Pt | undefined
            if (!p?.n) return null
            return <div className="bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"><p className="max-w-56 truncate font-medium">{p.n}</p><p className="text-muted-foreground">{fmtDate(p.d)} · <span className="text-foreground font-semibold">{fmt(p.y)}{unit ? ' ' + unit : ''}</span></p><p className="text-muted-foreground mt-0.5">Trykk for detaljer</p></div>
          }} />
          <Scatter data={pts} fill="var(--color-y)" fillOpacity={0.4} isAnimationActive={false} className="cursor-pointer"
            onClick={(d: unknown) => { const o = d as { id?: string; payload?: { id?: string } }; const id = o.id ?? o.payload?.id; if (id) open(id) }} />
          {!noTrend && <Line data={data.trend} dataKey="y" stroke="var(--color-y)" strokeWidth={2.5} dot={false} isAnimationActive={false} tooltipType="none" />}
          {best && <Line data={data.step} dataKey="y" type={best === 'step' ? 'stepAfter' : 'monotone'} stroke="var(--foreground)" strokeWidth={2} strokeDasharray={best === 'window90' ? '5 4' : undefined} dot={false} isAnimationActive={false} tooltipType="none" />}
        </ComposedChart>
      </ChartContainer>
      <p className="text-muted-foreground mt-2 text-xs">
        {!noTrend && <span className="mr-3 inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: color }} />Glidende snitt ({win} økter)</span>}
        {best === 'step' && <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-foreground" />Beste hittil</span>}
        {best === 'window90' && <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-foreground" />Beste siste 90 dager</span>}
      </p>
    </ChartCard>
  )
}

const mkPts = (acts: Activity[], f: (a: Activity) => number | null): Pt[] =>
  acts.map((a) => ({ a, y: f(a) })).filter((x): x is { a: Activity; y: number } => x.y != null && isFinite(x.y)).map(({ a, y }) => ({ x: ts(a.d), y, id: a.id, n: a.n, d: a.d })).sort((p, q) => p.x - q.x)

const SPORTS = ['Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur']

export function Progress() {
  const { all, acts } = useStore()
  const [sport, setSport] = useState('Løpetur')
  const [scope, setScope] = useState<'all' | 'period'>('all')
  const [minKm, setMinKm] = useState('3')
  const [beKey, setBeKey] = useState('5k')
  const [metric, setMetric] = useState('hr')
  const [win, setWin] = useState('10')
  const pool = useMemo(() => (scope === 'all' ? all : acts).filter((a) => a.t === sport), [all, acts, scope, sport])
  const color = sportColor(sport)
  const foot = isFoot(sport)
  const mk = Number(minKm) * 1000
  const w = Number(win)
  const big = useMemo(() => pool.filter((a) => a.dist >= mk), [pool, mk])
  const M = METRIC[metric]

  const bePts = useMemo(() => mkPts(pool, (a) => a.be?.[beKey]?.[0] ?? null), [pool, beKey])
  const speedM = foot ? METRIC.pace : METRIC.speed
  const beFmt = (v: number) => fmtClock(v)
  const presets: { m: string; title: string; desc: string; pool?: Activity[]; best?: 'step' | 'window90'; reversed?: boolean; ok?: boolean }[] = [
    { m: foot ? 'pace' : 'speed', title: foot ? 'Pace' : 'Snittfart', desc: `Per økt (≥ ${minKm} km) · min/km`, pool: big, reversed: foot },
    { m: 'mhr', title: 'Makspuls', desc: 'Høyeste puls i hver økt', best: 'step' },
    { m: 'hr', title: 'Snittpuls', desc: 'Gjennomsnittspuls per økt' },
    { m: 'rhr', title: 'Hvilepuls', desc: 'Fra enhetens profil ved hver økt', reversed: true },
    { m: 'eff', title: 'Aerob effektivitet', desc: 'Meter per minutt per hjerteslag (økter ≥ 3 km). Høyere = mer effektiv', best: 'window90' },
    { m: 'cad', title: 'Kadens', desc: 'Skritt/trinn per minutt' },
    { m: 'stride', title: 'Steglengde', desc: 'Gjennomsnittlig steglengde' },
    { m: 'w', title: 'Snitt watt', desc: 'Gjennomsnittseffekt per økt' },
    { m: 'te', title: 'Aerob treningseffekt', desc: 'Garmin-skala 0–5' },
  ]

  const builderPts = useMemo(() => mkPts(pool.filter((a) => a.dist >= (METRIC[metric].key === 'dist' || ['time', 'up', 'cal', 'load'].includes(metric) ? 0 : mk)), M.get), [pool, metric, mk, M])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup value={[sport]} onValueChange={(v) => v[0] && setSport(v[0])} variant="outline" size="sm">
          {SPORTS.map((s) => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
        </ToggleGroup>
        <ToggleGroup value={[scope]} onValueChange={(v) => v[0] && setScope(v[0] as 'all' | 'period')} variant="outline" size="sm">
          <ToggleGroupItem value="all">Hele historikken</ToggleGroupItem>
          <ToggleGroupItem value="period">Valgt periode</ToggleGroupItem>
        </ToggleGroup>
        <Select value={minKm} onValueChange={(v) => v && setMinKm(v)} items={['0', '3', '5', '10', '15'].map((v) => ({ value: v, label: v === '0' ? 'Ingen minimumsdistanse' : `Minst ${v} km` }))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{['0', '3', '5', '10', '15'].map((v) => <SelectItem key={v} value={v}>{v === '0' ? 'Ingen minimumsdistanse' : `Minst ${v} km`}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={win} onValueChange={(v) => v && setWin(v)} items={['5', '10', '20', '40'].map((v) => ({ value: v, label: `Snitt over ${v} økter` }))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{['5', '10', '20', '40'].map((v) => <SelectItem key={v} value={v}>Snitt over {v} økter</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProgressChart
          title={`Beste ${BE_LABELS[beKey]}`} desc="Raskeste innsats i hver økt (tid) · lavere er bedre" pts={bePts} fmt={beFmt} reversed win={w} color={color} best="step" height="h-72" noTrend
        />
        <ChartCard title="Velg distanse" desc="Bytt distanse for rekordutviklingen til venstre">
          <ToggleGroup value={[beKey]} onValueChange={(v) => v[0] && setBeKey(v[0])} variant="outline" size="sm" className="flex-wrap">
            {Object.keys(BE_LABELS).map((k) => <ToggleGroupItem key={k} value={k}>{BE_LABELS[k]}</ToggleGroupItem>)}
          </ToggleGroup>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {Object.keys(BE_LABELS).map((k) => {
              const v = pool.map((a) => a.be?.[k]?.[0]).filter((x): x is number => !!x)
              if (!v.length) return null
              const b = Math.min(...v)
              return <button key={k} onClick={() => setBeKey(k)} className="bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-left"><p className="text-muted-foreground text-xs">{BE_LABELS[k]}</p><p className="font-semibold tabular-nums">{fmtClock(b)} <span className="text-muted-foreground text-xs font-normal">{fmtPaceSec(b / (BE_DIST[k] / 1000))}/km</span></p></button>
            })}
          </div>
        </ChartCard>
        {foot && (
          <ProgressChart title="VO2 maks (VDOT-estimat)" desc="Daniels VDOT fra beste 3–21 km-innsats med hard puls (≥ 80 % av makspuls). Stiplet linje = beste siste 90 dager. Dette er et estimat fra prestasjon, ikke Garmins VO2 maks." pts={mkPts(pool, METRIC.vdot.get)} fmt={(v) => fmtNum(v, 1)} win={w} color={color} best="window90" unit="" height="h-72" noTrend />
        )}
        {presets.map((p) => {
          const m = METRIC[p.m]
          const pts = mkPts(p.pool ?? pool, m.get)
          if (pts.length < 5) return null
          return <ProgressChart key={p.m} title={p.title} desc={p.desc} pts={pts} fmt={m.fmt} reversed={p.reversed} win={w} color={color} best={p.best} unit={m.unit} />
        })}
      </div>

      <ChartCard title="Bygg din egen graf" desc={`${sport}: velg hva som skal vises over tid · trykk på en prikk for å åpne økten`}
        action={
          <Select value={metric} onValueChange={(v) => v && setMetric(v)} items={METRICS.map((m) => ({ value: m.key, label: m.label }))}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        }>
        {builderPts.length < 2 ? <p className="text-muted-foreground py-10 text-center text-sm">Ikke nok data for dette målet.</p> : (
          <ProgressChartInner pts={builderPts} m={M} color={color} win={w} />
        )}
      </ChartCard>
      <p className="text-muted-foreground text-xs">Merk: {speedM.label.toLowerCase()} og effektivitet er ikke justert for terreng og føre. Hvilepuls leses fra enhetens profil og er ikke målt separat.</p>
    </div>
  )
}

function ProgressChartInner({ pts, m, color, win }: { pts: Pt[]; m: (typeof METRICS)[number]; color: string; win: number }) {
  const { open } = useStore()
  const trend = useMemo(() => rolling(pts, win), [pts, win])
  const ys = pts.map((p) => p.y)
  const lo = pct(ys, 0.01), hi = pct(ys, 0.99), pad = (hi - lo) * 0.1 || 1
  return (
    <ChartContainer config={{ y: { label: m.label, color } }} className="h-80 w-full">
      <ComposedChart>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false} tickFormatter={xTick} minTickGap={40} />
        <YAxis dataKey="y" type="number" reversed={m.reversed} domain={[lo - pad, hi + pad]} allowDataOverflow tickLine={false} axisLine={false} width={48} tickFormatter={(v) => m.fmt(v)} />
        <ChartTooltip cursor={false} content={({ payload }) => {
          const p = payload?.[0]?.payload as Pt | undefined
          if (!p?.n) return null
          return <div className="bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"><p className="max-w-56 truncate font-medium">{p.n}</p><p className="text-muted-foreground">{fmtDate(p.d)} · <span className="text-foreground font-semibold">{m.fmt(p.y)} {m.unit}</span></p></div>
        }} />
        <Scatter data={pts} fill="var(--color-y)" fillOpacity={0.45} isAnimationActive={false} className="cursor-pointer" onClick={(d: unknown) => { const o = d as { id?: string; payload?: { id?: string } }; const id = o.id ?? o.payload?.id; if (id) open(id) }} />
        <Line data={trend} dataKey="y" stroke="var(--color-y)" strokeWidth={2.5} dot={false} isAnimationActive={false} tooltipType="none" />
      </ComposedChart>
    </ChartContainer>
  )
}

// ---------------- Form / belastning ----------------
export function Form() {
  const { all, sportActs, range, first } = useStore()
  const today = todayStr()
  const [zoneSport, setZoneSport] = useState('Alle')

  const fitness = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const a of all) byDay.set(a.d.slice(0, 10), (byDay.get(a.d.slice(0, 10)) ?? 0) + a.load)
    const rows: { x: string; ctl: number; atl: number; tsb: number; load: number }[] = []
    let ctl = 0, atl = 0
    const n = daysBetween(first, today)
    for (let i = 0; i <= n; i++) {
      const d = addDays(first, i); const l = byDay.get(d) ?? 0
      ctl += (l - ctl) / 42; atl += (l - atl) / 7
      rows.push({ x: d, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10, load: l })
    }
    return rows
  }, [all, first, today])
  const view = useMemo(() => {
    const r = fitness.filter((x) => x.x >= range.from && x.x <= range.to)
    const step = Math.max(1, Math.ceil(r.length / 220))
    return r.filter((_, i) => i % step === 0 || i === r.length - 1)
  }, [fitness, range])

  const weekly = useMemo(() => {
    const end = range.to > today ? today : range.to
    const keys = allBuckets(range.from, end, 'week')
    const mp = new Map(keys.map((k) => [k, 0]))
    for (const a of sportActs) { const k = weekStart(a.d.slice(0, 10)); if (mp.has(k)) mp.set(k, mp.get(k)! + a.dist / 1000) }
    const vals = [...mp.values()]
    return keys.map((k, i) => ({ k, label: bucketLabel(k, 'week'), km: Math.round(vals[i] * 10) / 10, avg: Math.round((vals.slice(Math.max(0, i - 3), i + 1).reduce((x, y) => x + y, 0) / Math.min(4, i + 1)) * 10) / 10 }))
  }, [sportActs, range, today])

  const zones = useMemo(() => {
    const keys = allBuckets(range.from, range.to > today ? today : range.to, range.days > 400 ? 'month' : 'week')
    const g = range.days > 400 ? 'month' : 'week'
    const mp = new Map(keys.map((k) => [k, [0, 0, 0, 0, 0, 0]]))
    for (const a of sportActs) {
      if (!a.zones || (zoneSport !== 'Alle' && a.t !== zoneSport)) continue
      const r = mp.get(bucketKey(a.d, g)); if (r) a.zones.forEach((z, i) => (r[i] += z / 60))
    }
    return keys.map((k) => { const r = mp.get(k)!; const t = r.reduce((x, y) => x + y, 0) || 1; const o: Record<string, number | string> = { k, label: bucketLabel(k, g) }; r.forEach((v, i) => (o['z' + (i + 1)] = Math.round((v / t) * 100))); o.tot = Math.round(t); return o })
  }, [sportActs, range, today, zoneSport])
  const zcfg = Object.fromEntries(ZONE_COLORS.map((c, i) => [`z${i + 1}`, { label: `Sone ${i + 1}`, color: c }])) as ChartConfig
  const last = fitness[fitness.length - 1]

  return (
    <div className="space-y-6">
      {last && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Form (CTL)', last.ctl, '42 dagers snittbelastning'], ['Tretthet (ATL)', last.atl, '7 dagers snittbelastning'], ['Balanse (TSB)', last.tsb, last.tsb > 5 ? 'Uthvilt' : last.tsb < -15 ? 'Høy tretthet' : 'Nøytral'], ['Belastning i dag', last.load, 'TRIMP']].map(([l, v, s]) => (
            <div key={l as string} className="bg-card rounded-xl border p-4"><p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(v as number, 0)}</p><p className="text-muted-foreground text-xs">{s}</p></div>
          ))}
        </div>
      )}
      <ChartCard title="Form, tretthet og balanse" desc="Basert på alle økter og estimert TRIMP-belastning fra puls. CTL = kondisjon, ATL = akutt tretthet, TSB = CTL − ATL.">
        <ChartContainer config={{ ctl: { label: 'Form (CTL)', color: 'var(--brand)' }, atl: { label: 'Tretthet (ATL)', color: 'var(--sp-roller)' }, tsb: { label: 'Balanse (TSB)', color: 'var(--muted-foreground)' } }} className="h-80 w-full">
          <LineChart data={view}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="x" tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(v) => fmtMonth(v)} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDate(String(v))} />} />
            <Line dataKey="ctl" stroke="var(--color-ctl)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line dataKey="atl" stroke="var(--color-atl)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="tsb" stroke="var(--color-tsb)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Ukentlig volum" desc="Kilometer per uke med 4-ukers snitt (idrettsfilter gjelder)">
          <ChartContainer config={{ km: { label: 'km', color: 'var(--sp-roller)' }, avg: { label: '4-ukers snitt', color: 'var(--brand)' } }} className="h-64 w-full">
            <ComposedChart data={weekly}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="km" fill="var(--color-km)" radius={2} />
              <Line dataKey="avg" stroke="var(--color-avg)" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Pulssoner over tid" desc="Andel av treningstiden i hver sone (kun økter med sonedata)"
          action={
            <Select value={zoneSport} onValueChange={(v) => v && setZoneSport(v)} items={['Alle', 'Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur'].map((v) => ({ value: v, label: v }))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{['Alle', 'Løpetur', 'Langrenn', 'Rulleski', 'Sykkeltur'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          }>
          <ChartContainer config={zcfg} className="h-64 w-full">
            <ComposedChart data={zones}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {[1, 2, 3, 4, 5, 6].map((z) => <Bar key={z} dataKey={`z${z}`} stackId="z" fill={`var(--color-z${z})`} />)}
            </ComposedChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">{ZONE_COLORS.map((c, i) => <span key={i} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: c }} />Sone {i + 1}</span>)}</div>
        </ChartCard>
      </div>
    </div>
  )
}
