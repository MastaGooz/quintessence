/**
 * UNE PARTIE : le monde, le joueur humain (le premier), sept bots, et le temps
 * injecté. `rattraper` fait vivre le monde jusqu'à un instant : la production
 * avance par pas, les bots passent aux heures prévues. Rien ici ne lit
 * l'horloge : c'est `ui/` qui dit quelle heure il est.
 */
import { ELEMENTS, SAISON_H, type NomBatiment, type Ressource } from './donnees.ts'
import { avancer, nouveauMonde, stockVide, type Joueur, type Monde } from './moteur.ts'
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
 * LE TUTORIEL (Keko : « un tuto pas à pas pour tous les éléments un par un ») :
 * une chaîne d'étapes, chacune ouvre UNE chose — une mine, un atelier, une
 * page, un savoir — et dit quoi faire. Une étape d'action s'achève d'elle-même
 * quand c'est fait ; une étape de savoir attend que le joueur dise « compris »,
 * et n'est présentée que lorsque c'est le moment. Ce qu'une étape ouvre reste
 * ouvert. Les textes sont dans `ui/devoilement.ts`.
 */
export type Page = 'labo' | 'stock' | 'marche' | 'rivaux' | 'oeuvre'

export interface EtapeTuto {
  id: string
  batiments?: NomBatiment[]
  pages?: Page[]
  /** Une étape de savoir : elle s'achève quand le joueur dit « compris ». */
  concept?: boolean
  /** Une étape de savoir n'est présentée que lorsque c'est le moment. */
  prete?: (p: Partie) => boolean
  /** Une étape d'action s'achève d'elle-même. */
  faite?: (p: Partie) => boolean
}

const a = (p: Partie, nom: NomBatiment): boolean => joueur(p).batiments.some((b) => b.nom === nom)
const stock = (p: Partie, r: Ressource): number => joueur(p).stock[r]
const points = (p: Partie, n: number): boolean => ELEMENTS.some((e) => joueur(p).points[e] >= n)

export const TUTO: EtapeTuto[] = [
  { id: 'tape', faite: (p) => joueur(p).or >= 60 || joueur(p).batiments.length >= 1 },
  { id: 'argiliere', batiments: ['argiliere'], faite: (p) => a(p, 'argiliere') },
  { id: 'vendre', faite: (p) => joueur(p).journal.orVentesComptoir > 0 },
  { id: 'mineFer', batiments: ['mineFer'], faite: (p) => a(p, 'mineFer') || stock(p, 'minerai') >= 20 },
  { id: 'mineCharbon', batiments: ['mineCharbon'], faite: (p) => a(p, 'mineCharbon') || stock(p, 'charbon') >= 20 },
  { id: 'fourneau', batiments: ['fourneau'], faite: (p) => a(p, 'fourneau') },
  { id: 'forge', batiments: ['forge'], faite: (p) => a(p, 'forge') },
  { id: 'maitrise', concept: true },
  { id: 'comptoir', pages: ['marche'], faite: (p) => stock(p, 'verre') >= 10 || joueur(p).extensions >= 1 },
  { id: 'extension', batiments: ['extension'], faite: (p) => joueur(p).extensions >= 1 },
  { id: 'verrerie', batiments: ['verrerie'], faite: (p) => a(p, 'verrerie') },
  { id: 'sabliere', batiments: ['sabliere'], faite: (p) => a(p, 'sabliere') || stock(p, 'sable') >= 40 },
  { id: 'entrepot', concept: true, pages: ['stock'], batiments: ['entrepot'] },
  { id: 'jardin', batiments: ['jardin'], faite: (p) => a(p, 'jardin') || stock(p, 'herbes') >= 20 },
  { id: 'saline', batiments: ['saline'], faite: (p) => a(p, 'saline') || stock(p, 'sel') >= 20 },
  { id: 'alambic', batiments: ['alambic'], faite: (p) => a(p, 'alambic') },
  { id: 'ameliorer', faite: (p) => joueur(p).batiments.some((b) => b.niveau >= 2) },
  { id: 'soufriere', batiments: ['soufriere'], faite: (p) => a(p, 'soufriere') || stock(p, 'soufre') >= 20 },
  { id: 'geode', batiments: ['geode'], faite: (p) => a(p, 'geode') || stock(p, 'cristal') >= 20 },
  { id: 'avance', concept: true, batiments: ['autel', 'creuset', 'cornue', 'atelierRunes'], prete: (p) => points(p, 4) },
  { id: 'maitre', concept: true, batiments: ['athanor', 'grandCreuset', 'fontaine', 'observatoire', 'four'], pages: ['oeuvre'], prete: (p) => points(p, 6) },
  { id: 'rivaux', concept: true, pages: ['rivaux'], prete: (p) => p.monde.t >= 24 || joueur(p).journal.attaquesRecues >= 1 },
  { id: 'coupsBas', concept: true, batiments: ['repaire', 'officine', 'cabinet', 'tour', 'gardien', 'cercle'], prete: (p) => p.monde.t >= 48 || joueur(p).journal.attaquesRecues >= 1 },
  { id: 'fin', concept: true },
]

