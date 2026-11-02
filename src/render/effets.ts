/**
 * LES EFFETS : une couche fixe au-dessus du jeu où l'on fait voler des pièces
 * vers le compteur d'or, flotter des « +1 » et jaillir des étincelles.
 *
 * Tout est impératif — des nœuds DOM animés au Web Animations, retirés à la
 * fin — et hors de React : rien à repeindre, rien à garder en état. La logique
 * ne sait rien de tout ça ; ce sont les pages qui appellent ces fonctions
 * après avoir joué l'action.
 */
import { sonDepense, sonPiece, sonRecolte } from '../ui/sons.ts'

let couche: HTMLElement | null = null
let cibleOr: HTMLElement | null = null
/** Le compteur de chaque ressource, en haut : là où volent ses morceaux. */
const ciblesRessources: Record<string, HTMLElement | null> = {}
const retards: Record<string, number> = {}
const glisses: Record<string, number> = {}

/** La couche où l'on dessine (posée par `Jeu`). */
export function monterCouche(el: HTMLElement | null): void {
  couche = el
}

/** Le compteur d'or de l'entête : la cible des pièces. */
export function declarerCibleOr(el: HTMLElement | null): void {
  cibleOr = el
}

export function mouvementReduit(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Un compteur attend ce délai avant de bouger : les pièces arrivent d'abord. `glisse` : il monte ensuite pendant ce temps, à vitesse égale, au rythme d'un flot de pièces. */
export function retarderLeCompteur(cle: string, ms: number, glisse?: number): void {
  retards[cle] = Math.max(retards[cle] ?? 0, ms)
  if (glisse !== undefined) glisses[cle] = Math.max(glisses[cle] ?? 0, glisse)
}

export function prendreLaGlisse(cle: string | undefined): number | undefined {
  if (cle === undefined) return undefined
  const g = glisses[cle]
  delete glisses[cle]
  return g
}

export function prendreLeRetard(cle: string | undefined): number {
  if (cle === undefined) return 0
  const r = retards[cle] ?? 0
  delete retards[cle]
  return r
}

function poser(classe: string, x: number, y: number, texte = ''): HTMLElement | null {
  if (couche === null) return null
  const el = document.createElement('span')
  el.className = classe
  el.textContent = texte
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  couche.appendChild(el)
  return el
}

function animer(el: HTMLElement, images: Keyframe[], options: KeyframeAnimationOptions): Animation {
  const a = el.animate(images, { fill: 'forwards', ...options })
  const retirer = (): void => el.remove()
  a.finished.then(retirer, retirer)
  return a
}

/** Un texte qui monte (ou descend, `sens` 1) et s'efface depuis (x, y), un peu de travers, comme lancé. */
export function flotter(x: number, y: number, texte: string, classe = '', taille = 1, sens = -1): void {
  if (mouvementReduit()) return
  const el = poser(`flottant ${classe}`, x, y, texte)
  if (el === null) return
  const dx = (Math.random() - 0.5) * 40
  const rot = (Math.random() - 0.5) * 24
  animer(
    el,
    [
      { transform: `translate(-50%, -50%) scale(${0.5 * taille})`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), ${sens * 100 - 50}%) scale(${1.15 * taille}) rotate(${rot}deg)`, opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${dx}px), ${sens * 220 - 50}%) scale(${taille}) rotate(${rot}deg)`, opacity: 0 },
    ],
    { duration: 750, easing: 'cubic-bezier(.2,.7,.3,1)' },
  )
}

/** Des étincelles qui jaillissent de (x, y) et retombent. */
export function eclater(x: number, y: number, n = 6, couleur = 'var(--or)'): void {
  if (mouvementReduit()) return
  for (let i = 0; i < n; i++) {
    const el = poser('etincelle', x, y)
    if (el === null) return
    el.style.background = couleur
    el.style.color = couleur
    const angle = Math.random() * Math.PI * 2
    const portee = 28 + Math.random() * 55
    const taille = 3 + Math.random() * 4
    el.style.width = `${taille}px`
    el.style.height = `${taille}px`
    animer(
      el,
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * portee}px), calc(-50% + ${Math.sin(angle) * portee + 24}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: 420 + Math.random() * 320, easing: 'cubic-bezier(.1,.8,.4,1)' },
    )
  }
}

/** L'éclat d'un coup : une lueur ronde, blanche au cœur, qui s'ouvre et s'éteint en un éclair, au point frappé. */
export function impact(x: number, y: number, taille = 50): void {
  if (mouvementReduit()) return
  const el = poser('impact', x, y)
  if (el === null) return
  el.style.width = `${taille}px`
  el.style.height = `${taille}px`
  animer(
    el,
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 0.9, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0 },
    ],
    { duration: 220, easing: 'ease-out' },
  )
}

