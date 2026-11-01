/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, le hasard
 * tiré d'une graine (le monde a la sienne, chaque joueur compte ses tirages).
 * Tout ce qu'un joueur peut faire passe par ici (choisir sa sorte, déclencher
 * une source, lancer une fournée, vendre, acheter, emboîter, améliorer,
 * fondre, déplacer, repartir de zéro) ; `avancer` fait vivre le monde.
 *
 * LES GÉNÉRATEURS ET LEURS MODULES (Keko, 31/10 et 01/11) : un générateur est
 * un rectangle creusé de prises femelles. Une SOURCE produit un LOT de matière
 * (de la sorte du joueur) à chaque déclenchement ; un ATELIER consomme de la
 * matière d'une sorte et rend un module de cette forme, de rareté tirée. Un
 * module est une pièce à une bosse, qui s'emboîte dans un creux de sa forme et
 * AGIT sur le générateur : l'horloge le déclenche toute seule, l'ajout grossit
 * son lot, le multiplicateur le multiplie, le critique donne une chance qu'il
 * soit décuplé (sur un atelier : que la rareté monte). Un module s'améliore
 * niveau par niveau, se déplace d'un générateur à l'autre, attend dans la
 * SOUTE quand il n'est branché nulle part ; trois modules de même forme et
 * même rareté se fondent en un de la rareté au-dessus.
 *
 * LE MARCHÉ est commun : un prix par sorte, qui baisse avec ce que tous
 * vendent et monte avec ce que tous achètent.
 */
import {
  ACHAT, ATELIERS, CASE, EFFETS, EMPLACEMENTS, FORMES, FUSION, MARCHE, MODULE, MODULES, NIVEAU, PIECE, PREMIER_ATELIER, PRESTIGE, PRODUCTEUR, PRODUCTEURS, RARETES, SOURCES, TRAITS,
  type Trait, type TypeProducteur,
} from './donnees.ts'
import { graineDe, rngDe } from '../rng.ts'

/** UN GÉNÉRATEUR : un exemplaire d'un type, posé sur le plan (son centre en pixels-monde, au centre d'une case). */
export interface Producteur {
  id: number
  /** L'indice dans `PRODUCTEURS` : les sources d'abord, les ateliers à partir de `PREMIER_ATELIER`. */
  type: number
  x: number
  y: number
  /** Atelier : la forme (la sorte de matière) qu'il travaille. */
  forme: number
  /** Atelier : les fournées accumulées par ses horloges, pas encore lancées (une fraction). */
  progres: number
  /** Atelier : les fournées déjà faites. */
  fournees: number
}

/** UN MODULE : une pièce d'une forme, d'une rareté, emboîtée sur un générateur ou dans la soute. */
export interface Module {
  id: number
  /** Le type, qui est aussi sa forme : 0 horloge (rond), 1 ajout (carré), 2 multiplicateur (triangle), 3 critique (trapèze). */
  type: number
  /** La rareté, de 0 (commune) à 4 (légendaire). */
  rarete: number
  /** Le trait, à partir de peu commune. */
  trait: Trait | null
  /** Le niveau d'amélioration, à partir de 1. */
  niveau: number
  /** Le générateur où il est emboîté, et l'emplacement (voir `EMPLACEMENTS`) ; null dans la soute. */
  parent: number | null
  emplacement: number
}

export interface Joueur {
  id: number
  nom: string
  /** La sorte de matière que le joueur produit ; null tant qu'il ne l'a pas choisie. */
  sorte: number | null
  /** L'or : la monnaie. */
  or: number
  /** La matière en stock, par sorte. */
  matiere: number[]
  producteurs: Producteur[]
  modules: Module[]
  /** Le prochain identifiant, commun aux producteurs et aux modules. */
  prochainId: number
  /** Les exemplaires achetés de chaque type de générateur : c'est eux que le coût suit. */
  achetes: number[]
  /** Les sources et les ateliers que le joueur a déjà vus (le dévoilement survit au prestige). */
  connusSources: number
  connusAteliers: number
  /** Les points de prestige acquis. */
  points: number
  prestiges: number
  /** La matière produite depuis le dernier prestige, et depuis le début (le score). */
  produitRun: number
  total: number
  /** Les tirages faits : le hasard du joueur en découle, rejouable. */
  tirages: number
  /** Les fournées depuis le dernier rare, le dernier épique : la garantie. */
  sansRare: number
  sansEpique: number
  journal: { tapes: number; fournees: number; ventes: number; achats: number; orVentes: number; orAchats: number; fusions: number }
}

/** LE MARCHÉ : par sorte, le volume net vendu récemment, la demande suivie, et le prix de chaque heure passée. */
export interface Marche {
  volume: number[]
  demande: number[]
  historique: number[][]
}

export interface Monde {
  /** L'heure de jeu, depuis le début de la saison. */
  t: number
  graine: number
  joueurs: Joueur[]
  marche: Marche
}

/** La base : le premier générateur, offert, au centre du plan. */
const BASE_ID = 1

function base(): Producteur {
  return { id: BASE_ID, type: 0, x: 0, y: 0, forme: 0, progres: 0, fournees: 0 }
}

