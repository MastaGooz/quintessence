/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, aucun
 * hasard. Tout ce qu'un joueur peut faire passe par ici (taper, vendre,
 * acheter, améliorer, prestiger) ; `avancer` fait produire et vendre le monde.
 */
import { AMELIORATIONS, ANNEAUX, AUTO_COUT, CROISSANCE, MARCHE, PALIERS, PRESTIGE, TAPE_PART, UNITES } from './donnees.ts'

/** UN MODULE : un exemplaire d'une unité, branché sur une prise de la base ou posé quelque part sur le plan (x, y en pixels-monde). */
export interface Module {
  id: number
  type: number
  prise: number | null
  x: number
  y: number
}

export interface Joueur {
  id: number
  nom: string
  /** La ressource en main, pas encore vendue. */
  r: number
  or: number
  /** Les modules BRANCHÉS de chaque unité (par index de `UNITES`) : seuls eux produisent. */
  unites: number[]
  /** Les modules achetés de chaque unité, branchés ou non : c'est eux que le coût suit. */
  achetes: number[]
  modules: Module[]
  prochainModule: number
  /** Les anneaux de prises possédés (le premier est offert). */
  anneaux: number
  /** Les niveaux d'amélioration achetés par unité (0 à 3). */
  niveaux: number[]
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
    unites: UNITES.map(() => 0),
    achetes: UNITES.map(() => 0),
    modules: [],
    prochainModule: 1,
    anneaux: 1,
    niveaux: UNITES.map(() => 0),
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
// LA PRODUCTION

/** Les paliers franchis par une unité : autant de doublements. */
export function paliersFranchis(n: number): number {
  let k = 0
  for (const p of PALIERS) if (n >= p) k++
  return k
}

/** Le prochain palier d'une unité, ou null au-delà du dernier. */
export function prochainPalier(n: number): number | null {
  for (const p of PALIERS) if (n < p) return p
  return null
}

export function multiplicateurPrestige(j: Joueur): number {
  return 1 + PRESTIGE.parPoint * j.points
}

/** Ce que multiplie une unité : ses paliers, ses améliorations, le prestige. */
export function multiplicateurUnite(j: Joueur, i: number): number {
  return Math.pow(2, paliersFranchis(j.unites[i] ?? 0) + (j.niveaux[i] ?? 0)) * multiplicateurPrestige(j)
}

/** Ce que produit un seul module d'une unité, en R par seconde. */
export function debitModule(j: Joueur, i: number): number {
  const u = UNITES[i]
  if (u === undefined) return 0
  return u.debit * multiplicateurUnite(j, i)
}

/** Ce que produit une unité, tous exemplaires réunis, en R par seconde. */
export function debitUnite(j: Joueur, i: number): number {
  const u = UNITES[i]
  if (u === undefined) return 0
  return u.debit * (j.unites[i] ?? 0) * multiplicateurUnite(j, i)
}

/** La production du joueur, en R par seconde. */
export function debit(j: Joueur): number {
  let d = 0
  for (let i = 0; i < UNITES.length; i++) d += debitUnite(j, i)
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

/** Le coût des `n` prochains exemplaires d'une unité (une suite géométrique). */
export function coutUnite(j: Joueur, i: number, n = 1): number {
  const u = UNITES[i]
  if (u === undefined) return Infinity
  const possedes = j.achetes[i] ?? 0
  return Math.ceil(u.cout * Math.pow(CROISSANCE, possedes) * ((Math.pow(CROISSANCE, n) - 1) / (CROISSANCE - 1)))
}

/** Une unité est visible dès qu'on possède la précédente (le dévoilement survit au prestige). */
export function visible(j: Joueur, i: number): boolean {
  return i < j.connues
}

export function peutAcheterModule(j: Joueur, i: number): boolean {
  return visible(j, i) && j.or + 1e-9 >= coutUnite(j, i, 1)
}

/** Où apparaît un module qu'on vient d'acheter : sous la base, au-delà des anneaux, en rang. */
export function placeDApparition(j: Joueur): { x: number; y: number } {
  const n = j.modules.filter((mo) => mo.prise === null).length
  const distance = (ANNEAUX[j.anneaux - 1] ?? ANNEAUX[0]!).distance + 190
  // Le premier au milieu, puis de part et d'autre.
  const colonnes = [0, 1, -1, 2, -2]
  return { x: (colonnes[n % 5] ?? 0) * 120, y: distance + Math.floor(n / 5) * 120 }
}

/** Achète un module : il apparaît débranché, à glisser sur une prise. Rend le module, ou null. */
export function acheterModule(j: Joueur, i: number): Module | null {
  if (!peutAcheterModule(j, i)) return null
  j.or -= coutUnite(j, i, 1)
  j.achetes[i] = (j.achetes[i] ?? 0) + 1
  const place = placeDApparition(j)
  const mo: Module = { id: j.prochainModule++, type: i, prise: null, x: place.x, y: place.y }
  j.modules.push(mo)
  // Posséder une unité dévoile la suivante.
  j.connues = Math.max(j.connues, Math.min(UNITES.length, i + 2))
  return mo
}

// ---------------------------------------------------------------------------
// LES PRISES ET LES ANNEAUX

/** Le nombre de prises qu'offrent les anneaux possédés. */
export function nombreDePrises(j: Joueur): number {
  let n = 0
  for (let k = 0; k < j.anneaux; k++) n += ANNEAUX[k]?.prises ?? 0
  return n
}

/** La distance du centre de la base à son dernier anneau. */
export function rayonDeLaBase(j: Joueur): number {
  return (ANNEAUX[j.anneaux - 1] ?? ANNEAUX[0]!).distance
}

/** La place d'une prise : sa position autour de la base (pixels-monde), l'angle vers l'extérieur, son anneau. */
export function positionPrise(index: number): { x: number; y: number; angle: number; anneau: number } {
  let reste = index
  for (let k = 0; k < ANNEAUX.length; k++) {
    const a = ANNEAUX[k]!
    if (reste < a.prises) {
      // Les anneaux impairs sont décalés d'une demi-prise : les modules ne se cachent pas l'un l'autre.
      const angle = -Math.PI / 2 + ((reste + (k % 2) * 0.5) / a.prises) * Math.PI * 2
      return { x: Math.cos(angle) * a.distance, y: Math.sin(angle) * a.distance, angle, anneau: k }
    }
    reste -= a.prises
  }
  return { x: 0, y: 0, angle: 0, anneau: -1 }
}

export function moduleSurPrise(j: Joueur, prise: number): Module | undefined {
  return j.modules.find((mo) => mo.prise === prise)
}

/** Les prises libres, dans l'ordre des anneaux. */
export function prisesLibres(j: Joueur): number[] {
  const prises = new Set<number>()
  for (const mo of j.modules) if (mo.prise !== null) prises.add(mo.prise)
  const libres: number[] = []
  for (let p = 0; p < nombreDePrises(j); p++) if (!prises.has(p)) libres.push(p)
  return libres
}

/** Branche un module sur une prise libre (il quitte sa prise d'avant, s'il en avait une). */
export function brancher(j: Joueur, mo: Module, prise: number): boolean {
  if (prise < 0 || prise >= nombreDePrises(j)) return false
  const occupant = moduleSurPrise(j, prise)
  if (occupant !== undefined && occupant !== mo) return false
  if (mo.prise === null) j.unites[mo.type] = (j.unites[mo.type] ?? 0) + 1
  mo.prise = prise
  return true
}

/** Débranche un module et le pose en (x, y) : il ne produit plus. */
export function debrancher(j: Joueur, mo: Module, x: number, y: number): void {
  if (mo.prise !== null) j.unites[mo.type] = Math.max(0, (j.unites[mo.type] ?? 0) - 1)
  mo.prise = null
  mo.x = x
  mo.y = y
}

/** Retire un module pour de bon (les bots s'en servent pour remplacer un module faible). */
export function jeter(j: Joueur, mo: Module): void {
  debrancher(j, mo, mo.x, mo.y)
  j.modules = j.modules.filter((x) => x !== mo)
}

/** Le coût de l'anneau suivant ; null quand on les a tous. */
export function coutAnneau(j: Joueur): number | null {
  return ANNEAUX[j.anneaux]?.cout ?? null
}

export function peutAcheterAnneau(j: Joueur): boolean {
  const c = coutAnneau(j)
  return c !== null && j.or + 1e-9 >= c
}

export function acheterAnneau(j: Joueur): boolean {
  if (!peutAcheterAnneau(j)) return false
  j.or -= coutAnneau(j) ?? 0
  j.anneaux += 1
  return true
}

/** Le coût du prochain niveau d'une unité ; null quand tout est acheté ou pas encore débloqué. */
export function coutAmelioration(j: Joueur, i: number): number | null {
  const u = UNITES[i]
  const niveau = j.niveaux[i] ?? 0
  const palier = AMELIORATIONS[niveau]
  if (u === undefined || palier === undefined) return null
  if ((j.unites[i] ?? 0) < palier.des) return null
  return Math.ceil(u.cout * palier.fois)
}

export function acheterAmelioration(j: Joueur, i: number): boolean {
  const c = coutAmelioration(j, i)
  if (c === null || j.or + 1e-9 < c) return false
  j.or -= c
  j.niveaux[i] = (j.niveaux[i] ?? 0) + 1
  return true
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
  j.unites = UNITES.map(() => 0)
  j.achetes = UNITES.map(() => 0)
  j.modules = []
  j.anneaux = 1
  j.niveaux = UNITES.map(() => 0)
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
