/**
 * LES BOTS : des joueurs simulés qui passent quatre fois par jour et jouent une
 * stratégie simple. Ils ne font que ce qu'un vrai joueur pourrait faire, par les
 * mêmes fonctions du moteur ; ce qu'ils savent de plus (tout voir), un espion
 * le saurait aussi.
 */
import {
  BATIMENTS, BATIMENT_CHEF, CHEF, ELEMENTS, RESSOURCES, TOUTES,
  type Element, type NomBatiment, type Quantites, type Ressource,
} from './donnees.ts'
import {
  acheter, acheterAuxJoueurs, ameliorer, besoinCouleur, besoinRestant, bilanHoraire, capacite, construire,
  coutAmelioration, coutConstruction, emplacements, fortune, lancerCouleur, manque, multiplicateur, occupes, offrir, peutConstruire,
  peutPiller, peutSaboter, piller, prixAchat, prixDe, prixVente, rang, retirerOffres, saboter, vendre,
  type Batiment, type Joueur, type Monde,
} from './moteur.ts'

export interface Strategie {
  nom: string
  /** Les éléments qu'il cherche à maîtriser (les quatre pour le touche-à-tout). */
  elements: Element[]
  generaliste?: boolean
  agressif?: boolean
  /** Achète ses braises au lieu de bâtir son fourneau (l'expérience qui a montré l'avantage du Feu). */
  sansFourneau?: boolean
}

export interface EtatBot {
  pleinesVu: number
}

/** On ne descend jamais sous cet or : il faut pouvoir racheter des braises. */
const RESERVE_OR = 50
/** La réserve du moment : plus haute quand on épargne pour un chantier hors de prix. */
let reserve = RESERVE_OR
/** Quand le chantier du plan attend son emplacement et son or : plus de bâtiment neuf, des améliorations seulement. */
let seulementAmeliorer = false
/** On s'approvisionne pour ce nombre d'heures : jusqu'à la visite suivante, et un peu plus. */
const HEURES_AVANCE = 12
const CONSTRUCTIONS_PAR_VISITE = 4

const MATIERES: Record<Element, Ressource[]> = {
  feu: ['charbon', 'soufre'],
  terre: ['minerai', 'argile'],
  eau: ['herbes', 'sel'],
  air: ['sable', 'cristal'],
}
const SIMPLE: Record<Element, NomBatiment> = { feu: 'fourneau', terre: 'forge', eau: 'alambic', air: 'verrerie' }
const AVANCEE: Record<Element, NomBatiment> = { feu: 'autel', terre: 'creuset', eau: 'cornue', air: 'atelierRunes' }

/** Le bâtiment qui produit chaque ressource (le premier qui la produit). */
const PRODUCTEUR: Partial<Record<Ressource, NomBatiment>> = {}
for (const [nom, f] of Object.entries(BATIMENTS)) {
  for (const r of Object.keys(f.produit ?? {})) if (PRODUCTEUR[r as Ressource] === undefined) PRODUCTEUR[r as Ressource] = nom as NomBatiment
}

function produit(b: Batiment, r: Ressource): boolean {
  return (BATIMENTS[b.nom].produit as Quantites | undefined)?.[r] !== undefined
}

function compte(j: Joueur, nom: NomBatiment): number {
  return nom === 'four' ? (j.four ? 1 : 0) : j.batiments.filter((b) => b.nom === nom).length
}

/** La liste ordonnée de ce que le bot veut avoir, un exemplaire de chaque. */
function plan(j: Joueur, s: Strategie): NomBatiment[] {
  const liste: NomBatiment[] = []
  if (s.generaliste) {
    for (const e of ELEMENTS) liste.push(PRODUCTEUR[MATIERES[e][0]!]!)
    liste.push('fourneau', 'forge', 'verrerie', 'alambic')
    for (const e of ELEMENTS) liste.push(PRODUCTEUR[MATIERES[e][1]!]!)
    for (const e of ELEMENTS) liste.push(AVANCEE[e])
  } else {
    for (const e of s.elements) for (const r of MATIERES[e]) liste.push(PRODUCTEUR[r]!)
    for (const e of s.elements) liste.push(SIMPLE[e])
    // CHACUN SE CHAUFFE (Keko : les éléments doivent être égaux) : les braises achetées se stockent mal,
    // un fourneau à soi tourne la nuit. Sans lui, un non-Feu perd 300 à 400 heures de bâtiment par saison.
    if (!s.elements.includes('feu') && (!s.sansFourneau || braisesCheres)) liste.push('mineCharbon', 'fourneau')
    if (s.agressif) liste.push('repaire')
    if (j.journal.attaquesRecues >= 2) liste.push('gardien')
    for (const e of s.elements) liste.push(AVANCEE[e])
    if (s.agressif) liste.push('officine')
  }
  const maitres = s.elements.filter((e) => rang(j, e) === 'maitre')
  if (maitres[0] !== undefined) liste.push(BATIMENT_CHEF[maitres[0]], 'four')
  for (const e of maitres.slice(1)) liste.push(BATIMENT_CHEF[e])
  return liste
}