export function nouveauJoueur(id: number, nom: string): Joueur {
  return {
    id,
    nom,
    sorte: null,
    or: 0,
    matiere: Array.from({ length: FORMES }, () => 0),
    producteurs: [base()],
    modules: [],
    prochainId: BASE_ID + 1,
    achetes: PRODUCTEURS.map(() => 0),
    connusSources: 1,
    connusAteliers: 1,
    points: 0,
    prestiges: 0,
    produitRun: 0,
    total: 0,
    tirages: 0,
    sansRare: 0,
    sansEpique: 0,
    journal: { tapes: 0, fournees: 0, ventes: 0, achats: 0, orVentes: 0, orAchats: 0, fusions: 0 },
  }
}

export function nouveauMonde(noms: string[], graine: number): Monde {
  return {
    t: 0,
    graine,
    joueurs: noms.map((n, i) => nouveauJoueur(i, n)),
    marche: {
      volume: Array.from({ length: FORMES }, () => 0),
      demande: Array.from({ length: FORMES }, () => MARCHE.demandeMin),
      historique: Array.from({ length: FORMES }, () => [MARCHE.prix]),
    },
  }
}

/** Le joueur choisit sa sorte : sa base produit cette matière. Une fois par partie (et au retour d'un prestige). */
export function choisirSorte(j: Joueur, sorte: number): boolean {
  if (j.sorte !== null || sorte < 0 || sorte >= FORMES) return false
  j.sorte = sorte
  for (const p of j.producteurs) if (estAtelier(p)) p.forme = sorte
  return true
}

/** Un tirage du joueur, de 0 à 1 : la graine du monde, le joueur, et son compte de tirages. */
export function tirer(m: Monde, j: Joueur): number {
  const r = rngDe(graineDe(m.graine, j.id + 1, j.tirages + 1))()
  j.tirages += 1
  return r
}

export function typeDe(p: Producteur): TypeProducteur {
  return PRODUCTEURS[p.type] ?? PRODUCTEURS[0]!
}

export function estAtelier(p: Producteur): boolean {
  return p.type >= PREMIER_ATELIER
}

export function producteurDe(j: Joueur, id: number): Producteur | undefined {
  return j.producteurs.find((p) => p.id === id)
}

export function moduleDe(j: Joueur, id: number): Module | undefined {
  return j.modules.find((mo) => mo.id === id)
}

/** Les modules emboîtés sur un générateur. */
export function modulesDe(j: Joueur, p: Producteur): Module[] {
  return j.modules.filter((mo) => mo.parent === p.id)
}

/** Les modules de la soute : branchés nulle part. */
export function soute(j: Joueur): Module[] {
  return j.modules.filter((mo) => mo.parent === null)
}

/** Les modules emboîtés quelque part : ceux qui agissent. */
export function branches(j: Joueur): Set<number> {
  const ids = new Set(j.producteurs.map((p) => p.id))
  return new Set(j.modules.filter((mo) => mo.parent !== null && ids.has(mo.parent)).map((mo) => mo.id))
}

// ---------------------------------------------------------------------------
// LA GÉOMÉTRIE

/** Un point du plan et un sens (0 haut, 1 droite, 2 bas, 3 gauche). */
export interface Place {
  x: number
  y: number
  sens: number
}

/** Un rectangle : son centre et sa taille. */
export interface Boite {
  x: number
  y: number
  largeur: number
  hauteur: number
}

/** Une découpe sur un côté : la bosse qui s'emboîte, ou le creux qui reçoit. */
export interface Decoupe {
  genre: 'bosse' | 'creux'
  forme: number
}

/** Un creux où un module peut aller : le générateur, l'emplacement, sa forme, où se placerait le module, et le module qui l'occupe déjà, s'il y en a un (il irait à la soute). */
export interface Prise {
  parent: number
  emplacement: number
  forme: number
  place: Place
  occupant: number | null
}

export const DIRECTIONS: readonly { x: number; y: number }[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

/** Le centre de la case la plus proche d'un point. */
export function surLesCases(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x / CASE) * CASE, y: Math.round(y / CASE) * CASE }
}

/** Où s'emboîte un module à l'emplacement `e` d'un générateur centré en (x, y) : collé au bord, sa face vers l'extérieur. */
export function placeSurProducteur(p: { x: number; y: number }, e: number): Place {
  const em = EMPLACEMENTS[e] ?? EMPLACEMENTS[0]!
  const d = DIRECTIONS[em.cote]!
  const horizontal = em.cote % 2 === 0
  const distance = (horizontal ? PRODUCTEUR.hauteur : PRODUCTEUR.largeur) / 2 + MODULE.profondeur / 2
  return {
    x: p.x + d.x * distance + (horizontal ? em.decalage * PIECE.taille : 0),
    y: p.y + d.y * distance + (horizontal ? 0 : em.decalage * PIECE.taille),
    sens: em.cote,
  }
}

/** La boîte d'un module placé là : large le long du bord qu'il regarde, profond vers lui. */
export function boiteModule(p: Place): Boite {
  const droit = p.sens % 2 === 0
  return { x: p.x, y: p.y, largeur: droit ? MODULE.largeur : MODULE.profondeur, hauteur: droit ? MODULE.profondeur : MODULE.largeur }
}

export function boiteProducteur(p: { x: number; y: number }): Boite {
  return { x: p.x, y: p.y, largeur: PRODUCTEUR.largeur, hauteur: PRODUCTEUR.hauteur }
}

/** L'empreinte d'un générateur avec la place de tous ses modules possibles, tout autour. */
export function empreinte(p: { x: number; y: number }): Boite {
  return { x: p.x, y: p.y, largeur: PRODUCTEUR.largeur + 2 * MODULE.profondeur, hauteur: PRODUCTEUR.hauteur + 2 * MODULE.profondeur }
}

