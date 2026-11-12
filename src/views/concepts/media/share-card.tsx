import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type Activity, fmtDate, fmtDur, fmtKm, fmtSpeed, fmtInt } from '@/lib/data'
import { mediaUrl, thumbUrl } from '../local'
import { type Mem, Loading, useMemories } from './common'

const W = 1080, H = 1350
type Style = 'klassisk' | 'minimal' | 'fet'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const iw = img.width * s, ih = img.height * s
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
}

function stats(a: Activity): [string, string][] {
  const out: [string, string][] = []
  if (a.dist) out.push([`${fmtKm(a.dist)} km`, 'distanse'])
  out.push([fmtDur(a.mov), 'tid'])
  if (a.dist) out.push([fmtSpeed(a), 'snitt'])
  else if (a.hr) out.push([`${Math.round(a.hr)} bpm`, 'snittpuls'])
  if (a.up > 20 && out.length < 4) out.push([`${fmtInt(a.up)} m`, 'høydemeter'])
  return out.slice(0, 3)
}

async function draw(cv: HTMLCanvasElement, m: Mem, style: Style, brand: string, font: string) {
  const ctx = cv.getContext('2d')!
  cv.width = W; cv.height = H
  const [img, logo] = await Promise.all([loadImg(mediaUrl(m.f)), loadImg(`${import.meta.env.BASE_URL}insyte-logo.png`).catch(() => null)])
  const a = m.a, st = stats(a)
  ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  if (style === 'minimal') {
    // Polaroid: bilde øverst, hvit ramme, tekst under
    ctx.fillStyle = '#f5f2ec'; ctx.fillRect(0, 0, W, H)
    ctx.save(); ctx.beginPath(); ctx.roundRect(60, 60, W - 120, 900, 24); ctx.clip(); cover(ctx, img, 60, 60, W - 120, 900); ctx.restore()
    ctx.fillStyle = '#111'; ctx.font = `600 54px ${font}`; ctx.fillText(a.n.slice(0, 32), 70, 1050)
    ctx.fillStyle = '#6b6b6b'; ctx.font = `400 32px ${font}`; ctx.fillText(`${a.t} · ${fmtDate(a.d)}`, 70, 1100)
    st.forEach(([v, l], i) => {
      const x = 70 + i * 330
      ctx.fillStyle = '#111'; ctx.font = `700 60px ${font}`; ctx.fillText(v, x, 1210)
      ctx.fillStyle = '#8a8a8a'; ctx.font = `500 26px ${font}`; ctx.fillText(l.toUpperCase(), x, 1250)
    })
    if (logo) ctx.drawImage(logo, W - 70 - 160, 1040 - 38, 160, 38)
    return
  }

  cover(ctx, img, 0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.35, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  if (logo) { ctx.save(); ctx.filter = 'invert(1)'; ctx.drawImage(logo, 64, 64, 190, 45); ctx.restore() }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `500 30px ${font}`
  const date = fmtDate(a.d); ctx.fillText(date, W - 64 - ctx.measureText(date).width, 100)

  if (style === 'fet') {
    // Stort tall i merkefarge
    const [v, l] = st[0]
    ctx.fillStyle = brand; ctx.font = `800 220px ${font}`; ctx.fillText(v.replace(/ (km|t|bpm)$/, ''), 60, H - 330)
    ctx.fillStyle = '#fff'; ctx.font = `700 54px ${font}`; ctx.fillText(`${(v.match(/ (\S+)$/)?.[1] ?? l).toUpperCase()}`, 66, H - 260)
    ctx.font = `600 50px ${font}`; ctx.fillText(a.n.slice(0, 34), 64, H - 160)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `400 34px ${font}`; ctx.fillText(`${a.t} · ${st.slice(1).map((s) => s[0]).join(' · ')}`, 64, H - 105)
  } else {
    // Klassisk: navn + tre tall i rad
    ctx.fillStyle = brand; ctx.beginPath(); ctx.roundRect(64, H - 420, 24 + ctx.measureText(a.t).width * 1.1, 52, 26); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `600 28px ${font}`; ctx.fillText(a.t, 80, H - 384)
    ctx.font = `700 64px ${font}`; ctx.fillText(a.n.slice(0, 30), 64, H - 290)
    st.forEach(([v, l], i) => {
      const x = 64 + i * 330
      ctx.fillStyle = '#fff'; ctx.font = `700 64px ${font}`; ctx.fillText(v, x, H - 160)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `500 26px ${font}`; ctx.fillText(l.toUpperCase(), x, H - 115)
    })
  }
}

/** 5 · Delbart minnekort – velg et bilde, få et ferdig kort med tall du kan laste ned */
export function ShareCard() {
  const items = useMemories()
  const imgs = useMemo(() => (items ?? []).filter((m) => m.k === 'img'), [items])
  const [sel, setSel] = useState(0)
  const [style, setStyle] = useState<Style>('klassisk')
  const [busy, setBusy] = useState(false)
  const cv = useRef<HTMLCanvasElement>(null)
  const cur = imgs[sel]

  useEffect(() => {
    if (!cur || !cv.current) return
    const cs = getComputedStyle(document.documentElement)
    const brand = cs.getPropertyValue('--brand').trim() || '#f28a3b'
    const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
    let on = true
    setBusy(true)
    document.fonts.ready
      .then(async () => { if (on && cv.current) await draw(cv.current, cur, style, brand, font) })
      .catch(() => {})
      .finally(() => { if (on) setBusy(false) })
    return () => { on = false }
  }, [cur, style])

  if (!items) return <Loading />
  if (!imgs.length) return <Loading empty />

  const download = () => {
    cv.current?.toBlob((b) => {
      if (!b) return
      const url = URL.createObjectURL(b)
      const el = document.createElement('a')
      el.href = url; el.download = `minne-${cur.a.d.slice(0, 10)}.png`; el.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative mx-auto w-full max-w-sm">
        <canvas ref={cv} width={W} height={H} className="bg-muted aspect-[4/5] w-full rounded-xl shadow-lg" />
        {busy && <span className="absolute inset-0 grid place-items-center"><Loader2 className="size-6 animate-spin text-white" /></span>}
      </div>
      <div className="min-w-0 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Stil</p>
          <ToggleGroup value={[style]} onValueChange={(v) => v[0] && setStyle(v[0] as Style)} variant="outline" size="sm">
            <ToggleGroupItem value="klassisk">Klassisk</ToggleGroupItem>
            <ToggleGroupItem value="fet">Fet</ToggleGroupItem>
            <ToggleGroupItem value="minimal">Polaroid</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Velg bilde <span className="text-muted-foreground font-normal">({imgs.length})</span></p>
          <div className="grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
            {imgs.map((m, i) => (
              <button key={m.key} onClick={() => setSel(i)} aria-label={m.a.n}
                className={`aspect-square cursor-pointer overflow-hidden rounded-md ring-2 transition ${i === sel ? 'ring-[var(--brand)]' : 'ring-transparent opacity-75 hover:opacity-100'}`}>
                <img src={thumbUrl(m.f)} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={busy}><Download />Last ned PNG</Button>
          <Button variant="outline" onClick={() => setSel(Math.floor(Math.random() * imgs.length))}>Tilfeldig bilde</Button>
        </div>
        <p className="text-muted-foreground text-xs">1080 × 1350 px – passer for Instagram og Strava. Lages lokalt i nettleseren.</p>
      </div>
    </div>
  )
}
