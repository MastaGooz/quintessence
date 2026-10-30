/**
 * LA CARTE — un test visuel demandé par Keko (30/10/2026) : « un écran qu'on
 * peut faire défiler dans toutes les directions et zoomer/dézoomer (comme une
 * map) avec le bouton clic au centre (et très vaste), avec un bouton centrer
 * qui ramène dans le zoom normal / position centrée sur le bouton clic ».
 * Au doigt on glisse pour se déplacer et on pince pour zoomer ; à la souris,
 * clic gauche enfoncé pour se déplacer, molette pour zoomer. Un quadrillage
 * dit l'espace. **Rien du jeu n'y est branché** : le bouton compte ses clics.
 *
 * Le monde est un plan en pixels-monde ; la vue est le point du monde qui est
 * au centre de l'écran, et le zoom. La couche HTML du monde est déplacée et
 * mise à l'échelle par un seul `transform` ; le quadrillage est repeint sur
 * un canvas de la taille de l'écran à chaque mouvement. Tout le geste est
 * impératif (des refs, pas d'état React) : un doigt qui glisse ne doit pas
 * attendre un rendu.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { vibrer } from '../../ui/haptique.ts'
import { sonTape } from '../../ui/sons.ts'
import { eclater, flotter, monterCouche, mouvementReduit } from '../effets.ts'

/** Le rayon du bouton, en pixels-monde. */
const RAYON = 200
/** La maille du quadrillage, en pixels-monde : le bouton en couvre huit. */
const MAILLE = 50
/** Au zoom normal, le bouton prend cette part du petit côté de l'écran. */
const PART_ECRAN = 0.7
/** Le zoom va d'un sixième au quadruple du normal. */
const ZOOM_MIN = 1 / 6
const ZOOM_MAX = 4
/** Un doigt qui bouge de plus que ça (en pixels d'écran) glisse : ce n'est plus un clic. */
const SEUIL_GLISSE = 10
/** Des lignes espacées de moins que ça (en pixels d'écran) ne se dessinent pas ; au-dessus elles apparaissent en fondu. */
const LIGNES_MIN = 22
const LIGNES_PLEINES = 56
/** L'opacité d'un niveau de maille au plus ; les niveaux se superposent, une ligne commune à trois niveaux est trois fois plus marquée. */
const ALPHA_MAILLE = 0.22
/** Le retour au centre, en millisecondes. */
const DUREE_CENTRER = 380

