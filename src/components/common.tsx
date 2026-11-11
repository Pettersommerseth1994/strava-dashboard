import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { type Activity, fmtDate, sportColor } from '@/lib/data'

export function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return null
  const pct = ((cur - prev) / prev) * 100
  if (!isFinite(pct)) return null
  const good = invert ? pct < 0 : pct > 0
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center text-xs font-medium tabular-nums', Math.abs(pct) < 0.5 ? 'text-muted-foreground' : good ? 'text-emerald-500' : 'text-rose-500')}>
      <Icon className="size-3.5" />{Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function Kpi({ icon: Icon, label, value, sub, delta }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; delta?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">{delta}{sub}</p>
        </div>
        <div className="bg-muted text-muted-foreground rounded-lg p-2"><Icon className="size-4" /></div>
      </CardContent>
    </Card>
  )
}

export function ChartCard({ title, desc, action, children, className }: { title: string; desc?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div><CardTitle>{title}</CardTitle>{desc && <CardDescription>{desc}</CardDescription>}</div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function SportDot({ t, className }: { t: string; className?: string }) {
  return <i className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: sportColor(t) }} />
}

export function ActivityRow({ a, onClick, right }: { a: Activity; onClick: () => void; right?: ReactNode }) {
  return (
    <button onClick={onClick} className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors">
      <SportDot t={a.t} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.n}</p>
        <p className="text-muted-foreground text-xs">{a.t} · {fmtDate(a.d)}</p>
      </div>
      {right}
    </button>
  )
}

export const axisProps = { tickLine: false, axisLine: false } as const
