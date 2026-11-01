/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : le départ (prestige) si ça vaut le coup, quelques
 * dizaines de tapes sur la source de leur couleur, le réglage de leurs
 * raffineries, mélangeurs et ateliers sur les sortes de modules qui leur
 * manquent, des conversions à la main pour nourrir les ateliers, les fournées,
 * la fusion des triplés, le branchement de chaque module là où il rapporte le
 * plus, le marché (vendre le surplus sans brader, acheter ce que leurs
 * raffineries ne font pas), puis des achats gloutons : l'option qui rapporte
 * le plus de valeur par or de matière dépensée, la matière manquante achetée
 * au marché si l'or le permet. Ils ne font rien qu'un vrai joueur ne pourrait
 * faire.
 */
import { PRIMAIRES, PRODUCTEURS, PRESTIGE, SORTES, couleurDe, formeDe, sorteDe, type Cout } from './donnees.ts'
import {
  acheter, acheterProducteur, ameliorer, ameliorerSource, besoins, brancherAuMieux, completerAuMarche, coutAchat, coutNiveau, coutNiveauSource, coutProducteur, declencher, disponible, entree, entrees, estAtelier,
  estSource, fabriquer, fondre, force, fusibles, genreDe, manquePour, meilleureSource, modulesDe, multiplicateurPrestige, peutFabriquer, peutPayer, pointsSi, prestiger, prisesLibres, production, regler,
  sortePourPayer, sortie, sortesFormees, soute, typeDe, valeurCout, valeurDe, vendre, venteRaisonnable, visibleProducteur,
  type Joueur, type Monde, type Producteur,
} from './moteur.ts'

export interface Strategie {
  nom: string
  /** Le nombre de tapes par visite. */
  tapes: number
  /** Le bot prestige quand son multiplicateur serait multiplié par au moins ceci. */
  seuilPrestige: number
  /** La couleur de base où il investit (il tape sa source, préfère ses sources) ; sinon, la plus rentable. */
  couleur?: number
}

interface Option {
  /** Ce que coûte l'option, en or au prix courant de la matière qu'elle demande. */
  cout: number
  /** Le gain de valeur, en or par seconde. */
  gain: number
  /** Peut-on payer, avec son stock ou en achetant le manque au marché ? */
  payable: boolean
  /** Sinon, est-elle à portée : la matière qui manque, le bot la produit en moins d'un jour ? Sinon, inutile d'épargner pour elle. */
  portee: boolean
  faire: () => boolean
}

/** Au plus tant de fournées lancées à la main par atelier et par visite. */
const FOURNEES_MAX = 12
/** Au plus tant de conversions à la main par transformateur et par visite. */
const CONVERSIONS_MAX = 60
/** Un bot garde de quoi lancer tant de fournées de ce que ses ateliers consomment. */
const RESERVE_FOURNEES = 2
/** Un bot ne met pas plus que cette part de son or dans la matière d'une visite. */
const PART_MATIERE = 1 / 2
/** Un bot ne vend pas sous cette part du prix plein. */
const PLANCHER = 0.35
/** Un bot garde tant d'heures de sa production de chaque ronde avant d'en vendre : c'est avec elle qu'il construit. */
const GARDE_H = 6
/** Sa propre couleur pèse tant de plus dans ses achats. */
const PREFERENCE = 1.5

/** Ce qu'un bot veut avoir en stock d'une sorte : deux fournées de chaque atelier qui la consomme ; pour une ronde mélangée, ce que ses raffineries réglées dessus doivent faire. */
function besoinStock(j: Joueur, sorte: number): number {
  let q = 0
  for (const p of j.producteurs) {
    if (estAtelier(p) && sortie(p) === sorte) q += entree(j, p) * RESERVE_FOURNEES
    else if (genreDe(p) === 'raffinerie' && entrees(p).includes(sorte) && couleurDe(sorte) >= PRIMAIRES) q += besoinStock(j, sortie(p))
  }
  return q
}