export interface Partie {
  version: 3
  graine: number
  monde: Monde
  /** L'état de chaque bot (index du joueur − 1). */
  etats: EtatBot[]
  /** Par bot, l'instant de sa dernière visite jouée. */
  dernieresVisites: number[]
  /** L'index de l'étape du tutoriel en cours ; `TUTO.length` quand il est fini. */
  tuto: number
}

export function nouvellePartie(graine: number, nomDuJoueur: string): Partie {
  const monde = nouveauMonde([nomDuJoueur, ...BOTS.map((b) => b.nom)], graine)
  // LE JOUEUR PART DE RIEN : sa première pièce, il la gagne en tapant. Les bots sont des alchimistes établis.
  const humain = monde.joueurs[0]!
  humain.or = 0
  humain.stock = stockVide()
  return {
    version: 3,
    graine,
    monde,
    etats: BOTS.map(() => ({ pleinesVu: 0 })),
    dernieresVisites: BOTS.map(() => -1),
    tuto: 0,
  }
}

export function joueur(p: Partie): Joueur {
  return p.monde.joueurs[0]!
}

export function finie(p: Partie): boolean {
  return p.monde.t >= SAISON_H - 1e-9
}

/** L'étape en cours, ou null quand le tutoriel est fini. */
export function etapeCourante(p: Partie): EtapeTuto | null {
  return TUTO[p.tuto] ?? null
}

/** L'étape en cours est-elle à montrer maintenant ? Une étape de savoir attend son moment. */
export function etapePresentee(p: Partie): EtapeTuto | null {
  const e = etapeCourante(p)
  if (e === null) return null
  return e.prete === undefined || e.prete(p) ? e : null
}

/** Passe les étapes d'action accomplies ; rend leurs identifiants. */
export function avancerTuto(p: Partie): string[] {
  const passees: string[] = []
  for (;;) {
    const e = TUTO[p.tuto]
    if (e === undefined || e.concept || e.faite === undefined || !e.faite(p)) return passees
    passees.push(e.id)
    p.tuto += 1
  }
}

/** Le joueur a dit « compris » à une étape de savoir. */
export function comprendre(p: Partie): void {
  const e = TUTO[p.tuto]
  if (e !== undefined && e.concept) p.tuto += 1
}

/** Cette étape est-elle atteinte (en cours ou passée) ? Ce qu'elle ouvre est alors ouvert. */
export function atteint(p: Partie, id: string): boolean {
  const i = TUTO.findIndex((e) => e.id === id)
  return i >= 0 && i <= p.tuto
}

export function batimentOuvert(p: Partie, nom: NomBatiment): boolean {
  return TUTO.some((e, i) => i <= p.tuto && (e.batiments ?? []).includes(nom))
}

export function pageOuverte(p: Partie, page: Page): boolean {
  return page === 'labo' || TUTO.some((e, i) => i <= p.tuto && (e.pages ?? []).includes(page))
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
    if (p === null || typeof p !== 'object' || p.version !== 3) return null
    if (!Array.isArray(p.monde?.joueurs) || p.monde.joueurs.length !== BOTS.length + 1) return null
    if (typeof p.tuto !== 'number') return null
    return p
  } catch {
    return null
  }
}
