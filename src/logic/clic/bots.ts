/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : prestige si ça vaut le coup, quelques dizaines
 * de tapes, vente de ce qu'ils ont en main, puis achats gloutons — l'option
 * qui rapporte le plus de production par or dépensé, tant qu'il reste de l'or :
 * un module de plus, emboîté sur le creux libre de sa forme le plus près de la
 * base, ou un niveau de plus sur un module relié. Ils ne font rien qu'un vrai
 * joueur ne pourrait faire.
 */
import { AUTO_COUT, PRESTIGE, UNITES } from './donnees.ts'
import {
  acheterModule, acheterAuto, ameliorer, brancher, coutModule, coutNiveau, debit, debitAuNiveau, debitModule, formeDuType,
  multiplicateurPrestige, pointsSi, prestiger, prisesLibres, relies, taper, vendre, visible, type Joueur, type Monde,
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

function options(j: Joueur): Option[] {
  const liste: Option[] = []
  // Un module de plus, sur le creux libre de sa forme le plus près de la base : l'arbre reste ramassé.
  const prises = prisesLibres(j).sort((a, b) => Math.hypot(a.place.x, a.place.y) - Math.hypot(b.place.x, b.place.y))
  for (let i = 0; i < UNITES.length; i++) {
    if (!visible(j, i)) continue
    const forme = formeDuType(i)
    const prise = prises.find((p) => p.forme === forme)
    if (prise === undefined) continue
    liste.push({
      cout: coutModule(j, i),
      gain: debitAuNiveau(j, i, 1),
      faire: () => {
        const mo = acheterModule(j, i)
        return mo !== null && brancher(j, mo, prise.parent, prise.cote)
      },
    })
  }
  // Un niveau de plus sur un module relié.
  const r = relies(j)
  for (const mo of j.modules) {
    if (!r.has(mo.id)) continue
    liste.push({ cout: coutNiveau(mo), gain: debitAuNiveau(j, mo.type, mo.niveau + 1) - debitModule(j, mo), faire: () => ameliorer(j, mo) })
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
