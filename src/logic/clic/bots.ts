/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : prestige si ça vaut le coup, quelques dizaines
 * de tapes, vente de ce qu'ils ont en main, puis achats gloutons — l'option
 * qui rapporte le plus de production par or dépensé, tant qu'il reste de l'or.
 * Ils ne font rien qu'un vrai joueur ne pourrait faire.
 */
import { AUTO_COUT, PRESTIGE, UNITES } from './donnees.ts'
import {
  acheterAmelioration, acheterAuto, acheterUnite, coutAmelioration, coutUnite, debit, multiplicateurPrestige, pointsSi, prestiger,
  taper, vendre, visible, type Joueur, type Monde,
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
  const d = debit(j)
  for (let i = 0; i < UNITES.length; i++) {
    if (!visible(j, i)) continue
    const c = coutUnite(j, i)
    const essai: Joueur = { ...j, unites: [...j.unites], niveaux: [...j.niveaux] }
    essai.unites[i] = (essai.unites[i] ?? 0) + 1
    liste.push({ cout: c, gain: debit(essai) - d, faire: () => acheterUnite(j, i) })
    const ca = coutAmelioration(j, i)
    if (ca !== null) {
      const e2: Joueur = { ...j, unites: [...j.unites], niveaux: [...j.niveaux] }
      e2.niveaux[i] = (e2.niveaux[i] ?? 0) + 1
      liste.push({ cout: ca, gain: debit(e2) - d, faire: () => acheterAmelioration(j, i) })
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
}
