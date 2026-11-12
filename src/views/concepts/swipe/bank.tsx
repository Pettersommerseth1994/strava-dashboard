import { useMemo, useState } from 'react'
import { Sparkles, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { type Activity, ZONE_COLORS, fmtDate, fmtDur, fmtKm, fmtNum, isFoot, sportColor, sportOf } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useLocalData } from '../local'
import { Chip, RouteSvg, type Saved, TAGS, type Tag, TagPill, bank, fmtTempo, median, secPerKm, snapOf, tagsOf, useBank, useMedians } from './shared'

export function Bank() {
  const { all, open } = useStore()
  const b = useBank()
  const medians = useMedians(all)
  const local = useLocalData()
  const [tag, setTag] = useState<Tag | null>(null)
  const [sport, setSport] = useState<string | null>(null)

  const items = useMemo(() => b.saved.map((s) => ({ s, tags: tagsOf(s.snap, medians, s.fav) })), [b.saved, medians])
  const sports = [...new Set(items.map((x) => x.s.snap.t))]
  const shown = items.filter((x) => (!tag || x.tags.includes(tag)) && (!sport || x.s.snap.t === sport))
  const tagCount = (t: Tag) => items.filter((x) => x.tags.includes(t)).length

  // Hurtigstart for forhåndsvisning: legg til 10 typiske «favoritter» (lengste, raskeste, flest høydemeter siste år)
  const quickFill = () => {
    if (!local) return
    const year = all.filter((a) => a.d >= `${+all[all.length - 1].d.slice(0, 4) - 1}`)
    const pick = new Map<string, Activity>()
    const add = (arr: Activity[], n: number) => arr.slice(0, n).forEach((a) => pick.set(a.id, a))
    add([...year].filter((a) => local.tracks[a.id]).sort((x, y) => y.dist - x.dist), 3)
    add([...year].filter((a) => isFoot(a.t) && a.dist >= 5000 && local.tracks[a.id]).sort((x, y) => secPerKm(x) - secPerKm(y)), 3)
    add([...year].filter((a) => local.tracks[a.id]).sort((x, y) => y.up - x.up), 2)
    add([...year].filter((a) => local.media[a.id]?.some((m) => m.k === 'img')), 2)
    ;[...pick.values()].forEach((a, i) => bank.save(a.id, snapOf(a, local.tracks, local.media), i === 0))
  }

  if (!b.saved.length) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <p className="font-medium">Banken er tom</p>
        <p className="text-muted-foreground mt-1 text-sm">Sveip økter til høyre i forslag 1, så havner de her med kart, data og nøkkeltall.</p>
        <Button variant="outline" className="mt-4" onClick={quickFill} disabled={!local}><Sparkles />Hurtigstart: fyll med 10 typiske favoritter</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Taste saved={b.saved} />

      <div className="space-y-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip on={!tag} onClick={() => setTag(null)}>Alle ({items.length})</Chip>
          {TAGS.filter((t) => tagCount(t)).map((t) => <Chip key={t} on={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t} ({tagCount(t)})</Chip>)}
        </div>
        {sports.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip on={!sport} onClick={() => setSport(null)}>Alle idretter</Chip>
            {sports.map((s) => <Chip key={s} on={sport === s} onClick={() => setSport(sport === s ? null : s)}><i className="size-2 rounded-full" style={{ background: sportColor(s) }} />{s}</Chip>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map(({ s, tags }) => (
          <div key={s.id} className="group bg-card relative overflow-hidden rounded-2xl border">
            <button type="button" onClick={() => open(s.id)} className="block w-full text-left">
              <div className="bg-muted/40 relative aspect-[4/3]">
                {s.snap.track ? <RouteSvg pts={s.snap.track} className="absolute inset-x-3 top-11 bottom-2 h-[calc(100%-3.25rem)] w-[calc(100%-1.5rem)]" stroke={sportColor(s.snap.t)} width={2.5} />
                  : <span className="text-muted-foreground absolute inset-0 grid place-items-center text-xs">Uten kart</span>}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate text-sm font-medium">{s.snap.n}</p>
                <p className="text-muted-foreground text-[11px] tabular-nums">{fmtDate(s.snap.d)} · {s.snap.dist ? `${fmtKm(s.snap.dist)} km · ` : ''}{fmtDur(s.snap.mov)}</p>
                <div className="flex flex-wrap gap-1">{tags.map((t) => <TagPill key={t} tag={t} />)}</div>
              </div>
            </button>
            <div className="absolute top-2 right-2 flex gap-1">
              <button type="button" aria-label={s.fav ? 'Fjern favoritt' : 'Gjør til favoritt'} onClick={() => bank.toggleFav(s.id)}
                className={cn('grid size-9 place-items-center rounded-full bg-black/50 backdrop-blur', s.fav ? 'text-[var(--brand)]' : 'text-white/80')}><Star className={cn('size-4', s.fav && 'fill-current')} /></button>
              <button type="button" aria-label="Fjern fra banken" onClick={() => bank.remove(s.id)} className="grid size-9 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur hover:text-white"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {b.saved.length < 5 && <Button variant="outline" size="sm" className="h-9" onClick={quickFill} disabled={!local}><Sparkles />Fyll på med typiske favoritter</Button>}
        <Button variant="ghost" size="sm" className="h-9" onClick={() => { if (confirm('Tømme hele banken?')) bank.clear() }}>Tøm banken</Button>
      </div>
    </div>
  )
}

/** Smaksprofil: hva banken sier om hva du liker */
function Taste({ saved }: { saved: Saved[] }) {
  const p = useMemo(() => {
    const snaps = saved.map((s) => s.snap)
    const bySport = new Map<string, number>()
    for (const s of snaps) bySport.set(sportOf(s.t), (bySport.get(sportOf(s.t)) ?? 0) + 1)
    const top = [...bySport].sort((a, b) => b[1] - a[1])
    const main = top[0]?.[0] ?? ''
    const mainSnaps = snaps.filter((s) => sportOf(s.t) === main && s.dist > 0)
    const zones = [0, 0, 0, 0, 0, 0]
    for (const s of snaps) s.zones?.forEach((z, i) => { if (i < 6) zones[i] += z })
    const zt = zones.reduce((a, b) => a + b, 0)
    const tod = [0, 0, 0, 0] // morgen, formiddag, ettermiddag, kveld
    for (const s of snaps) { const h = +s.d.slice(11, 13); tod[h < 9 ? 0 : h < 13 ? 1 : h < 18 ? 2 : 3]++ }
    return {
      top, main, n: snaps.length,
      dist: median(mainSnaps.map((s) => s.dist)), dur: median(snaps.map((s) => s.mov)),
      pace: median(mainSnaps.map(secPerKm)), hr: median(snaps.filter((s) => s.hr).map((s) => s.hr!)),
      zones: zt ? zones.map((z) => z / zt) : null, tod,
    }
  }, [saved])
  const TOD = ['Morgen', 'Formiddag', 'Ettermiddag', 'Kveld']
  const maxTod = Math.max(...p.tod, 1)

  return (
    <div className="rounded-2xl bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_60%)] p-4 ring-1 ring-foreground/10">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Smaksprofilen din · {p.n} lagrede økter</p>
      <p className="mt-1 text-lg leading-snug font-semibold text-balance">
        Du liker best {p.main.toLowerCase()} rundt {fmtKm(p.dist)} km{p.pace ? ` i ${fmtTempo(p.main, p.pace)}` : ''}, helst på {TOD[p.tod.indexOf(Math.max(...p.tod))].toLowerCase()}en.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] uppercase">Idretter</p>
          <div className="flex h-2.5 overflow-hidden rounded-full">{p.top.map(([s, n]) => <div key={s} style={{ width: `${(n / p.n) * 100}%`, background: sportColor(s) }} title={`${s}: ${n}`} />)}</div>
          <p className="text-muted-foreground mt-1.5 text-xs">{p.top.slice(0, 3).map(([s, n]) => `${s} ${n}`).join(' · ')}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] uppercase">Pulssoner</p>
          {p.zones ? <div className="flex h-2.5 overflow-hidden rounded-full">{p.zones.map((z, i) => <div key={i} style={{ width: `${z * 100}%`, background: ZONE_COLORS[i] }} title={`Sone ${i + 1}: ${Math.round(z * 100)} %`} />)}</div> : <p className="text-muted-foreground text-xs">Ingen pulsdata</p>}
          {p.zones && <p className="text-muted-foreground mt-1.5 text-xs">{Math.round((p.zones[0] + p.zones[1]) * 100)} % rolig · {Math.round((p.zones[3] + p.zones[4] + p.zones[5]) * 100)} % hardt{p.hr ? ` · snittpuls ${fmtNum(p.hr)}` : ''}</p>}
        </div>
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] uppercase">Tid på døgnet</p>
          <div className="flex h-10 items-end gap-1.5">{p.tod.map((n, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(8, (n / maxTod) * 100)}%`, background: i === p.tod.indexOf(Math.max(...p.tod)) ? 'var(--brand)' : 'var(--sp-roller)' }} title={`${TOD[i]}: ${n}`} />)}</div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">{TOD.map((t) => <span key={t}>{t.slice(0, 3)}</span>)}</div>
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">Typisk lengde {fmtDur(p.dur)} · banken brukes av øktbyggeren til å foreslå nye økter.</p>
    </div>
  )
}
