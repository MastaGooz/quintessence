/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, aucun
 * hasard de son cru (un tirage lui est passé quand il en faut un). Tout ce
 * qu'un joueur peut faire passe par ici (déclencher un producteur, brûler le
 * minerai, acheter, emboîter, améliorer, prospecter, déplacer, quitter la
 * planète) ; `avancer` fait produire le monde.
 *
 * LES PRODUCTEURS ET LEURS MODULES (Keko, 31/10) : un producteur est un
 * rectangle creusé de prises femelles ; il produit un LOT de minerai à chaque
 * déclenchement, et une tape le déclenche. Un module est une pièce à une
 * bosse, qui s'emboîte dans un creux de sa forme sur un producteur et AGIT sur
 * lui : l'horloge le déclenche toute seule, l'ajout grossit son lot, le
 * multiplicateur le multiplie, le critique donne une chance qu'il soit
 * décuplé. Un module s'améliore niveau par niveau, et se déplace d'un
 * producteur à l'autre.
 *
 * LA PLANÈTE (Keko, 31/10) : le plan est une planète finie en zones ; le
 * robot (la base, offerte, au centre, qui ne bouge pas) mine à la main
 * partout ; les EXTRACTEURS (les producteurs achetés) ne produisent que posés
 * sur un gisement révélé, qu'ils vident ; on paie pour prospecter une zone qui
 * touche le connu ; on déplace un extracteur à sec vers un autre gisement.
 */
import { ACHAT, AUTO_COUT, CASE, EFFETS, EMPLACEMENTS, ENERGIE, MODULE, MODULES, NIVEAU, PIECE, PRESTIGE, PRODUCTEUR, PRODUCTEURS, PROSPECTION } from './donnees.ts'
import { engendrerPlanete, gisementEn, voisines, zoneEn, type Cellule, type Gisement, type Planete, type Zone } from './planete.ts'
import { graineDe } from '../rng.ts'

/** UN PRODUCTEUR : un exemplaire d'un type, posé sur le plan (son centre en pixels-monde, au centre d'une case). */
export interface Producteur {
  id: number
  type: number
  x: number
  y: number
}

/** UN MODULE : un exemplaire d'un type, emboîté sur un producteur ou posé sur le plan. */
export interface Module {
  id: number
  /** Le type, qui est aussi sa forme : 0 horloge (rond), 1 ajout (carré), 2 multiplicateur (triangle), 3 critique (trapèze). */
  type: number
  /** Le niveau d'amélioration, à partir de 1. */
  niveau: number
  /** Le prix payé : les niveaux en découlent. */
  prix: number
  /** Le producteur où il est emboîté, et l'emplacement (voir `EMPLACEMENTS`) ; null quand il est posé. */
  parent: number | null
  emplacement: number
  /** Posé : son centre et le côté vers lequel regarde sa face (0 haut, 1 droite, 2 bas, 3 gauche ; sa bosse est en face). Emboîté, tout cela découle du producteur. */
  x: number
  y: number
  sens: number
}

/** Ce que le joueur a changé à sa planète : la graine qui l'engendre, les zones révélées, et ce qui reste dans chaque gisement. */
export interface EtatPlanete {
  graine: number
  revelees: number[]
  restant: number[]
}

export interface Joueur {
  id: number
  nom: string
  /** Le minerai en main, pas encore brûlé. */
  r: number
  /** L'énergie : la monnaie. */
  or: number
  producteurs: Producteur[]
  modules: Module[]
  planete: EtatPlanete
  /** Le prochain identifiant, commun aux producteurs et aux modules. */
  prochainId: number
  /** Les exemplaires achetés de chaque type, emboîtés ou non : c'est eux que le coût suit. */
  achetesProducteurs: number[]
  achetesModules: number[]
  /** Les types que le joueur a déjà vus (le dévoilement survit au prestige). */
  connusProducteurs: number
  connusModules: number
  /** La raffinerie automatique : la production se brûle au fil de l'eau. */
  auto: boolean
  /** Les plans (les points de prestige) acquis. */
  points: number
  prestiges: number
  /** Le minerai produit depuis le dernier prestige, et depuis le début (le score). */
  produitRun: number
  total: number
  journal: { tapes: number; energie: number; brulages: number; prospections: number }
}

export interface Monde {
  /** L'heure de jeu, depuis le début de la saison. */
  t: number
  joueurs: Joueur[]
}

/** La base : le premier producteur, offert, au centre du plan. */
const BASE_ID = 1

function base(): Producteur {
  return { id: BASE_ID, type: 0, x: 0, y: 0 }
}

