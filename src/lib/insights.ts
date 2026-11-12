import {
  type Activity, BE_DIST, BE_LABELS, METRIC, WEEKDAYS, addDays, bucketKey, bucketRange, dayKey, fmtClock, fmtDate, fmtHours, fmtInt, fmtNum, fmtPaceSec,
  longestStreak, MONTHS_LONG, todayStr, daysBetween, isoWeek,
} from '@/lib/data'

export type Insight = {
  id: string
  kind: 'trend' | 'record' | 'habit' | 'fun' | 'health'
  label: string
  text: string
  sub?: string
  actId?: string
  range?: [string, string]
  /** Handler om inneværende år (eller inneværende år mot fjoråret) – vises oftere */
  prio?: boolean
}

const PHRASE: Record<string, string> = {
  Løpetur: 'med løping', Langrenn: 'på langrenn', Rulleski: 'på rulleski', Sykkeltur: 'på sykkel',
  Styrketrening: 'med styrketrening', Treningsøkt: 'med andre treningsøkter', Gåtur: 'med gåturer',
}
const NOUN: Record<string, string> = {
  Løpetur: 'løping', Langrenn: 'langrenn', Rulleski: 'rulleski', Sykkeltur: 'sykling', Styrketrening: 'styrketrening', Treningsøkt: 'treningsøkter',
}
/** Filtrerer bort GPS-feil: raskere enn 2:40 /km er ikke realistisk */
const okBe = (a: Activity, k: string) => !!a.be?.[k] && a.be[k][0] / (BE_DIST[k] / 1000) >= 160
const than = (p: number) => (p >= 95 ? 'som' : 'enn')
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100)
const more = (p: number, plus: string, minus: string) => {
  if (p >= 95) {
    const many = plus === 'flere' ? 'mange' : 'mye'
    return `${fmtNum(1 + p / 100, 1).replace(/,0$/, '')} ganger så ${many}`
  }
  return `${Math.abs(p)} % ${p >= 0 ? plus : minus}`
}

function sum(acts: Activity[]) {
  return { n: acts.length, km: acts.reduce((x, a) => x + a.dist, 0) / 1000, h: acts.reduce((x, a) => x + a.mov, 0) / 3600, up: acts.reduce((x, a) => x + a.up, 0) }
}