/** Les sortes de modules qui manquent, par gain décroissant ; sans mélangeur, les couleurs mélangées n'y sont pas. */
function sortesVoulues(m: Monde, j: Joueur): number[] {
  const b = besoins(m, j)
  const aMelangeur = j.producteurs.some((p) => genreDe(p) === 'melangeur')
  return sortesFormees()
    .filter((s) => (b[s] ?? 0) > 0 && (aMelangeur || couleurDe(s) < PRIMAIRES))
    .sort((s, t) => (b[t] ?? 0) - (b[s] ?? 0))
}

/** La couleur de base dont le bot a le plus de rondes. */
function couleurAbondante(j: Joueur, preferee?: number): number {
  if (preferee !== undefined) return preferee
  let c = 0
  for (let k = 1; k < PRIMAIRES; k++) if ((j.matiere[sorteDe(k, 0)] ?? 0) > (j.matiere[sorteDe(c, 0)] ?? 0)) c = k
  return c
}

/**
 * Règle les transformateurs sur ce qui manque : les sortes voulues à tour de
 * rôle sur les raffineries et les ateliers (sa couleur en carrés quand rien ne
 * manque), les couleurs mélangées voulues sur les mélangeurs.
 */
function reglerLesTransformateurs(m: Monde, j: Joueur, s: Strategie): void {
  const voulues = sortesVoulues(m, j)
  const defaut = sorteDe(couleurAbondante(j, s.couleur), 1)
  // Les ateliers prennent les sortes voulues à tour de rôle ; chaque raffinerie nourrit un atelier (la k-ième le k-ième), les raffineries de trop font les sortes voulues suivantes.
  const ateliers = j.producteurs.filter(estAtelier)
  ateliers.forEach((p, k) => {
    const sorte = voulues.length === 0 ? defaut : voulues[k % voulues.length]!
    if (sortie(p) !== sorte) regler(p, couleurDe(sorte), formeDe(sorte))
  })
  let k = 0
  for (const p of j.producteurs) {
    if (genreDe(p) !== 'raffinerie') continue
    const atelier = ateliers[k]
    const sorte = atelier !== undefined ? sortie(atelier) : voulues.length === 0 ? defaut : voulues[k % voulues.length]!
    k++
    if (sortie(p) !== sorte) regler(p, couleurDe(sorte), formeDe(sorte))
  }
  const melanges = Array.from(new Set(j.producteurs.filter((p) => genreDe(p) === 'raffinerie').map((p) => p.couleur).filter((c) => c >= PRIMAIRES)))
  let n = 0
  for (const p of j.producteurs) {
    if (genreDe(p) !== 'melangeur') continue
    const c = melanges.length === 0 ? PRIMAIRES : melanges[n % melanges.length]!
    n++
    if (p.couleur !== c) regler(p, c, 0)
  }
}

/** Convertit à la main, mélangeurs d'abord, jusqu'à ce que la sortie couvre le besoin ou que l'entrée manque. */
function convertirLeNecessaire(m: Monde, j: Joueur): void {
  const ordre = [...j.producteurs].sort((a, b) => (genreDe(a) === 'melangeur' ? 0 : 1) - (genreDe(b) === 'melangeur' ? 0 : 1))
  for (const p of ordre) {
    const g = genreDe(p)
    if (g !== 'raffinerie' && g !== 'melangeur') continue
    const sorte = sortie(p)
    for (let n = 0; n < CONVERSIONS_MAX; n++) {
      if ((j.matiere[sorte] ?? 0) >= besoinStock(j, sorte) || disponible(j, p) <= 0) break
      if (declencher(m, j, p).gain <= 0) break
    }
  }
}

