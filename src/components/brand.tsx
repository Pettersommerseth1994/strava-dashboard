import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Insyte-logoen: et tynt pluss med to buede innerhjørner, skåret ut av en avrundet firkant.
 * Merket tegnes som SVG, så det er skarpt i alle størrelser og følger tekstfargen.
 * Samme form ligger i public/favicon.svg.
 */
const PLUS = 'M17.4 8H22.6A9.4 9.4 0 0 0 32 17.4V22.6H22.6V32H17.4A9.4 9.4 0 0 0 8 22.6V17.4H17.4Z'

/** Bare merket */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" className={cn('size-6 shrink-0', className)} aria-hidden="true">
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
        <rect width="40" height="40" rx="8" fill="#fff" />
        <path d={PLUS} fill="#000" />
      </mask>
      <rect width="40" height="40" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/** Merke + ordmerke */
export function InsyteLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 select-none', className)} role="img" aria-label="Insyte">
      <LogoMark className="size-[26px]" />
      <span className="text-[21px] leading-none font-bold tracking-[-0.03em]">Insyte</span>
    </span>
  )
}
