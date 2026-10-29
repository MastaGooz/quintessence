/**
 * LE MOTEUR : pur, sans horloge ni hasard. Le temps est injecté (`avancer`),
 * les actions sont des fonctions qui rendent vrai si elles ont eu lieu. C'est
 * le futur `logic/` du jeu ; la simulation et le jeu réel l'appellent pareil.
 */
import {
  AVANCE, BATIMENTS, CHEF, COMPTOIR, COULEURS, COUPS, DEPART, ELEMENTS, LABO, MAITRISE, RESSOURCES, TOUTES,
  type Element, type NomBatiment, type Quantites, type Ressource,
} from './donnees.ts'
import { graineDe, rngDe } from './rng.ts'

export type Stock = Record<Ressource, number>

export interface Batiment {
  nom: NomBatiment
  niveau: 1 | 2 | 3
  /** Saboté : à l'arrêt jusqu'à cet instant. */
  arretJusqua: number
  /** Chef-d'œuvre : l'avancement du cycle en cours, de 0 à 1 ; les entrées se consomment au fil du cycle. */
  progres: number
}

export interface Offre {
  vendeur: number
  ressource: Ressource
  quantite: number
  prix: number
}

export interface Journal {
  orVentesComptoir: number
  orAchatsComptoir: number
  orVentesJoueurs: number
  orAchatsJoueurs: number
  /** Bâtiments-heures à l'arrêt faute d'entrées. */
  heuresArretees: number
  /** Les mêmes heures, par ressource manquante (la première qui manque). */
  arrets: Partial<Record<Ressource, number>>
  /** Bâtiments-heures d'extraction perdues, entrepôt plein. */
  heuresPleines: number
  chefsProduits: number
  chefsAchetes: number
  chefsVendus: number
  attaquesFaites: number
  attaquesRecues: number
  /** L'instant où chaque couleur a été achevée. */
  couleurs: number[]
  /** L'instant de chaque maîtrise. */
  maitrises: number[]
  /** L'instant du premier bâtiment de chef-d'œuvre, et du four. */
  chef: number | null
  four: number | null
}

export interface Joueur {
  id: number
  nom: string
  or: number
  stock: Stock
  /** Niveau de l'entrepôt, 0 au départ. */
  entrepot: number
  extensions: number
  batiments: Batiment[]
  points: Record<Element, number>
  maitrises: Element[]
  four: boolean
  /** Couleurs achevées, 0 à 4. */
  couleur: number
  cuisson: { fin: number } | null
  protegeJusqua: number
  recharges: Partial<Record<'pillage' | 'sabotage' | 'rumeur' | 'espion', number>>
  /** Les joueurs qu'on a espionnés : jusqu'à quand on voit leur laboratoire. */
  vues: Record<number, number>
  attaquesRecues: number[]
  cercleJour: number
  journal: Journal
}

export interface Comptoir {
  stock: Stock
  rumeur: { ressource: Ressource; fin: number } | null
}

export interface Monde {
  t: number
  /** La graine du monde, et le compte des tirages faits : le hasard est rejouable. */
  graine: number
  des: number
  joueurs: Joueur[]
  comptoir: Comptoir
  offres: Offre[]
  gazette: string[]
  volumeComptoir: Stock
  volumeJoueurs: Stock
}

export function stockVide(): Stock {
  const s = {} as Stock
  for (const r of TOUTES) s[r] = 0
  return s
}

export function nouveauJoueur(id: number, nom: string): Joueur {
  const stock = stockVide()
  for (const [r, q] of Object.entries(DEPART.stock)) stock[r as Ressource] = q ?? 0
  return {
    id,
    nom,
    or: DEPART.or,
    stock,
    entrepot: 0,
    extensions: 0,
    batiments: [],
    points: { feu: 0, terre: 0, eau: 0, air: 0 },
    maitrises: [],
    four: false,
    couleur: 0,
    cuisson: null,
    protegeJusqua: 0,
    recharges: {},
    vues: {},
    attaquesRecues: [],
    cercleJour: -1,
    journal: {
      orVentesComptoir: 0,
      orAchatsComptoir: 0,
      orVentesJoueurs: 0,
      orAchatsJoueurs: 0,
      heuresArretees: 0,
      arrets: {},
      heuresPleines: 0,
      chefsProduits: 0,
      chefsAchetes: 0,
      chefsVendus: 0,
      attaquesFaites: 0,
      attaquesRecues: 0,
      couleurs: [],
      maitrises: [],
      chef: null,
      four: null,
    },
  }
}

