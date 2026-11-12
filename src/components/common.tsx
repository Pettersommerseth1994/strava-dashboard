import type { Key, ReactNode } from 'react'
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
    <span className={cn('inline-flex items-center text-xs font-medium tabular-nums', Math.abs(pct) < 0.5 ? 'text-muted-foreground' : good ? 'text-[var(--brand)]' : 'text-muted-foreground')}>
      <Icon className="size-3.5" />{Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function Kpi({ icon: Icon, label, value, sub, delta }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; delta?: ReactNode }) {
  return (
    <Card size="sm" className="gap-0">
      <CardContent className="min-w-0">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"><Icon className="size-3.5 shrink-0" /><span className="truncate">{label}</span></p>
        <p className="mt-1.5 text-xl leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-1 flex min-h-4 items-center gap-1.5 text-[11px] whitespace-nowrap">{delta}<span className="truncate">{sub}</span></p>
      </CardContent>
    </Card>
  )
}

export function ChartCard({ title, desc, action, children, className }: { title: string; desc?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><CardTitle>{title}</CardTitle>{desc && <CardDescription>{desc}</CardDescription>}</div>
        {action && <div className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:overflow-visible sm:px-0">{action}</div>}
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

type DotProps = { cx?: number; cy?: number; fill?: string; fillOpacity?: number | string; payload?: { id?: string } }

/**
 * Prikk for Recharts med større, usynlig trykkflate og pekerhånd.
 * Brukes som `shape` på Scatter og `dot` på Line.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function hitDot(onPick: (id: string) => void, opts: { r?: number; hit?: number; fill?: string; opacity?: number; ring?: boolean } = {}) {
  const { r = 4.5, hit = 12, fill, opacity, ring } = opts
  return function HitDot(p: DotProps & { key?: Key | null }) {
    if (p.cx == null || p.cy == null || !isFinite(p.cx) || !isFinite(p.cy)) return <g key={p.key ?? undefined} />
    const id = p.payload?.id
    return (
      <g key={p.key ?? `${p.cx}-${p.cy}`} className={id ? 'group/dot cursor-pointer' : undefined} onClick={id ? (e) => { e.stopPropagation(); onPick(id) } : undefined}>
        <circle cx={p.cx} cy={p.cy} r={hit} fill="transparent" />
        <circle cx={p.cx} cy={p.cy} r={r} fill={fill ?? p.fill} fillOpacity={opacity ?? p.fillOpacity ?? 1}
          stroke={ring ? 'var(--card)' : undefined} strokeWidth={ring ? 2 : undefined}
          className="origin-center transition-[r] duration-150 [transform-box:fill-box] group-hover/dot:scale-150" />
      </g>
    )
  }
}
