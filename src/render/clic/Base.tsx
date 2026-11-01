/**
 * LA CARTE : la page principale du proto. Un plan qu'on fait glisser et qu'on
 * zoome ; dessus, les GÉNÉRATEURS, des rectangles creusés de prises, et les
 * MODULES, des pièces à une bosse qui s'y emboîtent (Keko, 31/10 : « les
 * producteurs génèrent des ressources, avec des prises femelles, et les
 * modules, de différentes formes de prises mâles ; les modules agissent sur le
 * producteur »). La base est la première source, au centre : une tape dessus
 * produit. Un atelier tapé lance une fournée : un module en sort, de rareté
 * tirée, et va dans la soute. On glisse un module d'un creux à l'autre (sur un
 * creux occupé, il prend la place, l'autre va dans la soute) ; on le lâche dans
 * le vide pour le ranger dans la soute ; on tire un générateur pour le ranger
 * ailleurs, ses modules suivent. Une tape sur un module ouvre sa bulle : son
 * niveau, et le bouton pour le monter.
 *
 * Le glisser est impératif (la pièce suit le doigt sans rendu React) ; le
 * moteur n'est touché qu'au lâcher. Entre les deux, un rendu peut survenir
 * (la seconde qui passe) : il lit `traine` pour laisser la pièce sous le doigt.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { FORMES, MODULE, PIECE, PREMIER_ATELIER, PRODUCTEUR, PRODUCTEURS, TAPES_MAX_PAR_S } from '../../logic/clic/donnees.ts'
import {
  DIRECTIONS, acheter, ameliorer, atelierEnAttente, bilan, bilanProducteur, boiteModule, branches, brancher, chancesDe, coutAchat, coutNiveau, coutProducteur, debit, debrancher,
  declencher, deplacerProducteur, disposition, entree, estAtelier, etendue, fabriquer, force, fourneesParSeconde, fusibles, meilleurePrise, moduleDe, modulesDe, multiplicateurPrestige, peutAmeliorer,
  peutFabriquer, placeSurProducteur, prisesPour, producteurDe, producteurTient, regler, soute, stockPour, surLesCases, typeDe, valeurMoyenne, type Module, type Place, type Prise,
  type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import {
  ADJECTIF_SORTE, EXPLICATION_TRAIT, LETTRE_PRODUCTEUR, NOM_ATELIER, NOM_BASE, NOM_MATIERE, NOM_MODULE, NOM_OR, NOM_PRODUCTEUR, NOM_RARETE, NOM_SORTE, NOM_SOUTE, NOM_TRAIT,
} from '../../ui/noms-clic.ts'
import { sonBatir, sonEtape, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { DUREE_GLISSE, monterCarte, type Carte, type Point } from '../carte/carte.ts'
import { eclater, effetDepense, flotter, mouvementReduit } from '../effets.ts'
import { Boutique } from './Boutique.tsx'
import { Glyphe, TEINTES } from './Glyphe.tsx'
import { boite, cheminDecoupe, cotesDuModule, cotesDuProducteur } from './pieces.ts'
import type { PagePropsClic } from './props.ts'
import { Soute } from './Soute.tsx'
import { abregeFin, pourcent, texteEffet } from './texte.ts'

/** La portée de l'aimant : à moins de ça d'un creux de sa forme (en pixels-monde), le module s'y pose. */
const AIMANT = 120
/** Le zoom normal ne descend pas sous ça : une case fait au moins soixante pixels d'écran, on peut la taper. */
const ZOOM_MIN = 60 / PIECE.taille
/** Ce que la vue normale garde sous l'installation, en pixels-monde : la place des commandes. */
const DESSOUS_HUD = 320
/** La pièce s'écrase puis rebondit, à chaque tape. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.96)' }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450
/** Une horloge plus rapide que ça ne fait plus flotter ses lots : la pulsation suffit. */
const FLOTTE_MIN_MS = 1500
/** La couleur de chaque rareté, pour les éclats. */
const COULEURS_RARETE: readonly string[] = ['#d9d2e6', '#7fe0a0', '#4fb3e8', '#c77dff', '#ffc61f']

