/**
 * LA CARTE : la page principale du proto. Un plan qu'on fait glisser et qu'on
 * zoome ; dessus, les GÉNÉRATEURS, des rectangles creusés de prises, et les
 * MODULES, des pièces à une bosse qui s'y emboîtent (Keko, 31/10 : « les
 * producteurs génèrent des ressources, avec des prises femelles, et les
 * modules, de différentes formes de prises mâles ; les modules agissent sur le
 * producteur »). LA MINE D'OR de départ est au centre, un carré avec son image
 * (Keko, 02/11) : une tape dessus rend de l'or, qui vole au compteur. Une
 * source tapée produit. Une raffinerie ou un mélangeur tapé convertit un
 * lot. Les modules se fabriquent dans la boutique et arrivent dans la soute.
 * On glisse un module d'un creux à l'autre (sur un creux occupé, il prend la
 * place, l'autre va dans la soute) ; on le lâche dans le vide pour le ranger
 * dans la soute ; on tire un générateur pour le ranger ailleurs, ses modules
 * suivent. Une tape sur un module ouvre sa bulle (son niveau) ; la roue d'un
 * générateur ouvre sa feuille (son réglage, son niveau).
 *
 * Le glisser est impératif (la pièce suit le doigt sans rendu React) ; le
 * moteur n'est touché qu'au lâcher. Entre les deux, un rendu peut survenir
 * (la seconde qui passe) : il lit `traine` pour laisser la pièce sous le doigt.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { CONSTRUCTION, COULEURS, EFFETS_MINE, FAMILLES, FORMES, MELANGE, MODULE, PIECE, PRIMAIRES, PRODUCTEURS, TAPES_MAX_PAR_S, aDuBleu, couleurDe, sorteDe, type IdAmelioration, type IdAmeliorationProducteur, type Quete, type Ressource, RESSOURCES } from '../../logic/clic/donnees.ts'
import {
  DIRECTIONS, acheter, ameliorationsOuvertes, ameliorer, automatiqueProducteur, choisirAmeliorationProducteur, construire, constructionOuverte, estConstruit, gainNiveauProducteur,
  acheterRessource, lotProducteur, marcheOuvert, monterLeProducteur, premierConstruit, vendreRessource, niveauAP, peutMonterLeProducteur, prixConstruction, prixNiveauProducteur, ressourceDe, gainNiveauMine, monterLaMine, peutMonterLaMine, prixNiveauMine, ameliorerSource, bilan, choisirAmelioration, perdrePepite, ramasserPepite, bilanProducteur, boiteModule, branches, brancher, coutAchat, coutFabrication, coutNiveau, coutNiveauSource, coutProducteur, debitTotal,
  capaciteReserve, debrancher, mineArretee, declencher, deplacerProducteur, disponible, disposition, effetsDe, entrees, estFixe, estMine, estSource, etendue, force, fusibles, genreDe, lotDeBase, meilleurePrise, moduleDe,
  modulesDe, multiplicateurPrestige, peutAmeliorer, peutAmeliorerSource, peutFabriquer, peutPayer, placeSurProducteur, pointsSi, prisesPour, producteurDe, producteurTient, progresQuete,
  objectifQuete, queteAccomplie, queteEnCours, reclamerQuete, recolter, regler, reservePleine, sortesFormees,
  sortie, soute, surLesCases, tailleDe, typeDe, visibleProducteur, type Coup, type Joueur, type Module, type Monde, type Place, type Prise, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde, possede } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import {
  EXPLICATION_TRAIT, LE_RESSOURCE, LETTRE_PRODUCTEUR, NOM_AMELIORATION, NOM_AMELIORATION_PRODUCTEUR, NOM_COULEUR, NOM_MATIERE, NOM_MINE, NOM_OR, NOM_RECOMPENSE, NOM_RARETE, NOM_SOUTE, NOM_TRAIT, NOMS_FORMES, explicationModule, nomProducteur, nomSorte, nomSortePluriel,
} from '../../ui/noms-clic.ts'
import { sonBarre, sonBatir, sonEtape, sonReserve, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { DUREE_GLISSE, monterCarte, type Carte, type Point } from '../carte/carte.ts'
import { DUREE_VOL, SERIE_MS, eclater, effetDepense, effetRecolte, effetRessource, effetVente, flotter, impact, intensiteRecolte, mouvementReduit, onde, retarderLeCompteur, volerDesPieces } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { ChoixAmelioration, MenuAmeliorations } from './Ameliorations.tsx'
import { MenuConstruction } from './Construction.tsx'
import { MenuMarche } from './MarcheRessources.tsx'
import { ImageDuType } from './Pictos.tsx'
import { BoutonCout, Boutique, COULEURS_RARETE } from './Boutique.tsx'
import { Choix } from './Choix.tsx'
import { Glyphe, Symbole, SymbolePiece, SymboleRessource, SymboleSorte, TEINTES } from './Glyphe.tsx'
import { boite, cheminDecoupe, cotesDuModule, cotesDuProducteur } from './pieces.ts'
import type { PagePropsClic } from './props.ts'
import { Soute } from './Soute.tsx'
import { abregeFin, texteEffet } from './texte.ts'

/** La portée de l'aimant : à moins de ça d'un creux de sa forme (en pixels-monde), le module s'y pose. */
const AIMANT = 120
/** Le zoom normal ne descend pas sous ça : une case fait au moins soixante pixels d'écran, on peut la taper. */
const ZOOM_MIN = 60 / PIECE.taille
/** Ce que la vue normale garde sous l'installation, en pixels-monde : la place des commandes. */
const DESSOUS_HUD = 320
/** La pièce s'écrase puis rebondit, à chaque tape. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.96)' }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Une horloge plus rapide que ça ne fait plus flotter ses lots : la pulsation suffit. */
const FLOTTE_MIN_MS = 1500
/** La couleur d'éclat de chaque couleur de matière. */
const couleurEclat = (c: number): string => `hsl(${TEINTES[c] ?? 45} 80% 65%)`
/** Au plus tant de stocks dans le coin de la carte. */
const STOCKS_MAX = 9

const DEMI_L = MODULE.largeur / 2
const DEMI_P = MODULE.profondeur / 2
const BOITE_MODULE = boite(MODULE.largeur, MODULE.profondeur)
/** La boîte du SVG de chaque type de générateur (sa taille et ses creux), et son chemin, creusé de ses prises. */
const BOITES_PRODUCTEURS: readonly ReturnType<typeof boite>[] = PRODUCTEURS.map((_, i) => {
  const ta = tailleDe({ type: i })
  return boite(ta.largeur, ta.hauteur)
})
const CHEMINS_PRODUCTEURS: readonly string[] = PRODUCTEURS.map((t, i) => {
  const ta = tailleDe({ type: i })
  return cheminDecoupe(ta.largeur, ta.hauteur, cotesDuProducteur(t.creux))
})
/** Le chemin de chaque module, sa bosse en bas (la rotation est en CSS, par `--sens`). */
const CHEMINS_MODULES: readonly string[] = [0, 1, 2, 3].map((k) => cheminDecoupe(MODULE.largeur, MODULE.profondeur, cotesDuModule(k)))

const cle = (p: Prise): string => `${p.parent}:${p.emplacement}`
const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

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

/** Une pépite à l'écran : sa clé, sa place (pixels-monde), et l'écart à la mine d'où elle a jailli. */
type PepiteVue = { cle: number; x: number; y: number; dx: number; dy: number }

/** Ce dont la bulle est ouverte : un module (son niveau), ou un générateur (sa feuille : réglage, niveau). */
type Bulle = { genre: 'module'; id: number } | { genre: 'producteur'; id: number }

