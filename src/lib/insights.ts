import {
  type Activity, BE_LABELS, METRIC, WEEKDAYS, addDays, bucketKey, bucketRange, dayKey, fmtClock, fmtDate, fmtHours, fmtInt, fmtNum, fmtPaceSec,
  longestStreak, MONTHS_LONG, todayStr,
} from '@/lib/data'

export type Insight = {
  id: string
  kind: 'trend' | 'record' | 'habit' | 'fun' | 'health'
  label: string
  text: string
  sub?: string
  actId?: string
  range?: [string, string]
}

const PHRASE: Record<string, string> = {
  Løpetur: 'med løping', Langrenn: 'på langrenn', Rulleski: 'på rulleski', Sykkeltur: 'på sykkel',
  Styrketrening: 'med styrketrening', Treningsøkt: 'med andre treningsøkter', Gåtur: 'med gåturer',
}
const NOUN: Record<string, string> = {
  Løpetur: 'løping', Langrenn: 'langrenn', Rulleski: 'rulleski', Sykkeltur: 'sykling', Styrketrening: 'styrketrening', Treningsøkt: 'treningsøkter',
}
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
    add({ kind: 'record', label: 'Lengste serie', text: `Din lengste serie er ${st.best} dager på rad med trening.`, sub: `${fmtDate(st.bestStart)} – ${fmtDate(st.bestEnd)}`, range: [st.bestStart, st.bestEnd] })
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
      const c = runs.filter((a) => a.be?.[k]).sort((a, b) => (a.d < b.d ? -1 : 1))
      if (c.length < 3) continue
      const best = c.reduce((b, a) => (a.be![k][0] < b.be![k][0] ? a : b))
      const first = c[0]
      const gain = first.be![k][0] - best.be![k][0]
      add({ kind: 'record', label: `Rekord ${BE_LABELS[k]}`, text: `Din raskeste ${BE_LABELS[k].toLowerCase()} er ${fmtClock(best.be![k][0])}, satt ${fmtDate(best.d)}.`, sub: gain > 5 ? `${fmtClock(gain)} raskere enn din første registrerte ${BE_LABELS[k].toLowerCase()}.` : undefined, actId: best.id })
    }
    const recent = runs.filter((a) => a.d.slice(0, 10) >= addDays(today, -90))
    for (const k of Object.keys(BE_LABELS)) {
      const best = all.filter((a) => a.be?.[k] && a.t === 'Løpetur').reduce<Activity | undefined>((b, a) => (!b || a.be![k][0] < b.be![k][0] ? a : b), undefined)
      if (best && recent.includes(best)) add({ kind: 'record', label: 'Ny rekord', text: `Du satte ny personlig rekord på ${BE_LABELS[k].toLowerCase()} for mindre enn tre måneder siden: ${fmtClock(best.be![k][0])}.`, sub: best.n, actId: best.id })
    }
    const pace = (f: string, t: string) => { const r = inR(f, t, 'Løpetur').filter((a) => a.dist >= 3000 && a.mov > 0); const d = r.reduce((x, a) => x + a.dist, 0); return d ? r.reduce((x, a) => x + a.mov, 0) / (d / 1000) : 0 }
    const p1 = pace(`${Y}-01-01`, today), p0 = pace(`${Y - 1}-01-01`, `${Y - 1}-12-31`)
    if (p1 && p0 && Math.abs(p1 - p0) >= 3) add({ kind: 'trend', label: 'Løpefart', text: `Snittpacen din på løpeturer er ${fmtPaceSec(Math.abs(p1 - p0)).replace(/^0:/, '')} sek/km ${p1 < p0 ? 'raskere' : 'tregere'} i år enn i fjor.`, sub: `${fmtPaceSec(p1)} /km mot ${fmtPaceSec(p0)} /km (turer ≥ 3 km). Terreng og føre påvirker.` })
    const vd = (f: string, t: string) => Math.max(0, ...inR(f, t, 'Løpetur').map((a) => METRIC.vdot.get(a) ?? 0))
    const v1 = vd(addDays(today, -180), today), v0 = vd(addDays(today, -545), addDays(today, -365))
    if (v1 && v0) add({ kind: 'health', label: 'VO2 maks (estimat)', text: `Ditt beste VDOT-estimat siste halvår er ${fmtNum(v1, 1)}, mot ${fmtNum(v0, 1)} samme periode året før.`, sub: 'Beregnet fra raskeste harde innsats på 3–21 km.' })
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
    if (cold && cold.temp! < -5) add({ kind: 'fun', label: 'Kaldeste økt', text: `Den kaldeste økta di var i ${fmtInt(cold.temp!)} °C.`, sub: `${cold.n} · ${fmtDate(cold.d)}`, actId: cold.id })
  }

  // --- Moro med totaler ---
  {
    const t = sum(all)
    add({ kind: 'fun', label: 'Totalt', text: `Du har tilbakelagt ${fmtInt(t.km)} km siden ${fmtDate(all[0].d)} – nok til å gå Narvik–Oslo ${fmtNum(t.km / 1450, 1)} ganger.` })
    add({ kind: 'fun', label: 'Totalt', text: `Alle høydemeterne dine tilsvarer Mount Everest ${fmtNum(t.up / 8849, 1)} ganger.`, sub: `${fmtInt(t.up)} m stigning totalt` })
    const ly = all.filter((a) => a.d.startsWith(String(Y))).reduce<Activity | undefined>((b, a) => (!b || a.mov > b.mov ? a : b), undefined)
    if (ly) add({ kind: 'record', label: `Lengste økt ${Y}`, text: `Årets lengste økt varte ${fmtHours(ly.mov)}.`, sub: `${ly.n} · ${fmtDate(ly.d)}`, actId: ly.id })
  }
  return out
}
