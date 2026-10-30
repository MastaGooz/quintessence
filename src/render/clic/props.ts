import type { Partie } from '../../logic/clic/partie.ts'

/** Ce que reçoit chaque page du système abstrait : la partie, et `agir` qui joue une action puis sauve et repeint. */
export interface PagePropsClic {
  partie: Partie
  agir: (f: () => void) => void
}
