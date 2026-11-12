/**
 * Minner: bilder, videoer og kartspor som er publisert under public/minner/
 * (lages av scripts/build-local.py + scripts/build-memories.py).
 * Kartsporene er allerede trimmet med personvernsone (400 m i hver ende) før publisering.
 */
import { useEffect, useState } from 'react'

export type MediaItem = { f: string; k: 'img' | 'vid'; w?: number; h?: number }
export type MediaMap = Record<string, MediaItem[]>
export type LatLon = [number, number]
export type TrackMap = Record<string, LatLon[]>

const BASE = `${import.meta.env.BASE_URL}minner/`
const isVid = (f: string) => /\.(mp4|mov)$/i.test(f)

/** Full fil: bilde (maks 1600 px) eller video (640 px) */
export const mediaUrl = (f: string) => `${BASE}${isVid(f) ? 'vid' : 'img'}/${encodeURIComponent(f)}`
/** Lite bilde (480 px) – bruk i rutenett og karuseller */
export const thumbUrl = (f: string) => (isVid(f) ? posterUrl(f) : `${BASE}thumb/${encodeURIComponent(f)}`)
/** Plakatbilde for en video */
export const posterUrl = (f: string) => `${BASE}poster/${encodeURIComponent(f.replace(/\.[^.]+$/, '.jpg'))}`
/** @deprecated bruk posterUrl – beholdt for eldre konsepter */
export const posterSrc = (f: string) => `${mediaUrl(f)}#t=0.5`

let mediaP: Promise<MediaMap> | null = null
let tracksP: Promise<TrackMap> | null = null
const get = <T,>(f: string): Promise<T> => fetch(`${BASE}${f}`).then((r) => (r.ok ? r.json() : {}) as Promise<T>).catch(() => ({}) as T)
const loadMedia = () => (mediaP ??= get<MediaMap>('media.json'))
const loadTracks = () => (tracksP ??= get<TrackMap>('tracks.json'))

/** Bare bildene og videoene (liten fil) – brukes av varselet i fanen */
export function useMedia() {
  const [m, setM] = useState<MediaMap | null>(null)
  useEffect(() => { let on = true; loadMedia().then((x) => on && setM(x)); return () => { on = false } }, [])
  return m
}

/** Henter media.json og tracks.json én gang og deler dem mellom komponentene */
export function useLocalData() {
  const [d, setD] = useState<{ media: MediaMap; tracks: TrackMap } | null>(null)
  useEffect(() => { let on = true; Promise.all([loadMedia(), loadTracks()]).then(([media, tracks]) => on && setD({ media, tracks })); return () => { on = false } }, [])
  return d
}

/** Avstand i meter mellom to punkter */
export function meters(a: LatLon, b: LatLon) {
  const R = 6371000, r = Math.PI / 180
  const dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Personvernsone: fjerner de første og siste `m` meterne av et spor */
export function trimPrivacy(pts: LatLon[], m = 400): LatLon[] {
  if (pts.length < 4) return pts
  let i = 0, acc = 0
  while (i < pts.length - 1 && acc < m) { acc += meters(pts[i], pts[i + 1]); i++ }
  let j = pts.length - 1; acc = 0
  while (j > i && acc < m) { acc += meters(pts[j], pts[j - 1]); j-- }
  return j - i >= 2 ? pts.slice(i, j + 1) : []
}

/**
 * Kartfliser fra OpenStreetMap (krever ingen nøkkel). CARTO krever nå API-nøkkel.
 * Mørk modus lages med CSS-filter på flisene (se .map-dark i concepts.tsx).
 */
export const TILES = {
  dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}
