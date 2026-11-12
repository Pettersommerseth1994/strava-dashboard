import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type Activity, todayStr } from '@/lib/data'

export const TODAY = todayStr()
export const YEAR = Number(TODAY.slice(0, 4))

/** Dag i året (1-basert) for en ISO-dato */
export function doy(iso: string) {
  const y = Number(iso.slice(0, 4))
  return Math.floor((Date.UTC(y, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(y, 0, 1)) / 86400000) + 1
}
export const daysInYear = (y: number) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365)
export const inYear = (acts: Activity[], y: number) => acts.filter((a) => a.d.startsWith(String(y)))
/** Aktiviteter i år y fram til og med samme dag i året som i dag */
export const ytd = (acts: Activity[], y: number, upTo = doy(TODAY)) => inYear(acts, y).filter((a) => doy(a.d) <= upTo)

export function Proposal({ n, title, desc, children }: { n: number; title: string; desc: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">{n}</span>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-lg px-3 py-2.5">
      <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground truncate text-[11px]">{sub}</p>}
    </div>
  )
}
