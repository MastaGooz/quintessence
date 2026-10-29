/**
 * LES DONNÉES DE L'ARBRE TECH : ce que dit l'onglet « Arbre tech » du document
 * de design, et rien d'autre. Toute règle chiffrée vit ici ; le moteur ne
 * connaît que des fiches. Les productions sont PAR HEURE pour un bâtiment de
 * niveau 1, sauf les chefs-d'œuvre, par cycle.
 */

export type Element = 'feu' | 'terre' | 'eau' | 'air'
export const ELEMENTS: readonly Element[] = ['feu', 'terre', 'eau', 'air']

export type Ressource =
  | 'charbon' | 'soufre' | 'braises' | 'flamme' | 'coeur'
  | 'minerai' | 'argile' | 'fer' | 'alliage' | 'lingot'
  | 'herbes' | 'sel' | 'essence' | 'mercure' | 'eauforte'
  | 'sable' | 'cristal' | 'verre' | 'runes' | 'prisme'

export interface FicheRessource {
  element: Element
  /** 1 matière, 2 composant, 3 chef-d'œuvre. */
  niveau: 1 | 2 | 3
  /** Composant avancé (flamme, alliage, mercure, runes). */
  avance?: boolean
  /** Prix de base au comptoir, en or. */
  prix: number
  /** Stock normal du comptoir : le prix est de base quand le stock y est. */
  stockNormal: number
}

export const RESSOURCES: Record<Ressource, FicheRessource> = {
  charbon: { element: 'feu', niveau: 1, prix: 2, stockNormal: 600 },
  soufre: { element: 'feu', niveau: 1, prix: 2, stockNormal: 600 },
  braises: { element: 'feu', niveau: 2, prix: 5, stockNormal: 2000 },
  flamme: { element: 'feu', niveau: 2, avance: true, prix: 80, stockNormal: 80 },
  coeur: { element: 'feu', niveau: 3, prix: 1500, stockNormal: 6 },
  minerai: { element: 'terre', niveau: 1, prix: 2, stockNormal: 600 },
  argile: { element: 'terre', niveau: 1, prix: 2, stockNormal: 600 },
  fer: { element: 'terre', niveau: 2, prix: 15, stockNormal: 250 },
  alliage: { element: 'terre', niveau: 2, avance: true, prix: 80, stockNormal: 80 },
  lingot: { element: 'terre', niveau: 3, prix: 1500, stockNormal: 6 },
  herbes: { element: 'eau', niveau: 1, prix: 2, stockNormal: 600 },
  sel: { element: 'eau', niveau: 1, prix: 2, stockNormal: 600 },
  essence: { element: 'eau', niveau: 2, prix: 15, stockNormal: 250 },
  mercure: { element: 'eau', niveau: 2, avance: true, prix: 80, stockNormal: 80 },
  eauforte: { element: 'eau', niveau: 3, prix: 1500, stockNormal: 6 },
  sable: { element: 'air', niveau: 1, prix: 2, stockNormal: 600 },
  cristal: { element: 'air', niveau: 1, prix: 2, stockNormal: 600 },
  verre: { element: 'air', niveau: 2, prix: 15, stockNormal: 250 },
  runes: { element: 'air', niveau: 2, avance: true, prix: 80, stockNormal: 80 },
  prisme: { element: 'air', niveau: 3, prix: 1500, stockNormal: 6 },
}

export const TOUTES: readonly Ressource[] = Object.keys(RESSOURCES) as Ressource[]

/** Le chef-d'œuvre de chaque élément. */
export const CHEF: Record<Element, Ressource> = { feu: 'coeur', terre: 'lingot', eau: 'eauforte', air: 'prisme' }
/** Le composant avancé de chaque élément. */
export const AVANCE: Record<Element, Ressource> = { feu: 'flamme', terre: 'alliage', eau: 'mercure', air: 'runes' }

export type Quantites = Partial<Record<Ressource, number>>

export type TypeBatiment = 'extraction' | 'transformation' | 'chef' | 'four' | 'utilitaire' | 'attaque' | 'defense'

