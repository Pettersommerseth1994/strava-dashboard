import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { ArrowUp, Check, ClipboardPaste, ExternalLink, Loader2, LogOut, MessageSquare, RotateCcw, Settings2, Wrench } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store'
import { chatTools, runTool, systemPrompt, todayLine } from '@/lib/chat-tools'

type MsgParam = Anthropic.Beta.Messages.BetaMessageParam
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam
type UiMsg = { role: 'user' | 'assistant'; text: string; tools?: string[]; error?: boolean }

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (beste)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (raskere)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (rimeligst)' },
]
const SUGGESTIONS = [
  'Hvor mange økter på langrenn hadde jeg i 2025 sammenlignet med 2024?',
  'Hva er mine fem raskeste 5 km, og når satte jeg dem?',
  'Oppsummer treningen min forrige uke.',
  'Hvilken måned har jeg trent mest i år, og hvorfor skiller den seg ut?',
  'Har pulsen min på rolige løpeturer endret seg det siste året?',
]
const TOOL_LABEL: Record<string, string> = { query_activities: 'Søker i økter', aggregate: 'Summerer', personal_bests: 'Finner rekorder', get_activity: 'Leser økt' }

const store = {
  get(k: string) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k) ?? '' } catch { return '' } },
  set(k: string, v: string, remember: boolean) {
    try { localStorage.removeItem(k); sessionStorage.removeItem(k); if (v) (remember ? localStorage : sessionStorage).setItem(k, v) } catch { /* ignore */ }
  },
}

/** Svært enkel markdown: avsnitt, punktlister, **fet**, `kode` og lenker (#a=id åpner økt). */
function Md({ text, onAct }: { text: string; onAct: (id: string) => void }) {
  const inline = (s: string, key: string): ReactNode[] => {
    const parts: ReactNode[] = []
    const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
    let last = 0, m: RegExpExecArray | null, i = 0
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index))
      if (m[1]) parts.push(<strong key={`${key}b${i}`}>{m[1]}</strong>)
      else if (m[2]) parts.push(<code key={`${key}c${i}`} className="bg-muted rounded px-1 text-[0.85em]">{m[2]}</code>)
      else if (m[3]) {
        const id = m[4].match(/#a=(\d+)/)?.[1]
        parts.push(id
          ? <button key={`${key}l${i}`} onClick={() => onAct(id)} className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">{m[3]}</button>
          : <a key={`${key}l${i}`} href={m[4]} target="_blank" rel="noreferrer" className="underline">{m[3]}</a>)
      }
      last = re.lastIndex; i++
    }
    if (last < s.length) parts.push(s.slice(last))
    return parts
  }
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="space-y-2">
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l) || !l.trim())) {
          return <ul key={bi} className="list-disc space-y-0.5 pl-4">{lines.filter((l) => l.trim()).map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''), `${bi}-${li}`)}</li>)}</ul>
        }
        if (/^#{1,4}\s/.test(b)) return <p key={bi} className="font-semibold">{inline(b.replace(/^#{1,4}\s/, ''), String(bi))}</p>
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</Fragment>)}</p>
      })}
    </div>
  )
}

