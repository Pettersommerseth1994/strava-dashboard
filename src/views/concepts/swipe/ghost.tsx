import { useMemo, useState } from 'react'
import { Ghost } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store'
import { type Activity, fmtClock, fmtDate, fmtKm } from '@/lib/data'
import { fmtTempo, secPerKm, useBank, useDetail } from './shared'

/** «Duell mot fortida»: en likt økt blir spøkelset du løper mot, km for km */
export function GhostDuel() {
  const { all, byId, open } = useStore()
  const b = useBank()

  // Spøkelser: likte økter med distanse; faller tilbake til de lengste løpeturene hvis banken er tom
  const ghosts = useMemo(() => {
    const fromBank = b.saved.map((s) => byId.get(s.id)).filter((a): a is Activity => !!a && a.dist >= 3000 && !!a.det)
    if (fromBank.length) return fromBank
    return all.filter((a) => a.t === 'Løpetur' && a.dist >= 5000 && a.det).sort((x, y) => secPerKm(x) - secPerKm(y)).slice(0, 8)
  }, [b.saved, byId, all])
  const [gId, setGId] = useState<string | null>(null)
  const ghost = ghosts.find((g) => g.id === gId) ?? ghosts.find((g) => g.t === 'Løpetur' && b.saved.find((s) => s.id === g.id)?.fav) ?? ghosts.find((g) => g.t === 'Løpetur') ?? ghosts[0]

  const challengers = useMemo(() => {
    if (!ghost) return []
    return all.filter((a) => a.t === ghost.t && a.id !== ghost.id && a.det && a.dist >= ghost.dist * 0.6 && a.d > ghost.d).slice(-12).reverse()
  }, [all, ghost])
  const [cId, setCId] = useState<string | null>(null)
  const me = challengers.find((c) => c.id === cId) ?? (ghost ? [...challengers].sort((x, y) => Math.abs(x.dist - ghost.dist) - Math.abs(y.dist - ghost.dist))[0] : undefined)

  const gd = useDetail(ghost?.id), md = useDetail(me?.id)
  const [km, setKm] = useState<number | null>(null)

  const duel = useMemo(() => {
    const g = (gd?.splits ?? []).map((s) => s[0]).filter((x) => x > 0)
    const m = (md?.splits ?? []).map((s) => s[0]).filter((x) => x > 0)
    const n = Math.min(g.length, m.length)
    if (n < 1) return null
    const diffs: number[] = []; let cg = 0, cm = 0
    for (let i = 0; i < n; i++) { cg += g[i]; cm += m[i]; diffs.push(cg - cm) } // positiv = du ligger foran
    return { n, diffs, g: g.slice(0, n), m: m.slice(0, n) }
  }, [gd, md])

  if (!ghost) return <p className="text-muted-foreground text-sm">Lagre noen økter i banken først.</p>
  const k = Math.min(km ?? duel?.n ?? 1, duel?.n ?? 1)
  const diff = duel ? duel.diffs[k - 1] : 0
  const maxAbs = duel ? Math.max(...duel.diffs.map(Math.abs), 1) : 1
  // Avstand mellom løperne på banen: tidsforskjell × din fart
  const gapM = me && duel ? Math.abs(diff) * (1000 / duel.m[k - 1]) : 0
  const items = (arr: Activity[]) => arr.map((a) => ({ value: a.id, label: `${a.n} · ${fmtDate(a.d)}` }))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><Ghost className="size-3.5" />Spøkelset (fra banken)</span>
          <Select value={ghost.id} onValueChange={(v) => { if (v) { setGId(v); setCId(null); setKm(null) } }} items={items(ghosts)}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{ghosts.map((a) => <SelectItem key={a.id} value={a.id}>{a.n} · {fmtDate(a.d)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Utfordrer (en senere økt)</span>
          {challengers.length ? (
            <Select value={me?.id ?? ''} onValueChange={(v) => { if (v) { setCId(v); setKm(null) } }} items={items(challengers)}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{challengers.map((a) => <SelectItem key={a.id} value={a.id}>{a.n} · {fmtDate(a.d)}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-muted-foreground flex h-10 items-center">Ingen senere økter som ligner.</p>}
        </label>
      </div>

      {me && !duel && <p className="text-muted-foreground text-sm">Henter km-splits …</p>}
      {me && duel && (
        <>
          <div className="rounded-2xl bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_65%)] p-4 ring-1 ring-foreground/10">
            <p className="text-muted-foreground text-xs">Etter {k} km</p>
            <p className="text-2xl leading-tight font-bold tracking-tight text-balance">
              {Math.abs(diff) < 1 ? 'Helt likt med fortids-deg' : diff > 0
                ? <>Du ligger <span className="text-[var(--brand)] tabular-nums">{fmtClock(diff)}</span> foran spøkelset</>
                : <>Spøkelset leder med <span className="tabular-nums">{fmtClock(-diff)}</span></>}
            </p>
            {/* Banen */}
            <div className="relative mt-5 mb-2 h-10">
              <div className="bg-muted absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
              {(() => {
                const pos = 8 + (k / duel.n) * 84
                const off = Math.max(Math.abs(diff) >= 1 ? 10 : 0, Math.min(30, (gapM / 1000) * (84 / duel.n)))
                const mePos = diff >= 0 ? pos : pos - off, ghostPos = diff >= 0 ? pos - off : pos
                return (
                  <>
                    <span className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-current text-muted-foreground transition-all" style={{ left: `${Math.max(6, ghostPos)}%` }}><Ghost className="size-4" /></span>
                    <span className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-white shadow transition-all" style={{ left: `${Math.max(6, mePos)}%` }}>Deg</span>
                  </>
                )
              })()}
            </div>
            <input type="range" min={1} max={duel.n} value={k} onChange={(e) => setKm(+e.target.value)} className="h-8 w-full accent-[var(--brand)]" aria-label="Velg km" />
            <p className="text-muted-foreground text-xs">{Math.round(gapM)} m mellom dere · dra for å spole gjennom løpet</p>
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-[11px] uppercase">Ledelse per km (over streken = du foran)</p>
            <div className="relative flex h-24 items-center gap-[3px]">
              <div className="bg-border absolute inset-x-0 top-1/2 h-px" />
              {duel.diffs.map((d, i) => (
                <button key={i} type="button" onClick={() => setKm(i + 1)} className="relative h-full flex-1" aria-label={`Km ${i + 1}`}>
                  <span className="absolute inset-x-0 rounded-[2px]"
                    style={{ height: `${(Math.abs(d) / maxAbs) * 48}%`, ...(d >= 0 ? { bottom: '50%' } : { top: '50%' }), background: d >= 0 ? 'var(--brand)' : 'var(--muted-foreground)', opacity: i + 1 === k ? 1 : 0.55 }} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <button type="button" onClick={() => open(ghost.id)} className="hover:bg-muted rounded-xl border p-3 text-left">
              <p className="text-muted-foreground flex items-center gap-1 text-xs"><Ghost className="size-3" />Spøkelset · {fmtDate(ghost.d)}</p>
              <p className="truncate font-medium">{ghost.n}</p>
              <p className="text-muted-foreground text-xs tabular-nums">{fmtKm(ghost.dist)} km · {fmtTempo(ghost.t, secPerKm(ghost))}</p>
            </button>
            <button type="button" onClick={() => open(me.id)} className="hover:bg-muted rounded-xl border p-3 text-left">
              <p className="text-xs text-[var(--brand)]">Deg · {fmtDate(me.d)}</p>
              <p className="truncate font-medium">{me.n}</p>
              <p className="text-muted-foreground text-xs tabular-nums">{fmtKm(me.dist)} km · {fmtTempo(me.t, secPerKm(me))}</p>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
