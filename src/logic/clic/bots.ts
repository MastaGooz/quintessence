/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : le départ (prestige) si ça vaut le coup, quelques
 * dizaines de tapes sur leur meilleure source, les fournées de leurs ateliers,
 * la fusion des triplés de la soute, le branchement de chaque module là où il
 * rapporte le plus, le marché (vendre le surplus de leur sorte, acheter la
 * matière des formes dont leurs creux manquent), puis des achats gloutons :
 * l'option qui rapporte le plus de valeur par or dépensé. Ils ne font rien
 * qu'un vrai joueur ne pourrait faire.
 */
import { ATELIERS, FORMES, PREMIER_ATELIER, PRESTIGE, SOURCES } from './donnees.ts'
import {
  acheter, acheterProducteur, ameliorer, besoins, brancherAuMieux, choisirSorte, coutAchat, coutNiveau, coutProducteur, entree, estAtelier, fabriquer, fondre, force, fusibles, modulesDe,
  multiplicateurPrestige, peutFabriquer, pointsSi, prestiger, prisesLibres, regler, soute, taper, valeurDe, vendre, venteRaisonnable, visibleProducteur,
  type Joueur, type Monde, type Producteur,
} from './moteur.ts'

export interface Strategie {
  nom: string
  /** Le nombre de tapes par visite. */
  tapes: number
  /** Le bot prestige quand son multiplicateur serait multiplié par au moins ceci. */
  seuilPrestige: number
  /** La sorte qu'il choisit ; sinon, selon son rang. */
  sorte?: number
}

interface Option {
  cout: number
  /** Le gain de valeur, en or par seconde. */
  gain: number
  faire: () => boolean
}

/** Au plus tant de fournées lancées à la main par atelier et par visite. */
const FOURNEES_MAX = 12
/** Un bot garde de quoi lancer tant de fournées de sa sorte avant de vendre le surplus. */
const RESERVE_FOURNEES = 3
/** Un bot ne met pas plus que cette part de son or dans la matière d'une visite. */
const PART_MATIERE = 1 / 2
/** Un bot ne vend pas sous cette part du prix plein. */
const PLANCHER = 0.35
/** Sa propre matière abonde quand le stock vaut tant de fournées : les fournées de plus vont à la fusion. */
const ABONDANCE = 10

/**
 * Règle les ateliers sur les formes qui manquent : les formes par besoin
 * décroissant (ce que rapporterait un module de plus de chaque forme), un
 * atelier par forme à tour de rôle, sa sorte quand rien ne manque ; puis
 * achète la matière qui manque pour quelques fournées, dans un budget.
 */
function reglerLesAteliers(m: Monde, j: Joueur): void {
  const b = besoins(j)
  const propre = j.sorte ?? 0
  const formes = Array.from({ length: FORMES }, (_, f) => f)
    .filter((f) => (b[f] ?? 0) > 0)
    .sort((f, g) => (b[g] ?? 0) - (b[f] ?? 0))
  const budget = j.or * PART_MATIERE
  let depense = 0
  let k = 0
  for (const p of j.producteurs) {
    if (!estAtelier(p)) continue
    const forme = formes.length === 0 ? propre : formes[k % formes.length]!
    k++
    if (forme !== p.forme) regler(p, forme)
    if (forme === propre) continue
    const voulu = entree(j, p) * 2 - (j.matiere[forme] ?? 0)
    if (voulu <= 0) continue
    const cout = coutAchat(m, forme, voulu)
    if (depense + cout <= budget) depense += acheter(m, j, forme, voulu)
    else {
      // Pas de quoi en acheter deux : une seule fournée, ou rien.
      const une = entree(j, p) - (j.matiere[forme] ?? 0)
      if (une > 0 && depense + coutAchat(m, forme, une) <= budget) depense += acheter(m, j, forme, une)
    }
  }
}