function seChevauchent(a: Boite, b: Boite): boolean {
  return Math.abs(a.x - b.x) < (a.largeur + b.largeur) / 2 - 1 && Math.abs(a.y - b.y) < (a.hauteur + b.hauteur) / 2 - 1
}

/** Où est chaque module emboîté (son centre, le sens de sa face). */
export function disposition(j: Joueur): Map<number, Place> {
  const out = new Map<number, Place>()
  for (const mo of j.modules) {
    const p = mo.parent === null ? undefined : producteurDe(j, mo.parent)
    if (p !== undefined) out.set(mo.id, placeSurProducteur(p, mo.emplacement))
  }
  return out
}

/** Ce qui occupe le plan et bloque : les corps des générateurs, et les modules emboîtés (sauf ceux qu'on tient en main). */
function occupation(j: Joueur, sauf?: ReadonlySet<number>, saufProducteur?: number): Boite[] {
  const out: Boite[] = []
  for (const p of j.producteurs) {
    if (p.id === saufProducteur) continue
    out.push(boiteProducteur(p))
    for (const mo of modulesDe(j, p)) if (sauf?.has(mo.id) !== true) out.push(boiteModule(placeSurProducteur(p, mo.emplacement)))
  }
  return out
}

/**
 * Les creux libres : chaque creux d'un générateur où rien n'est emboîté, et
 * dont la place n'est pas prise par autre chose. `sauf` : des modules qu'on
 * tient en main — ni leurs creux, ni leurs places ne comptent.
 */
export function prisesLibres(j: Joueur, sauf?: ReadonlySet<number>): Prise[] {
  const occupees = occupation(j, sauf)
  const prises = new Set<string>()
  for (const mo of j.modules) if (mo.parent !== null && sauf?.has(mo.id) !== true) prises.add(`${mo.parent}:${mo.emplacement}`)
  const out: Prise[] = []
  for (const p of j.producteurs) {
    typeDe(p).creux.forEach((forme, e) => {
      if (forme === null || prises.has(`${p.id}:${e}`)) return
      const place = placeSurProducteur(p, e)
      const boite = boiteModule(place)
      if (!occupees.some((o) => seChevauchent(o, boite))) out.push({ parent: p.id, emplacement: e, forme, place, occupant: null })
    })
  }
  return out
}

/** Ce que le plan occupe : la plus grande distance du centre à un bord, de côté ou vers le haut, et le bas du plus bas. */
export function etendue(j: Joueur): { rayon: number; bas: number } {
  let rayon = PRODUCTEUR.largeur / 2
  let bas = PRODUCTEUR.hauteur / 2
  const voir = (b: Boite): void => {
    rayon = Math.max(rayon, Math.abs(b.x) + b.largeur / 2, -(b.y - b.hauteur / 2))
    bas = Math.max(bas, b.y + b.hauteur / 2)
  }
  for (const p of j.producteurs) voir(boiteProducteur(p))
  const dispo = disposition(j)
  for (const mo of j.modules) {
    const pl = dispo.get(mo.id)
    if (pl !== undefined) voir(boiteModule(pl))
  }
  return { rayon: rayon + PIECE.encoche.profondeur, bas }
}

// ---------------------------------------------------------------------------
// LA PRODUCTION

export function multiplicateurPrestige(j: Joueur): number {
  return 1 + PRESTIGE.parPoint * j.points
}

/** Ce qu'un module pèse : son niveau, sa rareté, et ses traits « solide » et « rapide ». */
export function force(mo: { type: number; niveau: number; rarete: number; trait: Trait | null }): number {
  let f = mo.niveau * (RARETES.effet[mo.rarete] ?? 1)
  if (mo.trait === 'solide') f *= TRAITS.solide
  if (mo.trait === 'rapide' && mo.type === 0) f *= TRAITS.rapide
  return f
}

/**
 * L'effet d'un module d'un type à une force f (le niveau d'un commun) : pour
 * l'horloge, des déclenchements par seconde ; pour l'ajout, une part du lot de
 * base ; pour le multiplicateur, ce qu'il ajoute au ×1 ; pour le critique, une
 * chance.
 */
export function effet(type: number, f: number): number {
  switch (type) {
    case 0:
      return f / EFFETS.periode
    case 1:
      return EFFETS.ajout * f
    case 2:
      return EFFETS.multiplicateur * f
    default:
      return 1 - Math.pow(1 - EFFETS.critique, f)
  }
}

/** Ce qu'un module fait vraiment, à sa place : sa force, multipliée par les voisins « voisin ». */
export function effetDe(mo: { type: number; niveau: number; rarete: number; trait: Trait | null; emplacement: number }, voisins: readonly { trait: Trait | null; emplacement: number }[]): number {
  let f = force(mo)
  for (const v of voisins) {
    if (v === mo || v.trait !== 'voisin') continue
    const d = Math.abs(v.emplacement - mo.emplacement)
    if (d === 1 || d === EMPLACEMENTS.length - 1) f *= TRAITS.voisin
  }
  return effet(mo.type, f)
}

