/** La partie du système abstrait vit sur l'appareil, sous sa propre clé : l'alchimie garde la sienne. */
import { deserialiser, serialiser, type Partie } from '../logic/clic/partie.ts'

const CLE = 'quintessence-clic'

export interface SauvegardeClic {
  partie: Partie
  /** L'heure réelle (ms) à laquelle le monde a été mis à jour pour la dernière fois. */
  reel: number
}

export function lireSauvegardeClic(): SauvegardeClic | null {
  try {
    const texte = localStorage.getItem(CLE)
    if (texte === null) return null
    const brut = JSON.parse(texte) as { partie?: unknown; reel?: unknown }
    if (typeof brut.partie !== 'string' || typeof brut.reel !== 'number') return null
    const partie = deserialiser(brut.partie)
    return partie === null ? null : { partie, reel: brut.reel }
  } catch {
    return null
  }
}

export function ecrireSauvegardeClic(s: SauvegardeClic): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ partie: serialiser(s.partie), reel: s.reel }))
  } catch {
    // Stockage plein ou interdit : la partie continue en mémoire.
  }
}

export function effacerSauvegardeClic(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // rien
  }
}
