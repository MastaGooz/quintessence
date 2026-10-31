/**
 * LA CARTE : la page principale du proto. Un plan qu'on fait glisser et qu'on
 * zoome ; dessus, les PRODUCTEURS, des rectangles creusés de prises, et les
 * MODULES, des pièces à une bosse qui s'y emboîtent (Keko, 31/10 : « les
 * producteurs génèrent des ressources, avec des prises femelles, et les
 * modules, de différentes formes de prises mâles ; les modules agissent sur le
 * producteur »). La base est le premier producteur, au centre : une tape dessus
 * produit. Un producteur acheté apparaît dessous, un module aussi ; on glisse
 * le module, un aimant le pose sur un creux libre de sa forme ; on tire un
 * producteur pour le ranger ailleurs, ses modules suivent. Une tape sur un
 * producteur le déclenche ; une tape sur un module ouvre sa bulle : son niveau,
 * et le bouton pour le monter.
 *
 * Le glisser est impératif (la pièce suit le doigt sans rendu React) ; le
 * moteur n'est touché qu'au lâcher. Entre les deux, un rendu peut survenir
 * (la seconde qui passe) : il lit `traine` pour laisser la pièce sous le doigt.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { MODULE, MODULES, PIECE, PRODUCTEUR, PRODUCTEURS, TAPES_MAX_PAR_S } from '../../logic/clic/donnees.ts'
import {
  DIRECTIONS, ameliorer, bilan, bilanProducteur, boiteModule, branches, brancher, coutNiveau, debit, debrancher, declencher, deplacer, deplacerProducteur,
  disposition, effet, etendue, gainVente, moduleDe, modulesDe, multiplicateurPrestige, peutAmeliorer, placeSurProducteur, prisesPour, producteurDe,
  producteurTient, vendre, type Module, type Place, type Prise, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import { LETTRE_PRODUCTEUR, NOM_AUTO, NOM_BASE, NOM_MODULE, NOM_PRODUCTEUR, NOM_R } from '../../ui/noms-clic.ts'
import { sonBatir, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { monterCarte, type Carte, type Point } from '../carte/carte.ts'
import { eclater, effetDepense, effetVente, flotter, mouvementReduit } from '../effets.ts'
import { Boutique } from './Boutique.tsx'
import { boite, cheminDecoupe, cotesDuModule, cotesDuProducteur } from './pieces.ts'
import type { PagePropsClic } from './props.ts'
import { abregeFin, texteEffet } from './texte.ts'

/** La portée de l'aimant : à moins de ça d'un creux libre de sa forme (en pixels-monde), le module s'y pose. */
const AIMANT = 120
/** Le zoom normal ne descend pas sous ça : une case fait au moins soixante pixels d'écran, on peut la taper. */
const ZOOM_MIN = 60 / PIECE.taille
/** Ce que la vue normale garde sous l'installation, en pixels-monde : la place des commandes. */
const DESSOUS_HUD = 320
/** Une teinte par module : horloge, ajout, multiplicateur, critique. En attendant l'habillage. */
const TEINTES: readonly number[] = [205, 130, 35, 320]
/** La pièce s'écrase puis rebondit, à chaque tape. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.96)' }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450
/** Une horloge plus rapide que ça ne fait plus flotter ses lots : la pulsation suffit. */
const FLOTTE_MIN_MS = 1500

const DEMI_L = MODULE.largeur / 2
const DEMI_P = MODULE.profondeur / 2
const BOITE_MODULE = boite(MODULE.largeur, MODULE.profondeur)
const BOITE_PRODUCTEUR = boite(PRODUCTEUR.largeur, PRODUCTEUR.hauteur)
/** Le chemin de chaque type de producteur, creusé de ses prises. */
const CHEMINS_PRODUCTEURS: readonly string[] = PRODUCTEURS.map((t) => cheminDecoupe(PRODUCTEUR.largeur, PRODUCTEUR.hauteur, cotesDuProducteur(t.creux)))
/** Le chemin de chaque module, sa bosse en bas (la rotation est en CSS, par `--sens`). */
const CHEMINS_MODULES: readonly string[] = MODULES.map((_, k) => cheminDecoupe(MODULE.largeur, MODULE.profondeur, cotesDuModule(k)))