export function nouveauMonde(noms: string[], graine = 1): Monde {
  const stock = stockVide()
  for (const r of TOUTES) stock[r] = RESSOURCES[r].stockNormal
  return {
    t: 0,
    graine,
    des: 0,
    joueurs: noms.map((n, i) => nouveauJoueur(i, n)),
    comptoir: { stock, rumeur: null },
    offres: [],
    gazette: [],
    volumeComptoir: stockVide(),
    volumeJoueurs: stockVide(),
  }
}

// ---------------------------------------------------------------- LE COMPTOIR

/** Le prix auquel le comptoir ACHÈTE (ce que touche le joueur qui vend). */
export function prixVente(m: Monde, r: Ressource): number {
  const f = RESSOURCES[r]
  const s = Math.max(1, m.comptoir.stock[r])
  let p = f.prix * Math.pow(f.stockNormal / s, COMPTOIR.exposant)
  p = Math.min(f.prix * COMPTOIR.prixMax, Math.max(f.prix * COMPTOIR.prixMin, p))
  if (m.comptoir.rumeur !== null && m.comptoir.rumeur.ressource === r && m.t < m.comptoir.rumeur.fin) p *= COMPTOIR.rumeur
  return p
}

/** Le prix auquel le comptoir VEND. */
export function prixAchat(m: Monde, r: Ressource): number {
  return prixVente(m, r) * COMPTOIR.ecartAchat
}

const TRANCHE = 5

/** Vend `n` au comptoir, par tranches : le prix baisse à mesure. Rend l'or reçu. */
export function vendre(m: Monde, j: Joueur, r: Ressource, n: number): number {
  const vendu = Math.min(n, j.stock[r])
  let reste = vendu
  let recu = 0
  while (reste > 1e-9) {
    const q = Math.min(TRANCHE, reste)
    recu += q * prixVente(m, r)
    m.comptoir.stock[r] += q
    j.stock[r] -= q
    reste -= q
  }
  j.or += recu
  j.journal.orVentesComptoir += recu
  m.volumeComptoir[r] += vendu
  return recu
}

/** Achète jusqu'à `n` au comptoir, dans la limite de l'or et de l'entrepôt. Rend la quantité obtenue. */
export function acheter(m: Monde, j: Joueur, r: Ressource, n: number): number {
  let reste = Math.min(n, capacite(j) - j.stock[r])
  let obtenu = 0
  while (reste > 1e-9) {
    const p = prixAchat(m, r)
    const q = Math.min(TRANCHE, reste, j.or / p)
    if (q <= 1e-9) break
    j.or -= q * p
    j.journal.orAchatsComptoir += q * p
    m.comptoir.stock[r] = Math.max(0, m.comptoir.stock[r] - q)
    j.stock[r] += q
    obtenu += q
    reste -= q
  }
  m.volumeComptoir[r] += obtenu
  return obtenu
}

/** Ce que rapporterait la vente de `n` au comptoir, par tranches, sans rien changer. */
export function estimerVente(m: Monde, r: Ressource, n: number): number {
  const f = RESSOURCES[r]
  let s = Math.max(1, m.comptoir.stock[r])
  let reste = n
  let total = 0
  while (reste > 1e-9) {
    const q = Math.min(TRANCHE, reste)
    let p = f.prix * Math.pow(f.stockNormal / s, COMPTOIR.exposant)
    p = Math.min(f.prix * COMPTOIR.prixMax, Math.max(f.prix * COMPTOIR.prixMin, p))
    if (m.comptoir.rumeur !== null && m.comptoir.rumeur.ressource === r && m.t < m.comptoir.rumeur.fin) p *= COMPTOIR.rumeur
    total += q * p
    s += q
    reste -= q
  }
  return total
}