/** Achète au marché la matière que ses ateliers n'ont pas, pour une ou deux fournées, dans un budget. */
function acheterPourLesAteliers(m: Monde, j: Joueur): void {
  const budget = j.or * PART_MATIERE
  let depense = 0
  for (const p of j.producteurs) {
    if (!estAtelier(p)) continue
    const sorte = sortie(p)
    const voulu = entree(j, p) * RESERVE_FOURNEES - (j.matiere[sorte] ?? 0)
    if (voulu <= 0) continue
    const cout = coutAchat(m, sorte, voulu)
    if (depense + cout <= budget) depense += acheter(m, j, sorte, voulu)
    else {
      const une = entree(j, p) - (j.matiere[sorte] ?? 0)
      if (une > 0 && depense + coutAchat(m, sorte, une) <= budget) depense += acheter(m, j, sorte, une)
    }
  }
}

/** Vend le surplus de chaque sorte : au-delà de ce qu'on garde (le besoin des ateliers, des heures de production pour construire), sans brader. */
function vendreLeSurplus(m: Monde, j: Joueur): void {
  for (let s = 0; s < SORTES; s++) {
    const stock = j.matiere[s] ?? 0
    if (stock < 1) continue
    const garde = Math.max(besoinStock(j, s) * 2, production(j, s) * 3600 * GARDE_H)
    const surplus = Math.min(stock - garde, venteRaisonnable(m, s, PLANCHER))
    if (surplus > 1) vendre(m, j, s, surplus)
  }
}

/**
 * Les fournées utiles d'un atelier : autant que sa forme a de creux libres que
 * la soute ne remplit pas déjà, au moins une par visite si la matière abonde ;
 * au-delà, les modules s'entasseraient et la matière vaut mieux ailleurs.
 */
function fourneesUtiles(j: Joueur, p: Producteur): number {
  const libres = prisesLibres(j).filter((pr) => pr.forme === p.forme).length
  const enAttente = soute(j).filter((mo) => mo.forme === p.forme).length
  let utiles = Math.max(0, libres - enAttente)
  if ((j.matiere[sortie(p)] ?? 0) >= entree(j, p) * 10) utiles = Math.max(utiles, 3)
  return Math.min(FOURNEES_MAX, utiles)
}

function lancerLesFournees(m: Monde, j: Joueur): void {
  for (const p of j.producteurs) {
    if (!estAtelier(p)) continue
    const utiles = fourneesUtiles(j, p)
    for (let n = 0; n < utiles && peutFabriquer(j, p); n++) fabriquer(m, j, p, true)
  }
}

/** Fond les triplés, puis branche chaque module de la soute là où il rapporte le plus, les plus forts d'abord. */
function rangerLaSoute(m: Monde, j: Joueur): void {
  for (let n = 0; n < 50; n++) {
    const g = fusibles(j)[0]
    if (g === undefined || fondre(m, j, g.couleur, g.forme, g.rarete) === null) break
  }
  for (const mo of soute(j).sort((a, b) => force(b) - force(a))) brancherAuMieux(m, j, mo)
}

/** Peut-on payer ce coût, en complétant au marché si l'or le permet ? */
function payable(m: Monde, j: Joueur, c: Cout): boolean {
  return peutPayer(j, c) || j.or + 1e-9 >= coutAchat(m, sortePourPayer(j, c), manquePour(j, c))
}

/** Ce coût est-il à portée : ce qui manque, le bot le produit en moins d'un jour ? */
function aPortee(j: Joueur, c: Cout): boolean {
  return manquePour(j, c) <= production(j, sortePourPayer(j, c)) * 3600 * 24
}

/** Les modules de la soute qui iraient sur un générateur neuf de ce type, les plus forts d'abord. */
function modulesPourNeuf(j: Joueur, i: number): { couleur: number; forme: number; niveau: number; rarete: number; trait: null; emplacement: number }[] {
  const libres = [...soute(j)].sort((a, b) => force(b) - force(a))
  const pris = new Set<number>()
  const mods: { couleur: number; forme: number; niveau: number; rarete: number; trait: null; emplacement: number }[] = []
  PRODUCTEURS[i]!.creux.forEach((f, e) => {
    if (f === null) return
    const mo = libres.find((x) => x.forme === f && !pris.has(x.id))
    if (mo === undefined) return
    pris.add(mo.id)
    mods.push({ couleur: mo.couleur, forme: mo.forme, niveau: mo.niveau, rarete: mo.rarete, trait: null, emplacement: e })
  })
  return mods
}