/** Ce qu'un générateur donne avec ses modules. */
export interface Bilan {
  /** Le lot d'un déclenchement ordinaire : de la matière (source), ou des modules par fournée (atelier). */
  lot: number
  /** La chance qu'un déclenchement soit un coup critique (lot × `coup` ; sur un atelier, la rareté monte). */
  chance: number
  /** Le lot moyen, critiques comprises (source) ; le lot (atelier). */
  lotMoyen: number
  /** Les déclenchements par seconde des horloges. */
  frequence: number
  /** Le lot moyen fois la fréquence : de la matière par seconde, ou des modules par seconde. */
  debit: number
}

export type ModuleAgissant = { type: number; niveau: number; rarete: number; trait: Trait | null; emplacement: number }

/** Le bilan d'un lot de base avec ces modules : les ajouts s'additionnent, les multiplicateurs se multiplient, les chances de critique se composent, les horloges s'ajoutent. */
export function bilan(lot0: number, mods: readonly ModuleAgissant[], prestige: number, atelier: boolean): Bilan {
  let ajout = 0
  let mult = 1
  let sansCritique = 1
  let frequence = 0
  for (const mo of mods) {
    const e = effetDe(mo, mods)
    if (mo.type === 0) frequence += e
    else if (mo.type === 1) ajout += e
    else if (mo.type === 2) mult *= 1 + e
    else sansCritique *= 1 - e
  }
  const chance = 1 - sansCritique
  const lot = lot0 * (atelier ? 1 : prestige) * (1 + ajout) * mult
  const lotMoyen = atelier ? lot : lot * (1 + (EFFETS.coup - 1) * chance)
  return { lot, chance, lotMoyen, frequence, debit: lotMoyen * frequence }
}

/** Le bilan d'un générateur tel qu'il est équipé. */
export function bilanProducteur(j: Joueur, p: Producteur): Bilan {
  return bilan(typeDe(p).lot, modulesDe(j, p), multiplicateurPrestige(j), estAtelier(p))
}

/** La production du joueur, en matière par seconde : ses sources, par leurs horloges. */
export function debit(j: Joueur): number {
  let d = 0
  for (const p of j.producteurs) if (!estAtelier(p)) d += bilanProducteur(j, p).debit
  return d
}

/** La source dont un déclenchement rapporte le plus : celle qu'on tape. */
export function meilleureSource(j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -1
  for (const p of j.producteurs) {
    if (estAtelier(p)) continue
    const v = bilanProducteur(j, p).lotMoyen
    if (v > max) {
      max = v
      meilleur = p
    }
  }
  return meilleur
}

/** La matière entre dans les comptes du joueur. */
function produire(j: Joueur, q: number): void {
  if (j.sorte === null || q <= 0) return
  j.matiere[j.sorte] = (j.matiere[j.sorte] ?? 0) + q
  j.produitRun += q
  j.total += q
}

/**
 * Déclenche une source (une tape) : elle produit son lot. `alea` (de 0 à 1)
 * décide du critique ; sans lui, le lot moyen (les bots, qui ne tirent rien).
 */
export function declencher(j: Joueur, p: Producteur, alea?: number): { gain: number; critique: boolean } {
  if (estAtelier(p) || j.sorte === null) return { gain: 0, critique: false }
  const b = bilanProducteur(j, p)
  const critique = alea !== undefined && alea < b.chance
  const gain = alea === undefined ? b.lotMoyen : critique ? b.lot * EFFETS.coup : b.lot
  produire(j, gain)
  j.journal.tapes += 1
  return { gain, critique }
}

/** Une tape sur la meilleure source. */
export function taper(j: Joueur, alea?: number): number {
  return declencher(j, meilleureSource(j), alea).gain
}

// ---------------------------------------------------------------------------
// LES FOURNÉES : la matière devient des modules

/** La matière qu'une fournée de cet atelier consomme : un temps de la production du joueur (par ses horloges), au moins le plancher de son modèle. */
export function entree(j: Joueur, p: Producteur): number {
  const t = typeDe(p)
  return Math.ceil(Math.max(t.entree, debit(j) * 3600 * t.duree))
}

/** Le stock de la sorte que travaille cet atelier. */
export function stockPour(j: Joueur, p: Producteur): number {
  return j.matiere[p.forme] ?? 0
}

export function peutFabriquer(j: Joueur, p: Producteur): boolean {
  return estAtelier(p) && stockPour(j, p) + 1e-9 >= entree(j, p)
}

/** Les chances de chaque rareté pour cet atelier, normalisées. */
export function chancesDe(p: Producteur): number[] {
  const c = typeDe(p).chances
  const total = c.reduce((s, v) => s + v, 0)
  return RARETES.noms.map((_, r) => (total > 0 ? (c[r] ?? 0) / total : r === 0 ? 1 : 0))
}

/** Tire une rareté selon des chances normalisées. */
function tirerRarete(chances: readonly number[], alea: number): number {
  let cumul = 0
  for (let r = 0; r < chances.length; r++) {
    cumul += chances[r] ?? 0
    if (alea < cumul) return r
  }
  return chances.length - 1
}

/** Les traits qu'un module de cette forme peut porter. */
export function traitsPossibles(type: number): readonly Trait[] {
  return TRAITS.noms.filter((t) => t !== 'rapide' || type === 0)
}