/** Vend le surplus de sa sorte : ce qui dépasse la réserve de ses ateliers, sans brader (le prix ne descend pas sous `PLANCHER` du prix plein ; le reste attend la visite suivante). */
function vendreLeSurplus(m: Monde, j: Joueur): void {
  if (j.sorte === null) return
  let reserve = 0
  for (const p of j.producteurs) if (estAtelier(p) && p.forme === j.sorte) reserve += entree(j, p) * RESERVE_FOURNEES
  const surplus = Math.min((j.matiere[j.sorte] ?? 0) - reserve, venteRaisonnable(m, j.sorte, PLANCHER))
  if (surplus > 1) vendre(m, j, j.sorte, surplus)
}

/**
 * Les fournées utiles d'un atelier : autant que sa forme a de creux libres que
 * la soute ne remplit pas déjà ; au-delà, les modules s'entasseraient et la
 * matière vaut mieux vendue. Sauf pour sa propre sorte quand elle abonde (le
 * stock vaut `ABONDANCE` fournées) : des modules de plus, c'est de la fusion,
 * donc des raretés — ce qu'un joueur ferait de sa matière.
 */
function fourneesUtiles(j: Joueur, p: Producteur): number {
  const libres = prisesLibres(j).filter((pr) => pr.forme === p.forme).length
  const enAttente = soute(j).filter((mo) => mo.type === p.forme).length
  let utiles = Math.max(0, libres - enAttente)
  if (p.forme === j.sorte && (j.matiere[p.forme] ?? 0) >= ABONDANCE * entree(j, p)) utiles = Math.max(utiles, FOURNEES_MAX)
  return Math.min(FOURNEES_MAX, utiles)
}

function options(j: Joueur): Option[] {
  const liste: Option[] = []
  const prestige = multiplicateurPrestige(j)
  const aAtelier = j.producteurs.some(estAtelier)
  // UN PREMIER ATELIER avant tout : sans lui, pas de modules.
  if (!aAtelier) {
    const t = PREMIER_ATELIER
    if (visibleProducteur(j, t)) liste.push({ cout: coutProducteur(j, t), gain: 1e6, faire: () => acheterProducteur(j, t) !== null })
    return liste
  }
  // UN NIVEAU DE PLUS sur un module emboîté.
  for (const p of j.producteurs) {
    const mods = modulesDe(j, p)
    const avant = valeurDe(j, p, mods)
    for (const mo of mods) {
      const apres = valeurDe(j, p, mods.map((x) => (x === mo ? { ...x, niveau: x.niveau + 1 } : x)))
      liste.push({ cout: coutNiveau(mo), gain: apres - avant, faire: () => ameliorer(j, mo) })
    }
  }
  // UNE SOURCE DE PLUS : avec les modules de la soute qui y trouveraient un creux (les plus forts d'abord).
  const libres = [...soute(j)].sort((a, b) => force(b) - force(a))
  for (let i = 1; i < SOURCES.length; i++) {
    if (!visibleProducteur(j, i)) continue
    const type = SOURCES[i]!
    const neuf: Producteur = { id: -1, type: i, x: 0, y: 0, forme: 0, progres: 0, fournees: 0 }
    const pris = new Set<number>()
    const mods: { type: number; niveau: number; rarete: number; trait: null; emplacement: number }[] = []
    type.creux.forEach((f, e) => {
      if (f === null) return
      const mo = libres.find((x) => x.type === f && !pris.has(x.id))
      if (mo === undefined) return
      pris.add(mo.id)
      mods.push({ type: mo.type, niveau: mo.niveau, rarete: mo.rarete, trait: null, emplacement: e })
    })
    // Même nu, un lot plus gros vaut quelque chose : on le tape.
    const gain = valeurDe(j, neuf, mods) * (mods.length > 0 ? 1 : 0.3)
    liste.push({
      cout: coutProducteur(j, i),
      gain,
      faire: () => {
        const p = acheterProducteur(j, i)
        if (p === null) return false
        for (const mo of soute(j).sort((a, b) => force(b) - force(a))) brancherAuMieux(j, mo)
        return true
      },
    })
  }
  // UN ATELIER DE PLUS, ou un plus gros : ce qu'il sortirait tapé à la main, les modules de la soute branchés dessus.
  for (let k = 0; k < ATELIERS.length; k++) {
    const i = PREMIER_ATELIER + k
    if (!visibleProducteur(j, i)) continue
    const neuf: Producteur = { id: -1, type: i, x: 0, y: 0, forme: j.sorte ?? 0, progres: 0, fournees: 0 }
    const pris = new Set<number>()
    const mods: { type: number; niveau: number; rarete: number; trait: null; emplacement: number }[] = []
    ATELIERS[k]!.creux.forEach((f, e) => {
      if (f === null) return
      const mo = libres.find((x) => x.type === f && !pris.has(x.id))
      if (mo === undefined) return
      pris.add(mo.id)
      mods.push({ type: mo.type, niveau: mo.niveau, rarete: mo.rarete, trait: null, emplacement: e })
    })
    // Les gros ateliers valent par leurs raretés plus que par leur cadence : on compte leur valeur moyenne, et on les préfère au-delà d'un seul.
    const deja = j.producteurs.filter((p) => p.type === i).length
    const gain = (valeurDe(j, neuf, mods) * prestige) / (1 + deja)
    liste.push({
      cout: coutProducteur(j, i),
      gain,
      faire: () => {
        const p = acheterProducteur(j, i)
        if (p === null) return false
        for (const mo of soute(j).sort((a, b) => force(b) - force(a))) brancherAuMieux(j, mo)
        return true
      },
    })
  }
  return liste
}

