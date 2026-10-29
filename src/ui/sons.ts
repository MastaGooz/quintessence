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
