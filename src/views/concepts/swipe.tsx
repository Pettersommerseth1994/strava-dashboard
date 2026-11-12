import { Proposal } from '../lab/shared'
import { SwipeDeck } from './swipe/deck'
import { Bank } from './swipe/bank'
import { Builder } from './swipe/builder'
import { Quiz } from './swipe/quiz'
import { GhostDuel } from './swipe/ghost'

/** Sveip, øktbank og øktbygger – kun lokal forhåndsvisning */
export function SwipeConcepts() {
  return (
    <div className="space-y-6">
      <Proposal n={1} title="Øktsveip" desc="Bla gjennom tidligere økter som kort. Sveip til høyre for å lagre økten i banken, til venstre for å hoppe over, opp for favoritt.">
        <SwipeDeck />
      </Proposal>
      <Proposal n={2} title="Øktbanken" desc="Alt du har likt – med kart, data og nøkkeltall. Automatiske merkelapper og en smaksprofil over hva du liker.">
        <Bank />
      </Proposal>
      <Proposal n={3} title="Øktbyggeren" desc="Nye økter laget av banken: en progresjon, en miks av to likte økter og en restitusjonstur – med km-plan og foreslått rute.">
        <Builder />
      </Proposal>
      <Proposal n={4} title="Gjett økten" desc="Ti runder: se bare ruteformen og gjett hvilken økt det var. Hint koster poeng.">
        <Quiz />
      </Proposal>
      <Proposal n={5} title="Duell mot fortida" desc="Velg en likt økt som spøkelse og se km for km om en senere økt slo den.">
        <GhostDuel />
      </Proposal>
    </div>
  )
}
