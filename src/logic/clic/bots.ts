/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : prestige si ça vaut le coup, quelques dizaines
 * de tapes sur leur meilleur producteur, vente de ce qu'ils ont en main, puis
 * achats gloutons — l'option qui rapporte le plus de production par or
 * dépensé, tant qu'il reste de l'or : un module de plus sur le creux où il
 * rapporte le plus, un niveau de plus sur un module emboîté, ou un producteur
 * de plus où migrent les modules de leur producteur le plus productif. Ils ne
 * font rien qu'un vrai joueur ne pourrait faire.
 */
import { ACHAT, AUTO_COUT, MODULES, PRESTIGE, PRODUCTEURS } from './donnees.ts'
import {
  acheterAuto, acheterModule, acheterProducteur, ameliorer, bilan, bilanProducteur, brancher, coutModule, coutNiveau, coutProducteur, debit, migrables, migrer,
  modulesDe, multiplicateurPrestige, pointsSi, prestiger, prisesLibres, prisesPour, producteurDe, taper, vendre, visibleModule, visibleProducteur,
  type Joueur, type Monde, type Prise, type Producteur,
} from './moteur.ts'

export interface Strategie {
  nom: string
  /** Le nombre de tapes par visite. */
  tapes: number
  /** Le bot prestige quand son multiplicateur serait multiplié par au moins ceci. */
  seuilPrestige: number
}

interface Option {
  cout: number
  /** Le gain de production, en R par seconde. */
  gain: number
  faire: () => boolean
}

function lot(p: Producteur): number {
  return PRODUCTEURS[p.type]?.lot ?? 0
}

/** Le producteur qui produit le plus par seconde : celui dont on déménagerait les modules. */
function plusProductif(j: Joueur): Producteur {
  let meilleur = j.producteurs[0]!
  let max = -1
  for (const p of j.producteurs) {
    const d = bilanProducteur(j, p).debit
    if (d > max) {
      max = d
      meilleur = p
    }
  }
  return meilleur
}

function options(j: Joueur): Option[] {
  const liste: Option[] = []
  const prestige = multiplicateurPrestige(j)
  // UN MODULE DE PLUS, sur le creux libre de sa forme où il rapporte le plus.
  const prises = prisesLibres(j)
  for (let k = 0; k < MODULES.length; k++) {
    if (!visibleModule(j, k)) continue
    let meilleure: { prise: Prise; gain: number } | null = null
    for (const prise of prises) {
      if (prise.forme !== k) continue
      const p = producteurDe(j, prise.parent)
      if (p === undefined) continue
      const mods = modulesDe(j, p)
      const gain = bilan(lot(p), [...mods, { type: k, niveau: 1 }], prestige).debit - bilan(lot(p), mods, prestige).debit
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
    const mods = modulesDe(j, p)
    const avant = bilan(lot(p), mods, prestige).debit
    for (const mo of mods) {
      const apres = bilan(lot(p), mods.map((m) => (m === mo ? { type: m.type, niveau: m.niveau + 1 } : m)), prestige).debit
      liste.push({ cout: coutNiveau(mo), gain: apres - avant, faire: () => ameliorer(j, mo) })
    }
  }
  // UN PRODUCTEUR DE PLUS, en trois paquets : avec les modules du plus productif qui y trouvent un creux et des modules neufs dans les creux restants ; avec des modules neufs partout ; avec une seule horloge neuve.
  const de = plusProductif(j)
  const modsDe = modulesDe(j, de)
  const avant = bilan(lot(de), modsDe, prestige).debit
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
      const apres = bilan(type.lot, [...partants, ...neufs], prestige).debit + bilan(lot(de), restants, prestige).debit
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

/** Une visite : ce qu'un joueur ferait en passant. */
export function visiter(m: Monde, j: Joueur, s: Strategie): void {
  // LE PRESTIGE d'abord : on repart de zéro, et les tapes qui suivent relancent la machine.
  const gain = pointsSi(j)
  if (gain >= 1) {
    const apres = 1 + PRESTIGE.parPoint * (j.points + gain)
    if (apres / multiplicateurPrestige(j) >= s.seuilPrestige) prestiger(j)
  }
  for (let k = 0; k < s.tapes; k++) taper(j)
  if (!j.auto) vendre(m, j, j.r)
  // LE COMPTOIR AUTOMATIQUE dès qu'on produit assez pour qu'il compte : un R par seconde.
  if (!j.auto && debit(j) >= 1 && j.or >= AUTO_COUT * 1.5) acheterAuto(j)
  // LES ACHATS GLOUTONS : le meilleur gain par or, tant qu'on peut payer.
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
}
