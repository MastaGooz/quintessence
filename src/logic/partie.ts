/**
 * UNE PARTIE : le monde, le joueur humain (le premier), sept bots, et le temps
 * injecté. `rattraper` fait vivre le monde jusqu'à un instant : la production
 * avance par pas, les bots passent aux heures prévues. Rien ici ne lit
 * l'horloge : c'est `ui/` qui dit quelle heure il est.
 */
import { BATIMENTS, ELEMENTS, SAISON_H, TOUTES } from './donnees.ts'
import { avancer, emplacements, nouveauMonde, occupes, rang, stockVide, type Joueur, type Monde } from './moteur.ts'
import { visiter, type EtatBot, type Strategie } from './bots.ts'
import { graineDe, rngDe } from './rng.ts'

/** Les sept rivaux : six spécialistes qui couvrent toutes les paires, un brigand. */
export const BOTS: Strategie[] = [
  { nom: 'Agrippa', elements: ['feu', 'terre'] },
  { nom: 'Hypatie', elements: ['eau', 'air'] },
  { nom: 'Flamel', elements: ['feu', 'eau'] },
  { nom: 'Zosime', elements: ['terre', 'air'] },
  { nom: 'Paracelse', elements: ['feu', 'air'] },
  { nom: 'Cléopâtre', elements: ['terre', 'eau'] },
  { nom: 'Cagliostro', elements: ['feu', 'terre'], agressif: true },
]

/** Les heures de passage d'un bot dans la journée, depuis 8 h : matin, midi, soir, nuit. */
const HEURES_DE_VISITE = [0, 4.5, 10, 14.5]
/** Le pas de la production. */
export const PAS = 0.25

/**
 * LE DÉVOILEMENT (Keko, premier test : « noyé sous la complexité ») : le jeu
 * commence par un seul bouton, et chaque notion n'apparaît que lorsque le
 * joueur en a l'usage. Une étape dévoilée ne se cache plus.
 */
export const ETAPES = [
  'batir',
  'elements',
  'vendre',
  'transformation',
  'entrepot',
  'ameliorer',
  'agrandir',
  'maitrise',
  'avance',
  'comptoir',
  'rivaux',
  'coupsBas',
  'oeuvre',
] as const
export type Etape = (typeof ETAPES)[number]

export interface Partie {
  version: 2
  graine: number
  monde: Monde
  /** L'état de chaque bot (index du joueur − 1). */
  etats: EtatBot[]
  /** Par bot, l'instant de sa dernière visite jouée. */
  dernieresVisites: number[]
  /** Les étapes déjà dévoilées, dans l'ordre où elles le furent. */
  devoile: Etape[]
}

export function nouvellePartie(graine: number, nomDuJoueur: string): Partie {
  const monde = nouveauMonde([nomDuJoueur, ...BOTS.map((b) => b.nom)], graine)
  // LE JOUEUR PART DE RIEN : sa première pièce, il la gagne en tapant. Les bots sont des alchimistes établis.
  const humain = monde.joueurs[0]!
  humain.or = 0
  humain.stock = stockVide()
  return {
    version: 2,
    graine,
    monde,
    etats: BOTS.map(() => ({ pleinesVu: 0 })),
    dernieresVisites: BOTS.map(() => -1),
    devoile: [],
  }
}

/** Ce que l'état du monde justifie de montrer, étape par étape. */
export function conditions(p: Partie): Record<Etape, boolean> {
  const m = p.monde
  const j = joueur(p)
  const batiments = j.batiments.length
  const ateliers = j.batiments.filter((b) => BATIMENTS[b.nom].type === 'transformation').length
  const tenues = TOUTES.filter((r) => j.stock[r] >= 1).length
  const maitre = ELEMENTS.some((e) => rang(j, e) === 'maitre')
  return {
    batir: j.or >= 60 || batiments >= 1,
    elements: batiments >= 1,
    vendre: TOUTES.some((r) => j.stock[r] >= 10),
    transformation: batiments >= 2,
    entrepot: tenues >= 3,
    ameliorer: ateliers >= 1,
    agrandir: occupes(j) >= emplacements(j) - 1,
    maitrise: ateliers >= 1,
    avance: ELEMENTS.some((e) => j.points[e] >= 4),
    comptoir: ateliers >= 1 || j.journal.orVentesComptoir >= 600,
    rivaux: m.t >= 24 || j.journal.attaquesRecues >= 1,
    coupsBas: m.t >= 48 || j.journal.attaquesRecues >= 1 || maitre,
    oeuvre: maitre,
  }
}

/** Ajoute les étapes nouvellement justifiées et les rend, dans l'ordre de `ETAPES`. */
export function devoiler(p: Partie): Etape[] {
  const c = conditions(p)
  const nouvelles = ETAPES.filter((e) => c[e] && !p.devoile.includes(e))
  p.devoile.push(...nouvelles)
  return nouvelles
}

export function devoilee(p: Partie, e: Etape): boolean {
  return p.devoile.includes(e)
}

export function joueur(p: Partie): Joueur {
  return p.monde.joueurs[0]!
}

export function finie(p: Partie): boolean {
  return p.monde.t >= SAISON_H - 1e-9
}

/** Les visites d'un bot un jour donné : les mêmes à chaque lecture, pour la même partie. */
export function visitesDuJour(graine: number, bot: number, jour: number): number[] {
  const rng = rngDe(graineDe(graine, bot + 1, jour + 1))
  return HEURES_DE_VISITE.map((h) => 24 * jour + h + (rng() - 0.5) * 1.5).sort((a, b) => a - b)
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
      // LES VISITES DANS CE PAS : celles d'aujourd'hui et d'hier qu'on n'a pas encore jouées.
      for (const jour of [Math.floor(t / 24) - 1, Math.floor(t / 24)]) {
        if (jour < 0) continue
        for (const v of visitesDuJour(p.graine, i, jour)) {
          if (v <= depuis || v >= t + dt) continue
          visiter(p.monde, bot, s, p.etats[i]!)
          p.dernieresVisites[i] = v
        }
      }
    })
    avancer(p.monde, dt)
  }
}

/** Le classement : la couleur la plus avancée, puis la fortune. */
export function classement(p: Partie, fortune: (j: Joueur) => number): Joueur[] {
  return [...p.monde.joueurs].sort((a, b) => {
    const ca = a.couleur + (a.cuisson !== null ? 0.5 : 0)
    const cb = b.couleur + (b.cuisson !== null ? 0.5 : 0)
    return cb - ca || fortune(b) - fortune(a)
  })
}

/** Le titre d'un joueur : l'élémental de ses maîtrises. */
export function titre(j: Joueur): string {
  const noms = { feu: 'Salamandre', terre: 'Gnome', eau: 'Ondine', air: 'Sylphe' } as const
  const t = ELEMENTS.filter((e) => j.maitrises.includes(e)).map((e) => noms[e])
  return t.length === 0 ? 'Apprenti' : t.join(' et ')
}

export function serialiser(p: Partie): string {
  return JSON.stringify(p)
}

/** Relit une partie sauvegardée, ou rien si elle n'a pas la forme attendue. */
export function deserialiser(texte: string): Partie | null {
  try {
    const p = JSON.parse(texte) as Partie
    if (p === null || typeof p !== 'object' || p.version !== 2) return null
    if (!Array.isArray(p.monde?.joueurs) || p.monde.joueurs.length !== BOTS.length + 1) return null
    if (!Array.isArray(p.devoile)) return null
    return p
  } catch {
    return null
  }
}