/** Une onde de lumière qui s'élargit depuis (x, y) et s'efface : l'impact d'une pièce. */
export function onde(x: number, y: number, rayon = 40, couleur = 'rgba(255, 214, 90, 0.95)'): void {
  if (mouvementReduit()) return
  const el = poser('onde', x, y)
  if (el === null) return
  el.style.width = `${rayon * 2}px`
  el.style.height = `${rayon * 2}px`
  el.style.color = couleur
  animer(
    el,
    [
      { transform: 'translate(-50%, -50%) scale(0.15)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
    ],
    { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' },
  )
}

/** Un petit sursaut du compteur d'or, à chaque pièce qui arrive ; `force` l'agrandit (la dernière pièce d'une grosse récolte). */
export function secouerLOr(force = 1): void {
  cibleOr?.animate([{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.18 * force})`, offset: 0.35 }, { transform: 'scale(1)' }], { duration: 220 + 80 * (force - 1), easing: 'ease-out' })
}

function centre(r: DOMRect): [number, number] {
  return [r.left + r.width / 2, r.top + r.height / 2]
}

/** Le temps de vol d'une pièce (ms) : un compteur qui l'attend se retarde d'autant. */
export const DUREE_VOL = 560

/**
 * Des pièces qui volent en arc de `depuis` à `vers`, décalées l'une après
 * l'autre. `onArrivee` est appelé à chaque atterrissage. Rend l'instant (ms)
 * où la première pièce arrive.
 */
export function volerDesPieces(depuis: DOMRect, vers: DOMRect, n: number, onArrivee?: (rang: number) => void, ecart = 55, classe = 'piece'): number {
  if (couche === null || mouvementReduit()) {
    onArrivee?.(0)
    return 0
  }
  const [x0, y0] = centre(depuis)
  const [x1, y1] = centre(vers)
  const DUREE = DUREE_VOL
  const ECART = ecart
  for (let i = 0; i < n; i++) {
    const px = x0 + (Math.random() - 0.5) * Math.min(depuis.width, 120) * 0.6
    const py = y0 + (Math.random() - 0.5) * 12
    const el = poser(classe, px, py)
    if (el === null) break
    // Un arc quadratique : on part vers le haut, puis on file vers la cible.
    const cx = (px + x1) / 2 + (Math.random() - 0.5) * 140
    const cy = Math.min(py, y1) - 50 - Math.random() * 90
    const images: Keyframe[] = []
    const PAS = 14
    for (let k = 0; k <= PAS; k++) {
      const u = k / PAS
      const x = (1 - u) * (1 - u) * px + 2 * (1 - u) * u * cx + u * u * x1
      const y = (1 - u) * (1 - u) * py + 2 * (1 - u) * u * cy + u * u * y1
      images.push({
        transform: `translate(calc(-50% + ${x - px}px), calc(-50% + ${y - py}px)) scale(${1 - 0.35 * u})`,
        opacity: u > 0.92 ? 0 : 1,
        offset: u,
      })
    }
    const a = animer(el, images, { duration: DUREE, delay: i * ECART, easing: 'cubic-bezier(.45,0,.75,.45)' })
    a.finished.then(
      () => onArrivee?.(i),
      () => undefined,
    )
  }
  return DUREE
}

/** Combien de pièces pour une somme : de 3 à 10, selon l'ordre de grandeur. */
export function piecesPour(somme: number): number {
  return Math.max(3, Math.min(10, 2 + Math.floor(Math.log2(Math.max(1, somme)))))
}

/** Une vente depuis un bouton : les pièces volent au compteur, qui ne bouge qu'à leur arrivée. */
export function effetVente(bouton: DOMRect, gain: number): void {
  const cible = cibleOr?.getBoundingClientRect()
  if (cible === undefined || gain <= 0) return
  // UNE PIÈCE QUI VOLE PAR PIÈCE GAGNÉE (Keko, 02/11 : « c'est bizarre que plusieurs pièces volent alors qu'on en génère une ») ; au-delà de douze, chacune en porte plusieurs.
  const arrivee = volerDesPieces(bouton, cible, Math.max(1, Math.min(12, Math.round(gain))), (rang) => {
    sonPiece(rang)
    secouerLOr()
  })
  retarderLeCompteur('or', arrivee)
  const [x] = centre(bouton)
  flotterOr(x, bouton.top - 16, gain, 1.05)
}

/** L'intensité d'une récolte, de 0 à 1 : à l'échelle du logarithme, une pièce y est déjà sensible, une réserve pleine la porte au maximum. */
export function intensiteRecolte(gain: number, capacite: number): number {
  return Math.min(1, Math.max(0, Math.log(1 + gain) / Math.log(1 + Math.max(1, capacite))))
}

/**
 * LA RÉCOLTE DE LA RÉSERVE (Keko, 02/11 : « quand on vide la réserve, ce
 * n'est pas assez juicy ; un effet dont l'intensité augmente avec la
 * quantité ») : un éclair, des ondes, une gerbe d'étincelles, un nombre qui
 * flotte, un flot de pièces vers le compteur — une par pièce, jusqu'à trente
 * — qui monte au rythme de leur arrivée et sursaute fort à la dernière, et
 * un son qui monte. Tout grandit avec `intensite` (`intensiteRecolte`).
 */
export function effetRecolte(source: DOMRect, gain: number, intensite: number, ressource?: string): void {
  // L'or de la banque vole à la bourse ; la ressource d'un producteur construit, à son compteur.
  const compteur = ressource === undefined ? cibleOr : (ciblesRessources[ressource] ?? null)
  const cible = compteur?.getBoundingClientRect()
  if (compteur === null || cible === undefined || gain <= 0) return
  const k = Math.min(1, Math.max(0, intensite))
  sonRecolte(k)
  const n = Math.max(1, Math.min(Math.round(gain), 6 + Math.round(24 * k)))
  const ecart = n > 12 ? 32 : 55
  const force = (rang: number): number => (rang === n - 1 ? 1 + 2.2 * k : 1)
  const arrivee = volerDesPieces(
    source,
    cible,
    n,
    (rang) => {
      sonPiece(rang)
      if (ressource === undefined) secouerLOr(force(rang))
      else compteur.animate([{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.18 * force(rang)})`, offset: 0.35 }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' })
    },
    ecart,
    ressource === undefined ? 'piece' : `piece piece-${ressource}`,
  )
  retarderLeCompteur(ressource ?? 'or', arrivee, (n - 1) * ecart + 160)
  const [x, y] = centre(source)
  flotterOr(x, source.top - 16, gain, 1.1 + 1.3 * k, false, ressource === undefined ? 'symbole-piece' : `symbole-ressource symbole-${ressource}`)
  impact(x, y, 90 + 260 * k)
  onde(x, y, 50 + 170 * k)
  if (k > 0.45) window.setTimeout(() => onde(x, y, 80 + 240 * k, 'rgba(255, 250, 225, 0.9)'), 110)
  if (k > 0.8) window.setTimeout(() => onde(x, y, 120 + 300 * k), 230)
  eclater(x, y, Math.round(10 + 50 * k), '#ffe27a')
  if (k > 0.5) eclater(x, y, Math.round(30 * k), '#fff6d0')
}

