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
  /** Un doigt posé puis relevé sans glisser : sur un élément cliquable (ou dedans), ou dans le vide (`cible` null) ; (sx, sy) à l'écran. */
  onClic?: (cible: HTMLElement | null, sx: number, sy: number) => void
  /** Un doigt posé sur un élément saisissable : rendre vrai pour le saisir. `p` en pixels-monde. */
  onSaisir?: (cible: HTMLElement, p: Point) => boolean
  onTrainer?: (p: Point) => void
  /** Le doigt se relève ; `bouge` dit s'il a glissé depuis la saisie (sinon, c'était une tape sur l'élément). */
  onLacher?: (p: Point, bouge: boolean) => void
  /** Un second doigt pendant une saisie : la saisie s'annule (l'élément revient d'où il vient) et les deux doigts pincent. */
  onAnnuler?: () => void
}

export interface Carte {
  /** Ramène la vue au zoom normal, centrée sur l'origine, en glissant. */
  centrer(): void
  /** Glisse jusqu'à ce point du monde, au zoom normal : il se place au centre de l'écran, moins `dessous` pixels-monde laissés sous lui (la place des commandes). */
  viser(wx: number, wy: number, dessous?: number): void
  /** Dit ce que le zoom normal doit faire tenir à l'écran : un rayon autour de l'origine, et `bas` pixels-monde de plus sous lui ; le zoom normal ne descend pas sous `zoomMin`. */
  cadrer(rayon: number, bas?: number, zoomMin?: number): void
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
/** La maille du quadrillage, en pixels-monde : la case du jeu, centrée sur l'origine (les lignes passent à une demi-case des multiples). */
const MAILLE = 150
const DECALAGE = MAILLE / 2
/** Pendant une saisie, un doigt à moins de ça du bord (en pixels d'écran) fait glisser la carte, à cette vitesse au plus (pixels d'écran par seconde). */
const BORD = 48
const DERIVE = 900
/** Des lignes espacées de moins que ça (en pixels d'écran) ne se dessinent pas ; au-dessus elles apparaissent en fondu. */
const LIGNES_MIN = 22
const LIGNES_PLEINES = 56
/** L'opacité d'un niveau de maille au plus ; les niveaux se superposent, une ligne commune à trois niveaux est trois fois plus marquée. */
const ALPHA_MAILLE = 0.22
/** Un glissement de la vue (le retour au centre, la visée d'une pièce), en millisecondes. */
export const DUREE_GLISSE = 380

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

export interface Cadrage {
  rayon: number
  bas: number
  /** Le zoom normal ne descend pas sous ça, quitte à ne pas tout faire tenir : ce qu'on tape doit rester assez gros. */
  zoomMin?: number
}

export function monterCarte(el: HTMLElement, c: HTMLCanvasElement, m: HTMLElement, zoomVu: HTMLElement | null, cadrage: Cadrage, inter: Interactions): Carte {
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
    normal = Math.max(cadre.zoomMin ?? 0, Math.min((largeur * PART_ECRAN) / (2 * cadre.rayon), (hauteur * PART_ECRAN) / (2 * cadre.rayon + cadre.bas)))
  }