function options(m: Monde, j: Joueur, s: Strategie): Option[] {
  const liste: Option[] = []
  const prestige = multiplicateurPrestige(j)
  const aRaffinerie = j.producteurs.some((p) => genreDe(p) === 'raffinerie')
  const ateliers = j.producteurs.filter(estAtelier)
  const aMelangeur = j.producteurs.some((p) => genreDe(p) === 'melangeur')
  const voulue = sortesVoulues(m, j)[0] ?? sorteDe(couleurAbondante(j, s.couleur), 1)
  const achat = (i: number, couleur: number, gain: number, apres?: () => void): Option => {
    const c = coutProducteur(j, i, couleur)
    return {
      cout: valeurCout(m, j, c),
      gain,
      payable: payable(m, j, c),
      portee: aPortee(j, c),
      faire: () => {
        if (!completerAuMarche(m, j, c)) return false
        const p = acheterProducteur(j, i, couleur)
        if (p === null) return false
        apres?.()
        rangerLaSoute(m, j)
        return true
      },
    }
  }
  const neufDe = (i: number, couleur: number, forme: number): Producteur => ({ id: -1, type: i, x: 0, y: 0, couleur, forme, niveau: 1, progres: 0, fournees: 0 })
  // UNE PREMIÈRE RAFFINERIE, puis UN PREMIER ATELIER avant tout : sans eux, pas de modules.
  if (!aRaffinerie) {
    const i = PRODUCTEURS.findIndex((t) => t.genre === 'raffinerie')
    if (visibleProducteur(j, i)) liste.push(achat(i, 0, 1e6))
    return liste
  }
  if (ateliers.length === 0) {
    const i = PRODUCTEURS.findIndex((t) => t.genre === 'atelier')
    if (visibleProducteur(j, i)) liste.push(achat(i, 0, 1e6))
    return liste
  }
  // UN NIVEAU DE PLUS sur un module emboîté.
  for (const p of j.producteurs) {
    const mods = modulesDe(j, p)
    const avant = valeurDe(m, j, p, mods)
    for (const mo of mods) {
      const apres = valeurDe(m, j, p, mods.map((x) => (x === mo ? { ...x, niveau: x.niveau + 1 } : x)))
      const c = coutNiveau(mo)
      liste.push({ cout: valeurCout(m, j, c), gain: apres - avant, payable: payable(m, j, c), portee: aPortee(j, c), faire: () => completerAuMarche(m, j, c) && ameliorer(j, mo) })
    }
    // UN NIVEAU DE PLUS sur une source : son lot grandit.
    if (estSource(p)) {
      const apres = valeurDe(m, j, { ...p, niveau: p.niveau + 1 }, mods)
      const c = coutNiveauSource(p)
      const pref = p.couleur === s.couleur ? PREFERENCE : 1
      liste.push({ cout: valeurCout(m, j, c), gain: (apres - avant) * pref, payable: payable(m, j, c), portee: aPortee(j, c), faire: () => completerAuMarche(m, j, c) && ameliorerSource(j, p) })
    }
  }
  PRODUCTEURS.forEach((t, i) => {
    if (i === 0 || !visibleProducteur(j, i)) return
    const mods = modulesPourNeuf(j, i)
    const deja = j.producteurs.filter((p) => p.type === i).length
    switch (t.genre) {
      case 'source':
        // UNE SOURCE DE PLUS, dans chaque couleur : avec les modules de la soute qui y trouveraient un creux. Même nue, un lot plus gros vaut quelque chose : on la tape.
        for (let c = 0; c < PRIMAIRES; c++) {
          const gain = valeurDe(m, j, neufDe(i, c, 0), mods) * (mods.length > 0 ? 1 : 0.3) * (c === s.couleur ? PREFERENCE : 1)
          liste.push(achat(i, c, gain))
        }
        break
      case 'raffinerie':
        liste.push(achat(i, 0, valeurDe(m, j, neufDe(i, couleurDe(voulue), formeDe(voulue)), mods) / (1 + deja)))
        break
      case 'melangeur':
        // Le premier mélangeur ouvre les modules à deux effets : on le prend dès qu'on a deux ateliers ; les suivants valent ce qu'ils convertissent.
        liste.push(achat(i, 0, !aMelangeur && ateliers.length >= 2 ? 1e5 : valeurDe(m, j, neufDe(i, PRIMAIRES, 0), mods) / (1 + deja)))
        break
      default:
        // Les gros ateliers valent par leurs raretés plus que par leur cadence : on compte leur valeur moyenne, et on les préfère au-delà d'un seul.
        liste.push(achat(i, 0, (valeurDe(m, j, neufDe(i, couleurDe(voulue), formeDe(voulue)), mods) * prestige) / (1 + deja)))
    }
  })
  return liste
}

