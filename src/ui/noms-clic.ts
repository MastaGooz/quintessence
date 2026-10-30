/**
 * LES NOMS du système abstrait : volontairement neutres (Keko : « on lui
 * donnera un thème habillage APRÈS »). L'habillage remplacera ce fichier et
 * les icônes, rien d'autre.
 */
import { UNITES } from '../logic/clic/donnees.ts'

/** La ressource qu'on produit et qu'on vend. */
export const NOM_R = 'R'

/** La base : le bouton de clic au centre, sur lequel les modules se branchent. */
export const NOM_BASE = 'la base'

export const NOM_MODULE: readonly string[] = UNITES.map((u) => `Module ${u.id.toUpperCase()}`)
export const LETTRE_MODULE: readonly string[] = UNITES.map((u) => u.id.toUpperCase())

export const NOM_ANNEAU = 'Agrandir la base'
export const NOM_AUTO = 'Comptoir automatique'
export const NOM_PRESTIGE = 'Prestige'
