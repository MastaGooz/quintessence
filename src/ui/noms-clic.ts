/**
 * LES NOMS du système : le thème « IA × minage » que Keko a proposé le 31/10
 * (« un petit robot qui mine pour construire des machines et d'autres robots,
 * jusqu'à tout consumer, avec l'énergie en monnaie générale »), posé d'abord
 * par les mots : l'habillage dessiné viendra de lui. Les modules gardent leurs
 * noms neutres en attendant.
 */
import { PRODUCTEURS } from '../logic/clic/donnees.ts'

/** La ressource qu'on extrait et qu'on brûle. */
export const NOM_R = 'roche'
/** La monnaie. */
export const NOM_ENERGIE = 'énergie'

/** La base : le petit robot, au centre, celui qu'on tape d'abord ; il mine partout, à la main. */
export const NOM_BASE = 'le robot'

export const NOM_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'Le robot' : `Extracteur ${p.id.toUpperCase()}`))
export const LETTRE_PRODUCTEUR: readonly string[] = PRODUCTEURS.map((p, i) => (i === 0 ? 'Robot' : p.id.toUpperCase()))
/** Les producteurs achetés, en un mot. */
export const NOM_EXTRACTEUR = 'extracteur'

/** Les quatre modules, qui sont aussi les quatre formes : rond, carré, triangle, trapèze. */
export const NOM_MODULE: readonly string[] = ['Horloge', 'Ajout', 'Multiplicateur', 'Critique']
export const NOMS_FORMES: readonly string[] = ['rond', 'carré', 'triangle', 'trapèze']
/** Ce que fait chaque module, en une ligne. */
export const EXPLICATION_MODULE: readonly string[] = [
  'déclenche la machine toute seule, à son rythme',
  'grossit chaque lot de la machine',
  'multiplie chaque lot de la machine',
  'donne à chaque lot une chance d’être décuplé',
]

/** Une zone révélée qui porte du minerai. */
export const NOM_VEINE = 'veine'
export const NOM_AUTO = 'Raffinerie automatique'
export const NOM_PRESTIGE = 'Quitter la planète'
/** Les points de prestige. */
export const NOM_PLAN = 'plan'
