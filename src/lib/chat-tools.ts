import type Anthropic from '@anthropic-ai/sdk'
import {
  type Activity, type Detail, BE_DIST, BE_LABELS, METRIC, bucketKey, dayKey, isFoot, sumBy, todayStr, WEEKDAYS,
} from '@/lib/data'

type BetaTool = Anthropic.Beta.Messages.BetaTool

const SORTS = ['date', 'distance', 'time', 'elevation', 'avg_hr', 'max_hr', 'pace', 'load', 'calories', 'vdot'] as const
const GROUPS = ['none', 'year', 'month', 'week', 'day', 'sport', 'weekday', 'hour'] as const

export function chatTools(sports: string[]): BetaTool[] {
  const common = {
    sport: { type: 'array', items: { type: 'string', enum: sports }, description: 'Idretter å ta med. Utelat for alle.' },
    from: { type: 'string', description: 'Fra og med dato, YYYY-MM-DD' },
    to: { type: 'string', description: 'Til og med dato, YYYY-MM-DD' },
    min_km: { type: 'number', description: 'Minste distanse i km' },
    max_km: { type: 'number', description: 'Største distanse i km' },
    name_contains: { type: 'string', description: 'Tekst som må finnes i øktnavnet (ikke skille på store/små bokstaver)' },
  }
  return [
    {
      name: 'query_activities',
      description: 'Søk etter enkeltøkter med filtre og sortering. Returnerer en liste med økter (id, dato, navn, idrett, km, bevegelsestid, pace/fart, høydemeter, snitt- og makspuls, kalorier, belastning) og totalt antall treff.',
      input_schema: {
        type: 'object',
        properties: {
          ...common,
          sort_by: { type: 'string', enum: [...SORTS], description: 'Sorteringsfelt. pace sorterer raskest først ved order=asc.' },
          order: { type: 'string', enum: ['asc', 'desc'] },
          limit: { type: 'integer', description: 'Maks antall økter (1–50, standard 10)' },
        },
      },
      eager_input_streaming: true,
    },
    {
      name: 'aggregate',
      description: 'Summer og gjennomsnitt over økter, gruppert etter år, måned, uke, dag, idrett, ukedag eller starttime. Returnerer per gruppe: antall økter, aktive dager, km, timer, høydemeter, kalorier, belastning (TRIMP), snittpuls (tidsvektet), høyeste makspuls og snittpace for løping/gåing (min/km) eller snittfart (km/t).',
      input_schema: {
        type: 'object',
        properties: { ...common, group_by: { type: 'string', enum: [...GROUPS], description: 'Gruppering, standard none' } },
      },
      eager_input_streaming: true,
    },
    {
      name: 'personal_bests',
      description: 'Raskeste sammenhengende innsats på en standarddistanse (1k, 1mi, 3k, 5k, 10k, 15k, hm, m) innenfor én økt. Kan filtreres på periode og idrett. Returnerer topplisten med tid, pace, snittpuls under innsatsen og økt-id.',
      input_schema: {
        type: 'object',
        properties: {
          distance: { type: 'string', enum: Object.keys(BE_LABELS) },
          sport: common.sport, from: common.from, to: common.to,
          limit: { type: 'integer', description: 'Antall (1–30, standard 5)' },
        },
        required: ['distance'],
      },
      eager_input_streaming: true,
    },
    {
      name: 'get_activity',
      description: 'Full detalj for én økt: alle nøkkeltall, pulssoner, beste innsatser og kilometersplitter (tid, puls, høydeendring per km).',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      eager_input_streaming: true,
    },
  ]
}

