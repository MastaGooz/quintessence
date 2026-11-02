/**
 * LES SONS, synthétisés au Web Audio : aucun fichier, aucune dépendance.
 *
 * Les deux règles de keko-test tiennent ici aussi :
 * 1. le contexte audio ne naît que sur un geste (la première tape l'ouvre) ;
 * 2. aucun son ne peut casser le jeu — tout est enveloppé, un navigateur sans
 *    Web Audio joue en silence.
 */

const CLE = 'quintessence-son'

let ctx: AudioContext | null = null
let maitre: GainNode | null = null
let actif = lireReglage()

function lireReglage(): boolean {
  try {
    return localStorage.getItem(CLE) !== 'muet'
  } catch {
    return true
  }
}

export function sonActif(): boolean {
  return actif
}

/** Coupe ou rend le son ; rend le nouvel état. */
export function basculerSon(): boolean {
  actif = !actif
  try {
    localStorage.setItem(CLE, actif ? 'actif' : 'muet')
  } catch {
    // Sans persistance, le réglage ne survit pas au rechargement : pas grave.
  }
  return actif
}

function contexte(): AudioContext | null {
  if (!actif) return null
  if (ctx === null) {
    const Constructeur = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Constructeur === undefined) return null
    try {
      ctx = new Constructeur()
    } catch {
      return null
    }
    maitre = ctx.createGain()
    maitre.gain.value = 0.22
    maitre.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Une note : sa hauteur de départ, sa durée, son timbre, son volume, et la hauteur où elle glisse. */
function note(c: AudioContext, t0: number, hauteur: number, duree: number, timbre: OscillatorType, pic: number, vers = hauteur): void {
  if (maitre === null) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = timbre
  o.frequency.setValueAtTime(hauteur, t0)
  if (vers !== hauteur) o.frequency.exponentialRampToValueAtTime(vers, t0 + duree)
  // Les rampes exponentielles refusent zéro : un plancher minuscule à la place du silence.
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(pic, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree)
  o.connect(g)
  g.connect(maitre)
  o.start(t0)
  o.stop(t0 + duree + 0.02)
}

function jouer(f: (c: AudioContext, t0: number) => void): void {
  try {
    const c = contexte()
    if (c === null) return
    f(c, c.currentTime)
  } catch {
    // Le son ne casse jamais le jeu.
  }
}

/** La tape : un tintement bref, dont la hauteur monte avec la série de tapes rapprochées. */
export function sonTape(serie: number): void {
  jouer((c, t) => {
    const h = 880 * Math.pow(1.04, Math.min(serie, 14)) * (1 + (Math.random() - 0.5) * 0.04)
    note(c, t, h, 0.09, 'triangle', 0.5)
    note(c, t, h * 2, 0.05, 'sine', 0.12)
  })
}

/** Une pièce qui arrive au compteur : un tintement clair, un peu plus haut à chaque pièce. */
export function sonPiece(rang: number): void {
  jouer((c, t) => note(c, t, 1320 * Math.pow(1.06, rang % 8), 0.07, 'sine', 0.28))
}

/** Une tape sur la mine : une note qui monte d'une octave à mesure que la barre se remplit — dix tapes, une gamme, puis le tintement de la pièce. Un critique sonne plus haut et plus fort. */
export function sonBarre(remplissage: number, critique: boolean): void {
  jouer((c, t) => {
    const f = 523 * Math.pow(2, Math.min(1, Math.max(0, remplissage))) * (critique ? 1.5 : 1)
    note(c, t, f, 0.1, 'triangle', critique ? 0.6 : 0.45)
    note(c, t, f * 2, 0.06, 'sine', 0.12)
    if (critique) note(c, t + 0.05, f * 1.5, 0.16, 'triangle', 0.3)
  })
}

/**
 * La réserve se vide d'un coup : un souffle qui monte, puis une cascade de tintements. Tout grandit avec `intensite` (0 à 1) : la
 * hauteur du souffle, le nombre de tintements, et, pour une grosse récolte, un coup sourd dessous.
 */
export function sonRecolte(intensite: number): void {
  const k = Math.min(1, Math.max(0, intensite))
  jouer((c, t) => {
    note(c, t, 330, 0.22 + 0.2 * k, 'triangle', 0.3 + 0.2 * k, 660 + 660 * k)
    if (k > 0.4) note(c, t, 110, 0.3, 'sine', 0.6 * k, 55)
    const tintements = 2 + Math.round(6 * k)
    for (let i = 0; i < tintements; i++) note(c, t + 0.06 + i * 0.045, 1320 * Math.pow(1.07, i), 0.09, 'sine', 0.22 + 0.1 * k)
  })
}

/** Une pièce tombe dans la réserve de la mine : un tintement qui monte d'une octave à mesure qu'elle se remplit ; pleine, un petit accord qui s'ouvre. */
export function sonReserve(remplissage: number, pleine: boolean): void {
  jouer((c, t) => {
    const f = 880 * Math.pow(2, Math.min(1, Math.max(0, remplissage)))
    note(c, t, f, 0.1, 'sine', 0.3)
    note(c, t + 0.025, f * 1.5, 0.14, 'triangle', 0.1)
    if (pleine) {
      note(c, t + 0.09, f * 1.26, 0.28, 'triangle', 0.22)
      note(c, t + 0.18, f * 1.5, 0.4, 'triangle', 0.22)
      note(c, t + 0.18, f * 2, 0.45, 'sine', 0.1)
    }
  })
}

/** Une dépense : une pièce qui part, plus grave. */
export function sonDepense(): void {
  jouer((c, t) => note(c, t, 520, 0.12, 'triangle', 0.3, 330))
}

/** Bâtir ou améliorer : un coup sourd, puis un carillon. */
export function sonBatir(): void {
  jouer((c, t) => {
    note(c, t, 150, 0.18, 'square', 0.22, 60)
    note(c, t + 0.08, 660, 0.25, 'triangle', 0.3)
    note(c, t + 0.17, 990, 0.35, 'triangle', 0.3)
  })
}

/** Une étape du tutoriel accomplie : deux notes qui montent. */
export function sonEtape(): void {
  jouer((c, t) => {
    note(c, t, 659, 0.16, 'triangle', 0.35)
    note(c, t + 0.13, 988, 0.32, 'triangle', 0.35)
    note(c, t + 0.13, 1319, 0.32, 'sine', 0.12)
  })
}

/** Un simple clic d'interface. */
export function sonClic(): void {
  jouer((c, t) => note(c, t, 520, 0.05, 'triangle', 0.2, 420))
}
