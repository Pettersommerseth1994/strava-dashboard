import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { mediaUrl, posterUrl, thumbUrl, useMedia } from '@/views/concepts/local'

/** Bilder og videoer fra én økt: stripe i eget format, med visning i full størrelse */
export function SessionMedia({ id, name }: { id: string; name: string }) {
  const media = useMedia()
  const items = media?.[id] ?? []
  const [lb, setLb] = useState<number | null>(null)
  const n = items.length

  useEffect(() => { setLb(null) }, [id])
  useEffect(() => {
    if (lb == null) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setLb(null) }
      else if (e.key === 'ArrowRight') setLb((i) => (i == null ? i : (i + 1) % n))
      else if (e.key === 'ArrowLeft') setLb((i) => (i == null ? i : (i - 1 + n) % n))
    }
    // capture: Esc skal lukke bildet, ikke hele øktpanelet
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [lb, n])

  if (!n) return null
  const cur = lb == null ? null : items[lb]
  const single = n === 1

  return (
    <section aria-label="Bilder og video">
      <h3 className="mb-2 text-sm font-semibold">Bilder og video <span className="text-muted-foreground font-normal">· {n}</span></h3>
      <div className={single ? '' : 'no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5'}>
        {items.map((m, i) => {
          const ratio = m.w && m.h ? m.w / m.h : 4 / 3
          return (
            <button key={m.f} onClick={() => setLb(i)} aria-label={m.k === 'vid' ? `Spill av video ${i + 1} av ${n}` : `Vis bilde ${i + 1} av ${n}`}
              className="group relative block shrink-0 snap-start overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: `${ratio}`, height: single ? `min(20rem, calc(min(100vw - 2.5rem, 38rem) / ${ratio}))` : `min(13rem, calc(70vw / ${ratio}))`, maxWidth: '100%' }}>
              <img src={m.k === 'vid' ? posterUrl(m.f) : thumbUrl(m.f)} alt={name} loading="lazy" draggable={false}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              {m.k === 'vid' && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"><Play className="size-5 translate-x-px fill-current" /></span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {cur && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white" role="dialog" aria-label="Bilde i full størrelse">
          <div className="flex items-center justify-between gap-3 p-3">
            <p className="min-w-0 truncate text-sm">{name}{n > 1 && <span className="text-white/60 tabular-nums"> · {lb! + 1} av {n}</span>}</p>
            <button onClick={() => setLb(null)} aria-label="Lukk" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="size-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {cur.k === 'img'
              ? <img key={cur.f} src={mediaUrl(cur.f)} alt={name} className="max-h-full max-w-full rounded-lg object-contain" />
              : <video key={cur.f} src={mediaUrl(cur.f)} poster={posterUrl(cur.f)} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />}
            {n > 1 && (
              <>
                <button onClick={() => setLb((lb! - 1 + n) % n)} aria-label="Forrige" className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"><ChevronLeft className="size-5" /></button>
                <button onClick={() => setLb((lb! + 1) % n)} aria-label="Neste" className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"><ChevronRight className="size-5" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
