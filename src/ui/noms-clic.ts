/**
 * LES NOMS du système abstrait : volontairement neutres (Keko : « on lui
 * donnera un thème habillage APRÈS »). L'habillage remplacera ce fichier et
 * les icônes, rien d'autre.
 */
import { UNITES } from '../logic/clic/donnees.ts'

/** La ressource qu'on produit et qu'on vend. */
export const NOM_R = 'R'

export const NOM_UNITE: readonly string[] = UNITES.map((u) => `Unité ${u.id.toUpperCase()}`)

export const NOM_AUTO = 'Comptoir automatique'
export const NOM_PRESTIGE = 'Prestige'