/** Le bouton s'écrase puis rebondit à chaque clic. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.93)' }, { transform: 'scale(1.04)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux clics à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450

interface Vue {
  x: number
  y: number
  z: number
}
interface Point {
  x: number
  y: number
}

function zoomNormal(largeur: number, hauteur: number): number {
  return (Math.min(largeur, hauteur) * PART_ECRAN) / (2 * RAYON)
}

export function Carte(): ReactElement {
  const cadre = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const monde = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLDivElement>(null)
  const zoomVu = useRef<HTMLSpanElement>(null)
  const centrer = useRef<() => void>(() => undefined)
  const cliquer = useRef<(x: number, y: number) => void>(() => undefined)
  const [clics, setClics] = useState(0)

  useEffect(() => {
    const el = cadre.current
    const c = toile.current
    const m = monde.current
    const b = bouton.current
    if (el === null || c === null || m === null || b === null) return
    const ctx = c.getContext('2d')
    let largeur = 1
    let hauteur = 1
    let normal = 1
    const vue: Vue = { x: 0, y: 0, z: 1 }
    let image = 0
    let animation = 0
    let serie = { n: 0, t: 0 }

    const mesurer = (): void => {
      largeur = Math.max(1, el.clientWidth)
      hauteur = Math.max(1, el.clientHeight)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(largeur * dpr)
      c.height = Math.round(hauteur * dpr)
      c.style.width = `${largeur}px`
      c.style.height = `${hauteur}px`
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
      normal = zoomNormal(largeur, hauteur)
    }

    /** Place le monde et repeint le quadrillage pour la vue courante. */
    const peindre = (): void => {
      image = 0
      const { x, y, z } = vue
      m.style.transform = `translate(${largeur / 2 - x * z}px, ${hauteur / 2 - y * z}px) scale(${z})`
      if (zoomVu.current !== null) zoomVu.current.textContent = `×${(z / normal).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
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

    /** Passe au zoom `z2` en gardant le point du monde qui est sous l'écran (sx, sy) sous (sx2, sy2). */
    const recadrer = (z2: number, sx: number, sy: number, sx2 = sx, sy2 = sy): void => {
      const px = vue.x + (sx - largeur / 2) / vue.z
      const py = vue.y + (sy - hauteur / 2) / vue.z
      vue.z = z2
      vue.x = px - (sx2 - largeur / 2) / z2
      vue.y = py - (sy2 - hauteur / 2) / z2
      demander()
    }
    const arreterLAnimation = (): void => {
      cancelAnimationFrame(animation)
      animation = 0
    }

    // LES DOIGTS (et la souris) : un seul glisse, deux pincent ; un doigt posé sur le bouton et relevé sans bouger clique.
    const doigts = new Map<number, Point>()
    let geste: { depart: Point; bouge: boolean; surBouton: boolean } | null = null
    const relacher = (): void => b.classList.remove('enfonce')

    const bas = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element).closest('.carte-hud') !== null) return
      arreterLAnimation()
      el.setPointerCapture(e.pointerId)
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (doigts.size === 1) {
        const surBouton = (e.target as Element).closest('.carte-bouton') !== null
        geste = { depart: { x: e.clientX, y: e.clientY }, bouge: false, surBouton }
        if (surBouton) b.classList.add('enfonce')
      } else {
        // Un second doigt : ce n'est plus un clic.
        if (geste !== null) geste.bouge = true
        relacher()
      }
    }
    const mouvement = (e: PointerEvent): void => {
      const avant = doigts.get(e.pointerId)
      if (avant === undefined) return
      const apres = { x: e.clientX, y: e.clientY }
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
      doigts.set(e.pointerId, apres)
    }
    const haut = (e: PointerEvent): void => {
      if (!doigts.has(e.pointerId)) return
      doigts.delete(e.pointerId)
      if (doigts.size === 0) {
        el.classList.remove('carte-glisse')
        if (geste !== null && !geste.bouge && geste.surBouton && e.type === 'pointerup') cliquer.current(e.clientX, e.clientY)
        geste = null
        relacher()
      } else if (geste !== null) geste.bouge = true // Après un pincement, le doigt qui reste glisse.
    }
    const molette = (e: WheelEvent): void => {
      e.preventDefault()
      arreterLAnimation()
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * hauteur : e.deltaY
      recadrer(borner(vue.z * Math.exp(-delta * 0.0015)), e.clientX, e.clientY)
    }
    const menu = (e: Event): void => e.preventDefault()

    cliquer.current = (x, y) => {
      const maintenant = performance.now()
      serie = { n: maintenant - serie.t < SERIE_MS ? serie.n + 1 : 0, t: maintenant }
      setClics((n) => n + 1)
      sonTape(serie.n)
      vibrer(8)
      if (!mouvementReduit()) b.animate(ECRASER, { duration: 170, easing: 'ease-out' })
      flotter(x, y, '+1', 'flottant-or', Math.min(1.7, 1 + serie.n * 0.05))
      if (serie.n > 0 && serie.n % 10 === 9) eclater(x, y, 14)
      else if (Math.random() < 0.3) eclater(x, y, 3)
    }

    /** Ramène la vue au zoom normal, centrée sur le bouton, en glissant. */
    centrer.current = () => {
      arreterLAnimation()
      const depart: Vue = { ...vue }
      const arrivee: Vue = { x: 0, y: 0, z: normal }
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
    vue.z = normal
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
    return () => {
      observateur.disconnect()
      cancelAnimationFrame(image)
      cancelAnimationFrame(animation)
      el.removeEventListener('pointerdown', bas)
      el.removeEventListener('pointermove', mouvement)
      el.removeEventListener('pointerup', haut)
      el.removeEventListener('pointercancel', haut)
      el.removeEventListener('wheel', molette)
      el.removeEventListener('contextmenu', menu)
    }
  }, [])

  return (
    <div className="carte" ref={cadre}>
      <canvas className="carte-quadrillage" ref={toile} aria-hidden />
      <div className="carte-monde" ref={monde}>
        <div
          className="carte-bouton"
          ref={bouton}
          role="button"
          tabIndex={0}
          style={{ left: -RAYON, top: -RAYON, width: 2 * RAYON, height: 2 * RAYON }}
          onKeyDown={(e) => {
            // Le clavier n'a pas de doigt : Entrée ou Espace cliquent au centre du bouton.
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              const r = e.currentTarget.getBoundingClientRect()
              cliquer.current(r.left + r.width / 2, r.top + r.height / 2)
            }
          }}
        >
          <b>{clics.toLocaleString('fr-FR')}</b>
          <small>{clics === 1 ? 'clic' : 'clics'}</small>
        </div>
      </div>
      <div className="effets" ref={monterCouche} aria-hidden />
      <div className="carte-hud">
        <span className="carte-zoom" ref={zoomVu}>
          ×1,0
        </span>
        <button type="button" className="bouton-principal carte-centrer" onClick={() => centrer.current()}>
          Centrer
        </button>
        <span className="carte-build sourd petit">Build {__DATE_DU_BUILD__}</span>
      </div>
    </div>
  )
}
