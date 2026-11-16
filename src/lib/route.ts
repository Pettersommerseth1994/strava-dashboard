/**
 * Enkel hash-ruting: #/<visning> og #/<visning>?a=<økt-id>.
 * Eldre lenker på formen #a=<økt-id> fungerer fortsatt.
 */
export type Route = { view: string; a: string | null }

export function readRoute(): Route {
  const h = location.hash
  return { view: h.match(/^#\/([a-z-]+)/)?.[1] ?? '', a: h.match(/[?&#]a=(\d+)/)?.[1] ?? null }
}

export const routeUrl = (view: string, a?: string | null) => `#/${view}${a ? `?a=${a}` : ''}`

/** Si fra til alle som lytter (visning og åpen økt) etter pushState/replaceState */
export const notifyRoute = () => window.dispatchEvent(new PopStateEvent('popstate'))
