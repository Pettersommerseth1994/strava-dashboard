import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { MONTHS, MONTHS_LONG, fmtDate, fmtInt, sumBy } from '@/lib/data'
import { mediaUrl, thumbUrl } from '../local'
import { type Mem, Loading, SportPill, statLine, swipeHandlers, useMemories } from './common'

const DUR = 5000

type Slide = { kind: 'intro' } | { kind: 'mem'; m: Mem }

/** 4 · Månedsstories – trykk deg gjennom måneden med bilder og nøkkeltall */
export function MonthStories() {
  const items = useMemories()
  const { all, open } = useStore()
  const months = useMemo(() => {
    const by = new Map<string, Mem[]>()
    for (const m of items ?? []) { const k = m.a.d.slice(0, 7); if (!by.has(k)) by.set(k, []); by.get(k)!.push(m) }
    return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [items])
  const [mi, setMi] = useState(0)
  const [si, setSi] = useState(0)
  const [paused, setPaused] = useState(false)
  const [t0, setT0] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const month = months[mi]
  const slides: Slide[] = useMemo(() => (month ? [{ kind: 'intro' }, ...[...month[1]].reverse().slice(0, 10).map((m) => ({ kind: 'mem' as const, m }))] : []), [month])
  const stats = useMemo(() => (month ? sumBy(all.filter((a) => a.d.startsWith(month[0]))) : null), [all, month])
  const slide = slides[si]

  const next = () => {
    if (si < slides.length - 1) { setSi(si + 1); setT0(Date.now()) }
    else if (mi < months.length - 1) { setMi(mi + 1); setSi(0); setT0(Date.now()) }
    else setPaused(true)
  }
  const prev = () => {
    if (si > 0) { setSi(si - 1); setT0(Date.now()) }
    else if (mi > 0) { setMi(mi - 1); setSi(0); setT0(Date.now()) }
  }

  // Tidtaker for fremdriftsstripen (videoer går videre når de er ferdige eller etter 12 s)
  const dur = slide?.kind === 'mem' && slide.m.k === 'vid' ? 12000 : DUR
  useEffect(() => {
    if (paused || !slides.length) return
    const id = setInterval(() => {
      const n = Date.now(); setNow(n)
      if (n - t0 >= dur) next()
    }, 80)
    return () => clearInterval(id)
  }, [paused, t0, si, mi, slides.length, dur]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <Loading />
  if (!items.length || !month || !stats) return <Loading empty />

  const prog = paused ? Math.min(1, (now - t0) / dur) : Math.min(1, (now - t0) / dur)
  const [y, mo] = [month[0].slice(0, 4), +month[0].slice(5, 7)]
  const top = [...month[1]].sort((a, b) => b.a.dist - a.a.dist)[0]

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {months.map(([k, ms], i) => (
          <button key={k} onClick={() => { setMi(i); setSi(0); setT0(Date.now()); setPaused(false) }}
            className="flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1" aria-label={`${MONTHS_LONG[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`}>
            <span className={`size-14 overflow-hidden rounded-full p-0.5 ${i === mi ? 'bg-[var(--brand)]' : 'bg-border'}`}>
              <span className="bg-background block size-full overflow-hidden rounded-full p-0.5">
                {ms.find((m) => m.k === 'img')
                  ? <img src={thumbUrl(ms.find((m) => m.k === 'img')!.f)} alt="" loading="lazy" className="size-full rounded-full object-cover" />
                  : <span className="bg-muted grid size-full place-items-center rounded-full text-xs font-semibold">{MONTHS[+k.slice(5, 7) - 1]}</span>}
              </span>
            </span>
            <span className={`text-[11px] tabular-nums ${i === mi ? 'font-semibold' : 'text-muted-foreground'}`}>{MONTHS[+k.slice(5, 7) - 1]} {k.slice(2, 4)}</span>
          </button>
        ))}
      </div>

      <div className="relative mx-auto aspect-[9/16] max-h-[620px] w-full max-w-sm overflow-hidden rounded-2xl bg-black text-white shadow-xl select-none"
        {...swipeHandlers(next, prev, (x, w) => (x < w / 3 ? prev() : next()))}>
        {/* Bakgrunn */}
        {slide?.kind === 'mem' ? (
          slide.m.k === 'img'
            ? <img key={slide.m.key} src={mediaUrl(slide.m.f)} alt={slide.m.a.n} className="animate-in fade-in absolute inset-0 size-full object-cover duration-500" draggable={false} />
            : <video key={slide.m.key} src={mediaUrl(slide.m.f)} autoPlay muted playsInline onEnded={next} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-[color-mix(in_oklch,var(--brand)_45%,black)] to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

        {/* Fremdrift */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {slides.map((_, i) => (
            <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? prog * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase">{MONTHS_LONG[mo - 1]} {y}</span>
          <button onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPaused(!paused); setT0(Date.now() - (now - t0)) }}
            className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-white/10" aria-label={paused ? 'Spill av' : 'Pause'}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>

        {/* Innhold */}
        {slide?.kind === 'intro' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 absolute inset-x-0 bottom-0 space-y-4 p-6 duration-500">
            <p className="text-sm font-medium text-white/80">Måneden din</p>
            <p className="text-5xl leading-none font-bold tracking-tight tabular-nums">{fmtInt(stats.dist / 1000)}<span className="ml-1 text-2xl">km</span></p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[[fmtInt(stats.count), 'økter'], [fmtInt(stats.mov / 3600), 'timer'], [fmtInt(stats.up), 'høydemeter']].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/10 px-2 py-2.5 backdrop-blur"><p className="text-lg font-bold tabular-nums">{v}</p><p className="text-[11px] text-white/70">{l}</p></div>
              ))}
            </div>
            <p className="text-sm text-white/85">{month[1].length} minner · lengste med bilde: <b>{top.a.n}</b></p>
          </div>
        ) : slide ? (
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
            <SportPill a={slide.m.a} />
            <p className="text-xl leading-snug font-semibold">{slide.m.a.n}</p>
            <p className="text-sm text-white/80 tabular-nums">{fmtDate(slide.m.a.d)} · {statLine(slide.m.a)}</p>
            <button onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPaused(true); open(slide.m.id) }}
              className="mt-1 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black">
              <ExternalLink className="size-4" />Åpne økten
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="icon" onClick={prev} aria-label="Forrige"><ChevronLeft /></Button>
        <Button variant="outline" size="icon" onClick={next} aria-label="Neste"><ChevronRight /></Button>
      </div>
      <p className="text-muted-foreground text-center text-xs">Trykk til høyre/venstre eller sveip for å bla</p>
    </div>
  )
}