const cle = (p: Prise): string => `${p.parent}:${p.emplacement}`

type Traine =
  | {
      genre: 'module'
      id: number
      /** Le décalage du doigt au centre de la pièce. */
      dx: number
      dy: number
      /** Le sens du module quand on l'a pris : hors aimant, il le garde. */
      sens: number
      /** Les creux où il peut aller. */
      candidats: Prise[]
      /** Celui que vise l'aimant. */
      prise: Prise | null
      /** Où il était, pour savoir au lâcher si quelque chose a changé. */
      avant: { parent: number | null; emplacement: number }
      /** Le centre de la pièce sous le doigt. */
      x: number
      y: number
    }
  | {
      genre: 'producteur'
      id: number
      dx: number
      dy: number
      x: number
      y: number
      /** Tiendrait-il là où il est ? */
      tient: boolean
    }

export function Base({ partie, agir, avecBarre }: PagePropsClic & { avecBarre: boolean }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const cadre = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const monde = useRef<HTMLDivElement>(null)
  const zoomVu = useRef<HTMLSpanElement>(null)
  const carte = useRef<Carte | null>(null)
  const producteursEl = useRef(new Map<number, HTMLElement>())
  const modulesEl = useRef(new Map<number, HTMLElement>())
  const prisesEl = useRef(new Map<string, HTMLElement>())
  const traine = useRef<Traine | null>(null)
  const agirRef = useRef(agir)
  agirRef.current = agir
  const [boutique, setBoutique] = useState(false)
  /** Le module dont la bulle est ouverte. */
  const [bulle, setBulle] = useState<number | null>(null)
  /** Ce qu'on tient : le rendu pose les creux candidats pendant qu'on tient un module. */
  const [, setEnMain] = useState<number | null>(null)
  const production = debit(j)
  const dispo = disposition(j)
  const branchees = branches(j)
  const rien = j.modules.length === 0 && j.producteurs.length === 1
  const debut = rien && j.points === 0 && j.or < 10
  const { rayon, bas } = etendue(j)

  /** Un point du monde, à l'écran (en coordonnées de la page, pour les effets). */
  const surLaPage = (p: Point): Point | null => {
    const k = carte.current
    const r = cadre.current?.getBoundingClientRect()
    if (k === null || r === undefined) return null
    const s = k.versEcran(p.x, p.y)
    return { x: r.left + s.x, y: r.top + s.y }
  }

  // LA TAPE sur un producteur : une série, et le plafond par seconde (contre les auto-clics).
  const serie = useRef({ n: 0, t: 0 })
  const recentes = useRef<number[]>([])
  const declencherIci = (p: Producteur, x: number, y: number): void => {
    const maintenant = performance.now()
    recentes.current = recentes.current.filter((t) => maintenant - t < 1000)
    if (recentes.current.length >= TAPES_MAX_PAR_S) return
    recentes.current.push(maintenant)
    serie.current = { n: maintenant - serie.current.t < SERIE_MS ? serie.current.n + 1 : 0, t: maintenant }
    const n = serie.current.n
    let coup = { gain: 0, critique: false }
    agirRef.current(() => {
      coup = declencher(j, p, Math.random())
    })
    sonTape(coup.critique ? n + 6 : n)
    vibrer(coup.critique ? [10, 30, 25] : 8)
    if (!mouvementReduit()) producteursEl.current.get(p.id)?.animate(ECRASER, { duration: 170, easing: 'ease-out' })
    flotter(x, y, `+${abregeFin(coup.gain)}${coup.critique ? ' !' : ''}`, 'flottant-or', coup.critique ? 2 : Math.min(1.7, 1 + n * 0.05))
    if (coup.critique) eclater(x, y, 22)
    else if (n > 0 && n % 10 === 9) eclater(x, y, 14)
    else if (Math.random() < 0.3) eclater(x, y, 3)
  }

  // LA SAISIE : la pièce suit le doigt ; un module près d'un creux libre de sa forme s'y aimante ; au lâcher, le moteur l'apprend.
  const placerModule = (id: number, p: Place): void => {
    const el = modulesEl.current.get(id)
    if (el === undefined) return
    el.style.left = `${p.x - DEMI_L}px`
    el.style.top = `${p.y - DEMI_P}px`
    el.style.setProperty('--sens', String(p.sens))
  }
  const placerProducteur = (p: Producteur, x: number, y: number): void => {
    const el = producteursEl.current.get(p.id)
    if (el !== undefined) {
      el.style.left = `${x - PRODUCTEUR.largeur / 2}px`
      el.style.top = `${y - PRODUCTEUR.hauteur / 2}px`
    }
    for (const mo of modulesDe(j, p)) placerModule(mo.id, placeSurProducteur({ x, y }, mo.emplacement))
  }
  const saisir = (cible: HTMLElement, p: Point): boolean => {
    // La carte garde cette fonction telle qu'elle était au montage : on relit le moteur, pas le rendu.
    const id = Number(cible.dataset['id'])
    if (cible.dataset['genre'] === 'module') {
      const mo = moduleDe(j, id)
      const pos = disposition(j).get(id)
      if (mo === undefined || pos === undefined) return false
      traine.current = {
        genre: 'module',
        id,
        dx: p.x - pos.x,
        dy: p.y - pos.y,
        sens: pos.sens,
        candidats: prisesPour(j, mo),
        prise: null,
        avant: { parent: mo.parent, emplacement: mo.emplacement },
        x: pos.x,
        y: pos.y,
      }
      cible.classList.add('module-saisi')
    } else {
      const pr = producteurDe(j, id)
      if (pr === undefined || pr.type === 0) return false
      traine.current = { genre: 'producteur', id, dx: p.x - pr.x, dy: p.y - pr.y, x: pr.x, y: pr.y, tient: true }
      cible.classList.add('producteur-saisi')
      for (const mo of modulesDe(j, pr)) modulesEl.current.get(mo.id)?.classList.add('module-saisi')
    }
    setEnMain(id)
    setBulle(null)
    vibrer(8)
    return true
  }
  const trainer = (p: Point): void => {
    const t = traine.current
    if (t === null) return
    t.x = p.x - t.dx
    t.y = p.y - t.dy
    if (t.genre === 'module') {
      // L'AIMANT : le creux candidat le plus proche, à portée.
      let visee: Prise | null = null
      let dmin = AIMANT
      for (const c of t.candidats) {
        const d = Math.hypot(c.place.x - t.x, c.place.y - t.y)
        if (d < dmin) {
          dmin = d
          visee = c
        }
      }
      if (visee !== t.prise) {
        if (t.prise !== null) prisesEl.current.get(cle(t.prise))?.classList.remove('prise-visee')
        if (visee !== null) {
          prisesEl.current.get(cle(visee))?.classList.add('prise-visee')
          vibrer(6)
        }
        t.prise = visee
      }
      modulesEl.current.get(t.id)?.classList.toggle('module-aimante', visee !== null)
      placerModule(t.id, visee !== null ? visee.place : { x: t.x, y: t.y, sens: t.sens })
    } else {
      const pr = producteurDe(j, t.id)
      if (pr === undefined) return
      const tient = producteurTient(j, pr, t.x, t.y)
      if (tient !== t.tient) {
        t.tient = tient
        producteursEl.current.get(t.id)?.classList.toggle('producteur-bloque', !tient)
        if (!tient) vibrer(6)
      }
      placerProducteur(pr, t.x, t.y)
    }
  }
  /** La fin d'une saisie, quelle qu'elle soit : les classes s'éteignent, les creux disparaissent. */
  const finir = (t: Traine): void => {
    traine.current = null
    if (t.genre === 'module') {
      modulesEl.current.get(t.id)?.classList.remove('module-saisi', 'module-aimante')
      if (t.prise !== null) prisesEl.current.get(cle(t.prise))?.classList.remove('prise-visee')
    } else {
      producteursEl.current.get(t.id)?.classList.remove('producteur-saisi', 'producteur-bloque')
      const pr = producteurDe(j, t.id)
      if (pr !== undefined) for (const mo of modulesDe(j, pr)) modulesEl.current.get(mo.id)?.classList.remove('module-saisi')
    }
    setEnMain(null)
  }
  /** La pièce revient là où le moteur la sait. */
  const remettre = (t: Traine): void => {
    if (t.genre === 'module') {
      const pos = disposition(j).get(t.id)
      if (pos !== undefined) placerModule(t.id, pos)
    } else {
      const pr = producteurDe(j, t.id)
      if (pr !== undefined) placerProducteur(pr, pr.x, pr.y)
    }
  }
  /** La saisie s'annule (un second doigt). */
  const annuler = (): void => {
    const t = traine.current
    if (t === null) return
    finir(t)
    remettre(t)
  }
  const lacher = (p: Point, bouge: boolean): void => {
    const t = traine.current
    if (t === null) return
    finir(t)
    if (t.genre === 'module') {
      const mo = moduleDe(j, t.id)
      if (mo === undefined) return
      if (!bouge) {
        // Une tape : le module reste où il est, et sa bulle s'ouvre.
        remettre(t)
        setBulle(mo.id)
        return
      }
      agirRef.current(() => {
        if (t.prise !== null) {
          if (!brancher(j, mo, t.prise.parent, t.prise.emplacement)) debrancher(mo, t.x, t.y, t.sens)
        } else if (mo.parent !== null) debrancher(mo, t.x, t.y, t.sens)
        else deplacer(mo, t.x, t.y)
      })
      remettre(t)
      if (t.prise !== null && mo.parent !== null) {
        if (t.prise.parent !== t.avant.parent || t.prise.emplacement !== t.avant.emplacement) {
          // EMBOÎTÉ : ça se voit et ça s'entend.
          sonBatir()
          vibrer([15, 30])
          const s = surLaPage(t.prise.place)
          if (s !== null) eclater(s.x, s.y, 12)
        }
      } else if (t.avant.parent !== null) vibrer(12)
      return
    }
    const pr = producteurDe(j, t.id)
    if (pr === undefined) return
    if (!bouge) {
      // Une tape : le producteur se déclenche.
      remettre(t)
      const s = surLaPage(p)
      if (s !== null) declencherIci(pr, s.x, s.y)
      return
    }
    let pose = false
    agirRef.current(() => {
      pose = deplacerProducteur(j, pr, t.x, t.y)
    })
    remettre(t)
    vibrer(pose ? 10 : [20, 40, 20])
  }

  /** Une pièce vient d'être achetée : elle apparaît sous l'installation, et la vue revient au normal pour qu'on la voie. */
  const naitre = (genre: 'producteur' | 'module', id: number, x: number, y: number): void => {
    setBoutique(false)
    setBulle(null)
    sonBatir()
    vibrer([15, 30])
    carte.current?.centrer()
    requestAnimationFrame(() => {
      ;(genre === 'module' ? modulesEl : producteursEl).current.get(id)?.classList.add('piece-nait')
      const s = surLaPage({ x, y })
      if (s !== null) eclater(s.x, s.y, 10)
    })
  }

  /** L'AMÉLIORATION depuis la bulle : un niveau de plus, et le module le montre. */
  const ameliorerIci = (mo: Module, bouton: HTMLElement): void => {
    const cout = coutNiveau(mo)
    if (!peutAmeliorer(j, mo)) return
    effetDepense(bouton.getBoundingClientRect(), cout)
    agir(() => {
      ameliorer(j, mo)
    })
    sonBatir()
    vibrer([20, 30, 40])
    const pos = dispo.get(mo.id)
    const s = pos === undefined ? null : surLaPage(pos)
    if (s !== null) {
      eclater(s.x, s.y, 12)
      flotter(s.x, s.y - 10, `niveau ${mo.niveau}`, 'flottant-or', 1.2)
    }
    if (!mouvementReduit()) modulesEl.current.get(mo.id)?.animate(ECRASER, { duration: 220, easing: 'ease-out' })
  }

  /** Ce que la vue normale cadre : l'installation entière, et dessous la place des commandes. */
  const cadrage = (): [number, number, number] => [rayon + 20, Math.max(0, bas - rayon) + DESSOUS_HUD, ZOOM_MIN]

  useEffect(() => {
    const el = cadre.current
    const c = toile.current
    const mo = monde.current
    if (el === null || c === null || mo === null) return
    const [r, b, z] = cadrage()
    const k = monterCarte(el, c, mo, zoomVu.current, { rayon: r, bas: b, zoomMin: z }, {
      onClic: (cible, sx, sy) => {
        // La base est cliquable, pas saisissable : le doigt qui glisse dessus emporte la carte, pas la base.
        const id = cible === null ? NaN : Number(cible.dataset['id'])
        const pr = Number.isNaN(id) ? undefined : producteurDe(j, id)
        if (pr !== undefined) declencherIci(pr, sx, sy)
        setBulle(null)
      },
      onSaisir: saisir,
      onTrainer: trainer,
      onLacher: lacher,
      onAnnuler: annuler,
    })
    carte.current = k
    return () => {
      k.detruire()
      carte.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L'installation grandit : le zoom normal suit.
  useEffect(() => {
    const [r, b, z] = cadrage()
    carte.current?.cadrer(r, b, z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rayon, bas])

  // LES LOTS DES HORLOGES flottent au-dessus de leur producteur, à son rythme — quand il est assez lent pour qu'on les lise.
  useEffect(() => {
    const prochains = new Map<number, number>()
    const id = window.setInterval(() => {
      const maintenant = performance.now()
      const r = cadre.current?.getBoundingClientRect()
      if (r === undefined) return
      for (const p of j.producteurs) {
        const b = bilanProducteur(j, p)
        const periode = b.frequence > 0 ? 1000 / b.frequence : Infinity
        if (periode < FLOTTE_MIN_MS || !Number.isFinite(periode)) {
          prochains.delete(p.id)
          continue
        }
        const prochain = prochains.get(p.id)
        if (prochain === undefined) {
          prochains.set(p.id, maintenant + periode)
          continue
        }
        if (maintenant < prochain) continue
        prochains.set(p.id, Math.max(prochain + periode, maintenant + periode / 2))
        const s = surLaPage({ x: p.x, y: p.y - PRODUCTEUR.hauteur / 2 })
        if (s !== null && s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom) flotter(s.x, s.y, `+${abregeFin(b.lotMoyen)}`, 'flottant-or', 0.9)
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = traine.current
  const poses = j.modules.filter((mo) => !branchees.has(mo.id)).length
  const indiceGlisser = poses > 0 && branchees.size === 0
  const indiceAmeliorer = branchees.size > 0 && j.modules.every((mo) => mo.niveau === 1) && bulle === null && j.or >= 50
  const venteVisible = !j.auto && (j.r >= 1 || j.or > 0 || !rien)
  const boutiqueVisible = j.or >= 1 || !rien || j.points > 0
  const choisi = bulle === null ? undefined : moduleDe(j, bulle)
  const placeChoisi = choisi === undefined ? undefined : dispo.get(choisi.id)
  const porteur = choisi === undefined || choisi.parent === null ? undefined : producteurDe(j, choisi.parent)
  // La bulle se pose au-dessus du module, ou dessous quand il est près du haut de l'écran (elle passerait sous l'en-tête).
  const ecranChoisi = placeChoisi === undefined ? undefined : carte.current?.versEcran(placeChoisi.x, placeChoisi.y)
  const bulleDessous = ecranChoisi !== undefined && ecranChoisi.y < 250
  const ecartBulle = placeChoisi === undefined ? 0 : boiteModule(placeChoisi).hauteur / 2 + PIECE.encoche.profondeur + 14

  return (
    <div className="carte" ref={cadre}>
      <canvas className="carte-quadrillage" ref={toile} aria-hidden />
      <div className="carte-monde" ref={monde}>
        {/* LES CREUX où le module qu'on tient peut aller ; celui que vise l'aimant s'allume. */}
        {t !== null &&
          t.genre === 'module' &&
          t.candidats.map((pr) => {
            const b = boiteModule(pr.place)
            return (
              <div
                key={cle(pr)}
                className={`prise${t.prise !== null && cle(t.prise) === cle(pr) ? ' prise-visee' : ''}`}
                style={{ left: b.x - b.largeur / 2, top: b.y - b.hauteur / 2, width: b.largeur, height: b.hauteur }}
                ref={(el) => {
                  if (el === null) prisesEl.current.delete(cle(pr))
                  else prisesEl.current.set(cle(pr), el)
                }}
              />
            )
          })}

        {/* LES PRODUCTEURS : la base au centre, cliquable ; les autres saisissables. Pendant une saisie, celui qu'on tient se rend sous le doigt. */}
        {j.producteurs.map((p) => {
          const enMain = t !== null && t.genre === 'producteur' && t.id === p.id
          const x = enMain ? t.x : p.x
          const y = enMain ? t.y : p.y
          const b = bilanProducteur(j, p)
          const actif = b.frequence > 0
          const cadence = actif ? Math.min(60, Math.max(0.25, 1 / b.frequence)) : 0
          const style: CSSProperties & Record<string, string | number> = {
            left: x - PRODUCTEUR.largeur / 2,
            top: y - PRODUCTEUR.hauteur / 2,
            width: PRODUCTEUR.largeur,
            height: PRODUCTEUR.hauteur,
            '--cadence': `${cadence.toFixed(2)}s`,
          }
          const classes = ['producteur', p.type === 0 ? 'producteur-base' : 'producteur-achete']
          if (actif) classes.push('producteur-actif')
          if (enMain) classes.push('producteur-saisi')
          const saisissable = p.type === 0 ? { 'data-cliquable': true } : { 'data-saisissable': true, 'data-genre': 'producteur' }
          return (
            <div
              key={p.id}
              className={classes.join(' ')}
              {...saisissable}
              data-id={p.id}
              style={style}
              ref={(el) => {
                if (el === null) producteursEl.current.delete(p.id)
                else producteursEl.current.set(p.id, el)
              }}
            >
              <svg
                className="producteur-forme"
                viewBox={`${BOITE_PRODUCTEUR.x} ${BOITE_PRODUCTEUR.y} ${BOITE_PRODUCTEUR.largeur} ${BOITE_PRODUCTEUR.hauteur}`}
                style={{
                  left: BOITE_PRODUCTEUR.x + PRODUCTEUR.largeur / 2,
                  top: BOITE_PRODUCTEUR.y + PRODUCTEUR.hauteur / 2,
                  width: BOITE_PRODUCTEUR.largeur,
                  height: BOITE_PRODUCTEUR.hauteur,
                }}
                aria-hidden
              >
                {p.type === 0 && (
                  <defs>
                    <linearGradient id="base-fond" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#4a3360" />
                      <stop offset="1" stopColor="#2a1a36" />
                    </linearGradient>
                  </defs>
                )}
                <path d={CHEMINS_PRODUCTEURS[p.type] ?? ''} />
              </svg>
              <div className="producteur-texte">
                {p.type === 0 ? (
                  <>
                    <b>
                      <Compteur valeur={j.r} format={abrege} duree={300} />
                    </b>
                    <span className="producteur-unite">{NOM_R}</span>
                    <span className="producteur-colonne">
                      {production > 0 && <small className="gain">{parSeconde(production)}</small>}
                      <small className="sourd">+{abregeFin(b.lotMoyen)} par tape</small>
                    </span>
                  </>
                ) : (
                  <>
                    <b>{LETTRE_PRODUCTEUR[p.type]}</b>
                    <span className="producteur-colonne">
                      <small>{abregeFin(b.lotMoyen)} par coup</small>
                      <small className={actif ? 'gain' : 'sourd'}>{actif ? parSeconde(b.debit) : 'tapez-le, ou posez une horloge'}</small>
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {/* LES MODULES : emboîtés, ils agissent ; posés, ils attendent qu'on les glisse. */}
        {j.modules.map((mo) => {
          let place = dispo.get(mo.id) ?? { x: mo.x, y: mo.y, sens: mo.sens }
          if (t !== null && t.genre === 'module' && t.id === mo.id) place = t.prise !== null ? t.prise.place : { x: t.x, y: t.y, sens: t.sens }
          else if (t !== null && t.genre === 'producteur' && mo.parent === t.id) place = placeSurProducteur({ x: t.x, y: t.y }, mo.emplacement)
          const branche = branchees.has(mo.id)
          const vers = DIRECTIONS[(place.sens + 2) % 4]!
          const periode = mo.type === 0 ? Math.min(60, Math.max(0.3, 1 / effet(0, mo.niveau))) : 0
          const style: CSSProperties & Record<string, string | number> = {
            left: place.x - DEMI_L,
            top: place.y - DEMI_P,
            width: MODULE.largeur,
            height: MODULE.profondeur,
            '--teinte': TEINTES[mo.type] ?? 0,
            '--sens': place.sens,
            '--dx': `${vers.x * 8}px`,
            '--dy': `${vers.y * 8}px`,
            '--cadence': `${periode.toFixed(2)}s`,
          }
          const classes = ['module', branche ? 'module-branche' : 'module-pose']
          if (branche && mo.type === 0) classes.push('module-horloge')
          if (t !== null && ((t.genre === 'module' && t.id === mo.id) || (t.genre === 'producteur' && mo.parent === t.id))) classes.push('module-saisi')
          if (t !== null && t.genre === 'module' && t.id === mo.id && t.prise !== null) classes.push('module-aimante')
          if (bulle === mo.id) classes.push('module-choisi')
          return (
            <div
              key={mo.id}
              className={classes.join(' ')}
              data-saisissable
              data-genre="module"
              data-id={mo.id}
              style={style}
              ref={(el) => {
                if (el === null) modulesEl.current.delete(mo.id)
                else modulesEl.current.set(mo.id, el)
              }}
            >
              <svg
                className="module-forme"
                viewBox={`${BOITE_MODULE.x} ${BOITE_MODULE.y} ${BOITE_MODULE.largeur} ${BOITE_MODULE.hauteur}`}
                style={{ left: BOITE_MODULE.x + DEMI_L, top: BOITE_MODULE.y + DEMI_P, width: BOITE_MODULE.largeur, height: BOITE_MODULE.hauteur }}
                aria-hidden
              >
                <path d={CHEMINS_MODULES[mo.type] ?? ''} />
              </svg>
              <b>{texteEffet(mo.type, mo.niveau)}</b>
              <small>
                {NOM_MODULE[mo.type]} · niv. {mo.niveau}
              </small>
            </div>
          )
        })}

        {/* LA BULLE d'un module tapé : son niveau, son effet, et le bouton pour le monter. Elle garde sa taille à l'écran (`--zoom`). */}
        {choisi !== undefined && placeChoisi !== undefined && (
          <div
            className={`bulle${bulleDessous ? ' bulle-dessous' : ''}`}
            data-hud
            style={bulleDessous ? { left: placeChoisi.x, top: placeChoisi.y + ecartBulle } : { left: placeChoisi.x, bottom: -(placeChoisi.y - ecartBulle) }}
          >
            <span className="bulle-titre">
              <b>{NOM_MODULE[choisi.type]}</b> <span className="sourd">niveau {choisi.niveau}</span>
            </span>
            <span className="petit">
              {texteEffet(choisi.type, choisi.niveau)} → <span className="gain">{texteEffet(choisi.type, choisi.niveau + 1)}</span> au niveau {choisi.niveau + 1}
            </span>
            {porteur !== undefined ? (
              <BilanDuPorteur j={j} porteur={porteur} module={choisi} />
            ) : (
              <span className="petit sourd">Posé : il n’agit sur rien tant qu’il n’est pas emboîté sur un producteur.</span>
            )}
            <button
              type="button"
              className={peutAmeliorer(j, choisi) ? 'bouton-principal' : ''}
              disabled={!peutAmeliorer(j, choisi)}
              onClick={(e) => ameliorerIci(choisi, e.currentTarget)}
            >
              Améliorer · {abrege(coutNiveau(choisi))} or
            </button>
          </div>
        )}
      </div>

      {/* LES COMMANDES par-dessus la carte : elles ne glissent pas avec elle. */}
      <div className="carte-hud">
        <span className="carte-zoom" ref={zoomVu}>
          ×1,0
        </span>
        {debut && j.r < 1 && <p className="carte-indice">Tapez {NOM_BASE} pour produire du {NOM_R}.</p>}
        {indiceGlisser && <p className="carte-indice">Glissez le module sur le creux de sa forme.</p>}
        {indiceAmeliorer && <p className="carte-indice">Tapez un module pour l’améliorer.</p>}
        <div className={`carte-actions${avecBarre ? ' carte-actions-barre' : ''}`}>
          {venteVisible && (
            <button
              type="button"
              className="bouton-principal bouton-vendre"
              disabled={j.r < 1}
              onClick={(e) => {
                const g = gainVente(m, j.r)
                effetVente(e.currentTarget.getBoundingClientRect(), g)
                vibrer([10, 20, 10])
                agir(() => {
                  vendre(m, j, j.r)
                })
              }}
            >
              Vendre {abrege(j.r)} {NOM_R} → {abrege(gainVente(m, j.r))} or
            </button>
          )}
          {j.auto && <span className="sourd petit carte-auto">{NOM_AUTO} : votre production se vend au fil de l’eau.</span>}
          <div className="carte-actions-ligne">
            {boutiqueVisible && (
              <button
                type="button"
                className={rien ? 'respire' : ''}
                onClick={() => {
                  setBulle(null)
                  setBoutique(true)
                }}
              >
                Boutique
              </button>
            )}
            <button type="button" onClick={() => carte.current?.centrer()}>
              Centrer
            </button>
          </div>
        </div>
      </div>
      {boutique && (
        <Boutique
          partie={partie}
          agir={agir}
          onFermer={() => setBoutique(false)}
          onProducteur={(p) => naitre('producteur', p.id, p.x, p.y)}
          onModule={(mo) => naitre('module', mo.id, mo.x, mo.y)}
        />
      )}
    </div>
  )
}

/** Ce que le niveau suivant du module ferait au producteur qui le porte : son débit, ou son lot s'il n'a pas d'horloge. */
function BilanDuPorteur({ j, porteur, module }: { j: ReturnType<typeof joueur>; porteur: Producteur; module: Module }): ReactElement {
  const mods = modulesDe(j, porteur)
  const lot0 = PRODUCTEURS[porteur.type]?.lot ?? 0
  const prestige = multiplicateurPrestige(j)
  const avant = bilan(lot0, mods, prestige)
  const apres = bilan(lot0, mods.map((mo) => (mo === module ? { type: mo.type, niveau: mo.niveau + 1 } : mo)), prestige)
  return (
    <span className="petit sourd">
      {NOM_PRODUCTEUR[porteur.type]} :{' '}
      {apres.frequence > 0 ? (
        <>
          {parSeconde(avant.debit)} → <span className="gain">{parSeconde(apres.debit)}</span>
        </>
      ) : (
        <>
          {abregeFin(avant.lotMoyen)} → <span className="gain">{abregeFin(apres.lotMoyen)}</span> par coup
        </>
      )}
    </span>
  )
}
