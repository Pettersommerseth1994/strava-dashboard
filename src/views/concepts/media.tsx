import { Proposal } from '../lab/shared'
import { MemoryCarousel } from './media/carousel'
import { Throwback } from './media/throwback'
import { MediaWall } from './media/wall'
import { MonthStories } from './media/stories'
import { ShareCard } from './media/share-card'

/** Fem konsepter for bilder og videoer fra øktene – kun lokal forhåndsvisning */
export function MediaConcepts() {
  return (
    <div className="space-y-6">
      <Proposal n={1} title="Minnekarusell" desc="Bilder og videoer i sitt eget format. Trykk play for å se videoen, trykk på kortet for å åpne økten.">
        <MemoryCarousel />
      </Proposal>
      <Proposal n={2} title="Tilbakeblikk – på denne dagen" desc="Minner fra samme dato i tidligere år. Bla dag for dag, eller se de nærmeste minnene når dagen er tom.">
        <Throwback />
      </Proposal>
      <Proposal n={3} title="Bildevegg med lysboks" desc="Alle bilder og videoer i et murverk, filtrert på år, idrett og type. Lysboksen kan sveipes og viser tallene fra økten.">
        <MediaWall />
      </Proposal>
      <Proposal n={4} title="Månedsstories" desc="Hver måned som en story: først nøkkeltallene, så månedens bilder og videoer. Trykk, sveip eller la den gå av seg selv.">
        <MonthStories />
      </Proposal>
      <Proposal n={5} title="Delbart minnekort" desc="Velg et bilde og en stil, så legges tallene fra økten oppå. Last ned som PNG og del på Instagram eller Strava.">
        <ShareCard />
      </Proposal>
    </div>
  )
}
