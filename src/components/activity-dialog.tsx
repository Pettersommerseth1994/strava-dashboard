import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp, type Selection } from '@/lib/ctx'
import { SPORT_COLORS, sportOf, fmtDate, fmtDur, fmtInt, fmtKm, fmtSpeed, fmtTime, fmtPaceSec, isFoot, vdot, type Activity } from '@/lib/data'

type Detail = { p: (number | null)[][]; s: (number | null)[][]; z?: number[]; te?: number; ate?: number; np?: number; cad?: number; sl?: number; vo?: number; gct?: number }

const EFFORTS: [keyof Activity, string, number][] = [['b1k', '1 km', 1000], ['b1m', '1 mile', 1609.344], ['b5k', '5 km', 5000], ['b10k', '10 km', 10000], ['bhm', 'Halvmaraton', 21097.5]]
const ZONES = [['Z1 · Rolig', '<60%'], ['Z2 · Aerob', '60–70%'], ['Z3 · Tempo', '70–80%'], ['Z4 · Terskel', '80–90%'], ['Z5 · Maks', '>90%']]
const ZCOL = ['oklch(0.72 0.1 220)', 'oklch(0.72 0.16 160)', 'oklch(0.8 0.16 95)', 'oklch(0.72 0.19 50)', 'oklch(0.62 0.23 25)']

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  )
}

