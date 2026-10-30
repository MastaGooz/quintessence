/**
 * LA CARTE : un plan infini qu'on fait glisser dans toutes les directions et
 * qu'on zoome comme une map (Keko, 30/10/2026). Au doigt on glisse pour se
 * déplacer et on pince pour zoomer ; à la souris, clic gauche enfoncé pour se
 * déplacer, molette pour zoomer. Un quadrillage dit l'espace, et `centrer`
 * ramène au zoom normal sur l'origine.
 *
 * Le monde est un plan en pixels-monde ; la vue est le point du monde qui est
 * au centre de l'écran, et le zoom. La couche HTML du monde (`monde`) est
 * déplacée et mise à l'échelle par un seul `transform` ; le quadrillage est
 * repeint sur un canvas de la taille de l'écran à chaque mouvement. Tout le
 * geste est impératif : un doigt qui glisse ne doit pas attendre un rendu.
 *
 * Le composant qui monte la carte pose ses éléments dans `monde`, en
 * pixels-monde, et dit ce qui se CLIQUE (`[data-cliquable]` : un doigt posé
 * puis relevé sans glisser) et ce qui se SAISIT (`[data-saisissable]` : le
 * doigt emporte l'élément au lieu de glisser la carte).
 */

export interface Point {
  x: number
  y: number
}

export interface Interactions {
  /** Un doigt posé puis relevé sans glisser sur un élément cliquable (ou dedans) ; (sx, sy) à l'écran. */
  onClic?: (cible: HTMLElement, sx: number, sy: number) => void
  /** Un doigt posé sur un élément saisissable : rendre vrai pour le saisir. `p` en pixels-monde. */
  onSaisir?: (cible: HTMLElement, p: Point) => boolean
  onTrainer?: (p: Point) => void
  onLacher?: (p: Point) => void
  /** Un second doigt pendant une saisie : la saisie s'annule (l'élément revient d'où il vient) et les deux doigts pincent. */
  onAnnuler?: () => void
}

export interface Carte {
  /** Ramène la vue au zoom normal, centrée sur l'origine, en glissant. */
  centrer(): void
  /** Dit ce que le zoom normal doit faire tenir à l'écran : un rayon autour de l'origine, et `bas` pixels-monde de plus sous lui. */
  cadrer(rayon: number, bas?: number): void
  versMonde(sx: number, sy: number): Point
  versEcran(wx: number, wy: number): Point
  detruire(): void
}

/** Au zoom normal, ce que l'on cadre prend cette part de l'écran. */
const PART_ECRAN = 0.92
/** Le zoom va d'un sixième au quadruple du normal. */
const ZOOM_MIN = 1 / 6
const ZOOM_MAX = 4
/** Un doigt qui bouge de plus que ça (en pixels d'écran) glisse : ce n'est plus un clic. */
const SEUIL_GLISSE = 10
/** La maille du quadrillage, en pixels-monde. */
const MAILLE = 50
/** Des lignes espacées de moins que ça (en pixels d'écran) ne se dessinent pas ; au-dessus elles apparaissent en fondu. */
const LIGNES_MIN = 22
const LIGNES_PLEINES = 56
/** L'opacité d'un niveau de maille au plus ; les niveaux se superposent, une ligne commune à trois niveaux est trois fois plus marquée. */
const ALPHA_MAILLE = 0.22
/** Le retour au centre, en millisecondes. */
const DUREE_CENTRER = 380

interface Vue {
  x: number
  y: number
  z: number
}

