/** La partie vit sur l'appareil : le seul endroit qui touche à localStorage. */
import { deserialiser, serialiser, type Partie } from '../logic/partie.ts'

const CLE = 'quintessence-partie'

export interface Sauvegarde {
  partie: Partie
  /** L'heure réelle (ms) à laquelle le monde a été mis à jour pour la dernière fois. */
  reel: number
}

export function lireSauvegarde(): Sauvegarde | null {
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

export function ecrireSauvegarde(s: Sauvegarde): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ partie: serialiser(s.partie), reel: s.reel }))
  } catch {
    // Stockage plein ou interdit : la partie continue en mémoire.
  }
}

export function effacerSauvegarde(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // rien
  }
}