export function ChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { all, open: openAct } = useStore()
  const [key, setKey] = useState(() => store.get('anthropic-key'))
  const [remember, setRemember] = useState(() => { try { return !!localStorage.getItem('anthropic-key') } catch { return false } })
  const [model, setModel] = useState(() => store.get('chat-model') || MODELS[0].id)
  const [showSettings, setShowSettings] = useState(!key)
  const [ui, setUi] = useState<UiMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useRef<MsgParam[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }) }, [ui])

  const saveKey = (k: string, r = remember) => { setKey(k); store.set('anthropic-key', k.trim(), r) }
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [keyErr, setKeyErr] = useState('')
  async function connect() {
    const k = draft.trim()
    if (!k) return
    if (!k.startsWith('sk-ant-')) { setKeyErr('Det ser ikke ut som en API-nøkkel. Den starter med «sk-ant-».'); return }
    setChecking(true); setKeyErr('')
    try {
      // Gratis kall som bare sjekker at nøkkelen virker
      await new Anthropic({ apiKey: k, dangerouslyAllowBrowser: true }).models.list({ limit: 1 })
      saveKey(k); setDraft(''); setShowSettings(false)
    } catch (e) {
      setKeyErr(e instanceof Anthropic.AuthenticationError ? 'Nøkkelen ble avvist. Sjekk at du kopierte hele nøkkelen.'
        : e instanceof Anthropic.APIConnectionError ? 'Fikk ikke kontakt med Anthropic. Sjekk nettforbindelsen.'
        : `Kunne ikke bekrefte nøkkelen: ${(e as Error).message}`)
    } finally { setChecking(false) }
  }
  async function paste() {
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) { setDraft(t); setKeyErr('') } } catch { setKeyErr('Fikk ikke lese utklippstavlen. Lim inn med ⌘V i feltet.') }
  }
  const disconnect = () => { saveKey(''); setShowSettings(false) }
  const patchLast = (f: (m: UiMsg) => UiMsg) => setUi((u) => [...u.slice(0, -1), f(u[u.length - 1])])

  async function ask(q: string) {
    if (!q.trim() || busy) return
    if (!key) { setShowSettings(true); return }
    setInput(''); setBusy(true)
    setUi((u) => [...u, { role: 'user', text: q }, { role: 'assistant', text: '', tools: [] }])
    history.current.push({ role: 'user', content: q })
    const client = new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true })
    const sports = [...new Set(all.map((a) => a.t))]
    try {
      for (let step = 0; step < 10; step++) {
        const stream = client.beta.messages.stream({
          model,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system: [{ type: 'text', text: systemPrompt(all), cache_control: { type: 'ephemeral' } }, { type: 'text', text: todayLine() }],
          tools: chatTools(sports),
          messages: history.current,
          ...(model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
        })
        stream.on('text', (d) => patchLast((m) => ({ ...m, text: m.text + d })))
        const msg = await stream.finalMessage()
        history.current.push({ role: 'assistant', content: msg.content })
        if (msg.stop_reason === 'refusal') { patchLast((m) => ({ ...m, text: m.text || 'Beklager, det spørsmålet kan jeg ikke svare på.' })); break }
        if (msg.stop_reason === 'max_tokens') { patchLast((m) => ({ ...m, text: m.text + '\n\n_(Svaret ble avkortet.)_' })); break }
        if (msg.stop_reason === 'pause_turn') continue
        if (msg.stop_reason !== 'tool_use') break
        const uses = msg.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use')
        patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), ...uses.map((u) => TOOL_LABEL[u.name] ?? u.name)], text: m.text ? m.text + '\n\n' : m.text }))
        const results: ToolResult[] = await Promise.all(uses.map(async (u) => {
          try {
            const inp = u.input
            if (!inp || typeof inp !== 'object' || Array.isArray(inp)) throw new Error('INVALID_JSON: verktøy-input må være et objekt')
            return { type: 'tool_result' as const, tool_use_id: u.id, content: await runTool(u.name, inp as Record<string, unknown>, all) }
          } catch (e) {
            return { type: 'tool_result' as const, tool_use_id: u.id, content: String((e as Error).message ?? e), is_error: true }
          }
        }))
        history.current.push({ role: 'user', content: results })
      }
    } catch (e) {
      const err = e instanceof Anthropic.AuthenticationError ? 'API-nøkkelen ble avvist. Sjekk nøkkelen under innstillinger.'
        : e instanceof Anthropic.RateLimitError ? 'For mange forespørsler akkurat nå. Prøv igjen om litt.'
        : e instanceof Anthropic.APIConnectionError ? 'Fikk ikke kontakt med Anthropic. Sjekk nettforbindelsen.'
        : e instanceof Anthropic.APIError ? `Feil fra API-et (${e.status ?? '?'}): ${e.message}` : `Noe gikk galt: ${(e as Error).message}`
      patchLast((m) => ({ ...m, text: m.text ? m.text + '\n\n' + err : err, error: true }))
      // Fjern ufullstendig tur slik at samtalen kan fortsette
      while (history.current.length && history.current[history.current.length - 1].role !== 'user') history.current.pop()
      if (history.current.length) history.current.pop()
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { history.current = []; setUi([]) }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2 pr-8">
            <MessageSquare className="size-4 text-[var(--brand)]" />
            <SheetTitle className="text-base">Spør dataen</SheetTitle>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="icon-sm" onClick={reset} disabled={!ui.length || busy} aria-label="Ny samtale" title="Ny samtale"><RotateCcw /></Button>
              <Button variant={showSettings ? 'secondary' : 'ghost'} size="icon-sm" disabled={!key} onClick={() => setShowSettings(!showSettings)} aria-label="Innstillinger" title="Innstillinger"><Settings2 /></Button>
            </div>
          </div>
          <SheetDescription className="text-xs">Still spørsmål om treningen din. Claude henter tallene fra dataene i dashboardet.</SheetDescription>
        </SheetHeader>

        {key && showSettings && (
          <div className="bg-muted/40 space-y-3 border-b px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-[var(--brand)]" />Koblet til Claude</span>
              <span className="text-muted-foreground font-mono">…{key.trim().slice(-4)}</span>
              <Button size="xs" variant="ghost" className="ml-auto" onClick={disconnect}><LogOut />Koble fra</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs"><Switch checked={remember} onCheckedChange={(r) => { setRemember(r); saveKey(key, r) }} />Husk meg på denne enheten</label>
              <Select value={model} onValueChange={(v) => { if (v) { setModel(v); store.set('chat-model', v, true) } }} items={MODELS.map((m) => ({ value: m.id, label: m.label }))}>
                <SelectTrigger size="sm" className="ml-auto w-52"><SelectValue /></SelectTrigger>
                <SelectContent>{MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!key ? (
          <div className="flex-1 overflow-y-auto px-5 py-6 text-sm">
            <h3 className="text-base font-semibold">Koble til Claude</h3>
            <p className="text-muted-foreground mt-1.5 leading-relaxed">
              Chatten bruker Claude via Anthropic. Du trenger en <b className="text-foreground font-medium">API-nøkkel</b> – en kode du lager selv på under ett minutt.
              Et vanlig Claude-abonnement (Pro/Max) kan dessverre ikke brukes her; API-et betales separat etter bruk, typisk noen få kroner per spørsmål.
            </p>
            <ol className="mt-6 space-y-6">
              <li className="flex gap-3">
                <span className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">1</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium">Lag en nøkkel</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">Logg inn (eller opprett konto), trykk <b>Create Key</b> og kopier nøkkelen.</p>
                  <Button size="sm" variant="outline" nativeButton={false} render={<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" />}>Åpne Anthropic Console<ExternalLink /></Button>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">2</span>
                <form className="min-w-0 flex-1 space-y-2" onSubmit={(e) => { e.preventDefault(); connect() }}>
                  <p className="font-medium">Lim inn nøkkelen</p>
                  <div className="flex gap-2">
                    <Input type="password" autoComplete="off" placeholder="sk-ant-…" value={draft} onChange={(e) => { setDraft(e.target.value); setKeyErr('') }} aria-invalid={!!keyErr} />
                    <Button type="button" size="sm" variant="outline" className="h-9" onClick={paste}><ClipboardPaste />Lim inn</Button>
                  </div>
                  {keyErr && <p className="text-destructive text-xs">{keyErr}</p>}
                  <label className="flex items-center gap-2 pt-1 text-xs"><Switch checked={remember} onCheckedChange={setRemember} />Husk meg på denne enheten</label>
                  <Button type="submit" className="mt-2 w-full" disabled={!draft.trim() || checking}>{checking ? <><Loader2 className="animate-spin" />Sjekker nøkkelen …</> : 'Koble til'}</Button>
                </form>
              </li>
            </ol>
            <p className="text-muted-foreground mt-8 border-t pt-4 text-[11px] leading-relaxed">
              Nøkkelen lagres bare i denne nettleseren og sendes kun til Anthropic. Spørsmålene dine og utdrag av treningsdataene sendes dit for å lage svaret. Ikke huske nøkkelen på delte maskiner.
            </p>
          </div>
        ) : (
        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          {ui.length === 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Forslag</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={busy} className="hover:bg-muted w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors">{s}</button>
              ))}
            </div>
          )}
          {ui.map((m, i) => m.role === 'user' ? (
            <div key={i} className="bg-foreground text-background ml-8 rounded-2xl rounded-br-sm px-3 py-2">{m.text}</div>
          ) : (
            <div key={i} className="mr-4 space-y-2">
              {!!m.tools?.length && (
                <div className="flex flex-wrap gap-1">
                  {m.tools.map((t, ti) => <span key={ti} className="text-muted-foreground bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"><Wrench className="size-3" />{t}</span>)}
                </div>
              )}
              {m.text ? <div className={m.error ? 'text-destructive' : ''}><Md text={m.text} onAct={(id) => { onOpenChange(false); openAct(id) }} /></div>
                : busy && i === ui.length - 1 ? <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" />Tenker …</p> : null}
            </div>
          ))}
        </div>

        )}

        <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={key ? 'Spør om treningen din …' : 'Koble til Claude først'} disabled={!key}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            className="border-input bg-background focus-visible:ring-ring/50 max-h-32 min-h-9 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">{busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
