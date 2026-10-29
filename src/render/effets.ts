/**
 * LES EFFETS : une couche fixe au-dessus du jeu où l'on fait voler des pièces
 * vers le compteur d'or, flotter des « +1 » et jaillir des étincelles.
 *
 * Tout est impératif — des nœuds DOM animés au Web Animations, retirés à la
 * fin — et hors de React : rien à repeindre, rien à garder en état. La logique
 * ne sait rien de tout ça ; ce sont les pages qui appellent ces fonctions
 * après avoir joué l'action.
 */
import { sonDepense, sonPiece } from '../ui/sons.ts'

let couche: HTMLElement | null = null
let cibleOr: HTMLElement | null = null
const retards: Record<string, number> = {}

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

/** Un compteur attend ce délai avant de bouger : les pièces arrivent d'abord. */
export function retarderLeCompteur(cle: string, ms: number): void {
  retards[cle] = Math.max(retards[cle] ?? 0, ms)
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

/** Un petit sursaut du compteur d'or, à chaque pièce qui arrive. */
export function secouerLOr(): void {
  cibleOr?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' })
}

function centre(r: DOMRect): [number, number] {
  return [r.left + r.width / 2, r.top + r.height / 2]
}

/**
 * Des pièces qui volent en arc de `depuis` à `vers`, décalées l'une après
 * l'autre. `onArrivee` est appelé à chaque atterrissage. Rend l'instant (ms)
 * où la première pièce arrive.
 */
export function volerDesPieces(depuis: DOMRect, vers: DOMRect, n: number, onArrivee?: (rang: number) => void): number {
  if (couche === null || mouvementReduit()) {
    onArrivee?.(0)
    return 0
  }
  const [x0, y0] = centre(depuis)
  const [x1, y1] = centre(vers)
  const DUREE = 560
  const ECART = 55
  for (let i = 0; i < n; i++) {
    const px = x0 + (Math.random() - 0.5) * Math.min(depuis.width, 120) * 0.6
    const py = y0 + (Math.random() - 0.5) * 12
    const el = poser('piece', px, py)
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
  const arrivee = volerDesPieces(bouton, cible, piecesPour(gain), (rang) => {
    sonPiece(rang)
    secouerLOr()
  })
  retarderLeCompteur('or', arrivee)
  const [x] = centre(bouton)
  flotter(x, bouton.top - 16, `+${Math.round(gain).toLocaleString('fr-FR')} or`, 'flottant-or', 1.05)
}

/** Un débit sans bouton à viser (la feuille s'est fermée) : « −N or » sous le compteur, qui sursaute. */
export function effetDebit(cout: number): void {
  const source = cibleOr?.getBoundingClientRect()
  if (source === undefined || cout <= 0) return
  sonDepense()
  const [x] = centre(source)
  flotter(x + 16, source.bottom + 8, `−${Math.round(cout).toLocaleString('fr-FR')} or`, 'flottant-rouge', 0.95, 1)
}

/** Une dépense vers un bouton : les pièces partent du compteur. */
export function effetDepense(bouton: DOMRect, cout: number): void {
  const source = cibleOr?.getBoundingClientRect()
  if (source === undefined || cout <= 0) return
  sonDepense()
  volerDesPieces(source, bouton, Math.min(6, piecesPour(cout)))
  const [x] = centre(bouton)
  flotter(x, bouton.top - 16, `−${Math.round(cout).toLocaleString('fr-FR')} or`, 'flottant-rouge', 0.95)
}