// ---------- utførelse ----------
type Input = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined)
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : [])
const r1 = (n: number) => Math.round(n * 10) / 10
const pace = (sec: number, m: number) => { const p = sec / (m / 1000); return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}` }

function filter(all: Activity[], i: Input) {
  const sp = arr(i.sport), f = str(i.from), t = str(i.to), mn = num(i.min_km), mx = num(i.max_km), q = str(i.name_contains)?.toLowerCase()
  return all.filter((a) => {
    const d = a.d.slice(0, 10)
    return (!sp.length || sp.includes(a.t)) && (!f || d >= f) && (!t || d <= t) && (mn == null || a.dist >= mn * 1000) && (mx == null || a.dist <= mx * 1000) && (!q || a.n.toLowerCase().includes(q))
  })
}
const row = (a: Activity) => ({
  id: a.id, dato: a.d.slice(0, 16).replace('T', ' '), navn: a.n, idrett: a.t, km: r1(a.dist / 1000), tid_min: Math.round(a.mov / 60),
  ...(a.dist > 500 ? (isFoot(a.t) ? { pace_min_km: pace(a.mov, a.dist) } : { fart_kmt: r1((a.dist / a.mov) * 3.6) }) : {}),
  hoydemeter: a.up, snittpuls: a.hr, makspuls: a.mhr, kcal: a.cal, belastning: Math.round(a.load),
})

export async function runTool(name: string, input: Input, all: Activity[]): Promise<string> {
  if (name === 'query_activities') {
    const rows = filter(all, input)
    const key = (str(input.sort_by) ?? 'date') as (typeof SORTS)[number]
    const get: Record<string, (a: Activity) => number> = {
      date: (a) => +new Date(a.d), distance: (a) => a.dist, time: (a) => a.mov, elevation: (a) => a.up, avg_hr: (a) => a.hr ?? -1, max_hr: (a) => a.mhr ?? -1,
      pace: (a) => (a.dist > 500 && a.mov ? a.mov / a.dist : Infinity), load: (a) => a.load, calories: (a) => a.cal ?? -1, vdot: (a) => METRIC.vdot.get(a) ?? -1,
    }
    const g = get[key] ?? get.date
    const dir = (str(input.order) ?? (key === 'pace' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
    const lim = Math.min(50, Math.max(1, Math.round(num(input.limit) ?? 10)))
    const sorted = [...rows].sort((a, b) => (g(a) - g(b)) * dir)
    return JSON.stringify({ treff: rows.length, okter: sorted.slice(0, lim).map(row) })
  }
  if (name === 'aggregate') {
    const rows = filter(all, input)
    const gb = (str(input.group_by) ?? 'none') as (typeof GROUPS)[number]
    const keyOf = (a: Activity) => gb === 'none' ? 'alle' : gb === 'sport' ? a.t : gb === 'weekday' ? WEEKDAYS[(new Date(a.d).getDay() + 6) % 7] : gb === 'hour' ? a.d.slice(11, 13) : bucketKey(a.d, gb)
    const groups = new Map<string, Activity[]>()
    for (const a of rows) { const k = keyOf(a); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(a) }
    const out = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-120).map(([k, v]) => {
      const s = sumBy(v)
      const hrw = v.filter((a) => a.hr), hrT = hrw.reduce((x, a) => x + a.mov, 0)
      const foot = v.filter((a) => isFoot(a.t) && a.dist > 500), other = v.filter((a) => !isFoot(a.t) && a.dist > 500)
      const fd = foot.reduce((x, a) => x + a.dist, 0), ft = foot.reduce((x, a) => x + a.mov, 0)
      const od = other.reduce((x, a) => x + a.dist, 0), ot = other.reduce((x, a) => x + a.mov, 0)
      return {
        gruppe: k, okter: s.count, aktive_dager: new Set(v.map((a) => dayKey(a.d))).size, km: r1(s.dist / 1000), timer: r1(s.mov / 3600), hoydemeter: s.up,
        kcal: Math.round(s.cal), belastning: Math.round(s.load),
        ...(hrT ? { snittpuls: Math.round(hrw.reduce((x, a) => x + a.hr! * a.mov, 0) / hrT) } : {}),
        ...(v.some((a) => a.mhr && a.mhr < 230) ? { makspuls: Math.max(...v.map((a) => (a.mhr && a.mhr < 230 ? a.mhr : 0))) } : {}),
        ...(fd ? { snittpace_lop_gang: pace(ft, fd) } : {}), ...(od ? { snittfart_andre_kmt: r1((od / ot) * 3.6) } : {}),
      }
    })
    return JSON.stringify({ treff: rows.length, grupper: out })
  }
  if (name === 'personal_bests') {
    const k = str(input.distance) ?? '5k'
    if (!BE_DIST[k]) throw new Error('Ukjent distanse')
    const rows = filter(all, { ...input, sport: arr(input.sport).length ? input.sport : ['Løpetur'] }).filter((a) => a.be?.[k])
    const lim = Math.min(30, Math.max(1, Math.round(num(input.limit) ?? 5)))
    const top = rows.sort((a, b) => a.be![k][0] - b.be![k][0]).slice(0, lim)
    return JSON.stringify({ distanse: BE_LABELS[k], okter_med_innsats: rows.length, topp: top.map((a) => ({ id: a.id, dato: a.d.slice(0, 10), navn: a.n, idrett: a.t, tid_sek: Math.round(a.be![k][0]), pace_min_km: pace(a.be![k][0], BE_DIST[k]), snittpuls_under_innsats: a.be![k][1] })) })
  }
  if (name === 'get_activity') {
    const id = str(input.id)
    const a = all.find((x) => x.id === id)
    if (!a) throw new Error(`Fant ingen økt med id ${id}`)
    let det: Detail | null = null
    if (a.det) { try { det = await (await fetch(`${import.meta.env.BASE_URL}act/${a.id}.json`)).json() } catch { det = null } }
    const be = a.be ? Object.fromEntries(Object.entries(a.be).map(([k, [s, h]]) => [BE_LABELS[k], { tid_sek: Math.round(s), pace: pace(s, BE_DIST[k]), snittpuls: h }])) : undefined
    return JSON.stringify({
      ...row(a), medgatt_tid_min: Math.round(a.el / 60), hoydetap: a.down, kadens: a.cad, watt: a.w, steglengde_m: a.stride, temperatur: a.temp, utstyr: a.gear,
      aerob_treningseffekt: a.te, anaerob_treningseffekt: a.ate, hvilepuls_profil: a.rhr, vdot_estimat: METRIC.vdot.get(a) ?? undefined,
      pulssoner_sek: a.zones, beste_innsatser: be,
      km_splitter: det?.splits?.map(([s, h, e], i) => ({ km: i + 1, tid_sek: Math.round(s), puls: h, hoydeendring: e })),
    })
  }
  throw new Error(`Ukjent verktøy: ${name}`)
}

export function systemPrompt(all: Activity[]) {
  const counts = new Map<string, number>(); for (const a of all) counts.set(a.t, (counts.get(a.t) ?? 0) + 1)
  return `Du er treningsanalytikeren i Magnus sitt personlige treningsdashboard (data fra Strava-eksport, Garmin-klokke).