/** Fabrique un module de cette forme, de rareté tirée selon l'atelier, la garantie et le critique de l'atelier ; il va dans la soute. */
function tirerModule(m: Monde, j: Joueur, p: Producteur, b: Bilan): Module {
  let rarete = tirerRarete(chancesDe(p), tirer(m, j))
  // LA GARANTIE : les fournées sans rare, sans épique, finissent par en donner un.
  if (rarete < 3 && j.sansEpique + 1 >= RARETES.sansEpique) rarete = 3
  else if (rarete < 2 && j.sansRare + 1 >= RARETES.sansRare) rarete = 2
  // LE CRITIQUE d'un atelier : la rareté monte d'un cran.
  if (tirer(m, j) < b.chance) rarete = Math.min(RARETES.noms.length - 1, rarete + 1)
  j.sansRare = rarete >= 2 ? 0 : j.sansRare + 1
  j.sansEpique = rarete >= 3 ? 0 : j.sansEpique + 1
  let trait: Trait | null = null
  if (rarete >= 1) {
    const possibles = traitsPossibles(p.forme)
    trait = possibles[Math.floor(tirer(m, j) * possibles.length)] ?? null
  }
  const mo: Module = { id: j.prochainId++, type: p.forme, rarete, trait, niveau: 1, parent: null, emplacement: 0 }
  j.modules.push(mo)
  return mo
}

/** Une fournée : l'atelier consomme sa matière et rend ses modules (le lot entier, et le reste en chance). Rend les modules, ou rien si la matière manque. */
export function fabriquer(m: Monde, j: Joueur, p: Producteur): Module[] {
  if (!peutFabriquer(j, p)) return []
  j.matiere[p.forme] = stockPour(j, p) - entree(j, p)
  p.fournees += 1
  const b = bilanProducteur(j, p)
  let n = Math.floor(b.lot)
  if (tirer(m, j) < b.lot - n) n += 1
  const faits: Module[] = []
  for (let k = 0; k < Math.max(1, n); k++) faits.push(tirerModule(m, j, p, b))
  j.journal.fournees += 1
  return faits
}

/** Ce que vaut en or un module commun de cette forme au niveau 1 : la base de ses niveaux. */
export function valeurModule(mo: { type: number; rarete: number }): number {
  return (MODULES[mo.type]?.valeur ?? 10) * (RARETES.valeur[mo.rarete] ?? 1)
}

/** Ce que vaut en moyenne un module qui sort de cet atelier. */
export function valeurMoyenne(p: Producteur): number {
  const chances = chancesDe(p)
  return chances.reduce((s, c, r) => s + c * valeurModule({ type: p.forme, rarete: r }), 0)
}

/** Change la sorte que travaille un atelier. */
export function regler(p: Producteur, forme: number): boolean {
  if (!estAtelier(p) || forme < 0 || forme >= FORMES) return false
  p.forme = forme
  p.progres = 0
  return true
}

// ---------------------------------------------------------------------------
// LES ACHATS

/** Le coût du prochain générateur d'un type (la base ne s'achète pas). */
export function coutProducteur(j: Joueur, i: number): number {
  const t = PRODUCTEURS[i]
  if (t === undefined || i === 0) return Infinity
  return Math.ceil(t.cout * Math.pow(ACHAT.croissance, j.achetes[i] ?? 0))
}

/**
 * Une source est visible dès qu'on l'a dévoilée — la suivante en possédant la
 * précédente, la première avec son second module — ou dès qu'on peut la
 * payer. Un atelier pareil : le premier toujours, les suivants en possédant le
 * précédent ou en pouvant le payer.
 */
export function visibleProducteur(j: Joueur, i: number): boolean {
  if (i <= 0 || i >= PRODUCTEURS.length) return false
  const payable = j.or + 1e-9 >= coutProducteur(j, i)
  if (i < PREMIER_ATELIER) return i < j.connusSources || payable
  const k = i - PREMIER_ATELIER
  return k < j.connusAteliers || payable
}

/**
 * Où apparaît un générateur neuf : les places d'une grille autour de la base
 * (une empreinte et un peu d'air), la plus proche de l'origine d'abord, dont
 * l'empreinte ne touche celle d'aucun autre.
 */
export function placeDApparition(j: Joueur, sauf?: number): { x: number; y: number } {
  const pasX = 5 * CASE
  const pasY = 3 * CASE
  const autres = j.producteurs.filter((p) => p.id !== sauf).map((p) => empreinte(p))
  const candidats: { x: number; y: number }[] = []
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) candidats.push({ x: a * pasX, y: b * pasY })
  // Les plus proches d'abord ; à distance égale, dessous plutôt qu'au-dessus, à droite plutôt qu'à gauche.
  candidats.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y) || q.y - p.y || q.x - p.x)
  for (const c of candidats) {
    const e = empreinte(c)
    if (!autres.some((o) => seChevauchent(o, e))) return c
  }
  return { x: 0, y: (j.producteurs.length + 1) * pasY }
}

export function peutAcheterProducteur(j: Joueur, i: number): boolean {
  return visibleProducteur(j, i) && j.or + 1e-9 >= coutProducteur(j, i)
}

/** Achète un générateur : il apparaît sur le plan, ses creux vides ; un atelier travaille d'abord la sorte du joueur. Rend le générateur, ou null. */
export function acheterProducteur(j: Joueur, i: number): Producteur | null {
  if (!peutAcheterProducteur(j, i)) return null
  const place = placeDApparition(j)
  j.or -= coutProducteur(j, i)
  j.achetes[i] = (j.achetes[i] ?? 0) + 1
  const p: Producteur = { id: j.prochainId++, type: i, x: place.x, y: place.y, forme: j.sorte ?? 0, progres: 0, fournees: 0 }
  j.producteurs.push(p)
  if (i < PREMIER_ATELIER) j.connusSources = Math.max(j.connusSources, Math.min(SOURCES.length, i + 2))
  else j.connusAteliers = Math.max(j.connusAteliers, Math.min(ATELIERS.length, i - PREMIER_ATELIER + 2))
  return p
}