  /** Place le monde et repeint le quadrillage pour la vue courante. */
  const peindre = (): void => {
    image = 0
    const { x, y, z } = vue
    m.style.transform = `translate(${largeur / 2 - x * z}px, ${hauteur / 2 - y * z}px) scale(${z})`
    // Le zoom en variable CSS : ce qui doit garder sa taille à l'écran (une bulle) se met à l'échelle inverse.
    m.style.setProperty('--zoom', z.toFixed(4))
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
      for (let wx = Math.floor((gauche + DECALAGE) / pas) * pas - DECALAGE; wx <= droite; wx += pas) {
        const sx = Math.round((wx - x) * z + largeur / 2) + 0.5
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, hauteur)
      }
      for (let wy = Math.floor((haut + DECALAGE) / pas) * pas - DECALAGE; wy <= bas; wy += pas) {
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
  // LES DOIGTS (et la souris) : un seul glisse, deux pincent ; un doigt posé sur une cible et relevé sans bouger clique ; un doigt posé sur une chose saisissable l'emporte.
  const doigts = new Map<number, Point>()
  let geste: { depart: Point; bouge: boolean; cible: HTMLElement | null } | null = null
  let saisi = false
  let saisie = { depart: { x: 0, y: 0 }, bouge: false }
  const relacher = (): void => geste?.cible?.classList.remove('enfonce')
  const rect = (): DOMRect => el.getBoundingClientRect()

  // LA DÉRIVE : pendant une saisie, le doigt près du bord fait glisser la carte sous la pièce, pour l'emporter plus loin que l'écran.
  let derive = 0
  let doigtTenu: Point | null = null
  let dernierPas = 0
  /** La vitesse de dérive (de −1 à 1 sur chaque axe) pour un doigt à cet endroit de l'écran : nulle loin des bords, pleine au bord. */
  const vitesse = (p: Point): Point => {
    const vers = (v: number, taille: number): number => (v < BORD ? -(BORD - v) / BORD : v > taille - BORD ? (v - (taille - BORD)) / BORD : 0)
    return { x: Math.max(-1, Math.min(1, vers(p.x, largeur))), y: Math.max(-1, Math.min(1, vers(p.y, hauteur))) }
  }
  const arreterLaDerive = (): void => {
    cancelAnimationFrame(derive)
    derive = 0
    doigtTenu = null
  }
  const deriver = (t: number): void => {
    if (!saisi || doigtTenu === null) {
      derive = 0
      return
    }
    const dt = Math.min(0.05, (t - dernierPas) / 1000)
    dernierPas = t
    const v = vitesse(doigtTenu)
    if (v.x === 0 && v.y === 0) {
      derive = 0
      return
    }
    vue.x += (v.x * DERIVE * dt) / vue.z
    vue.y += (v.y * DERIVE * dt) / vue.z
    demander()
    inter.onTrainer?.(versMonde(doigtTenu.x, doigtTenu.y))
    derive = requestAnimationFrame(deriver)
  }

  const bas = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = e.target as Element
    // Les commandes et ce qui se dit hors carte (`data-hud`) gardent leurs clics ordinaires.
    if (t.closest('.carte-hud, [data-hud]') !== null) return
    if (saisi) {
      // Un second doigt pendant une saisie : on voulait pincer, pas emporter. La saisie s'annule, les deux doigts pincent.
      saisi = false
      arreterLaDerive()
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
        saisie = { depart: { x: sx, y: sy }, bouge: false }
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
      if (!saisie.bouge && Math.hypot(apres.x - saisie.depart.x, apres.y - saisie.depart.y) > SEUIL_GLISSE) saisie.bouge = true
      inter.onTrainer?.(versMonde(apres.x, apres.y))
      doigtTenu = apres
      const v = vitesse(apres)
      if ((v.x !== 0 || v.y !== 0) && derive === 0 && saisie.bouge) {
        dernierPas = performance.now()
        derive = requestAnimationFrame(deriver)
      }
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
        arreterLaDerive()
        inter.onLacher?.(versMonde(p.x, p.y), saisie.bouge)
      }
      return
    }
    if (doigts.size === 0) {
      el.classList.remove('carte-glisse')
      if (geste !== null && !geste.bouge && e.type === 'pointerup') inter.onClic?.(geste.cible, e.clientX, e.clientY)
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
  /** La vue qui met un point du monde au centre, `dessous` pixels-monde réservés sous lui, au zoom normal. */
  const vueSur = (wx: number, wy: number, dessous: number): Vue => ({ x: wx, y: wy + dessous / 2, z: normal })
  const memeVue = (a: Vue, b: Vue): boolean => Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1

  /** Où va le glissement en cours, s'il y en a un : un recadrage pendant le trajet garde la destination. */
  let but: { vue: Vue; visee: { wx: number; wy: number; dessous: number } | null } | null = null
  const arreterLAnimation = (): void => {
    cancelAnimationFrame(animation)
    animation = 0
    but = null
  }

  /** Glisse jusqu'à cette vue. */
  const glisser = (arrivee: Vue, visee: { wx: number; wy: number; dessous: number } | null): void => {
    arreterLAnimation()
    but = { vue: arrivee, visee }
    const depart: Vue = { ...vue }
    const t0 = performance.now()
    const duree = mouvementReduit() ? 0 : DUREE_GLISSE
    const pas = (t: number): void => {
      const u = duree === 0 ? 1 : Math.min(1, (t - t0) / duree)
      const e = 1 - Math.pow(1 - u, 3)
      vue.x = depart.x + (arrivee.x - depart.x) * e
      vue.y = depart.y + (arrivee.y - depart.y) * e
      // Le zoom s'interpole en logarithme : à mi-chemin, la moitié du grossissement.
      vue.z = depart.z * Math.pow(arrivee.z / depart.z, e)
      demander()
      if (u < 1) animation = requestAnimationFrame(pas)
      else {
        animation = 0
        but = null
      }
    }
    animation = requestAnimationFrame(pas)
  }

  /** Ramène la vue normale, en glissant. */
  const centrer = (): void => glisser(vueNormale(), null)
  /** Glisse jusqu'à un point du monde (Keko, 31/10 : « quand un nouveau module est créé, focus dessus au lieu de ramener au centre »). */
  const viser = (wx: number, wy: number, dessous = 0): void => glisser(vueSur(wx, wy, dessous), { wx, wy, dessous })

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
    viser,
    cadrer(rayonNeuf, basNeuf = 0, zoomMin) {
      // Ce qui compte, c'est où la vue EST, ou où elle VA : une pièce qui vient de naître a lancé sa visée avant que l'installation grandie ne recadre.
      const visee = but?.visee ?? null
      const etaitNormale = memeVue(but?.vue ?? vue, vueNormale())
      cadre = { rayon: rayonNeuf, bas: basNeuf, zoomMin }
      mesurer()
      if (visee !== null) viser(visee.wx, visee.wy, visee.dessous)
      else if (etaitNormale) centrer()
      else demander()
    },
    versMonde,
    versEcran,
    detruire() {
      observateur.disconnect()
      cancelAnimationFrame(image)
      cancelAnimationFrame(animation)
      arreterLaDerive()
      el.removeEventListener('pointerdown', bas)
      el.removeEventListener('pointermove', mouvement)
      el.removeEventListener('pointerup', haut)
      el.removeEventListener('pointercancel', haut)
      el.removeEventListener('wheel', molette)
      el.removeEventListener('contextmenu', menu)
    },
  }
}
