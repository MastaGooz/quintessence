/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, aucun
 * hasard. Tout ce qu'un joueur peut faire passe par ici (taper, vendre,
 * acheter un module, l'emboîter, l'améliorer, prestiger) ; `avancer` fait
 * produire et vendre le monde.
 *
 * LA BASE ET SES MODULES FONT UN PUZZLE (Keko, 30/10) : la base est un
 * rectangle creusé d'une forme sur chaque côté ; un module est une case qui
 * porte la bosse de sa forme sur un côté et des creux sur les trois autres ;
 * il s'emboîte sur un creux de sa forme, de la base ou d'un module déjà
 * emboîté, et les modules s'enchaînent ainsi en arbre. Seuls les modules
 * reliés à la base produisent. Un module s'améliore niveau par niveau.
 */
import { ACHAT, AUTO_COUT, BASE, FORMES, MARCHE, NIVEAU, PIECE, PRESTIGE, PROFILS, TAPE_PART, UNITES } from './donnees.ts'

/** UN MODULE : un exemplaire d'une unité, emboîté quelque part ou posé sur le plan. */
export interface Module {
  id: number
  type: number
  /** Le niveau d'amélioration, à partir de 1. */
  niveau: number
  /** Sur quoi il est emboîté : 0 la base, sinon l'id d'un autre module ; null quand il est posé sur le plan. */
  parent: number | null
  /** Le côté du parent où il est emboîté : pour la base 0 haut, 1 droite, 2 bas, 3 gauche ; pour un module ses côtés à lui, 0 la face, 1 la droite, 3 la gauche (2 est sa bosse). */
  cote: number
  /** Posé sur le plan (sans parent) : son centre en pixels-monde et le sens où regarde sa face (0 haut, 1 droite, 2 bas, 3 gauche). Emboîté, tout cela découle du parent. */
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
  /** Les modules achetés de chaque unité, emboîtés ou non : c'est eux que le coût suit. */
  achetes: number[]
  modules: Module[]
  prochainModule: number
  /** Le comptoir automatique : la production se vend au fil de l'eau. */
  auto: boolean
  /** Les points de prestige acquis. */
  points: number
  prestiges: number
  /** Le R produit depuis le dernier prestige, et depuis le début (le score). */
  produitRun: number
  total: number
  /** Le nombre d'unités que le joueur a déjà vues (le dévoilement survit au prestige). */
  connues: number
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

export function nouveauJoueur(id: number, nom: string): Joueur {
  return {
    id,
    nom,
    r: 0,
    or: 0,
    achetes: UNITES.map(() => 0),
    modules: [],
    prochainModule: 1,
    auto: false,
    points: 0,
    prestiges: 0,
    produitRun: 0,
    total: 0,
    connues: 1,
    journal: { tapes: 0, orVentes: 0, ventes: 0 },
  }
}

export function nouveauMonde(noms: string[]): Monde {
  return { t: 0, joueurs: noms.map((n, i) => nouveauJoueur(i, n)), volume: 0, demande: MARCHE.demandeMin, historique: [MARCHE.prix], gazette: [] }
}

// ---------------------------------------------------------------------------
// LA GÉOMÉTRIE DU PUZZLE

/** Un point du plan et un sens (0 haut, 1 droite, 2 bas, 3 gauche). */
export interface Place {
  x: number
  y: number
  sens: number
}

/** Une découpe sur un côté : la bosse qui s'emboîte, ou le creux qui reçoit. */
export interface Decoupe {
  genre: 'bosse' | 'creux'
  forme: number
}

/** Un creux libre : à qui il appartient (0 la base), sur quel côté, sa forme, et où se placerait le module qui s'y emboîte. */
export interface Prise {
  parent: number
  cote: number
  forme: number
  place: Place
}

export const DIRECTIONS: readonly { x: number; y: number }[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

/** La forme d'une unité : deux unités par forme (A et E, B et F…). */
export function formeDuType(type: number): number {
  return type % FORMES
}

/** La découpe d'un côté LOCAL d'un module (0 face, 1 droite, 2 bosse, 3 gauche). */
export function decoupeLocale(type: number, cote: number): Decoupe {
  if (cote === 2) return { genre: 'bosse', forme: formeDuType(type) }
  const p = PROFILS[type] ?? [0, 0, 0]
  return { genre: 'creux', forme: cote === 0 ? p[0] : cote === 1 ? p[1] : p[2] }
}

/** Le côté local d'un module dont la face regarde `sens`, qui regarde dans la direction `d`. */
export function coteLocal(sens: number, d: number): number {
  return (d - sens + 4) % 4
}

/** Où s'emboîte un module sur le côté `cote` de la base (la base regarde toujours vers le haut : ses côtés sont les directions). */
export function placeSurLaBase(cote: number): Place {
  const d = DIRECTIONS[cote] ?? DIRECTIONS[0]!
  return { x: d.x * (BASE.largeur / 2 + PIECE.taille / 2), y: d.y * (BASE.hauteur / 2 + PIECE.taille / 2), sens: cote }
}

/** Où s'emboîte un module sur le côté local `cote` d'un module placé en `p`. */
export function placeSurLeModule(p: Place, cote: number): Place {
  const sens = (p.sens + cote) % 4
  const d = DIRECTIONS[sens]!
  return { x: p.x + d.x * PIECE.taille, y: p.y + d.y * PIECE.taille, sens }
}

/** Les enfants de chaque parent (0 : la base). Les modules posés n'y figurent pas comme enfants, mais leurs propres enfants, si. */
function enfantsDe(j: Joueur): Map<number, Module[]> {
  const enfants = new Map<number, Module[]>()
  for (const mo of j.modules) {
    if (mo.parent === null) continue
    const liste = enfants.get(mo.parent)
    if (liste === undefined) enfants.set(mo.parent, [mo])
    else liste.push(mo)
  }
  return enfants
}

function poser(racine: Module, place: Place, enfants: Map<number, Module[]>, out: Map<number, Place>): void {
  out.set(racine.id, place)
  for (const e of enfants.get(racine.id) ?? []) poser(e, placeSurLeModule(place, e.cote), enfants, out)
}

/** Où est chaque module (son centre, le sens de sa face) : les emboîtés suivent leur parent depuis la base ; les posés sont où on les a laissés, avec ce qui est emboîté dessus. */
export function disposition(j: Joueur): Map<number, Place> {
  const enfants = enfantsDe(j)
  const out = new Map<number, Place>()
  for (const mo of enfants.get(0) ?? []) poser(mo, placeSurLaBase(mo.cote), enfants, out)
  for (const mo of j.modules) if (mo.parent === null) poser(mo, { x: mo.x, y: mo.y, sens: mo.sens }, enfants, out)
  return out
}

/** Les modules reliés à la base : ceux qui produisent. */
export function relies(j: Joueur): Set<number> {
  const enfants = enfantsDe(j)
  const out = new Set<number>()
  const pile = [...(enfants.get(0) ?? [])]
  for (let mo = pile.pop(); mo !== undefined; mo = pile.pop()) {
    out.add(mo.id)
    for (const e of enfants.get(mo.id) ?? []) pile.push(e)
  }
  return out
}

/** Un module et tout ce qui est emboîté dessus, de proche en proche (lui en premier). */
export function grappe(j: Joueur, racine: Module): Module[] {
  const enfants = enfantsDe(j)
  const out: Module[] = []
  const pile = [racine]
  for (let mo = pile.pop(); mo !== undefined; mo = pile.pop()) {
    out.push(mo)
    for (const e of enfants.get(mo.id) ?? []) pile.push(e)
  }
  return out
}

/** La disposition d'une grappe si sa racine était en `place` : pour l'essayer ailleurs avant de l'y emboîter. */
export function disposerGrappe(j: Joueur, racine: Module, place: Place): Map<number, Place> {
  const out = new Map<number, Place>()
  poser(racine, place, enfantsDe(j), out)
  return out
}

function seChevauchent(a: Place, b: Place): boolean {
  return Math.abs(a.x - b.x) < PIECE.taille - 1 && Math.abs(a.y - b.y) < PIECE.taille - 1
}

function chevaucheLaBase(p: Place): boolean {
  return Math.abs(p.x) < BASE.largeur / 2 + PIECE.taille / 2 - 1 && Math.abs(p.y) < BASE.hauteur / 2 + PIECE.taille / 2 - 1
}

/**
 * Les creux libres : chaque creux de la base ou d'un module relié où rien
 * n'est emboîté, et dont la case est libre. `sauf` : des modules qu'on tient
 * en main — ni leurs creux, ni leurs cases ne comptent.
 */
export function prisesLibres(j: Joueur, sauf?: ReadonlySet<number>): Prise[] {
  const dispo = disposition(j)
  const reliees = relies(j)
  const occupees: Place[] = []
  for (const id of reliees) if (sauf?.has(id) !== true) occupees.push(dispo.get(id)!)
  const libre = (p: Place): boolean => !chevaucheLaBase(p) && !occupees.some((o) => seChevauchent(o, p))
  const prises = new Set<string>()
  for (const mo of j.modules) if (mo.parent !== null && sauf?.has(mo.id) !== true) prises.add(`${mo.parent}:${mo.cote}`)
  const out: Prise[] = []
  for (let c = 0; c < 4; c++) {
    if (prises.has(`0:${c}`)) continue
    const place = placeSurLaBase(c)
    if (libre(place)) out.push({ parent: 0, cote: c, forme: BASE.formes[c] ?? 0, place })
  }
  for (const mo of j.modules) {
    if (!reliees.has(mo.id) || sauf?.has(mo.id) === true) continue
    const p = dispo.get(mo.id)!
    for (const c of [0, 1, 3]) {
      if (prises.has(`${mo.id}:${c}`)) continue
      const place = placeSurLeModule(p, c)
      if (libre(place)) out.push({ parent: mo.id, cote: c, forme: decoupeLocale(mo.type, c).forme, place })
    }
  }
  return out
}

/** Ce que l'arbre occupe : la plus grande distance du centre à un bord de case, et le bas de la case la plus basse. */
export function etendue(j: Joueur): { rayon: number; bas: number } {
  const dispo = disposition(j)
  let rayon = BASE.largeur / 2
  let bas = BASE.hauteur / 2
  for (const id of relies(j)) {
    const p = dispo.get(id)!
    rayon = Math.max(rayon, Math.abs(p.x) + PIECE.taille / 2, Math.abs(p.y) + PIECE.taille / 2)
    bas = Math.max(bas, p.y + PIECE.taille / 2)
  }
  return { rayon: rayon + PIECE.encoche.profondeur, bas }
}

// ---------------------------------------------------------------------------
// LA PRODUCTION

export function multiplicateurPrestige(j: Joueur): number {
  return 1 + PRESTIGE.parPoint * j.points
}

/** Ce que multiplie un niveau : le niveau lui-même, et un doublement tous les `palier` niveaux. */
export function multiplicateurNiveau(niveau: number): number {
  return niveau * Math.pow(2, Math.floor(niveau / NIVEAU.palier))
}

/** Ce que produirait un module d'une unité à ce niveau, en R par seconde. */
export function debitAuNiveau(j: Joueur, type: number, niveau: number): number {
  return (UNITES[type]?.debit ?? 0) * multiplicateurNiveau(niveau) * multiplicateurPrestige(j)
}

/** Ce que produit un module, relié ou non (posé, il ne compte pas dans `debit`). */
export function debitModule(j: Joueur, mo: Module): number {
  return debitAuNiveau(j, mo.type, mo.niveau)
}

/** La production du joueur, en R par seconde : les modules reliés à la base. */
export function debit(j: Joueur): number {
  const r = relies(j)
  let d = 0
  for (const mo of j.modules) if (r.has(mo.id)) d += debitModule(j, mo)
  return d
}

/** La tape vaut une part de la production par seconde, et au moins 1 R multiplié par le prestige : après un prestige, on ne repart pas du premier jour. */
export function valeurTape(j: Joueur): number {
  return Math.max(multiplicateurPrestige(j), TAPE_PART * debit(j))
}

export function taper(j: Joueur): number {
  const v = valeurTape(j)
  j.r += v
  j.produitRun += v
  j.total += v
  j.journal.tapes += 1
  return v
}

// ---------------------------------------------------------------------------
// LES ACHATS

/** Le coût du prochain module d'une unité. */
export function coutModule(j: Joueur, i: number): number {
  const u = UNITES[i]
  if (u === undefined) return Infinity
  return Math.ceil(u.cout * Math.pow(ACHAT.croissance, j.achetes[i] ?? 0))
}

/** Une unité est visible dès qu'on possède la précédente (le dévoilement survit au prestige). */
export function visible(j: Joueur, i: number): boolean {
  return i < j.connues
}

export function peutAcheterModule(j: Joueur, i: number): boolean {
  return visible(j, i) && j.or + 1e-9 >= coutModule(j, i)
}

/** Où apparaît un module qu'on vient d'acheter : sous l'arbre, en rang. */
export function placeDApparition(j: Joueur): { x: number; y: number } {
  const n = j.modules.filter((mo) => mo.parent === null).length
  const pas = PIECE.taille + 30
  // Le premier au milieu, puis de part et d'autre.
  const colonnes = [0, 1, -1, 2, -2]
  return { x: (colonnes[n % 5] ?? 0) * pas, y: etendue(j).bas + PIECE.taille / 2 + 70 + Math.floor(n / 5) * pas }
}

/** Achète un module : il apparaît posé sous l'arbre, à emboîter. Rend le module, ou null. */
export function acheterModule(j: Joueur, i: number): Module | null {
  if (!peutAcheterModule(j, i)) return null
  j.or -= coutModule(j, i)
  j.achetes[i] = (j.achetes[i] ?? 0) + 1
  const place = placeDApparition(j)
  const mo: Module = { id: j.prochainModule++, type: i, niveau: 1, parent: null, cote: 0, x: place.x, y: place.y, sens: 0 }
  j.modules.push(mo)
  // Posséder une unité dévoile la suivante.
  j.connues = Math.max(j.connues, Math.min(UNITES.length, i + 2))
  return mo
}

/** Le coût du niveau suivant d'un module. */
export function coutNiveau(mo: Module): number {
  const u = UNITES[mo.type]
  if (u === undefined) return Infinity
  return Math.ceil(u.cout * NIVEAU.premier * Math.pow(NIVEAU.croissance, mo.niveau - 1))
}

export function peutAmeliorer(j: Joueur, mo: Module): boolean {
  return j.or + 1e-9 >= coutNiveau(mo)
}

/** Monte un module d'un niveau, relié ou non (posé, il garde son niveau pour plus tard). */
export function ameliorer(j: Joueur, mo: Module): boolean {
  if (!peutAmeliorer(j, mo)) return false
  j.or -= coutNiveau(mo)
  mo.niveau += 1
  return true
}

// ---------------------------------------------------------------------------
// L'EMBOÎTEMENT

/** La grappe d'un module tiendrait-elle, sa racine en `place`, sans chevaucher la base ni un module relié qui n'en fait pas partie ? */
export function grappeTient(j: Joueur, mo: Module, place: Place): boolean {
  const g = new Set(grappe(j, mo).map((m) => m.id))
  const dispo = disposition(j)
  const r = relies(j)
  for (const p of disposerGrappe(j, mo, place).values()) {
    if (chevaucheLaBase(p)) return false
    for (const id of r) if (!g.has(id) && seChevauchent(dispo.get(id)!, p)) return false
  }
  return true
}

/** Les creux où un module (avec sa grappe) peut aller : libres, de sa forme, et où tout tient. */
export function prisesPour(j: Joueur, mo: Module): Prise[] {
  const g = new Set(grappe(j, mo).map((m) => m.id))
  const forme = formeDuType(mo.type)
  return prisesLibres(j, g).filter((p) => p.forme === forme && !g.has(p.parent) && grappeTient(j, mo, p.place))
}

/** Emboîte un module (et ce qui est emboîté dessus) sur un creux libre de sa forme où tout tient. Rend faux sinon. */
export function brancher(j: Joueur, mo: Module, parent: number, cote: number): boolean {
  const prise = prisesPour(j, mo).find((p) => p.parent === parent && p.cote === cote)
  if (prise === undefined) return false
  mo.parent = parent
  mo.cote = cote
  return true
}

/** Détache un module (avec ce qui est emboîté dessus) et le pose en (x, y), sa face vers `sens` : il ne produit plus. */
export function debrancher(mo: Module, x: number, y: number, sens: number): void {
  mo.parent = null
  mo.x = x
  mo.y = y
  mo.sens = sens
}

/** Déplace un module posé (avec ce qui est emboîté dessus). */
export function deplacer(mo: Module, x: number, y: number): void {
  if (mo.parent !== null) return
  mo.x = x
  mo.y = y
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
  return MARCHE.prix * d * Math.log((d + m.volume + q) / (d + m.volume))
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

export function prestiger(j: Joueur): boolean {
  const gain = pointsSi(j)
  if (gain < 1) return false
  j.points += gain
  j.prestiges += 1
  j.r = 0
  j.or = 0
  j.achetes = UNITES.map(() => 0)
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