export function buildInsights(all: Activity[], today = todayStr()): Insight[] {
  const out: Insight[] = []
  const add = (i: Omit<Insight, 'id'>) => out.push({ ...i, id: String(out.length) })
  const addP = (i: Omit<Insight, 'id' | 'prio'>) => add({ ...i, prio: true })
  const Y = +today.slice(0, 4)
  const md = today.slice(4)
  const inR = (f: string, t: string, sport?: string) => all.filter((a) => a.d.slice(0, 10) >= f && a.d.slice(0, 10) <= t && (!sport || a.t === sport))
  const years = [...new Set(all.map((a) => +a.d.slice(0, 4)))].sort()
  const sports = [...new Set(all.map((a) => a.t))]
  const firstFull = all[0].d.slice(5, 10) <= '01-31' ? years[0] : years[0] + 1

  // --- År mot år per idrett (hele år + hittil i år) ---
  for (const sp of sports) {
    if (!PHRASE[sp]) continue
    for (const y of years) {
      if (y >= Y || y - 1 < firstFull) continue
      const a = sum(inR(`${y}-01-01`, `${y}-12-31`, sp)), b = sum(inR(`${y - 1}-01-01`, `${y - 1}-12-31`, sp))
      if (a.n >= 5 && b.n >= 5 && Math.abs(pct(a.n, b.n)) >= 10)
        add({ kind: 'trend', label: `${y} mot ${y - 1}`, text: `Du hadde ${more(pct(a.n, b.n), 'flere', 'færre')} økter ${PHRASE[sp]} i ${y} ${than(pct(a.n, b.n))} i ${y - 1}.`, sub: `${a.n} mot ${b.n} økter · ${fmtHours(a.h * 3600)} mot ${fmtHours(b.h * 3600)}`, range: [`${y}-01-01`, `${y}-12-31`] })
      if (a.km > 50 && b.km > 50 && Math.abs(pct(a.km, b.km)) >= 15)
        add({ kind: 'trend', label: `${y} mot ${y - 1}`, text: `Du tilbakela ${more(pct(a.km, b.km), 'flere', 'færre')} kilometer ${PHRASE[sp]} i ${y} ${than(pct(a.km, b.km))} året før.`, sub: `${fmtInt(a.km)} km mot ${fmtInt(b.km)} km`, range: [`${y}-01-01`, `${y}-12-31`] })
    }
    const a = sum(inR(`${Y}-01-01`, today, sp)), b = sum(inR(`${Y - 1}-01-01`, `${Y - 1}${md}`, sp))
    if (a.n >= 5 && b.n >= 5 && Math.abs(pct(a.n, b.n)) >= 10)
      add({ kind: 'trend', label: 'Hittil i år', text: `Hittil i ${Y} har du ${more(pct(a.n, b.n), 'flere', 'færre')} økter ${PHRASE[sp]} ${than(pct(a.n, b.n))} på samme tid i fjor.`, sub: `${a.n} mot ${b.n} økter per ${fmtDate(today)}`, range: [`${Y}-01-01`, today] })
    if (a.h > 5 && b.h > 5 && Math.abs(pct(a.h, b.h)) >= 15)
      add({ kind: 'trend', label: 'Hittil i år', text: `Du har brukt ${more(pct(a.h, b.h), 'mer', 'mindre')} tid ${PHRASE[sp]} hittil i år ${than(pct(a.h, b.h))} i fjor på samme tid.`, sub: `${fmtHours(a.h * 3600)} mot ${fmtHours(b.h * 3600)}`, range: [`${Y}-01-01`, today] })
  }

  // --- Totalt hittil i år ---
  {
    const a = sum(inR(`${Y}-01-01`, today)), b = sum(inR(`${Y - 1}-01-01`, `${Y - 1}${md}`))
    if (b.h > 0) add({ kind: 'trend', label: 'Hittil i år', text: `Totalt har du trent ${fmtHours(a.h * 3600)} i ${Y} – ${more(pct(a.h, b.h), 'mer', 'mindre')} ${than(pct(a.h, b.h))} på samme tid i fjor.`, sub: `${a.n} økter og ${fmtInt(a.km)} km så langt`, range: [`${Y}-01-01`, today] })
    add({ kind: 'fun', label: 'Hittil i år', text: `${fmtHours(a.h * 3600)} trening i år tilsvarer ${fmtNum(a.h / 37.5, 1)} fulle arbeidsuker.`, range: [`${Y}-01-01`, today] })
    if (a.up > 2469) add({ kind: 'fun', label: 'Høydemeter', text: `Du har klatret ${fmtInt(a.up)} høydemeter i år – det er Galdhøpiggen ${fmtNum(a.up / 2469, 1)} ganger.`, range: [`${Y}-01-01`, today] })
  }

  // --- Denne måneden / siste 4 uker ---
  {
    const m0 = `${today.slice(0, 7)}-01`
    const a = sum(inR(m0, today)), b = sum(inR(`${Y - 1}${m0.slice(4)}`, `${Y - 1}${md}`))
    const mn = MONTHS_LONG[+today.slice(5, 7) - 1]
    if (b.n >= 3) add({ kind: 'trend', label: `${mn[0].toUpperCase()}${mn.slice(1)}`, text: `Så langt i ${mn} har du ${a.n} økter, mot ${b.n} på samme tid i ${mn} i fjor.`, sub: `${fmtHours(a.h * 3600)} mot ${fmtHours(b.h * 3600)}`, range: [m0, today] })
    const l4 = sum(inR(addDays(today, -27), today)), p4 = sum(inR(addDays(today, -55), addDays(today, -28)))
    if (p4.h > 0) add({ kind: 'trend', label: 'Siste 4 uker', text: `De siste fire ukene har du trent ${more(pct(l4.h, p4.h), 'mer', 'mindre')} ${than(pct(l4.h, p4.h))} de fire ukene før.`, sub: `${fmtHours(l4.h * 3600)} mot ${fmtHours(p4.h * 3600)}`, range: [addDays(today, -27), today] })
    const days30 = new Set(inR(addDays(today, -29), today).map((x) => dayKey(x.d))).size
    add({ kind: 'habit', label: 'Siste 30 dager', text: `Du har trent ${days30} av de siste 30 dagene.`, sub: days30 >= 25 ? 'Husk at hviledager også bygger form.' : days30 >= 18 ? 'Jevn og god rytme.' : undefined, range: [addDays(today, -29), today] })
  }

  // --- Største vekst blant idrettene ---
  {
    const g = sports.filter((sp) => NOUN[sp]).map((sp) => { const a = sum(inR(`${Y}-01-01`, today, sp)).h, b = sum(inR(`${Y - 1}-01-01`, `${Y - 1}${md}`, sp)).h; return { sp, a, b, d: a - b } }).filter((x) => x.b > 2)
    const up = [...g].sort((x, y) => y.d - x.d)[0]
    if (up && up.d > 3) add({ kind: 'trend', label: 'Størst vekst', text: `${NOUN[up.sp][0].toUpperCase()}${NOUN[up.sp].slice(1)} er idretten du har økt mest i år: ${fmtNum(up.d, 0)} timer mer enn i fjor på samme tid.`, range: [`${Y}-01-01`, today] })
    const share = sports.map((sp) => ({ sp, h: sum(inR(`${Y}-01-01`, today, sp)).h })).sort((x, y) => y.h - x.h)
    const tot = share.reduce((x, y) => x + y.h, 0)
    if (share[0] && tot > 0 && NOUN[share[0].sp]) add({ kind: 'habit', label: 'Hovedidrett', text: `${Math.round((share[0].h / tot) * 100)} % av treningstiden din i år har gått til ${NOUN[share[0].sp]}.`, range: [`${Y}-01-01`, today] })
  }

  // --- Vaner ---
  {
    const wd = WEEKDAYS.map(() => 0); for (const a of all) wd[(new Date(a.d).getDay() + 6) % 7]++
    const i = wd.indexOf(Math.max(...wd)); const lo = wd.indexOf(Math.min(...wd))
    const names = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']
    add({ kind: 'habit', label: 'Favorittdag', text: `${names[i][0].toUpperCase()}${names[i].slice(1)} er din mest aktive dag – ${Math.round((wd[i] / all.length) * 100)} % av alle økter.`, sub: `${names[lo][0].toUpperCase()}${names[lo].slice(1)} er dagen du trener minst.` })
    const morning = all.filter((a) => +a.d.slice(11, 13) < 9).length, evening = all.filter((a) => +a.d.slice(11, 13) >= 17).length
    add({ kind: 'habit', label: 'Døgnrytme', text: morning > evening ? `Morgenfugl: ${Math.round((morning / all.length) * 100)} % av øktene dine starter før klokka ni.` : `Kveldstrener: ${Math.round((evening / all.length) * 100)} % av øktene dine starter etter klokka fem.`, sub: `${Math.round((morning / all.length) * 100)} % før kl. 9 · ${Math.round((evening / all.length) * 100)} % etter kl. 17` })
    const st = longestStreak(all.map((a) => dayKey(a.d)))
    if (st.bestEnd < `${Y}-01-01`) add({ kind: 'record', label: 'Lengste serie', text: `Din lengste serie er ${st.best} dager på rad med trening.`, sub: `${fmtDate(st.bestStart)} – ${fmtDate(st.bestEnd)}`, range: [st.bestStart, st.bestEnd] })
    const names2 = new Map<string, number>(); for (const a of all) names2.set(a.n, (names2.get(a.n) ?? 0) + 1)
    const top = [...names2.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] >= 5) add({ kind: 'fun', label: 'Øktnavn', text: `«${top[0]}» er ditt mest brukte øktnavn – ${top[1]} ganger.` })
    const long = (f: string, t: string) => inR(f, t).filter((a) => a.mov >= 7200).length
    const l1 = long(`${Y}-01-01`, today), l0 = long(`${Y - 1}-01-01`, `${Y - 1}${md}`)
    if (l1 + l0 > 3) add({ kind: 'trend', label: 'Langøkter', text: `Du har ${l1} økter på over to timer i år, mot ${l0} på samme tid i fjor.`, range: [`${Y}-01-01`, today] })
  }

  // --- Beste uke / måned ---
  {
    const w = new Map<string, number>(); for (const a of all) { const k = bucketKey(a.d, 'week'); w.set(k, (w.get(k) ?? 0) + a.mov) }
    const bw = [...w.entries()].sort((a, b) => b[1] - a[1])[0]
    if (bw) { const [f, t] = bucketRange(bw[0], 'week'); add({ kind: 'record', label: 'Største uke', text: `Din største treningsuke var ${fmtHours(bw[1])}, uken som startet ${fmtDate(bw[0])}.`, range: [f, t] }) }
    const m = new Map<string, number>(); for (const a of all) { const k = bucketKey(a.d, 'month'); m.set(k, (m.get(k) ?? 0) + a.dist) }
    const bm = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    if (bm) { const [f, t] = bucketRange(bm[0], 'month'); add({ kind: 'record', label: 'Største måned', text: `${MONTHS_LONG[+bm[0].slice(5) - 1][0].toUpperCase()}${MONTHS_LONG[+bm[0].slice(5) - 1].slice(1)} ${bm[0].slice(0, 4)} er rekordmåneden din med ${fmtInt(bm[1] / 1000)} km.`, range: [f, t] }) }
  }

  // --- Rekorder og progresjon (løping) ---
  {
    const runs = all.filter((a) => a.t === 'Løpetur')
    for (const k of ['5k', '10k', 'hm']) {
      const c = runs.filter((a) => okBe(a, k)).sort((a, b) => (a.d < b.d ? -1 : 1))
      if (c.length < 3) continue
      const best = c.reduce((b, a) => (a.be![k][0] < b.be![k][0] ? a : b))
      const first = c[0]
      const gain = first.be![k][0] - best.be![k][0]
      add({ kind: 'record', label: `Rekord ${BE_LABELS[k]}`, text: `Din raskeste ${BE_LABELS[k].toLowerCase()} er ${fmtClock(best.be![k][0])}, satt ${fmtDate(best.d)}.`, sub: gain > 5 ? `${fmtClock(gain)} raskere enn din første registrerte ${BE_LABELS[k].toLowerCase()}.` : undefined, actId: best.id })
    }
    const recent = runs.filter((a) => a.d.slice(0, 10) >= addDays(today, -90))
    for (const k of Object.keys(BE_LABELS)) {
      const best = all.filter((a) => okBe(a, k) && a.t === 'Løpetur').reduce<Activity | undefined>((b, a) => (!b || a.be![k][0] < b.be![k][0] ? a : b), undefined)
      if (best && recent.includes(best)) add({ kind: 'record', label: 'Ny rekord', text: `Du satte ny personlig rekord på ${BE_LABELS[k].toLowerCase()} for mindre enn tre måneder siden: ${fmtClock(best.be![k][0])}.`, sub: best.n, actId: best.id })
    }
    const pace = (f: string, t: string) => { const r = inR(f, t, 'Løpetur').filter((a) => a.dist >= 3000 && a.mov > 0); const d = r.reduce((x, a) => x + a.dist, 0); return d ? r.reduce((x, a) => x + a.mov, 0) / (d / 1000) : 0 }
    const p1 = pace(`${Y}-01-01`, today), p0 = pace(`${Y - 1}-01-01`, `${Y - 1}-12-31`)
    if (p1 && p0 && Math.abs(p1 - p0) >= 3) add({ prio: true, kind: 'trend', label: 'Løpefart', text: `Snittpacen din på løpeturer er ${fmtPaceSec(Math.abs(p1 - p0)).replace(/^0:/, '')} sek/km ${p1 < p0 ? 'raskere' : 'tregere'} i år enn i fjor.`, sub: `${fmtPaceSec(p1)} /km mot ${fmtPaceSec(p0)} /km (turer ≥ 3 km). Terreng og føre påvirker.` })
    // VDOT-sammenligning ligger i thisYear()
  }

  // --- Helse / puls ---
  {
    const mh = all.filter((a) => a.mhr && a.mhr < 230).reduce<Activity | undefined>((b, a) => (!b || a.mhr! > b.mhr! ? a : b), undefined)
    if (mh) add({ kind: 'health', label: 'Makspuls', text: `Høyeste registrerte puls er ${fmtInt(mh.mhr!)} slag i minuttet.`, sub: `${mh.n} · ${fmtDate(mh.d)}`, actId: mh.id })
    const rhr = all.filter((a) => a.rhr).sort((a, b) => (a.d < b.d ? -1 : 1))
    if (rhr.length > 20) {
      const first = rhr.slice(0, 10).reduce((x, a) => x + a.rhr!, 0) / 10, last = rhr.slice(-10).reduce((x, a) => x + a.rhr!, 0) / 10
      if (Math.abs(first - last) >= 2) add({ kind: 'health', label: 'Hvilepuls', text: `Hvilepulsen i klokkeprofilen din har gått ${last < first ? 'ned' : 'opp'} fra rundt ${fmtInt(first)} til ${fmtInt(last)}.`, sub: 'Basert på verdien klokka lagrer ved hver økt.' })
    }
    const z = all.filter((a) => a.zones && a.d.slice(0, 10) >= `${Y}-01-01`).reduce((acc, a) => { a.zones!.forEach((v, i) => (acc[i] += v)); return acc }, [0, 0, 0, 0, 0, 0])
    const zt = z.reduce((x, y) => x + y, 0)
    if (zt > 3600 * 10) add({ kind: 'health', label: 'Intensitet', text: `${Math.round(((z[0] + z[1]) / zt) * 100)} % av pulsregistrert tid i år er i sone 1–2, og ${Math.round(((z[3] + z[4] + z[5]) / zt) * 100)} % i sone 4 og over.`, sub: 'Mye rolig og litt hardt er klassisk polarisert trening.' })
    const cold = all.filter((a) => a.temp != null).reduce<Activity | undefined>((b, a) => (!b || a.temp! < b.temp! ? a : b), undefined)
    if (cold && cold.temp! < -5 && cold.d < `${Y}-01-01`) add({ kind: 'fun', label: 'Kaldeste økt', text: `Den kaldeste økta di var i ${fmtInt(cold.temp!)} °C.`, sub: `${cold.n} · ${fmtDate(cold.d)}`, actId: cold.id })
  }

  // --- Moro med totaler ---
  {
    const t = sum(all)
    add({ kind: 'fun', label: 'Totalt', text: `Du har tilbakelagt ${fmtInt(t.km)} km siden ${fmtDate(all[0].d)} – nok til å gå Narvik–Oslo ${fmtNum(t.km / 1450, 1)} ganger.` })
    add({ kind: 'fun', label: 'Totalt', text: `Alle høydemeterne dine tilsvarer Mount Everest ${fmtNum(t.up / 8849, 1)} ganger.`, sub: `${fmtInt(t.up)} m stigning totalt` })
    const ly = all.filter((a) => a.d.startsWith(String(Y))).reduce<Activity | undefined>((b, a) => (!b || a.mov > b.mov ? a : b), undefined)
    if (ly) add({ prio: true, kind: 'record', label: `Lengste økt ${Y}`, text: `Årets lengste økt varte ${fmtHours(ly.mov)}.`, sub: `${ly.n} · ${fmtDate(ly.d)}`, actId: ly.id })
  }

  thisYear(all, today, inR, addP)

  // Alt som gjelder inneværende år prioriteres
  const y0 = `${Y}-01-01`
  return out.map((x) => (x.prio == null && x.range && x.range[0] >= y0 ? { ...x, prio: true } : x))
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const DAY = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']
const wdOf = (a: Activity) => (new Date(a.d).getDay() + 6) % 7

