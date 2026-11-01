/** Une petite pièce avec la bosse d'une forme, teintée d'une couleur : une sorte de matière se reconnaît d'un coup d'œil, et un module aussi. */
import type { CSSProperties, ReactElement } from 'react'
import { NOMS_FORMES, nomSorte } from '../../ui/noms-clic.ts'
import { couleurDe, formeDe, sorteDe } from '../../logic/clic/donnees.ts'
import { boite, cheminDecoupe, cotesDuModule } from './pieces.ts'

const ENCOCHE_GLYPHE = { largeur: 11, profondeur: 7 }
const BOITE_GLYPHE = boite(14, 10, ENCOCHE_GLYPHE)
const CHEMINS = [0, 1, 2, 3].map((forme) => cheminDecoupe(14, 10, cotesDuModule(forme), ENCOCHE_GLYPHE))

/** Une teinte par couleur : rouge, vert, bleu, jaune, cyan, violet. */
export const TEINTES: readonly number[] = [4, 130, 215, 52, 182, 282]

export function Glyphe({ couleur, forme, classe = '' }: { couleur: number; forme: number; classe?: string }): ReactElement {
  return (
    <svg
      className={`glyphe-forme${classe === '' ? '' : ` ${classe}`}`}
      viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`}
      style={{ '--teinte': TEINTES[couleur] ?? 0 } as CSSProperties}
      aria-label={nomSorte(sorteDe(couleur, forme))}
    >
      <path d={CHEMINS[forme] ?? ''} />
    </svg>
  )
}

/** Le glyphe d'une sorte. */
export function GlypheSorte({ sorte, classe }: { sorte: number; classe?: string }): ReactElement {
  return <Glyphe couleur={couleurDe(sorte)} forme={formeDe(sorte)} classe={classe} />
}

/** Le glyphe d'une forme seule, sans couleur : un creux, qui prend n'importe quelle couleur de sa forme. */
export function GlypheForme({ forme, classe = '' }: { forme: number; classe?: string }): ReactElement {
  return (
    <svg className={`glyphe-forme glyphe-neutre${classe === '' ? '' : ` ${classe}`}`} viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`} aria-label={NOMS_FORMES[forme]}>
      <path d={CHEMINS[forme] ?? ''} />
    </svg>
  )
}
