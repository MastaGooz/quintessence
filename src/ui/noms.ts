/** Les noms affichés : les données parlent en identifiants, l'écran en français. */
import type { Element, NomBatiment, Ressource } from '../logic/donnees.ts'

export const NOM_RESSOURCE: Record<Ressource, string> = {
  charbon: 'charbon',
  soufre: 'soufre',
  braises: 'braises',
  flamme: 'flamme éternelle',
  coeur: 'Cœur de salamandre',
  minerai: 'minerai',
  argile: 'argile',
  fer: 'fer',
  alliage: 'alliage',
  lingot: "Lingot d'orichalque",
  herbes: 'herbes',
  sel: 'sel',
  essence: 'essence',
  mercure: 'mercure',
  eauforte: 'Eau-forte primordiale',
  sable: 'sable',
  cristal: 'cristal',
  verre: 'verre',
  runes: 'runes',
  prisme: "Prisme d'éther",
}

export const NOM_BATIMENT: Record<NomBatiment, string> = {
  mineCharbon: 'Mine de charbon',
  soufriere: 'Soufrière',
  mineFer: 'Mine de fer',
  argiliere: 'Argilière',
  jardin: "Jardin d'herbes",
  saline: 'Saline',
  sabliere: 'Sablière',
  geode: 'Géode',
  fourneau: 'Fourneau',
  forge: 'Forge',
  alambic: 'Alambic',
  verrerie: 'Verrerie',
  autel: 'Autel de soufre',
  creuset: 'Creuset',
  cornue: 'Cornue',
  atelierRunes: 'Atelier des runes',
  athanor: 'Athanor',
  grandCreuset: 'Grand Creuset',
  fontaine: 'Fontaine de mercure',
  observatoire: 'Observatoire',
  four: 'Four philosophal',
  entrepot: 'Entrepôt',
  extension: 'Extension du laboratoire',
  repaire: 'Repaire de voleurs',
  officine: 'Officine des poisons',
  cabinet: 'Cabinet des rumeurs',
  tour: "Tour de l'astrologue",
  gardien: 'Gardien de pierre',
  cercle: 'Cercle de protection',
}

/** Ce que fait un bâtiment qui ne produit rien. */
export const EFFET_BATIMENT: Partial<Record<NomBatiment, string>> = {
  four: 'Y cuire les quatre couleurs du Grand Œuvre',
  entrepot: '+120 de place par ressource',
  extension: '+1 emplacement',
  repaire: 'Piller : 20 % de l’entrepôt d’un rival',
  officine: 'Saboter : arrêter un atelier ou une cuisson 2 h',
  cabinet: 'Rumeur : −30 % sur un prix pendant 1 h',
  tour: 'Espionner : voir un laboratoire pendant un jour',
  gardien: 'Les pillages ne prennent plus que 10 %',
  cercle: 'Annule un sabotage par jour',
}

export const NOM_ELEMENT: Record<Element, string> = { feu: 'Feu', terre: 'Terre', eau: 'Eau', air: 'Air' }

export const NOM_COULEUR = ['Œuvre au noir', 'Œuvre au blanc', 'Œuvre au jaune', 'Œuvre au rouge'] as const
