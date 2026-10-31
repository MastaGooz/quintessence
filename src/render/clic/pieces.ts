/**
 * LES DÉCOUPES DES PIÈCES, en chemins SVG. Une pièce est un rectangle dont
 * chaque côté porte des bosses, des creux ou rien, à des emplacements répartis
 * le long du côté ; la bosse et le creux d'une même forme ont la même
 * silhouette, pour que l'une remplisse l'autre quand deux pièces se touchent.
 * Les quatre formes : rond, carré, triangle, trapèze (une queue d'aronde). Les
 * coordonnées sont centrées sur la pièce.
 */
import { PIECE } from '../../logic/clic/donnees.ts'
import type { Decoupe } from '../../logic/clic/moteur.ts'

export interface Encoche {
  largeur: number
  profondeur: number
}

const n = (v: number): string => (Math.round(v * 100) / 100).toString()

/**
 * Le chemin d'un rectangle `largeur` × `hauteur` dont les côtés, dans le sens
 * des aiguilles (haut, droite, bas, gauche), portent chacun une liste
 * d'emplacements répartis le long du côté, dans le même sens : une découpe ou
 * rien. La bosse dépasse de `profondeur`, le creux s'enfonce d'autant.
 */
export function cheminDecoupe(largeur: number, hauteur: number, cotes: readonly (readonly (Decoupe | null)[])[], encoche: Encoche = PIECE.encoche): string {
  const w = largeur / 2
  const h = hauteur / 2
  // Chaque côté : son départ, sa direction, sa normale vers l'extérieur, sa longueur.
  const bords = [
    { x: -w, y: -h, ux: 1, uy: 0, nx: 0, ny: -1, l: largeur },
    { x: w, y: -h, ux: 0, uy: 1, nx: 1, ny: 0, l: hauteur },
    { x: w, y: h, ux: -1, uy: 0, nx: 0, ny: 1, l: largeur },
    { x: -w, y: h, ux: 0, uy: -1, nx: -1, ny: 0, l: hauteur },
  ]
  const demi = encoche.largeur / 2
  let d = `M ${n(-w)} ${n(-h)}`
  bords.forEach((b, k) => {
    const liste = cotes[k] ?? []
    const fin = { x: b.x + b.ux * b.l, y: b.y + b.uy * b.l }
    // Un point du bord : `t` le long du bord, `s` vers l'extérieur (négatif : vers l'intérieur).
    const p = (t: number, s: number): string => `${n(b.x + b.ux * t + b.nx * s)} ${n(b.y + b.uy * t + b.ny * s)}`
    liste.forEach((c, i) => {
      if (c === null) return
      const m = ((i + 0.5) * b.l) / liste.length
      const s = c.genre === 'bosse' ? encoche.profondeur : -encoche.profondeur
      switch (c.forme) {
        case 0: {
          // ROND : un demi-cercle, en deux quarts qui passent par le sommet. Le sens de l'arc : horaire vers l'extérieur.
          const r = demi
          const horaire = s > 0 ? 1 : 0
          const sommet = s > 0 ? r : -r
          d += ` L ${p(m - r, 0)} A ${n(r)} ${n(r)} 0 0 ${horaire} ${p(m, sommet)} A ${n(r)} ${n(r)} 0 0 ${horaire} ${p(m + r, 0)}`
          break
        }
        case 1:
          d += ` L ${p(m - demi, 0)} L ${p(m - demi, s)} L ${p(m + demi, s)} L ${p(m + demi, 0)}`
          break
        case 2:
          d += ` L ${p(m - demi, 0)} L ${p(m, s)} L ${p(m + demi, 0)}`
          break
        default:
          // TRAPÈZE : une queue d'aronde, plus large au bout qu'au col.
          d += ` L ${p(m - demi * 0.55, 0)} L ${p(m - demi, s)} L ${p(m + demi, s)} L ${p(m + demi * 0.55, 0)}`
      }
    })
    d += ` L ${n(fin.x)} ${n(fin.y)}`
  })
  return `${d} Z`
}

/** La boîte d'un SVG qui contient une pièce et ses bosses : `x y largeur hauteur`. */
export function boite(largeur: number, hauteur: number, encoche: Encoche = PIECE.encoche): { x: number; y: number; largeur: number; hauteur: number } {
  const a = encoche.profondeur
  return { x: -largeur / 2 - a, y: -hauteur / 2 - a, largeur: largeur + 2 * a, hauteur: hauteur + 2 * a }
}

/** Les quatre côtés d'un producteur, depuis ses huit emplacements (haut ×3, droite, bas ×3, gauche), en creux. */
export function cotesDuProducteur(creux: readonly (number | null)[]): (Decoupe | null)[][] {
  const c = (f: number | null | undefined): Decoupe | null => (f === null || f === undefined ? null : { genre: 'creux', forme: f })
  return [[c(creux[0]), c(creux[1]), c(creux[2])], [c(creux[3])], [c(creux[4]), c(creux[5]), c(creux[6])], [c(creux[7])]]
}

/** Les quatre côtés d'un module : sa bosse en bas, rien ailleurs. */
export function cotesDuModule(forme: number): (Decoupe | null)[][] {
  return [[null], [null], [{ genre: 'bosse', forme }], [null]]
}
