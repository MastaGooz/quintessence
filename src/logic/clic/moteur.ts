/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, aucun
 * hasard de son cru (un tirage lui est passé quand il en faut un). Tout ce
 * qu'un joueur peut faire passe par ici (déclencher un producteur, vendre,
 * acheter, emboîter, améliorer, prestiger) ; `avancer` fait produire et vendre
 * le monde.
 *
 * LES PRODUCTEURS ET LEURS MODULES (Keko, 31/10) : un producteur est un
 * rectangle creusé de prises femelles ; il produit un LOT de R à chaque
 * déclenchement, et une tape le déclenche. Un module est une pièce à une bosse,
 * qui s'emboîte dans un creux de sa forme sur un producteur et AGIT sur lui :
 * l'horloge le déclenche toute seule, l'ajout grossit son lot, le
 * multiplicateur le multiplie, le critique donne une chance qu'il soit décuplé.
 * Un module s'améliore niveau par niveau, et se déplace d'un producteur à
 * l'autre. Les producteurs flottent sur le plan ; la base, offerte, est au
 * centre et n'en bouge pas.
 */
import { ACHAT, AUTO_COUT, EFFETS, EMPLACEMENTS, MARCHE, MODULE, MODULES, NIVEAU, PIECE, PRESTIGE, PRODUCTEUR, PRODUCTEURS } from './donnees.ts'

/** UN PRODUCTEUR : un exemplaire d'un type, posé sur le plan (son centre en pixels-monde). */
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

export interface Joueur {
  id: number
  nom: string
  /** La ressource en main, pas encore vendue. */
  r: number
  or: number
  producteurs: Producteur[]
  modules: Module[]
  /** Le prochain identifiant, commun aux producteurs et aux modules. */
  prochainId: number
  /** Les exemplaires achetés de chaque type, emboîtés ou non : c'est eux que le coût suit. */
  achetesProducteurs: number[]
  achetesModules: number[]
  /** Les types que le joueur a déjà vus (le dévoilement survit au prestige). */
  connusProducteurs: number
  connusModules: number
  /** Le comptoir automatique : la production se vend au fil de l'eau. */
  auto: boolean
  /** Les points de prestige acquis. */
  points: number
  prestiges: number
  /** Le R produit depuis le dernier prestige, et depuis le début (le score). */
  produitRun: number
  total: number
  journal: { tapes: number; orVentes: number; ventes: number }
}

export interface Vente {
  t: number
  joueur: number
  quantite: number
  or: number
}

export interface Monde {
  /** L'heure de jeu, depuis le début de la saison. */
  t: number
  joueurs: Joueur[]
  /** Le volume vendu récemment par tous, qui fond avec le temps. */
  volume: number
  /** La demande : elle suit la production de tous avec de l'inertie, pour qu'un prestige collectif ne l'effondre pas. */
  demande: number
  /** Le prix relevé à chaque heure pleine (le dernier en dernier). */
  historique: number[]
  /** Les grosses ventes récentes, pour la gazette. */
  gazette: Vente[]
}

/** La base : le premier producteur, offert, au centre du plan. */
const BASE_ID = 1

function base(): Producteur {
  return { id: BASE_ID, type: 0, x: 0, y: 0 }
}

export function nouveauJoueur(id: number, nom: string): Joueur {
  return {
    id,
    nom,
    r: 0,
    or: 0,
    producteurs: [base()],
    modules: [],
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
    journal: { tapes: 0, orVentes: 0, ventes: 0 },
  }
}

