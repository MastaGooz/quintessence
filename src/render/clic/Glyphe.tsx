/** Une petite pièce avec la bosse d'une forme : la forme se reconnaît avant d'acheter, et dit quelle sorte de matière va avec. */
import type { ReactElement } from 'react'
import { NOMS_FORMES } from '../../ui/noms-clic.ts'
import { boite, cheminDecoupe, cotesDuModule } from './pieces.ts'

const ENCOCHE_GLYPHE = { largeur: 11, profondeur: 7 }
const BOITE_GLYPHE = boite(14, 10, ENCOCHE_GLYPHE)
const CHEMINS = [0, 1, 2, 3].map((forme) => cheminDecoupe(14, 10, cotesDuModule(forme), ENCOCHE_GLYPHE))

/** Une teinte par forme : horloge, ajout, multiplicateur, critique. En attendant l'habillage. */
export const TEINTES: readonly number[] = [205, 130, 35, 320]

export function Glyphe({ forme, classe = '' }: { forme: number; classe?: string }): ReactElement {
  return (
    <svg
      className={`glyphe-forme${classe === '' ? '' : ` ${classe}`}`}
      viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`}
      style={{ '--teinte': TEINTES[forme] ?? 0 } as React.CSSProperties}
      aria-label={NOMS_FORMES[forme]}
    >
      <path d={CHEMINS[forme] ?? ''} />
    </svg>
  )
}
