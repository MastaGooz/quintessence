/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, le hasard
 * tiré d'une graine (le monde a la sienne, chaque joueur compte ses tirages).
 * Tout ce qu'un joueur peut faire passe par ici (déclencher un générateur,
 * régler une raffinerie, fabriquer un module, vendre, acheter, emboîter,
 * améliorer, fondre, déplacer, repartir de zéro) ; `avancer` fait vivre le
 * monde.
 *
 * LES COULEURS ET LES FORMES (Keko, 01/11) : une matière est une couleur et une
 * forme. Les SOURCES produisent les trois couleurs de base, rondes ; les
 * RAFFINERIES donnent une forme à une ronde ; les MÉLANGEURS font les trois
 * couleurs mélangées. Les MODULES se fabriquent dans la boutique avec la
 * matière formée de leur sorte, rareté tirée (Keko : « les générateurs et
 * transformateurs ne peuvent pas produire de modules, on doit les fabriquer
 * comme le reste puis les placer »). Un module est une pièce à une bosse, qui
 * s'emboîte dans un creux de sa forme (n'importe quelle couleur) et AGIT sur
 * le générateur : sa couleur dit la cible (rouge la tape, vert le lot, bleu le
 * temps), sa forme l'opération (carré ajoute, triangle multiplie, losange
 * donne une chance). Un module s'améliore niveau par niveau (en matière de sa
 * sorte), se déplace d'un générateur à l'autre, attend dans la SOUTE quand il
 * n'est branché nulle part ; trois modules de même sorte et même rareté se
 * fondent en un de la rareté au-dessus.
 *
 * Tout se paie en matière ; LE MARCHÉ est commun, un prix par sorte, et l'or
 * n'y sert qu'à échanger.
 *
 * LE DÉPART (Keko, 02/11) : la partie s'ouvre sur LA MINE D'OR seule, un carré
 * fixe au centre du plan : la tape remplit sa barre, qui paie la bourse ;
 * l'automatique (débloqué par la première quête) remplit sa réserve, chaque barre pleine met de l'or dans sa réserve (`avancerBarre`). Les
 * sources de couleur ne sont plus offertes ; le reste du moteur est là, et se
 * dévoilera quand Keko posera les briques suivantes (donjons, héros, ateliers).
 */
import {
  ACHAT, CASE, COULEURS, EFFETS, EMPLACEMENTS, FABRICATION, FAMILLES, FORMES, FUSION, MARCHE, MELANGE, MODULE, NIVEAU, NIVEAU_SOURCE, PIECE, PRESTIGE, PRIMAIRES, PRODUCTEUR,
  CONSTRUCTION, EFFETS_PRODUCTEUR, MARCHE_RESSOURCES, IDS_AMELIORATIONS_PRODUCTEUR, MAX_AMELIORATION_PRODUCTEUR, NIVEAU_MINE, NIVEAU_PRODUCTEUR, OFFRE_NIVEAU, PRODUCTEURS, QUETE_CONSTRUCTION, QUETES, RARETES, RESERVE_MINE, RESSOURCES, SORTES, AMELIORATIONS, EFFETS_MINE, IDS_AMELIORATIONS, TRAITS, TYPE_MINE, VALEUR_MODULE,
  aDuBleu, couleurDe, formeDe, partsDe, sorteDe,
  type Cout, type Genre, type IdAmelioration, type IdAmeliorationProducteur, type Qualite, type Quete, type Ressource, type Trait, type TypeProducteur,
} from './donnees.ts'
import { graineDe, rngDe } from '../rng.ts'

/** UN GÉNÉRATEUR : un exemplaire d'un type, posé sur le plan (son centre en pixels-monde, au centre d'une case). */
export interface Producteur {
  id: number
  /** L'indice dans `PRODUCTEURS`. */
  type: number
  x: number
  y: number
  /** Source : sa couleur (de base). Raffinerie : la couleur qu'elle travaille. Mélangeur : la couleur mélangée qu'il fait. */
  couleur: number
  /** Raffinerie : la forme qu'elle fait (1 à 3). Source, mélangeur : 0. */
  forme: number
  /** Source : son niveau, qui multiplie son lot de base. Mine : son niveau, qui ouvre ses améliorations (voir `NIVEAU_MINE`). */
  niveau: number
  /** Mine : les pièces ENTIÈRES qui attendent d'être récoltées (voir `RESERVE_MINE`). */
  reserve: number
  /** Mine : où en est sa barre, de 0 à 1 ; la tape et l'automatique la remplissent ensemble. */
  progres: number
  /** Producteur construit : le niveau de chacune de ses améliorations (absentes : 0). */
  ameliorations?: Partial<Record<IdAmeliorationProducteur, number>>
  /** Producteur construit : les améliorations que son dernier niveau offre, en attendant qu'on en choisisse une. */
  offre?: IdAmeliorationProducteur[] | null
}

/** UN MODULE : une pièce d'une couleur et d'une forme, d'une rareté, emboîtée sur un générateur ou dans la soute. */
export interface Module {
  id: number
  couleur: number
  /** 1 carré, 2 triangle, 3 losange : la forme de sa bosse. */
  forme: number
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
  /** L'or : ce que la mine rend, ce qu'on gagne et dépense au marché. */
  or: number
  /** L'or extrait de la mine depuis le début de la saison : le score. */
  orProduit: number
  /** La quête en cours (son rang), et l'or extrait quand elle a commencé. */
  quete: number
  queteDepuis: number
  /** L'automatique de la mine (0 ou 1), que donne son premier niveau gagné : il remplit la barre, et la réserve. */
  automatisation: number
  /** Le niveau de chaque amélioration de la mine (voir `AMELIORATIONS`). */
  ameliorations: Record<IdAmelioration, number>
  /** Les améliorations proposées par une quête de choix, en attendant qu'on en choisisse une. */
  offre: IdAmelioration[] | null
  /** Les pépites tombées, pas encore tapées ni perdues. */
  pepites: number
  /** Les ressources des producteurs construits (absentes des parties d'avant : rien). */
  ressources: Record<Ressource, number>
  /** Ses ordres à prix perso en attente au marché des ressources, et les derniers exécutés. */
  ordres?: Ordre[]
  executes?: OrdreExecute[]
  /** La matière en stock, par sorte (voir `sorteDe`). */
  matiere: number[]
  producteurs: Producteur[]
  modules: Module[]
  /** Le prochain identifiant, commun aux producteurs et aux modules. */
  prochainId: number
  /** Les exemplaires achetés de chaque type de générateur : c'est eux que le coût suit. */
  achetes: number[]
  /** Les modules fabriqués de chaque sorte depuis le dernier prestige : c'est eux que le coût de fabrication suit. */
  fabriques: number[]
  /** Par famille (l'ordre de `GENRES`), combien de modèles le joueur a déjà vus : le dévoilement survit au prestige. */
  connus: number[]
  /** Combien de qualités de fabrication le joueur a déjà vues. */
  connusQualites: number
  /** Les points de prestige acquis. */
  points: number
  prestiges: number
  /** La matière ronde produite par couleur de base depuis le dernier prestige : la couleur dominante du joueur. */
  produit: number[]
  /** La matière ronde produite depuis le dernier prestige, et depuis le début (le score). */
  produitRun: number
  total: number
  /** Les tirages faits : le hasard du joueur en découle, rejouable. */
  tirages: number
  /** Les fabrications depuis le dernier rare, le dernier épique : la garantie. */
  sansRare: number
  sansEpique: number
  journal: { tapes: number; fabrications: number; ventes: number; achats: number; orVentes: number; orAchats: number; fusions: number; recoltes: number; barres: number }
}

/** LE MARCHÉ : par sorte, le volume net vendu récemment, la demande suivie, et le prix de chaque heure passée. */
export interface Marche {
  volume: number[]
  demande: number[]
  historique: number[][]
  /** Le bois et la pierre (voir `MARCHE_RESSOURCES`) ; absents d'une partie d'avant : au repos. */
  ressources?: Partial<Record<Ressource, CoteRessource>>
  /** Les tirages des marchands (voir `MARCHE_RESSOURCES.agitation`). */
  tirages?: number
}

/** La cote d'une ressource au marché : son volume net vendu récemment, sa demande, et son prix heure par heure. */
export interface CoteRessource {
  volume: number
  demande: number
  historique: number[]
  /** Le prix en bougies (voir `MARCHE_RESSOURCES.bougie`), la dernière en dernier. */
  bougies?: Bougie[]
  /** Le prix plein, qui suit le déséquilibre des échanges (absent : `MARCHE_RESSOURCES.prix`). */
  plein?: number
}

/** Une bougie : le rang de sa période, et le prix à son ouverture, au plus haut, au plus bas, à sa clôture. */
export interface Bougie {
  t: number
  o: number
  h: number
  l: number
  c: number
}

/** UN ORDRE À PRIX PERSO, en attente : il s'exécute quand le prix du marché atteint le sien. `bloque` : l'or mis de côté pour un achat. */
export interface Ordre {
  id: number
  sens: 'achat' | 'vente'
  ressource: Ressource
  quantite: number
  prix: number
  bloque: number
}

/** Un ordre exécuté : ce qui s'est échangé, à quel prix, quand. */
export interface OrdreExecute {
  id: number
  sens: 'achat' | 'vente'
  ressource: Ressource
  quantite: number
  prix: number
  montant: number
  t: number
}

export interface Monde {
  /** L'heure de jeu, depuis le début de la saison. */
  t: number
  graine: number
  joueurs: Joueur[]
  marche: Marche
}

/** Aucune amélioration : tous les niveaux à zéro. */
export function niveauxVides(): Record<IdAmelioration, number> {
  return Object.fromEntries(IDS_AMELIORATIONS.map((id) => [id, 0])) as Record<IdAmelioration, number>
}

/** Le pas vertical des places d'apparition des générateurs. */
const PAS_Y = 3 * CASE

/** Ce qu'un joueur a au départ (et après un prestige) : la mine d'or seule, au centre du plan. */
function depart(): Producteur[] {
  return [{ id: 1, type: TYPE_MINE, x: 0, y: 0, couleur: 0, forme: 0, niveau: 1, reserve: 0, progres: 0 }]
}

export function nouveauJoueur(id: number, nom: string): Joueur {
  return {
    id,
    nom,
    or: 0,
    orProduit: 0,
    quete: 0,
    queteDepuis: 0,
    automatisation: 0,
    ameliorations: niveauxVides(),
    offre: null,
    pepites: 0,
    ressources: ressourcesVides(),
    matiere: Array.from({ length: SORTES }, () => 0),
    producteurs: depart(),
    modules: [],
    prochainId: 2,
    achetes: PRODUCTEURS.map(() => 0),
    fabriques: Array.from({ length: SORTES }, () => 0),
    // Rien n'est dévoilé au départ : la brique suivante de Keko dira ce que l'or ouvre.
    connus: [0, 0, 0, 0],
    connusQualites: 1,
    points: 0,
    prestiges: 0,
    produit: Array.from({ length: PRIMAIRES }, () => 0),
    produitRun: 0,
    total: 0,
    tirages: 0,
    sansRare: 0,
    sansEpique: 0,
    journal: { tapes: 0, fabrications: 0, ventes: 0, achats: 0, orVentes: 0, orAchats: 0, fusions: 0, recoltes: 0, barres: 0 },
  }
}

