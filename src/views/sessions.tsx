import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Scatter, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartCard, SportDot } from '@/components/common'
import { useStore } from '@/lib/store'
import { type Activity, MAIN_SPORTS, METRICS, METRIC, SPORT_COLORS, fmtClock, fmtDate, fmtDur, fmtInt, fmtKm, fmtMonth, fmtSpeed, sportOf, toCsv, ts } from '@/lib/data'

type Col = { k: string; label: string; get: (a: Activity) => number | string; cell: (a: Activity) => string; right?: boolean; hide?: boolean }
const COLS: Col[] = [
  { k: 'd', label: 'Dato', get: (a) => a.d, cell: (a) => fmtDate(a.d) },
  { k: 'n', label: 'Økt', get: (a) => a.n.toLowerCase(), cell: (a) => a.n },
  { k: 't', label: 'Idrett', get: (a) => a.t, cell: (a) => a.t, hide: true },
  { k: 'dist', label: 'Distanse', get: (a) => a.dist, cell: (a) => (a.dist ? `${fmtKm(a.dist)} km` : '–'), right: true },
  { k: 'mov', label: 'Tid', get: (a) => a.mov, cell: (a) => fmtDur(a.mov), right: true },
  { k: 'pace', label: 'Pace/fart', get: (a) => (a.dist && a.mov ? a.dist / a.mov : 0), cell: (a) => fmtSpeed(a), right: true, hide: true },
  { k: 'up', label: 'Høyde', get: (a) => a.up, cell: (a) => (a.up ? `${fmtInt(a.up)} m` : '–'), right: true, hide: true },
  { k: 'hr', label: 'Puls', get: (a) => a.hr ?? 0, cell: (a) => (a.hr ? String(Math.round(a.hr)) : '–'), right: true, hide: true },
  { k: 'mhr', label: 'Maks', get: (a) => a.mhr ?? 0, cell: (a) => (a.mhr ? String(Math.round(a.mhr)) : '–'), right: true, hide: true },
  { k: 'load', label: 'Belastn.', get: (a) => a.load, cell: (a) => fmtInt(a.load), right: true, hide: true },
]

