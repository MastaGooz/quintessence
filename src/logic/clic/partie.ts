/**
 * UNE PARTIE du système abstrait : le joueur humain (le premier), sept bots,
 * et le temps injecté. `rattraper` fait vivre le monde jusqu'à un instant par
 * pas d'un quart d'heure ; les bots passent aux heures prévues. Rien ici ne
 * lit l'horloge : c'est `ui/` qui dit quelle heure il est.
 */
import { SAISON_H } from './donnees.ts'
import { avancer, nouveauMonde, type Joueur, type Monde } from './moteur.ts'
import { visiter, type Strategie } from './bots.ts'
import { graineDe, rngDe } from '../rng.ts'

/** Sept rivaux : des rythmes de visite différents, des tapes plus ou moins assidues. */
export const BOTS: (Strategie & { visites: number })[] = [
  { nom: 'Agrippa', tapes: 80, seuilPrestige: 2, visites: 4 },
  { nom: 'Hypatie', tapes: 120, seuilPrestige: 1.8, visites: 6 },
  { nom: 'Flamel', tapes: 60, seuilPrestige: 2.5, visites: 3 },
  { nom: 'Zosime', tapes: 40, seuilPrestige: 2, visites: 2 },
  { nom: 'Paracelse', tapes: 100, seuilPrestige: 2, visites: 4 },
  { nom: 'Cléopâtre', tapes: 60, seuilPrestige: 1.6, visites: 5 },
  { nom: 'Cagliostro', tapes: 200, seuilPrestige: 3, visites: 4 },
]

/** Le pas de la production hors ligne. */
export const PAS = 0.25

export interface Partie {
  version: 1
  graine: number
  monde: Monde
  /** Par bot, l'instant de sa dernière visite jouée. */
  dernieresVisites: number[]
}

export function nouvellePartie(graine: number, nomDuJoueur: string): Partie {
  return { version: 1, graine, monde: nouveauMonde([nomDuJoueur, ...BOTS.map((b) => b.nom)]), dernieresVisites: BOTS.map(() => -1) }
}

export function joueur(p: Partie): Joueur {
  return p.monde.joueurs[0]!
}

export function finie(p: Partie): boolean {
  return p.monde.t >= SAISON_H - 1e-9
}

/** Les visites d'un bot un jour donné, réparties sur la journée éveillée (de 8 h à minuit) : les mêmes à chaque lecture. */
export function visitesDuJour(graine: number, bot: number, jour: number): number[] {
  const s = BOTS[bot]
  if (s === undefined) return []
  const rng = rngDe(graineDe(graine, bot + 1, jour + 1))
  const heures: number[] = []
  for (let k = 0; k < s.visites; k++) heures.push(24 * jour + (16 * (k + rng())) / s.visites)
  return heures.sort((a, b) => a - b)
}

/** Fait vivre le monde jusqu'à `jusqua` (en heures de jeu), bots compris. */
export function rattraper(p: Partie, jusqua: number): void {
  const fin = Math.min(jusqua, SAISON_H)
  while (p.monde.t < fin - 1e-9) {
    const dt = Math.min(PAS, fin - p.monde.t)
    const t = p.monde.t
    BOTS.forEach((s, i) => {
      const bot = p.monde.joueurs[i + 1]!
      const depuis = p.dernieresVisites[i]!
      for (const jour of [Math.floor(t / 24) - 1, Math.floor(t / 24)]) {
        if (jour < 0) continue
        for (const v of visitesDuJour(p.graine, i, jour)) {
          if (v <= depuis || v >= t + dt) continue
          visiter(p.monde, bot, s)
          p.dernieresVisites[i] = v
        }
      }
    })
    avancer(p.monde, dt)
  }
}

/** Le classement : le R produit depuis le début. */
export function classement(p: Partie): Joueur[] {
  return [...p.monde.joueurs].sort((a, b) => b.total - a.total)
}

export function serialiser(p: Partie): string {
  return JSON.stringify(p)
}

/** Relit une partie sauvegardée, ou rien si elle n'a pas la forme attendue. */
export function deserialiser(texte: string): Partie | null {
  try {
    const p = JSON.parse(texte) as Partie
    if (p === null || typeof p !== 'object' || p.version !== 1) return null
    if (!Array.isArray(p.monde?.joueurs) || p.monde.joueurs.length !== BOTS.length + 1) return null
    if (!Array.isArray(p.dernieresVisites)) return null
    return p
  } catch {
    return null
  }
}
