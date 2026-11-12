import { FlaskConical } from 'lucide-react'
import { Proposal, YEAR } from './lab/shared'
import { Wrapped } from './lab/wrapped'
import { Goal } from './lab/goal'
import { Friends } from './lab/friends'

/** Gjenstående funksjonsforslag – kun lokal forhåndsvisning */
export function Lab() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-3">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
        <p className="text-muted-foreground text-sm">
          <b className="text-foreground">Forslag – lokal forhåndsvisning.</b> Forslag som ikke er tatt inn ennå. Kappløp mot i fjor ligger nå på Oversikt og Merker under Rekorder.
        </p>
      </div>
      <Proposal n={1} title={`Årsrevy ${YEAR}`} desc="Story-kort du blar gjennom som på Instagram – trykk, sveip eller la dem gå av seg selv.">
        <Wrapped />
      </Proposal>
      <Proposal n={2} title="Mål og fremdrift" desc="Sett et årsmål for kilometer eller timer og se om du er på kurs, prognose og hva som trengs per uke.">
        <Goal />
      </Proposal>
      <Proposal n={3} title="Venner – sammenlign deg" desc="Duell mot en venn: distanse, tid, økter, ukentlig volum og hvem som leder per idrett.">
        <Friends />
      </Proposal>
    </div>
  )
}
