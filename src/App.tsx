import { useEffect, useState } from 'react'
import { Activity as ActivityIcon, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivitySheet } from '@/components/activity-sheet'
import { PeriodBar } from '@/components/filters'
import { StoreProvider } from '@/lib/store'
import { type Activity, fmtDate, fmtInt } from '@/lib/data'
import { Overview } from '@/views/overview'
import { Records } from '@/views/records'
import { Form, Progress } from '@/views/progress'
import { Explorer, Sessions } from '@/views/sessions'

export const TITLE = 'Magnus – Treningsdashboard'

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

const TABS = [
  ['oversikt', 'Oversikt'], ['rekorder', 'Rekorder'], ['progresjon', 'Progresjon'], ['form', 'Form'], ['utforsker', 'Utforsker'], ['okter', 'Økter'],
] as const

export default function App() {
  const [dark, toggle] = useTheme()
  const [all, setAll] = useState<Activity[] | null>(null)
  const [tab, setTab] = useState<string>(() => { try { return sessionStorage.getItem('tab') || 'oversikt' } catch { return 'oversikt' } })
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => r.json()).then(setAll) }, [])
  useEffect(() => { try { sessionStorage.setItem('tab', tab) } catch { /* ignore */ } }, [tab])

  if (!all) return <div className="text-muted-foreground grid min-h-screen place-items-center">Laster …</div>

  return (
    <StoreProvider all={all}>
      <div className="bg-background min-h-screen">
        <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500 p-1.5 text-white"><ActivityIcon className="size-5" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-lg leading-tight font-semibold">{TITLE}</h1>
                <p className="text-muted-foreground text-xs">{fmtDate(all[0].d)} – {fmtDate(all[all.length - 1].d)} · {fmtInt(all.length)} økter</p>
              </div>
              <Button variant="outline" size="icon" className="ml-auto" onClick={toggle} aria-label="Bytt tema">{dark ? <Sun /> : <Moon />}</Button>
            </div>
            <PeriodBar />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5">
          <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)}>
            <div className="mb-5 max-w-full overflow-x-auto">
              <TabsList>{TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
            </div>
            <TabsContent value="oversikt"><Overview /></TabsContent>
            <TabsContent value="rekorder"><Records /></TabsContent>
            <TabsContent value="progresjon"><Progress /></TabsContent>
            <TabsContent value="form"><Form /></TabsContent>
            <TabsContent value="utforsker"><Explorer /></TabsContent>
            <TabsContent value="okter"><Sessions /></TabsContent>
          </Tabs>
          <footer className="text-muted-foreground py-8 text-center text-xs">Data fra Strava-eksport · bygget med shadcn/ui</footer>
        </main>
        <ActivitySheet />
      </div>
    </StoreProvider>
  )
}