/** Le coût du niveau suivant d'un module : une part de sa valeur, qui croît à chaque niveau ; moitié prix pour un « économe ». */
export function coutNiveau(mo: Module): number {
  return Math.ceil(valeurModule(mo) * NIVEAU.premier * Math.pow(NIVEAU.croissance, mo.niveau - 1) * (mo.trait === 'econome' ? TRAITS.econome : 1))
}

export function peutAmeliorer(j: Joueur, mo: Module): boolean {
  return j.or + 1e-9 >= coutNiveau(mo)
}

/** Monte un module d'un niveau, emboîté ou non. */
export function ameliorer(j: Joueur, mo: Module): boolean {
  if (!peutAmeliorer(j, mo)) return false
  j.or -= coutNiveau(mo)
  mo.niveau += 1
  return true
}

// ---------------------------------------------------------------------------
// L'EMBOÎTEMENT ET LES DÉPLACEMENTS

/**
 * Les creux où un module peut aller : libres et de sa forme, ou occupés par un
 * autre module de sa forme (qu'il remplacerait : l'autre irait à la soute).
 */
export function prisesPour(j: Joueur, mo: Module): Prise[] {
  const libres = prisesLibres(j, new Set([mo.id])).filter((p) => p.forme === mo.type)
  const occupees: Prise[] = []
  for (const autre of j.modules) {
    if (autre === mo || autre.parent === null || autre.type !== mo.type) continue
    const p = producteurDe(j, autre.parent)
    if (p === undefined) continue
    occupees.push({ parent: p.id, emplacement: autre.emplacement, forme: mo.type, place: placeSurProducteur(p, autre.emplacement), occupant: autre.id })
  }
  return [...libres, ...occupees]
}

/** Emboîte un module sur un creux de sa forme ; s'il est occupé, l'occupant va à la soute. Rend faux sinon. */
export function brancher(j: Joueur, mo: Module, parent: number, emplacement: number): boolean {
  const prise = prisesPour(j, mo).find((p) => p.parent === parent && p.emplacement === emplacement)
  if (prise === undefined) return false
  if (prise.occupant !== null) {
    const autre = moduleDe(j, prise.occupant)
    if (autre !== undefined) autre.parent = null
  }
  mo.parent = parent
  mo.emplacement = emplacement
  return true
}

/** Détache un module : il va dans la soute et n'agit plus sur rien. */
export function debrancher(mo: Module): void {
  mo.parent = null
}

/** Une tape par minute : ce qu'on compte à un générateur sans horloge, et au flux de matière d'un joueur sans production. */
const TAPE_NOMINALE = 1 / 60

/** Les fournées par seconde que cet atelier peut vraiment faire à cette fréquence : jamais plus que la matière du joueur n'en nourrit (sa production, plus une tape par minute sur sa meilleure source). */
export function fourneesParSeconde(j: Joueur, p: Producteur, frequence: number): number {
  const flux = debit(j) + bilanProducteur(j, meilleureSource(j)).lotMoyen * TAPE_NOMINALE
  return Math.min(frequence, flux / Math.max(1, entree(j, p)))
}

/** Ce que vaut un générateur, en or par seconde, à titre de comparaison : sa production au prix plein, ou la valeur des modules qu'il sort ; ses horloges, plus une tape par minute ; un atelier, jamais plus que la matière ne le nourrit. */
export function valeurDe(j: Joueur, p: Producteur, mods: readonly ModuleAgissant[]): number {
  const b = bilan(typeDe(p).lot, mods, multiplicateurPrestige(j), estAtelier(p))
  const frequence = b.frequence + TAPE_NOMINALE
  return estAtelier(p) ? b.lotMoyen * fourneesParSeconde(j, p, frequence) * valeurMoyenne(p) : b.lotMoyen * frequence * MARCHE.prix
}

/** Ce que rapporterait, au mieux, un module commun de niveau 1 de chaque forme : le besoin du joueur, forme par forme. */
export function besoins(j: Joueur): number[] {
  const out = Array.from({ length: FORMES }, () => 0)
  for (let f = 0; f < FORMES; f++) {
    const essai: Module = { id: -1, type: f, rarete: 0, trait: null, niveau: 1, parent: null, emplacement: 0 }
    for (const prise of prisesLibres(j)) {
      if (prise.forme !== f) continue
      const p = producteurDe(j, prise.parent)
      if (p === undefined) continue
      const mods = modulesDe(j, p)
      const gain = valeurDe(j, p, [...mods, { ...essai, emplacement: prise.emplacement }]) - valeurDe(j, p, mods)
      out[f] = Math.max(out[f] ?? 0, gain)
    }
  }
  return out
}

/** Le creux où ce module rapporterait le plus : libre, ou occupé par un module plus faible de sa forme. Null s'il n'y en a pas qui améliore quelque chose. */
export function meilleurePrise(j: Joueur, mo: Module): Prise | null {
  let meilleure: { prise: Prise; gain: number } | null = null
  for (const prise of prisesPour(j, mo)) {
    const p = producteurDe(j, prise.parent)
    if (p === undefined) continue
    const mods = modulesDe(j, p).filter((autre) => autre.id !== prise.occupant)
    const gain = valeurDe(j, p, [...mods, { ...mo, emplacement: prise.emplacement }]) - valeurDe(j, p, modulesDe(j, p))
    if (gain > 1e-12 && (meilleure === null || gain > meilleure.gain)) meilleure = { prise, gain }
  }
  return meilleure?.prise ?? null
}

