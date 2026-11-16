import { useState, type ComponentType, type ReactNode } from 'react'
import {
  ChartScatter, Ellipsis, FlaskConical, HeartPulse, History, LayoutDashboard, Lightbulb, ListChecks, Moon, PanelLeft, Search, SearchX, Sparkles, Sun,
  TrendingUp, Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type FilterSet, PeriodBar } from '@/components/filters'
import { InsyteLogo } from '@/components/brand'
import { useNewThrowbacks } from '@/components/memories-badge'
import { cn } from '@/lib/utils'
import { routeUrl } from '@/lib/route'
import { useStore } from '@/lib/store'

export type ViewDef = {
  k: string; label: string; desc: string; group: string
  icon: ComponentType<{ className?: string }>
  /** Hvilke globale filtre som gjelder i visningen */
  filters: FilterSet
  /** Vises i bunnmenyen på mobil */
  primary?: boolean
  dev?: boolean
}

const ALL: FilterSet = { period: true, sport: true, compare: true }
const BOTH: FilterSet = { period: true, sport: true }
const PERIOD: FilterSet = { period: true }

export const VIEWS: ViewDef[] = [
  { k: 'oversikt', label: 'Oversikt', desc: 'Nøkkeltall og utvikling', group: '', icon: LayoutDashboard, filters: ALL, primary: true },
  { k: 'progresjon', label: 'Progresjon', desc: 'Utvikling økt for økt', group: 'Analyse', icon: TrendingUp, filters: PERIOD },
  { k: 'form', label: 'Form', desc: 'Form, tretthet og belastning', group: 'Analyse', icon: HeartPulse, filters: BOTH },
  { k: 'utforsker', label: 'Utforsker', desc: 'Sammenlign to målinger fritt', group: 'Analyse', icon: ChartScatter, filters: BOTH },
  { k: 'okter', label: 'Økter', desc: 'Søk, sorter og åpne økter', group: 'Økter', icon: ListChecks, filters: BOTH, primary: true },
  { k: 'rekorder', label: 'Rekorder', desc: 'Personlige rekorder og merker', group: 'Økter', icon: Trophy, filters: PERIOD, primary: true },
  { k: 'historie', label: 'Historie', desc: 'Tilbakeblikk, bilder og rutekart', group: 'Minner', icon: History, filters: {}, primary: true },
  ...(import.meta.env.DEV ? [
    { k: 'forslag', label: 'Forslag', desc: 'Forslag som bare vises lokalt', group: 'Lab', icon: FlaskConical, filters: {}, dev: true },
    { k: 'konsepter', label: 'Konsepter', desc: 'Konsepter som bare vises lokalt', group: 'Lab', icon: Lightbulb, filters: {}, dev: true },
  ] as ViewDef[] : []),
]
export const viewOf = (k: string) => VIEWS.find((v) => v.k === k)
const GROUPS = [...new Set(VIEWS.map((v) => v.group))]

export type ShellActions = {
  view: string; go: (k: string) => void
  dark: boolean; toggleTheme: () => void
  insight: boolean; toggleInsight: () => void
  openSearch: () => void
}

function Dot({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return <span className={cn('grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] leading-none font-bold text-white tabular-nums', className)} aria-label={`${n} nye tilbakeblikk`}>{n}</span>
}

function NavLink({ v, active, collapsed, go, badge }: { v: ViewDef; active: boolean; collapsed: boolean; go: (k: string) => void; badge?: number }) {
  const link = (
    <a href={routeUrl(v.k)} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(v.k) }}
      aria-current={active ? 'page' : undefined} className={cn('nav-item relative', collapsed && 'justify-center px-0')}>
      <v.icon className="size-4 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{v.label}</span>}
      {!!badge && <Dot n={badge} className={collapsed ? 'absolute -top-0.5 right-1.5' : ''} />}
    </a>
  )
  if (!collapsed) return link
  return <Tooltip><TooltipTrigger render={link} /><TooltipContent side="right" sideOffset={10}>{v.label}</TooltipContent></Tooltip>
}

