import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type Activity, type Period, type Range, resolvePeriod, todayStr } from '@/lib/data'
import { readRoute, routeUrl } from '@/lib/route'

type Ctx = {
  all: Activity[]; byId: Map<string, Activity>; first: string
  period: Period; setPeriod: (p: Period) => void
  range: Range; prevRange: Range | null
  sports: string[]; setSports: (s: string[]) => void
  acts: Activity[]; prevActs: Activity[]; sportActs: Activity[]
  /** Alle idretter, men bare valgt periode – for visninger med egen idrettsvelger */
  periodActs: Activity[]
  /** true når periode eller idrett er endret fra standard */
  filtered: boolean; resetFilters: () => void
  compare: boolean; setCompare: (b: boolean) => void
  openId: string | null; open: (id: string | null) => void
  goRange: (from: string, to: string) => void
}
const C = createContext<Ctx | null>(null)
export const useStore = () => useContext(C)!

export function StoreProvider({ all, children }: { all: Activity[]; children: ReactNode }) {
  const first = all[0].d.slice(0, 10)
  const [period, setPeriod] = useState<Period>({ kind: 'all', offset: 0 })
  const [sports, setSports] = useState<string[]>([])
  const [compare, setCompare] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all])
  const { cur, prev } = useMemo(() => resolvePeriod(period, first, todayStr()), [period, first])
  const sportActs = useMemo(() => (sports.length ? all.filter((a) => sports.includes(a.t)) : all), [all, sports])
  const inR = (r: Range) => sportActs.filter((a) => a.d.slice(0, 10) >= r.from && a.d.slice(0, 10) <= r.to)
  const acts = useMemo(() => inR(cur), [sportActs, cur]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevActs = useMemo(() => (prev ? inR(prev) : []), [sportActs, prev]) // eslint-disable-line react-hooks/exhaustive-deps
  const periodActs = useMemo(() => all.filter((a) => a.d.slice(0, 10) >= cur.from && a.d.slice(0, 10) <= cur.to), [all, cur])
  const filtered = period.kind !== 'all' || sports.length > 0
  const resetFilters = useCallback(() => { setPeriod({ kind: 'all', offset: 0 }); setSports([]) }, [])
  const goRange = useCallback((from: string, to: string) => setPeriod({ kind: 'custom', offset: 0, from, to }), [])
  // Åpen økt følger adressen: #/<visning>?a=<id>. Tilbake-knappen lukker økten.
  useEffect(() => {
    const h = () => setOpenId(readRoute().a)
    h(); window.addEventListener('hashchange', h); window.addEventListener('popstate', h)
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('popstate', h) }
  }, [])
  const open = useCallback((id: string | null) => {
    const { view, a } = readRoute()
    if (id) {
      const url = routeUrl(view || 'oversikt', id)
      if (a) history.replaceState(history.state, '', url)
      else history.pushState({ sheet: true }, '', url)
      setOpenId(id)
    } else {
      setOpenId(null)
      if (history.state?.sheet) history.back()
      else history.replaceState(null, '', routeUrl(view || 'oversikt'))
    }
  }, [])
  return (
    <C.Provider value={{ all, byId, first, period, setPeriod, range: cur, prevRange: prev, sports, setSports, acts, prevActs, sportActs, periodActs, filtered, resetFilters, compare, setCompare, openId, open, goRange }}>
      {children}
    </C.Provider>
  )
}
