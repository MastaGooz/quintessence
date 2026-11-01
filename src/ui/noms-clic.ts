/**
 * LES NOMS du système abstrait : posés par les mots seuls, sans thème (Keko,
 * 01/11 : « revenons au système abstrait »). Une matière se nomme par sa forme
 * et sa couleur (« carré rouge », « rond bleu ») ; l'habillage viendra après.
 */
import { FABRICATION, PRIMAIRES, PRODUCTEURS, RARETES, couleurDe, formeDe, partsDe, type Genre, type Trait } from '../logic/clic/donnees.ts'
import { rangDe } from '../logic/clic/moteur.ts'

/** La ressource, en un mot. */
export const NOM_MATIERE = 'matière'
/** Les six couleurs, au masculin (un carré rouge) et au féminin (une source rouge, la matière verte). */
export const NOM_COULEUR: readonly string[] = ['rouge', 'vert', 'bleu', 'jaune', 'cyan', 'violet']
export const NOM_COULEUR_F: readonly string[] = ['rouge', 'verte', 'bleue', 'jaune', 'cyan', 'violette']
/** Les quatre formes : le rond est la matière brute, les trois autres font des modules. */
export const NOMS_FORMES: readonly string[] = ['rond', 'carré', 'triangle', 'losange']
/** La monnaie. */
export const NOM_OR = 'or'

/** Le nom d'une sorte : « carré rouge », « rond bleu ». */
export function nomSorte(sorte: number): string {
  return `${NOMS_FORMES[formeDe(sorte)]} ${NOM_COULEUR[couleurDe(sorte)]}`
}

/** Au pluriel : « carrés rouges », « ronds cyan ». */
export function nomSortePluriel(sorte: number): string {
  const c = NOM_COULEUR[couleurDe(sorte)] ?? ''
  return `${NOMS_FORMES[formeDe(sorte)]}s ${c}${c === 'cyan' ? '' : 's'}`
}

/** Un nombre de cette sorte : « 1 carré rouge », « 12 ronds bleus ». */
export function quantiteDe(q: string, sorte: number, pluriel = true): string {
  return `${q} ${pluriel ? nomSortePluriel(sorte) : nomSorte(sorte)}`
}

/** Ce que chaque couleur de base touche. */
export const NOM_CIBLE: readonly string[] = ['la tape', 'le lot', 'le temps']
/** Ce que chaque forme fait. */
export const NOM_OPERATION: readonly string[] = ['', 'ajoute', 'multiplie', 'donne une chance']

/** Ce que fait un module d'une couleur de base et d'une forme, en une ligne. */
const EXPLICATIONS: readonly (readonly string[])[] = [
  ['', 'ajoute à chaque tape', 'multiplie chaque tape, critique comprise : le super-critique', 'donne à chaque tape une chance d’être critique (×10)'],
  ['', 'grossit chaque lot', 'multiplie chaque lot', 'donne à chaque lot une chance d’être gros (×3)'],
  ['', 'déclenche le générateur tout seul : l’horloge', 'multiplie la cadence des horloges', 'donne à chaque tic une chance d’en entraîner un second'],
]

/** Ce que fait un module d'une couleur et d'une forme ; un module mélangé porte les deux effets de ses couleurs. */
export function explicationModule(couleur: number, forme: number): string {
  const parts = partsDe(couleur)
  if (couleur < PRIMAIRES) return EXPLICATIONS[couleur]?.[forme] ?? ''
  return `deux effets à ${Math.round((parts[0]?.[1] ?? 0) * 100)} % : ${parts.map(([c]) => EXPLICATIONS[c]?.[forme] ?? '').join(' ; ')}`
}

export const NOM_GENRE: Record<Genre, string> = { source: 'source', raffinerie: 'raffinerie', melangeur: 'mélangeur' }
const MAJUSCULE: Record<Genre, string> = { source: 'Source', raffinerie: 'Raffinerie', melangeur: 'Mélangeur' }
const LETTRE: Record<Genre, string> = { source: 'S', raffinerie: 'R', melangeur: 'M' }

/** Chaque type de générateur : « Source », « Source 2 », « Raffinerie 1 », « Mélangeur 1 ». */
export const NOM_TYPE: readonly string[] = PRODUCTEURS.map((t, i) => (t.genre === 'source' ? (i === 0 ? 'Source' : `Source ${rangDe(i) + 1}`) : `${MAJUSCULE[t.genre]} ${rangDe(i) + 1}`))
export const LETTRE_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((t, i) => (t.genre === 'source' && i === 0 ? 'S' : `${LETTRE[t.genre]}${rangDe(i) + 1}`))

/** Le nom d'un générateur posé : une source porte sa couleur (« Source rouge », « Source 2 bleue »). */
export function nomProducteur(p: { type: number; couleur: number }): string {
  const t = PRODUCTEURS[p.type]
  if (t?.genre === 'source') return `${NOM_TYPE[p.type]} ${NOM_COULEUR_F[p.couleur]}`
  return NOM_TYPE[p.type] ?? ''
}

export const NOM_RARETE: readonly string[] = RARETES.noms
/** Les qualités de fabrication d'un module, dans l'ordre de `FABRICATION.qualites`. */
const NOMS_QUALITES: Record<string, string> = { simple: 'simple', soignee: 'soignée', fine: 'fine', maitresse: 'maîtresse' }
export const NOM_QUALITE: readonly string[] = FABRICATION.qualites.map((q) => NOMS_QUALITES[q.id] ?? q.id)
export const NOM_FABRICATION = 'Fabriquer'
export const NOM_TRAIT: Record<Trait, string> = { voisin: 'Voisin', solide: 'Solide', econome: 'Économe', rapide: 'Rapide' }
export const EXPLICATION_TRAIT: Record<Trait, string> = {
  voisin: 'les modules d’à côté ont un effet ×1,25',
  solide: 'son effet est ×1,4',
  econome: 'ses niveaux coûtent moitié prix',
  rapide: 'son effet sur le temps est ×1,5',
}

export const NOM_SOUTE = 'Soute'
export const NOM_MARCHE = 'Marché'
export const NOM_PRESTIGE = 'Repartir de zéro'
/** Les points de prestige. */
export const NOM_POINT = 'point'
