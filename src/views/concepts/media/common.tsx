import { useMemo } from 'react'
import { ImageOff, Play } from 'lucide-react'
import { useStore } from '@/lib/store'
import { type Activity, fmtDur, fmtKm, sportColor } from '@/lib/data'
import { cn } from '@/lib/utils'
import { type MediaItem, mediaUrl, posterUrl, thumbUrl, useMedia } from '../local'

export type Mem = MediaItem & { id: string; a: Activity; key: string }

/** Alle bilder og videoer koblet til økten sin, nyeste først */
export function useMemories() {
  const media = useMedia()
  const { byId } = useStore()
  const items = useMemo(() => {
    if (!media) return null
    const out: Mem[] = []
    for (const [id, list] of Object.entries(media)) {
      const a = byId.get(id)
      if (!a) continue
      list.forEach((m, i) => out.push({ ...m, id, a, key: `${id}-${i}` }))
    }
    return out.sort((x, y) => (x.a.d < y.a.d ? 1 : x.a.d > y.a.d ? -1 : 0))
  }, [media, byId])
  return items
}

/** Kort statistikklinje: «12,3 km · 1t 02m» */
export function statLine(a: Activity) {
  return [a.dist ? `${fmtKm(a.dist)} km` : null, fmtDur(a.mov), a.up > 20 ? `${Math.round(a.up)} hm` : null].filter(Boolean).join(' · ')
}

/** Miniatyr: bilde (thumb) eller video (første bilde som plakat) */
export function MemThumb({ m, className, playing, fit = 'cover' }: { m: Mem; className?: string; playing?: boolean; fit?: 'cover' | 'contain' }) {
  const cls = cn('size-full', fit === 'cover' ? 'object-cover' : 'object-contain', className)
  if (m.k === 'img') return <img src={thumbUrl(m.f)} alt={m.a.n} loading="lazy" draggable={false} className={cls} />
  return (
    <span className="relative block size-full">
      {playing
        ? <video src={mediaUrl(m.f)} poster={posterUrl(m.f)} muted playsInline loop autoPlay className={cls} />
        : <img src={posterUrl(m.f)} alt={m.a.n} loading="lazy" draggable={false} className={cls} />}
      {!playing && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"><Play className="size-4 translate-x-px fill-current" /></span>
        </span>
      )}
    </span>
  )
}

export function SportPill({ a, className }: { a: Activity; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm', className)}>
      <i className="size-2 rounded-full" style={{ background: sportColor(a.t) }} />{a.t}
    </span>
  )
}

export function Loading({ empty }: { empty?: boolean }) {
  return (
    <div className="text-muted-foreground grid h-48 place-items-center rounded-xl border border-dashed text-sm">
      {empty ? <span className="flex items-center gap-2"><ImageOff className="size-4" />Fant ingen bilder eller videoer.</span> : 'Laster minner …'}
    </div>
  )
}

/** Enkel sveip-gjenkjenning for touch og mus */
export function swipeHandlers(onLeft: () => void, onRight: () => void, onTap?: (x: number, w: number) => void) {
  let sx = 0, sy = 0, t0 = 0
  return {
    onPointerDown: (e: React.PointerEvent) => { sx = e.clientX; sy = e.clientY; t0 = Date.now() },
    onPointerUp: (e: React.PointerEvent) => {
      const dx = e.clientX - sx, dy = e.clientY - sy
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) onLeft(); else onRight(); return }
      if (onTap && Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - t0 < 500) {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onTap(e.clientX - r.left, r.width)
      }
    },
  }
}

/** Dager mellom to datoer i kalenderåret (ignorerer år) */
export function dayDiff(a: string, b: string) {
  const y = 2001 // ikke skuddår
  const da = Date.UTC(y, +a.slice(5, 7) - 1, +a.slice(8, 10)), db = Date.UTC(y, +b.slice(5, 7) - 1, +b.slice(8, 10))
  const d = Math.abs(da - db) / 86400000
  return Math.min(d, 365 - d)
}

/** Minner fra tidligere år innenfor ± `window` dager rundt `day` */
export function throwbacksFor(items: Mem[], day: string, window = 3) {
  const y = +day.slice(0, 4)
  return items.filter((m) => +m.a.d.slice(0, 4) < y && dayDiff(m.a.d, day) <= window)
}