/** Une visite : ce qu'un joueur ferait en passant. */
export function visiter(m: Monde, j: Joueur, s: Strategie): void {
  if (j.sorte === null) choisirSorte(j, s.sorte ?? j.id % FORMES)
  // LE DÉPART d'abord : on repart de zéro, et les tapes qui suivent relancent la machine.
  const gain = pointsSi(j)
  if (gain >= 1) {
    const apres = 1 + PRESTIGE.parPoint * (j.points + gain)
    if (apres / multiplicateurPrestige(j) >= s.seuilPrestige) {
      prestiger(j)
      choisirSorte(j, s.sorte ?? j.id % FORMES)
    }
  }
  for (let k = 0; k < s.tapes; k++) taper(j)
  // LE MARCHÉ d'abord : le surplus vendu, l'or achète la matière des formes qui manquent.
  vendreLeSurplus(m, j)
  // LES ATELIERS : réglés sur ce qui manque, nourris, lancés à la main.
  reglerLesAteliers(m, j)
  for (const p of j.producteurs) {
    if (!estAtelier(p)) continue
    const utiles = fourneesUtiles(j, p)
    for (let n = 0; n < utiles && peutFabriquer(j, p); n++) fabriquer(m, j, p)
  }
  // LA SOUTE : les triplés fondus, chaque module branché là où il rapporte le plus (les plus forts d'abord).
  for (let n = 0; n < 50; n++) {
    const g = fusibles(j)[0]
    if (g === undefined || fondre(m, j, g.type, g.rarete) === null) break
  }
  for (const mo of soute(j).sort((a, b) => force(b) - force(a))) brancherAuMieux(j, mo)
  // LES ACHATS GLOUTONS : le meilleur gain par or, tant qu'on peut payer.
  for (let n = 0; n < 200; n++) {
    const possibles = options(j).filter((o) => o.gain > 0)
    if (possibles.length === 0) break
    possibles.sort((a, b) => b.gain / b.cout - a.gain / a.cout)
    const meilleure = possibles[0]!
    const payable = possibles.find((o) => o.cout <= j.or + 1e-9)
    if (payable === undefined) break
    // On épargne pour la meilleure option si elle vaut nettement mieux que ce qu'on peut payer, et qu'elle est à portée.
    if (payable !== meilleure && meilleure.gain / meilleure.cout > 1.5 * (payable.gain / payable.cout) && meilleure.cout < 4 * j.or) break
    if (!payable.faire()) break
  }
  // Les achats ont ouvert des creux : on règle et on branche encore.
  reglerLesAteliers(m, j)
  for (const p of j.producteurs) {
    if (!estAtelier(p)) continue
    const utiles = fourneesUtiles(j, p)
    for (let n = 0; n < utiles && peutFabriquer(j, p); n++) fabriquer(m, j, p)
  }
  for (const mo of soute(j).sort((a, b) => force(b) - force(a))) brancherAuMieux(j, mo)
}