export function Base({ partie, agir, avecBarre, versMarche }: PagePropsClic & { avecBarre: boolean; versMarche: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
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
  /** La feuille du choix d'une amélioration, ouverte. */
  /** Le bâtiment dont le choix d'amélioration est ouvert, et celui dont le menu l'est (la banque, un producteur construit). */
  const [choixDe, setChoixDe] = useState<number | null>(null)
  const [menuDe, setMenuDe] = useState<number | null>(null)
  const [menuConstruction, setMenuConstruction] = useState(false)
  const [menuMarche, setMenuMarche] = useState(false)
  /** LES PÉPITES tombées, à l'écran : où chacune est posée, d'où elle a jailli. Le moteur sait combien il y en a (`j.pepites`). */
  const [pepitesVues, setPepitesVues] = useState<PepiteVue[]>([])
  const pepitesRef = useRef<PepiteVue[]>([])
  const minuteursPepites = useRef(new Map<number, number>())
  const prochainePepite = useRef(1)
  const [bulle, setBulle] = useState<Bulle | null>(null)
  /** Ce qu'on tient : le rendu pose les creux candidats pendant qu'on tient un module. */
  const [, setEnMain] = useState<number | null>(null)
  const production = debitTotal(j)
  const dispo = disposition(j)
  const branchees = branches(j)
  const enSoute = soute(j)
  const raffineries = j.producteurs.filter((p) => genreDe(p) === 'raffinerie')
  const rondes = Array.from({ length: PRIMAIRES }, (_, c) => j.matiere[sorteDe(c, 0)] ?? 0).reduce((s, q) => s + q, 0)
  // Rien que la mine : le départ.
  const rien = j.modules.length === 0 && j.producteurs.every((p) => estMine(p) || estConstruit(p))
  const menuVu = menuDe === null ? undefined : producteurDe(j, menuDe)
  const choixVu = choixDe === null ? undefined : producteurDe(j, choixDe)
  // Le tout début : rien encore extrait (une bourse vidée par un achat n'est pas un début).
  // Le tout début : aucune tape, rien en réserve ni extrait (une heure passée peut remplir la réserve sans tape).
  const debut = rien && j.points === 0 && j.journal.tapes === 0 && j.orProduit === 0 && (j.producteurs.find(estMine)?.reserve ?? 0) < 1
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

  // LA TAPE sur un générateur : une série, et le plafond par seconde (contre les auto-clics).
  const serie = useRef({ n: 0, t: 0 })
  const recentes = useRef<number[]>([])
  const declencherIci = (p: Producteur, x: number, y: number): void => {
    const maintenant = performance.now()
    recentes.current = recentes.current.filter((t) => maintenant - t < 1000)
    if (recentes.current.length >= TAPES_MAX_PAR_S) return
    recentes.current.push(maintenant)
    serie.current = { n: maintenant - serie.current.t < SERIE_MS ? serie.current.n + 1 : 0, t: maintenant }
    const n = serie.current.n
    const brut = estSource(p) || estMine(p)
    let coup: Coup = { gain: 0, critique: false, grosLot: false, sorte: 0, or: false }
    agirRef.current(() => {
      coup = declencher(m, j, p, Math.random(), n)
    })
    if (coup.or || coup.ressource !== undefined) {
      // LA BANQUE, ET LES PRODUCTEURS CONSTRUITS QUI PRODUISENT COMME ELLE : la tape fait bondir la barre ; une barre pleine paie — sa pièce vole du « +1 » au compteur (Keko, 02/11 : la tape est le gain actif, la réserve le gain d'absence).
      const el = producteursEl.current.get(p.id)
      const etincelle = coup.ressource === 'bois' ? '#e8b878' : coup.ressource === 'pierre' ? '#d6d8e0' : '#ffe27a'
      // LA BARRE RÉAGIT À CHAQUE TAPE (Keko, 02/11 : « ça manque de juice, le remplissage ») : elle s'écrase et s'allume, sa tête flashe, des étincelles partent de son bord ; la note monte avec elle.
      const remplissage = coup.gain > 0 ? 1 : Math.min(1, p.progres)
      sonBarre(remplissage, coup.critique)
      if (coup.gain > 0) lacherLaPiece(el, p, coup.gain)
      if (!mouvementReduit()) {
        // LE CHIFFRE POMPE à chaque tape (Keko, 02/11 : « pump le chiffre au moment du remplissage »), de plus en plus fort à mesure que la barre se remplit.
        el?.querySelector('.mine-barre-gain-pompe')?.animate(
          [
            { transform: 'scale(1)', filter: 'brightness(1)' },
            { transform: `scale(${(1.25 + 0.35 * remplissage) * (coup.critique ? 1.25 : 1)})`, filter: 'brightness(1.9)', offset: 0.3 },
            { transform: 'scale(0.94)', offset: 0.65 },
            { transform: 'scale(1)', filter: 'brightness(1)' },
          ],
          { duration: 240, easing: 'ease-out' },
        )
        el?.animate(ECRASER, { duration: 170, easing: 'ease-out' })
        const barre = el?.querySelector<HTMLElement>('.mine-barre')
        barre?.animate(
          [
            { transform: 'scaleY(1)', filter: 'brightness(1)' },
            { transform: `scaleY(${coup.critique ? 1.45 : 1.25})`, filter: `brightness(${coup.critique ? 2.2 : 1.7})`, offset: 0.3 },
            { transform: 'scaleY(1)', filter: 'brightness(1)' },
          ],
          { duration: coup.critique ? 260 : 170, easing: 'ease-out' },
        )
        el?.querySelector('.mine-barre-tete')?.animate(
          [
            { opacity: 1, transform: 'translateX(-50%) scale(2.2)' },
            { opacity: 0.45, transform: 'translateX(-50%) scale(1)' },
          ],
          { duration: 260, easing: 'ease-out' },
        )
        const r = barre?.getBoundingClientRect()
        if (r !== undefined) eclater(r.left + r.width * Math.min(1, coup.gain > 0 ? 1 : p.progres), r.top + r.height / 2, coup.critique ? 14 : 5, etincelle)
      }
      vibrer(coup.critique ? [10, 30, 25] : coup.gain > 0 ? [10, 20, 15] : 8)
      // AU POINT DE LA TAPE (Keko, 02/11 : « ça manque de juice à l'endroit du tap ») : un éclat de lumière, une petite onde, des étincelles à chaque coup ; plus fort quand la tape remplit la barre, plus encore pour un critique.
      const fort = coup.critique ? 2 : coup.gain > 0 ? 1.5 : 1
      impact(x, y, 46 * fort)
      onde(x, y, 24 * fort, coup.critique ? 'rgba(255, 150, 100, 0.9)' : 'rgba(255, 240, 200, 0.85)')
      eclater(x, y, coup.critique ? 26 : coup.gain > 0 ? 14 : 6, coup.critique ? '#ff8a5c' : etincelle)
      if (coup.critique) flotter(x, y - 120, coup.ressource !== undefined ? 'Coup double !' : 'Critique !', 'flottant-critique', 1.3)
      return
    }
    if (coup.gain <= 0) {
      // Rien à convertir : la feuille du générateur dit ce qui manque.
      if (!brut) {
        setBulle({ genre: 'producteur', id: p.id })
        vibrer([20, 40, 20])
      }
      return
    }
    if (!mouvementReduit()) producteursEl.current.get(p.id)?.animate(ECRASER, { duration: 170, easing: 'ease-out' })
    sonTape(coup.critique ? n + 6 : n)
    vibrer(coup.critique ? [10, 30, 25] : coup.grosLot ? [10, 20, 15] : 8)
    const c = couleurDe(coup.sorte)
    const texte = `+${abregeFin(coup.gain)}${brut ? '' : ` ${nomSortePluriel(coup.sorte)}`}${coup.critique ? ' !' : ''}${coup.grosLot ? ' ×3' : ''}`
    flotter(x, y, texte, `flottant-couleur flottant-couleur-${c}`, coup.critique ? 2 : coup.grosLot ? 1.6 : Math.min(1.7, 1 + n * 0.05))
    if (coup.critique) eclater(x, y, 22, couleurEclat(c))
    else if (coup.grosLot) eclater(x, y, 16, couleurEclat(c))
    else if (n > 0 && n % 10 === 9) eclater(x, y, 14, couleurEclat(c))
    else if (Math.random() < 0.3) eclater(x, y, 3, couleurEclat(c))
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
    const ta = tailleDe(p)
    if (el !== undefined) {
      el.style.left = `${x - ta.largeur / 2}px`
      el.style.top = `${y - ta.hauteur / 2}px`
    }
    for (const mo of modulesDe(j, p)) placerModule(mo.id, placeSurProducteur({ x, y, type: p.type }, mo.emplacement))
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
      if (pr === undefined || estFixe(pr)) return false
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
      // Une tape : le générateur se déclenche.
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

  /** L'AMÉLIORATION d'un module depuis sa bulle : un niveau de plus, et le module le montre. */
  const ameliorerIci = (mo: Module, bouton: HTMLElement): void => {
    if (!peutAmeliorer(j, mo)) return
    effetDepense(bouton.getBoundingClientRect(), coutNiveau(mo).quantite)
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

  /** L'AMÉLIORATION d'une source depuis sa feuille : son lot grandit (Keko : « j'investis dans le rouge pour augmenter sa prod »). */
  const ameliorerSourceIci = (p: Producteur, bouton: HTMLElement): void => {
    if (!peutAmeliorerSource(j, p)) return
    effetDepense(bouton.getBoundingClientRect(), coutNiveauSource(p).quantite)
    agir(() => {
      ameliorerSource(j, p)
    })
    sonBatir()
    vibrer([20, 30, 40])
    const s = surLaPage({ x: p.x, y: p.y })
    if (s !== null) {
      eclater(s.x, s.y, 14, couleurEclat(p.couleur))
      flotter(s.x, s.y - 10, `niveau ${p.niveau}`, 'flottant-or', 1.2)
    }
    if (!mouvementReduit()) producteursEl.current.get(p.id)?.animate(ECRASER, { duration: 220, easing: 'ease-out' })
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

  /**
   * RÉCOLTER la réserve de la mine d'une tape : ses pièces volent au compteur, qui ne bouge qu'à leur arrivée. Plus la récolte est grosse,
   * plus tout est fort (Keko, 02/11) : la réserve bondit et flashe, sa jauge se vide d'un trait, la carte tremble, le téléphone vibre plus
   * longtemps (le reste : `effetRecolte`).
   */
  const recolterIci = (p: Producteur, cible: HTMLElement): void => {
    const r = cible.getBoundingClientRect()
    const capacite = capaciteReserve(j, p)
    const fait = { or: 0 }
    agirRef.current(() => {
      fait.or = recolter(j, p)
    })
    if (fait.or < 1) {
      vibrer([10, 30, 10])
      return
    }
    const k = intensiteRecolte(fait.or, capacite)
    effetRecolte(r, fait.or, k, estConstruit(p) ? ressourceDe(p) : undefined)
    vibrer(k < 0.35 ? [15, 30, 40] : [20, 30, 40, 30, Math.round(60 + 140 * k)])
    if (mouvementReduit()) return
    cible.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: `scale(${0.9 - 0.06 * k}, ${0.86 - 0.08 * k})`, filter: `brightness(${1.3 + 1.2 * k})`, offset: 0.18 },
        { transform: `scale(${1.08 + 0.16 * k}, ${1.12 + 0.2 * k})`, filter: `brightness(${1.6 + 1.6 * k})`, offset: 0.42 },
        { transform: 'scale(0.97)', offset: 0.7 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 380 + 260 * k, easing: 'ease-out' },
    )
    // La jauge se vide d'un trait, sans attendre (elle attend d'ordinaire la pièce qui arrive). En style posé à la main : React ne touche
    // que la largeur, alors que la classe de la réserve, elle, est réécrite quand la réserve cesse d'être pleine.
    const jauge = cible.querySelector<HTMLElement>('.reserve-jauge')
    if (jauge !== null) {
      jauge.style.transition = 'width 0.32s cubic-bezier(0.6, 0, 0.8, 0.4)'
      window.setTimeout(() => (jauge.style.transition = ''), 700)
    }
    // La carte tremble, d'autant plus que la récolte est grosse.
    if (k > 0.25) {
      const a = 3 + 9 * k
      cadre.current?.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${-a}px, ${a * 0.5}px)` },
          { transform: `translate(${a * 0.8}px, ${-a * 0.6}px)` },
          { transform: `translate(${-a * 0.5}px, ${-a * 0.3}px)` },
          { transform: `translate(${a * 0.3}px, ${a * 0.4}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 220 + 260 * k, easing: 'ease-out' },
      )
    }
  }

  /** UNE QUÊTE ACCOMPLIE d'elle-même (un niveau, une construction) : sa carte éclate, la suivante naît à sa place — ou, après la dernière, il n'y en a plus. */
  const feterLaQuete = (queteAvant: number, carteAvant: DOMRect | undefined): void => {
    if (j.quete <= queteAvant) return
    window.setTimeout(() => {
      const carte = objectifEl.current
      const r = carte?.getBoundingClientRect() ?? carteAvant
      if (r === undefined) return
      sonEtape()
      carte?.classList.add('piece-nait')
      eclater(r.left + r.width / 2, r.top + r.height / 2, 26)
      flotter(r.left + r.width / 2, r.top - 6, 'Quête accomplie !', 'flottant-or', 1.2)
    }, 380)
  }

  /**
   * CONSTRUIRE un producteur depuis le menu de construction (Keko, 02/11) : le menu se ferme, le producteur naît à côté de la banque, la
   * carte se recadre pour les montrer tous, et les pièces du prix volent du compteur vers lui.
   */
  const construireIci = (type: number): void => {
    const queteAvant = j.quete
    const carteAvant = objectifEl.current?.getBoundingClientRect()
    const prix = prixConstruction(j)
    const marcheAvant = marcheOuvert(j)
    const fait: { p: Producteur | null } = { p: null }
    agir(() => {
      fait.p = construire(j, type)
    })
    const p = fait.p
    if (p === null) return
    setMenuConstruction(false)
    sonBatir()
    vibrer([20, 30, 60])
    window.setTimeout(() => carte.current?.centrer(), 60)
    faireNaitre(
      () => producteursEl.current.get(p.id),
      (r) => {
        if (prix.or > 0) effetDepense(r, prix.or)
        flotter(r.left + r.width / 2, r.top + r.height * 0.2, `${nomProducteur(p)} construite !`, 'flottant-or', 1.4)
      },
      60 + DUREE_GLISSE,
    )
    feterLaQuete(queteAvant, carteAvant)
    // LE MARCHÉ naît avec le premier producteur.
    if (!marcheAvant && marcheOuvert(j)) faireNaitre(() => document.querySelector<HTMLElement>('.bouton-marche'), undefined, 420)
  }

  /** ACHETER une ressource au marché : les pièces partent du compteur d'or vers le bouton, la ressource vole du bouton à son compteur. */
  const acheterRessourceIci = (r: Ressource, q: number, bouton: HTMLElement): void => {
    const fait = { prix: 0 }
    agir(() => {
      fait.prix = acheterRessource(m, j, r, q)
    })
    if (fait.prix <= 0) return
    const rect = bouton.getBoundingClientRect()
    effetDepense(rect, fait.prix)
    vibrer([10, 20])
    window.setTimeout(() => effetRessource(rect, r, q), 260)
  }

  /** VENDRE une ressource au marché : ses pièces volent du bouton au compteur d'or, qui ne bouge qu'à leur arrivée. */
  const vendreRessourceIci = (r: Ressource, q: number, bouton: HTMLElement): void => {
    const fait = { gain: 0 }
    agir(() => {
      fait.gain = vendreRessource(m, j, r, q)
    })
    vibrer([10, 20, 10])
    if (fait.gain > 0) effetVente(bouton.getBoundingClientRect(), fait.gain)
  }

  /** Ce qui apparaît (le bouton des améliorations, la réserve) naît et éclate, une fois peint ; `puis` le suit, depuis sa place. */
  const faireNaitre = (trouver: () => HTMLElement | null | undefined, puis?: (r: DOMRect) => void, apres = 60): void => {
    window.setTimeout(() => {
      const el = trouver()
      if (el === null || el === undefined) return
      el.classList.add('piece-nait')
      const r = el.getBoundingClientRect()
      eclater(r.left + r.width / 2, r.top + r.height / 2, 22)
      onde(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.7)
      puis?.(r)
    }, apres)
  }

  /**
   * MONTER LA MINE D'UN NIVEAU depuis son menu (Keko, 02/11) : le menu se ferme, les pièces du prix partent du compteur vers la mine,
   * « Niveau N ! » éclate dessus. Le premier niveau : la réserve naît, l'automatique est en marche. Les suivants : le choix de trois
   * améliorations s'ouvre, le temps de voir l'éclat.
   */
  const monterIci = (mine: Producteur): void => {
    // La banque, ou un producteur construit (Keko, 02/11 : « un bouton level sur les producteurs, comme la banque ») : son prix en or, son gain.
    const banque = estMine(mine)
    const prix = banque ? prixNiveauMine(mine) : prixNiveauProducteur(mine).or
    const gain = banque ? gainNiveauMine(j) : gainNiveauProducteur(mine)
    const queteAvant = j.quete
    const carteAvant = objectifEl.current?.getBoundingClientRect()
    const constructionAvant = constructionOuverte(j)
    const fait = { ok: false }
    agir(() => {
      fait.ok = banque ? monterLaMine(m, j, mine) : monterLeProducteur(m, j, mine)
    })
    if (!fait.ok) return
    feterLaQuete(queteAvant, carteAvant)
    // LE BOUTON DE CONSTRUCTION naît avec la quête qui le demande.
    if (!constructionAvant && constructionOuverte(j)) faireNaitre(() => document.querySelector<HTMLElement>('.bouton-construire'))
    setMenuDe(null)
    sonBatir()
    vibrer([20, 30, 60])
    const el = producteursEl.current.get(mine.id)
    const bouton = el?.querySelector<HTMLElement>('.mine-ameliorer')
    if (bouton !== null && bouton !== undefined) {
      const r = bouton.getBoundingClientRect()
      if (prix > 0) effetDepense(r, prix)
      eclater(r.left + r.width / 2, r.top + r.height / 2, 26)
      onde(r.left + r.width / 2, r.top + r.height / 2, r.width)
      if (!mouvementReduit()) el?.animate(ECRASER, { duration: 220, easing: 'ease-out' })
    }
    const nom = el?.querySelector('.mine-nom')?.getBoundingClientRect()
    if (nom !== undefined) flotter(nom.left + nom.width / 2, nom.top - 10, `Niveau ${mine.niveau} !`, 'flottant-or', 1.5)
    if (gain === 'automatique') {
      faireNaitre(
        () => el?.querySelector<HTMLElement>('.reserve'),
        (r) => flotter(r.left + r.width / 2, r.top - 6, 'L’automatique est en marche !', 'flottant-or', 1.2),
      )
      return
    }
    window.setTimeout(() => setChoixDe(mine.id), 650)
  }

  /** Une pépite quitte l'écran (tapée ou perdue) : son minuteur s'arrête. */
  const retirerPepite = (cle: number): void => {
    window.clearTimeout(minuteursPepites.current.get(cle))
    minuteursPepites.current.delete(cle)
    pepitesRef.current = pepitesRef.current.filter((pe) => pe.cle !== cle)
    setPepitesVues(pepitesRef.current)
  }

  /** RAMASSER une pépite d'une tape : son or vole au compteur. */
  const ramasserIci = (cle: number, cible: HTMLElement): void => {
    const r = cible.getBoundingClientRect()
    retirerPepite(cle)
    const fait = { or: 0 }
    agirRef.current(() => {
      fait.or = ramasserPepite(j)
    })
    if (fait.or <= 0) return
    effetVente(r, fait.or)
    eclater(r.left + r.width / 2, r.top + r.height / 2, 20)
    vibrer([10, 20, 40])
  }

  /** CHOISIR une amélioration de l'offre : la carte éclate, la feuille se ferme, la mine annonce ce qu'elle a gagné. */
  const choisirIci = (p: Producteur, id: string, carte: HTMLElement): void => {
    const r = carte.getBoundingClientRect()
    const banque = estMine(p)
    const fait = { ok: false }
    agir(() => {
      fait.ok = banque ? choisirAmelioration(j, id as IdAmelioration) : choisirAmeliorationProducteur(p, id as IdAmeliorationProducteur)
    })
    if (!fait.ok) return
    sonBatir()
    vibrer([20, 40, 80])
    eclater(r.left + r.width / 2, r.top + r.height / 2, 30)
    setChoixDe(null)
    const s = surLaPage({ x: p.x, y: p.y })
    if (s !== null) {
      const nom = banque ? NOM_AMELIORATION[id as IdAmelioration] : NOM_AMELIORATION_PRODUCTEUR[id as IdAmeliorationProducteur]
      const niveau = banque ? j.ameliorations[id as IdAmelioration] : niveauAP(p, id as IdAmeliorationProducteur)
      window.setTimeout(() => {
        eclater(s.x, s.y, 22)
        flotter(s.x, s.y - 40, `${nom}${niveau > 1 ? ` · niveau ${niveau}` : ''}`, 'flottant-or', 1.4)
      }, 250)
    }
  }

  /** RÉCLAMER la quête remplie : sa récompense se débloque, la carte de la quête cède la place à ce qu'elle a débloqué. */
  const objectifEl = useRef<HTMLDivElement>(null)
  const reclamerIci = (): void => {
    const r = objectifEl.current?.getBoundingClientRect()
    const fait: { q: Quete | null } = { q: null }
    agir(() => {
      fait.q = reclamerQuete(m, j)
    })
    if (fait.q === null) return
    sonEtape()
    vibrer([20, 30, 60])
    if (r !== undefined) {
      eclater(r.left + r.width / 2, r.top + r.height / 2, 26)
      flotter(r.left + r.width / 2, r.top - 6, 'Les améliorations sont ouvertes !', 'flottant-or', 1.2)
    }
    // LE BOUTON DES AMÉLIORATIONS APPARAÎT en haut à droite de la mine : il naît, éclate.
    const mine = j.producteurs.find(estMine)
    faireNaitre(() => (mine === undefined ? undefined : producteursEl.current.get(mine.id)?.querySelector<HTMLElement>('.mine-ameliorer')))
  }

  /** ACHETER au marché, depuis la feuille d'un transformateur, la matière qui manque à son prochain coup. */
  const acheterPourIci = (p: Producteur, bouton: HTMLElement): void => {
    const achats = manquesDe(j, p)
    const cout = achats.reduce((s, a) => s + coutAchat(m, a.sorte, a.quantite), 0)
    if (achats.length === 0 || j.or + 1e-9 < cout) return
    effetDepense(bouton.getBoundingClientRect(), cout)
    vibrer([10, 20])
    agir(() => {
      for (const a of achats) acheter(m, j, a.sorte, a.quantite)
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
        // Une pépite tombée se ramasse.
        if (cible !== null && cible.dataset['pepite'] !== undefined) {
          ramasserIci(Number(cible.dataset['pepite']), cible)
          return
        }
        // La mine de départ est cliquable, pas saisissable : le doigt qui glisse dessus emporte la carte, pas la mine.
        const id = cible === null ? NaN : Number(cible.dataset['id'])
        const pr = Number.isNaN(id) ? undefined : producteurDe(j, id)
        // La réserve de la mine se tape à part : elle se récolte, la mine ne se déclenche pas.
        if (pr !== undefined && cible !== null && cible.dataset['reserve'] !== undefined) recolterIci(pr, cible)
        // Le bouton des améliorations aussi : il ouvre leur menu.
        else if (pr !== undefined && cible !== null && cible.dataset['ameliorer'] !== undefined) setMenuDe(pr.id)
        else if (pr !== undefined) declencherIci(pr, sx, sy)
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

  // LES PÉPITES : autant à l'écran que le moteur en compte ; une neuve jaillit de la mine et se pose sur son carré, puis se perd si on ne la tape pas à temps.
  useEffect(() => {
    const vues = pepitesRef.current
    const mine = j.producteurs.find(estMine)
    if (mine === undefined || vues.length === j.pepites) return
    if (vues.length > j.pepites) {
      for (const pe of vues.slice(0, vues.length - j.pepites)) retirerPepite(pe.cle)
      return
    }
    const neuves: PepiteVue[] = []
    for (let k = vues.length; k < j.pepites; k++) {
      const cle = prochainePepite.current++
      const x = mine.x + (Math.random() * 2 - 1) * 160
      const y = mine.y - 190 + Math.random() * 200
      neuves.push({ cle, x, y, dx: mine.x - x, dy: mine.y + 20 - y })
      minuteursPepites.current.set(
        cle,
        window.setTimeout(() => {
          retirerPepite(cle)
          agirRef.current(() => {
            perdrePepite(j)
          })
        }, EFFETS_MINE.pepiteDuree * 1000),
      )
    }
    pepitesRef.current = [...vues, ...neuves]
    setPepitesVues(pepitesRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j.pepites])
  useEffect(() => {
    const minuteurs = minuteursPepites.current
    return () => {
      for (const id of minuteurs.values()) window.clearTimeout(id)
    }
  }, [])

  // L'installation grandit : le zoom normal suit.
  useEffect(() => {
    const [r, b, z] = cadrage()
    carte.current?.cadrer(r, b, z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rayon, bas])

  /** Jusqu'à cet instant, la barre de la mine se montre PLEINE : elle vient d'envoyer sa pièce, on la voit pleine avant qu'elle ne se vide. */
  const barrePleineJusqua = useRef(new Map<number, number>())

  /**
   * UNE BARRE PLEINE : elle reste pleine un instant, gonfle et s'allume ; le « +1 » pompe ; sa pièce vole. Finie par une tape, au compteur
   * de la bourse ; finie par l'automatique (`versLaReserve`), à la réserve, qui pompe et tinte à chaque arrivée. Le compteur visé ne bouge
   * qu'à l'arrivée.
   */
  const lacherLaPiece = (el: HTMLElement | undefined, p: Producteur, gain: number, versLaReserve = false): void => {
    barrePleineJusqua.current.set(p.id, performance.now() + 170)
    const depuis = el?.querySelector('.mine-barre-gain [role="img"]')?.getBoundingClientRect()
    // Une tape : un producteur construit envoie sa ressource à son compteur ; la banque, son or à la bourse.
    if (depuis !== undefined && !versLaReserve) {
      if (estConstruit(p)) effetRessource(depuis, ressourceDe(p), gain)
      else effetVente(depuis, gain)
    }
    const reserve = el?.querySelector<HTMLElement>('.reserve')
    const vers = reserve?.querySelector('.reserve-texte [role="img"]')?.getBoundingClientRect()
    if (versLaReserve && depuis !== undefined && reserve !== null && reserve !== undefined && vers !== undefined) {
      const n = Math.max(1, Math.min(5, Math.round(gain)))
      const capacite = capaciteReserve(j, p)
      volerDesPieces(
        depuis,
        vers,
        n,
        (rang) => {
          const pleine = rang === n - 1 && reservePleine(j, p)
          sonReserve((p.reserve - (n - 1 - rang)) / capacite, pleine)
          pomperLaReserve(reserve, vers, pleine)
        },
        55,
        estConstruit(p) ? `piece piece-${ressourceDe(p)}` : 'piece',
      )
    }
    if (mouvementReduit()) return
    el?.querySelector('.mine-barre')?.animate(
      [
        { transform: 'scaleY(1)', filter: 'brightness(1)' },
        { transform: 'scaleY(1.45)', filter: 'brightness(2.1)', offset: 0.3 },
        { transform: 'scaleY(1)', filter: 'brightness(1)' },
      ],
      { duration: 320, easing: 'ease-out' },
    )
    // LE « +1 » ÉCLATE (Keko, 02/11 : « ça manque de juice au moment du remplissage, sur le chiffre à droite de la barre ») : grand rebond qui vacille, éclair d'or, la pièce tourne sur elle-même en partant ; étincelles et onde.
    const gainEl = el?.querySelector<HTMLElement>('.mine-barre-gain')
    gainEl?.animate(
      [
        { transform: 'scale(1.35) rotate(0deg)', filter: 'brightness(1.2) drop-shadow(0 0 6px rgba(255, 214, 90, 0.9))' },
        { transform: 'scale(2.1) rotate(-8deg)', filter: 'brightness(2) drop-shadow(0 0 18px rgba(255, 214, 90, 1))', offset: 0.25 },
        { transform: 'scale(0.88) rotate(5deg)', offset: 0.58 },
        { transform: 'scale(1.06) rotate(-2deg)', offset: 0.8 },
        { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1) drop-shadow(0 0 0 rgba(255, 214, 90, 0))' },
      ],
      { duration: 560, easing: 'ease-out' },
    )
    gainEl?.querySelector('[role="img"]')?.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(720deg)' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.3,1)' })
    if (depuis !== undefined) {
      const cx = depuis.left + depuis.width / 2
      const cy = depuis.top + depuis.height / 2
      eclater(cx, cy, 16, '#ffe27a')
      onde(cx, cy, 44)
    }
  }

  // LES BARRES — la banque, les producteurs construits : posées image par image (la tape les fait bondir, l'automatique pousse celle de la banque chaque seconde) ; pleines un instant quand elles viennent de payer.
  useEffect(() => {
    let image = 0
    const montres = new Map<number, number>()
    const pas = (maintenant: number): void => {
      const dt = Math.min(0.05, (maintenant - avant) / 1000)
      avant = maintenant
      for (const p of j.producteurs) {
        if (!estMine(p) && !estConstruit(p)) continue
        const el = producteursEl.current.get(p.id)
        if (el === undefined) continue
        const cible = maintenant < (barrePleineJusqua.current.get(p.id) ?? 0) ? 1 : Math.min(1, p.progres)
        // Elle MONTE en glissant (vite, sans rebond), et redescend d'un coup quand elle a payé.
        const avantMontre = montres.get(p.id) ?? 0
        const montre = cible < avantMontre - 0.001 ? cible : avantMontre + (cible - avantMontre) * (1 - Math.exp(-dt * 24))
        montres.set(p.id, montre)
        const remplie = el.querySelector<HTMLElement>('.mine-barre-remplie')
        if (remplie !== null) remplie.style.transform = `scaleX(${montre})`
        const tete = el.querySelector<HTMLElement>('.mine-barre-tete')
        if (tete !== null) tete.style.left = `${montre * 100}%`
        // 8 tapes de 10 % font 0,7999… : le seuil a sa marge.
        el.querySelector('.mine-barre')?.classList.toggle('mine-barre-presque', cible >= 0.795 && cible < 1)
        // Le « +1 » grossit et s'éclaire à mesure que la barre se remplit : on voit venir la pièce.
        el.querySelector<HTMLElement>('.mine-barre-gain')?.style.setProperty('--plein', montre.toFixed(3))
      }
      image = requestAnimationFrame(pas)
    }
    let avant = performance.now()
    image = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(image)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L'AUTOMATIQUE A FINI LA BARRE : sa pièce vole de la barre à la réserve (seul l'automatique remplit la réserve : la tape paie la bourse), qui
  // pompe et tinte à l'arrivée, plus fort quand elle devient pleine. Le retard du compteur de la réserve se pose PENDANT le rendu, avant
  // que ce compteur (un enfant) ne voie sa nouvelle valeur.
  // Chaque bâtiment à réserve — la banque, les producteurs construits — a la sienne, et son compteur sa clé (`reserve-<id>`).
  const reservesVues = useRef(new Map<number, number>())
  const aVerser = useRef(new Map<number, number>())
  for (const p of j.producteurs) {
    if (!estMine(p) && !estConstruit(p)) continue
    const entiere = Math.floor(p.reserve + 1e-9)
    const vue = reservesVues.current.get(p.id)
    if (vue !== undefined && entiere > vue) {
      aVerser.current.set(p.id, (aVerser.current.get(p.id) ?? 0) + entiere - vue)
      if (!mouvementReduit()) retarderLeCompteur(`reserve-${p.id}`, DUREE_VOL)
    }
    reservesVues.current.set(p.id, entiere)
  }
  useEffect(() => {
    for (const [id, gain] of aVerser.current) {
      const p = producteurDe(j, id)
      if (p !== undefined && gain > 0) lacherLaPiece(producteursEl.current.get(id), p, gain, true)
    }
    aVerser.current.clear()
  })

  // LES LOTS DES HORLOGES flottent au-dessus de leur source, à son rythme — quand il est assez lent pour qu'on les lise.
  useEffect(() => {
    const prochains = new Map<number, number>()
    const id = window.setInterval(() => {
      const maintenant = performance.now()
      const r = cadre.current?.getBoundingClientRect()
      if (r === undefined) return
      for (const p of j.producteurs) {
        if (!estSource(p)) continue
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
        const s = surLaPage({ x: p.x, y: p.y - tailleDe(p).hauteur / 2 })
        if (s !== null && s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom) flotter(s.x, s.y, `+${abregeFin(b.lotMoyen)}`, `flottant-couleur flottant-couleur-${p.couleur}`, 0.9)
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = traine.current
  const souteVisible = j.modules.length > 0
  const coutR1 = coutProducteur(j, FAMILLES.raffinerie.premier)
  const aHorloge = j.modules.some((mo) => mo.forme === 1 && aDuBleu(mo.couleur))
  const branchable = enSoute.some((mo) => meilleurePrise(m, j, mo) !== null)
  const raffineriePrete = raffineries.find((p) => disponible(j, p) >= 1)
  const fabricable = sortesFormees().some((s) => peutFabriquer(j, s, 0))
  const coutCarre = coutFabrication(j, sorteDe(0, 1), 0).quantite
  // La boutique n'apparaît que quand elle a quelque chose à montrer : rien tant que la mine est seule.
  const boutiqueVisible = PRODUCTEURS.some((_, i) => visibleProducteur(j, i)) || fabricable || j.modules.length > 0 || j.points > 0 || pointsSi(j) >= 1
  const aSources = j.producteurs.some(estSource)
  const mine = j.producteurs.find(estMine)

  // UN INDICE à la fois : le premier geste, puis ce qui bloque.
  let indice: ReactNode = null
  if (debut)
    indice = (
      <>
        Tapez la banque pour remplir sa barre : 1 <SymbolePiece /> par barre pleine.
      </>
    )
  else if (rien && mine !== undefined && mineArretee(j, mine)) indice = 'La réserve est pleine : tapez-la pour récolter ses pièces.'
  else if (rien && constructionOuverte(j) && !j.producteurs.some(estConstruit))
    indice = (
      <>
        Touchez « Construire » : une scierie ou une mine, pour {CONSTRUCTION.premier} <SymbolePiece />.
      </>
    )
  else if (rien && mine !== undefined && ameliorationsOuvertes(j) && j.automatisation === 0)
    indice = (
      <>
        Touchez la flèche de la banque : au niveau 2, pour {prixNiveauMine(mine)} <SymbolePiece />, l’automatique remplit sa barre même sans vous.
      </>
    )
  else if (rien && mine !== undefined && j.journal.recoltes === 0 && mine.reserve >= 1) indice = 'L’automatique remplit la réserve, même en votre absence : tapez-la pour récolter.'
  else if (rien) indice = null
  else if (aSources && raffineries.length === 0 && !peutPayer(j, coutR1)) indice = `Une raffinerie coûte ${coutR1.quantite} ronds d’une couleur : tapez vos sources.`
  else if (aSources && raffineries.length === 0) indice = 'Achetez une raffinerie dans la boutique : elle donne une forme à vos ronds.'
  else if (raffineries.length > 0 && j.modules.length === 0 && !fabricable && raffineriePrete !== undefined) indice = `Tapez la raffinerie : un module carré coûte ${coutCarre} carrés de sa couleur.`
  else if (raffineries.length > 0 && j.modules.length === 0 && !fabricable) indice = 'La raffinerie n’a plus de ronds à former : tapez la source de sa couleur.'
  else if (raffineries.length > 0 && j.modules.length === 0) indice = `Fabriquez un module dans la boutique, avec votre ${NOM_MATIERE} formée.`
  else if (branchable && t === null) indice = `Un module attend dans la ${NOM_SOUTE.toLowerCase()} : branchez-le.`
  else if (j.modules.length > 0 && !aHorloge) indice = `Pas d’horloge : réglez une raffinerie sur le ${nomSorte(sorteDe(2, 1))} (sa roue), et fabriquez-en un.`
  else if (fusibles(j).length > 0) indice = `Trois modules pareils dans la ${NOM_SOUTE.toLowerCase()} : fondez-les en un plus rare.`
  else if (branchees.size > 0 && j.modules.every((mo) => mo.niveau === 1) && bulle === null && j.modules.some((mo) => peutAmeliorer(j, mo))) indice = 'Tapez un module pour l’améliorer.'

  const choisi = bulle?.genre === 'module' ? moduleDe(j, bulle.id) : undefined
  const producteurChoisi = bulle?.genre === 'producteur' ? producteurDe(j, bulle.id) : undefined
  const placeChoisi = choisi === undefined ? undefined : dispo.get(choisi.id)
  const porteur = choisi === undefined || choisi.parent === null ? undefined : producteurDe(j, choisi.parent)
  // La bulle se pose au-dessus du module, ou dessous quand il est près du haut de l'écran (elle passerait sous l'en-tête).
  const ecranChoisi = placeChoisi === undefined ? undefined : carte.current?.versEcran(placeChoisi.x, placeChoisi.y)
  const bulleDessous = ecranChoisi !== undefined && ecranChoisi.y < 250
  const ecartBulle = placeChoisi === undefined ? 0 : boiteModule(placeChoisi).hauteur / 2 + PIECE.encoche.profondeur + 14

  // LES STOCKS du coin : les trois rondes toujours, puis les sortes qu'on a, les plus pleines d'abord.
  const stocksVus = [
    ...Array.from({ length: PRIMAIRES }, (_, c) => sorteDe(c, 0)),
    ...j.matiere
      .map((q, s) => [s, q] as const)
      .filter(([s, q]) => q >= 1 && !(s % FORMES === 0 && couleurDe(s) < PRIMAIRES))
      .sort((a, b) => b[1] - a[1])
      .slice(0, STOCKS_MAX - PRIMAIRES)
      .map(([s]) => s),
  ]

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

        {/* LES GÉNÉRATEURS : la mine de départ au centre, cliquable ; les autres saisissables. Pendant une saisie, celui qu'on tient se rend sous le doigt. */}
        {j.producteurs.map((p) => {
          const enMain = t !== null && t.genre === 'producteur' && t.id === p.id
          const x = enMain ? t.x : p.x
          const y = enMain ? t.y : p.y
          const b = bilanProducteur(j, p)
          const genre = genreDe(p)
          const brut = genre === 'source' || genre === 'mine' || genre === 'ressource'
          // Une mine à la réserve pleine s'arrête ; un transformateur sans matière aussi.
          const nourri = genre === 'mine' ? !mineArretee(j, p) : brut || disponible(j, p) >= 1
          const actif = genre !== 'mine' && genre !== 'ressource' && b.frequence > 0 && nourri
          const cadence = actif ? Math.min(60, Math.max(0.25, 1 / b.frequence)) : 0
          const ta = tailleDe(p)
          const bo = BOITES_PRODUCTEURS[p.type] ?? BOITES_PRODUCTEURS[0]!
          const style: CSSProperties & Record<string, string | number> = {
            left: x - ta.largeur / 2,
            top: y - ta.hauteur / 2,
            width: ta.largeur,
            height: ta.hauteur,
            '--cadence': `${cadence.toFixed(2)}s`,
            // La mine a la teinte de l'or.
            // La banque a la teinte de l'or ; la scierie, celle du bois ; la mine, celle de la pierre.
            '--teinte': genre === 'mine' ? 45 : genre === 'ressource' ? (ressourceDe(p) === 'bois' ? 30 : 225) : (TEINTES[p.couleur] ?? 0),
          }
          const classes = ['producteur', `producteur-${genre}`, estFixe(p) ? 'producteur-base' : 'producteur-achete']
          if (!brut) classes.push('producteur-transfo')
          if (actif) classes.push('producteur-actif')
          if (!brut && nourri) classes.push('atelier-pret')
          if (enMain) classes.push('producteur-saisi')
          if (producteurChoisi?.id === p.id) classes.push('producteur-choisi')
          const saisissable = estFixe(p) ? { 'data-cliquable': true } : { 'data-saisissable': true, 'data-genre': 'producteur' }
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
                viewBox={`${bo.x} ${bo.y} ${bo.largeur} ${bo.hauteur}`}
                style={{
                  left: bo.x + ta.largeur / 2,
                  top: bo.y + ta.hauteur / 2,
                  width: bo.largeur,
                  height: bo.hauteur,
                }}
                aria-hidden
              >
                <path d={CHEMINS_PRODUCTEURS[p.type] ?? ''} />
              </svg>
              <div className="producteur-texte">
                <TexteProducteur j={j} p={p} b={b} actif={actif} />
                {/* La roue d'un générateur : sa feuille. La mine n'a rien à régler pour l'instant. */}
                {genre !== 'mine' && genre !== 'ressource' && (
                  <button
                    type="button"
                    className="atelier-reglage"
                    data-hud
                    aria-label={`Régler ${nomProducteur(p)}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setBulle((bu) => (bu?.genre === 'producteur' && bu.id === p.id ? null : { genre: 'producteur', id: p.id }))
                      vibrer(6)
                    }}
                  >
                    ⚙
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* LES MODULES emboîtés : ceux de la soute ne sont pas sur la carte. */}
        {j.modules.map((mo) => {
          let place = dispo.get(mo.id)
          if (t !== null && t.genre === 'module' && t.id === mo.id) place = t.prise !== null ? t.prise.place : { x: t.x, y: t.y, sens: t.sens }
          else if (t !== null && t.genre === 'producteur' && mo.parent === t.id) place = placeSurProducteur({ x: t.x, y: t.y, type: producteurDe(j, t.id)?.type }, mo.emplacement)
          if (place === undefined) return null
          const branche = branchees.has(mo.id)
          const vers = DIRECTIONS[(place.sens + 2) % 4]!
          const f = force(mo)
          const horloge = mo.forme === 1 && aDuBleu(mo.couleur)
          const tics = horloge ? (effetsDe(mo, f).find(([cible]) => cible === 2)?.[1] ?? 0) : 0
          const periode = tics > 0 ? Math.min(60, Math.max(0.3, 1 / tics)) : 0
          const style: CSSProperties & Record<string, string | number> = {
            left: place.x - DEMI_L,
            top: place.y - DEMI_P,
            width: MODULE.largeur,
            height: MODULE.profondeur,
            '--teinte': TEINTES[mo.couleur] ?? 0,
            '--sens': place.sens,
            '--dx': `${vers.x * 8}px`,
            '--dy': `${vers.y * 8}px`,
            '--cadence': `${periode.toFixed(2)}s`,
          }
          const classes = ['module', `rarete-${mo.rarete}`, branche ? 'module-branche' : 'module-pose']
          if (branche && horloge) classes.push('module-horloge')
          if (mo.couleur >= PRIMAIRES) classes.push('module-mixte')
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
                <path d={CHEMINS_MODULES[mo.forme] ?? ''} />
              </svg>
              <b>{texteEffet(mo.couleur, mo.forme, f)}</b>
              <small>
                {majuscule(nomSorte(sorteDe(mo.couleur, mo.forme)))} · niv. {mo.niveau}
                {mo.rarete > 0 && <span className="module-rarete"> · {NOM_RARETE[mo.rarete]}</span>}
                {mo.trait !== null && <span className="module-trait"> · {NOM_TRAIT[mo.trait]}</span>}
              </small>
            </div>
          )
        })}

        {/* LES PÉPITES tombées : une tape les ramasse ; elles clignotent avant de se perdre. */}
        {pepitesVues.map((pe) => (
          <div
            key={pe.cle}
            className="pepite"
            data-cliquable
            data-pepite={pe.cle}
            aria-label="Pépite"
            style={{ left: pe.x - 50, top: pe.y - 50, '--depuis-x': `${pe.dx}px`, '--depuis-y': `${pe.dy}px`, '--duree': `${EFFETS_MINE.pepiteDuree}s` } as CSSProperties}
          />
        ))}

        {/* LA BULLE d'un module tapé : son niveau, son effet, et le bouton pour le monter. Elle garde sa taille à l'écran (`--zoom`). */}
        {choisi !== undefined && placeChoisi !== undefined && (
          <div
            className={`bulle${bulleDessous ? ' bulle-dessous' : ''}`}
            data-hud
            style={bulleDessous ? { left: placeChoisi.x, top: placeChoisi.y + ecartBulle } : { left: placeChoisi.x, bottom: -(placeChoisi.y - ecartBulle) }}
          >
            <span className="bulle-titre">
              <Glyphe couleur={choisi.couleur} forme={choisi.forme} /> <b>{majuscule(nomSorte(sorteDe(choisi.couleur, choisi.forme)))}</b>{' '}
              <span className={`rarete-${choisi.rarete}`}>{NOM_RARETE[choisi.rarete]}</span> <span className="sourd">niveau {choisi.niveau}</span>
            </span>
            <span className="petit sourd">{majuscule(explicationModule(choisi.couleur, choisi.forme))}.</span>
            {choisi.trait !== null && (
              <span className="petit">
                <b>{NOM_TRAIT[choisi.trait]}</b> : {EXPLICATION_TRAIT[choisi.trait]}
              </span>
            )}
            <span className="petit">
              {texteEffet(choisi.couleur, choisi.forme, force(choisi))} → <span className="gain">{texteEffet(choisi.couleur, choisi.forme, force({ ...choisi, niveau: choisi.niveau + 1 }))}</span> au niveau{' '}
              {choisi.niveau + 1}
            </span>
            {porteur !== undefined && <BilanDuPorteur j={j} porteur={porteur} module={choisi} />}
            <BoutonCout j={j} cout={coutNiveau(choisi)} texte="Améliorer" onClick={(e) => ameliorerIci(choisi, e.currentTarget)} />
            <button type="button" className="bouton-discret" onClick={() => debrancherIci(choisi)}>
              Débrancher → {NOM_SOUTE.toLowerCase()}
            </button>
          </div>
        )}
      </div>

      {/* LES COMMANDES par-dessus la carte : elles ne glissent pas avec elle. */}
      <div className="carte-hud">
        <span className="carte-zoom" ref={zoomVu}>
          ×1,0
        </span>
        {(rondes >= 10 || j.matiere.some((q) => q >= 1)) && (
          <div className="stocks">
            {stocksVus.map((s) => (
              <button key={s} type="button" className={`stock${s % FORMES === 0 && couleurDe(s) < PRIMAIRES ? ' stock-mienne' : ''}`} onClick={versMarche} title={nomSortePluriel(s)}>
                <SymboleSorte sorte={s} />
                <Compteur valeur={j.matiere[s] ?? 0} format={abrege} duree={300} />
              </button>
            ))}
          </div>
        )}
        <div className={`carte-actions${avecBarre ? ' carte-actions-barre' : ''}`}>
          <Objectif j={j} refCarte={objectifEl} onReclamer={reclamerIci} />
          {indice !== null && <p className="carte-indice">{indice}</p>}
          <div className="carte-actions-ligne">
            {boutiqueVisible && (
              <button
                type="button"
                className={(raffineries.length === 0 && peutPayer(j, coutR1)) || (j.modules.length === 0 && fabricable) ? 'respire' : ''}
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
            {/* LE BOUTON DE CONSTRUCTION (Keko, 02/11 : « un bouton sur l'UI qui ouvre le menu de construction ») : là dès la quête qui le demande ; il respire tant qu'on n'a rien construit et que l'or suffit. */}
            {constructionOuverte(j) && (
              <button
                type="button"
                className={`bouton-construire${!j.producteurs.some(estConstruit) && j.or + 1e-9 >= CONSTRUCTION.premier ? ' respire' : ''}`}
                onClick={() => {
                  setBulle(null)
                  setMenuConstruction(true)
                }}
              >
                Construire
              </button>
            )}
            {/* LE BOUTON DU MARCHÉ (Keko, 02/11), là dès le premier producteur. */}
            {marcheOuvert(j) && (
              <button
                type="button"
                className="bouton-marche"
                onClick={() => {
                  setBulle(null)
                  setMenuMarche(true)
                }}
              >
                Marché
              </button>
            )}
            <button type="button" onClick={() => carte.current?.centrer()}>
              Centrer
            </button>
          </div>
          {production > 0 && <span className="carte-auto petit sourd">{parSeconde(production)} de ronds par vos horloges</span>}
        </div>
      </div>
      {boutique && (
        <Boutique
          partie={partie}
          agir={agir}
          onFermer={() => setBoutique(false)}
          onProducteur={(p) => naitre('producteur', p.id, p.x, p.y)}
          onModule={() => versLaSoute(null, '')}
        />
      )}
      {/* LA FEUILLE d'un générateur (sa roue) : son réglage (ce qu'il travaille), son niveau (une source), ce qui lui manque. */}
      {producteurChoisi !== undefined && (
        <Feuille titre={nomProducteur(producteurChoisi)} onFermer={() => setBulle(null)}>
          <FeuilleProducteur m={m} j={j} p={producteurChoisi} agir={agir} onAcheter={acheterPourIci} onAmeliorer={ameliorerSourceIci} />
        </Feuille>
      )}
      {/* LE CHOIX d'une amélioration, qu'ouvre un niveau gagné. */}
      {choixVu !== undefined && <ChoixAmelioration j={j} p={choixVu} onChoisir={(id, carte) => choisirIci(choixVu, id, carte)} onFermer={() => setChoixDe(null)} />}
      {/* LE MENU DE CONSTRUCTION, qu'ouvre son bouton. */}
      {menuConstruction && <MenuConstruction j={j} onConstruire={construireIci} onFermer={() => setMenuConstruction(false)} />}
      {/* LE MARCHÉ DES RESSOURCES, qu'ouvre son bouton. */}
      {menuMarche && <MenuMarche m={m} j={j} onAcheter={acheterRessourceIci} onVendre={vendreRessourceIci} onFermer={() => setMenuMarche(false)} />}
      {/* LE MENU DES AMÉLIORATIONS, qu'ouvre le bouton en haut à droite. */}
      {menuVu !== undefined && (
        <MenuAmeliorations
          j={j}
          p={menuVu}
          onMonter={() => monterIci(menuVu)}
          onChoisir={() => {
            setMenuDe(null)
            setChoixDe(menuVu.id)
          }}
          onFermer={() => setMenuDe(null)}
        />
      )}
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
            flotter(x, y - 10, `${majuscule(nomSorte(sorteDe(mo.couleur, mo.forme)))} ${NOM_RARETE[mo.rarete]}`, `flottant-rarete flottant-rarete-${mo.rarete}`, 1.2)
          }}
        />
      )}
    </div>
  )
}

/** Ce qui manque à un transformateur pour son prochain coup, sorte par sorte : son lot de chaque entrée. */
function manquesDe(j: Joueur, p: Producteur): { sorte: number; quantite: number }[] {
  const lot = Math.max(1, Math.ceil(lotDeBase(p)))
  return entrees(p)
    .map((s) => ({ sorte: s, quantite: Math.ceil(lot - (j.matiere[s] ?? 0)) }))
    .filter((a) => a.quantite > 0)
}

/**
 * L'OBJECTIF du moment, au-dessus des commandes : la QUÊTE en cours, sa jauge,
 * sa récompense s'il y en a une, « Réclamer » quand elle est remplie. Le choix
 * d'un niveau de la mine n'y passe pas : c'est l'effet du niveau, pas une
 * récompense de quête (Keko, 02/11) ; il attend dans le menu de la mine.
 */
function Objectif({ j, refCarte, onReclamer }: { j: Joueur; refCarte: React.RefObject<HTMLDivElement | null>; onReclamer: () => void }): ReactElement | null {
  const q = queteEnCours(j)
  if (q !== null) {
    const fait = progresQuete(j)
    const but = Math.max(1, objectifQuete(j))
    const accomplie = queteAccomplie(j)
    // La quête du premier producteur : lui, et la ressource qu'il faut acheter.
    const premier = premierConstruit(j)
    const manquante = ressourceManquante(j)
    return (
      <div key={`quete-${q.id}`} ref={refCarte} className={`objectif${accomplie ? ' objectif-accompli' : ''}`}>
        <span className="objectif-titre">Quête</span>
        <span className="objectif-texte">
          {q.objectif === 'niveau' ? (
            <>Améliorer la banque au niveau {q.but}</>
          ) : q.objectif === 'construction' ? (
            <>Construisez un producteur</>
          ) : q.objectif === 'niveauProducteur' ? (
            <>
              Passer la {premier === undefined ? 'production' : nomProducteur(premier).toLowerCase()} au niveau {q.but}
            </>
          ) : (
            <>
              Gagner {q.but} <SymbolePiece />
            </>
          )}
        </span>
        {/* Une jauge pour l'or à gagner ; pas pour un niveau de la mine (Keko, 02/11). */}
        {q.objectif === 'or' && (
          <span className="objectif-jauge">
            <span style={{ width: `${(100 * fait) / but}%` }} />
          </span>
        )}
        <span className="objectif-ligne">
          <span className="petit sourd">
            {q.objectif === 'construction' ? (
              <>une scierie ou une mine, dans « Construire »</>
            ) : q.objectif === 'niveauProducteur' ? (
              <>{manquante === null ? '' : `${LE_RESSOURCE[manquante]} qui manque s’achète au « Marché »`}</>
            ) : q.objectif === 'niveau' ? (
              <>
                niveau {fait} / {but}
              </>
            ) : (
              <>
                {possede(fait)} / {but} <SymbolePiece />
              </>
            )}
            {q.recompense !== 'aucune' && <> · récompense : {NOM_RECOMPENSE[q.recompense]}</>}
          </span>
          {accomplie && q.recompense !== 'aucune' && (
            <button type="button" className="bouton-principal respire" onClick={onReclamer}>
              Réclamer
            </button>
          )}
        </span>
      </div>
    )
  }
  return null
}

/**
 * LE JUICE DE LA RÉSERVE quand une pièce y tombe (Keko, 02/11 : « quand la
 * réserve se remplit, je veux plus de juice, avec pump des chiffres et de la
 * barre, petit effet de lumière ») : la réserve gonfle et rebondit sous un
 * halo d'or, son nombre grossit en brillant, sa jauge s'allume et un reflet la
 * balaie, une onde et des étincelles partent du point d'impact. Pleine : plus
 * fort, et une seconde onde, large, autour de la réserve.
 */
function pomperLaReserve(reserve: HTMLElement, impact: DOMRect, pleine: boolean): void {
  if (mouvementReduit()) return
  const fort = pleine ? 1.6 : 1
  reserve.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 0 rgba(255, 198, 31, 0)' },
      { transform: `scale(${1 + 0.12 * fort})`, filter: 'brightness(1.45)', boxShadow: `0 0 ${Math.round(32 * fort)}px ${Math.round(8 * fort)}px rgba(255, 198, 31, 0.8)`, offset: 0.25 },
      { transform: 'scale(0.96)', offset: 0.55 },
      { transform: 'scale(1.02)', offset: 0.78 },
      { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 0 rgba(255, 198, 31, 0)' },
    ],
    { duration: 480, easing: 'ease-out' },
  )
  reserve.querySelector('.reserve-texte')?.animate(
    [
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(255, 220, 110, 0))' },
      { transform: `scale(${1 + 0.28 * fort})`, filter: 'drop-shadow(0 0 10px rgba(255, 220, 110, 1))', offset: 0.28 },
      { transform: 'scale(0.95)', offset: 0.6 },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(255, 220, 110, 0))' },
    ],
    { duration: 420, easing: 'ease-out' },
  )
  reserve.querySelector('.reserve-jauge')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2)', offset: 0.2 }, { filter: 'brightness(1)' }], { duration: 460, easing: 'ease-out' })
  reserve.querySelector('.reserve-eclat')?.animate(
    [
      { transform: 'translateX(-160%) skewX(-20deg)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: 'translateX(460%) skewX(-20deg)', opacity: 0 },
    ],
    { duration: 600, easing: 'cubic-bezier(.3,.7,.4,1)' },
  )
  const x = impact.left + impact.width / 2
  const y = impact.top + impact.height / 2
  eclater(x, y, pleine ? 28 : 10, '#ffe27a')
  onde(x, y, pleine ? 64 : 34)
  if (pleine) {
    const r = reserve.getBoundingClientRect()
    window.setTimeout(() => onde(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.75), 90)
  }
}

/**
 * LA RÉSERVE de la mine (Keko, 02/11) : l'or des barres s'y
 * accumule, sa jauge monte ; pleine, elle s'allume et la mine s'arrête. Elle
 * se tape à part de la mine (`data-reserve`) : une tape la récolte.
 */
function Reserve({ j, p }: { j: Joueur; p: Producteur }): ReactElement {
  const capacite = capaciteReserve(j, p)
  const pleine = reservePleine(j, p)
  return (
    <span className={`reserve${pleine ? ' reserve-pleine' : ''}`} data-cliquable data-reserve data-id={p.id} aria-label="Récolter la réserve">
      <span className="reserve-jauge" style={{ width: `${(100 * Math.min(capacite, p.reserve)) / capacite}%` }} />
      <span className="reserve-eclat" />
      <span className="reserve-texte">
        <Compteur valeur={p.reserve} cle={`reserve-${p.id}`} format={possede} duree={200} sursautEnBaisse={false} /> / {capacite}{' '}
        {estConstruit(p) ? <SymboleRessource ressource={ressourceDe(p)} /> : <SymbolePiece />}
      </span>
    </span>
  )
}

/**
 * LE BOUTON DES AMÉLIORATIONS, en haut à droite de la mine (Keko, 02/11 : « un bouton générique d'upgrade en haut à droite de la
 * mine, qui ouvre le menu upgrade qu'on a déjà ») : doré et battant quand la mine peut monter d'un niveau. Il se tape à part de la
 * mine (`data-ameliorer`) et ouvre son menu.
 */
function BoutonAmeliorer({ j, p }: { j: Joueur; p: Producteur }): ReactElement {
  // Elle bat quand la mine peut monter, et quand le choix d'un niveau attend.
  const pret = estMine(p) ? peutMonterLaMine(j, p) || j.offre !== null : peutMonterLeProducteur(j, p) || (p.offre ?? null) !== null
  return (
    <span className={`mine-ameliorer${pret ? ' mine-ameliorer-pret' : ''}`} data-cliquable data-ameliorer data-id={p.id} role="button" aria-label="Améliorations">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3 L21 12.5 H15.5 V21 H8.5 V12.5 H3 Z" />
      </svg>
    </span>
  )
}

/** La ressource qu'aucun producteur construit ne fait : celle qu'il faut acheter au marché. */
function ressourceManquante(j: Joueur): Ressource | null {
  return RESSOURCES.find((r) => !j.producteurs.some((p) => estConstruit(p) && ressourceDe(p) === r)) ?? null
}

/** LE NIVEAU D'UN BÂTIMENT, en pastille dans le coin haut gauche de son carré (Keko, 02/11 : « indiquer visuellement le niveau des bâtiments »). */
function PastilleNiveau({ p }: { p: Producteur }): ReactElement {
  return <span className="batiment-niveau">niv. {p.niveau}</span>
}

/** Le texte sur la pièce d'un générateur : ce qu'il est, ce qu'il fait, ce qui le bloque. */
function TexteProducteur({ j, p, b, actif }: { j: Joueur; p: Producteur; b: ReturnType<typeof bilanProducteur>; actif: boolean }): ReactElement {
  if (estMine(p)) {
    // LA MINE D'OR : son image, son nom, sa BARRE (qui se remplit seule : son remplissage est posé image par image, voir plus haut) et ce qu'elle rend, sa réserve.
    return (
      <span className="mine">
        {ameliorationsOuvertes(j) && <BoutonAmeliorer j={j} p={p} />}
        {ameliorationsOuvertes(j) && <PastilleNiveau p={p} />}
        <ImageDuType type={p.type} />
        <b className="mine-nom">{NOM_MINE}</b>
        <span className="mine-production">
          <span className="mine-barre">
            <span className="mine-barre-remplie" />
            <span className="mine-barre-tete" />
          </span>
          <span className="mine-barre-gain">
            {/* L'intérieur pompe à chaque tape ; l'extérieur grossit avec la barre et éclate quand la pièce part : les deux s'additionnent. */}
            <span className="mine-barre-gain-pompe">
              +{abregeFin(b.lot)} <SymbolePiece />
            </span>
          </span>
        </span>
        {(j.automatisation > 0 || p.reserve >= 1) && <Reserve j={j} p={p} />}
      </span>
    )
  }
  if (estConstruit(p)) {
    // UN PRODUCTEUR CONSTRUIT (la scierie, la mine) : la mise en page de la banque — son image, son nom, sa barre et ce qu'elle rend.
    const r = ressourceDe(p)
    return (
      <span className="mine">
        <BoutonAmeliorer j={j} p={p} />
        <PastilleNiveau p={p} />
        <ImageDuType type={p.type} />
        <b className="mine-nom">{nomProducteur(p)}</b>
        <span className="mine-production">
          <span className="mine-barre">
            <span className="mine-barre-remplie" />
            <span className="mine-barre-tete" />
          </span>
          <span className="mine-barre-gain">
            <span className="mine-barre-gain-pompe">
              +{abregeFin(lotProducteur(p))} <SymboleRessource ressource={r} />
            </span>
          </span>
        </span>
        {(automatiqueProducteur(p) || p.reserve >= 1) && <Reserve j={j} p={p} />}
      </span>
    )
  }
  if (estSource(p)) {
    return (
      <>
        {p.type === 0 ? (
          <b>
            <Compteur valeur={j.matiere[sortie(p)] ?? 0} format={abrege} duree={300} />
          </b>
        ) : (
          <b>{LETTRE_PRODUCTEUR[p.type]}</b>
        )}
        <span className="producteur-unite">
          <Symbole couleur={p.couleur} forme={0} />
        </span>
        <span className="producteur-colonne">
          {b.frequence > 0 && <small className="gain">{parSeconde(b.debit)}</small>}
          <small className="sourd">
            +{abregeFin(b.tapeMoyenne)} par tape{p.niveau > 1 ? ` · niv. ${p.niveau}` : ''}
          </small>
        </span>
      </>
    )
  }
  const sorte = sortie(p)
  const manque = lotDeBase(p) - disponible(j, p)
  const e = entrees(p)
  return (
    <>
      <span className="atelier-forme">
        {e.map((s, k) => (
          <span key={s} className="transfo-entree">
            {k > 0 && <span className="fleche">+</span>}
            <SymboleSorte sorte={s} classe="symbole-moyen" />
          </span>
        ))}
        <span className="fleche">→</span>
        <SymboleSorte sorte={sorte} classe="symbole-moyen" />
      </span>
      <span className="producteur-colonne">
        <small>
          <b className="atelier-nom">{LETTRE_PRODUCTEUR[p.type]}</b> · {abregeFin(b.tape)} {nomSortePluriel(sorte)} par coup
        </small>
        {manque > 0 ? (
          <small className="manque">il manque des {e.map((s) => nomSortePluriel(s)).join(' ou ')} · sa roue</small>
        ) : actif ? (
          <small className="gain">tourne seul · {parSeconde(b.debit)}</small>
        ) : (
          <small className="gain">prêt : tapez pour convertir</small>
        )}
      </span>
    </>
  )
}

/** La feuille d'un générateur, selon sa famille. */
function FeuilleProducteur({
  m,
  j,
  p,
  agir,
  onAcheter,
  onAmeliorer,
}: {
  m: Monde
  j: Joueur
  p: Producteur
  agir: (f: () => void) => void
  onAcheter: (p: Producteur, bouton: HTMLElement) => void
  onAmeliorer: (p: Producteur, bouton: HTMLElement) => void
}): ReactElement {
  const genre = genreDe(p)
  const b = bilanProducteur(j, p)
  const t = typeDe(p)
  const reglerIci = (couleur: number, forme: number): void => {
    if (couleur === p.couleur && forme === p.forme) return
    agir(() => {
      regler(p, couleur, forme)
    })
    vibrer(8)
  }
  const achats = manquesDe(j, p)
  const coutAchats = achats.reduce((s, a) => s + coutAchat(m, a.sorte, a.quantite), 0)
  const boutonAchat =
    achats.length > 0 ? (
      <button type="button" className={j.or + 1e-9 >= coutAchats ? 'bouton-principal' : ''} disabled={j.or + 1e-9 < coutAchats} onClick={(e) => onAcheter(p, e.currentTarget)}>
        Acheter {achats.map((a) => `${abrege(a.quantite)} ${nomSortePluriel(a.sorte)}`).join(' et ')} au marché · {abrege(coutAchats)} {NOM_OR}
      </button>
    ) : null

  if (genre === 'source') {
    const apres = bilan(lotDeBase({ ...p, niveau: p.niveau + 1 }), modulesDe(j, p), multiplicateurPrestige(j))
    return (
      <div className="reglage">
        <p>
          <Symbole couleur={p.couleur} forme={0} /> <b>Niveau {p.niveau}</b>
          <span className="petit sourd"> · produit des {nomSortePluriel(sortie(p))} à chaque coup : lot de base {abregeFin(t.lot)} × niveau {p.niveau}.</span>
        </p>
        <span className="petit">
          {b.frequence > 0 ? (
            <>
              {parSeconde(b.debit)} → <span className="gain">{parSeconde(apres.debit)}</span> au niveau {p.niveau + 1}
            </>
          ) : (
            <>
              +{abregeFin(b.tapeMoyenne)} → <span className="gain">+{abregeFin(apres.tapeMoyenne)}</span> par tape au niveau {p.niveau + 1}
            </>
          )}
        </span>
        <BoutonCout j={j} cout={coutNiveauSource(p)} texte="Améliorer" onClick={(e) => onAmeliorer(p, e.currentTarget)} />
      </div>
    )
  }
  if (genre === 'melangeur') {
    const melanges = Array.from({ length: COULEURS - PRIMAIRES }, (_, k) => PRIMAIRES + k)
    const c = MELANGE.composants[p.couleur - PRIMAIRES] ?? [0, 1]
    return (
      <div className="reglage">
        <span className="petit sourd">
          Fait des {nomSortePluriel(sortie(p))} : {abregeFin(b.tape)} {nomSortePluriel(sorteDe(c[0], 0))} + {abregeFin(b.tape)} {nomSortePluriel(sorteDe(c[1], 0))} → {abregeFin(b.tape)} par coup.
        </span>
        <Choix valeurs={melanges} choisie={p.couleur} signe={(k) => <Symbole couleur={k} forme={0} />} nom={(k) => NOM_COULEUR[k] ?? ''} stockDe={(k) => j.matiere[sorteDe(k, 0)] ?? 0} onChoisir={(k) => reglerIci(k, 0)} />
        <span className="petit">
          En stock : {abrege(j.matiere[sorteDe(c[0], 0)] ?? 0)} {nomSortePluriel(sorteDe(c[0], 0))}, {abrege(j.matiere[sorteDe(c[1], 0)] ?? 0)} {nomSortePluriel(sorteDe(c[1], 0))}
          {b.frequence > 0 && <span className="sourd"> · tourne seul : {parSeconde(b.debit)}</span>}
        </span>
        {boutonAchat}
      </div>
    )
  }
  const couleurs = Array.from({ length: COULEURS }, (_, k) => k)
  const formesPossibles = Array.from({ length: FORMES - 1 }, (_, k) => k + 1)
  const sorte = sortie(p)
  return (
    <div className="reglage">
      <span className="petit sourd">
        Donne une forme aux {nomSortePluriel(sorteDe(p.couleur, 0))} : {abregeFin(b.tape)} ronds → {abregeFin(b.tape)} {nomSortePluriel(sorte)} par coup.
      </span>
      <span className="petit sourd">La couleur (le stock de ronds dessous) :</span>
      <Choix valeurs={couleurs} choisie={p.couleur} signe={(k) => <Symbole couleur={k} forme={0} />} nom={(k) => NOM_COULEUR[k] ?? ''} stockDe={(k) => j.matiere[sorteDe(k, 0)] ?? 0} onChoisir={(k) => reglerIci(k, p.forme)} />
      <span className="petit sourd">La forme (ce que vous en avez déjà) :</span>
      <Choix valeurs={formesPossibles} choisie={p.forme} signe={(f) => <Symbole couleur={p.couleur} forme={f} />} nom={(f) => NOMS_FORMES[f] ?? ''} stockDe={(f) => j.matiere[sorteDe(p.couleur, f)] ?? 0} onChoisir={(f) => reglerIci(p.couleur, f)} />
      <span className="petit">
        En stock : {abrege(j.matiere[sorteDe(p.couleur, 0)] ?? 0)} {nomSortePluriel(sorteDe(p.couleur, 0))} · {abrege(j.matiere[sorte] ?? 0)} {nomSortePluriel(sorte)}
        {b.frequence > 0 && <span className="sourd"> · tourne seul : {parSeconde(b.debit)}</span>}
      </span>
      {boutonAchat}
    </div>
  )
}

/** Ce que le niveau suivant du module ferait au générateur qui le porte : sa production, ou sa tape s'il n'a pas d'horloge. */
function BilanDuPorteur({ j, porteur, module }: { j: Joueur; porteur: Producteur; module: Module }): ReactElement {
  const mods = modulesDe(j, porteur)
  const lot0 = lotDeBase(porteur)
  const prestige = multiplicateurPrestige(j)
  const avant = bilan(lot0, mods, prestige)
  const apres = bilan(lot0, mods.map((mo) => (mo === module ? { ...mo, niveau: mo.niveau + 1 } : mo)), prestige)
  return (
    <span className="petit sourd">
      {nomProducteur(porteur)} :{' '}
      {apres.frequence > 0 ? (
        <>
          {parSeconde(avant.debit)} → <span className="gain">{parSeconde(apres.debit)}</span>
        </>
      ) : (
        <>
          {abregeFin(avant.tapeMoyenne)} → <span className="gain">{abregeFin(apres.tapeMoyenne)}</span> par tape
        </>
      )}
    </span>
  )
}