export interface FicheBatiment {
  type: TypeBatiment
  /** La branche dont il compte pour la maîtrise. */
  element?: Element
  /** Transformation avancée (composants avancés). */
  avance?: boolean
  or: number
  cout: Quantites
  /** Par heure, ou par cycle pour un chef-d'œuvre. */
  consomme?: Quantites
  produit?: Quantites
  cycleH?: number
  reserveMaitre?: boolean
  sansEmplacement?: boolean
  unique?: boolean
}

const FICHES = {
  // NIVEAU 1 : L'EXTRACTION
  mineCharbon: { type: 'extraction', element: 'feu', or: 60, cout: { argile: 10 }, produit: { charbon: 15 } },
  soufriere: { type: 'extraction', element: 'feu', or: 60, cout: { argile: 10 }, produit: { soufre: 15 } },
  mineFer: { type: 'extraction', element: 'terre', or: 60, cout: { argile: 10 }, produit: { minerai: 15 } },
  argiliere: { type: 'extraction', element: 'terre', or: 60, cout: {}, produit: { argile: 15 } },
  jardin: { type: 'extraction', element: 'eau', or: 60, cout: { argile: 10 }, produit: { herbes: 15 } },
  saline: { type: 'extraction', element: 'eau', or: 60, cout: { argile: 10 }, produit: { sel: 15 } },
  sabliere: { type: 'extraction', element: 'air', or: 60, cout: { argile: 10 }, produit: { sable: 15 } },
  geode: { type: 'extraction', element: 'air', or: 60, cout: { argile: 10 }, produit: { cristal: 15 } },
  // NIVEAU 2 : LA TRANSFORMATION
  fourneau: { type: 'transformation', element: 'feu', or: 80, cout: { argile: 20, minerai: 10 }, consomme: { charbon: 10 }, produit: { braises: 12 } },
  forge: { type: 'transformation', element: 'terre', or: 80, cout: { argile: 20, charbon: 10 }, consomme: { minerai: 8, braises: 4 }, produit: { fer: 6 } },
  alambic: { type: 'transformation', element: 'eau', or: 100, cout: { fer: 10, verre: 10 }, consomme: { herbes: 8, sel: 2, braises: 3 }, produit: { essence: 6 } },
  verrerie: { type: 'transformation', element: 'air', or: 100, cout: { fer: 10, argile: 20 }, consomme: { sable: 8, braises: 4 }, produit: { verre: 6 } },
  autel: { type: 'transformation', element: 'feu', avance: true, or: 150, cout: { fer: 20, verre: 10, essence: 10 }, consomme: { soufre: 10, braises: 10 }, produit: { flamme: 3 } },
  creuset: { type: 'transformation', element: 'terre', avance: true, or: 150, cout: { fer: 20, verre: 10, essence: 10 }, consomme: { fer: 6, argile: 4, braises: 4 }, produit: { alliage: 3 } },
  cornue: { type: 'transformation', element: 'eau', avance: true, or: 150, cout: { fer: 20, verre: 10, essence: 10 }, consomme: { essence: 6, cristal: 2, braises: 3 }, produit: { mercure: 3 } },
  atelierRunes: { type: 'transformation', element: 'air', avance: true, or: 150, cout: { fer: 20, verre: 10, essence: 10 }, consomme: { verre: 4, cristal: 6, braises: 3 }, produit: { runes: 3 } },
  // NIVEAU 3 : LES CHEFS-D'ŒUVRE (par cycle de 4 h)
  athanor: { type: 'chef', element: 'feu', reserveMaitre: true, cycleH: 4, or: 150, cout: { alliage: 4, flamme: 4, mercure: 4, runes: 4 }, consomme: { flamme: 6, alliage: 2, mercure: 2, runes: 2, braises: 8 }, produit: { coeur: 1 } },
  grandCreuset: { type: 'chef', element: 'terre', reserveMaitre: true, cycleH: 4, or: 150, cout: { alliage: 4, flamme: 4, mercure: 4, runes: 4 }, consomme: { alliage: 6, flamme: 2, mercure: 2, runes: 2, braises: 8 }, produit: { lingot: 1 } },
  fontaine: { type: 'chef', element: 'eau', reserveMaitre: true, cycleH: 4, or: 150, cout: { alliage: 4, flamme: 4, mercure: 4, runes: 4 }, consomme: { mercure: 6, flamme: 2, alliage: 2, runes: 2, braises: 8 }, produit: { eauforte: 1 } },
  observatoire: { type: 'chef', element: 'air', reserveMaitre: true, cycleH: 4, or: 150, cout: { alliage: 4, flamme: 4, mercure: 4, runes: 4 }, consomme: { runes: 6, flamme: 2, alliage: 2, mercure: 2, braises: 8 }, produit: { prisme: 1 } },
  // LE GRAND ŒUVRE
  four: { type: 'four', unique: true, or: 200, cout: { alliage: 10, verre: 20 } },
  // UTILITAIRES (sans emplacement ; le coût est multiplié par le niveau visé / ×1,5 par extension)
  entrepot: { type: 'utilitaire', sansEmplacement: true, or: 60, cout: { argile: 20, fer: 10 } },
  extension: { type: 'utilitaire', sansEmplacement: true, or: 100, cout: { argile: 30, fer: 20, verre: 10 } },
  // ATTAQUE ET DÉFENSE
  repaire: { type: 'attaque', or: 100, cout: { fer: 30, verre: 10 } },
  officine: { type: 'attaque', or: 100, cout: { essence: 20, verre: 10 } },
  cabinet: { type: 'attaque', or: 100, cout: { verre: 20, essence: 10 } },
  tour: { type: 'attaque', or: 80, cout: { verre: 20, cristal: 10 } },
  gardien: { type: 'defense', or: 150, cout: { fer: 30, argile: 20, runes: 5 } },
  cercle: { type: 'defense', or: 150, cout: { essence: 20, sel: 10, runes: 5 } },
} as const satisfies Record<string, FicheBatiment>

