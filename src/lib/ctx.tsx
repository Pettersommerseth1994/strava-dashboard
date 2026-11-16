import { createContext, useContext } from 'react'
import type { Activity } from '@/lib/data'
import type { Range } from '@/lib/period'

export type Selection = { kind: 'activity'; id: string } | { kind: 'list'; title: string; ids: string[] } | null

export type Ctx = {
  all: Activity[]
  byId: Map<string, Activity>
  acts: Activity[]      // valgt periode + idrett
  prevActs: Activity[]  // forrige tilsvarende periode + idrett
  range: Range
  setRange: (r: Range) => void
  sports: string[]
  setSports: (s: string[]) => void
  open: (s: Selection) => void
}
export const AppCtx = createContext<Ctx>(null as never)
export const useApp = () => useContext(AppCtx)
