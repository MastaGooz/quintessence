/**
 * LE MOTEUR du système abstrait : pur, le temps en heures injecté, aucun
 * hasard. Tout ce qu'un joueur peut faire passe par ici (taper, vendre,
 * acheter, améliorer, prestiger) ; `avancer` fait produire et vendre le monde.
 */
import { AMELIORATIONS, AUTO_COUT, CROISSANCE, MARCHE, PALIERS, PRESTIGE, TAPE_PART, UNITES } from './donnees.ts'

export interface Joueur {
  id: number
  nom: string
  /** La ressource en main, pas encore vendue. */
  r: number
  or: number
  /** Les exemplaires de chaque unité (par index de `UNITES`). */
  unites: number[]
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
  const possedes = j.unites[i] ?? 0
  return Math.ceil(u.cout * Math.pow(CROISSANCE, possedes) * ((Math.pow(CROISSANCE, n) - 1) / (CROISSANCE - 1)))
}

/** Combien d'exemplaires l'or en poche paie. */
export function combienPayables(j: Joueur, i: number): number {
  let n = 0
  while (n < 1000 && coutUnite(j, i, n + 1) <= j.or + 1e-9) n++
  return n
}

/** Une unité est visible dès qu'on possède la précédente (le dévoilement survit au prestige). */
export function visible(j: Joueur, i: number): boolean {
  return i < j.connues
}

export function peutAcheterUnite(j: Joueur, i: number, n = 1): boolean {
  return visible(j, i) && n >= 1 && j.or + 1e-9 >= coutUnite(j, i, n)
}

export function acheterUnite(j: Joueur, i: number, n = 1): boolean {
  if (!peutAcheterUnite(j, i, n)) return false
  j.or -= coutUnite(j, i, n)
  j.unites[i] = (j.unites[i] ?? 0) + n
  // Posséder une unité dévoile la suivante.
  j.connues = Math.max(j.connues, Math.min(UNITES.length, i + 2))
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
