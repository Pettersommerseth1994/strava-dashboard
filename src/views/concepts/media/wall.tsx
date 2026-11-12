import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useStore } from '@/lib/store'
import { fmtDate, sportOf } from '@/lib/data'
import { mediaUrl, posterUrl } from '../local'
import { Loading, MemThumb, SportPill, statLine, swipeHandlers, useMemories } from './common'

/** 3 · Bildevegg med lysboks – alle bilder og videoer, filtrerbart på år og idrett */
export function MediaWall() {
  const items = useMemories()
  const { open } = useStore()
  const [year, setYear] = useState('alle')
  const [sport, setSport] = useState('alle')
  const [kind, setKind] = useState('alle')
  const [lb, setLb] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const PAGE = 24

  const years = useMemo(() => [...new Set((items ?? []).map((m) => m.a.d.slice(0, 4)))].sort().reverse(), [items])
  const sports = useMemo(() => [...new Set((items ?? []).map((m) => sportOf(m.a.t)))], [items])
  const list = useMemo(() => (items ?? []).filter((m) =>
    (year === 'alle' || m.a.d.startsWith(year)) && (sport === 'alle' || sportOf(m.a.t) === sport) && (kind === 'alle' || m.k === kind)), [items, year, sport, kind])

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const pg = Math.min(page, pages - 1)
  const shown = list.slice(pg * PAGE, pg * PAGE + PAGE)
  const cur = lb == null ? null : list[lb]
  const step = (n: number) => setLb((i) => (i == null || !list.length ? i : (i + n + list.length) % list.length))

  useEffect(() => {
    if (lb == null) return
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') setLb(null) }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [lb, list.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <Loading />
  if (!items.length) return <Loading empty />

  const toggle = (v: string, set: (s: string) => void, opts: [string, string][]) => (
    <div className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
      <ToggleGroup value={[v]} onValueChange={(x) => { if (x[0]) { set(x[0]); setPage(0) } }} variant="outline" size="sm">
        {opts.map(([k, l]) => <ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {toggle(year, setYear, [['alle', 'Alle år'], ...years.map((y) => [y, y] as [string, string])])}
        {toggle(sport, setSport, [['alle', 'Alle idretter'], ...sports.map((s) => [s, s] as [string, string])])}
        {toggle(kind, setKind, [['alle', 'Alt'], ['img', 'Bilder'], ['vid', 'Videoer']])}
      </div>
      <p className="text-muted-foreground text-xs">{list.length} {list.length === 1 ? 'minne' : 'minner'}</p>

      {/* Murverk med CSS-kolonner – videoer får høyere format for variasjon */}
      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2">
        {shown.map((m, j) => { const i = pg * PAGE + j; return (
          <button key={m.key} onClick={() => setLb(i)}
            className={`group relative block w-full cursor-pointer break-inside-avoid overflow-hidden rounded-xl bg-black ${m.k === 'vid' ? 'aspect-[9/14]' : i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <MemThumb m={m} className="transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-left text-[11px] font-medium text-white opacity-90">
              <span className="line-clamp-1">{m.a.n}</span>
              <span className="text-white/70">{fmtDate(m.a.d)}</span>
            </span>
          </button>
        ) })}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1 text-sm">
          <span className="text-muted-foreground tabular-nums">Side {pg + 1} av {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}><ChevronLeft />Forrige</Button>
            <Button variant="outline" size="sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Neste<ChevronRight /></Button>
          </div>
        </div>
      )}

      {cur && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur" role="dialog" aria-label="Lysboks">
          <div className="flex items-center justify-between gap-2 p-3">
            <SportPill a={cur.a} />
            <span className="text-xs text-white/60 tabular-nums">{(lb ?? 0) + 1} / {list.length}</span>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setLb(null)} aria-label="Lukk"><X /></Button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" {...swipeHandlers(() => step(1), () => step(-1))}>
            {cur.k === 'img'
              ? <img key={cur.key} src={mediaUrl(cur.f)} alt={cur.a.n} className="animate-in fade-in max-h-full max-w-full rounded-lg object-contain duration-300" draggable={false} />
              : <video key={cur.key} src={mediaUrl(cur.f)} poster={posterUrl(cur.f)} controls playsInline autoPlay muted className="max-h-full max-w-full rounded-lg" />}
            <button onClick={() => step(-1)} aria-label="Forrige" className="absolute top-1/2 left-2 hidden size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"><ChevronLeft /></button>
            <button onClick={() => step(1)} aria-label="Neste" className="absolute top-1/2 right-2 hidden size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"><ChevronRight /></button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{cur.a.n}</p>
              <p className="text-sm text-white/70 tabular-nums">{fmtDate(cur.a.d)} · {statLine(cur.a)}</p>
            </div>
            <Button variant="secondary" onClick={() => { const id = cur.id; setLb(null); open(id) }}><ExternalLink />Åpne økten</Button>
          </div>
        </div>
      )}
    </div>
  )
}
