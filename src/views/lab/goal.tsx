import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { fmtInt, fmtNum, sumBy } from '@/lib/data'
import { TODAY, YEAR, daysInYear, doy, inYear, Stat } from './shared'

type Kind = 'km' | 't'
const KEY = (k: Kind) => `lab-goal-${YEAR}-${k}`
const load = (k: Kind) => { try { return Number(localStorage.getItem(KEY(k))) || 0 } catch { return 0 } }
const save = (k: Kind, v: number) => { try { localStorage.setItem(KEY(k), String(v)) } catch { /* ignore */ } }

function Ring({ pct, expected }: { pct: number; expected: number }) {
  const R = 52, C = 2 * Math.PI * R
  const mark = expected * 2 * Math.PI - Math.PI / 2
  return (
    <svg viewBox="0 0 128 128" className="size-40 shrink-0 sm:size-44" aria-hidden>
      <circle cx="64" cy="64" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
      <circle cx="64" cy="64" r={R} fill="none" stroke="var(--brand)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${Math.min(1, pct) * C} ${C}`} transform="rotate(-90 64 64)" style={{ transition: 'stroke-dasharray .8s ease' }} />
      <line x1={64 + 40 * Math.cos(mark)} y1={64 + 40 * Math.sin(mark)} x2={64 + 64 * Math.cos(mark)} y2={64 + 64 * Math.sin(mark)} stroke="var(--foreground)" strokeWidth="2" />
      <text x="64" y="62" textAnchor="middle" className="fill-foreground text-[22px] font-bold">{fmtInt(pct * 100)} %</text>
      <text x="64" y="80" textAnchor="middle" className="fill-muted-foreground text-[9px]">av årsmålet</text>
    </svg>
  )
}

export function Goal() {
  const { all } = useStore()
  const [kind, setKind] = useState<Kind>('km')
  const last = useMemo(() => sumBy(inYear(all, YEAR - 1)), [all])
  const cur = useMemo(() => sumBy(inYear(all, YEAR)), [all])
  // Forslag: 10 % over i fjor, men aldri under dagens prognose (så målet faktisk er et mål)
  const dayFrac = doy(TODAY) / daysInYear(YEAR)
  const suggested = kind === 'km'
    ? Math.ceil(Math.max((last.dist / 1000) * 1.1, (cur.dist / 1000 / dayFrac) * 1.05) / 100) * 100
    : Math.ceil(Math.max((last.mov / 3600) * 1.1, (cur.mov / 3600 / dayFrac) * 1.05) / 10) * 10
  const [goals, setGoals] = useState<Record<Kind, number>>(() => ({ km: load('km'), t: load('t') }))
  const goal = goals[kind] || suggested
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const done = kind === 'km' ? cur.dist / 1000 : cur.mov / 3600
  const unit = kind === 'km' ? 'km' : 't'
  const d = doy(TODAY), D = daysInYear(YEAR)
  const expected = goal * (d / D)
  const diff = done - expected
  const projected = (done / d) * D
  const weeksLeft = Math.max(1, (D - d) / 7)
  const perWeek = Math.max(0, (goal - done) / weeksLeft)
  const onTrack = diff >= 0
  const f = (v: number) => (kind === 'km' ? fmtInt(v) : fmtNum(v, v < 100 ? 1 : 0))

  const commit = () => {
    const v = Math.round(Number(draft.replace(/\s/g, '').replace(',', '.')))
    if (v > 0) { setGoals((g) => ({ ...g, [kind]: v })); save(kind, v) }
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup value={[kind]} onValueChange={(v) => v[0] && setKind(v[0] as Kind)} variant="outline">
          <ToggleGroupItem value="km" className="h-10 cursor-pointer px-4">Kilometer</ToggleGroupItem>
          <ToggleGroupItem value="t" className="h-10 cursor-pointer px-4">Timer</ToggleGroupItem>
        </ToggleGroup>
        {editing ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); commit() }}>
            <Input autoFocus inputMode="numeric" className="h-10 w-28" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Nytt mål" />
            <span className="text-muted-foreground text-sm">{unit}</span>
            <Button type="submit" className="h-10 cursor-pointer">Lagre</Button>
          </form>
        ) : (
          <Button variant="ghost" className="h-10 cursor-pointer" onClick={() => { setDraft(String(goal)); setEditing(true) }}>
            <Pencil />Mål {YEAR}: <b className="tabular-nums">{fmtInt(goal)} {unit}</b>{!goals[kind] && <span className="text-muted-foreground font-normal">(forslag)</span>}
          </Button>
        )}
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <Ring pct={goal ? done / goal : 0} expected={d / D} />
        <div className="w-full min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-3xl font-bold tracking-tight tabular-nums">{f(done)} <span className="text-muted-foreground text-lg font-medium">/ {fmtInt(goal)} {unit}</span></p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${onTrack ? 'bg-[var(--brand)] text-white' : 'bg-muted text-foreground'}`}>
              {onTrack ? `På kurs · ${f(diff)} ${unit} foran` : `Bak skjema · ${f(-diff)} ${unit} bak`}
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand)] transition-all duration-700" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
            <div className="bg-foreground absolute -top-1 h-4.5 w-0.5" style={{ left: `${(d / D) * 100}%` }} title="Der du burde vært i dag" />
          </div>
          <p className="text-muted-foreground text-xs">Streken viser hvor du burde vært i dag med jevnt tempo (dag {d} av {D}).</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Prognose 31. des" value={`${fmtInt(projected)} ${unit}`} sub={projected >= goal ? 'Når målet 🎯' : `${fmtInt(goal - projected)} ${unit} for lite`} />
            <Stat label="Trengs per uke" value={`${f(perWeek)} ${unit}`} sub={`${fmtNum(weeksLeft, 0)} uker igjen`} />
            <Stat label={`Hele ${YEAR - 1}`} value={`${fmtInt(kind === 'km' ? last.dist / 1000 : last.mov / 3600)} ${unit}`} sub="til sammenligning" />
          </div>
        </div>
      </div>
    </div>
  )
}