/** Les achats gloutons : le meilleur gain par or, tant qu'on peut payer ; on épargne pour une option nettement meilleure à portée. */
function acheterAuMieux(m: Monde, j: Joueur, s: Strategie): void {
  for (let n = 0; n < 200; n++) {
    const possibles = options(m, j, s).filter((o) => o.gain > 0 && o.cout > 0)
    if (possibles.length === 0) break
    possibles.sort((a, b) => b.gain / b.cout - a.gain / a.cout)
    const meilleure = possibles[0]!
    const payable = possibles.find((o) => o.payable)
    if (payable === undefined) break
    // On épargne pour la meilleure option si elle vaut nettement mieux que ce qu'on peut payer, et qu'elle est à portée.
    if (payable !== meilleure && meilleure.portee && meilleure.gain / meilleure.cout > 1.5 * (payable.gain / payable.cout)) break
    if (!payable.faire()) break
  }
}

/** La source que ce bot tape : celle de sa couleur qui rapporte le plus, ou la meilleure au marché. */
function sourceATaper(m: Monde, j: Joueur, s: Strategie): Producteur {
  if (s.couleur === undefined) return meilleureSource(m, j)
  let meilleure: Producteur | null = null
  let max = -1
  for (const p of j.producteurs) {
    if (!estSource(p) || p.couleur !== s.couleur) continue
    const v = typeDe(p).lot * p.niveau
    if (v > max) {
      max = v
      meilleure = p
    }
  }
  return meilleure ?? meilleureSource(m, j)
}

/** Une visite : ce qu'un joueur ferait en passant. */
export function visiter(m: Monde, j: Joueur, s: Strategie): void {
  // LE DÉPART d'abord : on repart de zéro, et les tapes qui suivent relancent la machine.
  const gain = pointsSi(j)
  if (gain >= 1) {
    const apres = 1 + PRESTIGE.parPoint * (j.points + gain)
    if (apres / multiplicateurPrestige(j) >= s.seuilPrestige) prestiger(j)
  }
  const source = sourceATaper(m, j, s)
  for (let k = 0; k < s.tapes; k++) declencher(m, j, source)
  // LES TRANSFORMATEURS : réglés sur ce qui manque, puis la matière convertie à la main pour nourrir les ateliers.
  reglerLesTransformateurs(m, j, s)
  convertirLeNecessaire(m, j)
  // LE MARCHÉ : le surplus vendu, l'or achète ce que les raffineries ne font pas.
  vendreLeSurplus(m, j)
  acheterPourLesAteliers(m, j)
  lancerLesFournees(m, j)
  rangerLaSoute(m, j)
  // LES ACHATS GLOUTONS, puis les creux neufs se règlent et se remplissent.
  acheterAuMieux(m, j, s)
  reglerLesTransformateurs(m, j, s)
  convertirLeNecessaire(m, j)
  lancerLesFournees(m, j)
  rangerLaSoute(m, j)
}