let braisesCheres = false

function prochain(j: Joueur, s: Strategie): NomBatiment | null {
  return plan(j, s).find((nom) => compte(j, nom) < 1) ?? null
}

/** Achète au comptoir ce qui manque pour payer, si l'or le permet en gardant la réserve. Rend vrai si tout est là. */
function completer(m: Monde, j: Joueur, or: number, cout: Quantites): boolean {
  const mq = manque(j, cout)
  let prix = 0
  for (const [r, q] of Object.entries(mq)) prix += (q ?? 0) * prixAchat(m, r as Ressource) * 1.05
  if (j.or - or - prix < reserve) return false
  for (const [r, q] of Object.entries(mq)) {
    const obtenu = acheter(m, j, r as Ressource, Math.ceil(q ?? 0))
    if (obtenu < (q ?? 0) - 1e-9) return false
  }
  return true
}

/** Ce que coûterait, or compris, l'achat au comptoir de ce qui manque pour `cout`. */
function prixDuManque(m: Monde, j: Joueur, cout: Quantites): number {
  let prix = 0
  for (const [r, q] of Object.entries(manque(j, cout))) prix += (q ?? 0) * prixAchat(m, r as Ressource) * 1.05
  return prix
}

function essayer(m: Monde, j: Joueur, nom: NomBatiment): boolean {
  if (seulementAmeliorer) return false
  if (!peutConstruire(j, nom)) {
    const f = BATIMENTS[nom]
    // PLUS D'EMPLACEMENT : une extension d'abord, si l'or suit pour les deux.
    if (!f.sansEmplacement && occupes(j) >= emplacements(j) && nom !== 'extension') {
      if (!peutConstruire(j, 'extension')) return false
      const ext = coutConstruction(j, 'extension')
      const bat = coutConstruction(j, nom)
      const total = ext.or + prixDuManque(m, j, ext.cout) + bat.or + prixDuManque(m, j, bat.cout)
      if (j.or - total < reserve) return false
      if (!essayer(m, j, 'extension')) return false
      if (!peutConstruire(j, nom)) return false
    } else return false
  }
  const { or, cout } = coutConstruction(j, nom)
  if (!completer(m, j, or, cout)) return false
  return construire(m, j, nom)
}

function essayerAmelioration(m: Monde, j: Joueur, b: Batiment): boolean {
  if (b.niveau >= 3) return false
  const { or, cout } = coutAmelioration(j, b)
  if (!completer(m, j, or, cout)) return false
  return ameliorer(m, j, b)
}

/**
 * Rachète ce que les bâtiments vont consommer d'ici la prochaine visite et qu'on ne produit pas assez.
 * LES BÂTIMENTS QUI VALENT LE PLUS SONT SERVIS D'ABORD : si l'or manque, c'est la forge qui s'arrête,
 * pas l'athanor. Chaque bâtiment réserve sa part de ce qui est en stock, puis achète le reste.
 */
function approvisionner(m: Monde, j: Joueur): void {
  const net = bilanHoraire(j)
  const ordre = (b: Batiment): number => (BATIMENTS[b.nom].type === 'chef' ? 0 : BATIMENTS[b.nom].avance ? 1 : 2)
  const alloue: Quantites = {}
  for (const b of [...j.batiments].sort((x, y) => ordre(x) - ordre(y))) {
    const f = BATIMENTS[b.nom]
    if (f.consomme === undefined) continue
    const parH = (f.type === 'chef' ? 1 / (f.cycleH ?? 4) : 1) * multiplicateur(j, b)
    // LES BRAISES D'ABORD dans chaque bâtiment : sans elles, rien ne tourne.
    const entrees = Object.entries(f.consomme).sort(([a], [b2]) => (b2 === 'braises' ? 1 : 0) - (a === 'braises' ? 1 : 0))
    for (const [r, q] of entrees) {
      const res = r as Ressource
      if (net[res] >= -1e-9) continue
      const part = (q ?? 0) * parH * HEURES_AVANCE
      const deja = alloue[res] ?? 0
      const enStock = Math.max(0, j.stock[res] - deja)
      const manquant = part - enStock
      alloue[res] = deja + Math.min(part, enStock)
      if (manquant <= 0) continue
      const abordable = Math.floor((j.or - RESERVE_OR) / prixAchat(m, res))
      const n = Math.min(Math.ceil(manquant), abordable, Math.floor(capacite(j) - j.stock[res]))
      if (n <= 0) continue
      alloue[res] = (alloue[res] ?? 0) + acheter(m, j, res, n)
    }
  }
}

