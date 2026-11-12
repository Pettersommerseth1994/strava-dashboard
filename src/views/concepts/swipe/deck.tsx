import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Heart, ImageIcon, Map as MapIcon, RotateCcw, Shuffle, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { type Activity, fmtDate, fmtDur, fmtInt, fmtKm, sportColor } from '@/lib/data'
import { cn } from '@/lib/utils'
import { type MediaMap, type TrackMap, posterSrc, thumbUrl, trimPrivacy, useLocalData } from '../local'
import { Chip, MiniBars, RouteSvg, SPORT_CHOICES, bank, fmtTempo, secPerKm, shuffle, snapOf, useBank, useDetail } from './shared'

type Dir = 'left' | 'right' | 'up'
const THRESHOLD = 90

export function SwipeDeck() {
  const { all, byId, open } = useStore()
  const local = useLocalData()
  const b = useBank()
  const [sport, setSport] = useState('Alle')
  const [only, setOnly] = useState<'alle' | 'kart' | 'bilde'>('alle')
  const [seed, setSeed] = useState(() => Math.random())
  const [fly, setFly] = useState<{ id: string; dir: Dir } | null>(null)
  const [hist, setHist] = useState<{ id: string; dir: Dir }[]>([])
  const box = useRef<HTMLDivElement>(null)

  const pool = useMemo(() => {
    if (!local) return []
    const ok = all.filter((a) => {
      if (sport !== 'Alle' && a.t !== sport) return false
      const hasTrack = !!local.tracks[a.id], hasImg = !!local.media[a.id]?.length
      if (only === 'kart' && !hasTrack) return false
      if (only === 'bilde' && !hasImg) return false
      return a.dist > 500 || hasImg
    })
    return shuffle(ok, seed)
  }, [all, local, sport, only, seed])

  const decided = useMemo(() => new Set([...b.saved.map((s) => s.id), ...b.skipped]), [b])
  const queue = useMemo(() => pool.filter((a) => !decided.has(a.id) || a.id === fly?.id), [pool, decided, fly])
  const top = queue.slice(0, 3)

  const decide = (dir: Dir) => {
    const a = queue[0]
    if (!a || fly) return
    setFly({ id: a.id, dir })
    window.setTimeout(() => {
      if (dir === 'left') bank.skip(a.id)
      else bank.save(a.id, snapOf(a, local?.tracks, local?.media), dir === 'up')
      setHist((h) => [...h.slice(-30), { id: a.id, dir }])
      setFly(null)
    }, 260)
  }
  const undo = () => {
    const last = hist[hist.length - 1]
    if (!last) return
    bank.remove(last.id)
    setHist((h) => h.slice(0, -1))
  }

  // Tastatur: ← nei, → liker, ↑ favoritt, Backspace angre – bare når bunken er synlig
  const visible = useRef(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting && e.intersectionRatio > 0.4 }, { threshold: [0, 0.4, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const decideRef = useRef(decide); decideRef.current = decide
  const undoRef = useRef(undo); undoRef.current = undo
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!visible.current || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return
      const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' }
      if (map[e.key]) { e.preventDefault(); decideRef.current(map[e.key]) }
      else if (e.key === 'Backspace') { e.preventDefault(); undoRef.current() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const savedN = b.saved.length, favN = b.saved.filter((s) => s.fav).length

  return (
    <div ref={box} className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {SPORT_CHOICES.map((s) => <Chip key={s} on={sport === s} onClick={() => setSport(s)}>{s}</Chip>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={only === 'alle'} onClick={() => setOnly('alle')}>Alle økter</Chip>
        <Chip on={only === 'kart'} onClick={() => setOnly('kart')}><MapIcon className="size-3.5" />Med kart</Chip>
        <Chip on={only === 'bilde'} onClick={() => setOnly('bilde')}><ImageIcon className="size-3.5" />Med bilde</Chip>
        <Button variant="ghost" size="sm" className="ml-auto h-9" onClick={() => setSeed(Math.random())}><Shuffle />Stokk</Button>
      </div>

      <div className="relative mx-auto h-[31rem] w-full max-w-sm select-none sm:h-[32rem]">
        {!local && <p className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">Laster kart og bilder …</p>}
        {local && top.length === 0 && (
          <div className="absolute inset-0 grid place-items-center rounded-3xl border border-dashed p-6 text-center">
            <div className="space-y-3">
              <p className="font-medium">Tomt for økter i dette utvalget 🎉</p>
              <p className="text-muted-foreground text-sm">Du har vurdert alle. Bytt filter, eller start på nytt med de du hoppet over.</p>
              <Button variant="outline" onClick={() => bank.resetSkipped()}>Ta med overhoppede igjen</Button>
            </div>
          </div>
        )}
        {local && [...top].reverse().map((a) => {
          const depth = top.indexOf(a)
          return <SwipeCard key={a.id} a={a} depth={depth} fly={fly?.id === a.id ? fly.dir : null} tracks={local.tracks} media={local.media} onDecide={decide} onOpen={() => open(a.id)} />
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <RoundBtn label="Angre" onClick={undo} disabled={!hist.length} className="size-11"><RotateCcw className="size-4" /></RoundBtn>
        <RoundBtn label="Hopp over" onClick={() => decide('left')} disabled={!top.length} className="size-14"><X className="size-6" /></RoundBtn>
        <RoundBtn label="Favoritt" onClick={() => decide('up')} disabled={!top.length} className="size-11 text-[var(--brand)]"><Star className="size-5" /></RoundBtn>
        <RoundBtn label="Lagre i banken" onClick={() => decide('right')} disabled={!top.length} className="size-14 border-transparent bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90"><Heart className="size-6" /></RoundBtn>
      </div>
      <p className="text-muted-foreground text-center text-xs tabular-nums">
        {savedN} i banken{favN ? ` (${favN} favoritter)` : ''} · {b.skipped.length} hoppet over · {Math.max(0, queue.length - (fly ? 1 : 0))} igjen
        <span className="hidden sm:inline"> · tastatur: ← → ↑, ⌫ angrer</span>
      </p>
      {hist.length > 0 && (() => {
        const last = byId.get(hist[hist.length - 1].id)
        return last ? <p className="text-center text-xs">Sist: <b>{last.n}</b> {hist[hist.length - 1].dir === 'left' ? 'hoppet over' : hist[hist.length - 1].dir === 'up' ? 'lagt til som favoritt ⭐' : 'lagret i banken ❤️'}</p> : null
      })()}
    </div>
  )
}

function RoundBtn({ label, onClick, disabled, className, children }: { label: string; onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn('bg-card hover:bg-muted grid place-items-center rounded-full border shadow-md transition-transform active:scale-90 disabled:opacity-40', className)}>
      {children}
    </button>
  )
}

function SwipeCard({ a, depth, fly, tracks, media, onDecide, onOpen }: {
  a: Activity; depth: number; fly: Dir | null; tracks: TrackMap; media: MediaMap
  onDecide: (d: Dir) => void; onOpen: () => void
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const active = depth === 0 && !fly
  const det = useDetail(depth <= 1 ? a.id : null)
  const track = useMemo(() => (tracks[a.id] ? trimPrivacy(tracks[a.id]) : undefined), [tracks, a.id])
  const m = media[a.id] ?? []
  const img = m.find((x) => x.k === 'img'), vid = m.find((x) => x.k === 'vid')
  const splits = (det?.splits ?? []).filter((s) => s[0] > 0).map((s) => s[0])

  const down = (e: RPointerEvent) => {
    if (!active || (e.target as HTMLElement).closest('button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, moved: false }
    setDrag({ x: 0, y: 0 })
  }
  const move = (e: RPointerEvent) => {
    if (!start.current) return
    const x = e.clientX - start.current.x, y = e.clientY - start.current.y
    if (Math.abs(x) + Math.abs(y) > 6) start.current.moved = true
    setDrag({ x, y })
  }
  const up = () => {
    const d = drag
    start.current = null
    setDrag(null)
    if (!d) return
    if (d.x > THRESHOLD) onDecide('right')
    else if (d.x < -THRESHOLD) onDecide('left')
    else if (d.y < -THRESHOLD && Math.abs(d.x) < THRESHOLD) onDecide('up')
  }

  const x = drag?.x ?? 0, y = drag?.y ?? 0
  const flyT = fly === 'right' ? 'translate(140%, 40px) rotate(28deg)' : fly === 'left' ? 'translate(-140%, 40px) rotate(-28deg)' : fly === 'up' ? 'translate(0, -130%) rotate(-4deg)' : null
  const transform = flyT ?? (drag ? `translate(${x}px, ${y}px) rotate(${x / 16}deg)` : `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`)
  const like = Math.max(0, Math.min(1, x / THRESHOLD)), nope = Math.max(0, Math.min(1, -x / THRESHOLD)), fav = Math.max(0, Math.min(1, -y / THRESHOLD)) * (Math.abs(x) < THRESHOLD ? 1 : 0)

  return (
    <div
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={cn('bg-card absolute inset-0 flex touch-none flex-col overflow-hidden rounded-3xl border shadow-xl', active ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
      style={{ transform, transition: drag ? 'none' : 'transform 260ms cubic-bezier(.2,.8,.2,1), opacity 260ms', opacity: fly ? 0 : depth > 2 ? 0 : 1, zIndex: 10 - depth }}
    >
      {/* Bilde / video / rute */}
      <div className="relative h-52 shrink-0 overflow-hidden bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_22%,transparent),transparent_70%)]">
        {img ? <img src={thumbUrl(img.f)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          : vid ? <video src={posterSrc(vid.f)} preload="metadata" muted playsInline className="absolute inset-0 size-full object-cover" />
          : track ? <RouteSvg pts={track} glow width={3} className="absolute inset-4 size-[calc(100%-2rem)]" />
          : <div className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">Ingen kart for denne økten</div>}
        {(img || vid) && track && (
          <div className="absolute right-3 bottom-3 size-16 rounded-xl bg-black/55 p-1.5 backdrop-blur"><RouteSvg pts={track} stroke="white" width={2} className="size-full" /></div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur" style={{ boxShadow: `inset 3px 0 0 ${sportColor(a.t)}` }}>{a.t}</span>
        {m.length > 1 && <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">{m.length} media</span>}

        {/* Stempler */}
        <Stamp className="top-10 left-5 -rotate-12 text-[var(--brand)] border-[var(--brand)]" o={like}>LIKER</Stamp>
        <Stamp className="top-10 right-5 rotate-12 text-white border-white" o={nope}>NEI</Stamp>
        <Stamp className="bottom-6 left-1/2 -translate-x-1/2 text-[var(--brand)] border-[var(--brand)]" o={fav}>★ FAVORITT</Stamp>
      </div>

      {/* Data */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{fmtDate(a.d)} · kl. {a.d.slice(11, 16)}</p>
          <p className="line-clamp-2 text-lg leading-tight font-semibold">{a.n}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Cell label="Distanse" value={a.dist ? `${fmtKm(a.dist)} km` : '–'} />
          <Cell label="Tid" value={fmtDur(a.mov)} />
          <Cell label="Tempo" value={a.dist ? fmtTempo(a.t, secPerKm(a)) : '–'} />
          <Cell label="Puls" value={a.hr ? `${fmtInt(a.hr)}` : '–'} />
          <Cell label="Høyde" value={a.up ? `${fmtInt(a.up)} m` : '–'} />
          <Cell label="Belastning" value={a.load ? fmtInt(a.load) : '–'} />
        </div>
        <div className="mt-auto">
          {splits.length > 1 ? (
            <>
              <p className="text-muted-foreground mb-1 text-[10px] tracking-wide uppercase">Km-splits · høyere = raskere</p>
              <MiniBars values={splits.slice(0, 40)} invert highlight={splits.indexOf(Math.min(...splits))} />
            </>
          ) : <div className="h-[3.25rem]" />}
          <button type="button" onClick={onOpen} className="text-muted-foreground hover:text-foreground mt-2 h-8 text-xs underline-offset-2 hover:underline">Åpne økten</button>
        </div>
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-lg px-1.5 py-1.5">
      <p className="text-muted-foreground truncate text-[9.5px] tracking-wide uppercase">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Stamp({ o, className, children }: { o: number; className?: string; children: React.ReactNode }) {
  return <span className={cn('pointer-events-none absolute rounded-lg border-[3px] px-3 py-1 text-2xl font-black tracking-widest', className)} style={{ opacity: o }}>{children}</span>
}
