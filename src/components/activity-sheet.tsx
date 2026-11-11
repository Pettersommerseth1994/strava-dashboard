import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Link2, Trophy } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import {
  type Activity, type Detail, effortVdot, BE_DIST, BE_LABELS, ZONE_COLORS, fmtClock, fmtDateTime, fmtDur, fmtInt, fmtKm, fmtNum, fmtPace,
  fmtPaceSec, fmtSpeed, isFoot, sportColor,
} from '@/lib/data'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
    </div>
  )
}

const SERIES = [
  { k: 'hr', l: 'Puls', u: 'bpm' }, { k: 'v', l: 'Fart', u: '' }, { k: 'alt', l: 'Høyde', u: 'm' }, { k: 'cad', l: 'Kadens', u: 'spm' }, { k: 'pw', l: 'Watt', u: 'W' },
] as const

export function ActivitySheet() {
  const { openId, open, byId, all } = useStore()
  const a = openId ? byId.get(openId) : undefined
  const [det, setDet] = useState<Detail | null>(null)
  const [series, setSeries] = useState<string>('hr')

  useEffect(() => {
    setDet(null)
    if (!a?.det) return
    let dead = false
    fetch(`${import.meta.env.BASE_URL}act/${a.id}.json`).then((r) => r.json()).then((d) => { if (!dead) setDet(d) }).catch(() => {})
    return () => { dead = true }
  }, [a?.id, a?.det])

  const idx = useMemo(() => (a ? all.findIndex((x) => x.id === a.id) : -1), [a, all])
  const sameSport = useMemo(() => (a ? all.filter((x) => x.t === a.t) : []), [a, all])
  const ranks = useMemo(() => {
    if (!a) return []
    const r = (f: (x: Activity) => number, label: string) => {
      const v = f(a); if (!v) return null
      return { label, n: sameSport.filter((x) => f(x) > v).length + 1, of: sameSport.filter((x) => f(x) > 0).length }
    }
    return [r((x) => x.dist, 'lengste distanse'), r((x) => x.mov, 'lengste tid'), r((x) => x.up, 'mest høydemeter'), r((x) => x.load, 'høyest belastning')]
      .filter((x): x is { label: string; n: number; of: number } => !!x && x.n <= 10)
  }, [a, sameSport])

  const chart = useMemo(() => {
    if (!det || !a) return null
    const useDist = !!det.d && a.dist > 0
    const avail = SERIES.filter((s) => det[s.k as keyof Detail] && (det[s.k as keyof Detail] as (number | null)[]).some((x) => x != null))
    const key = avail.some((s) => s.k === series) ? series : avail[0]?.k
    if (!key) return null
    const rows = det.t.map((t, i) => {
      let y = (det[key as keyof Detail] as (number | null)[])[i] ?? null
      if (key === 'v' && y != null) y = isFoot(a.t) ? (y > 0.6 ? 1000 / y : null) : y * 3.6
      return { x: useDist ? (det.d![i] ?? 0) / 1000 : t / 60, y, hr: det.hr?.[i] ?? null }
    })
    return { rows, avail, key, useDist }
  }, [det, series, a])

  const be = useMemo(() => {
    if (!a?.be) return []
    return Object.entries(a.be).map(([k, [sec, hr]]) => {
      const peers = sameSport.filter((x) => x.be?.[k])
      const best = Math.min(...peers.map((x) => x.be![k][0]))
      const earlier = peers.filter((x) => x.d < a.d).map((x) => x.be![k][0])
      const prThen = !earlier.length || sec < Math.min(...earlier)
      return { k, sec, hr, isPr: sec <= best, prThen }
    })
  }, [a, sameSport])

  if (!a) return <Sheet open={false}><SheetContent /></Sheet>
  const foot = isFoot(a.t)
  const vd = effortVdot(a)
  const color = sportColor(a.t)
  const zones = a.zones && a.zones.reduce((x, y) => x + y, 0) > 0 ? a.zones : null
  const zt = zones ? zones.reduce((x, y) => x + y, 0) : 0
  const splits = det?.splits ?? []
  const splitSecs = splits.map((s) => s[0])
  const fast = Math.min(...splitSecs), slow = Math.max(...splitSecs)

  return (
    <Sheet open={!!openId} onOpenChange={(o) => !o && open(null)}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <div className="h-1.5 w-full" style={{ background: color }} />
        <SheetHeader className="space-y-1 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" style={{ borderLeft: `3px solid ${color}` }}>{a.t}</Badge>
            {a.gear && <Badge variant="outline">{a.gear}</Badge>}
          </div>
          <SheetTitle className="pr-8 text-xl">{a.n}</SheetTitle>
          <SheetDescription>{fmtDateTime(a.d)}</SheetDescription>
          <div className="flex gap-1 pt-1">
            <Button variant="outline" size="sm" disabled={idx <= 0} onClick={() => open(all[idx - 1].id)}><ChevronLeft />Forrige økt</Button>
            <Button variant="outline" size="sm" disabled={idx >= all.length - 1} onClick={() => open(all[idx + 1].id)}>Neste økt<ChevronRight /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Kopier lenke" onClick={() => navigator.clipboard?.writeText(location.href).catch(() => {})}><Link2 /></Button>
          </div>
        </SheetHeader>

        <div className="space-y-5 p-5 pt-2">
          {(be.some((b) => b.isPr) || ranks.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {be.filter((b) => b.isPr).map((b) => <Badge key={b.k} className="bg-amber-500/15 text-amber-500"><Trophy className="size-3" />Rekord {BE_LABELS[b.k]}</Badge>)}
              {be.filter((b) => !b.isPr && b.prThen).map((b) => <Badge key={b.k} variant="outline">PR da · {BE_LABELS[b.k]}</Badge>)}
              {ranks.map((r) => <Badge key={r.label} variant="secondary">#{r.n} {r.label} ({r.of} økter)</Badge>)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {a.dist > 0 && <Stat label="Distanse" value={`${fmtKm(a.dist, 2)} km`} />}
            <Stat label="Bevegelsestid" value={fmtDur(a.mov)} sub={a.el > a.mov + 60 ? `Medgått ${fmtDur(a.el)}` : undefined} />
            {a.dist > 0 && <Stat label={foot ? 'Pace' : 'Snittfart'} value={fmtSpeed(a)} sub={a.vmax ? `Topp ${fmtNum(a.vmax * 3.6, 1)} km/t` : undefined} />}
            {a.up > 0 && <Stat label="Stigning" value={`${fmtInt(a.up)} m`} sub={a.down ? `Fall ${fmtInt(a.down)} m` : undefined} />}
            {a.hr && <Stat label="Snittpuls" value={`${fmtInt(a.hr)} bpm`} sub={a.mhr ? `Maks ${fmtInt(a.mhr)}` : undefined} />}
            {a.cal && <Stat label="Kalorier" value={`${fmtInt(a.cal)} kcal`} />}
            {a.cad && <Stat label="Kadens" value={`${fmtInt(a.cad)} spm`} sub={a.stride ? `Steg ${fmtNum(a.stride, 2)} m` : undefined} />}
            {a.w && <Stat label="Watt" value={`${fmtInt(a.w)} W`} sub={a.np ? `NP ${a.np} W` : undefined} />}
            {a.te && <Stat label="Treningseffekt" value={fmtNum(a.te, 1)} sub={a.ate ? `Anaerob ${fmtNum(a.ate, 1)}` : undefined} />}
            <Stat label="Belastning" value={fmtInt(a.load)} sub={a.re ? `Relative Effort ${a.re}` : 'TRIMP-estimat'} />
            {vd != null && <Stat label="VO2 maks (VDOT)" value={fmtNum(vd, 1)} sub="fra hard innsats" />}
            {a.temp != null && <Stat label="Temperatur" value={`${fmtInt(a.temp)} °C`} />}
            {a.gct && <Stat label="Bakkekontakt" value={`${a.gct} ms`} sub={a.vo ? `Vertikal ${fmtNum(a.vo, 1)} cm` : undefined} />}
            {a.rhr && <Stat label="Hvilepuls (profil)" value={`${a.rhr} bpm`} />}
          </div>

          {zones && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Pulssoner</h3>
              <div className="flex h-5 overflow-hidden rounded-md">
                {zones.map((z, i) => z > 0 && <div key={i} style={{ width: `${(z / zt) * 100}%`, background: ZONE_COLORS[i] }} title={`Sone ${i + 1}: ${fmtClock(z)}`} />)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-6">
                {zones.map((z, i) => (
                  <div key={i} className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: ZONE_COLORS[i] }} /><span className="text-muted-foreground">Z{i + 1}</span><span className="tabular-nums">{fmtClock(z)}</span></div>
                ))}
              </div>
            </div>
          )}

          {a.det && !det && <p className="text-muted-foreground text-sm">Laster øktdata …</p>}
          {chart && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Profil</h3>
                <ToggleGroup value={[chart.key]} onValueChange={(v) => v[0] && setSeries(v[0])} variant="outline" size="sm">
                  {chart.avail.map((s) => <ToggleGroupItem key={s.k} value={s.k}>{s.k === 'v' ? (foot ? 'Pace' : 'Fart') : s.l}</ToggleGroupItem>)}
                </ToggleGroup>
              </div>
              <ChartContainer config={{ y: { label: chart.key === 'v' ? (foot ? 'Pace' : 'Fart') : SERIES.find((s) => s.k === chart.key)!.l, color } }} className="h-52 w-full">
                <AreaChart data={chart.rows}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false} tickFormatter={(v) => (chart.useDist ? `${fmtNum(v, 0)} km` : `${fmtNum(v, 0)} min`)} minTickGap={30} />
                  <YAxis tickLine={false} axisLine={false} width={42} reversed={chart.key === 'v' && foot} domain={['auto', 'auto']} tickFormatter={(v) => (chart.key === 'v' && foot ? fmtPaceSec(v) : fmtNum(v, 0))} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => { const x = p?.[0]?.payload?.x; return chart.useDist ? `${fmtNum(x, 2)} km` : `${fmtNum(x, 0)} min` }} formatter={(v) => <span className="font-mono tabular-nums">{chart.key === 'v' && foot ? fmtPaceSec(Number(v)) + ' /km' : fmtNum(Number(v), 1)}</span>} />} />
                  <Area dataKey="y" stroke="var(--color-y)" fill="var(--color-y)" fillOpacity={0.18} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                </AreaChart>
              </ChartContainer>
            </div>
          )}

          {splits.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Kilometersplitter</h3>
              <div className="space-y-1">
                {splits.map((s, i) => {
                  const w = slow > fast ? 35 + ((slow - s[0]) / (slow - fast)) * 65 : 100
                  return (
                    <div key={i} className="grid grid-cols-[2rem_1fr_3.5rem_3rem] items-center gap-2 text-xs sm:grid-cols-[2rem_1fr_4rem_3rem_3rem]">
                      <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                      <div className="bg-muted h-4 overflow-hidden rounded"><div className="h-full rounded" style={{ width: `${w}%`, background: s[0] === fast ? 'oklch(0.75 0.16 160)' : color, opacity: s[0] === fast ? 1 : 0.75 }} /></div>
                      <span className="text-right tabular-nums">{foot ? fmtPaceSec(s[0]) : fmtNum(3600 / s[0], 1) + ' km/t'}</span>
                      <span className="text-muted-foreground text-right tabular-nums">{s[1] ? `${s[1]} ♥` : ''}</span>
                      <span className="text-muted-foreground hidden text-right tabular-nums sm:block">{s[2] != null ? `${s[2] > 0 ? '+' : ''}${s[2]} m` : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {be.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Beste innsatser i økten</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {be.map((b) => (
                  <Stat key={b.k} label={BE_LABELS[b.k]} value={fmtClock(b.sec)} sub={`${fmtPace(BE_DIST[b.k], b.sec)}${b.hr ? ` · ${b.hr} ♥` : ''}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