/** Vend au comptoir ce qui dépasse ce qu'on garde : le prochain chantier, et la consommation à venir. */
function ecouler(m: Monde, j: Joueur, s: Strategie): void {
  const net = bilanHoraire(j)
  const garde: Quantites = {}
  const nom = prochain(j, s)
  if (nom !== null) for (const [r, q] of Object.entries(coutConstruction(j, nom).cout)) garde[r as Ressource] = (garde[r as Ressource] ?? 0) + (q ?? 0)
  for (const r of TOUTES) {
    const f = RESSOURCES[r]
    if (f.niveau === 3) {
      // LES CHEFS-D'ŒUVRE : offerts aux autres à la visite d'avant ; s'ils sont encore là et que l'or
      // manque pour le chantier suivant, le comptoir les prend.
      const surplus = Math.floor(j.stock[r] - (j.four ? besoinRestant(j) : 1))
      const prochainOr = nom === null ? 0 : coutConstruction(j, nom).or + prixDe(m, coutConstruction(j, nom).cout)
      if (surplus >= 1 && j.or < prochainOr + RESERVE_OR) vendre(m, j, r, surplus)
      continue
    }
    let keep = garde[r] ?? 0
    // CE QU'ON CONSOMME : la marge jusqu'à la prochaine visite, plus deux heures de sécurité.
    let conso = 0
    for (const b of j.batiments) {
      const fb = BATIMENTS[b.nom]
      const c = (fb.consomme as Quantites | undefined)?.[r]
      if (c !== undefined) conso += c * (fb.type === 'chef' ? 1 / (fb.cycleH ?? 4) : 1) * 2
    }
    keep += Math.max(0, -net[r]) * HEURES_AVANCE + conso * 2
    const surplus = Math.floor(j.stock[r] - keep)
    if (surplus >= 5) vendre(m, j, r, surplus)
  }
}

/** Quand le plan est fait : produire ce qui manque le plus, monter en niveau, s'agrandir. */
function croitre(m: Monde, j: Joueur, s: Strategie): boolean {
  const net = bilanHoraire(j)
  let pire: Ressource | null = null
  let pireValeur = 0
  for (const r of TOUTES) {
    const f = RESSOURCES[r]
    if (net[r] >= -1e-9 || f.niveau === 3) continue
    if (!s.generaliste && !s.elements.includes(f.element)) continue
    const v = -net[r] * prixAchat(m, r)
    if (v > pireValeur) {
      pireValeur = v
      pire = r
    }
  }
  if (pire !== null) {
    const bas = j.batiments.filter((b) => produit(b, pire!) && b.niveau < 3).sort((a, b) => a.niveau - b.niveau)[0]
    if (bas !== undefined && essayerAmelioration(m, j, bas)) return true
    const nom = PRODUCTEUR[pire]
    if (nom !== undefined && essayer(m, j, nom)) return true
  }
  // LE MARCHÉ A FAIM d'une ressource de ses éléments : on la produit pour la vendre.
  let cher: Ressource | null = null
  let cherValeur = 0
  for (const r of TOUTES) {
    const f = RESSOURCES[r]
    if (f.niveau === 3 || PRODUCTEUR[r] === undefined) continue
    if (!s.generaliste && !s.elements.includes(f.element)) continue
    const ratio = prixVente(m, r) / f.prix
    if (ratio > 1.8 && ratio * f.prix > cherValeur) {
      cherValeur = ratio * f.prix
      cher = r
    }
  }
  if (cher !== null) {
    const bas = j.batiments.filter((b) => produit(b, cher!) && b.niveau < 3).sort((a, b) => a.niveau - b.niveau)[0]
    if (bas !== undefined && essayerAmelioration(m, j, bas)) return true
    if (essayer(m, j, PRODUCTEUR[cher]!)) return true
  }
  // RIEN NE MANQUE : plus de sortie. Les chefs-d'œuvre d'abord, puis les avancés, puis le reste.
  const ordre = (b: Batiment): number => (BATIMENTS[b.nom].type === 'chef' ? 0 : BATIMENTS[b.nom].avance ? 1 : BATIMENTS[b.nom].type === 'transformation' ? 2 : 3)
  const candidats = j.batiments.filter((b) => b.niveau < 3).sort((a, b) => ordre(a) - ordre(b) || a.niveau - b.niveau)
  for (const b of candidats) if (essayerAmelioration(m, j, b)) return true
  for (const e of s.elements) if (essayer(m, j, AVANCEE[e])) return true
  return false
}

