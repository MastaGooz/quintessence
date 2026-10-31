/**
 * LA PLANÈTE (Keko, 31/10/2026 : « pourquoi on n'utilise pas l'espace 2D pour
 * représenter la planète ? Les zones sont des gisements, les bases sont les
 * extracteurs et les modules se fixent sur les extracteurs ; on commence avec
 * un gisement révélé, puis on paie pour prospecter d'autres zones »).
 *
 * Le plan est découpé en CASES (la taille d'une pièce) et en ZONES carrées de
 * `PLANETE.zone` cases de côté, rangées en anneaux autour de celle du robot.
 * Chaque zone porte un GISEMENT (une tache de cases, d'une quantité de
 * minerai) ou rien. Tout est tiré d'une graine : la même graine, la même
 * planète. La partie, elle, ne garde que ce qui change : les zones révélées et
 * ce qui reste dans chaque gisement (`moteur.ts`).
 */
import { PLANETE } from './donnees.ts'
import { graineDe, rngDe } from '../rng.ts'

/** Une case du plan, par ses indices (la case (0, 0) est centrée sur l'origine). */
export interface Cellule {
  i: number
  j: number
}

export interface Gisement {
  id: number
  zone: number
  cellules: Cellule[]
  /** Ce que la veine donne au plus, en minerai par heure, quel que soit l'extracteur posé dessus. */
  debit: number
  /** La quantité de minerai au départ. */
  quantite: number
}

export interface Zone {
  id: number
  /** Ses coordonnées en zones ; (0, 0) est celle du robot. */
  a: number
  b: number
  /** Sa distance à celle du robot, en zones (la plus grande des deux). */
  anneau: number
  gisement: number | null
}

export interface Planete {
  zones: Zone[]
  gisements: Gisement[]
}

const cle = (a: number, b: number): string => `${a},${b}`

/** La zone qui contient une case. La zone (0, 0) couvre les cases de −3 à 4 : le robot en (0, 0), sa veine de départ dessous, de la place au-dessus pour les modules qui naissent. */
export function zoneDeCellule(c: Cellule): { a: number; b: number } {
  const z = PLANETE.zone
  return { a: Math.floor((c.i + z / 2 - 1) / z), b: Math.floor((c.j + z / 2 - 1) / z) }
}

/** La première case (en haut à gauche) d'une zone ; la zone couvre `PLANETE.zone` cases à partir d'elle. */
export function origineDeZone(a: number, b: number): Cellule {
  const z = PLANETE.zone
  return { i: a * z - z / 2 + 1, j: b * z - z / 2 + 1 }
}

/** La tache de cases d'un gisement d'un anneau : des barres horizontales d'au moins trois cases (un extracteur en prend trois), empilées. */
function tache(zone: { a: number; b: number }, anneau: number, rng: () => number): Cellule[] {
  const z = PLANETE.zone
  const max = z - 2
  const hauteur = Math.min(max, 1 + anneau + Math.floor(rng() * 2))
  const largeur = Math.min(max, 4 + anneau + Math.floor(rng() * 2))
  const o = origineDeZone(zone.a, zone.b)
  const ox = o.i + 1 + Math.floor(rng() * (max - largeur + 1))
  const oy = o.j + 1 + Math.floor(rng() * (max - hauteur + 1))
  const cellules: Cellule[] = []
  for (let r = 0; r < hauteur; r++) {
    const longueur = Math.max(3, largeur - Math.floor(rng() * 3))
    const decalage = Math.floor(rng() * (largeur - longueur + 1))
    for (let k = 0; k < longueur; k++) cellules.push({ i: ox + decalage + k, j: oy + r })
  }
  return cellules
}

/** Le gisement de départ : sous le robot (deux rangées plus bas, hors de la place de ses modules), deux rangées de six cases, de quoi poser un extracteur avant d'aller voir ailleurs. */
function tacheDeDepart(): Cellule[] {
  const cellules: Cellule[] = []
  for (let j = 3; j <= 4; j++) for (let i = -3; i <= 2; i++) cellules.push({ i, j })
  return cellules
}

const cache = new Map<number, Planete>()

/** La planète d'une graine : toujours la même. */
export function engendrerPlanete(graine: number): Planete {
  const connue = cache.get(graine)
  if (connue !== undefined) return connue
  const rng = rngDe(graineDe(graine, 7919))
  const zones: Zone[] = []
  const gisements: Gisement[] = []
  const A = PLANETE.anneaux
  for (let b = -A; b <= A; b++) {
    for (let a = -A; a <= A; a++) {
      const anneau = Math.max(Math.abs(a), Math.abs(b))
      const zone: Zone = { id: zones.length, a, b, anneau, gisement: null }
      if (anneau === 0) {
        zone.gisement = gisements.length
        gisements.push({ id: gisements.length, zone: zone.id, cellules: tacheDeDepart(), debit: PLANETE.depart.debit, quantite: PLANETE.depart.quantite })
      } else if (rng() >= PLANETE.sterile) {
        const d = PLANETE.debit
        const debit = Math.round(d.premier * Math.pow(d.croissance, anneau - 1) * Math.pow(d.ecart, 2 * rng() - 1))
        const quantite = Math.round(debit * PLANETE.duree.heures * Math.pow(PLANETE.duree.ecart, 2 * rng() - 1))
        zone.gisement = gisements.length
        gisements.push({ id: gisements.length, zone: zone.id, cellules: tache(zone, anneau, rng), debit, quantite })
      }
      zones.push(zone)
    }
  }
  const planete = { zones, gisements }
  cache.set(graine, planete)
  return planete
}

const index = new Map<Planete, Map<string, Zone>>()

/** La zone de coordonnées (a, b), ou rien hors de la planète. */
export function zoneEn(planete: Planete, a: number, b: number): Zone | undefined {
  let m = index.get(planete)
  if (m === undefined) {
    m = new Map(planete.zones.map((z) => [cle(z.a, z.b), z]))
    index.set(planete, m)
  }
  return m.get(cle(a, b))
}

const indexCellules = new Map<Planete, Map<string, number>>()

/** Le gisement qui contient une case, ou null. */
export function gisementEn(planete: Planete, c: Cellule): number | null {
  let m = indexCellules.get(planete)
  if (m === undefined) {
    m = new Map()
    for (const g of planete.gisements) for (const x of g.cellules) m.set(cle(x.i, x.j), g.id)
    indexCellules.set(planete, m)
  }
  return m.get(cle(c.i, c.j)) ?? null
}

/** Les quatre voisines d'une zone, dans la planète. */
export function voisines(planete: Planete, z: Zone): Zone[] {
  const out: Zone[] = []
  for (const [da, db] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const v = zoneEn(planete, z.a + da, z.b + db)
    if (v !== undefined) out.push(v)
  }
  return out
}

/** Le centre d'une zone, en cases (fractionnaire : la zone a un nombre pair de cases de côté). */
export function centreDeZone(z: Zone): { i: number; j: number } {
  const o = origineDeZone(z.a, z.b)
  return { i: o.i + (PLANETE.zone - 1) / 2, j: o.j + (PLANETE.zone - 1) / 2 }
}
