import { Suspense, lazy, useState } from 'react'
import { Image, Map, ShieldCheck } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const MediaConcepts = lazy(() => import('./concepts/media').then((m) => ({ default: m.MediaConcepts })))
const MapConcepts = lazy(() => import('./concepts/map').then((m) => ({ default: m.MapConcepts })))

const PARTS = [
  { k: 'media', label: 'Bilder og video', icon: Image },
  { k: 'map', label: 'Kart', icon: Map },
  // Sveip og bank er skjult inntil videre
] as const
type Part = (typeof PARTS)[number]['k']

/** Konsepter for bilder, video, kart og sveip – kun lokal forhåndsvisning */
export function Concepts() {
  const [part, setPart] = useState<Part>(() => { try { const p = sessionStorage.getItem('concept'); return p === 'map' ? 'map' : 'media' } catch { return 'media' } })
  const pick = (p: Part) => { setPart(p); try { sessionStorage.setItem('concept', p) } catch { /* ignore */ } }
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
        <p className="text-muted-foreground text-sm">
          <b className="text-foreground">Konsepter – bare lokalt.</b> Tilbakeblikk, minnekarusell, rutekart og bildevegg er flyttet til fanen Minner.
          Her ligger de øvrige forslagene.
        </p>
      </div>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ToggleGroup value={[part]} onValueChange={(v) => v[0] && pick(v[0] as Part)} variant="outline">
          {PARTS.map(({ k, label, icon: Icon }) => <ToggleGroupItem key={k} value={k} className="gap-1.5 px-3"><Icon />{label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <Suspense fallback={<p className="text-muted-foreground py-16 text-center text-sm">Laster konsepter …</p>}>
        {part === 'media' && <MediaConcepts />}
        {part === 'map' && <MapConcepts />}
      </Suspense>
    </div>
  )
}
