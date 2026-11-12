import { FlaskConical } from 'lucide-react'
import { Proposal, YEAR } from './lab/shared'
import { Wrapped } from './lab/wrapped'
import { Goal } from './lab/goal'
import { Race } from './lab/race'
import { Badges } from './lab/badges'
import { Friends } from './lab/friends'

/** Fem funksjonsforslag – kun lokal forhåndsvisning */
export function Lab() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-3">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
        <p className="text-muted-foreground text-sm">
          <b className="text-foreground">Forslag – lokal forhåndsvisning.</b> Fem nye funksjoner bygget på dine ekte data. Velg de du vil ha med, så flyttes de inn i dashboardet.
        </p>
      </div>
      <Proposal n={1} title={`Årsrevy ${YEAR}`} desc="Story-kort du blar gjennom som på Instagram – trykk, sveip eller la dem gå av seg selv.">
        <Wrapped />
      </Proposal>
      <Proposal n={2} title="Mål og fremdrift" desc="Sett et årsmål for kilometer eller timer og se om du er på kurs, prognose og hva som trengs per uke.">
        <Goal />
      </Proposal>
      <Proposal n={3} title="Kappløp mot i fjor" desc={`Akkumulert treningsmengde gjennom året – ${YEAR} mot ${YEAR - 1} og ${YEAR - 2} på samme dato.`}>
        <Race />
      </Proposal>
      <Proposal n={4} title="Merker" desc="Prestasjoner som låses opp automatisk fra treningsdataene. Trykk på et merke for detaljer.">
        <Badges />
      </Proposal>
      <Proposal n={5} title="Venner – sammenlign deg" desc="Duell mot en venn: distanse, tid, økter, ukentlig volum og hvem som leder per idrett.">
        <Friends />
      </Proposal>
    </div>
  )
}
