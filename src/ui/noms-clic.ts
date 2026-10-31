/**
 * LES NOMS du système abstrait : volontairement neutres (Keko : « on lui
 * donnera un thème habillage APRÈS »). L'habillage remplacera ce fichier et
 * les icônes, rien d'autre.
 */
import { PRODUCTEURS } from '../logic/clic/donnees.ts'

/** La ressource qu'on produit et qu'on vend. */
export const NOM_R = 'R'

/** La base : le premier producteur, offert, au centre, celui qu'on tape d'abord. */
export const NOM_BASE = 'la base'

export const NOM_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'La base' : `Producteur ${p.id.toUpperCase()}`))
export const LETTRE_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'Base' : p.id.toUpperCase()))

/** Les quatre modules, qui sont aussi les quatre formes : rond, carré, triangle, trapèze. */
export const NOM_MODULE: readonly string[] = ['Horloge', 'Ajout', 'Multiplicateur', 'Critique']
export const NOMS_FORMES: readonly string[] = ['rond', 'carré', 'triangle', 'trapèze']
/** Ce que fait chaque module, en une ligne. */
export const EXPLICATION_MODULE: readonly string[] = [
  'déclenche le producteur toute seule, à son rythme',
  'grossit chaque lot du producteur',
  'multiplie chaque lot du producteur',
  'donne à chaque lot une chance d’être décuplé',
]

export const NOM_AUTO = 'Comptoir automatique'
export const NOM_PRESTIGE = 'Prestige'