/** Branche un module de la soute là où il rapporte le plus. Rend la prise, ou null. */
export function brancherAuMieux(j: Joueur, mo: Module): Prise | null {
  const prise = meilleurePrise(j, mo)
  if (prise === null || !brancher(j, mo, prise.parent, prise.emplacement)) return null
  return prise
}

/** Un générateur tiendrait-il là (au centre d'une case), avec ses modules, sans chevaucher un autre générateur ni ses modules ? */
export function producteurTient(j: Joueur, p: Producteur, x: number, y: number): boolean {
  const c = surLesCases(x, y)
  const autres = occupation(j, undefined, p.id)
  const boites = [boiteProducteur(c), ...modulesDe(j, p).map((mo) => boiteModule(placeSurProducteur(c, mo.emplacement)))]
  return !boites.some((b) => autres.some((o) => seChevauchent(o, b)))
}

/** Déplace un générateur (ses modules suivent) là où il tient, au centre d'une case. La base ne bouge pas. Rend faux sinon. */
export function deplacerProducteur(j: Joueur, p: Producteur, x: number, y: number): boolean {
  if (p.type === 0 || !producteurTient(j, p, x, y)) return false
  const c = surLesCases(x, y)
  p.x = c.x
  p.y = c.y
  return true
}

// ---------------------------------------------------------------------------
// LA FUSION

/** Les groupes de la soute qu'on peut fondre : par forme et rareté, au moins `FUSION` modules, sous la légendaire. */
export function fusibles(j: Joueur): { type: number; rarete: number; modules: Module[] }[] {
  const out: { type: number; rarete: number; modules: Module[] }[] = []
  for (let type = 0; type < FORMES; type++) {
    for (let rarete = 0; rarete < RARETES.noms.length - 1; rarete++) {
      const modules = soute(j).filter((mo) => mo.type === type && mo.rarete === rarete)
      if (modules.length >= FUSION) out.push({ type, rarete, modules })
    }
  }
  return out
}

/** Fond `FUSION` modules de la soute (les plus bas niveaux) en un de la rareté au-dessus, au meilleur de leurs niveaux, au trait retiré. Rend le module, ou null. */
export function fondre(m: Monde, j: Joueur, type: number, rarete: number): Module | null {
  const groupe = fusibles(j).find((g) => g.type === type && g.rarete === rarete)
  if (groupe === undefined) return null
  const partants = [...groupe.modules].sort((a, b) => a.niveau - b.niveau).slice(0, FUSION)
  const niveau = Math.max(...partants.map((mo) => mo.niveau))
  j.modules = j.modules.filter((mo) => !partants.includes(mo))
  const possibles = traitsPossibles(type)
  const trait = possibles[Math.floor(tirer(m, j) * possibles.length)] ?? null
  const mo: Module = { id: j.prochainId++, type, rarete: rarete + 1, trait, niveau, parent: null, emplacement: 0 }
  j.modules.push(mo)
  j.journal.fusions += 1
  return mo
}

// ---------------------------------------------------------------------------
// LE MARCHÉ

/** La demande visée d'une sorte : ce que tous ceux qui la produisent font en `tampon` heures. */
export function demandeVisee(m: Monde, sorte: number): number {
  let d = 0
  for (const j of m.joueurs) if (j.sorte === sorte) d += debit(j) * 3600 * MARCHE.tampon
  return Math.max(MARCHE.demandeMin, d)
}

export function demande(m: Monde, sorte: number): number {
  return m.marche.demande[sorte] ?? MARCHE.demandeMin
}

function volume(m: Monde, sorte: number): number {
  return m.marche.volume[sorte] ?? 0
}

/** Le prix d'une unité de cette sorte maintenant, pour un échange infinitésimal. */
export function prixCourant(m: Monde, sorte: number): number {
  return MARCHE.prix * Math.exp(-volume(m, sorte) / demande(m, sorte))
}

/** Ce que rapporte vendre `q` d'un coup : l'intégrale du prix de V à V + q. */
export function gainVente(m: Monde, sorte: number, q: number): number {
  if (q <= 0) return 0
  const d = demande(m, sorte)
  const v = volume(m, sorte)
  return MARCHE.prix * d * Math.exp(-v / d) * (1 - Math.exp(-q / d))
}

/** Ce que coûte acheter `q` d'un coup : l'intégrale du prix de V − q à V. */
export function coutAchat(m: Monde, sorte: number, q: number): number {
  if (q <= 0) return 0
  const d = demande(m, sorte)
  const v = volume(m, sorte)
  return MARCHE.prix * d * Math.exp(-v / d) * (Math.expm1(q / d))
}

/** Ce qu'on peut acheter de cette sorte avec `or`. */
export function quantitePour(m: Monde, sorte: number, or: number): number {
  if (or <= 0) return 0
  const d = demande(m, sorte)
  const v = volume(m, sorte)
  return d * Math.log1p(or / (MARCHE.prix * d * Math.exp(-v / d)))
}

/** Ce qu'on peut vendre de cette sorte avant que son prix tombe sous `plancher` fois le prix plein : vendre plus, c'est brader. */
export function venteRaisonnable(m: Monde, sorte: number, plancher: number): number {
  const d = demande(m, sorte)
  return Math.max(0, -volume(m, sorte) - d * Math.log(Math.max(1e-9, Math.min(1, plancher))))
}

