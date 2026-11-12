import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { FileUp, Link2, Loader2, Swords, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useStore } from '@/lib/store'
import { type Activity, addDays, dayKey, fmtInt, fmtNum, sumBy, weekStart } from '@/lib/data'
import { TODAY, YEAR } from './shared'

type Friend = { name: string; acts: Activity[]; demo: boolean }
type Per = 'ytd' | '30d' | '12w'

/** Enkel deterministisk tilfeldighetsgenerator, slik at demovennen blir lik hver gang */
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) }

/** Fiktiv venn: bygget ved å forskyve og skalere Magnus' egne økter. Ikke en ekte person. */
function demoFriend(all: Activity[]): Friend {
  const r = rng(42)
  const factor: Record<string, number> = { Løpetur: 1.35, Langrenn: 0.6, Sykkeltur: 1.8, Styrketrening: 0.7, Rulleski: 0.4 }
  const acts = all.filter(() => r() < 0.82).map((a, i) => {
    const f = (factor[a.t] ?? 1) * (0.8 + r() * 0.4)
    const d = addDays(dayKey(a.d), Math.round(r() * 2 - 1)) + a.d.slice(10)
    return { ...a, id: `demo-${i}`, d, n: 'Demo-økt', dist: a.dist * f, mov: a.mov * Math.min(1.6, f), up: a.up * (0.6 + r() * 0.8), load: a.load * f }
  }).sort((a, b) => a.d.localeCompare(b.d))
  return { name: 'Eksempelvenn', acts, demo: true }
}

function validate(x: unknown): Activity[] {
  if (!Array.isArray(x) || !x.length) throw new Error('Fila må være en liste med økter (data.json fra dette dashboardet).')
  const ok = x.filter((a) => a && typeof a.d === 'string' && typeof a.t === 'string' && typeof a.dist === 'number' && typeof a.mov === 'number')
  if (ok.length < x.length * 0.9) throw new Error('Fila ser ikke ut som en data.json fra dette dashboardet.')
  return ok.map((a) => ({ up: 0, load: 0, ...a })) as Activity[]
}

function range(p: Per): [string, string] {
  return p === 'ytd' ? [`${YEAR}-01-01`, TODAY] : p === '30d' ? [addDays(TODAY, -29), TODAY] : [addDays(weekStart(TODAY), -77), TODAY]
}
const within = (acts: Activity[], [f, t]: [string, string]) => acts.filter((a) => { const d = dayKey(a.d); return d >= f && d <= t })

function DuelRow({ label, me, them, fmt }: { label: string; me: number; them: number; fmt: (v: number) => string }) {
  const tot = me + them || 1
  const lead = me === them ? 0 : me > them ? 1 : -1
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-sm">
        <span className={`tabular-nums ${lead > 0 ? 'font-bold text-[var(--brand)]' : ''}`}>{fmt(me)}</span>
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</span>
        <span className={`text-right tabular-nums ${lead < 0 ? 'font-bold' : ''}`}>{fmt(them)}</span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <div className="rounded-l-full bg-[var(--brand)] transition-all duration-700" style={{ width: `${(me / tot) * 100}%` }} />
        <div className="bg-foreground/40 flex-1 rounded-r-full" />
      </div>
    </div>
  )
}

