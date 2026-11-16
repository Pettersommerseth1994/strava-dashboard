import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActivitySheet } from '@/components/activity-sheet'
import { ChatPanel } from '@/components/chat-panel'
import { CommandPalette } from '@/components/command-palette'
import { InsightPanel } from '@/components/insight-panel'
import { EmptyState, MobileNav, type ShellActions, ShellSkeleton, Sidebar, TopBar, VIEWS, viewOf } from '@/components/shell'
import { StoreProvider, useStore } from '@/lib/store'
import { notifyRoute, readRoute, routeUrl } from '@/lib/route'
import { type Activity, fmtDate, fmtInt, sanitize } from '@/lib/data'
import { Overview } from '@/views/overview'
import { Records } from '@/views/records'
import { Form, Progress } from '@/views/progress'
import { Explorer, Sessions } from '@/views/sessions'

/** Chatten er skjult inntil videre – sett til true for å vise «Spør dataen» igjen */
const SHOW_CHAT = false

/** Historie lastes først når visningen åpnes (kartbiblioteket er stort) */
const Memories = lazy(() => import('@/views/memories').then((m) => ({ default: m.Memories })))
/** Forslag og konsepter vises bare lokalt (npm run dev), aldri på nettsiden */
const Lab = import.meta.env.DEV ? lazy(() => import('@/views/lab').then((m) => ({ default: m.Lab }))) : null
const Concepts = import.meta.env.DEV ? lazy(() => import('@/views/concepts').then((m) => ({ default: m.Concepts }))) : null

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

function useTheme() {
  const [dark, setDark] = useState(() => (store.get('theme') ?? 'dark') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    store.set('theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, useCallback(() => setDark((d) => !d), [])] as const
}

/** Gjeldende visning følger adressen (#/rekorder), slik at tilbake-knappen og delte lenker virker */
function useView() {
  const valid = (k: string) => (viewOf(k) ? k : '')
  const [view, setView] = useState(() => valid(readRoute().view) || 'oversikt')
  useEffect(() => {
    if (!valid(readRoute().view)) history.replaceState(history.state, '', routeUrl(view, readRoute().a))
    const sync = () => setView(valid(readRoute().view) || 'oversikt')
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const go = useCallback((k: string) => {
    if (k !== readRoute().view || readRoute().a) history.pushState(null, '', routeUrl(k))
    notifyRoute()
    window.scrollTo({ top: 0 })
  }, [])
  return [view, go] as const
}

function Shell() {
  const { all, acts, periodActs, sportActs, range, sports, goRange } = useStore()
  const [dark, toggleTheme] = useTheme()
  const [view, go] = useView()
  const [collapsed, setCollapsed] = useState(() => store.get('sidebar') === 'collapsed' || (store.get('sidebar') == null && window.innerWidth < 1180))
  const [insight, setInsight] = useState(false)
  const [search, setSearch] = useState(false)
  const [chat, setChat] = useState(false)

  const toggleSidebar = useCallback(() => setCollapsed((c) => { store.set('sidebar', c ? 'open' : 'collapsed'); return !c }), [])

  // Første besøk i økten: vis en innsikt etter et lite øyeblikk
  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem('insight-seen') === '1'; sessionStorage.setItem('insight-seen', '1') } catch { /* ignore */ }
    if (!seen) { const t = setTimeout(() => setInsight(true), 1200); return () => clearTimeout(t) }
  }, [])

  // Tastatursnarveier: ⌘K søk, ⌘B meny
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((s) => !s) }
      else if (e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [toggleSidebar])

  const v = viewOf(view) ?? VIEWS[0]
  useEffect(() => { document.title = `${v.label} · Magnus – Treningsdashboard` }, [v.label])

  const a: ShellActions = useMemo(() => ({
    view, go, dark, toggleTheme, insight, toggleInsight: () => setInsight((i) => !i), openSearch: () => setSearch(true),
  }), [view, go, dark, toggleTheme, insight])

  // Undertittel: hva som faktisk vises akkurat nå
  const shown = v.filters.sport ? acts : v.filters.period ? periodActs : sportActs
  const sub = v.filters.period
    ? `${range.label}${v.filters.sport && sports.length ? ` · ${sports.join(', ')}` : ''} · ${fmtInt(shown.length)} ${shown.length === 1 ? 'økt' : 'økter'}`
    : v.desc
  const empty = !!v.filters.period && shown.length === 0

  const meta = { name: 'Magnus Kvitvær Sommerseth', sub: `${fmtInt(all.length)} økter · siden ${fmtDate(all[0].d)}` }
  const fallback = <p className="text-muted-foreground py-16 text-center text-sm">Laster …</p>

  return (
    <TooltipProvider delay={300}>
      <a href="#innhold" className="bg-foreground text-background sr-only z-50 rounded-lg px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Hopp til innholdet</a>
      <div className="app-bg" />
      <Sidebar a={a} collapsed={collapsed} meta={meta} />

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'md:pl-[5.75rem]' : 'md:pl-[16.5rem]'}`}>
        <TopBar a={a} v={v} sub={sub} onToggleSidebar={toggleSidebar} />
        <main id="innhold" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-3 pt-4 pb-28 outline-none md:px-5 md:pb-6">
          {empty ? <EmptyState /> : (
            <Suspense fallback={fallback}>
              {view === 'oversikt' && <Overview />}
              {view === 'rekorder' && <Records />}
              {view === 'progresjon' && <Progress />}
              {view === 'form' && <Form />}
              {view === 'utforsker' && <Explorer />}
              {view === 'okter' && <Sessions />}
              {view === 'historie' && <Memories />}
              {view === 'forslag' && Lab && <Lab />}
              {view === 'konsepter' && Concepts && <Concepts />}
            </Suspense>
          )}
          <footer className="text-muted-foreground pt-10 pb-2 text-center text-xs">Utviklet av Petter Sommerseth med Claude AI</footer>
        </main>
      </div>

      <MobileNav a={a} />
      <InsightPanel open={insight} onClose={() => setInsight(false)} onRange={(f, t) => { goRange(f, t); go('oversikt') }} />
      <CommandPalette open={search} onOpenChange={setSearch} a={a} />
      {SHOW_CHAT && <ChatPanel open={chat} onOpenChange={setChat} />}
      <ActivitySheet />
    </TooltipProvider>
  )
}

export default function App() {
  const [all, setAll] = useState<Activity[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((d: Activity[]) => setAll(sanitize(d))).catch(() => setFailed(true))
  }, [])
  // Tema settes også før dataene er lastet, så lasteskjelettet får riktig farge
  useEffect(() => { document.documentElement.classList.toggle('dark', (store.get('theme') ?? 'dark') === 'dark') }, [])

  if (failed) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="app-bg" />
        <div className="glass max-w-sm rounded-2xl p-6">
          <p className="font-medium">Fikk ikke lastet treningsdataene</p>
          <p className="text-muted-foreground mt-1 text-sm">Sjekk nettforbindelsen og prøv igjen.</p>
          <button onClick={() => location.reload()} className="bg-foreground text-background mt-4 h-9 rounded-lg px-4 text-sm font-medium">Prøv igjen</button>
        </div>
      </div>
    )
  }
  if (!all) return <ShellSkeleton />
  return <StoreProvider all={all}><Shell /></StoreProvider>
}