function borner(m: Monde, sorte: number): void {
  const borne = MARCHE.bornes * demande(m, sorte)
  m.marche.volume[sorte] = Math.max(-borne, Math.min(borne, volume(m, sorte)))
}

/** Vend `q` de cette sorte (tout ce qu'on a si `q` dépasse) ; rend l'or gagné. */
export function vendre(m: Monde, j: Joueur, sorte: number, q: number, journaliser = true): number {
  const quantite = Math.min(q, j.matiere[sorte] ?? 0)
  if (quantite <= 0) return 0
  const or = gainVente(m, sorte, quantite)
  j.matiere[sorte] = (j.matiere[sorte] ?? 0) - quantite
  j.or += or
  m.marche.volume[sorte] = volume(m, sorte) + quantite
  borner(m, sorte)
  j.journal.orVentes += or
  if (journaliser) j.journal.ventes += 1
  return or
}

/** Achète `q` de cette sorte si l'or suffit ; rend l'or dépensé, ou 0. */
export function acheter(m: Monde, j: Joueur, sorte: number, q: number): number {
  if (q <= 0) return 0
  const cout = coutAchat(m, sorte, q)
  if (j.or + 1e-9 < cout) return 0
  j.or -= cout
  j.matiere[sorte] = (j.matiere[sorte] ?? 0) + q
  m.marche.volume[sorte] = volume(m, sorte) - q
  borner(m, sorte)
  j.journal.orAchats += cout
  j.journal.achats += 1
  return cout
}

/** La fortune d'un joueur : son or, et ce que vaudrait sa matière au prix courant. */
export function fortune(m: Monde, j: Joueur): number {
  let f = j.or
  for (let s = 0; s < FORMES; s++) f += (j.matiere[s] ?? 0) * prixCourant(m, s)
  return f
}

// ---------------------------------------------------------------------------
// LE PRESTIGE

/** Les points que rapporterait un départ maintenant. */
export function pointsSi(j: Joueur): number {
  return Math.floor(Math.sqrt(j.produitRun / PRESTIGE.base))
}

export function peutPrestiger(j: Joueur): boolean {
  return pointsSi(j) >= 1
}

/** Tout remettre à zéro contre des points : la base nue, la soute vide, pas d'or ni de matière ; on rechoisit sa sorte. Ce qu'on connaît reste connu. */
export function prestiger(j: Joueur): boolean {
  const gain = pointsSi(j)
  if (gain < 1) return false
  j.points += gain
  j.prestiges += 1
  j.or = 0
  j.matiere = Array.from({ length: FORMES }, () => 0)
  j.achetes = PRODUCTEURS.map(() => 0)
  j.producteurs = [base()]
  j.modules = []
  j.produitRun = 0
  j.sorte = null
  return true
}

// ---------------------------------------------------------------------------
// LE TEMPS

/** Au plus tant de fournées d'un atelier par pas de temps : au-delà, c'est une avalanche de modules que personne ne lira. */
const FOURNEES_MAX_PAR_PAS = 60

/** Un atelier à horloges s'arrête quand la soute tient déjà tant de modules de sa forme : sinon il mangerait toute la matière du joueur absent pour des pièces que rien n'attend. Une tape le relance toujours. */
export const SOUTE_PLEINE = 3

/** L'atelier tournerait-il tout seul : ses horloges, sa matière, et une soute qui n'est pas déjà pleine de sa forme. */
export function atelierEnAttente(j: Joueur, p: Producteur): boolean {
  return estAtelier(p) && soute(j).filter((mo) => mo.type === p.forme).length >= SOUTE_PLEINE
}

/** Fait vivre le monde `dt` heures : les sources produisent par leurs horloges, les ateliers lancent leurs fournées, le marché respire. */
export function avancer(m: Monde, dt: number): void {
  if (dt <= 0) return
  for (const j of m.joueurs) {
    if (j.sorte === null) continue
    for (const p of j.producteurs) {
      const b = bilanProducteur(j, p)
      if (b.frequence <= 0) continue
      if (!estAtelier(p)) {
        produire(j, b.debit * 3600 * dt)
        continue
      }
      p.progres += b.frequence * 3600 * dt
      let n = 0
      while (p.progres >= 1 && n < FOURNEES_MAX_PAR_PAS && peutFabriquer(j, p) && !atelierEnAttente(j, p)) {
        fabriquer(m, j, p)
        p.progres -= 1
        n++
      }
      // Sans matière, l'atelier n'accumule pas des fournées en retard : il attend, prêt à en lancer une.
      p.progres = Math.min(p.progres, 1)
    }
  }
  const avant = m.t
  m.t += dt
  for (let s = 0; s < FORMES; s++) {
    m.marche.volume[s] = volume(m, s) * Math.pow(0.5, dt / MARCHE.demiVie)
    m.marche.demande[s] = demande(m, s) + (demandeVisee(m, s) - demande(m, s)) * (1 - Math.pow(0.5, dt / MARCHE.inertie))
    if (Math.floor(m.t + 1e-9) > Math.floor(avant + 1e-9)) {
      const h = m.marche.historique[s] ?? []
      h.push(prixCourant(m, s))
      if (h.length > 24 * 8) h.shift()
      m.marche.historique[s] = h
    }
  }
}