/** Ce que coûterait l'achat de `n` au comptoir, par tranches, sans rien changer. */
export function estimerAchat(m: Monde, r: Ressource, n: number): number {
  const f = RESSOURCES[r]
  let s = Math.max(1, m.comptoir.stock[r])
  let reste = n
  let total = 0
  while (reste > 1e-9) {
    const q = Math.min(TRANCHE, reste)
    let p = f.prix * Math.pow(f.stockNormal / Math.max(1, s), COMPTOIR.exposant)
    p = Math.min(f.prix * COMPTOIR.prixMax, Math.max(f.prix * COMPTOIR.prixMin, p))
    if (m.comptoir.rumeur !== null && m.comptoir.rumeur.ressource === r && m.t < m.comptoir.rumeur.fin) p *= COMPTOIR.rumeur
    total += q * p * COMPTOIR.ecartAchat
    s = Math.max(0, s - q)
    reste -= q
  }
  return total
}

/** Ce que coûterait au comptoir, maintenant, l'achat de ces quantités (approché au prix courant). */
export function prixDe(m: Monde, q: Quantites): number {
  let total = 0
  for (const [r, n] of Object.entries(q)) total += (n ?? 0) * prixAchat(m, r as Ressource)
  return total
}

// ---------------------------------------------------------------- LE LABORATOIRE

export function capacite(j: Joueur): number {
  return LABO.entrepot * (1 + j.entrepot)
}

export function emplacements(j: Joueur): number {
  return LABO.emplacements + j.extensions
}

export function occupes(j: Joueur): number {
  return j.batiments.length + (j.four ? 1 : 0)
}

export type Rang = 'apprenti' | 'compagnon' | 'maitre'

export function rang(j: Joueur, e: Element): Rang {
  const p = j.points[e]
  return p >= MAITRISE.maitre ? 'maitre' : p >= MAITRISE.compagnon ? 'compagnon' : 'apprenti'
}

export function rendement(j: Joueur, e: Element): number {
  const r = rang(j, e)
  return 1 + (r === 'maitre' ? MAITRISE.rendementMaitre : r === 'compagnon' ? MAITRISE.rendementCompagnon : 0)
}

export function multiplicateur(j: Joueur, b: Batiment): number {
  const f = BATIMENTS[b.nom]
  return (LABO.niveaux[b.niveau - 1] ?? 1) * (f.element === undefined ? 1 : rendement(j, f.element))
}

function gagnerPoints(m: Monde, j: Joueur, e: Element, n: number): void {
  const fige = j.maitrises.length >= MAITRISE.maitrisesMax && !j.maitrises.includes(e)
  j.points[e] = fige ? Math.min(MAITRISE.maitre - 1, j.points[e] + n) : j.points[e] + n
  if (!fige && j.points[e] >= MAITRISE.maitre && !j.maitrises.includes(e)) {
    j.maitrises.push(e)
    j.journal.maitrises.push(m.t)
  }
}

export function compteDe(j: Joueur, nom: NomBatiment): number {
  return j.batiments.filter((b) => b.nom === nom).length
}

/** Le coût de construction, surcoûts et remises compris. */
export function coutConstruction(j: Joueur, nom: NomBatiment): { or: number; cout: Quantites } {
  const f = BATIMENTS[nom]
  let facteur = 1
  if (f.type === 'extraction') facteur *= 1 + LABO.surcoutExemplaire * compteDe(j, nom)
  if (nom === 'entrepot') facteur *= j.entrepot + 1
  if (nom === 'extension') facteur *= Math.pow(LABO.surcoutExtension, j.extensions)
  if (f.element !== undefined && rang(j, f.element) === 'maitre') facteur *= 1 - MAITRISE.remiseMaitre
  const cout: Quantites = {}
  for (const [r, q] of Object.entries(f.cout)) cout[r as Ressource] = Math.ceil((q as number) * facteur)
  return { or: Math.ceil(f.or * facteur), cout }
}

export function coutAmelioration(j: Joueur, b: Batiment): { or: number; cout: Quantites } {
  const base = coutConstruction(j, b.nom)
  const vise = b.niveau + 1
  const cout: Quantites = {}
  for (const [r, q] of Object.entries(base.cout)) cout[r as Ressource] = (q ?? 0) * vise
  cout.verre = (cout.verre ?? 0) + LABO.niveauVerre
  cout.essence = (cout.essence ?? 0) + LABO.niveauEssence
  return { or: base.or * vise, cout }
}