/** Une branche qu'on veut maîtriser et qui ne l'est pas : la monter, par le bâtiment le moins cher à améliorer. */
function progresserMaitrise(m: Monde, j: Joueur, s: Strategie): boolean {
  for (const e of s.elements) {
    if (rang(j, e) === 'maitre') continue
    if (j.maitrises.length >= 2) return false
    const candidats = j.batiments
      .filter((b) => BATIMENTS[b.nom].element === e && b.niveau < 3)
      .sort((a, b) => coutAmelioration(j, a).or - coutAmelioration(j, b).or)
    for (const b of candidats) if (essayerAmelioration(m, j, b)) return true
    for (const r of MATIERES[e]) if (compte(j, PRODUCTEUR[r]!) < 2 && essayer(m, j, PRODUCTEUR[r]!)) return true
  }
  return false
}

function attaquer(m: Monde, j: Joueur): void {
  const autres = m.joueurs.filter((a) => a !== j)
  const riche = [...autres].filter((a) => peutPiller(m, j, a)).sort((a, b) => fortune(m, b) - fortune(m, a))[0]
  if (riche !== undefined) piller(m, j, riche)
  const avance = [...autres]
    .filter((a) => peutSaboter(m, j, a))
    .sort((a, b) => b.couleur + (b.cuisson !== null ? 0.5 : 0) - (a.couleur + (a.cuisson !== null ? 0.5 : 0)))[0]
  if (avance !== undefined && (avance.couleur > 0 || avance.cuisson !== null)) saboter(m, j, avance)
}

/** Le Grand Œuvre : complète les chefs-d'œuvre qui manquent, aux joueurs puis au comptoir, et lance la couleur. */
function couleur(m: Monde, j: Joueur): void {
  if (!j.four || j.cuisson !== null) return
  const besoin = besoinCouleur(j)
  if (besoin === null) return
  for (const [r, q] of Object.entries(besoin)) {
    const res = r as Ressource
    let deficit = Math.ceil((q ?? 0) - j.stock[res])
    if (deficit <= 0) continue
    deficit -= acheterAuxJoueurs(m, j, res, deficit)
    if (deficit <= 0) continue
    const abordable = Math.floor((j.or - RESERVE_OR) / prixAchat(m, res))
    if (abordable > 0) acheter(m, j, res, Math.min(deficit, abordable))
  }
  lancerCouleur(m, j)
}

/** Les chefs-d'œuvre au-delà de ce qu'il faut jusqu'au rouge sont offerts aux autres, au prix que paierait le comptoir. */
function offrirSurplus(m: Monde, j: Joueur): void {
  for (const e of ELEMENTS) {
    const r = CHEF[e]
    const surplus = Math.floor(j.stock[r] - (j.four ? besoinRestant(j) : 1))
    if (surplus > 0) offrir(m, j, r, surplus, prixVente(m, r))
  }
}

export function visiter(m: Monde, j: Joueur, s: Strategie, etat: EtatBot): void {
  retirerOffres(m, j)
  if (s.agressif) attaquer(m, j)
  if (j.journal.heuresPleines > etat.pleinesVu + 1) essayer(m, j, 'entrepot')
  etat.pleinesVu = j.journal.heuresPleines
  approvisionner(m, j)
  ecouler(m, j, s)
  reserve = RESERVE_OR
  seulementAmeliorer = false
  braisesCheres = prixAchat(m, 'braises') > 2 * RESSOURCES.braises.prix
  for (let n = 0; n < CONSTRUCTIONS_PAR_VISITE; n++) {
    const nom = prochain(j, s)
    seulementAmeliorer = false
    if (nom !== null && essayer(m, j, nom)) continue
    // LE CHANTIER SUIVANT EST HORS DE PRIX (ou il n'y en a plus) : on lui garde la moitié de l'or, et son
    // emplacement dès qu'on approche du compte ; le reste va à la maîtrise qui manque, puis à la croissance.
    reserve = nom === null ? RESERVE_OR : Math.max(RESERVE_OR, j.or / 2)
    if (nom !== null) {
      const c = coutConstruction(j, nom)
      seulementAmeliorer = j.or >= 0.5 * (c.or + prixDuManque(m, j, c.cout))
    }
    if (progresserMaitrise(m, j, s)) continue
    if (!croitre(m, j, s)) break
  }
  reserve = RESERVE_OR
  seulementAmeliorer = false
  couleur(m, j)
  offrirSurplus(m, j)
}
