import { Proposal } from '../lab/shared'
import { Heatmap } from './map/heatmap'
import { ColoredSession } from './map/colored'
import { Replay } from './map/replay'
import { GhostRace } from './map/ghost'
import { Territory } from './map/territory'

/** Fem kartkonsepter – kun lokal forhåndsvisning (GPS-spor publiseres aldri) */
export function MapConcepts() {
  return (
    <div className="space-y-6">
      <Proposal n={1} title="Varmekart over alle ruter" desc="Alle rutene dine i ett kart. Filtrer på idrett og år, trykk på en rute for å se økten.">
        <Heatmap />
      </Proposal>
      <Proposal n={2} title="Øktkart med fargekoding" desc="Velg en økt og se ruta farget etter pace, puls eller høyde, med kilometermerker og høydeprofil.">
        <ColoredSession />
      </Proposal>
      <Proposal n={3} title="Tilbakeblikk – gjenopplev økten" desc="Spill av en tidligere økt på kartet med tid, distanse, pace og puls. «For ett år siden», «På denne dagen» eller et tilfeldig minne.">
        <Replay />
      </Proposal>
      <Proposal n={4} title="Spøkelsesløp" desc="Ruter du har gått flere ganger. Velg to økter og se dem løpe mot hverandre – hvem leder, og med hvor mye?">
        <GhostRace />
      </Proposal>
      <Proposal n={5} title="Erobrede ruter" desc="Kartet delt i ruter på 1 × 1 km. Se hvor mye du har utforsket, største klynge, største kvadrat og nye ruter i år.">
        <Territory />
      </Proposal>
    </div>
  )
}
