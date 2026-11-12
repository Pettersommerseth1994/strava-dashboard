import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { type Activity, BE_LABELS, MONTHS_LONG, dayKey, fmtDate, fmtDur, fmtInt, fmtNum, isFoot, longestStreak, sumBy } from '@/lib/data'
import { TODAY, YEAR, doy, inYear, ytd } from './shared'

const DURATION = 6000
const BGS = [
  'linear-gradient(155deg, oklch(0.66 0.17 48), oklch(0.4 0.13 32))',
  'linear-gradient(155deg, oklch(0.38 0.07 255), oklch(0.18 0.03 260))',
  'linear-gradient(155deg, oklch(0.55 0.09 250), oklch(0.27 0.06 262))',
]

type Slide = { kicker: string; big: ReactNode; unit?: string; text: ReactNode; actId?: string }

function buildSlides(all: Activity[]): Slide[] {
  const acts = inYear(all, YEAR)
  if (!acts.length) return [{ kicker: `${YEAR}`, big: '0', text: 'Ingen økter registrert ennå i år.' }]
  const s = sumBy(acts)
  const slides: Slide[] = []
  slides.push({ kicker: `Ditt ${YEAR}`, big: fmtInt(s.mov / 3600), unit: 'timer', text: <>fordelt på <b>{fmtInt(s.count)} økter</b> og <b>{fmtInt(s.dist / 1000)} km</b>. Det er {fmtNum(s.mov / 86400, 1)} døgn i bevegelse.</> })

  const bySport = new Map<string, number>()
  acts.forEach((a) => bySport.set(a.t, (bySport.get(a.t) ?? 0) + a.mov))
  const [topSport, topSec] = [...bySport.entries()].sort((a, b) => b[1] - a[1])[0]
  slides.push({ kicker: 'Hovedidretten din', big: topSport, text: <><b>{fmtInt((topSec / s.mov) * 100)} %</b> av treningstiden – {fmtInt(topSec / 3600)} timer. {bySport.size} ulike idretter totalt.</> })

  const byMonth = Array.from({ length: 12 }, () => ({ sec: 0, n: 0 }))
  acts.forEach((a) => { const m = byMonth[Number(a.d.slice(5, 7)) - 1]; m.sec += a.mov; m.n++ })
  const bm = byMonth.reduce((bi, m, i, arr) => (m.sec > arr[bi].sec ? i : bi), 0)
  slides.push({ kicker: 'Beste måned', big: MONTHS_LONG[bm][0].toUpperCase() + MONTHS_LONG[bm].slice(1), text: <><b>{fmtNum(byMonth[bm].sec / 3600, 1)} timer</b> på {byMonth[bm].n} økter. Det er {fmtInt((byMonth[bm].sec / (s.mov / 12) - 1) * 100)} % over snittmåneden din.</> })

  const longest = acts.reduce((a, b) => (b.mov > a.mov ? b : a))
  slides.push({ kicker: 'Lengste økt', big: fmtDur(longest.mov), text: <><b>«{longest.n}»</b> · {fmtDate(longest.d)}{longest.dist ? ` · ${fmtNum(longest.dist / 1000, 1)} km` : ''}</>, actId: longest.id })

  // Rekorder satt i år (beste tid på distansen gjennom alle år, satt i år)
  const prs: { k: string; a: Activity }[] = []
  for (const k of Object.keys(BE_LABELS)) {
    let best: Activity | null = null
    for (const a of all) if (isFoot(a.t) && a.be?.[k] && (!best || a.be[k][0] < best.be![k][0])) best = a
    if (best && best.d.startsWith(String(YEAR))) prs.push({ k, a: best })
  }
  slides.push(prs.length
    ? { kicker: 'Personlige rekorder', big: String(prs.length), unit: prs.length === 1 ? 'ny pers' : 'nye perser', text: <>i år: {prs.map((p) => BE_LABELS[p.k]).join(', ')}.</>, actId: prs[0].a.id }
    : { kicker: 'Personlige rekorder', big: '0', unit: 'nye perser', text: 'Ingen nye løpsrekorder i år – ennå.' })

  const st = longestStreak(acts.map((a) => dayKey(a.d)))
  slides.push({ kicker: 'Lengste serie', big: String(st.best), unit: 'dager på rad', text: <>fra {fmtDate(st.bestStart)} til {fmtDate(st.bestEnd)}. {fmtInt(s.days)} aktive dager i år totalt.</> })

  const now = sumBy(ytd(all, YEAR)), prev = sumBy(ytd(all, YEAR - 1))
  const pct = prev.mov ? (now.mov / prev.mov - 1) * 100 : 0
  slides.push({ kicker: `Mot ${YEAR - 1}`, big: `${pct >= 0 ? '+' : '−'}${fmtInt(Math.abs(pct))} %`, text: <>treningstid sammenlignet med samme dato i fjor ({fmtInt(now.mov / 3600)} t mot {fmtInt(prev.mov / 3600)} t). {pct >= 0 ? 'Sterkt!' : 'Fortsatt tid til å ta igjen.'}</> })
  return slides
}