function ActivityView({ a }: { a: Activity }) {
  const { all, open } = useApp()
  const [d, setD] = useState<Detail | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    setD(undefined)
    fetch(`${import.meta.env.BASE_URL}details/${a.id}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => live && setD(j)).catch(() => live && setD(null))
    return () => { live = false }
  }, [a.id])

  const foot = isFoot(a.t)
  const color = SPORT_COLORS[sportOf(a.t)]
  const same = useMemo(() => all.filter((x) => x.t === a.t), [all, a.t])
  const idx = same.findIndex((x) => x.id === a.id)
  const prof = useMemo(() => (d?.p ?? []).map((r) => ({
    km: (r[1] ?? 0) / 1000, alt: r[2], hr: r[3],
    v: foot ? (r[4] && r[4] > 0.8 ? Math.min(720, 1000 / r[4]) : null) : (r[4] != null ? r[4] * 3.6 : null),
  })), [d, foot])
  const splits = useMemo(() => (d?.s ?? []).map((r, i) => ({
    km: i + 1, v: foot ? r[0] : (1000 / (r[0] ?? 1)) * 3.6, hr: r[1], up: r[2],
  })), [d, foot])
  const fast = splits.length ? (foot ? Math.min(...splits.map((s) => s.v ?? 1e9)) : Math.max(...splits.map((s) => s.v ?? 0))) : 0
  const vFmt = (v: number) => (foot ? fmtPaceSec(v) : v.toFixed(0))
  const hasHr = prof.some((p) => p.hr)
  const zsum = d?.z ? d.z.reduce((x, y) => x + y, 0) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {a.dist > 0 && <Stat label="Distanse" value={`${fmtKm(a.dist, 2)} km`} />}
        <Stat label="Bevegelsestid" value={fmtDur(a.mov)} sub={a.el > a.mov + 60 ? `Medgått ${fmtDur(a.el)}` : undefined} />
        {a.dist > 0 && <Stat label={foot ? 'Snittpace' : 'Snittfart'} value={fmtSpeed(a)} />}
        {a.up > 0 && <Stat label="Høydemeter" value={`${fmtInt(a.up)} m`} />}
        {a.hr && <Stat label="Snittpuls" value={`${Math.round(a.hr)} bpm`} />}
        {a.mhr && <Stat label="Makspuls" value={`${Math.round(a.mhr)} bpm`} />}
        {a.cal && <Stat label="Kalorier" value={fmtInt(a.cal)} />}
        {a.w && <Stat label="Snitt watt" value={`${Math.round(a.w)} W`} sub={d?.np ? `NP ${d.np} W` : undefined} />}
        {d?.te != null && <Stat label="Treningseffekt" value={`${d.te}`} sub={d.ate != null ? `Anaerob ${d.ate}` : undefined} />}
        {d?.cad && <Stat label="Kadens" value={`${d.cad * 2} spm`} />}
        {d?.sl && <Stat label="Steglengde" value={`${(d.sl / 1000).toFixed(2).replace('.', ',')} m`} />}
        {a.tmp != null && <Stat label="Temperatur" value={`${a.tmp.toFixed(0)} °C`} />}
      </div>

      {d === undefined && <p className="text-muted-foreground py-6 text-center text-sm">Laster detaljer …</p>}
      {d && (
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            {splits.length > 0 && <TabsTrigger value="splits">Splitter</TabsTrigger>}
            {zsum > 0 && <TabsTrigger value="zones">Pulssoner</TabsTrigger>}
            {EFFORTS.some(([k]) => a[k]) && <TabsTrigger value="best">Innsatser</TabsTrigger>}
          </TabsList>
          <TabsContent value="profile" className="space-y-3 pt-2">
            {a.dist > 0 && (<>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">{foot ? 'Pace (min/km)' : 'Fart (km/t)'}</p>
                <ChartContainer config={{ v: { label: foot ? 'Pace' : 'Fart', color } }} className="h-32 w-full">
                  <LineChart data={prof}><CartesianGrid vertical={false} /><XAxis dataKey="km" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v.toFixed(0)}`} tickLine={false} axisLine={false} /><YAxis reversed={foot} tickFormatter={vFmt} width={38} tickLine={false} axisLine={false} domain={['auto', 'auto']} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `${(p?.[0]?.payload?.km ?? 0).toFixed(2)} km`} formatter={(v) => (foot ? fmtPaceSec(Number(v)) + ' /km' : Number(v).toFixed(1) + ' km/t')} />} /><Line dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} connectNulls /></LineChart>
                </ChartContainer>
              </div>
              {hasHr && <div>
                <p className="text-muted-foreground mb-1 text-xs">Puls (bpm)</p>
                <ChartContainer config={{ hr: { label: 'Puls', color: 'oklch(0.65 0.23 25)' } }} className="h-32 w-full">
                  <LineChart data={prof}><CartesianGrid vertical={false} /><XAxis dataKey="km" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v.toFixed(0)}`} tickLine={false} axisLine={false} /><YAxis width={38} tickLine={false} axisLine={false} domain={['auto', 'auto']} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Line dataKey="hr" stroke="var(--color-hr)" strokeWidth={2} dot={false} connectNulls /></LineChart>
                </ChartContainer>
              </div>}
            </>)}
            {prof.some((p) => p.alt != null) && <div>
              <p className="text-muted-foreground mb-1 text-xs">Høyde (m)</p>
              <ChartContainer config={{ alt: { label: 'Høyde', color: 'oklch(0.6 0.05 260)' } }} className="h-28 w-full">
                <AreaChart data={prof}><CartesianGrid vertical={false} /><XAxis dataKey="km" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v.toFixed(0)} km`} tickLine={false} axisLine={false} /><YAxis width={38} tickLine={false} axisLine={false} domain={['auto', 'auto']} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Area dataKey="alt" stroke="var(--color-alt)" fill="var(--color-alt)" fillOpacity={0.25} /></AreaChart>
              </ChartContainer>
            </div>}
          </TabsContent>
          {splits.length > 0 && (
            <TabsContent value="splits" className="pt-2">
              <ChartContainer config={{ v: { label: foot ? 'Pace' : 'Fart', color }, hr: { label: 'Puls', color: 'oklch(0.65 0.23 25)' } }} className="h-56 w-full">
                <ComposedChart data={splits}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="km" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" reversed={foot} width={38} tickFormatter={vFmt} tickLine={false} axisLine={false} domain={foot ? ['dataMax + 20', 'dataMin - 30'] : [0, 'auto']} />
                  <YAxis yAxisId="r" orientation="right" width={34} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => (n === 'v' ? (foot ? fmtPaceSec(Number(v)) + ' /km' : Number(v).toFixed(1) + ' km/t') : `${v} bpm`)} />} />
                  <Bar yAxisId="l" dataKey="v" radius={3}>{splits.map((s) => <Cell key={s.km} fill={s.v === fast ? 'oklch(0.75 0.17 150)' : color} />)}</Bar>
                  {hasHr && <Line yAxisId="r" dataKey="hr" stroke="var(--color-hr)" strokeWidth={2} dot={false} />}
                </ComposedChart>
              </ChartContainer>
              <p className="text-muted-foreground mt-1 text-xs">Grønn stolpe = raskeste kilometer. Linje = snittpuls.</p>
            </TabsContent>
          )}
          {zsum > 0 && d.z && (
            <TabsContent value="zones" className="space-y-2 pt-2">
              {d.z.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0">{ZONES[i][0]}</span>
                  <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full"><div className="h-full rounded-full" style={{ width: `${(s / zsum) * 100}%`, background: ZCOL[i] }} /></div>
                  <span className="text-muted-foreground w-24 text-right tabular-nums">{fmtDur(s)} · {Math.round((s / zsum) * 100)}%</span>
                </div>
              ))}
              <p className="text-muted-foreground text-xs">Soner beregnet ut fra antatt makspuls 190 bpm.</p>
            </TabsContent>
          )}
          <TabsContent value="best" className="pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {EFFORTS.filter(([k]) => a[k]).map(([k, name, dist]) => {
                const t = a[k] as number
                const ranked = all.filter((x) => x[k]).sort((x, y) => (x[k] as number) - (y[k] as number))
                const rank = ranked.findIndex((x) => x.id === a.id) + 1
                const vd = dist >= 5000 ? vdot(dist, t) : null
                return (
                  <button key={k} onClick={() => open({ kind: 'list', title: `Beste ${name}`, ids: ranked.slice(0, 15).map((x) => x.id) })} className="bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-left transition-colors">
                    <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Beste {name}</p>
                    <p className="text-lg font-semibold tabular-nums">{fmtTime(t)} <span className="text-muted-foreground text-xs font-normal">{fmtPaceSec(t / (dist / 1000))} /km</span></p>
                    <p className="text-muted-foreground text-xs">#{rank} av {ranked.length} løpeturer{vd ? ` · VDOT ${vd.toFixed(1)}` : ''}</p>
                  </button>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <Button variant="outline" size="sm" disabled={idx <= 0} onClick={() => open({ kind: 'activity', id: same[idx - 1].id })}><ChevronLeft />Forrige {a.t.toLowerCase()}</Button>
        <span className="text-muted-foreground text-xs">#{idx + 1} av {same.length}</span>
        <Button variant="outline" size="sm" disabled={idx >= same.length - 1} onClick={() => open({ kind: 'activity', id: same[idx + 1].id })}>Neste<ChevronRight /></Button>
      </div>
    </div>
  )
}

