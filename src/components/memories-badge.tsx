import { useEffect, useMemo, useState } from 'react'
import { todayStr } from '@/lib/data'
import { throwbacksFor, useMemories } from '@/views/concepts/media/common'

const KEY = 'minner-sett'

/**
 * Antall nye tilbakeblikk i dag som ikke er sett ennå.
 * Når fanen er aktiv, markeres dagens tilbakeblikk som sett.
 */
export function useNewThrowbacks(active: boolean) {
  const items = useMemories()
  const today = todayStr()
  const hits = useMemo(() => (items ? throwbacksFor(items, today) : []), [items, today])
  const key = `${today}:${hits.map((h) => h.key).join(',')}`
  const [seen, setSeen] = useState<string | null>(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  useEffect(() => {
    if (!active || !hits.length || seen === key) return
    try { localStorage.setItem(KEY, key) } catch { /* ignore */ }
    setSeen(key)
  }, [active, hits.length, key, seen])
  return hits.length && seen !== key ? hits.length : 0
}

/** Faneetikett for Minner med varselprikk */
export function MemoriesTabLabel({ active }: { active: boolean }) {
  const n = useNewThrowbacks(active)
  return (
    <span className="relative inline-flex items-center gap-1.5">
      Minner
      {n > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] leading-none font-bold text-white tabular-nums" aria-label={`${n} nye tilbakeblikk`}>
          {n}
        </span>
      )}
    </span>
  )
}