const DEMI_L = MODULE.largeur / 2
const DEMI_P = MODULE.profondeur / 2
const BOITE_MODULE = boite(MODULE.largeur, MODULE.profondeur)
const BOITE_PRODUCTEUR = boite(PRODUCTEUR.largeur, PRODUCTEUR.hauteur)
/** Le chemin de chaque type de générateur, creusé de ses prises. */
const CHEMINS_PRODUCTEURS: readonly string[] = PRODUCTEURS.map((t) => cheminDecoupe(PRODUCTEUR.largeur, PRODUCTEUR.hauteur, cotesDuProducteur(t.creux)))
/** Le chemin de chaque module, sa bosse en bas (la rotation est en CSS, par `--sens`). */
const CHEMINS_MODULES: readonly string[] = [0, 1, 2, 3].map((k) => cheminDecoupe(MODULE.largeur, MODULE.profondeur, cotesDuModule(k)))

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
      /** Les creux où il peut aller, libres ou à échanger. */
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

/** Ce dont la bulle est ouverte : un module (son niveau), ou un atelier (son réglage). */
type Bulle = { genre: 'module'; id: number } | { genre: 'atelier'; id: number }

export function Base({ partie, agir, avecBarre, versMarche }: PagePropsClic & { avecBarre: boolean; versMarche: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const sorte = j.sorte ?? 0
  const cadre = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const monde = useRef<HTMLDivElement>(null)
  const zoomVu = useRef<HTMLSpanElement>(null)
  const souteEl = useRef<HTMLButtonElement>(null)
  const carte = useRef<Carte | null>(null)
  const producteursEl = useRef(new Map<number, HTMLElement>())
  const modulesEl = useRef(new Map<number, HTMLElement>())
  const prisesEl = useRef(new Map<string, HTMLElement>())
  const traine = useRef<Traine | null>(null)
  const agirRef = useRef(agir)
  agirRef.current = agir
  const [boutique, setBoutique] = useState(false)
  const [souteOuverte, setSouteOuverte] = useState(false)
  const [bulle, setBulle] = useState<Bulle | null>(null)
  /** Ce qu'on tient : le rendu pose les creux candidats pendant qu'on tient un module. */
  const [, setEnMain] = useState<number | null>(null)
  const production = debit(j)
  const dispo = disposition(j)
  const branchees = branches(j)
  const enSoute = soute(j)
  const ateliers = j.producteurs.filter(estAtelier)
  const rien = j.modules.length === 0 && j.producteurs.length === 1
  const debut = rien && j.points === 0 && j.or < 1
  const { rayon, bas } = etendue(j)

  /** Un point du monde, à l'écran (en coordonnées de la page, pour les effets). */
  const surLaPage = (p: Point): Point | null => {
    const k = carte.current
    const r = cadre.current?.getBoundingClientRect()
    if (k === null || r === undefined) return null
    const s = k.versEcran(p.x, p.y)
    return { x: r.left + s.x, y: r.top + s.y }
  }

  /** Le module tombe dans la soute : il file vers son bouton, qui sursaute. */
  const versLaSoute = (depuis: Point | null, texte: string): void => {
    const cible = souteEl.current?.getBoundingClientRect()
    if (depuis !== null) flotter(depuis.x, depuis.y, texte, 'flottant-or', 1)
    window.setTimeout(() => {
      if (cible !== undefined && !mouvementReduit()) souteEl.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
    }, 350)
  }

  // LA TAPE sur une source : une série, et le plafond par seconde (contre les auto-clics).
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
    if (coup.gain <= 0) return
    flotter(x, y, `+${abregeFin(coup.gain)}${coup.critique ? ' !' : ''}`, 'flottant-or', coup.critique ? 2 : Math.min(1.7, 1 + n * 0.05))
    if (coup.critique) eclater(x, y, 22)
    else if (n > 0 && n % 10 === 9) eclater(x, y, 14)
    else if (Math.random() < 0.3) eclater(x, y, 3)
  }

  /** LA FOURNÉE d'un atelier tapé : la matière entre, le module sort, sa rareté se révèle, et il file vers la soute. Sans matière, la bulle de l'atelier s'ouvre. */
  const fabriquerIci = (p: Producteur, x: number, y: number): void => {
    if (!peutFabriquer(j, p)) {
      setBulle({ genre: 'atelier', id: p.id })
      vibrer([20, 40, 20])
      return
    }
    let faits: Module[] = []
    agirRef.current(() => {
      faits = fabriquer(m, j, p)
    })
    if (!mouvementReduit()) producteursEl.current.get(p.id)?.animate(ECRASER, { duration: 220, easing: 'ease-out' })
    const meilleur = faits.reduce((r, mo) => Math.max(r, mo.rarete), 0)
    if (meilleur >= 2) sonEtape()
    else sonBatir()
    vibrer(meilleur >= 3 ? [20, 30, 60, 30, 90] : meilleur >= 1 ? [15, 30, 40] : [15, 30])
    faits.forEach((mo, k) => {
      window.setTimeout(() => {
        const couleur = COULEURS_RARETE[mo.rarete] ?? 'var(--or)'
        eclater(x, y - 20, 8 + mo.rarete * 8, couleur)
        flotter(x, y - 30 - k * 24, `${NOM_MODULE[mo.type]} ${NOM_RARETE[mo.rarete]}${mo.trait !== null ? ` · ${NOM_TRAIT[mo.trait]}` : ''}`, `flottant-rarete flottant-rarete-${mo.rarete}`, 1 + mo.rarete * 0.25)
      }, k * 160)
    })
    versLaSoute(null, '')
  }

  // LA SAISIE : la pièce suit le doigt ; un module près d'un creux de sa forme s'y aimante ; au lâcher, le moteur l'apprend.
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
      // Un générateur se pose sur des cases entières : il saute de case en case sous le doigt.
      const c = surLesCases(t.x, t.y)
      t.x = c.x
      t.y = c.y
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
        setBulle({ genre: 'module', id: mo.id })
        return
      }
      const ou = surLaPage({ x: t.x, y: t.y })
      let echange: number | null = null
      agirRef.current(() => {
        if (t.prise !== null) {
          echange = t.prise.occupant
          if (!brancher(j, mo, t.prise.parent, t.prise.emplacement)) echange = null
        } else debrancher(mo)
      })
      remettre(t)
      if (t.prise !== null && mo.parent !== null) {
        if (t.prise.parent !== t.avant.parent || t.prise.emplacement !== t.avant.emplacement) {
          // EMBOÎTÉ : ça se voit et ça s'entend ; l'autre, s'il y en avait un, part à la soute.
          sonBatir()
          vibrer([15, 30])
          const s = surLaPage(t.prise.place)
          if (s !== null) eclater(s.x, s.y, 12)
          if (echange !== null) versLaSoute(s, `→ ${NOM_SOUTE.toLowerCase()}`)
        }
      } else if (mo.parent === null) {
        // LÂCHÉ DANS LE VIDE : il va dans la soute.
        vibrer(12)
        versLaSoute(ou, `→ ${NOM_SOUTE.toLowerCase()}`)
      }
      return
    }
    const pr = producteurDe(j, t.id)
    if (pr === undefined) return
    if (!bouge) {
      // Une tape : la source se déclenche, l'atelier lance une fournée.
      remettre(t)
      const s = surLaPage(p)
      if (s !== null) {
        if (estAtelier(pr)) fabriquerIci(pr, s.x, s.y)
        else declencherIci(pr, s.x, s.y)
      }
      return
    }
    let pose = false
    agirRef.current(() => {
      pose = deplacerProducteur(j, pr, t.x, t.y)
    })
    remettre(t)
    vibrer(pose ? 10 : [20, 40, 20])
  }

  /**
   * Une pièce vient d'arriver : la vue glisse jusqu'à elle, au zoom normal
   * (Keko, 31/10 : « quand un nouveau module est créé, focus dessus au lieu de ramener au centre ») ; l'éclat l'attend là.
   */
  const naitre = (genre: 'producteur' | 'module', id: number, x: number, y: number): void => {
    setBoutique(false)
    setSouteOuverte(false)
    setBulle(null)
    sonBatir()
    vibrer([15, 30])
    carte.current?.viser(x, y, DESSOUS_HUD)
    requestAnimationFrame(() => {
      ;(genre === 'module' ? modulesEl : producteursEl).current.get(id)?.classList.add('piece-nait')
    })
    window.setTimeout(() => {
      const s = surLaPage({ x, y })
      if (s !== null) eclater(s.x, s.y, 10)
    }, DUREE_GLISSE)
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

  /** DÉBRANCHER depuis la bulle : le module va dans la soute. */
  const debrancherIci = (mo: Module): void => {
    const pos = dispo.get(mo.id)
    const s = pos === undefined ? null : surLaPage(pos)
    agir(() => {
      debrancher(mo)
    })
    setBulle(null)
    vibrer(12)
    versLaSoute(s, `→ ${NOM_SOUTE.toLowerCase()}`)
  }

  /** ACHETER au marché, depuis la bulle d'un atelier, la matière qui manque à sa prochaine fournée. */
  const acheterPourIci = (p: Producteur, bouton: HTMLElement): void => {
    const manque = entree(j, p) - stockPour(j, p)
    if (manque <= 0) return
    const cout = coutAchat(m, p.forme, manque)
    if (j.or + 1e-9 < cout) return
    effetDepense(bouton.getBoundingClientRect(), cout)
    vibrer([10, 20])
    agir(() => {
      acheter(m, j, p.forme, manque)
    })
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

  // LES LOTS DES HORLOGES flottent au-dessus de leur source, à son rythme — quand il est assez lent pour qu'on les lise.
  useEffect(() => {
    const prochains = new Map<number, number>()
    const id = window.setInterval(() => {
      const maintenant = performance.now()
      const r = cadre.current?.getBoundingClientRect()
      if (r === undefined) return
      for (const p of j.producteurs) {
        if (estAtelier(p)) continue
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

  // LES FOURNÉES DES HORLOGES : quand un atelier a tourné tout seul, le module sorti se dit au-dessus de lui.
  const fourneesVues = useRef(new Map<number, number>())
  useEffect(() => {
    for (const p of ateliers) {
      const avant = fourneesVues.current.get(p.id)
      fourneesVues.current.set(p.id, p.fournees)
      if (avant === undefined || p.fournees <= avant) continue
      const s = surLaPage({ x: p.x, y: p.y - PRODUCTEUR.hauteur / 2 })
      if (s !== null) flotter(s.x, s.y, `+${p.fournees - avant} module${p.fournees - avant > 1 ? 's' : ''}`, 'flottant-or', 1)
    }
  })

  const t = traine.current
  const souteVisible = enSoute.length > 0 || j.modules.length > 0
  const boutiqueVisible = j.or >= 1 || !rien || j.points > 0
  const stockPropre = j.matiere[sorte] ?? 0
  const coutT1 = coutProducteur(j, PREMIER_ATELIER)
  const aHorloge = j.modules.some((mo) => mo.type === 0)
  const branchable = enSoute.some((mo) => meilleurePrise(j, mo) !== null)
  const atelierPret = ateliers.find((p) => peutFabriquer(j, p))
  const atelierManque = ateliers.find((p) => !peutFabriquer(j, p))

  // UN INDICE à la fois : le premier geste, puis ce qui bloque.
  let indice: string | null = null
  if (debut && stockPropre < 10) indice = `Tapez ${NOM_BASE} pour produire de la ${NOM_MATIERE} ${ADJECTIF_SORTE[sorte]}.`
  else if (ateliers.length === 0 && j.or < coutT1) indice = `Vendez votre ${NOM_MATIERE} au marché : un ${NOM_ATELIER} coûte ${abrege(coutT1)} ${NOM_OR}.`
  else if (ateliers.length === 0) indice = `Achetez un ${NOM_ATELIER} dans la boutique : il fera des modules de votre ${NOM_MATIERE}.`
  else if (branchable && t === null) indice = `Un module attend dans la ${NOM_SOUTE.toLowerCase()} : branchez-le.`
  else if (j.modules.length === 0 && atelierPret !== undefined) indice = `Tapez l’${NOM_ATELIER} pour lancer une fournée.`
  else if (j.modules.length === 0 && atelierManque !== undefined) indice = `Il manque ${abrege(entree(j, atelierManque) - stockPour(j, atelierManque))} ${NOM_MATIERE} pour une fournée : tapez ${NOM_BASE}.`
  else if (!aHorloge && j.modules.length > 0 && j.or >= 10) indice = `Pas d’horloge : achetez de la ${NOM_SORTE[0]} au marché, et réglez un ${NOM_ATELIER} dessus (sa roue).`
  else if (fusibles(j).length > 0) indice = `Trois modules pareils dans la ${NOM_SOUTE.toLowerCase()} : fondez-les en un plus rare.`
  else if (branchees.size > 0 && j.modules.every((mo) => mo.niveau === 1) && bulle === null && j.or >= 50) indice = 'Tapez un module pour l’améliorer.'

  const choisi = bulle?.genre === 'module' ? moduleDe(j, bulle.id) : undefined
  const atelierChoisi = bulle?.genre === 'atelier' ? producteurDe(j, bulle.id) : undefined
  const placeChoisi = choisi === undefined ? undefined : dispo.get(choisi.id)
  const porteur = choisi === undefined || choisi.parent === null ? undefined : producteurDe(j, choisi.parent)
  // La bulle se pose au-dessus du module, ou dessous quand il est près du haut de l'écran (elle passerait sous l'en-tête).
  const ecranChoisi = placeChoisi === undefined ? undefined : carte.current?.versEcran(placeChoisi.x, placeChoisi.y)
  const bulleDessous = ecranChoisi !== undefined && ecranChoisi.y < 250
  const ecartBulle = placeChoisi === undefined ? 0 : boiteModule(placeChoisi).hauteur / 2 + PIECE.encoche.profondeur + 14
  // Celle d'un atelier pareil : au-dessus de la pièce (ses modules du haut compris), dessous près du haut de l'écran.
  const ecranAtelier = atelierChoisi === undefined ? undefined : carte.current?.versEcran(atelierChoisi.x, atelierChoisi.y)
  const atelierDessous = ecranAtelier !== undefined && ecranAtelier.y < 330
  const ecartAtelier = PRODUCTEUR.hauteur / 2 + MODULE.profondeur + PIECE.encoche.profondeur + 14

  return (
    <div className="carte" ref={cadre}>
      <canvas className="carte-quadrillage" ref={toile} aria-hidden />
      <div className="carte-monde" ref={monde}>
        {/* LES CREUX où le module qu'on tient peut aller ; celui que vise l'aimant s'allume ; un creux occupé propose l'échange. */}
        {t !== null &&
          t.genre === 'module' &&
          t.candidats.map((pr) => {
            const b = boiteModule(pr.place)
            const classes = ['prise']
            if (pr.occupant !== null) classes.push('prise-echange')
            if (t.prise !== null && cle(t.prise) === cle(pr)) classes.push('prise-visee')
            return (
              <div
                key={cle(pr)}
                className={classes.join(' ')}
                style={{ left: b.x - b.largeur / 2, top: b.y - b.hauteur / 2, width: b.largeur, height: b.hauteur }}
                ref={(el) => {
                  if (el === null) prisesEl.current.delete(cle(pr))
                  else prisesEl.current.set(cle(pr), el)
                }}
              />
            )
          })}

        {/* LES GÉNÉRATEURS : la base au centre, cliquable ; les autres saisissables. Pendant une saisie, celui qu'on tient se rend sous le doigt. */}
        {j.producteurs.map((p) => {
          const enMain = t !== null && t.genre === 'producteur' && t.id === p.id
          const x = enMain ? t.x : p.x
          const y = enMain ? t.y : p.y
          const b = bilanProducteur(j, p)
          const atelier = estAtelier(p)
          const actif = b.frequence > 0 && (!atelier || (peutFabriquer(j, p) && !atelierEnAttente(j, p)))
          const cadence = actif ? Math.min(60, Math.max(0.25, 1 / b.frequence)) : 0
          const style: CSSProperties & Record<string, string | number> = {
            left: x - PRODUCTEUR.largeur / 2,
            top: y - PRODUCTEUR.hauteur / 2,
            width: PRODUCTEUR.largeur,
            height: PRODUCTEUR.hauteur,
            '--cadence': `${cadence.toFixed(2)}s`,
            '--teinte': TEINTES[p.forme] ?? 0,
          }
          const classes = ['producteur', p.type === 0 ? 'producteur-base' : 'producteur-achete']
          if (atelier) classes.push('producteur-atelier')
          if (actif) classes.push('producteur-actif')
          if (atelier && peutFabriquer(j, p)) classes.push('atelier-pret')
          if (atelier && atelierEnAttente(j, p)) classes.push('atelier-attente')
          if (enMain) classes.push('producteur-saisi')
          if (atelierChoisi?.id === p.id) classes.push('producteur-choisi')
          const saisissable = p.type === 0 ? { 'data-cliquable': true } : { 'data-saisissable': true, 'data-genre': 'producteur' }
          const manque = atelier ? entree(j, p) - stockPour(j, p) : 0
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
                      <Compteur valeur={stockPropre} format={abrege} duree={300} />
                    </b>
                    <span className="producteur-unite">
                      <Glyphe forme={sorte} />
                    </span>
                    <span className="producteur-colonne">
                      {production > 0 && <small className="gain">{parSeconde(production)}</small>}
                      <small className="sourd">+{abregeFin(b.lotMoyen)} par tape</small>
                    </span>
                  </>
                ) : atelier ? (
                  <>
                    <span className="atelier-forme">
                      <Glyphe forme={p.forme} classe="glyphe-moyen" />
                    </span>
                    <span className="producteur-colonne">
                      <small>
                        <b className="atelier-nom">{LETTRE_PRODUCTEUR[p.type]}</b> · {abrege(entree(j, p))} <Glyphe forme={p.forme} /> → {NOM_MODULE[p.forme]?.toLowerCase()}
                      </small>
                      {atelierEnAttente(j, p) ? (
                        <small className="limite">en attente : {NOM_SOUTE.toLowerCase()} pleine de cette forme</small>
                      ) : manque > 0 ? (
                        <small className="manque">il manque {abrege(manque)} · sa roue pour en acheter</small>
                      ) : b.frequence > 0 ? (
                        <small className="gain">tourne seul · {b.frequence * 3600 >= 1 ? `${(b.frequence * 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} fournées/h` : 'lentement'}</small>
                      ) : (
                        <small className="gain">prêt : tapez pour lancer la fournée</small>
                      )}
                    </span>
                    <button
                      type="button"
                      className="atelier-reglage"
                      data-hud
                      aria-label="Régler l’atelier"
                      onClick={(e) => {
                        e.stopPropagation()
                        setBulle((b) => (b?.genre === 'atelier' && b.id === p.id ? null : { genre: 'atelier', id: p.id }))
                        vibrer(6)
                      }}
                    >
                      ⚙
                    </button>
                  </>
                ) : (
                  <>
                    <b>{LETTRE_PRODUCTEUR[p.type]}</b>
                    <span className="producteur-colonne">
                      <small>{abregeFin(b.lotMoyen)} par coup</small>
                      <small className={actif ? 'gain' : 'sourd'}>{actif ? parSeconde(b.debit) : 'tapez-la, ou posez une horloge'}</small>
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {/* LES MODULES emboîtés : ceux de la soute ne sont pas sur la carte. */}
        {j.modules.map((mo) => {
          let place = dispo.get(mo.id)
          if (t !== null && t.genre === 'module' && t.id === mo.id) place = t.prise !== null ? t.prise.place : { x: t.x, y: t.y, sens: t.sens }
          else if (t !== null && t.genre === 'producteur' && mo.parent === t.id) place = placeSurProducteur({ x: t.x, y: t.y }, mo.emplacement)
          if (place === undefined) return null
          const branche = branchees.has(mo.id)
          const vers = DIRECTIONS[(place.sens + 2) % 4]!
          const f = force(mo)
          const periode = mo.type === 0 ? Math.min(60, Math.max(0.3, 1 / (f / 60))) : 0
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
          const classes = ['module', `rarete-${mo.rarete}`, branche ? 'module-branche' : 'module-pose']
          if (branche && mo.type === 0) classes.push('module-horloge')
          if (t !== null && ((t.genre === 'module' && t.id === mo.id) || (t.genre === 'producteur' && mo.parent === t.id))) classes.push('module-saisi')
          if (t !== null && t.genre === 'module' && t.id === mo.id && t.prise !== null) classes.push('module-aimante')
          if (choisi?.id === mo.id) classes.push('module-choisi')
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
              <b>{texteEffet(mo.type, f)}</b>
              <small>
                {NOM_MODULE[mo.type]} · niv. {mo.niveau}
                {mo.rarete > 0 && <span className="module-rarete"> · {NOM_RARETE[mo.rarete]}</span>}
                {mo.trait !== null && <span className="module-trait"> · {NOM_TRAIT[mo.trait]}</span>}
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
              <b>{NOM_MODULE[choisi.type]}</b> <span className={`rarete-${choisi.rarete}`}>{NOM_RARETE[choisi.rarete]}</span> <span className="sourd">niveau {choisi.niveau}</span>
            </span>
            {choisi.trait !== null && (
              <span className="petit">
                <b>{NOM_TRAIT[choisi.trait]}</b> : {EXPLICATION_TRAIT[choisi.trait]}
              </span>
            )}
            <span className="petit">
              {texteEffet(choisi.type, force(choisi))} → <span className="gain">{texteEffet(choisi.type, force({ ...choisi, niveau: choisi.niveau + 1 }))}</span> au niveau {choisi.niveau + 1}
            </span>
            {porteur !== undefined && <BilanDuPorteur j={j} porteur={porteur} module={choisi} />}
            <button
              type="button"
              className={peutAmeliorer(j, choisi) ? 'bouton-principal' : ''}
              disabled={!peutAmeliorer(j, choisi)}
              onClick={(e) => ameliorerIci(choisi, e.currentTarget)}
            >
              Améliorer · {abrege(coutNiveau(choisi))} {NOM_OR}
            </button>
            <button type="button" className="bouton-discret" onClick={() => debrancherIci(choisi)}>
              Débrancher → {NOM_SOUTE.toLowerCase()}
            </button>
          </div>
        )}

        {/* LA BULLE d'un atelier : la sorte qu'il travaille, sa fournée, ses chances. */}
        {atelierChoisi !== undefined && (
          <div
            className={`bulle bulle-atelier${atelierDessous ? ' bulle-dessous' : ''}`}
            data-hud
            style={atelierDessous ? { left: atelierChoisi.x, top: atelierChoisi.y + ecartAtelier } : { left: atelierChoisi.x, bottom: -(atelierChoisi.y - ecartAtelier) }}
          >
            <span className="bulle-titre">
              <b>{NOM_PRODUCTEUR[atelierChoisi.type]}</b> <span className="sourd">{atelierChoisi.fournees} fournée{atelierChoisi.fournees > 1 ? 's' : ''}</span>
            </span>
            <span className="petit sourd">Travaille la {NOM_SORTE[atelierChoisi.forme]} : il en fait des modules {NOM_MODULE[atelierChoisi.forme]?.toLowerCase()}.</span>
            <div className="choix-forme">
              {Array.from({ length: FORMES }, (_, f) => (
                <button
                  key={f}
                  type="button"
                  className={f === atelierChoisi.forme ? 'actif' : ''}
                  aria-label={NOM_SORTE[f]}
                  onClick={() => {
                    if (f === atelierChoisi.forme) return
                    agir(() => {
                      regler(atelierChoisi, f)
                    })
                    vibrer(8)
                  }}
                >
                  <Glyphe forme={f} />
                  <small>{abrege(j.matiere[f] ?? 0)}</small>
                </button>
              ))}
            </div>
            <span className="petit">
              Fournée : {abrege(entree(j, atelierChoisi))} {NOM_SORTE[atelierChoisi.forme]} · en stock {abrege(stockPour(j, atelierChoisi))}
              {typeDe(atelierChoisi).duree > 0 && <span className="sourd"> · {typeDe(atelierChoisi).duree < 1 ? `${Math.round(typeDe(atelierChoisi).duree * 60)} min` : `${typeDe(atelierChoisi).duree} h`} de votre production</span>}
            </span>
            <span className="petit chances">
              {chancesDe(atelierChoisi).map((c, r) =>
                c > 0 ? (
                  <span key={r} className={`rarete-${r}`}>
                    {NOM_RARETE[r]} {pourcent(c)}
                  </span>
                ) : null,
              )}
            </span>
            {entree(j, atelierChoisi) > stockPour(j, atelierChoisi) &&
              (() => {
                const manque = entree(j, atelierChoisi) - stockPour(j, atelierChoisi)
                const cout = coutAchat(m, atelierChoisi.forme, manque)
                const payable = j.or + 1e-9 >= cout
                return atelierChoisi.forme === sorte ? (
                  <span className="petit manque">Il manque {abrege(manque)} : tapez {NOM_BASE}, ou attendez vos horloges.</span>
                ) : (
                  <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheterPourIci(atelierChoisi, e.currentTarget)}>
                    Acheter {abrege(manque)} au marché · {abrege(cout)} {NOM_OR}
                  </button>
                )
              })()}
            {atelierEnAttente(j, atelierChoisi) && <span className="petit limite">Ses horloges attendent : la {NOM_SOUTE.toLowerCase()} a déjà des modules de cette forme. Une tape lance quand même.</span>}
          </div>
        )}
      </div>

      {/* LES COMMANDES par-dessus la carte : elles ne glissent pas avec elle. */}
      <div className="carte-hud">
        <span className="carte-zoom" ref={zoomVu}>
          ×1,0
        </span>
        {(j.or > 0 || !rien) && (
          <div className="stocks">
            {Array.from({ length: FORMES }, (_, s) => s)
              .sort((a, b) => (a === sorte ? -1 : b === sorte ? 1 : a - b))
              .map((s) => (
                <button key={s} type="button" className={`stock${s === sorte ? ' stock-mienne' : ''}`} onClick={versMarche} title={NOM_SORTE[s]}>
                  <Glyphe forme={s} />
                  <Compteur valeur={j.matiere[s] ?? 0} format={abrege} duree={300} />
                </button>
              ))}
          </div>
        )}
        {indice !== null && <p className="carte-indice">{indice}</p>}
        <div className={`carte-actions${avecBarre ? ' carte-actions-barre' : ''}`}>
          <div className="carte-actions-ligne">
            {boutiqueVisible && (
              <button
                type="button"
                className={ateliers.length === 0 && j.or >= coutT1 ? 'respire' : ''}
                onClick={() => {
                  setBulle(null)
                  setBoutique(true)
                }}
              >
                Boutique
              </button>
            )}
            {souteVisible && (
              <button
                type="button"
                ref={souteEl}
                className={branchable ? 'respire' : ''}
                onClick={() => {
                  setBulle(null)
                  setSouteOuverte(true)
                }}
              >
                {NOM_SOUTE} · {enSoute.length}
              </button>
            )}
            <button type="button" onClick={() => carte.current?.centrer()}>
              Centrer
            </button>
          </div>
        </div>
      </div>
      {boutique && <Boutique partie={partie} agir={agir} onFermer={() => setBoutique(false)} onProducteur={(p) => naitre('producteur', p.id, p.x, p.y)} />}
      {souteOuverte && (
        <Soute
          partie={partie}
          agir={agir}
          onFermer={() => setSouteOuverte(false)}
          onBranche={(mo) => {
            const pl = disposition(j).get(mo.id)
            if (pl !== undefined) naitre('module', mo.id, pl.x, pl.y)
          }}
          onFondu={(mo) => {
            const r = souteEl.current?.getBoundingClientRect()
            const x = r === undefined ? window.innerWidth / 2 : r.left + r.width / 2
            const y = r === undefined ? window.innerHeight / 2 : r.top
            eclater(x, y, 10 + mo.rarete * 6, COULEURS_RARETE[mo.rarete] ?? 'var(--or)')
            flotter(x, y - 10, `${NOM_MODULE[mo.type]} ${NOM_RARETE[mo.rarete]}`, `flottant-rarete flottant-rarete-${mo.rarete}`, 1.2)
          }}
        />
      )}
    </div>
  )
}

/** Ce que le niveau suivant du module ferait au générateur qui le porte : sa production, ses fournées, ou son lot s'il n'a pas d'horloge. */
function BilanDuPorteur({ j, porteur, module }: { j: ReturnType<typeof joueur>; porteur: Producteur; module: Module }): ReactElement {
  const mods = modulesDe(j, porteur)
  const lot0 = typeDe(porteur).lot
  const prestige = multiplicateurPrestige(j)
  const atelier = estAtelier(porteur)
  const avant = bilan(lot0, mods, prestige, atelier)
  const apres = bilan(lot0, mods.map((mo) => (mo === module ? { ...mo, niveau: mo.niveau + 1 } : mo)), prestige, atelier)
  if (atelier) {
    const parH = (b: typeof avant): string => `${(b.lotMoyen * fourneesParSeconde(j, porteur, b.frequence) * 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} modules/h`
    return (
      <span className="petit sourd">
        {NOM_PRODUCTEUR[porteur.type]} :{' '}
        {apres.frequence > 0 ? (
          <>
            {parH(avant)} → <span className="gain">{parH(apres)}</span>
            {fourneesParSeconde(j, porteur, apres.frequence) < apres.frequence && ' · au plus, la matière manque'}
          </>
        ) : (
          <>
            {abregeFin(avant.lotMoyen)} → <span className="gain">{abregeFin(apres.lotMoyen)}</span> module{apres.lotMoyen >= 2 ? 's' : ''} par fournée
            {module.type === 3 && ` · ${pourcent(avant.chance)} → ${pourcent(apres.chance)} de rareté en plus`}
          </>
        )}
        {' · vaut '}
        {abrege(valeurMoyenne(porteur))} {NOM_OR} le module en moyenne
      </span>
    )
  }
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
