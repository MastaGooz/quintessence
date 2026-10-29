import type { Partie } from '../logic/partie.ts'

/** Ce que reçoit chaque page : la partie, et `agir` qui joue une action puis sauve et repeint. */
export interface PageProps {
  partie: Partie
  agir: (f: () => void) => void
}