/** Ce qui manque dans l'entrepôt pour payer `cout`. */
export function manque(j: Joueur, cout: Quantites): Quantites {
  const m: Quantites = {}
  for (const [r, q] of Object.entries(cout)) {
    const d = (q ?? 0) - j.stock[r as Ressource]
    if (d > 1e-9) m[r as Ressource] = d
  }
  return m
}

export function peutPayer(j: Joueur, or: number, cout: Quantites): boolean {
  return j.or >= or - 1e-9 && Object.keys(manque(j, cout)).length === 0
}

function payer(j: Joueur, or: number, cout: Quantites): void {
  j.or -= or
  for (const [r, q] of Object.entries(cout)) j.stock[r as Ressource] -= q ?? 0
}

export function peutConstruire(j: Joueur, nom: NomBatiment): boolean {
  const f = BATIMENTS[nom]
  if (f.unique && j.four) return false
  if (nom === 'extension' && emplacements(j) >= LABO.emplacementsMax) return false
  if (!f.sansEmplacement && occupes(j) >= emplacements(j)) return false
  if (f.reserveMaitre && (f.element === undefined || rang(j, f.element) !== 'maitre')) return false
  return true
}

export function construire(m: Monde, j: Joueur, nom: NomBatiment): boolean {
  if (!peutConstruire(j, nom)) return false
  const { or, cout } = coutConstruction(j, nom)
  if (!peutPayer(j, or, cout)) return false
  payer(j, or, cout)
  const f = BATIMENTS[nom]
  if (nom === 'entrepot') j.entrepot += 1
  else if (nom === 'extension') j.extensions += 1
  else if (f.type === 'four') {
    j.four = true
    j.journal.four = m.t
  } else {
    j.batiments.push({ nom, niveau: 1, arretJusqua: 0, progres: 0 })
    if (f.type === 'chef' && j.journal.chef === null) j.journal.chef = m.t
  }
  if (f.element !== undefined) {
    if (f.type === 'extraction') gagnerPoints(m, j, f.element, MAITRISE.points.extraction)
    else if (f.type === 'transformation') gagnerPoints(m, j, f.element, MAITRISE.points.transformation)
  }
  return true
}

/** Rend l'emplacement, pas les matériaux ; les points de maîtrise restent. */
export function demolir(j: Joueur, b: Batiment): boolean {
  const i = j.batiments.indexOf(b)
  if (i < 0) return false
  j.batiments.splice(i, 1)
  return true
}

export function ameliorer(m: Monde, j: Joueur, b: Batiment): boolean {
  if (b.niveau >= 3) return false
  const f = BATIMENTS[b.nom]
  if (f.type !== 'extraction' && f.type !== 'transformation' && f.type !== 'chef') return false
  const { or, cout } = coutAmelioration(j, b)
  if (!peutPayer(j, or, cout)) return false
  payer(j, or, cout)
  b.niveau = (b.niveau + 1) as 2 | 3
  if (f.element !== undefined) gagnerPoints(m, j, f.element, MAITRISE.points.niveau)
  return true
}

// ---------------------------------------------------------------- LE TEMPS

function disponibles(j: Joueur, besoin: Quantites): boolean {
  return manquant(j, besoin) === null
}

/** La première entrée qui manque, ou null. */
function manquant(j: Joueur, besoin: Quantites): Ressource | null {
  for (const [r, q] of Object.entries(besoin)) if (j.stock[r as Ressource] < (q ?? 0) - 1e-9) return r as Ressource
  return null
}

/** L'entrée qui manque à ce bâtiment pour tourner un pas, ou null s'il tourne. */
export function entreeManquante(m: Monde, j: Joueur, b: Batiment, dt: number): Ressource | null {
  if (m.t < b.arretJusqua) return null
  const f = BATIMENTS[b.nom]
  if (f.consomme === undefined) return null
  const mult = multiplicateur(j, b)
  const part = f.type === 'chef' ? (mult * dt) / (f.cycleH ?? 4) : mult * dt
  return manquant(j, fois(f.consomme, part))
}

function arreter(j: Joueur, besoin: Quantites, dt: number): void {
  j.journal.heuresArretees += dt
  const r = manquant(j, besoin)
  if (r !== null) j.journal.arrets[r] = (j.journal.arrets[r] ?? 0) + dt
}

function retirer(j: Joueur, besoin: Quantites): void {
  for (const [r, q] of Object.entries(besoin)) j.stock[r as Ressource] -= q ?? 0
}