function IconAction({ label, collapsed, onClick, pressed, children }: { label: string; collapsed: boolean; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  const btn = (
    <button onClick={onClick} aria-pressed={pressed} className={cn('nav-item', collapsed && 'justify-center px-0', pressed && 'text-foreground')}>
      {children}{!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
  if (!collapsed) return btn
  return <Tooltip><TooltipTrigger render={btn} /><TooltipContent side="right" sideOffset={10}>{label}</TooltipContent></Tooltip>
}

/** Sidepanel til venstre (nettbrett og desktop) */
export function Sidebar({ a, collapsed, meta }: { a: ShellActions; collapsed: boolean; meta: { name: string; sub: string } }) {
  const news = useNewThrowbacks(a.view === 'historie')
  const initials = meta.name.split(' ').filter(Boolean).map((p) => p[0]).filter((_, i, arr) => i === 0 || i === arr.length - 1).join('').toUpperCase()
  return (
    <aside aria-label="Hovedmeny"
      className={cn('glass fixed inset-y-3 left-3 z-40 hidden flex-col gap-1 rounded-2xl p-2.5 transition-[width] duration-200 md:flex', collapsed ? 'w-[4.25rem]' : 'w-60')}>
      <a href={routeUrl('oversikt')} onClick={(e) => { e.preventDefault(); a.go('oversikt') }} aria-label="Insyte – til oversikten"
        className={cn('flex h-10 shrink-0 items-center rounded-lg', collapsed ? 'justify-center' : 'px-2')}>
        {collapsed
          ? <img src={`${import.meta.env.BASE_URL}insyte-mark.png`} alt="" width={43} height={43} className="size-6 dark:invert" draggable={false} />
          : <InsyteLogo className="h-[22px]" />}
      </a>

      {collapsed ? (
        <IconAction label="Søk (⌘K)" collapsed onClick={a.openSearch}><Search className="size-4 shrink-0" /></IconAction>
      ) : (
        <button onClick={a.openSearch} className="bg-background/40 text-muted-foreground hover:text-foreground mt-1 mb-1 flex h-9 w-full shrink-0 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors">
          <Search className="size-4 shrink-0" /><span className="flex-1 text-left">Søk …</span>
          <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-sans text-[10px] font-medium">⌘K</kbd>
        </button>
      )}

      <nav className="no-scrollbar -mx-1 flex-1 space-y-3 overflow-y-auto px-1 py-1">
        {GROUPS.map((g) => (
          <div key={g || 'top'} className="space-y-0.5">
            {g && (collapsed
              ? <div className="bg-border mx-auto my-2 h-px w-6" />
              : <p className="text-muted-foreground/80 px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-wide uppercase">{g}</p>)}
            {VIEWS.filter((v) => v.group === g).map((v) => (
              <NavLink key={v.k} v={v} active={a.view === v.k} collapsed={collapsed} go={a.go} badge={v.k === 'historie' ? news : 0} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t pt-2">
        <IconAction label="Innsikt" collapsed={collapsed} onClick={a.toggleInsight} pressed={a.insight}><Sparkles className="size-4 shrink-0 text-[var(--brand)]" /></IconAction>
        <IconAction label={a.dark ? 'Lyst tema' : 'Mørkt tema'} collapsed={collapsed} onClick={a.toggleTheme}>{a.dark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}</IconAction>
        <div className={cn('mt-1.5 flex items-center gap-2.5 rounded-xl p-1.5', collapsed ? 'justify-center' : 'bg-foreground/[0.04]')} title={meta.name}>
          <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold">{initials}</span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium">{meta.name}</p>
              <p className="text-muted-foreground truncate text-[10.5px] tabular-nums">{meta.sub}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

/** Bunnmeny på mobil: fire hovedvisninger + «Mer» */
export function MobileNav({ a }: { a: ShellActions }) {
  const [more, setMore] = useState(false)
  const news = useNewThrowbacks(a.view === 'historie')
  const primary = VIEWS.filter((v) => v.primary)
  const rest = VIEWS.filter((v) => !v.primary)
  const inRest = rest.some((v) => v.k === a.view)
  const item = 'relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium transition-colors'
  const pick = (k: string) => { setMore(false); a.go(k) }
  return (
    <>
      <nav aria-label="Hovedmeny" className="glass-strong fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex rounded-2xl p-1 md:hidden">
        {primary.map((v) => {
          const on = a.view === v.k
          return (
            <a key={v.k} href={routeUrl(v.k)} onClick={(e) => { e.preventDefault(); a.go(v.k) }} aria-current={on ? 'page' : undefined}
              className={cn(item, on ? 'text-foreground bg-foreground/[0.08]' : 'text-muted-foreground')}>
              <v.icon className={cn('size-5', on && 'text-[var(--brand)]')} />
              <span className="truncate">{v.label}</span>
              {v.k === 'historie' && <Dot n={news} className="absolute top-1.5 right-[calc(50%-1.25rem)]" />}
            </a>
          )
        })}
        <button onClick={() => setMore(true)} aria-haspopup="dialog" className={cn(item, inRest ? 'text-foreground bg-foreground/[0.08]' : 'text-muted-foreground')}>
          <Ellipsis className={cn('size-5', inRest && 'text-[var(--brand)]')} /><span>Mer</span>
        </button>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="gap-0 rounded-t-2xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-1 pb-1"><SheetTitle className="text-sm">Mer</SheetTitle></SheetHeader>
          <div className="space-y-0.5">
            {rest.map((v) => (
              <a key={v.k} href={routeUrl(v.k)} onClick={(e) => { e.preventDefault(); pick(v.k) }} aria-current={a.view === v.k ? 'page' : undefined} className="nav-item h-12">
                <v.icon className="size-5 shrink-0" />
                <span className="flex-1"><span className="block leading-tight">{v.label}</span><span className="text-muted-foreground block text-[11px] leading-tight font-normal">{v.desc}</span></span>
              </a>
            ))}
            <div className="bg-border my-2 h-px" />
            <button className="nav-item h-11" onClick={() => { setMore(false); a.openSearch() }}><Search className="size-5 shrink-0" />Søk i økter og sider</button>
            <button className="nav-item h-11" onClick={() => { setMore(false); a.toggleInsight() }}><Sparkles className="size-5 shrink-0 text-[var(--brand)]" />Innsikt</button>
            <button className="nav-item h-11" onClick={a.toggleTheme}>{a.dark ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}{a.dark ? 'Lyst tema' : 'Mørkt tema'}</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Topplinje: sidetittel, hva som vises, og filtrene som gjelder i visningen */
export function TopBar({ a, v, sub, onToggleSidebar }: { a: ShellActions; v: ViewDef; sub: string; onToggleSidebar: () => void }) {
  const hasFilters = !!(v.filters.period || v.filters.sport)
  return (
    <div className="scroll-edge px-3 pt-3 md:px-5">
      <header className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-2.5 py-2 md:min-h-14 md:px-3">
        <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" onClick={onToggleSidebar} aria-label="Vis eller skjul menyen" title="Vis eller skjul menyen (⌘B)"><PanelLeft /></Button>
        <img src={`${import.meta.env.BASE_URL}insyte-mark.png`} alt="Insyte" width={43} height={43} className="ml-1 size-6 md:hidden dark:invert" draggable={false} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] leading-tight font-semibold tracking-tight">{v.label}</h1>
          <p className="text-muted-foreground truncate text-xs tabular-nums">{sub}</p>
        </div>
        <div className="flex items-center gap-0.5 md:hidden">
          <Button variant="ghost" size="icon" onClick={a.openSearch} aria-label="Søk"><Search /></Button>
          <Button variant="ghost" size="icon" onClick={a.toggleInsight} aria-label="Innsikt" aria-pressed={a.insight}><Sparkles className="text-[var(--brand)]" /></Button>
        </div>
        {hasFilters && (
          <div className="order-last w-full md:order-none md:w-auto">
            <PeriodBar show={v.filters} />
          </div>
        )}
      </header>
    </div>
  )
}

/** Vises når filtrene ikke gir noen økter */
export function EmptyState() {
  const { range, sports, resetFilters } = useStore()
  return (
    <div className="glass mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
      <span className="bg-muted grid size-12 place-items-center rounded-full"><SearchX className="text-muted-foreground size-5" /></span>
      <div>
        <p className="font-medium">Ingen økter i dette utvalget</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {range.label}{sports.length ? ` · ${sports.join(', ')}` : ''} har ingen registrerte økter. Prøv en annen periode eller idrett.
        </p>
      </div>
      <Button onClick={resetFilters}>Nullstill filtre</Button>
    </div>
  )
}

/** Lasteskjelett som ligner den ferdige siden */
export function ShellSkeleton() {
  const bar = 'animate-pulse rounded-2xl bg-foreground/[0.06]'
  return (
    <div className="min-h-screen" aria-busy="true" aria-label="Laster treningsdata">
      <div className="app-bg" />
      <div className={cn(bar, 'fixed inset-y-3 left-3 hidden w-60 md:block')} />
      <div className="space-y-4 p-3 md:pl-[16.5rem] md:pr-5">
        <div className={cn(bar, 'h-14')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className={cn(bar, 'h-24')} />)}</div>
        <div className={cn(bar, 'h-80')} />
        <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className={cn(bar, 'h-56')} />)}</div>
      </div>
    </div>
  )
}
