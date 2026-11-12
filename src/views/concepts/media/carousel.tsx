import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { fmtDate } from '@/lib/data'
import { mediaUrl, posterUrl, thumbUrl } from '../local'
import { type Mem, Loading, SportPill, statLine, useMemories } from './common'

/** Minnekarusell – bilder og videoer i sitt eget format, videoer spilles rett i karusellen */
export function MemoryCarousel() {
  const items = useMemories()
  const { open } = useStore()
  const [order, setOrder] = useState<Mem[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [auto, setAuto] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const list = order ?? items ?? []

  // Finn kortet nærmest midten ut fra rulleposisjonen
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0, dist = Infinity
    Array.from(el.children).forEach((c, i) => {
      const h = c as HTMLElement
      const d = Math.abs(h.offsetLeft - el.offsetLeft + h.offsetWidth / 2 - mid)
      if (d < dist) { dist = d; best = i }
    })
    setIdx(best)
  }
  const go = (i: number) => {
    const el = track.current
    if (!el || !list.length) return
    const n = (i + list.length) % list.length
    const child = el.children[n] as HTMLElement | undefined
    if (child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: 'smooth' })
  }

  // Stopp videoen når den rulles ut av fokus
  useEffect(() => { if (playing && list[idx]?.key !== playing) setPlaying(null) }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Blar videre hvert 5. sekund – pauses ved interaksjon og mens en video spilles
  useEffect(() => {
    if (!auto || playing || !list.length) return
    const t = setInterval(() => go(idx + 1), 5000)
    return () => clearInterval(t)
  }, [auto, playing, idx, list.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <Loading />
  if (!items.length) return <Loading empty />

  const shuffle = () => { setOrder([...items].sort(() => Math.random() - 0.5)); setIdx(0); setPlaying(null); track.current?.scrollTo({ left: 0 }) }

  return (
    <div className="space-y-3">
      <div
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => setAuto(false)}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {list.map((m) => {
          const ratio = m.w && m.h ? m.w / m.h : 3 / 4
          const isPlaying = playing === m.key
          return (
            <div
              key={m.key}
              className="group relative shrink-0 snap-center overflow-hidden rounded-2xl bg-black"
              style={{ aspectRatio: `${ratio}`, height: `min(26rem, calc(86vw / ${ratio}))` }}
            >
              {m.k === 'vid' && isPlaying ? (
                <video
                  src={mediaUrl(m.f)} poster={posterUrl(m.f)} controls autoPlay playsInline
                  onEnded={() => setPlaying(null)}
                  className="size-full object-contain"
                />
              ) : (
                <button onClick={() => open(m.id)} className="block size-full cursor-pointer text-left" aria-label={`Åpne ${m.a.n}`}>
                  <img src={m.k === 'vid' ? posterUrl(m.f) : thumbUrl(m.f)} alt={m.a.n} loading="lazy" draggable={false} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/25" />
                  <span className="absolute inset-x-0 bottom-0 space-y-0.5 p-3.5 text-white">
                    <span className="block text-[11px] font-medium tracking-wide text-white/70 uppercase">{fmtDate(m.a.d)}</span>
                    <span className="line-clamp-2 block text-base leading-snug font-semibold">{m.a.n}</span>
                    <span className="block text-xs text-white/85 tabular-nums">{statLine(m.a)}</span>
                  </span>
                </button>
              )}
              <span className="pointer-events-none absolute top-3 left-3"><SportPill a={m.a} /></span>
              {m.k === 'vid' && !isPlaying && (
                <button
                  onClick={() => { setPlaying(m.key); setAuto(false) }}
                  aria-label="Spill av video"
                  className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:scale-110 hover:bg-black/70"
                >
                  <Play className="size-6 translate-x-0.5 fill-current" />
                </button>
              )}
              {isPlaying && (
                <button onClick={() => open(m.id)} className="absolute top-3 right-3 inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-black/55 px-3 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70">
                  Åpne økten<ExternalLink className="size-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs tabular-nums">{Math.min(idx + 1, list.length)} av {list.length} minner</p>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={shuffle} aria-label="Bland minnene"><Shuffle /></Button>
          <Button variant="outline" size="icon" onClick={() => setAuto(!auto)} aria-label={auto ? 'Pause' : 'Spill av'}>{auto ? <Pause /> : <Play />}</Button>
          <Button variant="outline" size="icon" onClick={() => { setAuto(false); go(idx - 1) }} aria-label="Forrige"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" onClick={() => { setAuto(false); go(idx + 1) }} aria-label="Neste"><ChevronRight /></Button>
        </div>
      </div>
    </div>
  )
}