export function nouveauMonde(noms: string[]): Monde {
  return { t: 0, joueurs: noms.map((n, i) => nouveauJoueur(i, n)), volume: 0, demande: MARCHE.demandeMin, historique: [MARCHE.prix], gazette: [] }
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
  /** Le lot d'un déclenchement ordinaire, en R. */
  lot: number
  /** La chance qu'un déclenchement soit un coup critique (lot × `coup`). */
  chance: number
  /** Le lot moyen, critiques comprises. */
  lotMoyen: number
  /** Les déclenchements par seconde des horloges. */
  frequence: number
  /** La production par seconde, en R : le lot moyen fois la fréquence. */
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

export function bilanProducteur(j: Joueur, p: Producteur): Bilan {
  return bilan(PRODUCTEURS[p.type]?.lot ?? 0, modulesDe(j, p), multiplicateurPrestige(j))
}

/** La production du joueur, en R par seconde : tous ses producteurs, par leurs horloges. */
export function debit(j: Joueur): number {
  let d = 0
  for (const p of j.producteurs) d += bilanProducteur(j, p).debit
  return d
}

/** Le producteur dont un déclenchement rapporte le plus : celui qu'on tape. */
export function meilleurProducteur(j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -1
  for (const p of j.producteurs) {
    const v = bilanProducteur(j, p).lotMoyen
    if (v > max) {
      max = v
      meilleur = p
    }
  }
  return meilleur
}

/**
 * Déclenche un producteur (une tape) : il produit son lot. `alea` (de 0 à 1)
 * décide du critique ; sans lui, le lot moyen (les bots, qui ne tirent rien).
 */
export function declencher(j: Joueur, p: Producteur, alea?: number): { gain: number; critique: boolean } {
  const b = bilanProducteur(j, p)
  const critique = alea !== undefined && alea < b.chance
  const gain = alea === undefined ? b.lotMoyen : critique ? b.lot * EFFETS.coup : b.lot
  j.r += gain
  j.produitRun += gain
  j.total += gain
  j.journal.tapes += 1
  return { gain, critique }
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

export function peutAcheterProducteur(j: Joueur, i: number): boolean {
  return i > 0 && visibleProducteur(j, i) && j.or + 1e-9 >= coutProducteur(j, i)
}

/** Où apparaît un producteur qu'on vient d'acheter : sous tout le reste, avec la place de ses modules du haut. */
export function placeDApparitionProducteur(j: Joueur): { x: number; y: number } {
  return { x: 0, y: etendue(j).bas + MODULE.profondeur + PIECE.encoche.profondeur + 40 + PRODUCTEUR.hauteur / 2 }
}

/** Achète un producteur : il apparaît sous le reste, ses creux vides. Rend le producteur, ou null. */
export function acheterProducteur(j: Joueur, i: number): Producteur | null {
  if (!peutAcheterProducteur(j, i)) return null
  j.or -= coutProducteur(j, i)
  j.achetesProducteurs[i] = (j.achetesProducteurs[i] ?? 0) + 1
  const place = placeDApparitionProducteur(j)
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

/** Où apparaît un module qu'on vient d'acheter : sous l'installation, en rang. */
export function placeDApparitionModule(j: Joueur): { x: number; y: number } {
  const n = j.modules.filter((mo) => mo.parent === null).length
  const pas = PIECE.taille + 30
  // Le premier au milieu, puis de part et d'autre.
  const colonnes = [0, 1, -1, 2, -2]
  return { x: (colonnes[n % 5] ?? 0) * pas, y: etendue(j, false).bas + 60 + MODULE.profondeur / 2 + Math.floor(n / 5) * (MODULE.profondeur + 40) }
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
  // Posséder un module dévoile le suivant ; le second dévoile le premier producteur à acheter.
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
// L'EMBOÎTEMENT

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

/** Un producteur tiendrait-il là, avec ses modules, sans chevaucher un autre producteur ni ses modules ? */
export function producteurTient(j: Joueur, p: Producteur, x: number, y: number): boolean {
  const autres = occupation(j, undefined, p.id)
  const boites = [boiteProducteur({ x, y }), ...modulesDe(j, p).map((mo) => boiteModule(placeSurProducteur({ x, y }, mo.emplacement)))]
  return !boites.some((b) => autres.some((o) => seChevauchent(o, b)))
}

/** Déplace un producteur (ses modules suivent) là où il tient. La base ne bouge pas. Rend faux sinon. */
export function deplacerProducteur(j: Joueur, p: Producteur, x: number, y: number): boolean {
  if (p.type === 0 || !producteurTient(j, p, x, y)) return false
  p.x = x
  p.y = y
  return true
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
// LE MARCHÉ COMMUN

/** Ce que la demande vise : ce que tous produisent en `tampon` heures, au moins le plancher. */
export function demandeVisee(m: Monde): number {
  let d = 0
  for (const j of m.joueurs) d += debit(j) * 3600 * MARCHE.tampon
  return Math.max(MARCHE.demandeMin, d)
}

export function demande(m: Monde): number {
  return m.demande
}

/** Le prix d'un R maintenant, pour une vente infinitésimale. */
export function prixCourant(m: Monde): number {
  const d = demande(m)
  return (MARCHE.prix * d) / (d + m.volume)
}

/** Ce que rapporte vendre `q` d'un coup : l'intégrale du prix de V à V + q. */
export function gainVente(m: Monde, q: number): number {
  if (q <= 0) return 0
  const d = demande(m)
  // `log1p` : quand la demande dépasse la vente de vingt ordres de grandeur, (d + q) / d vaut 1 en flottant, et log en ferait 0.
  return MARCHE.prix * d * Math.log1p(q / (d + m.volume))
}

/** Vend `q` R du joueur (tout ce qu'il a si `q` dépasse) ; rend l'or gagné. */
export function vendre(m: Monde, j: Joueur, q: number, journaliser = true): number {
  const quantite = Math.min(q, j.r)
  if (quantite <= 0) return 0
  const or = gainVente(m, quantite)
  j.r -= quantite
  j.or += or
  m.volume += quantite
  j.journal.orVentes += or
  if (journaliser) {
    j.journal.ventes += 1
    // La gazette garde les ventes qui pèsent sur le marché : au moins un dixième de la demande.
    if (quantite >= demande(m) / 10) {
      m.gazette.push({ t: m.t, joueur: j.id, quantite, or })
      if (m.gazette.length > 40) m.gazette.shift()
    }
  }
  return or
}

// ---------------------------------------------------------------------------
// LE PRESTIGE

/** Les points que rapporterait un prestige maintenant. */
export function pointsSi(j: Joueur): number {
  return Math.floor(Math.sqrt(j.produitRun / PRESTIGE.base))
}

export function peutPrestiger(j: Joueur): boolean {
  return pointsSi(j) >= 1
}

/** Tout remettre à zéro contre des points : il ne reste que la base, nue. Ce qu'on connaît reste connu. */
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
  return true
}

// ---------------------------------------------------------------------------
// LE TEMPS

/** Fait vivre le monde `dt` heures : chacun produit (et vend, au comptoir automatique), le volume fond, le prix se relève. */
export function avancer(m: Monde, dt: number): void {
  if (dt <= 0) return
  for (const j of m.joueurs) {
    const prod = debit(j) * 3600 * dt
    j.produitRun += prod
    j.total += prod
    j.r += prod
    // Le comptoir automatique vend tout ce qu'on a en main : la production, et les tapes.
    if (j.auto) vendre(m, j, j.r, false)
  }
  const avant = m.t
  m.t += dt
  m.volume *= Math.pow(0.5, dt / MARCHE.demiVie)
  m.demande += (demandeVisee(m) - m.demande) * (1 - Math.pow(0.5, dt / MARCHE.inertie))
  if (Math.floor(m.t + 1e-9) > Math.floor(avant + 1e-9)) {
    m.historique.push(prixCourant(m))
    if (m.historique.length > 24 * 8) m.historique.shift()
  }
}

/** La fortune d'un joueur : son or, et ce que vaudrait son R au prix courant. */
export function fortune(m: Monde, j: Joueur): number {
  return j.or + j.r * prixCourant(m)
}