export function nouveauMonde(noms: string[], graine: number): Monde {
  return {
    t: 0,
    graine,
    joueurs: noms.map((n, i) => nouveauJoueur(i, n)),
    marche: {
      volume: Array.from({ length: SORTES }, () => 0),
      demande: Array.from({ length: SORTES }, () => MARCHE.demandeMin),
      historique: Array.from({ length: SORTES }, () => [MARCHE.prix]),
    },
  }
}

/** Un tirage du joueur, de 0 à 1 : la graine du monde, le joueur, et son compte de tirages. */
export function tirer(m: Monde, j: Joueur): number {
  const r = rngDe(graineDe(m.graine, j.id + 1, j.tirages + 1))()
  j.tirages += 1
  return r
}

export function typeDe(p: { type: number }): TypeProducteur {
  return PRODUCTEURS[p.type] ?? PRODUCTEURS[0]!
}

export function genreDe(p: { type: number }): Genre {
  return typeDe(p).genre
}

export function estSource(p: { type: number }): boolean {
  return genreDe(p) === 'source'
}

/** La mine d'or : elle rend de l'or, pas de la matière. */
export function estMine(p: { type: number }): boolean {
  return genreDe(p) === 'mine'
}

/** Un producteur construit (scierie, mine) : il produit une ressource. */
export function estConstruit(p: { type: number }): boolean {
  return genreDe(p) === 'ressource'
}

/** La ressource d'un producteur construit. */
export function ressourceDe(p: { type: number }): Ressource {
  return typeDe(p).ressource ?? 'bois'
}

function ressourcesVides(): Record<Ressource, number> {
  return Object.fromEntries(RESSOURCES.map((r) => [r, 0])) as Record<Ressource, number>
}

/** Le stock d'une ressource (0 dans une partie d'avant les ressources). */
export function stockRessource(j: Joueur, r: Ressource): number {
  return j.ressources?.[r] ?? 0
}

function gagnerRessource(j: Joueur, r: Ressource, q: number): void {
  j.ressources = { ...ressourcesVides(), ...j.ressources }
  j.ressources[r] += q
}

/** Un générateur de départ : offert, ni saisissable ni achetable, il reste au centre. */
export function estFixe(p: { type: number }): boolean {
  return p.type === 0 || estMine(p)
}

/** La taille d'un générateur sur le plan : celle de son type, ou le rectangle commun. */
export function tailleDe(p: { type?: number }): { largeur: number; hauteur: number } {
  return (p.type === undefined ? undefined : PRODUCTEURS[p.type]?.taille) ?? PRODUCTEUR
}