export type NomBatiment = keyof typeof FICHES

/** Les fiches, lues par leur nom : le type commun, pas le littéral de chaque ligne. */
export const BATIMENTS: Record<NomBatiment, FicheBatiment> = FICHES

/** Le chef-d'œuvre et le bâtiment de niveau 3 de chaque élément. */
export const BATIMENT_CHEF: Record<Element, NomBatiment> = { feu: 'athanor', terre: 'grandCreuset', eau: 'fontaine', air: 'observatoire' }

/** Les quatre couleurs de l'œuvre : chefs-d'œuvre de CHAQUE élément, et la cuisson. */
export const COULEURS = [
  { nom: 'noir', parElement: 1, dureeH: 1 },
  { nom: 'blanc', parElement: 1, dureeH: 2 },
  { nom: 'jaune', parElement: 2, dureeH: 4 },
  { nom: 'rouge', parElement: 3, dureeH: 8 },
] as const

export const MAITRISE = {
  points: { extraction: 1, transformation: 2, niveau: 1 },
  compagnon: 4,
  maitre: 8,
  rendementCompagnon: 0.15,
  rendementMaitre: 0.3,
  remiseMaitre: 0.2,
  /** Deux maîtrises au plus ; les autres branches plafonnent à compagnon. */
  maitrisesMax: 2,
} as const

export const COMPTOIR = {
  exposant: 0.5,
  /** Part de l'écart au stock normal comblée par heure. */
  retourParHeure: 0.1,
  ecartAchat: 1.1,
  prixMin: 0.2,
  prixMax: 5,
  rumeur: 0.7,
} as const

export const LABO = {
  emplacements: 6,
  emplacementsMax: 14,
  entrepot: 120,
  /** Niveaux de bâtiment : production et consommation multipliées. */
  niveaux: [1, 1.5, 2] as const,
  niveauVerre: 10,
  niveauEssence: 10,
  /** Chaque exemplaire supplémentaire d'un bâtiment d'extraction coûte 25 % de plus. */
  surcoutExemplaire: 0.25,
  surcoutExtension: 1.5,
} as const

export const DEPART = { or: 300, stock: { argile: 40, charbon: 20 } as Quantites }

export const COUPS = {
  pillage: { part: 0.2, partGardee: 0.1, braises: 20, rechargeH: 6, protectionH: 4, parJourEtCible: 2 },
  sabotage: { dureeH: 2, mercure: 5, rechargeH: 8 },
  rumeur: { or: 30, dureeH: 1, rechargeH: 12 },
  espion: { cristal: 10, rechargeH: 2, dureeH: 24 },
  /** Chance qu'une attaque soit découverte (la gazette). */
  decouverte: 0.3,
} as const

export const SAISON_H = 7 * 24