/** Une planète neuve : sa zone centrale révélée, tous ses gisements pleins. */
export function nouvellePlanete(graine: number): EtatPlanete {
  const planete = engendrerPlanete(graine)
  const centre = zoneEn(planete, 0, 0)
  return { graine, revelees: centre === undefined ? [] : [centre.id], restant: planete.gisements.map((g) => g.quantite) }
}

export function nouveauJoueur(id: number, nom: string, graine: number): Joueur {
  return {
    id,
    nom,
    r: 0,
    or: 0,
    producteurs: [base()],
    modules: [],
    planete: nouvellePlanete(graine),
    prochainId: BASE_ID + 1,
    achetesProducteurs: PRODUCTEURS.map(() => 0),
    achetesModules: MODULES.map(() => 0),
    connusProducteurs: 1,
    connusModules: 1,
    auto: false,
    points: 0,
    prestiges: 0,
    produitRun: 0,
    total: 0,
    journal: { tapes: 0, energie: 0, brulages: 0, prospections: 0 },
  }
}

/** Le monde d'une saison : tous les joueurs reçoivent la même planète (chacun la sienne, mais la même carte). */
export function nouveauMonde(noms: string[], graine: number): Monde {
  return { t: 0, joueurs: noms.map((n, i) => nouveauJoueur(i, n, graineDe(graine, 1))) }
}

export function producteurDe(j: Joueur, id: number): Producteur | undefined {
  return j.producteurs.find((p) => p.id === id)
}

export function moduleDe(j: Joueur, id: number): Module | undefined {
  return j.modules.find((mo) => mo.id === id)
}