/** Ajoute dans la limite de l'entrepôt ; rend ce qui a débordé. */
function ajouter(j: Joueur, r: Ressource, q: number): number {
  const cap = capacite(j)
  const place = Math.max(0, cap - j.stock[r])
  const mis = Math.min(q, place)
  j.stock[r] += mis
  return q - mis
}

function fois(q: Quantites, k: number): Quantites {
  const r: Quantites = {}
  for (const [n, v] of Object.entries(q)) r[n as Ressource] = (v ?? 0) * k
  return r
}

/** Fait passer `dt` heures : la production, les cycles, les cuissons, le retour du comptoir. */
export function avancer(m: Monde, dt: number): void {
  for (const j of m.joueurs) {
    // LES PRODUCTEURS D'ABORD : ce qui sort d'une mine dans le pas sert à la forge dans le même pas.
    const ordre = (b: Batiment): number => (BATIMENTS[b.nom].type === 'extraction' ? 0 : BATIMENTS[b.nom].type === 'chef' ? 2 : 1)
    for (const b of [...j.batiments].sort((x, y) => ordre(x) - ordre(y))) {
      if (m.t < b.arretJusqua) continue
      const f = BATIMENTS[b.nom]
      const mult = multiplicateur(j, b)
      if (f.type === 'extraction') {
        let perdu = 0
        for (const [r, q] of Object.entries(f.produit ?? {})) perdu += ajouter(j, r as Ressource, (q ?? 0) * mult * dt)
        if (perdu > 1e-9) j.journal.heuresPleines += dt
      } else if (f.type === 'transformation') {
        const besoin = fois(f.consomme ?? {}, mult * dt)
        if (disponibles(j, besoin)) {
          retirer(j, besoin)
          for (const [r, q] of Object.entries(f.produit ?? {})) ajouter(j, r as Ressource, (q ?? 0) * mult * dt)
        } else arreter(j, besoin, dt)
      } else if (f.type === 'chef') {
        // LE CYCLE AVANCE AU FIL DES ENTRÉES : une part du cycle par pas, et le chef-d'œuvre sort à 1.
        const part = (mult * dt) / (f.cycleH ?? 4)
        const besoin = fois(f.consomme ?? {}, part)
        if (disponibles(j, besoin)) {
          retirer(j, besoin)
          b.progres += part
          if (b.progres >= 1 - 1e-9) {
            b.progres -= 1
            for (const [r, q] of Object.entries(f.produit ?? {})) ajouter(j, r as Ressource, q ?? 0)
            j.journal.chefsProduits += 1
          }
        } else arreter(j, besoin, dt)
      }
    }
    if (j.cuisson !== null && m.t + dt >= j.cuisson.fin - 1e-9) {
      j.couleur += 1
      j.journal.couleurs.push(j.cuisson.fin)
      j.cuisson = null
    }
  }
  const k = 1 - Math.pow(1 - COMPTOIR.retourParHeure, dt)
  for (const r of TOUTES) {
    const s = m.comptoir.stock[r]
    m.comptoir.stock[r] = s + (RESSOURCES[r].stockNormal - s) * k
  }
  m.t += dt
}

// ---------------------------------------------------------------- LES COUPS BAS

/** Un tirage dans [0, 1[, le n-ième du monde : la même partie rejoue les mêmes. */
function tirer(m: Monde): number {
  m.des += 1
  return rngDe(graineDe(m.graine, m.des))()
}

/** « Jour 2, 14 h » : la saison commence un matin à 8 h. */
function quand(t: number): string {
  return `Jour ${Math.floor(t / 24) + 1}, ${Math.floor((t % 24) + 8) % 24} h`
}

/** L'auteur d'un coup, tel que la gazette le nomme : découvert une fois sur trois. */
function auteur(m: Monde, a: Joueur): string {
  return tirer(m) < COUPS.decouverte ? a.nom : 'un inconnu'
}

export function aLe(j: Joueur, nom: NomBatiment): boolean {
  return j.batiments.some((b) => b.nom === nom)
}

function jourDe(t: number): number {
  return Math.floor(t / 24)
}

function attaquable(m: Monde, cible: Joueur): boolean {
  if (m.t < cible.protegeJusqua) return false
  const recentes = cible.attaquesRecues.filter((t) => m.t - t < 24).length
  return recentes < COUPS.pillage.parJourEtCible
}