Svar alltid på norsk bokmål, vennlig, konkret og kort (helst under 150 ord) med mindre brukeren ber om mer.

Data: ${all.length} økter fra ${all[0].d.slice(0, 10)} til ${all[all.length - 1].d.slice(0, 10)}.
Idretter: ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(', ')}.

Regler:
- Hent alle tall med verktøyene. Ikke gjett eller regn i hodet når et verktøy kan svare; kombiner gjerne flere kall (f.eks. aggregate for to år).
- Ved sammenligninger: oppgi begge tallene og endringen i prosent.
- «Hittil i år» betyr fra 1. januar til dagens dato; sammenlign med samme datoer året før.
- Når du nevner en bestemt økt, lenk den slik: [øktnavn](#a=ØKT-ID). Lenken åpner økten i dashboardet.
- Bruk korte avsnitt og punktlister, ikke tabeller.
- Tolk forsiktig: belastning er et TRIMP-estimat fra puls og tid; VO2 maks er et VDOT-estimat fra beste harde innsats (ikke Garmins tall); hvilepuls er verdien klokka har i profilen; pace påvirkes av terreng og føre (spesielt langrenn/rulleski).
- Du gir ikke medisinske diagnoser. Ved spørsmål om skade eller sykdom, råd til å snakke med helsepersonell.
- Distanser er i km, tider er bevegelsestid.`
}

export const todayLine = () => `Dagens dato er ${todayStr()}.`
