import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { fmtDur, fmtKm, sportColor } from '@/lib/data'
import { cn } from '@/lib/utils'
import { type LatLon, useLocalData, trimPrivacy } from '../local'
import { Chip, RouteSvg, type Saved, fmtTempo, median, secPerKm, tagsOf, useBank, useDetail, useMedians } from './shared'

type Km = { pace: number; hard: boolean; label?: string }
type Plan = {
  key: string; kind: string; title: string; sport: string; why: string; zone: string
  dist: number; km: Km[]; route: { name: string; dist: number; track?: LatLon[]; id: string } | null
}
type StoredPlan = Plan & { savedAt: number }
const PLAN_KEY = 'okt-planer-v1'
const readPlans = (): StoredPlan[] => { try { return JSON.parse(localStorage.getItem(PLAN_KEY) ?? '[]') } catch { return [] } }

const round05 = (km: number) => Math.max(1, Math.round(km * 2) / 2)

export function Builder() {
  const { all } = useStore()
  const b = useBank()
  const medians = useMedians(all)
  const local = useLocalData()
  const sportsInBank = useMemo(() => {
    const c = new Map<string, number>()
    for (const s of b.saved) if (s.snap.dist > 0) c.set(s.snap.t, (c.get(s.snap.t) ?? 0) + 1)
    return [...c].sort((x, y) => y[1] - x[1]).map(([s]) => s)
  }, [b.saved])
  const [pick, setPick] = useState<string | null>(null)
  const sport = pick && sportsInBank.includes(pick) ? pick : sportsInBank[0]
  const liked = useMemo(() => b.saved.filter((s) => s.snap.t === sport && s.snap.dist > 0), [b.saved, sport])

  // Den hardeste likte økten – strukturen hentes fra km-splits
  const hard = useMemo(() => {
    const t = liked.filter((s) => tagsOf(s.snap, medians).includes('terskel'))
    return (t.length ? t : liked).slice().sort((x, y) => secPerKm(x.snap) - secPerKm(y.snap))[0]
  }, [liked, medians])
  const hardDet = useDetail(hard?.id)

  const [plans, setPlans] = useState<StoredPlan[]>(readPlans)
  useEffect(() => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(plans)) } catch { /* ignore */ } }, [plans])

  const proposals = useMemo<Plan[]>(() => {
    if (!sport || liked.length < 2) return []
    const medDist = median(liked.map((s) => s.snap.dist)) / 1000
    const medPace = median(liked.map((s) => secPerKm(s.snap)))
    const routeFor = (km: number, avoid?: string) => {
      const cand: { id: string; name: string; dist: number; track?: LatLon[] }[] = liked.filter((s) => s.snap.track && s.id !== avoid).map((s) => ({ id: s.id, name: s.snap.n, dist: s.snap.dist, track: s.snap.track }))
      if (local) for (const a of all) if (a.t === sport && local.tracks[a.id] && a.id !== avoid && !cand.some((c) => c.id === a.id)) cand.push({ id: a.id, name: a.n, dist: a.dist, track: undefined })
      const best = cand.sort((x, y) => Math.abs(x.dist / 1000 - km) - Math.abs(y.dist / 1000 - km))[0]
      if (!best) return null
      return { ...best, track: best.track ?? (local?.tracks[best.id] ? trimPrivacy(local.tracks[best.id]) : undefined) }
    }
    const out: Plan[] = []

    // 1. Progresjon av en likt økt
    const base: Saved = liked.find((s) => s.fav) ?? liked[0]
    const pDist = round05((base.snap.dist / 1000) * 1.08)
    const pPace = secPerKm(base.snap) * 0.985
    const n1 = Math.ceil(pDist)
    out.push({
      key: `prog-${base.id}`, kind: 'Progresjon', title: `${base.snap.n} – litt lenger, litt raskere`, sport, zone: 'Sone 2–3, avslutt i sone 3',
      dist: pDist * 1000,
      km: Array.from({ length: n1 }, (_, i) => ({ pace: i === 0 ? pPace * 1.06 : i >= n1 - 2 ? pPace * 0.98 : pPace, hard: i >= n1 - 2 })),
      route: routeFor(pDist),
      why: `Basert på ${base.fav ? 'favoritten din' : 'den sist likte økten'} «${base.snap.n}» (${fmtKm(base.snap.dist)} km i ${fmtTempo(sport, secPerKm(base.snap))}): +8 % distanse, 1,5 % raskere snitt og negativ splitt de to siste km.`,
    })

    // 2. Miks: struktur fra den hardeste økten + rute fra en annen
    if (hard) {
      const sp = (hardDet?.splits ?? []).map((s) => s[0]).filter((x) => x > 0)
      let thr = secPerKm(hard.snap) * 0.97
      if (sp.length >= 3) {
        let bestAvg = Infinity
        for (let i = 0; i + 3 <= sp.length; i++) bestAvg = Math.min(bestAvg, (sp[i] + sp[i + 1] + sp[i + 2]) / 3)
        thr = bestAvg * 1.01
      }
      const total = Math.max(6, Math.round(medDist))
      const reps = Math.max(2, Math.floor((total - 3) / 3))
      const km: Km[] = [{ pace: medPace * 1.1, hard: false, label: 'Oppv.' }, { pace: medPace * 1.05, hard: false }]
      for (let r = 0; r < reps; r++) { km.push({ pace: thr, hard: true }, { pace: thr, hard: true }); if (r < reps - 1) km.push({ pace: medPace * 1.12, hard: false }) }
      km.push({ pace: medPace * 1.12, hard: false, label: 'Nedj.' })
      const route = routeFor(km.length, hard.id)
      out.push({
        key: `mix-${hard.id}`, kind: 'Miks', title: `${reps} × 2 km terskel`, sport, zone: 'Sone 4 på dragene, sone 1–2 mellom',
        dist: km.length * 1000, km, route,
        why: `Strukturen kommer fra «${hard.snap.n}», der dine beste 3 km gikk i ${fmtTempo(sport, thr / 1.01)}. Ruten er hentet fra ${route ? `«${route.name}»` : 'en likt økt'} med lignende lengde.`,
      })
    }

    // 3. Restitusjon
    const rDist = round05(medDist * 0.6)
    out.push({
      key: `rest-${sport}`, kind: 'Restitusjon', title: 'Rolig restitusjonstur', sport, zone: 'Sone 1–2 hele veien',
      dist: rDist * 1000,
      km: Array.from({ length: Math.ceil(rDist) }, () => ({ pace: medPace * 1.12, hard: false })),
      route: routeFor(rDist),
      why: `60 % av typisk lengde i banken (${fmtKm(medDist * 1000)} km) og 12 % roligere enn snittet ditt på ${fmtTempo(sport, medPace)}.`,
    })
    return out
  }, [sport, liked, hard, hardDet, all, local])

  if (!sportsInBank.length || liked.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <p className="font-medium">Trenger litt mer i banken</p>
        <p className="text-muted-foreground mt-1 text-sm">Lagre minst to økter av samme idrett (sveip til høyre eller bruk hurtigstart i banken), så lager øktbyggeren forslag.</p>
      </div>
    )
  }

  const savedKeys = new Set(plans.map((p) => p.key))
  return (
    <div className="space-y-4">
      {sportsInBank.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {sportsInBank.map((s) => <Chip key={s} on={s === sport} onClick={() => setPick(s)}>{s}</Chip>)}
        </div>
      )}
      <p className="text-muted-foreground text-sm">Basert på {liked.length} likte økter med {sport.toLowerCase()} i banken.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {proposals.map((p) => <PlanCard key={p.key} p={p} saved={savedKeys.has(p.key)} onSave={() => setPlans((ps) => [{ ...p, savedAt: Date.now() }, ...ps.filter((x) => x.key !== p.key)])} />)}
      </div>
      {plans.length > 0 && (
        <div className="rounded-2xl border p-4">
          <p className="mb-2 text-sm font-medium">Lagrede planer ({plans.length})</p>
          <ul className="divide-y">
            {plans.map((p) => (
              <li key={p.key} className="flex items-center gap-3 py-2 text-sm">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: sportColor(p.sport) }} />
                <span className="min-w-0 flex-1 truncate"><b className="font-medium">{p.kind}:</b> {p.title} · {fmtKm(p.dist)} km</span>
                <button type="button" aria-label="Slett plan" onClick={() => setPlans((ps) => ps.filter((x) => x.key !== p.key))} className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-full"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PlanCard({ p, saved, onSave }: { p: Plan; saved: boolean; onSave: () => void }) {
  const dur = p.km.reduce((s, k) => s + k.pace, 0) * (p.dist / 1000 / p.km.length)
  const avg = dur / (p.dist / 1000)
  const speeds = p.km.map((k) => 3600 / k.pace)
  const hi = Math.max(...speeds), lo = Math.min(...speeds) * 0.85
  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-2xl border">
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', p.kind === 'Miks' ? 'bg-[var(--brand)] text-white' : 'bg-muted')}>{p.kind}</span>
          <span className="text-muted-foreground text-xs">{p.sport}</span>
        </div>
        <p className="text-base leading-snug font-semibold">{p.title}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Big label="Distanse" v={`${fmtKm(p.dist)} km`} />
          <Big label="Varighet" v={fmtDur(dur)} />
          <Big label="Snitt" v={fmtTempo(p.sport, avg)} />
        </div>
        <p className="text-xs"><span className="text-muted-foreground">Intensitet:</span> {p.zone}</p>
        <div>
          <div className="flex h-16 items-end gap-[3px]">
            {p.km.map((k, i) => (
              <div key={i} className="flex-1 rounded-t-[3px]" title={`Km ${i + 1}: ${fmtTempo(p.sport, k.pace)}`}
                style={{ height: `${15 + ((3600 / k.pace - lo) / (hi - lo || 1)) * 85}%`, background: k.hard ? 'var(--brand)' : 'var(--sp-roller)' }} />
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[10px]"><span>km 1</span><span>km {p.km.length}</span></div>
        </div>
      </div>
      {p.route && (
        <div className="bg-muted/40 mt-auto flex items-center gap-3 border-t px-4 py-3">
          <div className="bg-background size-14 shrink-0 rounded-lg p-1.5">{p.route.track ? <RouteSvg pts={p.route.track} className="size-full" width={2} /> : null}</div>
          <div className="min-w-0 text-xs">
            <p className="text-muted-foreground">Foreslått rute</p>
            <p className="truncate font-medium">{p.route.name}</p>
            <p className="text-muted-foreground">{fmtKm(p.route.dist)} km</p>
          </div>
        </div>
      )}
      <div className="space-y-3 border-t p-4">
        <p className="text-muted-foreground text-xs leading-relaxed">{p.why}</p>
        <Button variant={saved ? 'secondary' : 'default'} className="h-10 w-full" onClick={onSave} disabled={saved}>{saved ? <><Check />Lagret som plan</> : <><BookmarkPlus />Lagre som plan</>}</Button>
      </div>
    </div>
  )
}

function Big({ label, v }: { label: string; v: string }) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-lg px-1.5 py-2">
      <p className="text-muted-foreground truncate text-[9.5px] tracking-wide uppercase">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{v}</p>
    </div>
  )
}