export function Friends() {
  const { all } = useStore()
  const [friend, setFriend] = useState<Friend | null>(null)
  const [per, setPer] = useState<Per>('ytd')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const loadFile = async (f: File) => {
    setErr('')
    try { setFriend({ name: f.name.replace(/\.json$/i, '').replace(/[-_]/g, ' ') || 'Venn', acts: validate(JSON.parse(await f.text())), demo: false }) }
    catch (e) { setErr((e as Error).message) }
  }
  const loadUrl = async () => {
    setErr(''); setBusy(true)
    try {
      const u = new URL(url.trim())
      const r = await fetch(u); if (!r.ok) throw new Error(`Fikk ikke hentet fila (${r.status}).`)
      setFriend({ name: u.hostname.split('.')[0] || 'Venn', acts: validate(await r.json()), demo: false })
    } catch (e) { setErr(e instanceof TypeError ? 'Fikk ikke hentet fila. Sjekk lenken (og at siden tillater deling).' : (e as Error).message) }
    finally { setBusy(false) }
  }

  const rg = range(per)
  const me = useMemo(() => within(all, rg), [all, rg[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  const them = useMemo(() => (friend ? within(friend.acts, rg) : []), [friend, rg[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = sumBy(me), b = sumBy(them)

  const weekly = useMemo(() => {
    const start = addDays(weekStart(TODAY), -77)
    return Array.from({ length: 12 }, (_, i) => {
      const w = addDays(start, i * 7), e = addDays(w, 6)
      const km = (xs: Activity[]) => within(xs, [w, e]).reduce((s, x) => s + x.dist, 0) / 1000
      return { w: `${+w.slice(8)}.${+w.slice(5, 7)}`, me: Math.round(km(all)), them: friend ? Math.round(km(friend.acts)) : 0 }
    })
  }, [all, friend])

  const sports = useMemo(() => {
    const m = new Map<string, [number, number]>()
    me.forEach((x) => { const v = m.get(x.t) ?? [0, 0]; v[0] += x.mov; m.set(x.t, v) })
    them.forEach((x) => { const v = m.get(x.t) ?? [0, 0]; v[1] += x.mov; m.set(x.t, v) })
    return [...m.entries()].sort((p, q) => q[1][0] + q[1][1] - (p[1][0] + p[1][1])).slice(0, 6)
  }, [me, them])

  const cfg = { me: { label: 'Magnus', color: 'var(--brand)' }, them: { label: friend?.name ?? 'Venn', color: 'var(--sp-roller)' } } satisfies ChartConfig
  const wins = [a.dist > b.dist, a.mov > b.mov, a.count > b.count, a.up > b.up, a.days > b.days].filter(Boolean).length

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm">
          <Switch checked={!!friend?.demo} onCheckedChange={(on) => { setErr(''); setFriend(on ? demoFriend(all) : null) }} />
          Eksempelvenn <span className="text-muted-foreground">(fiktive data)</span>
        </label>
        <span className="text-muted-foreground text-xs lg:px-1">eller</span>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }} />
        <Button variant="outline" className="h-10 cursor-pointer" onClick={() => file.current?.click()}><FileUp />Last opp venns data.json</Button>
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) loadUrl() }}>
          <Input className="h-10 min-w-0" placeholder="…eller lim inn lenke til data.json" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit" variant="outline" className="h-10 cursor-pointer" disabled={!url.trim() || busy}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />}Hent</Button>
        </form>
      </div>
      {err && <p className="text-destructive text-sm">{err}</p>}

      {!friend ? (
        <div className="text-muted-foreground grid place-items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          <Swords className="size-8 opacity-60" />
          <p>Slå på eksempelvennen eller last inn en venns data for å starte en duell.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">MS</span>
              <span className="text-muted-foreground text-xs font-semibold">VS</span>
              <span className="bg-muted grid size-10 place-items-center rounded-full"><UserRound className="size-5" /></span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{friend.name}{friend.demo && <span className="ml-2 rounded bg-[var(--brand)]/15 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--brand)] uppercase">Demo · fiktiv</span>}</p>
                <p className="text-muted-foreground text-xs">Du leder {wins} av 5 kategorier</p>
              </div>
            </div>
            <ToggleGroup value={[per]} onValueChange={(v) => v[0] && setPer(v[0] as Per)} variant="outline">
              <ToggleGroupItem value="ytd" className="h-10 cursor-pointer px-3">{YEAR}</ToggleGroupItem>
              <ToggleGroupItem value="12w" className="h-10 cursor-pointer px-3">12 uker</ToggleGroupItem>
              <ToggleGroupItem value="30d" className="h-10 cursor-pointer px-3">30 dager</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <div className="text-muted-foreground flex justify-between gap-2 text-xs"><span className="font-medium text-[var(--brand)]">Magnus</span><span className="truncate">{friend.name}</span></div>
              <DuelRow label="Distanse" me={a.dist / 1000} them={b.dist / 1000} fmt={(v) => `${fmtInt(v)} km`} />
              <DuelRow label="Tid" me={a.mov / 3600} them={b.mov / 3600} fmt={(v) => `${fmtNum(v, v < 100 ? 1 : 0)} t`} />
              <DuelRow label="Økter" me={a.count} them={b.count} fmt={fmtInt} />
              <DuelRow label="Høydemeter" me={a.up} them={b.up} fmt={(v) => `${fmtInt(v)} m`} />
              <DuelRow label="Aktive dager" me={a.days} them={b.days} fmt={fmtInt} />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Km per uke, siste 12 uker</p>
              <ChartContainer config={cfg} className="h-52 w-full">
                <BarChart data={weekly} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="w" tickLine={false} axisLine={false} interval={1} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${v} km`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="me" fill="var(--color-me)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="them" fill="var(--color-them)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Hvem leder per idrett (treningstid)</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sports.map(([s, [x, y]]) => (
                <div key={s} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate font-medium">{s}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{fmtNum(x / 3600, 0)} t – {fmtNum(y / 3600, 0)} t</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${x >= y ? 'bg-[var(--brand)] text-white' : 'bg-muted'}`}>{x >= y ? 'Magnus' : friend.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2.5 text-xs leading-relaxed">
        <b className="text-foreground">Slik kan ekte venner legges til:</b> hver venn laster ned sin egen Strava-eksport og kjører
        <code className="bg-muted mx-1 rounded px-1">scripts/build-data.py</code> på den. Den ferdige <code className="bg-muted rounded px-1">data.json</code> kan
        lastes opp her eller legges ut på en lenke. Neste steg kan være innlogging med Strava via en liten server, slik at venner kobles til automatisk.
        Eksempelvennen er laget fra dine egne økter med tilfeldige justeringer – det er ikke en ekte person.
      </div>
    </div>
  )
}