/** Les modules emboîtés sur un producteur. */
export function modulesDe(j: Joueur, p: Producteur): Module[] {
  return j.modules.filter((mo) => mo.parent === p.id)
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

/** Un creux libre : le producteur, l'emplacement, sa forme, et où se placerait le module qui s'y emboîte. */
export interface Prise {
  parent: number
  emplacement: number
  forme: number
  place: Place
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

export function celluleDe(x: number, y: number): Cellule {
  return { i: Math.round(x / CASE), j: Math.round(y / CASE) }
}

export function centreDeCellule(c: Cellule): { x: number; y: number } {
  return { x: c.i * CASE, y: c.j * CASE }
}

/** Les trois cases qu'occupe le corps d'un producteur centré là. */
export function casesDuCorps(x: number, y: number): Cellule[] {
  const c = celluleDe(x, y)
  return [-1, 0, 1].map((d) => ({ i: c.i + d, j: c.j }))
}

/** Où s'emboîte un module à l'emplacement `e` d'un producteur centré en (x, y) : collé au bord, sa face vers l'extérieur. */
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

/** L'empreinte d'un producteur avec la place de tous ses modules possibles, tout autour. */
export function empreinte(p: { x: number; y: number }): Boite {
  return { x: p.x, y: p.y, largeur: PRODUCTEUR.largeur + 2 * MODULE.profondeur, hauteur: PRODUCTEUR.hauteur + 2 * MODULE.profondeur }
}

function seChevauchent(a: Boite, b: Boite): boolean {
  return Math.abs(a.x - b.x) < (a.largeur + b.largeur) / 2 - 1 && Math.abs(a.y - b.y) < (a.hauteur + b.hauteur) / 2 - 1
}

/** Où est chaque module (son centre, le sens de sa face) : les emboîtés suivent leur producteur ; les posés sont où on les a laissés. */
export function disposition(j: Joueur): Map<number, Place> {
  const out = new Map<number, Place>()
  for (const mo of j.modules) {
    const p = mo.parent === null ? undefined : producteurDe(j, mo.parent)
    out.set(mo.id, p === undefined ? { x: mo.x, y: mo.y, sens: mo.sens } : placeSurProducteur(p, mo.emplacement))
  }
  return out
}

/** Ce qui occupe le plan et bloque : les corps des producteurs, et les modules emboîtés (sauf ceux qu'on tient en main). */
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
 * Les creux libres : chaque creux d'un producteur où rien n'est emboîté, et
 * dont la place n'est pas prise par autre chose. `sauf` : des modules qu'on
 * tient en main — ni leurs creux, ni leurs places ne comptent.
 */
export function prisesLibres(j: Joueur, sauf?: ReadonlySet<number>): Prise[] {
  const occupees = occupation(j, sauf)
  const prises = new Set<string>()
  for (const mo of j.modules) if (mo.parent !== null && sauf?.has(mo.id) !== true) prises.add(`${mo.parent}:${mo.emplacement}`)
  const out: Prise[] = []
  for (const p of j.producteurs) {
    const type = PRODUCTEURS[p.type]
    if (type === undefined) continue
    type.creux.forEach((forme, e) => {
      if (forme === null || prises.has(`${p.id}:${e}`)) return
      const place = placeSurProducteur(p, e)
      const boite = boiteModule(place)
      if (!occupees.some((o) => seChevauchent(o, boite))) out.push({ parent: p.id, emplacement: e, forme, place })
    })
  }
  return out
}

/** Ce que le plan occupe : la plus grande distance du centre à un bord, de côté ou vers le haut, et le bas du plus bas. `tout` compte aussi les modules posés. */
export function etendue(j: Joueur, tout = true): { rayon: number; bas: number } {
  let rayon = PRODUCTEUR.largeur / 2
  let bas = PRODUCTEUR.hauteur / 2
  const voir = (b: Boite): void => {
    rayon = Math.max(rayon, Math.abs(b.x) + b.largeur / 2, -(b.y - b.hauteur / 2))
    bas = Math.max(bas, b.y + b.hauteur / 2)
  }
  for (const p of j.producteurs) voir(boiteProducteur(p))
  const dispo = disposition(j)
  for (const mo of j.modules) if (tout || mo.parent !== null) voir(boiteModule(dispo.get(mo.id)!))
  return { rayon: rayon + PIECE.encoche.profondeur, bas }
}

// ---------------------------------------------------------------------------
// LA PLANÈTE DU JOUEUR

export function planeteDe(j: Joueur): Planete {
  return engendrerPlanete(j.planete.graine)
}

export function zoneRevelee(j: Joueur, zone: number): boolean {
  return j.planete.revelees.includes(zone)
}

/** Ce qui reste dans un gisement. */
export function restant(j: Joueur, gisement: number): number {
  return j.planete.restant[gisement] ?? 0
}

/** Le gisement sous un producteur centré là : ses trois cases dans le même gisement, d'une zone révélée. Null sinon. */
export function gisementSous(j: Joueur, x: number, y: number): Gisement | null {
  const planete = planeteDe(j)
  const cases = casesDuCorps(x, y)
  const g = gisementEn(planete, cases[0]!)
  if (g === null) return null
  for (const c of cases) if (gisementEn(planete, c) !== g) return null
  const gisement = planete.gisements[g]
  if (gisement === undefined || !zoneRevelee(j, gisement.zone)) return null
  return gisement
}

/** Le gisement d'un producteur : la base n'en a pas besoin, elle mine partout. */
export function gisementDe(j: Joueur, p: Producteur): Gisement | null {
  return p.type === 0 ? null : gisementSous(j, p.x, p.y)
}

/** Un producteur produit-il là où il est : la base toujours ; un extracteur s'il a du minerai sous lui. */
export function peutProduire(j: Joueur, p: Producteur): boolean {
  if (p.type === 0) return true
  const g = gisementDe(j, p)
  return g !== null && restant(j, g.id) > 0
}

/** Ce que la veine sous un producteur laisse passer, en minerai par seconde : sans limite pour la base, rien hors gisement. Les plans (le prestige) l'élargissent comme ils grossissent les lots : sinon ils ne serviraient à rien sur une veine pleine. */
export function plafond(j: Joueur, p: Producteur): number {
  if (p.type === 0) return Infinity
  const g = gisementDe(j, p)
  return g === null ? 0 : (g.debit / 3600) * multiplicateurPrestige(j)
}

/** La production continue d'un producteur, en minerai par seconde : ses horloges, bornées par sa veine, et rien s'il est à sec. */
export function debitReel(j: Joueur, p: Producteur): number {
  if (!peutProduire(j, p)) return 0
  return Math.min(bilanProducteur(j, p).debit, plafond(j, p))
}

/** Un extracteur dont les horloges donneraient plus que sa veine ne laisse passer : il lui faut une veine plus riche. */
export function limiteParLaVeine(j: Joueur, p: Producteur): boolean {
  return p.type !== 0 && peutProduire(j, p) && bilanProducteur(j, p).debit > plafond(j, p) * 1.001
}

/** Les gisements révélés, avec ce qui leur reste et les extracteurs posés dessus. */
export function gisementsConnus(j: Joueur): { gisement: Gisement; zone: Zone; restant: number; extracteurs: Producteur[] }[] {
  const planete = planeteDe(j)
  const out: { gisement: Gisement; zone: Zone; restant: number; extracteurs: Producteur[] }[] = []
  for (const zoneId of j.planete.revelees) {
    const zone = planete.zones[zoneId]
    if (zone === undefined || zone.gisement === null) continue
    const gisement = planete.gisements[zone.gisement]
    if (gisement === undefined) continue
    out.push({ gisement, zone, restant: restant(j, gisement.id), extracteurs: j.producteurs.filter((p) => p.type !== 0 && gisementDe(j, p)?.id === gisement.id) })
  }
  return out
}

/** Les zones qu'on peut prospecter : inconnues, et voisines d'une zone révélée. */
export function frontiere(j: Joueur): Zone[] {
  const planete = planeteDe(j)
  const connues = new Set(j.planete.revelees)
  const vues = new Set<number>()
  const out: Zone[] = []
  for (const id of j.planete.revelees) {
    const z = planete.zones[id]
    if (z === undefined) continue
    for (const v of voisines(planete, z)) {
      if (connues.has(v.id) || vues.has(v.id)) continue
      vues.add(v.id)
      out.push(v)
    }
  }
  return out
}

export function coutProspection(z: Zone): number {
  return Math.ceil(PROSPECTION.premier * Math.pow(PROSPECTION.croissance, Math.max(0, z.anneau - 1)))
}

export function peutProspecter(j: Joueur, z: Zone): boolean {
  return !zoneRevelee(j, z.id) && frontiere(j).some((f) => f.id === z.id) && j.or + 1e-9 >= coutProspection(z)
}

/** Révèle une zone contre de l'énergie. Rend la zone (son gisement, ou rien), ou null. */
export function prospecter(j: Joueur, z: Zone): Zone | null {
  if (!peutProspecter(j, z)) return null
  j.or -= coutProspection(z)
  j.planete.revelees.push(z.id)
  j.journal.prospections += 1
  return z
}

/** Ce que la planète contenait, et ce qu'il en reste, tous gisements confondus (révélés ou non). */
export function bilanPlanete(j: Joueur): { quantite: number; restant: number } {
  const planete = planeteDe(j)
  let quantite = 0
  let reste = 0
  for (const g of planete.gisements) {
    quantite += g.quantite
    reste += restant(j, g.id)
  }
  return { quantite, restant: reste }
}

// ---------------------------------------------------------------------------
// LA PRODUCTION

export function multiplicateurPrestige(j: Joueur): number {
  return 1 + PRESTIGE.parPoint * j.points
}

/**
 * L'effet d'un module d'un type à un niveau : pour l'horloge, des
 * déclenchements par seconde ; pour l'ajout, une part du lot de base ; pour le
 * multiplicateur, ce qu'il ajoute au ×1 ; pour le critique, une chance. Le
 * niveau L vaut L fois le premier.
 */
export function effet(type: number, niveau: number): number {
  const f = niveau
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

/** Ce qu'un producteur donne avec ses modules. */
export interface Bilan {
  /** Le lot d'un déclenchement ordinaire, en minerai. */
  lot: number
  /** La chance qu'un déclenchement soit un coup critique (lot × `coup`). */
  chance: number
  /** Le lot moyen, critiques comprises. */
  lotMoyen: number
  /** Les déclenchements par seconde des horloges. */
  frequence: number
  /** La production par seconde : le lot moyen fois la fréquence. */
  debit: number
}

/** Le bilan d'un lot de base avec ces modules : les ajouts s'additionnent, les multiplicateurs se multiplient, les chances de critique se composent, les horloges s'ajoutent. */
export function bilan(lot0: number, mods: readonly { type: number; niveau: number }[], prestige: number): Bilan {
  let ajout = 0
  let mult = 1
  let sansCritique = 1
  let frequence = 0
  for (const mo of mods) {
    const e = effet(mo.type, mo.niveau)
    if (mo.type === 0) frequence += e
    else if (mo.type === 1) ajout += e
    else if (mo.type === 2) mult *= 1 + e
    else sansCritique *= 1 - e
  }
  const chance = 1 - sansCritique
  const lot = lot0 * prestige * (1 + ajout) * mult
  const lotMoyen = lot * (1 + (EFFETS.coup - 1) * chance)
  return { lot, chance, lotMoyen, frequence, debit: lotMoyen * frequence }
}

/** Le bilan d'un producteur tel qu'il est équipé : ce qu'il donnerait sur du minerai. */
export function bilanProducteur(j: Joueur, p: Producteur): Bilan {
  return bilan(PRODUCTEURS[p.type]?.lot ?? 0, modulesDe(j, p), multiplicateurPrestige(j))
}

/** La production du joueur, en minerai par seconde : ses producteurs qui ont de quoi produire, par leurs horloges, chacun borné par sa veine. */
export function debit(j: Joueur): number {
  let d = 0
  for (const p of j.producteurs) d += debitReel(j, p)
  return d
}

/** Le producteur dont un déclenchement rapporte le plus, parmi ceux qui ont de quoi produire : celui qu'on tape. */
export function meilleurProducteur(j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -1
  for (const p of j.producteurs) {
    if (!peutProduire(j, p)) continue
    const v = bilanProducteur(j, p).lotMoyen
    if (v > max) {
      max = v
      meilleur = p
    }
  }
  return meilleur
}

/** Le minerai entre dans les comptes du joueur ; un extracteur le prend à son gisement. Rend ce qui a vraiment été produit. */
function extraire(j: Joueur, p: Producteur, voulu: number): number {
  let gain = voulu
  if (p.type !== 0) {
    const g = gisementDe(j, p)
    if (g === null) return 0
    gain = Math.min(voulu, restant(j, g.id))
    j.planete.restant[g.id] = restant(j, g.id) - gain
  }
  j.r += gain
  j.produitRun += gain
  j.total += gain
  return gain
}

/**
 * Déclenche un producteur (une tape) : il produit son lot, s'il a du minerai
 * sous lui. `alea` (de 0 à 1) décide du critique ; sans lui, le lot moyen (les
 * bots, qui ne tirent rien).
 */
export function declencher(j: Joueur, p: Producteur, alea?: number): { gain: number; critique: boolean } {
  const b = bilanProducteur(j, p)
  const critique = alea !== undefined && alea < b.chance
  const voulu = alea === undefined ? b.lotMoyen : critique ? b.lot * EFFETS.coup : b.lot
  const gain = extraire(j, p, voulu)
  j.journal.tapes += 1
  return { gain, critique: critique && gain > 0 }
}

/** Une tape sur le meilleur producteur. */
export function taper(j: Joueur, alea?: number): number {
  return declencher(j, meilleurProducteur(j), alea).gain
}

// ---------------------------------------------------------------------------
// LES ACHATS

/** Le coût du prochain producteur d'un type (la base ne s'achète pas). */
export function coutProducteur(j: Joueur, i: number): number {
  const t = PRODUCTEURS[i]
  if (t === undefined || i === 0) return Infinity
  return Math.ceil(t.cout * Math.pow(ACHAT.croissance, j.achetesProducteurs[i] ?? 0))
}

/**
 * Un type de producteur est visible dès qu'on l'a dévoilé — le suivant en
 * possédant le précédent, le premier avec son second module — ou dès qu'on
 * peut le payer : un producteur qu'on n'a pas envie d'acheter ne cache pas
 * ceux d'après.
 */
export function visibleProducteur(j: Joueur, i: number): boolean {
  return i < j.connusProducteurs || (i > 0 && j.or + 1e-9 >= coutProducteur(j, i))
}

/** Une place sur un gisement : le centre de la case, et le gisement. */
export interface PlaceLibre {
  x: number
  y: number
  gisement: Gisement
}

/**
 * Les places libres sur les gisements révélés qui ont du minerai, une par
 * gisement : la veine la plus riche d'abord (puis la plus pleine), et dessus
 * la première case (de haut en bas, de gauche à droite) où le corps tient dans
 * le gisement et où l'empreinte entière (la place de tous les modules) ne
 * touche l'empreinte d'aucun autre producteur. `sauf` : un producteur qu'on
 * déplace, qui ne se gêne pas lui-même.
 */
export function placesLibres(j: Joueur, sauf?: number): PlaceLibre[] {
  const planete = planeteDe(j)
  const autres = j.producteurs.filter((p) => p.id !== sauf).map((p) => empreinte(p))
  const connus = gisementsConnus(j)
    .filter((g) => g.restant > 0)
    .sort((a, b) => b.gisement.debit - a.gisement.debit || b.restant - a.restant)
  const out: PlaceLibre[] = []
  for (const { gisement } of connus) {
    // La case la plus proche du milieu du gisement d'abord : l'extracteur se pose au centre de sa veine, pas dans un coin.
    const ci = gisement.cellules.reduce((s, c) => s + c.i, 0) / gisement.cellules.length
    const cj = gisement.cellules.reduce((s, c) => s + c.j, 0) / gisement.cellules.length
    const cases = [...gisement.cellules].sort((a, b) => Math.hypot(a.i - ci, a.j - cj) - Math.hypot(b.i - ci, b.j - cj) || a.j - b.j || a.i - b.i)
    for (const c of cases) {
      if (gisementEn(planete, { i: c.i - 1, j: c.j }) !== gisement.id || gisementEn(planete, { i: c.i + 1, j: c.j }) !== gisement.id) continue
      const centre = centreDeCellule(c)
      const e = empreinte(centre)
      if (!autres.some((o) => seChevauchent(o, e))) {
        out.push({ ...centre, gisement })
        break
      }
    }
  }
  return out
}

/** La meilleure place libre : sur la veine la plus riche. */
export function placeLibre(j: Joueur, sauf?: number): PlaceLibre | null {
  return placesLibres(j, sauf)[0] ?? null
}

/** Où apparaît un producteur qu'on vient d'acheter : la meilleure place libre sur un gisement ; null s'il n'y en a pas (il faut prospecter, ou déplacer). */
export function placeDApparitionProducteur(j: Joueur): PlaceLibre | null {
  return placeLibre(j)
}

export function peutAcheterProducteur(j: Joueur, i: number): boolean {
  return i > 0 && visibleProducteur(j, i) && j.or + 1e-9 >= coutProducteur(j, i) && placeDApparitionProducteur(j) !== null
}

/** Achète un producteur : il apparaît sur un gisement, ses creux vides. Rend le producteur, ou null. */
export function acheterProducteur(j: Joueur, i: number): Producteur | null {
  if (!peutAcheterProducteur(j, i)) return null
  const place = placeDApparitionProducteur(j)
  if (place === null) return null
  j.or -= coutProducteur(j, i)
  j.achetesProducteurs[i] = (j.achetesProducteurs[i] ?? 0) + 1
  const p: Producteur = { id: j.prochainId++, type: i, x: place.x, y: place.y }
  j.producteurs.push(p)
  j.connusProducteurs = Math.max(j.connusProducteurs, Math.min(PRODUCTEURS.length, i + 2))
  return p
}

/** Le coût du prochain module d'un type. */
export function coutModule(j: Joueur, k: number): number {
  const t = MODULES[k]
  if (t === undefined) return Infinity
  return Math.ceil(t.cout * Math.pow(ACHAT.croissance, j.achetesModules[k] ?? 0))
}

/** Un type de module est visible dès qu'on possède le précédent (le dévoilement survit au prestige). */
export function visibleModule(j: Joueur, k: number): boolean {
  return k < j.connusModules
}

export function peutAcheterModule(j: Joueur, k: number): boolean {
  return visibleModule(j, k) && j.or + 1e-9 >= coutModule(j, k)
}

/** Où apparaît un module qu'on vient d'acheter : au-dessus du robot (sa veine est dessous), en rang, hors de portée de l'aimant de son creux du haut. */
export function placeDApparitionModule(j: Joueur): { x: number; y: number } {
  const n = j.modules.filter((mo) => mo.parent === null).length
  const pas = PIECE.taille + 30
  // Le premier au milieu, puis de part et d'autre ; une rangée de plus au-dessus tous les cinq.
  const colonnes = [0, 1, -1, 2, -2]
  const premiereRangee = PRODUCTEUR.hauteur / 2 + MODULE.profondeur + 35 + MODULE.profondeur / 2
  return { x: (colonnes[n % 5] ?? 0) * pas, y: -(premiereRangee + Math.floor(n / 5) * (MODULE.profondeur + 20)) }
}

/** Achète un module : il apparaît posé, à emboîter. Rend le module, ou null. */
export function acheterModule(j: Joueur, k: number): Module | null {
  if (!peutAcheterModule(j, k)) return null
  const prix = coutModule(j, k)
  j.or -= prix
  j.achetesModules[k] = (j.achetesModules[k] ?? 0) + 1
  const place = placeDApparitionModule(j)
  const mo: Module = { id: j.prochainId++, type: k, niveau: 1, prix, parent: null, emplacement: 0, x: place.x, y: place.y, sens: 0 }
  j.modules.push(mo)
  // Posséder un module dévoile le suivant ; le second dévoile le premier extracteur à acheter.
  j.connusModules = Math.max(j.connusModules, Math.min(MODULES.length, k + 2))
  if (j.achetesModules.reduce((s, n) => s + n, 0) >= 2) j.connusProducteurs = Math.max(j.connusProducteurs, 2)
  return mo
}

/** Le coût du niveau suivant d'un module : une part de son prix, qui croît à chaque niveau. */
export function coutNiveau(mo: Module): number {
  return Math.ceil(mo.prix * NIVEAU.premier * Math.pow(NIVEAU.croissance, mo.niveau - 1))
}

export function peutAmeliorer(j: Joueur, mo: Module): boolean {
  return j.or + 1e-9 >= coutNiveau(mo)
}

/** Monte un module d'un niveau, emboîté ou non (posé, il garde son niveau pour plus tard). */
export function ameliorer(j: Joueur, mo: Module): boolean {
  if (!peutAmeliorer(j, mo)) return false
  j.or -= coutNiveau(mo)
  mo.niveau += 1
  return true
}

// ---------------------------------------------------------------------------
// L'EMBOÎTEMENT ET LES DÉPLACEMENTS

/** Les creux où un module peut aller : libres, et de sa forme. */
export function prisesPour(j: Joueur, mo: Module): Prise[] {
  return prisesLibres(j, new Set([mo.id])).filter((p) => p.forme === mo.type)
}

/** Emboîte un module sur un creux libre de sa forme. Rend faux sinon. */
export function brancher(j: Joueur, mo: Module, parent: number, emplacement: number): boolean {
  const prise = prisesPour(j, mo).find((p) => p.parent === parent && p.emplacement === emplacement)
  if (prise === undefined) return false
  mo.parent = parent
  mo.emplacement = emplacement
  return true
}

/** Détache un module et le pose en (x, y), sa face vers `sens` : il n'agit plus sur rien. */
export function debrancher(mo: Module, x: number, y: number, sens: number): void {
  mo.parent = null
  mo.x = x
  mo.y = y
  mo.sens = sens
}

/** Déplace un module posé. */
export function deplacer(mo: Module, x: number, y: number): void {
  if (mo.parent !== null) return
  mo.x = x
  mo.y = y
}

/** Un producteur tiendrait-il là (au centre d'une case), avec ses modules, sans chevaucher un autre producteur ni ses modules ? Un extracteur veut en plus du minerai sous lui. */
export function producteurTient(j: Joueur, p: Producteur, x: number, y: number): boolean {
  const c = surLesCases(x, y)
  if (p.type !== 0) {
    const g = gisementSous(j, c.x, c.y)
    if (g === null || restant(j, g.id) <= 0) return false
  }
  const autres = occupation(j, undefined, p.id)
  const boites = [boiteProducteur(c), ...modulesDe(j, p).map((mo) => boiteModule(placeSurProducteur(c, mo.emplacement)))]
  return !boites.some((b) => autres.some((o) => seChevauchent(o, b)))
}

/** Déplace un producteur (ses modules suivent) là où il tient, au centre d'une case. La base ne bouge pas. Rend faux sinon. */
export function deplacerProducteur(j: Joueur, p: Producteur, x: number, y: number): boolean {
  if (p.type === 0 || !producteurTient(j, p, x, y)) return false
  const c = surLesCases(x, y)
  p.x = c.x
  p.y = c.y
  return true
}

/** Les extracteurs qui n'ont plus rien sous eux : à sec, ou hors gisement. */
export function extracteursASec(j: Joueur): Producteur[] {
  return j.producteurs.filter((p) => p.type !== 0 && !peutProduire(j, p))
}

/** Déplace chaque extracteur à sec vers la meilleure place libre, s'il y en a une ; les plus gros d'abord, pour qu'ils prennent les veines les plus riches. Rend ceux qui ont bougé. */
export function deplacerLesExtracteursASec(j: Joueur): Producteur[] {
  const bouges: Producteur[] = []
  const secs = extracteursASec(j).sort((a, b) => bilanProducteur(j, b).debit - bilanProducteur(j, a).debit)
  for (const p of secs) {
    const place = placeLibre(j, p.id)
    if (place === null) break
    p.x = place.x
    p.y = place.y
    bouges.push(p)
  }
  return bouges
}

/**
 * Déplace les extracteurs que leur veine bride vers une veine plus riche
 * libre, quand il y en a une (les plus bridés d'abord). Ce qu'un joueur
 * attentif ferait en revenant d'une prospection. Rend ceux qui ont bougé.
 */
export function deplacerLesExtracteursBrides(j: Joueur): Producteur[] {
  const bouges: Producteur[] = []
  for (let n = 0; n < 20; n++) {
    const brides = j.producteurs
      .filter((p) => limiteParLaVeine(j, p))
      .sort((a, b) => bilanProducteur(j, b).debit - plafond(j, b) - (bilanProducteur(j, a).debit - plafond(j, a)))
    let bouge = false
    for (const p of brides) {
      const place = placeLibre(j, p.id)
      if (place === null || place.gisement.debit / 3600 <= plafond(j, p)) continue
      p.x = place.x
      p.y = place.y
      bouges.push(p)
      bouge = true
      break
    }
    if (!bouge) break
  }
  return bouges
}

/**
 * Les modules d'un producteur qui trouveraient un creux de leur forme sur un
 * producteur d'un type donné, les plus forts d'abord : ce qu'une migration
 * emporterait. Sans rien changer.
 */
export function migrables(j: Joueur, de: Producteur, typeVers: number): Module[] {
  const creux = PRODUCTEURS[typeVers]?.creux ?? []
  const libres = [0, 1, 2, 3].map((forme) => creux.filter((c) => c === forme).length)
  const out: Module[] = []
  for (const mo of modulesDe(j, de).sort((a, b) => b.niveau - a.niveau)) {
    if ((libres[mo.type] ?? 0) <= 0) continue
    libres[mo.type] = (libres[mo.type] ?? 0) - 1
    out.push(mo)
  }
  return out
}

/** Déplace les modules d'un producteur vers un autre, les plus forts d'abord, chacun sur un creux libre de sa forme. Rend ceux qui ont bougé. */
export function migrer(j: Joueur, de: Producteur, vers: Producteur): Module[] {
  const bouges: Module[] = []
  for (const mo of modulesDe(j, de).sort((a, b) => b.niveau - a.niveau)) {
    const prise = prisesPour(j, mo).find((p) => p.parent === vers.id)
    if (prise !== undefined && brancher(j, mo, prise.parent, prise.emplacement)) bouges.push(mo)
  }
  return bouges
}

export function peutAcheterAuto(j: Joueur): boolean {
  return !j.auto && j.or + 1e-9 >= AUTO_COUT
}

export function acheterAuto(j: Joueur): boolean {
  if (!peutAcheterAuto(j)) return false
  j.or -= AUTO_COUT
  j.auto = true
  return true
}

// ---------------------------------------------------------------------------
// L'ÉNERGIE

/** Ce que rapporte brûler `q` minerai. */
export function gainBrulage(q: number): number {
  return Math.max(0, q) * ENERGIE.parMinerai
}

/** Brûle `q` minerai du joueur (tout ce qu'il a si `q` dépasse) ; rend l'énergie gagnée. */
export function bruler(j: Joueur, q: number, journaliser = true): number {
  const quantite = Math.min(q, j.r)
  if (quantite <= 0) return 0
  const energie = gainBrulage(quantite)
  j.r -= quantite
  j.or += energie
  j.journal.energie += energie
  if (journaliser) j.journal.brulages += 1
  return energie
}

// ---------------------------------------------------------------------------
// QUITTER LA PLANÈTE (le prestige)

/** Les plans que rapporterait un départ maintenant. */
export function pointsSi(j: Joueur): number {
  return Math.floor(Math.sqrt(j.produitRun / PRESTIGE.base))
}

export function peutPrestiger(j: Joueur): boolean {
  return pointsSi(j) >= 1
}

/** Tout remettre à zéro contre des plans : une planète neuve, le robot nu. Ce qu'on connaît reste connu. */
export function prestiger(j: Joueur): boolean {
  const gain = pointsSi(j)
  if (gain < 1) return false
  j.points += gain
  j.prestiges += 1
  j.r = 0
  j.or = 0
  j.achetesProducteurs = PRODUCTEURS.map(() => 0)
  j.achetesModules = MODULES.map(() => 0)
  j.producteurs = [base()]
  j.modules = []
  j.produitRun = 0
  j.planete = nouvellePlanete(graineDe(j.planete.graine, 977))
  return true
}

// ---------------------------------------------------------------------------
// LE TEMPS

/** Fait vivre le monde `dt` heures : chaque producteur produit ce que sa veine lui laisse (et la raffinerie automatique brûle). */
export function avancer(m: Monde, dt: number): void {
  if (dt <= 0) return
  for (const j of m.joueurs) {
    for (const p of j.producteurs) {
      const d = debitReel(j, p)
      if (d > 0) extraire(j, p, d * 3600 * dt)
    }
    // La raffinerie automatique brûle tout ce qu'on a en main : la production, et les tapes.
    if (j.auto) bruler(j, j.r, false)
  }
  m.t += dt
}

/** La fortune d'un joueur : son énergie, et ce que donnerait son minerai brûlé. */
export function fortune(j: Joueur): number {
  return j.or + gainBrulage(j.r)
}