export function Wrapped() {
  const { all, open } = useStore()
  const slides = useMemo(() => buildSlides(all), [all])
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const start = useRef<{ x: number; t: number } | null>(null)
  const last = i === slides.length - 1
  const go = (d: number) => setI((v) => Math.min(slides.length - 1, Math.max(0, v + d)))

  useEffect(() => {
    if (paused || held || last) return
    const t = setTimeout(() => go(1), DURATION)
    return () => clearTimeout(t)
  }, [i, paused, held, last]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = slides[i]
  const day = doy(TODAY)
  return (
    <div className="mx-auto max-w-md">
      <style>{'@keyframes lab-fill{from{width:0}to{width:100%}}'}</style>
      <div
        className="relative flex aspect-[4/5] max-h-[34rem] w-full cursor-pointer touch-pan-y flex-col overflow-hidden rounded-2xl p-5 text-white shadow-xl select-none"
        style={{ background: BGS[i % BGS.length] }}
        onPointerDown={(e) => { start.current = { x: e.clientX, t: Date.now() }; setHeld(true) }}
        onPointerLeave={() => setHeld(false)}
        onPointerUp={(e) => {
          setHeld(false)
          const st = start.current; start.current = null
          if (!st) return
          const dx = e.clientX - st.x
          if (Math.abs(dx) > 40) return go(dx < 0 ? 1 : -1)
          if (Date.now() - st.t > 350) return // langt trykk = pause, ikke bla
          const r = e.currentTarget.getBoundingClientRect()
          go(e.clientX - r.left < r.width / 3 ? -1 : 1)
        }}
        role="button" aria-label="Neste kort – trykk på venstre side for å gå tilbake"
      >
        <div className="flex gap-1">
          {slides.map((_, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white"
                style={k < i ? { width: '100%' } : k > i ? { width: 0 } : last ? { width: '100%' } : { animation: `lab-fill ${DURATION}ms linear forwards`, animationPlayState: paused || held ? 'paused' : 'running' }}
                key={`${k}-${i}`} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">Årsrevy {YEAR} · {i + 1}/{slides.length}</p>
        <div key={i} className="animate-in fade-in slide-in-from-bottom-4 mt-auto mb-auto duration-500">
          <p className="text-sm font-semibold tracking-wide text-white/80 uppercase">{s.kicker}</p>
          <p className="mt-2 text-[clamp(2.5rem,13vw,4.5rem)] leading-[0.95] font-black tracking-tight break-words">{s.big}</p>
          {s.unit && <p className="mt-1 text-xl font-bold text-white/90">{s.unit}</p>}
          <p className="mt-4 max-w-xs text-[15px] leading-snug text-white/85 [&_b]:font-semibold [&_b]:text-white">{s.text}</p>
          {s.actId && (
            <Button size="sm" variant="secondary" className="mt-5 h-10 cursor-pointer bg-white/15 text-white hover:bg-white/25"
              onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => open(s.actId!)}>
              Åpne økten
            </Button>
          )}
        </div>
        <p className="text-[11px] text-white/60">Dag {day} av året · trykk eller sveip for å bla, hold for pause</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="size-10 cursor-pointer" onClick={() => go(-1)} disabled={i === 0} aria-label="Forrige"><ChevronLeft /></Button>
        <Button variant="outline" size="icon" className="size-10 cursor-pointer" onClick={() => setPaused(!paused)} aria-label={paused ? 'Spill av' : 'Pause'}>{paused ? <Play /> : <Pause />}</Button>
        <Button variant="outline" size="icon" className="size-10 cursor-pointer" onClick={() => setI(0)} aria-label="Start på nytt"><RotateCcw /></Button>
        <Button variant="outline" size="icon" className="size-10 cursor-pointer" onClick={() => go(1)} disabled={last} aria-label="Neste"><ChevronRight /></Button>
      </div>
    </div>
  )
}
