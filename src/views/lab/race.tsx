import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { type Activity, MONTHS, fmtDate, fmtInt, fmtNum } from '@/lib/data'
import { TODAY, YEAR, doy, inYear } from './shared'

type M = 'km' | 't' | 'n'
const VAL: Record<M, (a: Activity) => number> = { km: (a) => a.dist / 1000, t: (a) => a.mov / 3600, n: () => 1 }
const UNIT: Record<M, string> = { km: 'km', t: 't', n: 'økter' }
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

function cumulative(acts: Activity[], f: (a: Activity) => number) {
  const per = new Array(367).fill(0)
  acts.forEach((a) => { per[doy(a.d)] += f(a) })
  for (let i = 1; i < 367; i++) per[i] += per[i - 1]
  return per
}

export function Race() {
  const { all } = useStore()
  const [m, setM] = useState<M>('km')
  const today = doy(TODAY)
  const { data, cur, prev, passed } = useMemo(() => {
    const c = cumulative(inYear(all, YEAR), VAL[m]), p = cumulative(inYear(all, YEAR - 1), VAL[m]), pp = cumulative(inYear(all, YEAR - 2), VAL[m])
    const data = Array.from({ length: 365 }, (_, i) => ({ d: i + 1, y0: i + 1 <= today ? c[i + 1] : null, y1: p[i + 1], y2: pp[i + 1] }))
    const total = p[366]
    const passedDay = c.findIndex((v, i) => i > 0 && v >= total && total > 0)
    return { data, cur: c[today], prev: p[today], passed: passedDay > 0 && passedDay <= today ? passedDay : 0 }
  }, [all, m, today])

  const diff = cur - prev
  const u = UNIT[m]
  const f = (v: number) => (m === 't' ? fmtNum(v, 0) : fmtInt(v))
  const cfg = { y0: { label: String(YEAR), color: 'var(--brand)' }, y1: { label: String(YEAR - 1), color: 'var(--sp-roller)' }, y2: { label: String(YEAR - 2), color: 'var(--muted-foreground)' } } satisfies ChartConfig
  const dateOf = (d: number) => fmtDate(new Date(Date.UTC(YEAR, 0, d)).toISOString()).replace(/ \d{4}$/, '')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            Du ligger <span className="text-[var(--brand)] tabular-nums">{f(Math.abs(diff))} {u}</span> {diff >= 0 ? 'foran' : 'bak'} {YEAR - 1}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            På samme dato: {f(cur)} {u} i år mot {f(prev)} {u} i fjor ({prev ? `${diff >= 0 ? '+' : '−'}${fmtInt(Math.abs((cur / prev - 1) * 100))} %` : '–'}).
            {passed ? ` Du passerte hele ${YEAR - 1} allerede ${dateOf(passed).replace(/\.$/, '')}.` : ''}
          </p>
        </div>
        <ToggleGroup value={[m]} onValueChange={(v) => v[0] && setM(v[0] as M)} variant="outline">
          {(['km', 't', 'n'] as M[]).map((k) => <ToggleGroupItem key={k} value={k} className="h-10 cursor-pointer px-3.5">{k === 'km' ? 'Km' : k === 't' ? 'Timer' : 'Økter'}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <ChartContainer config={cfg} className="h-72 w-full">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="d" type="number" domain={[1, 365]} ticks={MONTH_START} tickFormatter={(d) => MONTHS[MONTH_START.indexOf(d)] ?? ''} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={(v: number) => `${fmtInt(v)} ${u}`} />
          <ReferenceLine x={today} stroke="var(--foreground)" strokeOpacity={0.35} strokeDasharray="3 3" />
          <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload, label }) => {
            if (!payload?.length) return null
            const p = payload[0].payload as { y0: number | null; y1: number; y2: number }
            return (
              <div className="bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                <p className="mb-1 font-medium">{dateOf(Number(label))}</p>
                {p.y0 != null && <p className="flex justify-between gap-4"><span className="text-[var(--brand)]">{YEAR}</span><b className="tabular-nums">{f(p.y0)} {u}</b></p>}
                <p className="flex justify-between gap-4"><span>{YEAR - 1}</span><b className="tabular-nums">{f(p.y1)} {u}</b></p>
                <p className="text-muted-foreground flex justify-between gap-4"><span>{YEAR - 2}</span><span className="tabular-nums">{f(p.y2)} {u}</span></p>
              </div>
            )
          }} />
          <Line dataKey="y2" stroke="var(--color-y2)" strokeOpacity={0.4} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="y1" stroke="var(--color-y1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="y0" stroke="var(--color-y0)" strokeWidth={3} dot={false} connectNulls={false} />
        </LineChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-4 text-xs">
        {(['y0', 'y1', 'y2'] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded" style={{ background: cfg[k].color, opacity: k === 'y2' ? 0.5 : 1 }} />{cfg[k].label}</span>)}
        <span className="text-muted-foreground">Stiplet linje = i dag</span>
      </div>
    </div>
  )
}
