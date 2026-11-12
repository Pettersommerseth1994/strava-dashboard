import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export { TODAY, YEAR, doy, daysInYear, inYear, ytd } from '@/lib/year'

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
