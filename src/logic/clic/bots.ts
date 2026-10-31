/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : départ pour une autre planète si ça vaut le
 * coup, les extracteurs à sec déménagés vers la veine libre la plus riche,
 * quelques dizaines de tapes sur leur meilleur producteur, le minerai brûlé,
 * une prospection quand il n'y a plus de place ou que leurs veines les
 * brident, puis des achats gloutons — l'option qui rapporte le plus de
 * production RÉELLE (bornée par les veines) par énergie dépensée, tant qu'il
 * en reste : un module de plus sur le creux où il rapporte le plus, un niveau
 * de plus sur un module emboîté, ou un extracteur de plus sur la meilleure
 * veine libre, où migrent les modules de leur producteur le plus bridé. Ils ne
 * font rien qu'un vrai joueur ne pourrait faire.
 */
import { ACHAT, AUTO_COUT, MODULES, PRESTIGE, PRODUCTEURS } from './donnees.ts'
import {
  acheterAuto, acheterModule, acheterProducteur, ameliorer, bilan, bilanProducteur, brancher, bruler, coutModule, coutNiveau, coutProducteur, coutProspection, debit,
  deplacerLesExtracteursASec, deplacerLesExtracteursBrides, extracteursASec, frontiere, limiteParLaVeine, migrables, migrer, modulesDe, multiplicateurPrestige, peutProduire,
  placeLibre, placesLibres, plafond, pointsSi, prestiger, prisesLibres, prisesPour, producteurDe, prospecter, taper, visibleModule, visibleProducteur,
  type Joueur, type Monde, type Prise, type Producteur,
} from './moteur.ts'
import { graineDe, rngDe } from '../rng.ts'

export interface Strategie {
  nom: string
  /** Le nombre de tapes par visite. */
  tapes: number
  /** Le bot prestige quand son multiplicateur serait multiplié par au moins ceci. */
  seuilPrestige: number
}

interface Option {
  cout: number
  /** Le gain de production réelle, en minerai par seconde. */
  gain: number
  faire: () => boolean
}

/** Au plus tant de prospections par visite. */
const PROSPECTIONS_MAX = 6
/** Un bot ne met pas plus que cette part de son énergie dans une seule prospection. */
const PART_PROSPECTION = 1 / 3

function lot(p: Producteur): number {
  return PRODUCTEURS[p.type]?.lot ?? 0
}

/** Ce qu'un producteur donnerait avec ces modules, borné par sa veine. */
function reel(j: Joueur, p: Producteur, mods: readonly { type: number; niveau: number }[]): number {
  if (!peutProduire(j, p)) return 0
  return Math.min(bilan(lot(p), mods, multiplicateurPrestige(j)).debit, plafond(j, p))
}

/** Le producteur dont les modules sont le plus gâchés par sa veine (ou, à défaut, le plus productif) : celui dont on déménagerait les modules. */
function plusBride(j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -Infinity
  for (const p of j.producteurs) {
    const b = bilanProducteur(j, p).debit
    const v = p.type === 0 ? b * 1e-6 : b - Math.min(b, plafond(j, p)) + b * 1e-6
    if (v > max) {
      max = v
      meilleur = p
    }
  }
  return meilleur
}

function options(j: Joueur): Option[] {
  const liste: Option[] = []
  const prestige = multiplicateurPrestige(j)
  // UN MODULE DE PLUS, sur le creux libre de sa forme où il rapporte le plus (en production réelle).
  const prises = prisesLibres(j)
  for (let k = 0; k < MODULES.length; k++) {
    if (!visibleModule(j, k)) continue
    let meilleure: { prise: Prise; gain: number } | null = null
    for (const prise of prises) {
      if (prise.forme !== k) continue
      const p = producteurDe(j, prise.parent)
      if (p === undefined || !peutProduire(j, p)) continue
      const mods = modulesDe(j, p)
      const gain = reel(j, p, [...mods, { type: k, niveau: 1 }]) - reel(j, p, mods)
      if (meilleure === null || gain > meilleure.gain) meilleure = { prise, gain }
    }
    if (meilleure === null) continue
    const prise = meilleure.prise
    liste.push({
      cout: coutModule(j, k),
      gain: meilleure.gain,
      faire: () => {
        const mo = acheterModule(j, k)
        return mo !== null && brancher(j, mo, prise.parent, prise.emplacement)
      },
    })
  }
  // UN NIVEAU DE PLUS sur un module emboîté.
  for (const p of j.producteurs) {
    if (!peutProduire(j, p)) continue
    const mods = modulesDe(j, p)
    const avant = reel(j, p, mods)
    for (const mo of mods) {
      const apres = reel(j, p, mods.map((m) => (m === mo ? { type: m.type, niveau: m.niveau + 1 } : m)))
      liste.push({ cout: coutNiveau(mo), gain: apres - avant, faire: () => ameliorer(j, mo) })
    }
  }
  // UN EXTRACTEUR DE PLUS, sur la meilleure veine libre, en trois paquets : avec les modules du plus bridé qui y trouvent un creux et des modules neufs dans les creux restants ; avec des modules neufs partout ; avec une seule horloge neuve.
  const place = placeLibre(j)
  if (place === null) return liste
  const veine = place.gisement.debit / 3600
  const de = plusBride(j)
  const modsDe = modulesDe(j, de)
  const avant = reel(j, de, modsDe)
  for (let i = 1; i < PRODUCTEURS.length; i++) {
    if (!visibleProducteur(j, i)) continue
    const type = PRODUCTEURS[i]!
    for (const paquet of ['migration', 'neufs', 'horloge'] as const) {
      const partants = paquet === 'migration' ? migrables(j, de, i) : []
      if (paquet === 'migration' && partants.length === 0) continue
      // Les creux que rien ne vient remplir reçoivent des modules neufs, au prix qu'ils coûteront l'un après l'autre.
      const neufs: { type: number; niveau: number }[] = []
      let coutNeufs = 0
      const achetes = [...j.achetesModules]
      for (let f = 0; f < MODULES.length; f++) {
        if (!visibleModule(j, f) || (paquet === 'horloge' && f !== 0)) continue
        const libres = type.creux.filter((c) => c === f).length - partants.filter((mo) => mo.type === f).length
        for (let n = 0; n < (paquet === 'horloge' ? Math.min(1, libres) : libres); n++) {
          coutNeufs += Math.ceil((MODULES[f]?.cout ?? Infinity) * Math.pow(ACHAT.croissance, achetes[f] ?? 0))
          achetes[f] = (achetes[f] ?? 0) + 1
          neufs.push({ type: f, niveau: 1 })
        }
      }
      if (partants.length + neufs.length === 0) continue
      const restants = modsDe.filter((mo) => !partants.includes(mo))
      const apres = Math.min(bilan(type.lot, [...partants, ...neufs], prestige).debit, veine) + reel(j, de, restants)
      liste.push({
        cout: coutProducteur(j, i) + coutNeufs,
        gain: apres - avant,
        faire: () => {
          const p = acheterProducteur(j, i)
          if (p === null) return false
          if (paquet === 'migration') migrer(j, de, p)
          for (const n of neufs) {
            const mo = acheterModule(j, n.type)
            const prise = mo === null ? undefined : prisesPour(j, mo).find((x) => x.parent === p.id)
            if (mo === null || prise === undefined || !brancher(j, mo, prise.parent, prise.emplacement)) return false
          }
          return true
        },
      })
    }
  }
  return liste
}

