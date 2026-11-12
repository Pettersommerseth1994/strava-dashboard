import { Suspense, lazy, useEffect, useState } from 'react'
import { MessageSquare, Moon, Sparkles, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivitySheet } from '@/components/activity-sheet'
import { ChatPanel } from '@/components/chat-panel'
import { InsightPanel } from '@/components/insight-panel'
import { PeriodBar } from '@/components/filters'
import { MemoriesTabLabel } from '@/components/memories-badge'
import { Brand } from '@/components/brand'
import { StoreProvider } from '@/lib/store'
import { type Activity, fmtDate, fmtInt, sanitize } from '@/lib/data'
import { Overview } from '@/views/overview'
import { Records } from '@/views/records'
import { Form, Progress } from '@/views/progress'
import { Explorer, Sessions } from '@/views/sessions'

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem('theme'); if (s) return s === 'dark' } catch { /* ignore */ }
    return true
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

/** Chatten er skjult inntil videre – sett til true for å vise «Spør dataen» igjen */
const SHOW_CHAT = false

/** Minner lastes først når fanen åpnes (kartbiblioteket er stort) */
const Memories = lazy(() => import('@/views/memories').then((m) => ({ default: m.Memories })))

/** Forslag til nye funksjoner – vises bare lokalt (npm run dev), aldri på nettsiden */
const Lab = import.meta.env.DEV ? lazy(() => import('@/views/lab').then((m) => ({ default: m.Lab }))) : null
const Concepts = import.meta.env.DEV ? lazy(() => import('@/views/concepts').then((m) => ({ default: m.Concepts }))) : null

const TABS: [string, string][] = [
  ['oversikt', 'Oversikt'], ['rekorder', 'Rekorder'], ['progresjon', 'Progresjon'], ['form', 'Form'], ['utforsker', 'Utforsker'], ['okter', 'Økter'], ['historie', 'Historie'],
  ...(Lab ? [['forslag', 'Forslag ✦'] as [string, string]] : []),
  ...(Concepts ? [['konsepter', 'Konsepter ✦'] as [string, string]] : []),
]

export default function App() {
  const [dark, toggle] = useTheme()
  const [all, setAll] = useState<Activity[] | null>(null)
  const [tab, setTab] = useState<string>(() => { try { const t = sessionStorage.getItem('tab'); return t && TABS.some(([k]) => k === t) ? t : 'oversikt' } catch { return 'oversikt' } })
  const [insight, setInsight] = useState(false)
  const [chat, setChat] = useState(false)
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => r.json()).then((d: Activity[]) => setAll(sanitize(d))) }, [])
  useEffect(() => { try { sessionStorage.setItem('tab', tab) } catch { /* ignore */ } }, [tab])
  useEffect(() => {
    if (!all) return
    let seen = false
    try { seen = sessionStorage.getItem('insight-seen') === '1'; sessionStorage.setItem('insight-seen', '1') } catch { /* ignore */ }
    if (!seen) { const t = setTimeout(() => setInsight(true), 1200); return () => clearTimeout(t) }
  }, [all])

  if (!all) return <div className="bg-background text-muted-foreground grid min-h-screen place-items-center text-sm">Laster …</div>

  const meta = { name: 'Magnus Kvitvær Sommerseth', since: fmtDate(all[0].d), count: `${fmtInt(all.length)} økter` }

  return (
    <StoreProvider all={all}>
      <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)} className="bg-background min-h-screen gap-0">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
            <Brand m={meta} />
            <div className="ml-auto flex items-center gap-1">
              <Button variant={insight ? 'secondary' : 'ghost'} size="sm" onClick={() => setInsight(!insight)} className="gap-1.5" aria-pressed={insight}>
                <Sparkles className="text-[var(--brand)]" /><span className="hidden sm:inline">Innsikt</span>
              </Button>
              {SHOW_CHAT && (
                <Button variant="ghost" size="sm" onClick={() => setChat(true)} className="gap-1.5">
                  <MessageSquare /><span className="hidden sm:inline">Spør dataen</span>
                </Button>
              )}
              <div className="bg-border mx-1 h-5 w-px" />
              <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Bytt tema">{dark ? <Sun /> : <Moon />}</Button>
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 pb-2.5">
            <div className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden max-sm:[mask-image:linear-gradient(to_right,black_80%,transparent)]">
              <TabsList variant="line" className="h-9">
                {TABS.map(([k, l]) => <TabsTrigger key={k} value={k} className="px-2.5">{k === 'historie' ? <MemoriesTabLabel active={tab === 'historie'} /> : l}</TabsTrigger>)}
              </TabsList>
            </div>
            <PeriodBar />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6">
          <TabsContent value="oversikt"><Overview /></TabsContent>
          <TabsContent value="rekorder"><Records /></TabsContent>
          <TabsContent value="progresjon"><Progress /></TabsContent>
          <TabsContent value="form"><Form /></TabsContent>
          <TabsContent value="utforsker"><Explorer /></TabsContent>
          <TabsContent value="okter"><Sessions /></TabsContent>
          <TabsContent value="historie"><Suspense fallback={<p className="text-muted-foreground py-16 text-center text-sm">Laster historie …</p>}><Memories /></Suspense></TabsContent>
          {Concepts && <TabsContent value="konsepter"><Suspense fallback={<p className="text-muted-foreground py-16 text-center text-sm">Laster konsepter …</p>}><Concepts /></Suspense></TabsContent>}
          {Lab && <TabsContent value="forslag"><Suspense fallback={<p className="text-muted-foreground py-16 text-center text-sm">Laster forslag …</p>}><Lab /></Suspense></TabsContent>}
          <footer className="text-muted-foreground py-8 text-center text-xs">Utviklet av Petter Sommerseth med Claude AI</footer>
        </main>
      </Tabs>
      <InsightPanel open={insight} onClose={() => setInsight(false)} />
      {SHOW_CHAT && <ChatPanel open={chat} onOpenChange={setChat} />}
      <ActivitySheet />
    </StoreProvider>
  )
}