function mouvementReduit(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function monterCarte(el: HTMLElement, c: HTMLCanvasElement, m: HTMLElement, zoomVu: HTMLElement | null, cadrage: { rayon: number; bas: number }, inter: Interactions): Carte {
  const ctx = c.getContext('2d')
  let largeur = 1
  let hauteur = 1
  let normal = 1
  let cadre = { ...cadrage }
  const vue: Vue = { x: 0, y: 0, z: 1 }
  let image = 0
  let animation = 0

  const mesurer = (): void => {
    largeur = Math.max(1, el.clientWidth)
    hauteur = Math.max(1, el.clientHeight)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = Math.round(largeur * dpr)
    c.height = Math.round(hauteur * dpr)
    c.style.width = `${largeur}px`
    c.style.height = `${hauteur}px`
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Le zoom normal fait tenir le rayon cadré en largeur, et le rayon plus ce qu'il y a dessous en hauteur.
    normal = Math.min((largeur * PART_ECRAN) / (2 * cadre.rayon), (hauteur * PART_ECRAN) / (2 * cadre.rayon + cadre.bas))
  }

  /** Place le monde et repeint le quadrillage pour la vue courante. */
  const peindre = (): void => {
    image = 0
    const { x, y, z } = vue
    m.style.transform = `translate(${largeur / 2 - x * z}px, ${hauteur / 2 - y * z}px) scale(${z})`
    if (zoomVu !== null) zoomVu.textContent = `×${(z / normal).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
    if (ctx === null) return
    ctx.clearRect(0, 0, largeur, hauteur)
    // Le niveau le plus fin dont les lignes sont assez espacées, puis deux plus gros par-dessus.
    let pas = MAILLE
    while (pas * z < LIGNES_MIN) pas *= 2
    while ((pas / 2) * z >= LIGNES_MIN && pas > MAILLE / 4) pas /= 2
    const gauche = x - largeur / 2 / z
    const droite = x + largeur / 2 / z
    const haut = y - hauteur / 2 / z
    const bas = y + hauteur / 2 / z
    ctx.lineWidth = 1
    for (let niveau = 0; niveau < 3; niveau++, pas *= 2) {
      const s = pas * z
      const alpha = Math.min(ALPHA_MAILLE, ((s - LIGNES_MIN) / (LIGNES_PLEINES - LIGNES_MIN)) * ALPHA_MAILLE)
      if (alpha <= 0) continue
      ctx.strokeStyle = `rgba(255, 246, 226, ${alpha.toFixed(3)})`
      ctx.beginPath()
      for (let wx = Math.floor(gauche / pas) * pas; wx <= droite; wx += pas) {
        const sx = Math.round((wx - x) * z + largeur / 2) + 0.5
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, hauteur)
      }
      for (let wy = Math.floor(haut / pas) * pas; wy <= bas; wy += pas) {
        const sy = Math.round((wy - y) * z + hauteur / 2) + 0.5
        ctx.moveTo(0, sy)
        ctx.lineTo(largeur, sy)
      }
      ctx.stroke()
    }
  }
  const demander = (): void => {
    if (image === 0) image = requestAnimationFrame(peindre)
  }
  const borner = (z: number): number => Math.min(normal * ZOOM_MAX, Math.max(normal * ZOOM_MIN, z))
  const versMonde = (sx: number, sy: number): Point => ({ x: vue.x + (sx - largeur / 2) / vue.z, y: vue.y + (sy - hauteur / 2) / vue.z })
  const versEcran = (wx: number, wy: number): Point => ({ x: (wx - vue.x) * vue.z + largeur / 2, y: (wy - vue.y) * vue.z + hauteur / 2 })

  /** Passe au zoom `z2` en gardant le point du monde qui est sous l'écran (sx, sy) sous (sx2, sy2). */
  const recadrer = (z2: number, sx: number, sy: number, sx2 = sx, sy2 = sy): void => {
    const p = versMonde(sx, sy)
    vue.z = z2
    vue.x = p.x - (sx2 - largeur / 2) / z2
    vue.y = p.y - (sy2 - hauteur / 2) / z2
    demander()
  }
  const arreterLAnimation = (): void => {
    cancelAnimationFrame(animation)
    animation = 0
  }

  // LES DOIGTS (et la souris) : un seul glisse, deux pincent ; un doigt posé sur une cible et relevé sans bouger clique ; un doigt posé sur une chose saisissable l'emporte.
  const doigts = new Map<number, Point>()
  let geste: { depart: Point; bouge: boolean; cible: HTMLElement | null } | null = null
  let saisi = false
  const relacher = (): void => geste?.cible?.classList.remove('enfonce')
  const rect = (): DOMRect => el.getBoundingClientRect()

  const bas = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = e.target as Element
    if (t.closest('.carte-hud') !== null) return
    if (saisi) {
      // Un second doigt pendant une saisie : on voulait pincer, pas emporter. La saisie s'annule, les deux doigts pincent.
      saisi = false
      inter.onAnnuler?.()
      geste = null
    }
    arreterLAnimation()
    const r = rect()
    const sx = e.clientX - r.left
    const sy = e.clientY - r.top
    if (doigts.size === 0) {
      const saisissable = t.closest<HTMLElement>('[data-saisissable]')
      if (saisissable !== null && inter.onSaisir?.(saisissable, versMonde(sx, sy)) === true) {
        saisi = true
        el.setPointerCapture(e.pointerId)
        doigts.set(e.pointerId, { x: sx, y: sy })
        return
      }
    }
    el.setPointerCapture(e.pointerId)
    doigts.set(e.pointerId, { x: sx, y: sy })
    if (doigts.size === 1) {
      const cible = t.closest<HTMLElement>('[data-cliquable]')
      geste = { depart: { x: sx, y: sy }, bouge: false, cible }
      cible?.classList.add('enfonce')
    } else {
      // Un second doigt : ce n'est plus un clic.
      if (geste !== null) geste.bouge = true
      relacher()
    }
  }
  const mouvement = (e: PointerEvent): void => {
    const avant = doigts.get(e.pointerId)
    if (avant === undefined) return
    const r = rect()
    const apres = { x: e.clientX - r.left, y: e.clientY - r.top }
    doigts.set(e.pointerId, apres)
    if (saisi) {
      inter.onTrainer?.(versMonde(apres.x, apres.y))
      return
    }
    if (doigts.size === 1 && geste !== null) {
      if (!geste.bouge && Math.hypot(apres.x - geste.depart.x, apres.y - geste.depart.y) > SEUIL_GLISSE) {
        geste.bouge = true
        relacher()
        el.classList.add('carte-glisse')
      }
      if (geste.bouge) {
        vue.x -= (apres.x - avant.x) / vue.z
        vue.y -= (apres.y - avant.y) / vue.z
        demander()
      }
    } else if (doigts.size === 2) {
      let autre: Point | undefined
      for (const [id, p] of doigts) if (id !== e.pointerId) autre = p
      if (autre !== undefined) {
        // Le point du monde sous le milieu des deux doigts reste sous ce milieu.
        const dAvant = Math.hypot(avant.x - autre.x, avant.y - autre.y)
        const dApres = Math.hypot(apres.x - autre.x, apres.y - autre.y)
        const z2 = dAvant > 0 ? borner((vue.z * dApres) / dAvant) : vue.z
        recadrer(z2, (avant.x + autre.x) / 2, (avant.y + autre.y) / 2, (apres.x + autre.x) / 2, (apres.y + autre.y) / 2)
      }
    }
  }
  const haut = (e: PointerEvent): void => {
    const p = doigts.get(e.pointerId)
    if (p === undefined) return
    doigts.delete(e.pointerId)
    if (saisi) {
      if (doigts.size === 0) {
        saisi = false
        inter.onLacher?.(versMonde(p.x, p.y))
      }
      return
    }
    if (doigts.size === 0) {
      el.classList.remove('carte-glisse')
      if (geste !== null && !geste.bouge && geste.cible !== null && e.type === 'pointerup') inter.onClic?.(geste.cible, e.clientX, e.clientY)
      relacher()
      geste = null
    } else if (geste !== null) geste.bouge = true // Après un pincement, le doigt qui reste glisse.
  }
  const molette = (e: WheelEvent): void => {
    e.preventDefault()
    arreterLAnimation()
    const r = rect()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * hauteur : e.deltaY
    recadrer(borner(vue.z * Math.exp(-delta * 0.0015)), e.clientX - r.left, e.clientY - r.top)
  }
  const menu = (e: Event): void => e.preventDefault()

  /** La vue normale : le zoom normal, l'origine en haut du cadre et ce qu'il y a dessous visible. */
  const vueNormale = (): Vue => ({ x: 0, y: cadre.bas / 2, z: normal })

  /** Ramène la vue normale, en glissant. */
  const centrer = (): void => {
    arreterLAnimation()
    const depart: Vue = { ...vue }
    const arrivee = vueNormale()
    const t0 = performance.now()
    const duree = mouvementReduit() ? 0 : DUREE_CENTRER
    const pas = (t: number): void => {
      const u = duree === 0 ? 1 : Math.min(1, (t - t0) / duree)
      const e = 1 - Math.pow(1 - u, 3)
      vue.x = depart.x + (arrivee.x - depart.x) * e
      vue.y = depart.y + (arrivee.y - depart.y) * e
      // Le zoom s'interpole en logarithme : à mi-chemin, la moitié du grossissement.
      vue.z = depart.z * Math.pow(arrivee.z / depart.z, e)
      demander()
      animation = u < 1 ? requestAnimationFrame(pas) : 0
    }
    animation = requestAnimationFrame(pas)
  }

  mesurer()
  Object.assign(vue, vueNormale())
  peindre()
  const observateur = new ResizeObserver(() => {
    mesurer()
    demander()
  })
  observateur.observe(el)
  el.addEventListener('pointerdown', bas)
  el.addEventListener('pointermove', mouvement)
  el.addEventListener('pointerup', haut)
  el.addEventListener('pointercancel', haut)
  el.addEventListener('wheel', molette, { passive: false })
  el.addEventListener('contextmenu', menu)

  return {
    centrer,
    cadrer(rayonNeuf, basNeuf = 0) {
      const avant = vueNormale()
      const etaitNormale = Math.abs(vue.z - avant.z) < 1e-6 && Math.abs(vue.x - avant.x) < 1 && Math.abs(vue.y - avant.y) < 1
      cadre = { rayon: rayonNeuf, bas: basNeuf }
      mesurer()
      if (etaitNormale) centrer()
      else demander()
    },
    versMonde,
    versEcran,
    detruire() {
      observateur.disconnect()
      cancelAnimationFrame(image)
      cancelAnimationFrame(animation)
      el.removeEventListener('pointerdown', bas)
      el.removeEventListener('pointermove', mouvement)
      el.removeEventListener('pointerup', haut)
      el.removeEventListener('pointercancel', haut)
      el.removeEventListener('wheel', molette)
      el.removeEventListener('contextmenu', menu)
    },
  }
}