export function ActivityHost({ sel, back, close, goBack }: { sel: Selection; back: Selection; close: () => void; goBack: () => void }) {
  const { byId, open } = useApp()
  const a = sel?.kind === 'activity' ? byId.get(sel.id) : undefined
  return (
    <Dialog open={!!sel} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {sel?.kind === 'activity' && a && (<>
          <DialogHeader>
            {back && <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={goBack}><ArrowLeft />Tilbake</Button>}
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">{a.n}<Badge variant="secondary" style={{ borderLeft: `3px solid ${SPORT_COLORS[sportOf(a.t)]}` }}>{a.t}</Badge></DialogTitle>
            <DialogDescription>{fmtDate(a.d)} kl. {a.d.slice(11, 16)}</DialogDescription>
          </DialogHeader>
          <ActivityView a={a} />
        </>)}
        {sel?.kind === 'list' && (<>
          <DialogHeader><DialogTitle>{sel.title}</DialogTitle><DialogDescription>{sel.ids.length} økter – trykk for detaljer</DialogDescription></DialogHeader>
          <div className="space-y-1.5">
            {sel.ids.map((id) => byId.get(id)).filter((x): x is Activity => !!x).map((x) => (
              <button key={x.id} onClick={() => open({ kind: 'activity', id: x.id })} className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors" style={{ borderLeft: `3px solid ${SPORT_COLORS[sportOf(x.t)]}` }}>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{x.n}</p><p className="text-muted-foreground text-xs">{x.t} · {fmtDate(x.d)}</p></div>
                <div className="text-right text-sm tabular-nums">{x.dist > 0 && <p>{fmtKm(x.dist)} km</p>}<p className="text-muted-foreground">{fmtDur(x.mov)}</p></div>
              </button>
            ))}
          </div>
        </>)}
      </DialogContent>
    </Dialog>
  )
}
