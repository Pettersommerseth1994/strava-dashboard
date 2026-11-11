import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type Activity, type Period, type Range, resolvePeriod, todayStr } from '@/lib/data'

type Ctx = {
  all: Activity[]; byId: Map<string, Activity>; first: string
  period: Period; setPeriod: (p: Period) => void
  range: Range; prevRange: Range | null
  sports: string[]; setSports: (s: string[]) => void
  acts: Activity[]; prevActs: Activity[]; sportActs: Activity[]
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
  const goRange = useCallback((from: string, to: string) => setPeriod({ kind: 'custom', offset: 0, from, to }), [])
  useEffect(() => {
    const h = () => { const m = location.hash.match(/#a=(\d+)/); setOpenId(m ? m[1] : null) }
    h(); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
  }, [])
  const open = useCallback((id: string | null) => { history.replaceState(null, '', id ? `#a=${id}` : location.pathname + location.search); setOpenId(id) }, [])
  return (
    <C.Provider value={{ all, byId, first, period, setPeriod, range: cur, prevRange: prev, sports, setSports, acts, prevActs, sportActs, compare, setCompare, openId, open, goRange }}>
      {children}
    </C.Provider>
  )
}