export function peutPiller(m: Monde, a: Joueur, cible: Joueur): boolean {
  return (
    a !== cible &&
    aLe(a, 'repaire') &&
    (a.recharges.pillage ?? 0) <= m.t &&
    a.stock.braises >= COUPS.pillage.braises &&
    attaquable(m, cible)
  )
}

export function piller(m: Monde, a: Joueur, cible: Joueur): boolean {
  if (!peutPiller(m, a, cible)) return false
  a.stock.braises -= COUPS.pillage.braises
  const part = aLe(cible, 'gardien') ? COUPS.pillage.partGardee : COUPS.pillage.part
  let valeur = 0
  for (const r of TOUTES) {
    const q = Math.floor(cible.stock[r] * part)
    if (q <= 0) continue
    cible.stock[r] -= q
    const perdu = ajouter(a, r, q)
    valeur += (q - perdu) * prixVente(m, r)
  }
  cible.protegeJusqua = m.t + COUPS.pillage.protectionH
  cible.attaquesRecues.push(m.t)
  a.recharges.pillage = m.t + COUPS.pillage.rechargeH
  a.journal.attaquesFaites += 1
  cible.journal.attaquesRecues += 1
  m.gazette.push(`${quand(m.t)} : ${auteur(m, a)} pille ${cible.nom} (${valeur.toFixed(0)} or de butin)`)
  return true
}

export function peutSaboter(m: Monde, a: Joueur, cible: Joueur): boolean {
  return (
    a !== cible &&
    aLe(a, 'officine') &&
    (a.recharges.sabotage ?? 0) <= m.t &&
    a.stock.mercure >= COUPS.sabotage.mercure &&
    attaquable(m, cible)
  )
}

/** Arrête ce qui vaut le plus cher chez la cible : la cuisson en cours, sinon un chef-d'œuvre, sinon un atelier avancé. */
export function saboter(m: Monde, a: Joueur, cible: Joueur): boolean {
  if (!peutSaboter(m, a, cible)) return false
  a.stock.mercure -= COUPS.sabotage.mercure
  a.recharges.sabotage = m.t + COUPS.sabotage.rechargeH
  a.journal.attaquesFaites += 1
  cible.journal.attaquesRecues += 1
  cible.protegeJusqua = m.t + COUPS.pillage.protectionH
  cible.attaquesRecues.push(m.t)
  if (aLe(cible, 'cercle') && cible.cercleJour !== jourDe(m.t)) {
    cible.cercleJour = jourDe(m.t)
    m.gazette.push(`${quand(m.t)} : le cercle de ${cible.nom} annule un sabotage`)
    return true
  }
  if (cible.cuisson !== null) {
    cible.cuisson.fin += COUPS.sabotage.dureeH
    m.gazette.push(`${quand(m.t)} : ${auteur(m, a)} sabote le four de ${cible.nom}`)
    return true
  }
  const ordre = (b: Batiment): number => (BATIMENTS[b.nom].type === 'chef' ? 0 : BATIMENTS[b.nom].avance ? 1 : 2)
  const b = [...cible.batiments].sort((x, y) => ordre(x) - ordre(y))[0]
  if (b !== undefined) {
    b.arretJusqua = m.t + COUPS.sabotage.dureeH
    m.gazette.push(`${quand(m.t)} : ${auteur(m, a)} sabote un atelier chez ${cible.nom}`)
  }
  return true
}

export function peutEspionner(m: Monde, a: Joueur, cible: Joueur): boolean {
  return a !== cible && aLe(a, 'tour') && (a.recharges.espion ?? 0) <= m.t && a.stock.cristal >= COUPS.espion.cristal
}

/** Montre le laboratoire de la cible pendant un jour. Jamais découvert : regarder n'est pas un crime. */
export function espionner(m: Monde, a: Joueur, cible: Joueur): boolean {
  if (!peutEspionner(m, a, cible)) return false
  a.stock.cristal -= COUPS.espion.cristal
  a.recharges.espion = m.t + COUPS.espion.rechargeH
  a.vues[cible.id] = m.t + COUPS.espion.dureeH
  return true
}

