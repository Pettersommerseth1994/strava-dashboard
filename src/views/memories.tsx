import { ChartCard } from '@/components/common'
import { Throwback } from './concepts/media/throwback'
import { MemoryCarousel } from './concepts/media/carousel'
import { MediaWall } from './concepts/media/wall'
import { Heatmap } from './concepts/map/heatmap'

/** Historie: tilbakeblikk, minnekarusell, rutekart og bildevegg */
export function Memories() {
  return (
    <div className="space-y-6">
      <ChartCard title="Tilbakeblikk" desc="Hva gjorde du på denne dagen i tidligere år? Bla dag for dag med pilene.">
        <Throwback />
      </ChartCard>
      <ChartCard title="Minnekarusell" desc="Bilder og videoer fra øktene, nyeste først · trykk play for å se videoen, trykk på kortet for å åpne økten">
        <MemoryCarousel />
      </ChartCard>
      <ChartCard title="Rutekart" desc="Alle rutene dine i ett kart · filtrer på idrett og år, trykk på en rute for å se økten · kartdata © OpenStreetMap">
        <Heatmap />
      </ChartCard>
      <ChartCard title="Bildevegg" desc="Alle bilder og videoer · trykk for å åpne i full størrelse">
        <MediaWall />
      </ChartCard>
    </div>
  )
}