/** Deux tapes à moins de ce délai forment une série : leurs gains s'additionnent dans un seul nombre, le son monte. */
export const SERIE_MS = 450

/** Un nombre d'or : le nombre, puis la pièce (Keko, 02/11 : « à la place du texte or, un symbole de pièce ; pas de + avant »). Une dépense garde son « − ». `symbole` : une ressource à la place de la pièce. */
function nombreOr(el: HTMLElement, n: number, signe = '', symbole = 'symbole-piece'): void {
  el.textContent = `${signe}${Math.round(n).toLocaleString('fr-FR')} `
  const piece = document.createElement('span')
  piece.className = symbole
  el.appendChild(piece)
}

/** Le compteur d'une ressource se déclare (une ref React). */
export function declarerCibleRessource(r: string): (el: HTMLElement | null) => void {
  return (el) => {
    ciblesRessources[r] = el
  }
}

/** Une ressource gagnée (Keko, 02/11 : les producteurs construits, comme la banque) : ses morceaux volent de `depuis` à son compteur, qui ne bouge qu'à leur arrivée ; le nombre flotte au-dessus. */
export function effetRessource(depuis: DOMRect, r: string, gain: number): void {
  const cible = ciblesRessources[r]
  const vers = cible?.getBoundingClientRect()
  if (cible === null || cible === undefined || vers === undefined || gain <= 0) return
  const arrivee = volerDesPieces(
    depuis,
    vers,
    Math.max(1, Math.min(12, Math.round(gain))),
    (rang) => {
      sonPiece(rang)
      cible.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' })
    },
    55,
    `piece piece-${r}`,
  )
  retarderLeCompteur(r, arrivee)
  flotterOr(depuis.left + depuis.width / 2, depuis.top - 16, gain, 1, false, `symbole-ressource symbole-${r}`)
}

