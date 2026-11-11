const BASE = import.meta.env.BASE_URL

export function InsyteLogo({ className = 'h-[22px]' }: { className?: string }) {
  return <img src={`${BASE}insyte-logo.png`} alt="Insyte" width={202} height={48} className={`${className} w-auto shrink-0 select-none dark:invert`} draggable={false} />
}

export type BrandMeta = { name: string; since: string; count: string }

/** Logo og profilbrikke øverst til venstre */
export function Brand({ m }: { m: BrandMeta }) {
  const parts = m.name.split(' ')
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  return (
    <div className="flex min-w-0 items-center gap-4">
      <InsyteLogo />
      <div className="hidden min-w-0 items-center gap-2.5 rounded-full border py-1 pr-3.5 pl-1 sm:flex">
        <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold">{initials}</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-medium">{m.name}</p>
          <p className="text-muted-foreground truncate text-[10.5px] tabular-nums">{m.count} · siden {m.since}</p>
        </div>
      </div>
    </div>
  )
}