/**
 * LA PROSPECTION d'un bot : quand un extracteur à sec ne trouve pas de place,
 * quand un extracteur de plus n'en trouverait pas alors qu'il pourrait le
 * payer, ou quand une veine bride un extracteur sans qu'une veine libre plus
 * riche existe, il révèle une zone de la frontière : la plus lointaine qu'il
 * peut payer sans y mettre plus d'un tiers de son énergie (loin, c'est riche),
 * sinon la moins chère ; à prix égal, au hasard, tiré de l'heure.
 */
function prospecterSiBesoin(j: Joueur, rng: () => number): void {
  for (let n = 0; n < PROSPECTIONS_MAX; n++) {
    const coutExtracteur = Math.min(...PRODUCTEURS.map((_, i) => (i > 0 && visibleProducteur(j, i) ? coutProducteur(j, i) : Infinity)))
    const sec = extracteursASec(j)[0]
    const sansPlaceSec = sec !== undefined && placeLibre(j, sec.id) === null
    const sansPlace = placeLibre(j) === null && j.or + 1e-9 >= coutExtracteur
    const brides = j.producteurs.filter((p) => limiteParLaVeine(j, p))
    const meilleureLibre = Math.max(0, ...placesLibres(j).map((pl) => pl.gisement.debit / 3600))
    const bride = brides.some((p) => meilleureLibre <= plafond(j, p))
    if (!sansPlaceSec && !sansPlace && !bride) return
    const candidates = frontiere(j)
    if (candidates.length === 0) return
    const payables = candidates.filter((z) => coutProspection(z) <= j.or * PART_PROSPECTION)
    const vivier = payables.length > 0 ? payables : candidates
    const prix = payables.length > 0 ? Math.max(...vivier.map(coutProspection)) : Math.min(...vivier.map(coutProspection))
    const choix = vivier.filter((z) => coutProspection(z) === prix)
    const zone = choix[Math.floor(rng() * choix.length)]!
    if (prospecter(j, zone) === null) return
    deplacerLesExtracteursASec(j)
    deplacerLesExtracteursBrides(j)
  }
}

/** Une visite : ce qu'un joueur ferait en passant. */
export function visiter(m: Monde, j: Joueur, s: Strategie): void {
  const rng = rngDe(graineDe(j.id + 1, Math.round(m.t * 4) + 1))
  // LE DÉPART d'abord : on repart de zéro, et les tapes qui suivent relancent la machine.
  const gain = pointsSi(j)
  if (gain >= 1) {
    const apres = 1 + PRESTIGE.parPoint * (j.points + gain)
    if (apres / multiplicateurPrestige(j) >= s.seuilPrestige) prestiger(j)
  }
  deplacerLesExtracteursASec(j)
  deplacerLesExtracteursBrides(j)
  for (let k = 0; k < s.tapes; k++) taper(j)
  if (!j.auto) bruler(j, j.r)
  // LA RAFFINERIE AUTOMATIQUE dès qu'on produit assez pour qu'elle compte : un minerai par seconde.
  if (!j.auto && debit(j) >= 1 && j.or >= AUTO_COUT * 1.5) acheterAuto(j)
  prospecterSiBesoin(j, rng)
  // LES ACHATS GLOUTONS : le meilleur gain par énergie, tant qu'on peut payer.
  for (let n = 0; n < 400; n++) {
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
  // Les achats ont pu brider un extracteur ou prendre la dernière place : on prospecte encore, et on range.
  prospecterSiBesoin(j, rng)
  deplacerLesExtracteursASec(j)
  deplacerLesExtracteursBrides(j)
}
