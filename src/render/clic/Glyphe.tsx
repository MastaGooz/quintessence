/**
 * LES SIGNES des couleurs et des formes. Une RESSOURCE se dessine par sa forme
 * pleine, de sa couleur : un rond, un carré, un triangle, un losange
 * (`Symbole`). Un MODULE, lui, est une pièce à une bosse : la petite pièce
 * (`Glyphe`) le dit (Keko, 01/11 : « chaque ressource a la forme carré,
 * losange, rond ou triangle ; les modules et les ressources sont deux choses
 * différentes »).
 */
import type { CSSProperties, ReactElement } from 'react'
import { NOMS_FORMES, nomSorte } from '../../ui/noms-clic.ts'
import { couleurDe, formeDe, sorteDe } from '../../logic/clic/donnees.ts'
import { boite, cheminDecoupe, cotesDuModule } from './pieces.ts'

/** Une teinte par couleur : rouge, vert, bleu, jaune, cyan, violet. */
export const TEINTES: readonly number[] = [4, 130, 215, 52, 182, 282]

/** Les formes pleines, dans un carré de 20 : rond, carré, triangle, losange. */
const FORMES_PLEINES: readonly string[] = ['M 10 1.5 A 8.5 8.5 0 1 1 9.99 1.5 Z', 'M 2.5 2.5 H 17.5 V 17.5 H 2.5 Z', 'M 10 1.5 L 19 17.5 H 1 Z', 'M 10 0.5 L 19.5 10 L 10 19.5 L 0.5 10 Z']

/** Le symbole d'une ressource : sa forme pleine, de sa couleur ; sans couleur, un creux (il prend n'importe quelle couleur de sa forme). */
export function Symbole({ couleur, forme, classe = '' }: { couleur: number | null; forme: number; classe?: string }): ReactElement {
  return (
    <svg
      className={`symbole${couleur === null ? ' symbole-neutre' : ''}${classe === '' ? '' : ` ${classe}`}`}
      viewBox="0 0 20 20"
      style={couleur === null ? undefined : ({ '--teinte': TEINTES[couleur] ?? 0 } as CSSProperties)}
      aria-label={couleur === null ? NOMS_FORMES[forme] : nomSorte(sorteDe(couleur, forme))}
    >
      <path d={FORMES_PLEINES[forme] ?? ''} />
    </svg>
  )
}

/** Le symbole d'une sorte. */
export function SymboleSorte({ sorte, classe }: { sorte: number; classe?: string }): ReactElement {
  return <Symbole couleur={couleurDe(sorte)} forme={formeDe(sorte)} classe={classe} />
}

const ENCOCHE_GLYPHE = { largeur: 11, profondeur: 7 }
const BOITE_GLYPHE = boite(14, 10, ENCOCHE_GLYPHE)
const CHEMINS = [0, 1, 2, 3].map((forme) => cheminDecoupe(14, 10, cotesDuModule(forme), ENCOCHE_GLYPHE))

/** La petite pièce d'un module : sa bosse a sa forme, sa teinte est sa couleur. */
export function Glyphe({ couleur, forme, classe = '' }: { couleur: number; forme: number; classe?: string }): ReactElement {
  return (
    <svg
      className={`glyphe-forme${classe === '' ? '' : ` ${classe}`}`}
      viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`}
      style={{ '--teinte': TEINTES[couleur] ?? 0 } as CSSProperties}
      aria-label={`module ${nomSorte(sorteDe(couleur, forme))}`}
    >
      <path d={CHEMINS[forme] ?? ''} />
    </svg>
  )
}