/** Innsikt om inneværende år, og inneværende år mot samme periode i fjor */
function thisYear(
  all: Activity[], today: string,
  inR: (f: string, t: string, sport?: string) => Activity[],
  add: (i: Omit<Insight, 'id' | 'prio'>) => void,
) {
  const Y = +today.slice(0, 4), P = Y - 1
  const md = today.slice(4)
  const y0 = `${Y}-01-01`, p0 = `${P}-01-01`, pT = `${P}${md}`, pEnd = `${P}-12-31`
  const ytd: [string, string] = [y0, today]
  const cur = inR(y0, today), prev = inR(p0, pT), prevFull = inR(p0, pEnd)
  if (cur.length < 10 || prev.length < 10) return
  const a = sum(cur), b = sum(prev), bf = sum(prevFull)
  const doy = daysBetween(y0, today) + 1, diy = daysBetween(y0, `${Y}-12-31`) + 1
  const SAME = 'samme periode i fjor'

  // Totaler hittil i år
  add({ kind: 'trend', label: 'Hittil i år', text: `Hittil i ${Y} har du tilbakelagt ${fmtInt(a.km)} km – ${more(pct(a.km, b.km), 'mer', 'mindre')} ${than(pct(a.km, b.km))} i ${SAME}.`, sub: `${fmtInt(a.km)} km mot ${fmtInt(b.km)} km per ${fmtDate(today)}`, range: ytd })
  add({ kind: 'trend', label: 'Hittil i år', text: `Du har logget ${a.n} økter hittil i år, mot ${b.n} i ${SAME}.`, sub: `${fmtNum(a.n / (doy / 7), 1)} økter per uke i snitt i år`, range: ytd })
  if (b.up > 1000) add({ kind: 'trend', label: 'Høydemeter', text: `${fmtInt(a.up)} høydemeter hittil i år er ${more(pct(a.up, b.up), 'flere', 'færre')} ${than(pct(a.up, b.up))} i ${SAME}.`, sub: `${fmtInt(b.up)} m på samme tid i ${P}`, range: ytd })
  {
    const la = cur.reduce((x, y) => x + y.load, 0), lb = prev.reduce((x, y) => x + y.load, 0)
    if (lb > 0 && Math.abs(pct(la, lb)) >= 10) add({ kind: 'trend', label: 'Belastning', text: `Samlet treningsbelastning hittil i år er ${more(pct(la, lb), 'høyere', 'lavere').replace('ganger så mye', 'ganger så høy')} ${than(pct(la, lb))} i ${SAME}.`, sub: `${fmtInt(la)} mot ${fmtInt(lb)} TRIMP`, range: ytd })
  }
  add({ kind: 'trend', label: 'Snitt per uke', text: `I ${Y} trener du i snitt ${fmtNum(a.h / (doy / 7), 1)} timer i uka, mot ${fmtNum(bf.h / 52.14, 1)} timer i ${P}.`, range: ytd })
  if (cur.length >= 20 && prev.length >= 20) {
    const la = (a.h * 60) / a.n, lb = (b.h * 60) / b.n
    if (Math.abs(la - lb) >= 3) add({ kind: 'habit', label: 'Øktlengde', text: `Øktene dine er ${la > lb ? 'lengre' : 'kortere'} i år: ${fmtInt(la)} minutter i snitt, mot ${fmtInt(lb)} minutter i ${P}.`, range: ytd })
  }

  // Mot hele fjoråret og prognose
  if (bf.km > 100) {
    if (a.km >= bf.km) add({ kind: 'record', label: `${Y} mot ${P}`, text: `Du har allerede passert hele ${P}: ${fmtInt(a.km)} km i år mot ${fmtInt(bf.km)} km i hele fjor.`, sub: `${fmtInt(a.km - bf.km)} km mer, med ${diy - doy} dager igjen av året`, range: ytd })
    else add({ kind: 'trend', label: `${Y} mot ${P}`, text: `Du har nådd ${Math.round((a.km / bf.km) * 100)} % av fjorårets distanse. ${fmtInt(bf.km - a.km)} km igjen for å slå ${P}.`, range: ytd })
  }
  if (bf.h > 20) {
    if (a.h >= bf.h) add({ kind: 'record', label: `${Y} mot ${P}`, text: `Du har allerede trent flere timer i ${Y} enn i hele ${P}.`, sub: `${fmtHours(a.h * 3600)} mot ${fmtHours(bf.h * 3600)}`, range: ytd })
    else add({ kind: 'trend', label: `${Y} mot ${P}`, text: `${fmtHours((bf.h - a.h) * 3600)} trening gjenstår for å slå fjorårets totale treningstid.`, sub: `${fmtHours(a.h * 3600)} så langt mot ${fmtHours(bf.h * 3600)} i hele ${P}`, range: ytd })
  }
  if (doy >= 60 && doy < diy) {
    const pk = (a.km / doy) * diy, ph = (a.h / doy) * diy
    add({ kind: 'trend', label: 'Prognose', text: `Med dagens tempo ender ${Y} på rundt ${fmtInt(Math.round(pk / 10) * 10)} km og ${fmtInt(ph)} timer.`, sub: `${P} endte på ${fmtInt(bf.km)} km og ${fmtInt(bf.h)} timer`, range: ytd })
  }

  // Per idrett
  for (const sp of Object.keys(PHRASE)) {
    const c = sum(inR(y0, today, sp)), p = sum(inR(p0, pT, sp)), f = sum(inR(p0, pEnd, sp))
    if (c.n >= 10 && f.n >= 5 && c.n > f.n) add({ kind: 'record', label: cap(NOUN[sp] ?? sp), text: `Du har allerede flere økter ${PHRASE[sp]} i ${Y} enn i hele ${P}.`, sub: `${c.n} økter i år mot ${f.n} i hele fjor`, range: ytd })
    if (sp !== 'Styrketrening' && sp !== 'Treningsøkt' && c.km > 50 && p.km > 50 && Math.abs(pct(c.km, p.km)) >= 15)
      add({ kind: 'trend', label: cap(NOUN[sp] ?? sp), text: `Du har ${more(pct(c.km, p.km), 'flere', 'færre')} kilometer ${PHRASE[sp]} hittil i år ${than(pct(c.km, p.km))} i ${SAME}.`, sub: `${fmtInt(c.km)} km mot ${fmtInt(p.km)} km`, range: ytd })
  }
  {
    const before = new Set(all.filter((x) => x.d < y0).map((x) => x.t))
    const fresh = [...new Set(cur.map((x) => x.t))].filter((t) => !before.has(t))
    if (fresh.length) add({ kind: 'fun', label: 'Nytt i år', text: `I ${Y} prøvde du noe nytt: ${fresh.join(', ').toLowerCase()}.`, range: ytd })
  }

  // Beste måned og uke i år
  {
    const by = (key: (x: Activity) => string, val: (x: Activity) => number) => { const m = new Map<string, number>(); for (const x of cur) m.set(key(x), (m.get(key(x)) ?? 0) + val(x)); return [...m.entries()].sort((x, y) => y[1] - x[1])[0] }
    const bm = by((x) => bucketKey(x.d, 'month'), (x) => x.mov)
    if (bm) {
      const km = cur.filter((x) => bucketKey(x.d, 'month') === bm[0]).reduce((s2, x) => s2 + x.dist, 0) / 1000
      add({ kind: 'record', label: `Beste måned ${Y}`, text: `${cap(MONTHS_LONG[+bm[0].slice(5) - 1])} er årets travleste måned målt i tid: ${fmtHours(bm[1])} trening.`, sub: `${fmtInt(km)} km`, range: bucketRange(bm[0], 'month') })
    }
    const bw = by((x) => bucketKey(x.d, 'week'), (x) => x.mov)
    if (bw) add({ kind: 'record', label: `Beste uke ${Y}`, text: `Årets tøffeste uke ga ${fmtHours(bw[1])} trening – uke ${isoWeek(bw[0]).w}.`, sub: `Uken som startet ${fmtDate(bw[0])}`, range: bucketRange(bw[0], 'week') })
    // Måneden med størst økning mot samme måned i fjor (kun hele måneder)
    let best: { m: number; d: number; h1: number; h0: number } | undefined
    for (let m = 1; m < +today.slice(5, 7); m++) {
      const mm = String(m).padStart(2, '0')
      const h1 = sum(inR(`${Y}-${mm}-01`, bucketRange(`${Y}-${mm}`, 'month')[1])).h, h0 = sum(inR(`${P}-${mm}-01`, bucketRange(`${P}-${mm}`, 'month')[1])).h
      if (h0 > 3 && (!best || h1 - h0 > best.d)) best = { m, d: h1 - h0, h1, h0 }
    }
    if (best && best.d > 3) add({ kind: 'trend', label: 'Største løft', text: `${cap(MONTHS_LONG[best.m - 1])} er måneden med størst fremgang: ${fmtInt(best.d)} timer mer enn i ${MONTHS_LONG[best.m - 1]} ${P}.`, sub: `${fmtHours(best.h1 * 3600)} mot ${fmtHours(best.h0 * 3600)}`, range: bucketRange(`${Y}-${String(best.m).padStart(2, '0')}`, 'month') })
  }

  // Årets største økter
  {
    const top = (f: (x: Activity) => number) => cur.reduce<Activity | undefined>((m, x) => (!m || f(x) > f(m) ? x : m), undefined)
    const far = top((x) => x.dist)
    if (far && far.dist > 0) add({ kind: 'record', label: `Lengste tur ${Y}`, text: `Årets lengste økt i distanse er ${fmtNum(far.dist / 1000, 1)} km.`, sub: `${far.n} · ${far.t} · ${fmtDate(far.d)}`, actId: far.id })
    const hard = top((x) => x.load)
    const longest = top((x) => x.mov)
    if (hard && hard.load > 0 && hard.id !== longest?.id) add({ kind: 'record', label: `Tøffeste økt ${Y}`, text: `Årets tøffeste økt målt i belastning ga ${fmtInt(hard.load)} TRIMP.`, sub: `${hard.n} · ${fmtHours(hard.mov)} · ${fmtDate(hard.d)}`, actId: hard.id })
    const climb = top((x) => x.up)
    if (climb && climb.up > 300) add({ kind: 'record', label: `Mest stigning ${Y}`, text: `Den bratteste økta i år hadde ${fmtInt(climb.up)} høydemeter.`, sub: `${climb.n} · ${fmtDate(climb.d)}`, actId: climb.id })
    const runs = cur.filter((x) => x.t === 'Løpetur')
    const lr = runs.reduce<Activity | undefined>((m, x) => (!m || x.dist > m.dist ? x : m), undefined)
    if (lr && lr.dist > 5000) add({ kind: 'record', label: `Lengste løpetur ${Y}`, text: `Årets lengste løpetur er ${fmtNum(lr.dist / 1000, 1)} km.`, sub: `${lr.n} · ${fmtDate(lr.d)}`, actId: lr.id })
  }

  // Løping: rekorder og effektivitet
  {
    const runsBefore = all.filter((x) => x.t === 'Løpetur' && x.d < y0)
    const runsNow = cur.filter((x) => x.t === 'Løpetur')
    const bestOf = (rs: Activity[], k: string) => rs.filter((x) => okBe(x, k)).reduce<Activity | undefined>((m, x) => (!m || x.be![k][0] < m.be![k][0] ? x : m), undefined)
    const newPr = Object.keys(BE_LABELS).filter((k) => { const n = bestOf(runsNow, k), o = bestOf(runsBefore, k); return n && (!o || n.be![k][0] < o.be![k][0]) })
    if (newPr.length) add({ kind: 'record', label: `Nye rekorder ${Y}`, text: newPr.length === 1 ? `Du har satt ny personlig rekord på ${BE_LABELS[newPr[0]].toLowerCase()} i ${Y}.` : `Du har satt ${newPr.length} nye personlige rekorder på løping i ${Y}.`, sub: newPr.map((k) => `${BE_LABELS[k]} ${fmtClock(bestOf(runsNow, k)!.be![k][0])}`).join(' · '), actId: newPr.length === 1 ? bestOf(runsNow, newPr[0])!.id : undefined, range: newPr.length === 1 ? undefined : ytd })
    const runsPrev = inR(p0, pEnd, 'Løpetur')
    for (const k of ['5k', '10k']) {
      const n = bestOf(runsNow, k), o = bestOf(runsPrev, k)
      if (n && o && Math.abs(n.be![k][0] - o.be![k][0]) >= 5) add({ kind: 'record', label: `${BE_LABELS[k]} ${Y} mot ${P}`, text: `Årets beste ${BE_LABELS[k].toLowerCase()} er ${fmtClock(n.be![k][0])} – ${fmtClock(Math.abs(n.be![k][0] - o.be![k][0]))} ${n.be![k][0] < o.be![k][0] ? 'raskere' : 'tregere'} enn fjorårets beste.`, sub: `${fmtClock(o.be![k][0])} i ${P} · satt ${fmtDate(n.d)}`, actId: n.id })
    }
    // Hjerteslag per km på løpeturer
    const bpk = (rs: Activity[]) => { const r = rs.filter((x) => x.hr && x.dist >= 3000 && x.mov > 0); const km = r.reduce((s2, x) => s2 + x.dist / 1000, 0); return { n: r.length, v: km ? r.reduce((s2, x) => s2 + (x.hr! * x.mov) / 60, 0) / km : 0, hr: r.length ? r.reduce((s2, x) => s2 + x.hr!, 0) / r.length : 0 } }
    const e1 = bpk(runsNow), e0 = bpk(inR(p0, pT, 'Løpetur'))
    if (e1.n >= 10 && e0.n >= 10 && Math.abs(e1.v - e0.v) / e0.v >= 0.03) add({ kind: 'health', label: 'Løpeøkonomi', text: `Du bruker ${fmtInt(Math.abs(e1.v - e0.v))} ${e1.v < e0.v ? 'færre' : 'flere'} hjerteslag per kilometer på løpeturer i år enn i ${SAME}.`, sub: `${fmtInt(e1.v)} mot ${fmtInt(e0.v)} slag/km · snittpuls ${fmtInt(e1.hr)} mot ${fmtInt(e0.hr)}`, range: ytd })
    const vd = (rs: Activity[]) => Math.max(0, ...rs.map((x) => METRIC.vdot.get(x) ?? 0))
    const v1 = vd(runsNow), v0 = vd(runsPrev)
    if (v1 && v0 && Math.abs(v1 - v0) >= 0.5) add({ kind: 'health', label: 'VO2 maks (estimat)', text: `Ditt beste VDOT-estimat i ${Y} er ${fmtNum(v1, 1)}, mot ${fmtNum(v0, 1)} i hele ${P}.`, sub: 'Beregnet fra raskeste harde innsats på 3–21 km. Et estimat, ikke en labtest.' })
  }

  // Vaner i år mot i fjor
  {
    const days = (rs: Activity[]) => new Set(rs.map((x) => dayKey(x.d))).size
    const d1 = days(cur), d0 = days(prev)
    add({ kind: 'habit', label: 'Aktive dager', text: `Du har trent ${d1} av ${doy} dager i år (${Math.round((d1 / doy) * 100)} %), mot ${d0} dager i ${SAME}.`, range: ytd })
    const s1 = longestStreak(cur.map((x) => dayKey(x.d))), s0 = longestStreak(prevFull.map((x) => dayKey(x.d)))
    const sAll = longestStreak(all.map((x) => dayKey(x.d)))
    if (s1.best >= 3) add({ kind: 'record', label: `Lengste serie ${Y}`, text: `Årets lengste serie er ${s1.best} dager på rad${s1.best >= sAll.best ? ' – din lengste noensinne' : ''}${s1.best > s0.best ? `, lengre enn noen serie i ${P} (${s0.best})` : s1.best === s0.best ? `, like lang som fjorårets beste` : `. Fjorårets beste var ${s0.best}`}.`, sub: `${fmtDate(s1.bestStart)} – ${fmtDate(s1.bestEnd)}`, range: [s1.bestStart, s1.bestEnd] })
    const dbl = (rs: Activity[]) => { const m = new Map<string, number>(); for (const x of rs) m.set(dayKey(x.d), (m.get(dayKey(x.d)) ?? 0) + 1); return [...m.values()].filter((v) => v >= 2).length }
    const db1 = dbl(cur), db0 = dbl(prev)
    if (db1 + db0 >= 5) add({ kind: 'habit', label: 'Dobbeløkter', text: `Du har hatt ${db1} dager med to eller flere økter i år, mot ${db0} i ${SAME}.`, range: ytd })
    const fav = (rs: Activity[]) => { const w = [0, 0, 0, 0, 0, 0, 0]; for (const x of rs) w[wdOf(x)]++; return w.indexOf(Math.max(...w)) }
    const f1 = fav(cur), f0 = fav(prevFull)
    add({ kind: 'habit', label: 'Favorittdag', text: f1 === f0 ? `${cap(DAY[f1])} er fortsatt favorittdagen din, akkurat som i ${P}.` : `${cap(DAY[f1])} har tatt over som favorittdag i ${Y}. I ${P} var det ${DAY[f0]}.`, range: ytd })
    const wk = (rs: Activity[]) => Math.round((rs.filter((x) => wdOf(x) >= 5).length / rs.length) * 100)
    const w1 = wk(cur), w0 = wk(prev)
    if (Math.abs(w1 - w0) >= 4) add({ kind: 'habit', label: 'Helg', text: `${w1} % av øktene i år er i helgene, mot ${w0} % i ${SAME}.`, sub: w1 < w0 ? 'Mer av treningen har flyttet seg til ukedagene.' : 'Mer av treningen har flyttet seg til helgene.', range: ytd })
    const mo = (rs: Activity[]) => Math.round((rs.filter((x) => +x.d.slice(11, 13) < 9).length / rs.length) * 100)
    const m1 = mo(cur), m0 = mo(prev)
    if (Math.abs(m1 - m0) >= 5) add({ kind: 'habit', label: 'Døgnrytme', text: `${m1} % av øktene i år starter før klokka ni, mot ${m0} % i ${SAME}.`, sub: m1 > m0 ? 'Du har blitt mer morgenfugl.' : 'Mer av treningen har flyttet seg utover dagen.', range: ytd })
    const g = new Map<string, number>(); for (const x of cur) if (x.gear) g.set(x.gear, (g.get(x.gear) ?? 0) + 1)
    const tg = [...g.entries()].sort((x, y) => y[1] - x[1])[0]
    if (tg && tg[1] >= 5) add({ kind: 'fun', label: 'Utstyr', text: `«${tg[0]}» er årets mest brukte utstyr, med på ${tg[1]} økter.`, range: ytd })
  }

  // Moro med årets tall
  {
    if (a.km > 2500) add({ kind: 'fun', label: 'Distanse', text: `${fmtInt(a.km)} km i år er ${fmtNum(a.km / 2500, 1)} ganger Lindesnes–Nordkapp.`, sub: 'Rundt 2 500 km langs veien', range: ytd })
    const cal = cur.reduce((x, y) => x + (y.cal ?? 0), 0)
    if (cal > 10000) add({ kind: 'fun', label: 'Kalorier', text: `Du har forbrent rundt ${fmtInt(cal)} kcal på trening i år – omtrent ${fmtInt(cal / 240)} Kvikk Lunsj.`, sub: 'Kaloritall fra klokka er grove anslag.', range: ytd })
    const temp = cur.filter((x) => x.temp != null)
    if (temp.length >= 10) {
      const lo = temp.reduce((m, x) => (x.temp! < m.temp! ? x : m)), hi = temp.reduce((m, x) => (x.temp! > m.temp! ? x : m))
      const coldest = all.filter((x) => x.temp != null).reduce((m, x) => (x.temp! < m.temp! ? x : m))
      if (lo.temp! <= -5) add({ kind: 'fun', label: `Kaldeste økt ${Y}`, text: `Årets kaldeste økt var i ${fmtInt(lo.temp!)} °C${lo.id === coldest.id ? ' – den kaldeste du har logget noensinne' : ''}.`, sub: `${lo.n} · ${fmtDate(lo.d)}`, actId: lo.id })
      if (hi.temp! >= 20) add({ kind: 'fun', label: `Varmeste økt ${Y}`, text: `Årets varmeste økt var i ${fmtInt(hi.temp!)} °C.`, sub: `${hi.n} · ${fmtDate(hi.d)}`, actId: hi.id })
    }
  }
}