export function Sessions() {
  const { acts, open } = useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'd', dir: -1 })
  const [page, setPage] = useState(0)
  const [minKm, setMinKm] = useState('0')
  const PS = 25
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const c = COLS.find((x) => x.k === sort.k)!
    return acts.filter((a) => (!s || a.n.toLowerCase().includes(s) || a.t.toLowerCase().includes(s) || (a.gear ?? '').toLowerCase().includes(s)) && a.dist >= +minKm * 1000)
      .sort((a, b) => { const x = c.get(a), y = c.get(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir })
  }, [acts, q, sort, minKm])
  const pages = Math.max(1, Math.ceil(rows.length / PS))
  const pg = Math.min(page, pages - 1)
  const th = (c: Col) => (
    <TableHead key={c.k} className={`${c.right ? 'text-right' : ''} ${c.hide ? 'hidden md:table-cell' : ''} cursor-pointer select-none`} onClick={() => { setSort((s) => ({ k: c.k, dir: s.k === c.k ? (-s.dir as 1 | -1) : -1 })); setPage(0) }}>
      <span className="inline-flex items-center gap-1">{c.label}{sort.k === c.k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</span>
    </TableHead>
  )
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'okter.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <ChartCard title="Alle økter" desc={`${rows.length} økter i valgt periode og idrett · trykk på en rad for detaljer`}
      action={<Button variant="outline" size="sm" onClick={download}><Download />Last ned CSV</Button>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative"><Search className="text-muted-foreground absolute top-2 left-2.5 size-4" /><Input placeholder="Søk i navn, idrett, utstyr …" className="w-64 pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} /></div>
        <Select value={minKm} onValueChange={(v) => { if (v) { setMinKm(v); setPage(0) } }} items={['0', '5', '10', '20', '30'].map((v) => ({ value: v, label: v === '0' ? 'Alle distanser' : `Minst ${v} km` }))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{['0', '5', '10', '20', '30'].map((v) => <SelectItem key={v} value={v}>{v === '0' ? 'Alle distanser' : `Minst ${v} km`}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow>{COLS.filter((c) => c.k !== 't').map(th)}</TableRow></TableHeader>
        <TableBody>
          {rows.slice(pg * PS, pg * PS + PS).map((a) => (
            <TableRow key={a.id} className="cursor-pointer" onClick={() => open(a.id)}>
              {COLS.filter((c) => c.k !== 't').map((c) => (
                <TableCell key={c.k} className={`${c.right ? 'text-right tabular-nums' : ''} ${c.hide ? 'hidden md:table-cell' : ''} ${c.k === 'd' ? 'whitespace-nowrap' : ''}`}>
                  {c.k === 'n' ? <span className="flex items-center gap-2"><SportDot t={a.t} /><span className="max-w-[18rem] truncate">{a.n}</span><span className="text-muted-foreground hidden text-xs lg:inline">{a.t}</span></span> : c.cell(a)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Side {pg + 1} av {pages}</span>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Forrige</Button><Button variant="outline" size="sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Neste</Button></div>
      </div>
    </ChartCard>
  )
}

const AX = [{ key: 'date', label: 'Dato' }, ...METRICS.map((m) => ({ key: m.key, label: `${m.label}${m.unit ? ` (${m.unit})` : ''}` }))]

export function Explorer() {
  const { acts, open } = useStore()
  const [xk, setXk] = useState('dist')
  const [yk, setYk] = useState('hr')
  const val = (a: Activity, k: string) => (k === 'date' ? ts(a.d) : METRIC[k].get(a))
  const fmt = (k: string, v: number) => (k === 'date' ? fmtMonth(new Date(v).toISOString()) : k === 'time' ? fmtClock(v * 60) : METRIC[k].fmt(v))
  const series = useMemo(() => {
    const by = new Map<string, { x: number; y: number; id: string; n: string; d: string }[]>()
    for (const a of acts) {
      const x = val(a, xk), y = val(a, yk)
      if (x == null || y == null) continue
      const s = sportOf(a.t); if (!by.has(s)) by.set(s, [])
      by.get(s)!.push({ x, y, id: a.id, n: a.n, d: a.d })
    }
    return [...by.entries()]
  }, [acts, xk, yk]) // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = Object.fromEntries(MAIN_SPORTS.concat('Annet').map((s) => [s, { label: s, color: SPORT_COLORS[s] }])) as ChartConfig
  const total = series.reduce((n, [, v]) => n + v.length, 0)
  const ax = (k: string) => (k === 'date' ? undefined : METRIC[k])
  return (
    <ChartCard title="Utforsker" desc="Plott hvilken som helst måling mot en annen · farge = idrett · trykk på en prikk for å åpne økten"
      action={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Y</span>
          <Select value={yk} onValueChange={(v) => v && setYk(v)} items={AX.map((m) => ({ value: m.key, label: m.label }))}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{AX.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select>
          <span className="text-muted-foreground">X</span>
          <Select value={xk} onValueChange={(v) => v && setXk(v)} items={AX.map((m) => ({ value: m.key, label: m.label }))}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{AX.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select>
        </div>
      }>
      {total === 0 ? <p className="text-muted-foreground py-16 text-center text-sm">Ingen økter har begge målingene i dette utvalget.</p> : (
        <>
          <ChartContainer config={cfg} className="h-[28rem] w-full">
            <ComposedChart>
              <CartesianGrid />
              <XAxis dataKey="x" type="number" domain={['auto', 'auto']} scale={xk === 'date' ? 'time' : 'auto'} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(xk, v)} minTickGap={30} reversed={ax(xk)?.reversed} />
              <YAxis dataKey="y" type="number" domain={['auto', 'auto']} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => fmt(yk, v)} reversed={ax(yk)?.reversed} />
              <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                const p = payload?.[0]?.payload as { n?: string; d?: string; x: number; y: number } | undefined
                if (!p?.n) return null
                return <div className="bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"><p className="max-w-56 truncate font-medium">{p.n}</p><p className="text-muted-foreground">{fmtDate(p.d!)}</p><p>{AX.find((a) => a.key === xk)!.label.split(' (')[0]}: <b>{fmt(xk, p.x)}</b></p><p>{AX.find((a) => a.key === yk)!.label.split(' (')[0]}: <b>{fmt(yk, p.y)}</b></p></div>
              }} />
              {series.map(([s, d]) => <Scatter key={s} data={d} fill={SPORT_COLORS[s]} fillOpacity={0.6} isAnimationActive={false} className="cursor-pointer" onClick={(p: unknown) => { const o = p as { id?: string; payload?: { id?: string } }; const id = o.id ?? o.payload?.id; if (id) open(id) }} />)}
            </ComposedChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">{series.map(([s, d]) => <span key={s} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: SPORT_COLORS[s] }} />{s} ({d.length})</span>)}</div>
        </>
      )}
    </ChartCard>
  )
}
