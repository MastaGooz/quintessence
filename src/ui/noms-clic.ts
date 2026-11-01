/**
 * LES NOMS du système abstrait : posés par les mots seuls, sans thème (Keko,
 * 01/11 : « revenons au système abstrait »). Les quatre sortes de matière
 * portent le nom de leur forme ; l'habillage viendra après.
 */
import { PREMIER_ATELIER, PRODUCTEURS, RARETES, type Trait } from '../logic/clic/donnees.ts'

/** La ressource, en un mot ; et chaque sorte. */
export const NOM_MATIERE = 'matière'
export const NOM_SORTE: readonly string[] = ['matière ronde', 'matière carrée', 'matière triangle', 'matière trapèze']
export const ADJECTIF_SORTE: readonly string[] = ['ronde', 'carrée', 'triangle', 'trapèze']
/** La monnaie. */
export const NOM_OR = 'or'

/** La base : la première source, offerte, au centre, celle qu'on tape d'abord. */
export const NOM_BASE = 'la base'

/** Chaque type de générateur : la base, les sources A…H, les ateliers 1…4. */
export const NOM_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'La base' : i < PREMIER_ATELIER ? `Source ${p.id.toUpperCase()}` : `Atelier ${p.id.slice(1)}`))
export const LETTRE_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'Base' : i < PREMIER_ATELIER ? p.id.toUpperCase() : `At. ${p.id.slice(1)}`))
export const NOM_SOURCE = 'source'
export const NOM_ATELIER = 'atelier'
export const NOM_GENERATEUR = 'générateur'

/** Les quatre modules, qui sont aussi les quatre formes : rond, carré, triangle, trapèze. */
export const NOM_MODULE: readonly string[] = ['Horloge', 'Ajout', 'Multiplicateur', 'Critique']
export const NOMS_FORMES: readonly string[] = ['rond', 'carré', 'triangle', 'trapèze']
/** Ce que fait chaque module, en une ligne. */
export const EXPLICATION_MODULE: readonly string[] = [
  'déclenche le générateur tout seul, à son rythme',
  'grossit chaque lot du générateur',
  'multiplie chaque lot du générateur',
  'donne à chaque lot une chance d’être décuplé (sur un atelier : une rareté de plus)',
]

export const NOM_RARETE: readonly string[] = RARETES.noms
export const NOM_TRAIT: Record<Trait, string> = { voisin: 'Voisin', solide: 'Solide', econome: 'Économe', rapide: 'Rapide' }
export const EXPLICATION_TRAIT: Record<Trait, string> = {
  voisin: 'les modules d’à côté ont un effet ×1,25',
  solide: 'son effet est ×1,4',
  econome: 'ses niveaux coûtent moitié prix',
  rapide: 'sa fréquence est ×1,5',
}

export const NOM_SOUTE = 'Soute'
export const NOM_MARCHE = 'Marché'
export const NOM_PRESTIGE = 'Repartir de zéro'
/** Les points de prestige. */
export const NOM_POINT = 'point'