/** Le rang d'un type dans sa famille (0 : le premier modèle). */
export function rangDe(i: number): number {
  const t = PRODUCTEURS[i]
  return t === undefined ? 0 : i - FAMILLES[t.genre].premier
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

export function sorteModule(mo: { couleur: number; forme: number }): number {
  return sorteDe(mo.couleur, mo.forme)
}

/** La sorte qui sort d'un générateur : une ronde (source, mélangeur), une matière formée (raffinerie). */
export function sortie(p: Producteur): number {
  return sorteDe(p.couleur, p.forme)
}

/** Ce qu'un déclenchement consomme, par unité de lot : rien (source), la ronde de sa couleur (raffinerie), une ronde de chaque couleur de base du mélange (mélangeur). */
export function entrees(p: Producteur): number[] {
  switch (genreDe(p)) {
    case 'raffinerie':
      return [sorteDe(p.couleur, 0)]
    case 'melangeur': {
      const c = MELANGE.composants[p.couleur - PRIMAIRES] ?? [0, 1]
      return [sorteDe(c[0], 0), sorteDe(c[1], 0)]
    }
    default:
      return []
  }
}

/** Toutes les sortes formées (pas les rondes), dans l'ordre : les modules possibles. */
export function sortesFormees(): number[] {
  const out: number[] = []
  for (let c = 0; c < COULEURS; c++) for (let f = 1; f < FORMES; f++) out.push(sorteDe(c, f))
  return out
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
export function placeSurProducteur(p: { x: number; y: number; type?: number }, e: number): Place {
  const em = EMPLACEMENTS[e] ?? EMPLACEMENTS[0]!
  const d = DIRECTIONS[em.cote]!
  const horizontal = em.cote % 2 === 0
  const taille = tailleDe(p)
  const distance = (horizontal ? taille.hauteur : taille.largeur) / 2 + MODULE.profondeur / 2
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

export function boiteProducteur(p: { x: number; y: number; type?: number }): Boite {
  const taille = tailleDe(p)
  return { x: p.x, y: p.y, largeur: taille.largeur, hauteur: taille.hauteur }
}

/** L'empreinte d'un générateur avec la place de tous ses modules possibles, tout autour. */
export function empreinte(p: { x: number; y: number; type?: number }): Boite {
  const taille = tailleDe(p)
  return { x: p.x, y: p.y, largeur: taille.largeur + 2 * MODULE.profondeur, hauteur: taille.hauteur + 2 * MODULE.profondeur }
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

export type ModuleAgissant = { couleur: number; forme: number; niveau: number; rarete: number; trait: Trait | null; emplacement: number }

/** Ce qu'un module pèse : son niveau, sa rareté, et ses traits « solide » et « rapide » (ce dernier sur les modules qui ont du bleu). */
export function force(mo: { couleur: number; niveau: number; rarete: number; trait: Trait | null }): number {
  let f = mo.niveau * (RARETES.effet[mo.rarete] ?? 1)
  if (mo.trait === 'solide') f *= TRAITS.solide
  if (mo.trait === 'rapide' && aDuBleu(mo.couleur)) f *= TRAITS.rapide
  return f
}

/** La force d'un module à sa place : la sienne, multipliée par les voisins « voisin ». */
export function forceEnPlace(mo: ModuleAgissant, voisins: readonly { trait: Trait | null; emplacement: number }[]): number {
  let f = force(mo)
  for (const v of voisins) {
    if (v === mo || v.trait !== 'voisin') continue
    const d = Math.abs(v.emplacement - mo.emplacement)
    if (d === 1 || d === EMPLACEMENTS.length - 1) f *= TRAITS.voisin
  }
  return f
}

/**
 * L'effet d'une forme sur une cible, à une force f : le carré ajoute une part
 * du lot de base (sur le temps : des déclenchements par seconde, l'horloge) ;
 * le triangle, ce qu'il ajoute au ×1 ; le losange, une chance.
 */
export function effet(cible: number, forme: number, f: number): number {
  switch (forme) {
    case 1:
      return cible === 2 ? f / EFFETS.periode : EFFETS.ajout * f
    case 2:
      return EFFETS.multiplicateur * f
    default:
      return 1 - Math.pow(1 - EFFETS.chance, f)
  }
}

/** Ce qu'un module fait, cible par cible : [cible, valeur de l'effet]. Un module mélangé en a deux. */
export function effetsDe(mo: { couleur: number; forme: number }, f: number): [number, number][] {
  return partsDe(mo.couleur).map(([cible, part]) => [cible, effet(cible, mo.forme, f * part)])
}

/** Ce qu'un générateur donne avec ses modules. */
export interface Bilan {
  /** Le lot d'un déclenchement automatique : de la matière produite (source) ou convertie (raffinerie, mélangeur). */
  lot: number
  /** Le lot moyen, gros lots compris. */
  lotMoyen: number
  /** Ce qu'une tape rapporte (le rouge agit), sans critique ni gros lot. */
  tape: number
  /** La tape moyenne, critiques et gros lots compris. */
  tapeMoyenne: number
  /** La chance qu'une tape soit critique (× `coup`). */
  chanceCritique: number
  /** La chance qu'un déclenchement rende un gros lot (× `grosLot`). */
  chanceGrosLot: number
  /** Les déclenchements par seconde des horloges, triangles et losanges bleus compris. */
  frequence: number
  /** Le lot moyen fois la fréquence : de la matière par seconde. */
  debit: number
  /** Ce que multiplie un critique. */
  multCritique: number
}

/**
 * Le bilan d'un lot de base avec ces modules : par cible (0 la tape, 1 le lot,
 * 2 le temps), les carrés s'additionnent, les triangles se multiplient, les
 * chances des losanges se composent. Le lot vaut pour tout déclenchement ; la
 * tape y ajoute le rouge ; le temps fait la fréquence des horloges.
 */
export function bilan(lot0: number, mods: readonly ModuleAgissant[], prestige: number, horloge0 = 0): Bilan {
  const ajout = [0, 0, 0]
  const mult = [1, 1, 1]
  const sans = [1, 1, 1]
  // `horloge0` : les déclenchements par seconde que le générateur a de lui-même (la mine automatisée), avant les modules.
  let horloge = horloge0
  for (const mo of mods) {
    const f = forceEnPlace(mo, mods)
    for (const [cible, part] of partsDe(mo.couleur)) {
      const e = effet(cible, mo.forme, f * part)
      if (mo.forme === 1) {
        if (cible === 2) horloge += e
        else ajout[cible] = (ajout[cible] ?? 0) + e
      } else if (mo.forme === 2) mult[cible] = (mult[cible] ?? 1) * (1 + e)
      else sans[cible] = (sans[cible] ?? 1) * (1 - e)
    }
  }
  const chanceCritique = 1 - (sans[0] ?? 1)
  const chanceGrosLot = 1 - (sans[1] ?? 1)
  const chanceRafale = 1 - (sans[2] ?? 1)
  const lot = lot0 * prestige * (1 + (ajout[1] ?? 0)) * (mult[1] ?? 1)
  const gros = 1 + (EFFETS.grosLot - 1) * chanceGrosLot
  const lotMoyen = lot * gros
  const tape = lot * (1 + (ajout[0] ?? 0)) * (mult[0] ?? 1)
  const tapeMoyenne = tape * (1 + (EFFETS.coup - 1) * chanceCritique) * gros
  const frequence = horloge * (mult[2] ?? 1) * (1 + chanceRafale)
  return { lot, lotMoyen, tape, tapeMoyenne, chanceCritique, chanceGrosLot, frequence, debit: lotMoyen * frequence, multCritique: EFFETS.coup }
}

/** Le lot de base d'un générateur : celui de son type, fois le niveau d'une source ou de la mine. */
export function lotDeBase(p: Producteur): number {
  // Le niveau de la mine ne multiplie pas son or : il ouvre ses améliorations.
  return typeDe(p).lot * (estSource(p) ? p.niveau : 1)
}

/** Le bilan d'un générateur tel qu'il est équipé ; la mine, par ses améliorations. */
export function bilanProducteur(j: Joueur, p: Producteur): Bilan {
  if (estMine(p)) return bilanMine(j, p)
  return bilan(lotDeBase(p), modulesDe(j, p), multiplicateurPrestige(j))
}

/** L'automatique de la mine, en barres par seconde : rien avant la première quête, puis `auto`, plus vite avec l'amélioration. Il remplit la réserve. */
export function vitesseAuto(j: Joueur): number {
  return j.automatisation > 0 ? EFFETS_MINE.auto * (1 + EFFETS_MINE.autoNiveau * j.ameliorations.auto) : 0
}

/** Ce qu'une tape remplit de la barre (en barres), avant le critique et l'élan : la pioche l'allonge (en nombre), la puissance la multiplie. */
export function avanceTape(j: Joueur): number {
  const n = j.ameliorations
  return (EFFETS_MINE.tape + EFFETS_MINE.pioche * n.pioche) * (1 + EFFETS_MINE.puissance * n.puissance)
}

/** L'or d'une barre pleine. */
export function orParBarre(j: Joueur, p: Producteur): number {
  return EFFETS_MINE.orParBarre * lotDeBase(p) * multiplicateurPrestige(j)
}

/**
 * LE BILAN DE LA MINE, par ses améliorations : l'automatique remplit la
 * réserve à sa vitesse (la fréquence : des barres par seconde, le débit : de
 * l'or par seconde) ; une tape vaut la part de barre qu'elle remplit (en or),
 * un critique la multiplie.
 */
export function bilanMine(j: Joueur, p: Producteur): Bilan {
  const n = j.ameliorations
  const lot = orParBarre(j, p)
  const tape = lot * avanceTape(j)
  const chanceCritique = Math.min(1, EFFETS_MINE.critique * n.critique)
  const multCritique = EFFETS_MINE.critiqueBase + EFFETS_MINE.forceCritique * n.forceCritique
  const frequence = vitesseAuto(j)
  return { lot, lotMoyen: lot, tape, tapeMoyenne: tape * (1 + (multCritique - 1) * chanceCritique), chanceCritique, chanceGrosLot: 0, frequence, debit: lot * frequence, multCritique }
}

/** L'automatique est arrêté : la réserve est pleine, et aucun trop-plein ne le fait couler ailleurs. */
export function mineArretee(j: Joueur, p: Producteur): boolean {
  return reservePleine(j, p) && (estConstruit(p) ? partTropPleinProducteur(p) : partTropPlein(j)) <= 0
}

/** Remplit la barre de tant de barres (à la tape, ou le trop-plein) ; chaque barre pleine paie : l'or de la banque dans la bourse, la ressource d'un producteur construit dans son stock. Rend le nombre de barres remplies. */
function avancerBarre(j: Joueur, p: Producteur, part: number): number {
  if (part <= 0) return 0
  p.progres = (p.progres ?? 0) + part
  const barres = Math.floor(p.progres + 1e-9)
  if (barres <= 0) return 0
  p.progres = Math.max(0, p.progres - barres)
  if (estConstruit(p)) gagnerRessource(j, ressourceDe(p), barres * lotProducteur(p))
  else {
    produireOr(j, barres * orParBarre(j, p))
    j.journal.barres += barres
  }
  return barres
}

/** L'élan : ce que vaut la tape de rang `serie` dans une série (0 : la première). */
export function facteurElan(j: Joueur, serie: number): number {
  const n = j.ameliorations.elan
  return 1 + Math.min(EFFETS_MINE.elanPlafond * n, EFFETS_MINE.elanPas * n * Math.max(0, serie))
}

/** La chance qu'une tape fasse tomber une pépite. */
export function chancePepite(j: Joueur): number {
  return Math.min(1, EFFETS_MINE.pepiteChance * j.ameliorations.pepite)
}

/** Ce que vaut une pépite tapée : tant d'or, droit dans la bourse. */
export function valeurPepite(j: Joueur): number {
  return EFFETS_MINE.pepiteValeur * multiplicateurPrestige(j)
}

/** Ramasse une pépite tombée : son or entre dans la bourse. Rend l'or, ou 0 s'il n'y en avait pas. */
export function ramasserPepite(j: Joueur): number {
  if (j.pepites <= 0) return 0
  j.pepites -= 1
  const q = valeurPepite(j)
  produireOr(j, q)
  return q
}

/** Une pépite non tapée à temps est perdue. */
export function perdrePepite(j: Joueur): void {
  j.pepites = Math.max(0, j.pepites - 1)
}

/** L'or par seconde du joueur : ses mines, par leurs horloges. */
export function debitOr(j: Joueur): number {
  let d = 0
  for (const p of j.producteurs) if (estMine(p)) d += bilanProducteur(j, p).debit
  return d
}

/** La production du joueur, en matière ronde par seconde : ses sources, par leurs horloges. */
export function debitTotal(j: Joueur): number {
  let d = 0
  for (const p of j.producteurs) if (estSource(p)) d += bilanProducteur(j, p).debit
  return d
}

/** Une tape par minute : ce qu'on compte à un générateur sans horloge, et au flux d'une sorte que rien ne produit. */
const TAPE_NOMINALE = 1 / 60

/** Ce que le joueur produit d'une sorte, en unités par seconde, par ses horloges (la mine rend de l'or, pas une sorte). */
export function production(j: Joueur, sorte: number): number {
  let d = 0
  for (const p of j.producteurs) if (!estMine(p) && sortie(p) === sorte) d += bilanProducteur(j, p).debit
  return d
}

/** Le flux d'une sorte chez le joueur : sa production, plus une tape par minute sur le meilleur générateur qui la fait (au moins une unité par minute : on peut toujours l'acheter). */
export function flux(j: Joueur, sorte: number): number {
  let meilleure = 0
  for (const p of j.producteurs) if (!estMine(p) && sortie(p) === sorte) meilleure = Math.max(meilleure, bilanProducteur(j, p).tapeMoyenne)
  return production(j, sorte) + Math.max(1, meilleure) * TAPE_NOMINALE
}

/** Le générateur dont une tape rapporte le plus, au prix du marché (la mine : son or, tel quel) : celui qu'un bot tape. */
export function meilleureSource(m: Monde, j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -1
  for (const p of j.producteurs) {
    if (!estSource(p) && !estMine(p)) continue
    const v = bilanProducteur(j, p).tapeMoyenne * (estMine(p) ? 1 : prixCourant(m, sortie(p)))
    if (v > max) {
      max = v
      meilleur = p
    }
  }
  return meilleur
}

/** La matière entre dans les comptes du joueur ; une ronde de base compte au score. */
function produire(j: Joueur, sorte: number, q: number): void {
  if (q <= 0) return
  j.matiere[sorte] = (j.matiere[sorte] ?? 0) + q
  const c = couleurDe(sorte)
  if (formeDe(sorte) === 0 && c < PRIMAIRES) {
    j.produit[c] = (j.produit[c] ?? 0) + q
    j.produitRun += q
    j.total += q
  }
}

/** L'or de la mine entre dans la bourse du joueur, et compte à son score. */
function produireOr(j: Joueur, q: number): void {
  if (q <= 0) return
  j.or += q
  j.orProduit += q
}

/** Ce que la réserve d'une mine peut contenir : sa capacité, grandie par l'amélioration. */
export function capaciteReserve(j: Joueur, p: Producteur): number {
  if (estConstruit(p)) return Math.round(EFFETS_PRODUCTEUR.reserve * (1 + EFFETS_PRODUCTEUR.entrepot * niveauAP(p, 'entrepot')))
  return Math.round(RESERVE_MINE.capacite * (1 + EFFETS_MINE.reserve * j.ameliorations.reserve))
}

/** La part de l'or d'une réserve pleine qui coule quand même dans la bourse (le trop-plein). */
export function partTropPlein(j: Joueur): number {
  return Math.min(1, EFFETS_MINE.tropPlein * j.ameliorations.tropPlein)
}

export function reservePleine(j: Joueur, p: Producteur): boolean {
  return (estMine(p) || estConstruit(p)) && (p.reserve ?? 0) + 1e-9 >= capaciteReserve(j, p)
}

/**
 * L'AUTOMATIQUE REMPLIT LA MÊME BARRE QUE LA TAPE (Keko, 02/11 : « plutôt que
 * rajouter un autre timer, pourquoi on garde pas la même barre ») : une barre
 * que finit l'automatique (en jeu ou hors ligne) verse sa pièce dans la
 * réserve ; celle que finit une tape, dans la bourse (`avancerBarre`). La
 * réserve se remplit donc pièce par pièce. Pleine, l'automatique s'arrête —
 * sauf le trop-plein : il remplit encore la barre, à sa part de la vitesse,
 * et ces barres-là paient la bourse.
 */
function avancerBarreAuto(j: Joueur, p: Producteur, part: number): void {
  const capacite = capaciteReserve(j, p)
  // Un producteur construit a son trop-plein et son lot ; la banque, ceux du joueur.
  const tropPlein = estConstruit(p) ? partTropPleinProducteur(p) : partTropPlein(j)
  const lot = estConstruit(p) ? lotProducteur(p) : orParBarre(j, p)
  let reste = part
  while (reste > 1e-12) {
    if (p.reserve + 1e-9 >= capacite) {
      avancerBarre(j, p, reste * tropPlein)
      return
    }
    const manque = 1 - p.progres
    if (reste < manque) {
      p.progres += reste
      return
    }
    reste -= manque
    p.progres = 0
    p.reserve = Math.min(capacite, p.reserve + lot)
  }
}

/** RÉCOLTER la réserve d'une mine : ses pièces entières passent dans la bourse du joueur (et à son score) ; pas avant la première (Keko, 02/11). Rend l'or récolté. */
export function recolter(j: Joueur, p: Producteur): number {
  const pieces = estMine(p) || estConstruit(p) ? Math.floor((p.reserve ?? 0) + 1e-9) : 0
  if (pieces < 1) return 0
  // Une réserve PLEINE récoltée rapporte la prime, en pièces entières elle aussi.
  const prime = reservePleine(j, p) ? 1 + (estConstruit(p) ? EFFETS_PRODUCTEUR.prime * niveauAP(p, 'prime') : EFFETS_MINE.prime * j.ameliorations.prime) : 1
  const q = Math.floor(pieces * prime + 1e-9)
  p.reserve = Math.max(0, p.reserve - pieces)
  // La réserve d'un producteur construit va dans son stock ; celle de la banque, dans la bourse.
  if (estConstruit(p)) gagnerRessource(j, ressourceDe(p), q)
  else produireOr(j, q)
  j.journal.recoltes += 1
  return q
}

/** Ce que la matière en stock permet de convertir d'un coup sur ce générateur, par unité de lot : le plus petit de ses stocks d'entrée. */
export function disponible(j: Joueur, p: Producteur): number {
  const e = entrees(p)
  if (e.length === 0) return Infinity
  return Math.min(...e.map((s) => j.matiere[s] ?? 0))
}

/** Convertit `q` unités sur une raffinerie ou un mélangeur : les entrées sortent, la sortie entre. Rend ce qui a été converti. */
function convertir(j: Joueur, p: Producteur, q: number): number {
  const fait = Math.min(q, disponible(j, p))
  if (fait <= 0) return 0
  for (const s of entrees(p)) j.matiere[s] = (j.matiere[s] ?? 0) - fait
  produire(j, sortie(p), fait)
  return fait
}

/** Ce qu'une tape a fait : la matière gagnée (ou convertie), ou l'or de la mine (`or`), et si le coup fut critique ou gros. */
export interface Coup {
  gain: number
  critique: boolean
  grosLot: boolean
  /** La sorte gagnée ; sans sens quand `or` est vrai. */
  sorte: number
  or: boolean
  /** Une pépite est tombée. */
  pepite?: boolean
  /** La mine : ce que la tape a rempli de sa barre (0 : la barre est arrêtée). */
  avance?: number
  /** Un producteur construit : la ressource gagnée (`gain` en compte les unités). */
  ressource?: Ressource
}

/**
 * Déclenche un générateur (une tape) : la mine rend son or, une source produit
 * sa tape, une raffinerie ou un mélangeur convertit ce qu'il peut. `alea` (de
 * 0 à 1) décide du critique et du gros lot ; sans lui, la moyenne (les bots,
 * qui ne tirent rien). Une tape sans matière à convertir ne fait rien.
 */
export function declencher(m: Monde, j: Joueur, p: Producteur, alea?: number, serie = 0): Coup {
  const b = bilanProducteur(j, p)
  const or = estMine(p)
  const rien: Coup = { gain: 0, critique: false, grosLot: false, sorte: sortie(p), or }
  if (or) {
    // LA MINE : la tape avance la barre (critique, élan de la série) ; les barres pleines paient la bourse ; une pépite peut tomber. Sans `alea` (les bots), la moyenne, pépites comprises.
    const critique = alea !== undefined && alea < b.chanceCritique
    const fois = alea === undefined ? 1 + (b.multCritique - 1) * b.chanceCritique : critique ? b.multCritique : 1
    const avance = avanceTape(j) * fois * facteurElan(j, serie)
    const barres = avancerBarre(j, p, avance)
    let pepite = false
    if (alea === undefined) produireOr(j, chancePepite(j) * valeurPepite(j))
    else if ((alea * 104729) % 1 < chancePepite(j) && j.pepites < EFFETS_MINE.pepitesMax) {
      j.pepites += 1
      pepite = true
    }
    j.journal.tapes += 1
    return { gain: barres * orParBarre(j, p), critique, grosLot: false, sorte: sortie(p), or, pepite, avance }
  }
  if (estConstruit(p)) {
    // UN PRODUCTEUR CONSTRUIT, comme la banque avec ses améliorations à lui : la tape avance sa barre (outils, coup double, élan), une barre pleine donne sa ressource.
    const chance = chanceCoupDouble(p)
    const critique = alea !== undefined && alea < chance
    const fois = alea === undefined ? 1 + chance : critique ? 2 : 1
    const avance = avanceTapeProducteur(p) * fois * facteurElanProducteur(p, serie)
    const barres = avancerBarre(j, p, avance)
    j.journal.tapes += 1
    return { gain: barres * lotProducteur(p), critique, grosLot: false, sorte: sortie(p), or: false, avance, ressource: ressourceDe(p) }
  }
  const critique = alea !== undefined && alea < b.chanceCritique
  const grosLot = alea !== undefined && (alea * 7919) % 1 < b.chanceGrosLot
  const q = alea === undefined ? b.tapeMoyenne : b.tape * (critique ? EFFETS.coup : 1) * (grosLot ? EFFETS.grosLot : 1)
  let gain = q
  if (or) produireOr(j, q)
  else if (estSource(p)) produire(j, sortie(p), q)
  else gain = convertir(j, p, q)
  if (gain <= 0) return rien
  j.journal.tapes += 1
  void m
  return { gain, critique, grosLot, sorte: sortie(p), or }
}

/** Une tape sur la meilleure source. */
export function taper(m: Monde, j: Joueur, alea?: number): number {
  return declencher(m, j, meilleureSource(m, j), alea).gain
}

/** Les réglages qu'un générateur accepte : une raffinerie, toute couleur et une forme de 1 à 3 ; un mélangeur, une couleur mélangée ; une source, rien. */
export function peutRegler(p: Producteur, couleur: number, forme: number): boolean {
  switch (genreDe(p)) {
    case 'raffinerie':
      return couleur >= 0 && couleur < COULEURS && forme >= 1 && forme < FORMES
    case 'melangeur':
      return couleur >= PRIMAIRES && couleur < COULEURS && forme === 0
    default:
      return false
  }
}

/** Change ce qu'un générateur travaille. */
export function regler(p: Producteur, couleur: number, forme: number): boolean {
  if (!peutRegler(p, couleur, forme)) return false
  p.couleur = couleur
  p.forme = forme
  return true
}

// ---------------------------------------------------------------------------
// LES COÛTS ET LES ACHATS : tout se paie en matière

/** Les sortes qui peuvent payer un coût : la sorte dite, ou toutes celles de sa forme, ou toutes les formées. */
export function sortesPour(c: Cout): number[] {
  const out: number[] = []
  for (let s = 0; s < SORTES; s++) {
    const f = formeDe(s)
    const k = couleurDe(s)
    if (c.forme === null ? f === 0 : f !== c.forme) continue
    if (c.couleur !== null && k !== c.couleur) continue
    out.push(s)
  }
  return out
}

/** La sorte avec laquelle le joueur paierait ce coût : la plus abondante de celles qui conviennent (même si elle ne suffit pas). */
export function sortePourPayer(j: Joueur, c: Cout): number {
  const sortes = sortesPour(c)
  let meilleure = sortes[0] ?? 0
  for (const s of sortes) if ((j.matiere[s] ?? 0) > (j.matiere[meilleure] ?? 0)) meilleure = s
  return meilleure
}

export function peutPayer(j: Joueur, c: Cout): boolean {
  return (j.matiere[sortePourPayer(j, c)] ?? 0) + 1e-9 >= c.quantite
}

/** Ce qui manque pour payer, dans la sorte qui paierait. */
export function manquePour(j: Joueur, c: Cout): number {
  return Math.max(0, c.quantite - (j.matiere[sortePourPayer(j, c)] ?? 0))
}

export function payer(j: Joueur, c: Cout): boolean {
  if (!peutPayer(j, c)) return false
  const s = sortePourPayer(j, c)
  j.matiere[s] = Math.max(0, (j.matiere[s] ?? 0) - c.quantite)
  return true
}

/** Ce que vaut un coût en or, au prix courant de la sorte qui le paierait : pour comparer. */
export function valeurCout(m: Monde, j: Joueur, c: Cout): number {
  return c.quantite * prixCourant(m, sortePourPayer(j, c))
}

/** Le coût du prochain générateur d'un type ; pour une source, dans cette couleur (les générateurs de départ ne s'achètent pas). */
export function coutProducteur(j: Joueur, i: number, couleur = 0): Cout {
  const t = PRODUCTEURS[i]
  if (t === undefined || estFixe({ type: i }) || t.genre === 'ressource') return { forme: 0, couleur: 0, quantite: Infinity }
  const quantite = Math.ceil(t.cout.quantite * Math.pow(ACHAT.croissance, j.achetes[i] ?? 0))
  return { forme: t.cout.forme, couleur: t.genre === 'source' ? couleur : t.cout.couleur, quantite }
}

/** L'indice de la famille d'un genre dans `connus`. */
const FAMILLE_INDEX: Record<Genre, number> = { source: 0, raffinerie: 1, melangeur: 2, mine: 3, ressource: 4 }

/**
 * Un modèle est visible dès qu'on l'a dévoilé — le suivant en possédant le
 * précédent ; le mélangeur et la seconde source avec le premier module
 * fabriqué — ou, sauf les sources, dès qu'on peut le payer. Les générateurs de
 * départ, jamais : on ne les achète pas.
 */
export function visibleProducteur(j: Joueur, i: number): boolean {
  const t = PRODUCTEURS[i]
  if (t === undefined || estFixe({ type: i }) || t.genre === 'ressource') return false
  const k = rangDe(i)
  if (k < (j.connus[FAMILLE_INDEX[t.genre]] ?? 0)) return true
  if (t.genre === 'source') return false
  return peutPayer(j, coutProducteur(j, i))
}

/**
 * Où apparaît un générateur neuf : les places d'une grille autour de l'origine
 * (une empreinte et un peu d'air), la plus proche de l'origine d'abord, dont
 * l'empreinte ne touche celle d'aucun autre.
 */
export function placeDApparition(j: Joueur, sauf?: number): { x: number; y: number } {
  const pasX = 5 * CASE
  const pasY = PAS_Y
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

export function peutAcheterProducteur(j: Joueur, i: number, couleur = 0): boolean {
  return visibleProducteur(j, i) && peutPayer(j, coutProducteur(j, i, couleur))
}

/** La couleur de base la plus abondante en rondes : ce qu'une raffinerie neuve travaille d'abord. */
function couleurDominante(j: Joueur): number {
  let meilleure = 0
  for (let c = 0; c < PRIMAIRES; c++) if ((j.matiere[sorteDe(c, 0)] ?? 0) > (j.matiere[sorteDe(meilleure, 0)] ?? 0)) meilleure = c
  return meilleure
}

/**
 * Achète un générateur : il apparaît sur le plan, ses creux vides. Une source
 * a la couleur achetée ; une raffinerie travaille d'abord la couleur la plus
 * abondante, en carrés ; un mélangeur fait du jaune. Rend le générateur, ou
 * null.
 */
export function acheterProducteur(j: Joueur, i: number, couleur = 0): Producteur | null {
  if (!peutAcheterProducteur(j, i, couleur)) return null
  const t = PRODUCTEURS[i]!
  payer(j, coutProducteur(j, i, couleur))
  const place = placeDApparition(j)
  j.achetes[i] = (j.achetes[i] ?? 0) + 1
  const c = t.genre === 'source' ? couleur : t.genre === 'raffinerie' ? couleurDominante(j) : PRIMAIRES
  const p: Producteur = { id: j.prochainId++, type: i, x: place.x, y: place.y, couleur: c, forme: t.genre === 'raffinerie' ? 1 : 0, niveau: 1, reserve: 0, progres: 0 }
  j.producteurs.push(p)
  // LE DÉVOILEMENT : le modèle suivant de la famille.
  const fam = FAMILLE_INDEX[t.genre]
  j.connus[fam] = Math.max(j.connus[fam] ?? 0, Math.min(FAMILLES[t.genre].types.length, rangDe(i) + 2))
  return p
}

/** Le coût du niveau suivant d'un module : une part de sa valeur, qui croît à chaque niveau, en matière de sa sorte ; moitié prix pour un « économe ». */
export function coutNiveau(mo: Module): Cout {
  return { forme: mo.forme, couleur: mo.couleur, quantite: Math.ceil(valeurModule(mo) * NIVEAU.premier * Math.pow(NIVEAU.croissance, mo.niveau - 1) * (mo.trait === 'econome' ? TRAITS.econome : 1)) }
}

export function peutAmeliorer(j: Joueur, mo: Module): boolean {
  return peutPayer(j, coutNiveau(mo))
}

/** Monte un module d'un niveau, emboîté ou non. */
export function ameliorer(j: Joueur, mo: Module): boolean {
  if (!payer(j, coutNiveau(mo))) return false
  mo.niveau += 1
  return true
}

/** Le coût du niveau suivant d'une source : en rondes de sa couleur. */
export function coutNiveauSource(p: Producteur): Cout {
  return { forme: 0, couleur: p.couleur, quantite: Math.ceil(NIVEAU_SOURCE.premier * typeDe(p).lot * Math.pow(NIVEAU_SOURCE.croissance, p.niveau - 1)) }
}

export function peutAmeliorerSource(j: Joueur, p: Producteur): boolean {
  return estSource(p) && peutPayer(j, coutNiveauSource(p))
}

/** Monte une source d'un niveau : son lot de base grandit d'autant. */
export function ameliorerSource(j: Joueur, p: Producteur): boolean {
  if (!estSource(p) || !payer(j, coutNiveauSource(p))) return false
  p.niveau += 1
  return true
}

// ---------------------------------------------------------------------------
// LES QUÊTES ET CE QU'ELLES DÉBLOQUENT

/** La quête en cours (voir `QUETES`), ou null quand il n'y en a plus. */
export function queteEnCours(j: Joueur): Quete | null {
  return QUETES[j.quete] ?? null
}

/** Ce que la quête en cours demande : l'or à gagner, ou le niveau de la mine. */
export function objectifQuete(j: Joueur): number {
  return queteEnCours(j)?.but ?? 0
}

/** Où en est la quête en cours, borné à son objectif : l'or gagné depuis son début, ou le niveau de la mine. */
export function progresQuete(j: Joueur): number {
  const q = queteEnCours(j)
  if (q === null) return 0
  const fait =
    q.objectif === 'niveau'
      ? (j.producteurs.find(estMine)?.niveau ?? 1)
      : q.objectif === 'construction'
        ? j.producteurs.filter(estConstruit).length
        : q.objectif === 'niveauProducteur'
          ? (premierConstruit(j)?.niveau ?? 1)
          : j.orProduit - j.queteDepuis
  return Math.min(q.but, Math.max(0, fait))
}

export function queteAccomplie(j: Joueur): boolean {
  const q = queteEnCours(j)
  return q !== null && progresQuete(j) + 1e-9 >= q.but
}

/** Réclame la quête accomplie qui a une récompense : elle est débloquée, la suivante commence. Rend la quête réclamée, ou null. */
export function reclamerQuete(m: Monde, j: Joueur): Quete | null {
  void m
  const q = queteEnCours(j)
  if (q === null || q.recompense === 'aucune' || !queteAccomplie(j)) return null
  // Le menu des améliorations n'a rien à poser : il est là dès que la première quête est réclamée (`ameliorationsOuvertes`).
  j.quete += 1
  j.queteDepuis = j.orProduit
  return q
}

/** Les quêtes sans récompense s'accomplissent d'elles-mêmes : tant que celle en cours est remplie, la suivante commence. */
function avancerLesQuetes(j: Joueur): void {
  for (let q = queteEnCours(j); q !== null && q.recompense === 'aucune' && queteAccomplie(j); q = queteEnCours(j)) {
    j.quete += 1
    j.queteDepuis = j.orProduit
  }
}

/** Le bouton des améliorations est là : la première quête est réclamée. */
export function ameliorationsOuvertes(j: Joueur): boolean {
  return j.quete >= 1
}

// ---------------------------------------------------------------------------
// LA CONSTRUCTION (l'étape deux)

/** Le bouton de construction est là : la quête qui le demande a commencé. */
export function constructionOuverte(j: Joueur): boolean {
  return QUETE_CONSTRUCTION >= 0 && j.quete >= QUETE_CONSTRUCTION
}

/** Un prix en or et en ressources. */
export interface Prix {
  or: number
  bois: number
  pierre: number
}

export function peutPayerPrix(j: Joueur, c: Prix): boolean {
  return j.or + 1e-9 >= c.or && RESSOURCES.every((r) => stockRessource(j, r) + 1e-9 >= c[r])
}

function payerPrix(j: Joueur, c: Prix): void {
  j.or -= c.or
  j.ressources = { ...ressourcesVides(), ...j.ressources }
  for (const r of RESSOURCES) j.ressources[r] -= c[r]
}

/** Le prix de la prochaine construction, le même pour toutes les sortes : le tout premier producteur en or seul, ensuite or, bois et pierre, plus chers à chaque construction (voir `CONSTRUCTION`). */
export function prixConstruction(j: Joueur): Prix {
  const k = j.producteurs.filter(estConstruit).length
  if (k === 0) return { or: CONSTRUCTION.premier, bois: 0, pierre: 0 }
  const f = Math.pow(CONSTRUCTION.croissance, k - 1)
  return { or: Math.round(CONSTRUCTION.autres.or * f), bois: Math.round(CONSTRUCTION.autres.bois * f), pierre: Math.round(CONSTRUCTION.autres.pierre * f) }
}

/**
 * Où se pose un producteur construit : SOUS la banque, en colonne — au
 * téléphone en hauteur, le zoom normal ne descend pas assez pour montrer deux
 * carrés côte à côte, mais il en montre deux l'un sous l'autre —, puis, si la
 * colonne est prise, autour, sur une place libre.
 */
function placeDeConstruction(j: Joueur, type: number): { x: number; y: number } {
  const taille = tailleDe({ type })
  // Le pas d'une place à l'autre : deux empreintes côte à côte, arrondi aux cases.
  const pas = Math.ceil((taille.largeur + 2 * MODULE.profondeur) / CASE) * CASE
  const occupees = j.producteurs.map((p) => empreinte(p))
  const libre = (c: { x: number; y: number }): boolean => !occupees.some((o) => seChevauchent(o, empreinte({ ...c, type })))
  for (let k = 1; k <= 8; k++) {
    const c = surLesCases(0, k * pas)
    if (libre(c)) return c
  }
  for (let anneau = 1; anneau <= 6; anneau++) {
    const places = [
      { x: anneau * pas, y: 0 },
      { x: -anneau * pas, y: 0 },
      { x: 0, y: anneau * pas },
      { x: 0, y: -anneau * pas },
      { x: anneau * pas, y: anneau * pas },
      { x: -anneau * pas, y: anneau * pas },
      { x: anneau * pas, y: -anneau * pas },
      { x: -anneau * pas, y: -anneau * pas },
    ].map((c) => surLesCases(c.x, c.y))
    const place = places.find(libre)
    if (place !== undefined) return place
  }
  return surLesCases(0, 7 * pas)
}

/** CONSTRUIRE un producteur (un indice de `TYPES_CONSTRUCTION`) : payé en or, posé à côté de la banque. Rend le producteur, ou null. */
export function construire(j: Joueur, type: number): Producteur | null {
  const t = PRODUCTEURS[type]
  const prix = prixConstruction(j)
  if (t?.genre !== 'ressource' || !constructionOuverte(j) || !peutPayerPrix(j, prix)) return null
  payerPrix(j, prix)
  const place = placeDeConstruction(j, type)
  const p: Producteur = { id: j.prochainId++, type, x: place.x, y: place.y, couleur: 0, forme: 0, niveau: 1, reserve: 0, progres: 0 }
  j.producteurs.push(p)
  avancerLesQuetes(j)
  return p
}

// ---------------------------------------------------------------------------
// LES PRODUCTEURS CONSTRUITS : LEURS NIVEAUX ET LEURS AMÉLIORATIONS (voir `NIVEAU_PRODUCTEUR`)

/** Le niveau d'une amélioration d'un producteur construit. */
export function niveauAP(p: Producteur, id: IdAmeliorationProducteur): number {
  return p.ameliorations?.[id] ?? 0
}

/** Ce qu'une tape remplit de sa barre, avant le coup double et l'élan. */
export function avanceTapeProducteur(p: Producteur): number {
  return EFFETS_PRODUCTEUR.tape + EFFETS_PRODUCTEUR.outils * niveauAP(p, 'outils')
}

/** Ce que donne une barre pleine. */
export function lotProducteur(p: Producteur): number {
  return typeDe(p).lot + EFFETS_PRODUCTEUR.rendement * niveauAP(p, 'rendement')
}

/** Son automatique : le niveau 2 le donne. */
export function automatiqueProducteur(p: Producteur): boolean {
  return estConstruit(p) && p.niveau >= 2
}

/** Ce que son automatique remplit de barre par seconde. */
export function vitesseAutoProducteur(p: Producteur): number {
  return automatiqueProducteur(p) ? EFFETS_PRODUCTEUR.auto * (1 + EFFETS_PRODUCTEUR.cadence * niveauAP(p, 'cadence')) : 0
}

export function chanceCoupDouble(p: Producteur): number {
  return Math.min(1, EFFETS_PRODUCTEUR.coupDouble * niveauAP(p, 'coupDouble'))
}

export function partTropPleinProducteur(p: Producteur): number {
  return Math.min(1, EFFETS_PRODUCTEUR.tropPlein * niveauAP(p, 'tropPlein'))
}

export function facteurElanProducteur(p: Producteur, serie: number): number {
  const n = niveauAP(p, 'elan')
  return 1 + Math.min(EFFETS_PRODUCTEUR.elanPlafond * n, EFFETS_PRODUCTEUR.elanPas * n * Math.max(0, serie))
}

/** Le prix de son niveau suivant, en or, bois et pierre. */
export function prixNiveauProducteur(p: Producteur): Prix {
  const f = Math.pow(NIVEAU_PRODUCTEUR.croissance, p.niveau - 1)
  return { or: Math.round(NIVEAU_PRODUCTEUR.or * f), bois: Math.round(NIVEAU_PRODUCTEUR.bois * f), pierre: Math.round(NIVEAU_PRODUCTEUR.pierre * f) }
}

/** Ce que donne son niveau suivant : l'automatique d'abord, puis une amélioration au choix. */
export function gainNiveauProducteur(p: Producteur): 'automatique' | 'choix' {
  return p.niveau < 2 ? 'automatique' : 'choix'
}

/** Il peut monter d'un niveau : aucune amélioration n'attend son choix, le prix est là. */
export function peutMonterLeProducteur(j: Joueur, p: Producteur): boolean {
  return estConstruit(p) && (p.offre ?? null) === null && peutPayerPrix(j, prixNiveauProducteur(p))
}

/** MONTER UN PRODUCTEUR D'UN NIVEAU : payé en or, bois et pierre ; le niveau 2 donne son automatique, les suivants l'offre de trois améliorations. Rend vrai s'il est monté. */
export function monterLeProducteur(m: Monde, j: Joueur, p: Producteur): boolean {
  if (!peutMonterLeProducteur(j, p)) return false
  payerPrix(j, prixNiveauProducteur(p))
  if (gainNiveauProducteur(p) === 'choix') p.offre = tirerOffreProducteur(m, j, p)
  p.niveau += 1
  avancerLesQuetes(j)
  return true
}

/** Le premier producteur construit : celui que la quête « passer au niveau 2 » fait monter. */
export function premierConstruit(j: Joueur): Producteur | undefined {
  return j.producteurs.find(estConstruit)
}

// ---------------------------------------------------------------------------
// LE MARCHÉ DES RESSOURCES (voir `MARCHE_RESSOURCES`)

/** Le marché est ouvert : un producteur est construit. */
export function marcheOuvert(j: Joueur): boolean {
  return j.producteurs.some(estConstruit)
}

/** La cote d'une ressource, telle qu'elle est ; au repos si personne n'y a encore touché. */
function cote(m: Monde, r: Ressource): CoteRessource {
  return m.marche.ressources?.[r] ?? { volume: 0, demande: MARCHE_RESSOURCES.demandeMin, historique: [MARCHE_RESSOURCES.prix[r]] }
}

/** La cote d'une ressource, rangée dans le marché pour qu'on l'écrive. */
function coteEcrite(m: Monde, r: Ressource): CoteRessource {
  const c = cote(m, r)
  m.marche.ressources = { ...m.marche.ressources, [r]: c }
  return c
}

/** La demande visée d'une ressource : ce que tous les producteurs construits en font en `MARCHE.tampon` heures. */
function demandeViseeRessource(m: Monde, r: Ressource): number {
  let d = 0
  for (const j of m.joueurs) for (const p of j.producteurs) if (estConstruit(p) && ressourceDe(p) === r) d += vitesseAutoProducteur(p) * lotProducteur(p) * 3600 * MARCHE.tampon
  return Math.max(MARCHE_RESSOURCES.demandeMin, d)
}

/** Le prix d'une unité maintenant, pour un échange infinitésimal. */
export function prixRessource(m: Monde, r: Ressource): number {
  const c = cote(m, r)
  return prixPleinRessource(m, r) * Math.exp(-c.volume / c.demande)
}

/** Le prix plein d'une ressource : celui où revient le prix au repos ; il suit le déséquilibre des échanges (voir `MARCHE_RESSOURCES.ancrage`). */
export function prixPleinRessource(m: Monde, r: Ressource): number {
  return cote(m, r).plein ?? MARCHE_RESSOURCES.prix[r]
}

/** Ce que coûte acheter `q` d'un coup — l'intégrale du prix de V − q à V —, en pièces entières (au moins une). */
export function coutAchatRessource(m: Monde, r: Ressource, q: number): number {
  if (q <= 0) return 0
  const c = cote(m, r)
  return Math.max(1, Math.round(prixPleinRessource(m, r) * c.demande * Math.exp(-c.volume / c.demande) * Math.expm1(q / c.demande)))
}

/** Ce que rapporte vendre `q` d'un coup — l'intégrale du prix de V à V + q —, en pièces entières. */
export function gainVenteRessource(m: Monde, r: Ressource, q: number): number {
  if (q <= 0) return 0
  const c = cote(m, r)
  return Math.round(prixPleinRessource(m, r) * c.demande * Math.exp(-c.volume / c.demande) * -Math.expm1(-q / c.demande))
}

/** Le prix heure par heure, le dernier en dernier. */
export function historiqueRessource(m: Monde, r: Ressource): number[] {
  return cote(m, r).historique
}

function bornerRessource(c: CoteRessource): void {
  const borne = MARCHE.bornes * c.demande
  c.volume = Math.max(-borne, Math.min(borne, c.volume))
}

/** ACHETER `q` d'une ressource au marché : le prix monte. Rend l'or dépensé, ou 0. */
export function acheterRessource(m: Monde, j: Joueur, r: Ressource, q: number): number {
  const prix = coutAchatRessource(m, r, q)
  if (!marcheOuvert(j) || q <= 0 || j.or + 1e-9 < prix) return 0
  j.or -= prix
  gagnerRessource(j, r, q)
  const c = coteEcrite(m, r)
  c.volume -= q
  bornerRessource(c)
  noterBougie(m, r)
  return prix
}

/** Ce qu'on peut acheter d'une ressource avec `or`, au prix du marché. */
export function quantiteAchetableRessource(m: Monde, r: Ressource, or: number): number {
  if (or <= 0) return 0
  const c = cote(m, r)
  return Math.floor(c.demande * Math.log1p(or / (prixPleinRessource(m, r) * c.demande * Math.exp(-c.volume / c.demande))) + 1e-9)
}

/** VENDRE `q` d'une ressource au marché (pas plus qu'on n'en a) : le prix baisse. Rend l'or gagné. */
export function vendreRessource(m: Monde, j: Joueur, r: Ressource, q: number): number {
  const quantite = Math.min(q, Math.floor(stockRessource(j, r) + 1e-9))
  if (!marcheOuvert(j) || quantite <= 0) return 0
  const gain = gainVenteRessource(m, r, quantite)
  gagnerRessource(j, r, -quantite)
  j.or += gain
  const c = coteEcrite(m, r)
  c.volume += quantite
  bornerRessource(c)
  noterBougie(m, r)
  return gain
}

/** Les bougies d'une ressource, la dernière en dernier. */
export function bougiesRessource(m: Monde, r: Ressource): Bougie[] {
  return cote(m, r).bougies ?? []
}

/** Le prix inscrit dans la bougie de la période en cours ; une nouvelle période ouvre une bougie au dernier prix. */
function noterBougie(m: Monde, r: Ressource): void {
  const c = coteEcrite(m, r)
  const p = prixRessource(m, r)
  const t = Math.floor(m.t / MARCHE_RESSOURCES.bougie + 1e-9)
  const bougies = c.bougies ?? []
  c.bougies = bougies
  const derniere = bougies[bougies.length - 1]
  if (derniere !== undefined && derniere.t === t) {
    derniere.h = Math.max(derniere.h, p)
    derniere.l = Math.min(derniere.l, p)
    derniere.c = p
    return
  }
  const o = derniere?.c ?? p
  bougies.push({ t, o, h: Math.max(o, p), l: Math.min(o, p), c: p })
  if (bougies.length > MARCHE_RESSOURCES.bougies) bougies.shift()
}

/** Un tirage des marchands, de loi normale, de la graine du monde et de leur compte de tirages. */
function tirageMarchands(m: Monde): number {
  const n = (m.marche.tirages ?? 0) + 1
  m.marche.tirages = n
  const alea = rngDe(graineDe(m.graine, 9001, n))
  const u = Math.max(1e-12, alea())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * alea())
}

// LES ORDRES À PRIX PERSO (Keko, 02/11 : « un prix perso, auquel cas l'ordre se lance quand le prix demandé trouve un acheteur »)

/** POSER UN ORDRE : acheter au plus, ou vendre au moins, à `prix` l'unité. L'or (arrondi au-dessus) ou la ressource est mis de côté. Rend l'ordre, ou null. */
export function placerOrdre(m: Monde, j: Joueur, sens: 'achat' | 'vente', r: Ressource, quantite: number, prix: number): Ordre | null {
  const q = Math.floor(quantite + 1e-9)
  const p = Math.round(prix * 100) / 100
  if (!marcheOuvert(j) || q <= 0 || !(p > 0)) return null
  let bloque = 0
  if (sens === 'achat') {
    bloque = Math.ceil(p * q - 1e-9)
    if (j.or + 1e-9 < bloque) return null
    j.or -= bloque
  } else {
    if (stockRessource(j, r) + 1e-9 < q) return null
    gagnerRessource(j, r, -q)
  }
  const ordre: Ordre = { id: j.prochainId++, sens, ressource: r, quantite: q, prix: p, bloque }
  j.ordres = [...(j.ordres ?? []), ordre]
  executerOrdres(m, j)
  return ordre
}

/** ANNULER un ordre en attente : ce qui était mis de côté revient. */
export function annulerOrdre(j: Joueur, id: number): boolean {
  const o = (j.ordres ?? []).find((x) => x.id === id)
  if (o === undefined) return false
  if (o.sens === 'achat') j.or += o.bloque
  else gagnerRessource(j, o.ressource, o.quantite)
  j.ordres = (j.ordres ?? []).filter((x) => x.id !== id)
  return true
}

/** Les ordres que le prix a atteints s'exécutent, au prix du marché (jamais moins bon que le leur) ; l'échange pousse le prix. */
function executerOrdres(m: Monde, j: Joueur): void {
  if ((j.ordres ?? []).length === 0) return
  const restants: Ordre[] = []
  for (const o of j.ordres ?? []) {
    const p = prixRessource(m, o.ressource)
    const achat = o.sens === 'achat' && p <= o.prix + 1e-9
    const vente = o.sens === 'vente' && p >= o.prix - 1e-9
    if (!achat && !vente) {
      restants.push(o)
      continue
    }
    const c = coteEcrite(m, o.ressource)
    let montant: number
    if (achat) {
      montant = Math.min(o.bloque, Math.round(p * o.quantite))
      j.or += o.bloque - montant
      gagnerRessource(j, o.ressource, o.quantite)
      c.volume -= o.quantite
    } else {
      montant = Math.round(p * o.quantite)
      j.or += montant
      c.volume += o.quantite
    }
    bornerRessource(c)
    noterBougie(m, o.ressource)
    j.executes = [...(j.executes ?? []), { id: j.prochainId++, sens: o.sens, ressource: o.ressource, quantite: o.quantite, prix: montant / o.quantite, montant, t: m.t }].slice(-10)
  }
  j.ordres = restants
}

/** Le marché des ressources respire : le volume fond, les marchands le secouent, la demande suit la production ; le prix s'inscrit dans sa bougie ; les ordres atteints s'exécutent. */
function respirerRessources(m: Monde, dt: number, heurePleine: boolean): void {
  for (const r of RESSOURCES) {
    const c = coteEcrite(m, r)
    // Le prix plein suit le déséquilibre : on vend plus qu'on n'achète (V > 0), il baisse ; l'inverse, il monte.
    const base = MARCHE_RESSOURCES.prix[r]
    const [bas, haut] = MARCHE_RESSOURCES.bornesPlein
    c.plein = Math.max(base * bas, Math.min(base * haut, (c.plein ?? base) * Math.exp(-MARCHE_RESSOURCES.ancrage * (c.volume / c.demande) * dt)))
    c.volume *= Math.pow(0.5, dt / MARCHE.demiVie)
    c.volume += MARCHE_RESSOURCES.agitation * c.demande * Math.sqrt(dt) * tirageMarchands(m)
    bornerRessource(c)
    c.demande += (demandeViseeRessource(m, r) - c.demande) * (1 - Math.pow(0.5, dt / MARCHE.inertie))
    noterBougie(m, r)
    if (heurePleine) {
      c.historique.push(prixRessource(m, r))
      if (c.historique.length > 24 * 8) c.historique.shift()
    }
  }
  for (const j of m.joueurs) executerOrdres(m, j)
}

/** Tire l'offre d'un niveau de producteur : `OFFRE_NIVEAU` améliorations sous leur maximum, au hasard du joueur. */
function tirerOffreProducteur(m: Monde, j: Joueur, p: Producteur): IdAmeliorationProducteur[] | null {
  const possibles = IDS_AMELIORATIONS_PRODUCTEUR.filter((id) => niveauAP(p, id) < MAX_AMELIORATION_PRODUCTEUR[id])
  const offre: IdAmeliorationProducteur[] = []
  while (offre.length < OFFRE_NIVEAU && possibles.length > 0) offre.push(possibles.splice(Math.floor(tirer(m, j) * possibles.length), 1)[0]!)
  return offre.length > 0 ? offre : null
}

/** Choisit une amélioration de l'offre d'un producteur : elle prend un niveau, l'offre se referme. */
export function choisirAmeliorationProducteur(p: Producteur, id: IdAmeliorationProducteur): boolean {
  if (!(p.offre ?? []).includes(id)) return false
  p.ameliorations = { ...p.ameliorations, [id]: niveauAP(p, id) + 1 }
  p.offre = null
  return true
}

/** Le prix du niveau suivant de la mine. */
export function prixNiveauMine(p: Producteur): number {
  return Math.round(NIVEAU_MINE.premier * Math.pow(NIVEAU_MINE.croissance, p.niveau - 1))
}

/** Ce que donne le niveau suivant de la mine : l'automatique d'abord, puis une amélioration au choix. */
export function gainNiveauMine(j: Joueur): 'automatique' | 'choix' {
  return j.automatisation === 0 ? 'automatique' : 'choix'
}

/** La mine peut monter d'un niveau : le menu est ouvert, aucune amélioration n'attend son choix, l'or suffit. */
export function peutMonterLaMine(j: Joueur, p: Producteur): boolean {
  return estMine(p) && ameliorationsOuvertes(j) && j.offre === null && j.or + 1e-9 >= prixNiveauMine(p)
}

/** MONTER LA MINE D'UN NIVEAU (voir `NIVEAU_MINE`) : le premier niveau gagné donne l'automatique, les suivants tirent l'offre de trois améliorations. Rend vrai si elle est montée. */
export function monterLaMine(m: Monde, j: Joueur, p: Producteur): boolean {
  if (!peutMonterLaMine(j, p)) return false
  j.or -= prixNiveauMine(p)
  if (gainNiveauMine(j) === 'automatique') j.automatisation = 1
  else j.offre = tirerOffre(m, j)
  p.niveau += 1
  avancerLesQuetes(j)
  return true
}

/** Une amélioration peut-elle être proposée : sous son maximum, sa condition remplie ? */
export function ameliorationPossible(j: Joueur, id: IdAmelioration): boolean {
  const a = AMELIORATIONS.find((x) => x.id === id)
  if (a === undefined || j.ameliorations[id] >= a.max) return false
  if (a.requiert === null) return true
  if (a.requiert === 'automatisation') return j.automatisation > 0
  return j.ameliorations[a.requiert] > 0
}

/** Tire l'offre d'un niveau de la banque : `OFFRE_NIVEAU` améliorations possibles, au hasard du joueur. */
function tirerOffre(m: Monde, j: Joueur): IdAmelioration[] | null {
  const possibles = IDS_AMELIORATIONS.filter((id) => ameliorationPossible(j, id))
  const offre: IdAmelioration[] = []
  while (offre.length < OFFRE_NIVEAU && possibles.length > 0) offre.push(possibles.splice(Math.floor(tirer(m, j) * possibles.length), 1)[0]!)
  return offre.length > 0 ? offre : null
}

/** Choisit une amélioration de l'offre : elle prend un niveau, l'offre se referme. */
export function choisirAmelioration(j: Joueur, id: IdAmelioration): boolean {
  if (j.offre === null || !j.offre.includes(id)) return false
  j.ameliorations[id] += 1
  j.offre = null
  return true
}


// ---------------------------------------------------------------------------
// LA FABRICATION DES MODULES : dans la boutique, comme le reste

/** Ce que vaut en or un module de cette forme et de cette rareté au niveau 1 : la base de sa fabrication et de ses niveaux. */
export function valeurModule(mo: { forme: number; rarete: number }): number {
  return (VALEUR_MODULE[mo.forme] ?? 10) * (RARETES.valeur[mo.rarete] ?? 1)
}

export function qualiteDe(q: number): Qualite {
  return FABRICATION.qualites[q] ?? FABRICATION.qualites[0]!
}

/** Le coût du prochain module de cette sorte, à cette qualité : en matière de la sorte ; au moins un temps de ce que le joueur en produit. */
export function coutFabrication(j: Joueur, sorte: number, q: number): Cout {
  const forme = formeDe(sorte)
  const total = j.fabriques.reduce((s, n) => s + n, 0)
  const croissance = Math.pow(FABRICATION.croissance, j.fabriques[sorte] ?? 0) * Math.pow(FABRICATION.croissanceTotale, total)
  const base = Math.max(valeurModule({ forme, rarete: 0 }) * FABRICATION.part * croissance, production(j, sorte) * 3600 * FABRICATION.duree)
  return { forme, couleur: couleurDe(sorte), quantite: Math.ceil(base * qualiteDe(q).mult) }
}

/** Une qualité se voit dès qu'on a usé de la précédente, ou dès qu'on peut la payer pour cette sorte. */
export function visibleQualite(j: Joueur, sorte: number, q: number): boolean {
  if (q < 0 || q >= FABRICATION.qualites.length) return false
  return q < j.connusQualites || peutPayer(j, coutFabrication(j, sorte, q))
}

export function peutFabriquer(j: Joueur, sorte: number, q: number): boolean {
  return formeDe(sorte) !== 0 && visibleQualite(j, sorte, q) && peutPayer(j, coutFabrication(j, sorte, q))
}

/** Les chances de chaque rareté pour cette qualité, normalisées. */
export function chancesDe(q: number): number[] {
  const c = qualiteDe(q).chances
  const total = c.reduce((s, v) => s + v, 0)
  return RARETES.noms.map((_, r) => (total > 0 ? (c[r] ?? 0) / total : r === 0 ? 1 : 0))
}

/** L'effet moyen d'un module de cette qualité, en multiples d'un commun. */
export function esperanceEffet(q: number): number {
  return chancesDe(q).reduce((s, c, r) => s + c * (RARETES.effet[r] ?? 1), 0)
}

/** Ce que vaut en moyenne un module de cette forme à cette qualité. */
export function valeurMoyenne(forme: number, q: number): number {
  return chancesDe(q).reduce((s, c, r) => s + c * valeurModule({ forme, rarete: r }), 0)
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

/** Les traits qu'un module de cette couleur peut porter. */
export function traitsPossibles(couleur: number): readonly Trait[] {
  return TRAITS.noms.filter((t) => t !== 'rapide' || aDuBleu(couleur))
}

/**
 * Fabrique un module de cette sorte à cette qualité : la matière sort, la
 * rareté se tire (la garantie aidant), le trait aussi dès peu commune ; le
 * module va dans la soute. Rend le module, ou null si la matière manque.
 */
export function fabriquerModule(m: Monde, j: Joueur, sorte: number, q: number): Module | null {
  if (!peutFabriquer(j, sorte, q) || !payer(j, coutFabrication(j, sorte, q))) return null
  j.fabriques[sorte] = (j.fabriques[sorte] ?? 0) + 1
  let rarete = tirerRarete(chancesDe(q), tirer(m, j))
  // LA GARANTIE : les fabrications sans rare, sans épique, finissent par en donner un.
  if (rarete < 3 && j.sansEpique + 1 >= RARETES.sansEpique) rarete = 3
  else if (rarete < 2 && j.sansRare + 1 >= RARETES.sansRare) rarete = 2
  j.sansRare = rarete >= 2 ? 0 : j.sansRare + 1
  j.sansEpique = rarete >= 3 ? 0 : j.sansEpique + 1
  const couleur = couleurDe(sorte)
  let trait: Trait | null = null
  if (rarete >= 1) {
    const possibles = traitsPossibles(couleur)
    trait = possibles[Math.floor(tirer(m, j) * possibles.length)] ?? null
  }
  const mo: Module = { id: j.prochainId++, couleur, forme: formeDe(sorte), rarete, trait, niveau: 1, parent: null, emplacement: 0 }
  j.modules.push(mo)
  j.journal.fabrications += 1
  // LE DÉVOILEMENT : la qualité suivante ; le premier module dévoile le mélangeur et la seconde source.
  j.connusQualites = Math.max(j.connusQualites, Math.min(FABRICATION.qualites.length, q + 2))
  j.connus[2] = Math.max(j.connus[2] ?? 0, 1)
  j.connus[0] = Math.max(j.connus[0] ?? 1, 2)
  return mo
}

// ---------------------------------------------------------------------------
// L'EMBOÎTEMENT ET LES DÉPLACEMENTS

/**
 * Les creux où un module peut aller : libres et de sa forme, ou occupés par un
 * autre module de sa forme (qu'il remplacerait : l'autre irait à la soute).
 */
export function prisesPour(j: Joueur, mo: Module): Prise[] {
  const libres = prisesLibres(j, new Set([mo.id])).filter((p) => p.forme === mo.forme)
  const occupees: Prise[] = []
  for (const autre of j.modules) {
    if (autre === mo || autre.parent === null || autre.forme !== mo.forme) continue
    const p = producteurDe(j, autre.parent)
    if (p === undefined) continue
    occupees.push({ parent: p.id, emplacement: autre.emplacement, forme: mo.forme, place: placeSurProducteur(p, autre.emplacement), occupant: autre.id })
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

/** Les conversions par seconde qu'un transformateur peut vraiment faire à cette fréquence et ce lot : jamais plus que ses entrées n'en nourrissent. */
export function cadenceReelle(j: Joueur, p: Producteur, frequence: number, lot: number): number {
  if (estSource(p)) return frequence
  let entrant = Infinity
  for (const s of entrees(p)) entrant = Math.min(entrant, flux(j, s))
  return Math.min(frequence, entrant / Math.max(1e-9, lot))
}

/**
 * Ce que vaut un générateur, en or par seconde, à titre de comparaison : sa
 * production au prix courant (une source) ; ce que ses conversions ajoutent de
 * valeur, au moins un quart de la sortie (une raffinerie, un mélangeur). Ses
 * horloges, plus une tape par minute ; jamais plus que ses entrées ne le
 * nourrissent.
 */
export function valeurDe(m: Monde, j: Joueur, p: Producteur, mods: readonly ModuleAgissant[]): number {
  // La mine rend de l'or : sa valeur est son or, tel quel.
  if (estMine(p)) {
    const bm = bilanMine(j, p)
    return bm.debit + bm.tapeMoyenne * TAPE_NOMINALE
  }
  const b = bilan(lotDeBase(p), mods, multiplicateurPrestige(j))
  const prixSortie = prixCourant(m, sortie(p))
  if (estSource(p)) return (b.lotMoyen * b.frequence + b.tapeMoyenne * TAPE_NOMINALE) * prixSortie
  const parSeconde = b.lotMoyen * b.frequence + b.tapeMoyenne * TAPE_NOMINALE
  const nourri = Math.min(parSeconde, cadenceReelle(j, p, b.frequence + TAPE_NOMINALE, b.lotMoyen) * b.lotMoyen)
  const coutEntrees = entrees(p).reduce((s, e) => s + prixCourant(m, e), 0)
  return nourri * Math.max(prixSortie - coutEntrees, 0.25 * prixSortie)
}

/** Ce que rapporterait, au mieux, un module commun de niveau 1 de chaque sorte formée : le besoin du joueur, sorte par sorte (zéro pour les rondes). */
export function besoins(m: Monde, j: Joueur): number[] {
  const out = Array.from({ length: SORTES }, () => 0)
  const libres = prisesLibres(j)
  const valeurs = new Map<number, number>()
  for (const p of j.producteurs) valeurs.set(p.id, valeurDe(m, j, p, modulesDe(j, p)))
  for (const s of sortesFormees()) {
    const essai: Module = { id: -1, couleur: couleurDe(s), forme: formeDe(s), rarete: 0, trait: null, niveau: 1, parent: null, emplacement: 0 }
    for (const prise of libres) {
      if (prise.forme !== essai.forme) continue
      const p = producteurDe(j, prise.parent)
      if (p === undefined) continue
      const gain = valeurDe(m, j, p, [...modulesDe(j, p), { ...essai, emplacement: prise.emplacement }]) - (valeurs.get(p.id) ?? 0)
      out[s] = Math.max(out[s] ?? 0, gain)
    }
  }
  return out
}

/** Le creux où ce module rapporterait le plus : libre, ou occupé par un module plus faible de sa forme. Null s'il n'y en a pas qui améliore quelque chose. */
export function meilleurePrise(m: Monde, j: Joueur, mo: Module): Prise | null {
  let meilleure: { prise: Prise; gain: number } | null = null
  for (const prise of prisesPour(j, mo)) {
    const p = producteurDe(j, prise.parent)
    if (p === undefined) continue
    const mods = modulesDe(j, p).filter((autre) => autre.id !== prise.occupant)
    const gain = valeurDe(m, j, p, [...mods, { ...mo, emplacement: prise.emplacement }]) - valeurDe(m, j, p, modulesDe(j, p))
    if (gain > 1e-12 && (meilleure === null || gain > meilleure.gain)) meilleure = { prise, gain }
  }
  return meilleure?.prise ?? null
}

/** Branche un module de la soute là où il rapporte le plus. Rend la prise, ou null. */
export function brancherAuMieux(m: Monde, j: Joueur, mo: Module): Prise | null {
  const prise = meilleurePrise(m, j, mo)
  if (prise === null || !brancher(j, mo, prise.parent, prise.emplacement)) return null
  return prise
}

/** Un générateur tiendrait-il là (au centre d'une case), avec ses modules, sans chevaucher un autre générateur ni ses modules ? */
export function producteurTient(j: Joueur, p: Producteur, x: number, y: number): boolean {
  const c = { ...surLesCases(x, y), type: p.type }
  const autres = occupation(j, undefined, p.id)
  const boites = [boiteProducteur(c), ...modulesDe(j, p).map((mo) => boiteModule(placeSurProducteur(c, mo.emplacement)))]
  return !boites.some((b) => autres.some((o) => seChevauchent(o, b)))
}

/** Déplace un générateur (ses modules suivent) là où il tient, au centre d'une case. Les générateurs de départ ne bougent pas. Rend faux sinon. */
export function deplacerProducteur(j: Joueur, p: Producteur, x: number, y: number): boolean {
  if (estFixe(p) || !producteurTient(j, p, x, y)) return false
  const c = surLesCases(x, y)
  p.x = c.x
  p.y = c.y
  return true
}

// ---------------------------------------------------------------------------
// LA FUSION

export interface Fusible {
  couleur: number
  forme: number
  rarete: number
  modules: Module[]
}

/** Les groupes de la soute qu'on peut fondre : par sorte et rareté, au moins `FUSION` modules, sous la légendaire. */
export function fusibles(j: Joueur): Fusible[] {
  const out: Fusible[] = []
  const enSoute = soute(j)
  for (const s of sortesFormees()) {
    const couleur = couleurDe(s)
    const forme = formeDe(s)
    for (let rarete = 0; rarete < RARETES.noms.length - 1; rarete++) {
      const modules = enSoute.filter((mo) => mo.couleur === couleur && mo.forme === forme && mo.rarete === rarete)
      if (modules.length >= FUSION) out.push({ couleur, forme, rarete, modules })
    }
  }
  return out
}

/** Fond `FUSION` modules de la soute (les plus bas niveaux) en un de la rareté au-dessus, au meilleur de leurs niveaux, au trait retiré. Rend le module, ou null. */
export function fondre(m: Monde, j: Joueur, couleur: number, forme: number, rarete: number): Module | null {
  const groupe = fusibles(j).find((g) => g.couleur === couleur && g.forme === forme && g.rarete === rarete)
  if (groupe === undefined) return null
  const partants = [...groupe.modules].sort((a, b) => a.niveau - b.niveau).slice(0, FUSION)
  const niveau = Math.max(...partants.map((mo) => mo.niveau))
  j.modules = j.modules.filter((mo) => !partants.includes(mo))
  const possibles = traitsPossibles(couleur)
  const trait = possibles[Math.floor(tirer(m, j) * possibles.length)] ?? null
  const mo: Module = { id: j.prochainId++, couleur, forme, rarete: rarete + 1, trait, niveau, parent: null, emplacement: 0 }
  j.modules.push(mo)
  j.journal.fusions += 1
  return mo
}

// ---------------------------------------------------------------------------
// LE MARCHÉ

/** La demande visée d'une sorte : ce que tous les joueurs en produisent en `tampon` heures. */
export function demandeVisee(m: Monde, sorte: number): number {
  let d = 0
  for (const j of m.joueurs) d += production(j, sorte) * 3600 * MARCHE.tampon
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
  return MARCHE.prix * d * Math.exp(-v / d) * Math.expm1(q / d)
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

/** Achète au marché ce qui manque pour payer un coût, si l'or suffit. Rend vrai si le coût est alors payable. */
export function completerAuMarche(m: Monde, j: Joueur, c: Cout): boolean {
  const manque = manquePour(j, c)
  if (manque <= 0) return true
  const s = sortePourPayer(j, c)
  return acheter(m, j, s, manque * 1.001) > 0 || peutPayer(j, c)
}

/** La fortune d'un joueur : son or, et ce que vaudrait sa matière au prix courant. */
export function fortune(m: Monde, j: Joueur): number {
  let f = j.or
  for (let s = 0; s < SORTES; s++) f += (j.matiere[s] ?? 0) * prixCourant(m, s)
  return f
}

/** La couleur de base que le joueur a le plus produite dans cette partie : sa couleur. */
export function couleurDominanteDe(j: Joueur): number {
  let c = 0
  for (let k = 1; k < PRIMAIRES; k++) if ((j.produit[k] ?? 0) > (j.produit[c] ?? 0)) c = k
  return c
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

/** Tout remettre à zéro contre des points : la mine seule, non automatisée, la soute vide, pas d'or ni de matière. Ce qu'on connaît reste connu, ce que les quêtes ont débloqué aussi. */
export function prestiger(j: Joueur): boolean {
  const gain = pointsSi(j)
  if (gain < 1) return false
  j.points += gain
  j.prestiges += 1
  j.or = 0
  j.matiere = Array.from({ length: SORTES }, () => 0)
  j.achetes = PRODUCTEURS.map(() => 0)
  j.fabriques = Array.from({ length: SORTES }, () => 0)
  j.producteurs = depart()
  j.prochainId = Math.max(j.prochainId, 2)
  j.modules = []
  j.produit = Array.from({ length: PRIMAIRES }, () => 0)
  j.produitRun = 0
  return true
}

// ---------------------------------------------------------------------------
// LE TEMPS

const ORDRE: Record<Genre, number> = { mine: 0, ressource: 0, source: 0, melangeur: 1, raffinerie: 2 }

/** Fait vivre le monde `dt` heures : la mine et les sources produisent par leurs horloges, les mélangeurs puis les raffineries convertissent, le marché respire. */
export function avancer(m: Monde, dt: number): void {
  if (dt <= 0) return
  for (const j of m.joueurs) {
    const ordonnes = [...j.producteurs].sort((a, b) => ORDRE[genreDe(a)] - ORDRE[genreDe(b)])
    for (const p of ordonnes) {
      // LA MINE : l'automatique remplit sa barre, et ses barres pleines tombent dans la réserve, qu'il faut récolter.
      if (estMine(p)) {
        avancerBarreAuto(j, p, vitesseAuto(j) * dt * 3600)
        continue
      }
      // UN PRODUCTEUR CONSTRUIT : son automatique (niveau 2) remplit sa barre, et ses barres pleines tombent dans sa réserve.
      if (estConstruit(p)) {
        avancerBarreAuto(j, p, vitesseAutoProducteur(p) * dt * 3600)
        continue
      }
      const b = bilanProducteur(j, p)
      if (b.frequence <= 0) continue
      if (estSource(p)) produire(j, sortie(p), b.debit * 3600 * dt)
      else convertir(j, p, b.debit * 3600 * dt)
    }
  }
  const avant = m.t
  m.t += dt
  const heurePleine = Math.floor(m.t + 1e-9) > Math.floor(avant + 1e-9)
  for (let s = 0; s < SORTES; s++) {
    m.marche.volume[s] = volume(m, s) * Math.pow(0.5, dt / MARCHE.demiVie)
    m.marche.demande[s] = demande(m, s) + (demandeVisee(m, s) - demande(m, s)) * (1 - Math.pow(0.5, dt / MARCHE.inertie))
    if (heurePleine) {
      const h = m.marche.historique[s] ?? []
      h.push(prixCourant(m, s))
      if (h.length > 24 * 8) h.shift()
      m.marche.historique[s] = h
    }
  }
  respirerRessources(m, dt, heurePleine)
}
