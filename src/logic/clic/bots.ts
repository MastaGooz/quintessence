/**
 * LES BOTS du système abstrait : des joueurs simulés qui passent quelques fois
 * par jour. À chaque visite : prestige si ça vaut le coup, quelques dizaines
 * de tapes, vente de ce qu'ils ont en main, puis achats gloutons — l'option
 * qui rapporte le plus de production par or dépensé, tant qu'il reste de l'or.
 * Un module acheté est branché sur la première prise libre ; base pleine, le
 * bot achète l'anneau suivant ou jette son module le plus faible pour faire
 * la place. Ils ne font rien qu'un vrai joueur ne pourrait faire.
 */
import { AUTO_COUT, PRESTIGE, UNITES } from './donnees.ts'
import {
  acheterAmelioration, acheterAnneau, acheterAuto, acheterModule, brancher, coutAmelioration, coutAnneau, coutUnite, debit, debitModule,
  jeter, multiplicateurPrestige, pointsSi, prestiger, prisesLibres, taper, vendre, visible, type Joueur, type Module, type Monde,
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

/** Achète un module et le branche sur la première prise libre. */
function acheterEtBrancher(j: Joueur, i: number): boolean {
  const prise = prisesLibres(j)[0]
  if (prise === undefined) return false
  const mo = acheterModule(j, i)
  return mo !== null && brancher(j, mo, prise)
}

function copie(j: Joueur): Joueur {
  return { ...j, unites: [...j.unites], niveaux: [...j.niveaux] }
}

function options(j: Joueur): Option[] {
  const liste: Option[] = []
  const d = debit(j)
  const libres = prisesLibres(j).length
  const anneau = coutAnneau(j)
  // Le module branché le plus faible : celui qu'on jetterait pour faire de la place.
  let faible: Module | undefined
  for (const mo of j.modules) if (mo.prise !== null && (faible === undefined || debitModule(j, mo.type) < debitModule(j, faible.type))) faible = mo
  for (let i = 0; i < UNITES.length; i++) {
    if (!visible(j, i)) continue
    const c = coutUnite(j, i)
    const essai = copie(j)
    essai.unites[i] = (essai.unites[i] ?? 0) + 1
    const gain = debit(essai) - d
    if (libres > 0) liste.push({ cout: c, gain, faire: () => acheterEtBrancher(j, i) })
    else {
      if (anneau !== null) liste.push({ cout: c + anneau, gain, faire: () => acheterAnneau(j) && acheterEtBrancher(j, i) })
      if (faible !== undefined && faible.type !== i) {
        const e2 = copie(j)
        e2.unites[i] = (e2.unites[i] ?? 0) + 1
        e2.unites[faible.type] = (e2.unites[faible.type] ?? 0) - 1
        const g2 = debit(e2) - d
        const aJeter = faible
        if (g2 > 0) {
          liste.push({
            cout: c,
            gain: g2,
            faire: () => {
              jeter(j, aJeter)
              return acheterEtBrancher(j, i)
            },
          })
        }
      }
    }
    const ca = coutAmelioration(j, i)
    if (ca !== null) {
      const e3 = copie(j)
      e3.niveaux[i] = (e3.niveaux[i] ?? 0) + 1
      liste.push({ cout: ca, gain: debit(e3) - d, faire: () => acheterAmelioration(j, i) })
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