export function voit(m: Monde, a: Joueur, cible: Joueur): boolean {
  return a === cible || (a.vues[cible.id] ?? 0) > m.t
}

export function lancerRumeur(m: Monde, a: Joueur, r: Ressource): boolean {
  if (!aLe(a, 'cabinet') || (a.recharges.rumeur ?? 0) > m.t || a.or < COUPS.rumeur.or) return false
  a.or -= COUPS.rumeur.or
  a.recharges.rumeur = m.t + COUPS.rumeur.rechargeH
  m.comptoir.rumeur = { ressource: r, fin: m.t + COUPS.rumeur.dureeH }
  a.journal.attaquesFaites += 1
  m.gazette.push(`${quand(m.t)} : une rumeur fait chuter le ${r}`)
  return true
}

// ---------------------------------------------------------------- LES ÉCHANGES ENTRE JOUEURS

export function retirerOffres(m: Monde, j: Joueur): void {
  m.offres = m.offres.filter((o) => o.vendeur !== j.id)
}

export function offrir(m: Monde, j: Joueur, r: Ressource, quantite: number, prix: number): void {
  if (quantite <= 0) return
  m.offres.push({ vendeur: j.id, ressource: r, quantite, prix })
}

/** Achète jusqu'à `n` aux offres les moins chères des autres joueurs. Rend la quantité obtenue. */
export function acheterAuxJoueurs(m: Monde, j: Joueur, r: Ressource, n: number): number {
  let reste = n
  let obtenu = 0
  const offres = m.offres.filter((o) => o.ressource === r && o.vendeur !== j.id).sort((a, b) => a.prix - b.prix)
  for (const o of offres) {
    if (reste <= 0) break
    const v = m.joueurs[o.vendeur]!
    const q = Math.min(reste, o.quantite, v.stock[r], Math.floor(j.or / o.prix), capacite(j) - j.stock[r])
    if (q <= 0) continue
    v.stock[r] -= q
    j.stock[r] += q
    j.or -= q * o.prix
    v.or += q * o.prix
    j.journal.orAchatsJoueurs += q * o.prix
    v.journal.orVentesJoueurs += q * o.prix
    if (RESSOURCES[r].niveau === 3) {
      j.journal.chefsAchetes += q
      v.journal.chefsVendus += q
    }
    o.quantite -= q
    reste -= q
    obtenu += q
    m.volumeJoueurs[r] += q
  }
  m.offres = m.offres.filter((o) => o.quantite > 0)
  return obtenu
}

// ---------------------------------------------------------------- LE GRAND ŒUVRE

export function besoinCouleur(j: Joueur): Quantites | null {
  const c = COULEURS[j.couleur]
  if (c === undefined) return null
  const q: Quantites = {}
  for (const e of ELEMENTS) q[CHEF[e]] = c.parElement
  return q
}

/** Les chefs-d'œuvre de chaque élément encore nécessaires jusqu'au rouge. */
export function besoinRestant(j: Joueur): number {
  let n = 0
  for (let c = j.couleur; c < COULEURS.length; c++) n += COULEURS[c]!.parElement
  return n
}

export function lancerCouleur(m: Monde, j: Joueur): boolean {
  if (!j.four || j.cuisson !== null) return false
  const besoin = besoinCouleur(j)
  if (besoin === null || !disponibles(j, besoin)) return false
  retirer(j, besoin)
  j.cuisson = { fin: m.t + COULEURS[j.couleur]!.dureeH }
  return true
}

// ---------------------------------------------------------------- LECTURES

export function fortune(m: Monde, j: Joueur): number {
  let f = j.or
  for (const r of TOUTES) f += j.stock[r] * prixVente(m, r)
  return f
}

/** Production nette par heure de chaque ressource, tous bâtiments tournant. */
export function bilanHoraire(j: Joueur): Stock {
  const net = stockVide()
  for (const b of j.batiments) {
    const f = BATIMENTS[b.nom]
    const mult = multiplicateur(j, b)
    const parH = f.type === 'chef' ? mult / (f.cycleH ?? 4) : mult
    for (const [r, q] of Object.entries(f.produit ?? {})) net[r as Ressource] += (q ?? 0) * parH
    for (const [r, q] of Object.entries(f.consomme ?? {})) net[r as Ressource] -= (q ?? 0) * parH
  }
  return net
}

export { AVANCE, CHEF }