/** Un nombre d'or qui flotte et s'efface, comme `flotter` ; une dépense en rouge, avec son « − ». */
export function flotterOr(x: number, y: number, n: number, taille = 1, depense = false, symbole = 'symbole-piece'): void {
  if (mouvementReduit()) return
  const el = poser(`flottant ${depense ? 'flottant-rouge' : 'flottant-or'}`, x, y)
  if (el === null) return
  nombreOr(el, n, depense ? '−' : '', symbole)
  const dx = (Math.random() - 0.5) * 40
  animer(
    el,
    [
      { transform: `translate(-50%, -50%) scale(${0.5 * taille})`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), -150%) scale(${1.15 * taille})`, opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${dx}px), -270%) scale(${taille})`, opacity: 0 },
    ],
    { duration: 750, easing: 'cubic-bezier(.2,.7,.3,1)' },
  )
}

/**
 * LA SÉRIE D'OR (Keko, 02/11 : « additionne les taps proches pour voir le
 * nombre total généré par une série de taps ») : la première tape pose un
 * nombre au-dessus du doigt ; chaque tape qui suit à moins de `SERIE_MS` lui
 * ajoute son gain, et le nombre sursaute et grossit avec le total. Une pause,
 * et il monte en s'effaçant.
 */
let serieOr: { el: HTMLElement; total: number; minuteur: number } | null = null

const baseSerie = (total: number): string => `translate(-50%, -50%) scale(${Math.min(2, 1 + 0.2 * Math.log2(Math.max(1, total)))})`

function finirLaSerie(): void {
  const s = serieOr
  serieOr = null
  if (s === null) return
  const base = baseSerie(s.total)
  animer(s.el, [{ transform: base, opacity: 1 }, { transform: `${base} translateY(-70%)`, opacity: 1, offset: 0.35 }, { transform: `${base} translateY(-160%)`, opacity: 0 }], {
    duration: 650,
    easing: 'cubic-bezier(.3,.6,.4,1)',
  })
}

/** Ajoute le gain d'une tape à la série en cours, ou en commence une à (x, y). `force` : le sursaut (plus fort pour un critique). */
export function gainEnSerie(x: number, y: number, gain: number, force = 1): void {
  if (gain <= 0 || mouvementReduit()) return
  if (serieOr === null) {
    const el = poser('flottant flottant-or flottant-serie', x, y)
    if (el === null) return
    serieOr = { el, total: 0, minuteur: 0 }
  }
  const s = serieOr
  window.clearTimeout(s.minuteur)
  s.total += gain
  nombreOr(s.el, s.total)
  const base = baseSerie(s.total)
  s.el.style.transform = base
  s.el.animate(
    s.total === gain
      ? [{ transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 }, { transform: `${base} scale(1.2)`, opacity: 1, offset: 0.5 }, { transform: base, opacity: 1 }]
      : [{ transform: `${base} scale(${1 + 0.18 * force})` }, { transform: base }],
    { duration: 220, easing: 'cubic-bezier(.2,1.4,.4,1)' },
  )
  s.minuteur = window.setTimeout(finirLaSerie, SERIE_MS)
}

/** L'or d'une tape sur la mine : le nombre de la série grossit au-dessus du doigt, une pièce vole de là au compteur, qui ne bouge qu'à son arrivée et sursaute. */
export function effetGainOr(x: number, y: number, gain: number, force = 1): void {
  if (gain <= 0) return
  gainEnSerie(x, y - 50, gain, force)
  const cible = cibleOr?.getBoundingClientRect()
  if (cible === undefined) return
  const arrivee = volerDesPieces(new DOMRect(x - 10, y - 10, 20, 20), cible, 1, () => secouerLOr())
  retarderLeCompteur('or', arrivee)
}

/** Un débit sans bouton à viser (la feuille s'est fermée) : « −N or » sous le compteur, qui sursaute. */
export function effetDebit(cout: number): void {
  const source = cibleOr?.getBoundingClientRect()
  if (source === undefined || cout <= 0) return
  sonDepense()
  const [x] = centre(source)
  flotterOr(x + 16, source.bottom + 8, cout, 0.95, true)
}

/** Une dépense vers un bouton : les pièces partent du compteur. */
export function effetDepense(bouton: DOMRect, cout: number): void {
  const source = cibleOr?.getBoundingClientRect()
  if (source === undefined || cout <= 0) return
  sonDepense()
  volerDesPieces(source, bouton, Math.min(6, piecesPour(cout)))
  const [x] = centre(bouton)
  flotterOr(x, bouton.top - 16, cout, 0.95, true)
}
