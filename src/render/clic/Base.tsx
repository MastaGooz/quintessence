/**
 * LA BASE : la page principale du proto. Le bouton de clic au centre d'un plan
 * qu'on fait glisser et qu'on zoome ; c'est un rectangle creusé d'une forme
 * sur chaque côté, et les modules sont des pièces de puzzle qui s'y emboîtent,
 * puis s'emboîtent les unes sur les autres (Keko, 30/10 : « une forme
 * rectangulaire, avec un slot sur chaque côté, chaque côté aurait une forme de
 * puzzle qui pourrait matcher certains types de pièce » ; « enchaînement tout
 * de suite »). Un module acheté apparaît sous l'arbre : on le glisse, un
 * aimant le pose sur un creux libre de sa forme où il tient. On tire un
 * module pour le détacher, et ce qui est emboîté dessus vient avec lui. Une
 * tape sur un module ouvre sa bulle : son niveau, et le bouton pour le monter.
 *
 * Le glisser est impératif (la grappe suit le doigt sans rendu React) ; le
 * moteur n'est touché qu'au lâcher. Entre les deux, un rendu peut survenir
 * (la seconde qui passe) : il lit `traine` pour laisser la grappe sous le doigt.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { BASE, NIVEAU, PIECE, TAPES_MAX_PAR_S } from '../../logic/clic/donnees.ts'
import {
  DIRECTIONS, ameliorer, brancher, coutNiveau, debit, debitAuNiveau, debitModule, debrancher, decoupeLocale, deplacer, disposerGrappe, disposition,
  etendue, gainVente, grappe, peutAmeliorer, prisesPour, relies, taper, valeurTape, vendre, type Module, type Place, type Prise,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import { LETTRE_MODULE, NOM_AUTO, NOM_BASE, NOM_MODULE, NOM_R } from '../../ui/noms-clic.ts'
import { sonBatir, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { monterCarte, type Carte, type Point } from '../carte/carte.ts'
import { eclater, effetDepense, effetVente, flotter, mouvementReduit } from '../effets.ts'
import { Modules } from './Modules.tsx'
import { boite, cheminDecoupe } from './pieces.ts'
import type { PagePropsClic } from './props.ts'

/** La portée de l'aimant : à moins de ça d'un creux où la grappe tient (en pixels-monde), elle s'y pose. */
const AIMANT = 120
/** Le zoom normal ne descend pas sous ça : un module fait au moins soixante pixels d'écran, on peut le taper. */
const ZOOM_MIN = 60 / PIECE.taille
/** Ce que la vue normale garde sous la rangée des modules qui naissent, en pixels-monde : la place des commandes. */
const DESSOUS_HUD = 320
/** Une teinte par unité, en attendant l'habillage. */
const TEINTES: readonly number[] = [205, 160, 95, 45, 22, 345, 285, 0]
/** La cadence visible d'un module relié (coups par seconde) : elle monte avec l'unité, elle ne mesure rien. */
function cadence(type: number): number {
  return 0.4 + 0.3 * type
}
/** La base s'écrase puis rebondit, à chaque tape. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.96)' }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450

const DEMI = PIECE.taille / 2
const BOITE_MODULE = boite(PIECE.taille, PIECE.taille)
const BOITE_BASE = boite(BASE.largeur, BASE.hauteur)
const CHEMIN_BASE = cheminDecoupe(
  BASE.largeur,
  BASE.hauteur,
  BASE.formes.map((forme) => ({ genre: 'creux' as const, forme })),
)
/** Le chemin d'un module de chaque unité, sa bosse en bas (la rotation est en CSS, par `--sens`). */
const CHEMINS_MODULES: readonly string[] = TEINTES.map((_, type) =>
  cheminDecoupe(
    PIECE.taille,
    PIECE.taille,
    [0, 1, 2, 3].map((c) => decoupeLocale(type, c)),
  ),
)

const cle = (p: Prise): string => `${p.parent}:${p.cote}`

interface Traine {
  id: number
  /** La grappe emportée, la racine en premier. */
  grappe: Module[]
  ids: Set<number>
  /** Le décalage du doigt au centre de la racine. */
  dx: number
  dy: number
  /** Le sens de la racine quand on l'a prise : hors aimant, elle le garde. */
  sens: number
  /** Les creux où la grappe peut aller. */
  candidats: Prise[]
  /** Celui que vise l'aimant. */
  prise: Prise | null
  /** Où elle était, pour savoir au lâcher si quelque chose a changé. */
  avant: { parent: number | null; cote: number }
  /** Le centre de la racine sous le doigt. */
  x: number
  y: number
}

export function Base({ partie, agir, avecBarre }: PagePropsClic & { avecBarre: boolean }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const cadre = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const monde = useRef<HTMLDivElement>(null)
  const zoomVu = useRef<HTMLSpanElement>(null)
  const baseEl = useRef<HTMLDivElement>(null)
  const carte = useRef<Carte | null>(null)
  const modulesEl = useRef(new Map<number, HTMLElement>())
  const prisesEl = useRef(new Map<string, HTMLElement>())
  const traine = useRef<Traine | null>(null)
  const agirRef = useRef(agir)
  agirRef.current = agir
  const [boutique, setBoutique] = useState(false)
  /** Le module dont la bulle est ouverte. */
  const [bulle, setBulle] = useState<number | null>(null)
  /** Le module qu'on tient : le rendu pose les creux candidats pendant qu'on le tient. */
  const [, setEnMain] = useState<number | null>(null)
  const production = debit(j)
  const dispo = disposition(j)
  const reliees = relies(j)
  const rien = j.achetes.every((n) => n === 0)
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

  // LA TAPE : une série, et le plafond par seconde (contre les auto-clics).
  const serie = useRef({ n: 0, t: 0 })
  const recentes = useRef<number[]>([])
  const taperIci = (x: number, y: number): void => {
    const maintenant = performance.now()
    recentes.current = recentes.current.filter((t) => maintenant - t < 1000)
    if (recentes.current.length >= TAPES_MAX_PAR_S) return
    recentes.current.push(maintenant)
    serie.current = { n: maintenant - serie.current.t < SERIE_MS ? serie.current.n + 1 : 0, t: maintenant }
    const n = serie.current.n
    let gagne = 0
    agirRef.current(() => {
      gagne = taper(j)
    })
    sonTape(n)
    vibrer(8)
    if (!mouvementReduit()) baseEl.current?.animate(ECRASER, { duration: 170, easing: 'ease-out' })
    flotter(x, y, `+${abrege(gagne)}`, 'flottant-or', Math.min(1.7, 1 + n * 0.05))
    if (n > 0 && n % 10 === 9) eclater(x, y, 14)
    else if (Math.random() < 0.3) eclater(x, y, 3)
  }

  // LA SAISIE D'UNE GRAPPE : elle suit le doigt ; près d'un creux où elle tient, l'aimant l'y pose ; au lâcher, le moteur l'apprend.
  /** Pose les éléments de la grappe là où ils seraient, la racine en `racine`. */
  const placerGrappe = (t: Traine, racine: Place): void => {
    for (const [id, p] of disposerGrappe(j, t.grappe[0]!, racine)) {
      const el = modulesEl.current.get(id)
      if (el === undefined) continue
      el.style.left = `${p.x - DEMI}px`
      el.style.top = `${p.y - DEMI}px`
      el.style.setProperty('--sens', String(p.sens))
    }
  }
  const saisir = (cible: HTMLElement, p: Point): boolean => {
    // La carte garde cette fonction telle qu'elle était au montage : on relit le moteur, pas le rendu.
    const id = Number(cible.dataset['id'])
    const mo = j.modules.find((x) => x.id === id)
    const pos = mo === undefined ? undefined : disposition(j).get(mo.id)
    if (mo === undefined || pos === undefined) return false
    const g = grappe(j, mo)
    traine.current = {
      id,
      grappe: g,
      ids: new Set(g.map((x) => x.id)),
      dx: p.x - pos.x,
      dy: p.y - pos.y,
      sens: pos.sens,
      candidats: prisesPour(j, mo),
      prise: null,
      avant: { parent: mo.parent, cote: mo.cote },
      x: pos.x,
      y: pos.y,
    }
    for (const x of g) modulesEl.current.get(x.id)?.classList.add('module-saisi')
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
    for (const x of t.grappe) modulesEl.current.get(x.id)?.classList.toggle('module-aimante', visee !== null)
    placerGrappe(t, visee !== null ? visee.place : { x: t.x, y: t.y, sens: t.sens })
  }
  /** La fin d'une saisie, quelle qu'elle soit : les classes s'éteignent, les creux disparaissent. */
  const finir = (t: Traine): void => {
    traine.current = null
    for (const x of t.grappe) modulesEl.current.get(x.id)?.classList.remove('module-saisi', 'module-aimante')
    if (t.prise !== null) prisesEl.current.get(cle(t.prise))?.classList.remove('prise-visee')
    setEnMain(null)
  }
  /** La saisie s'annule (un second doigt) : la grappe revient là où le moteur la sait. */
  const annuler = (): void => {
    const t = traine.current
    if (t === null) return
    finir(t)
    const pos = disposition(j).get(t.id)
    if (pos !== undefined) placerGrappe(t, pos)
  }
  const lacher = (_p: Point, bouge: boolean): void => {
    const t = traine.current
    if (t === null) return
    finir(t)
    const mo = t.grappe[0]!
    if (!bouge) {
      // Une tape : le module reste où il est, et sa bulle s'ouvre.
      const pos = disposition(j).get(mo.id)
      if (pos !== undefined) placerGrappe(t, pos)
      setBulle(mo.id)
      return
    }
    agirRef.current(() => {
      if (t.prise !== null) {
        if (!brancher(j, mo, t.prise.parent, t.prise.cote)) debrancher(mo, t.x, t.y, t.sens)
      } else if (mo.parent !== null) debrancher(mo, t.x, t.y, t.sens)
      else deplacer(mo, t.x, t.y)
    })
    const pos = disposition(j).get(mo.id)
    if (pos !== undefined) placerGrappe(t, pos)
    if (t.prise !== null && mo.parent !== null) {
      if (t.prise.parent !== t.avant.parent || t.prise.cote !== t.avant.cote) {
        // EMBOÎTÉ : ça se voit et ça s'entend.
        sonBatir()
        vibrer([15, 30])
        const s = surLaPage(t.prise.place)
        if (s !== null) eclater(s.x, s.y, 12)
      }
    } else if (t.avant.parent !== null) vibrer(12)
  }

  /** Un module vient d'être acheté : il apparaît sous l'arbre, et la vue revient au normal pour qu'on le voie. */
  const naitre = (mo: Module): void => {
    setBoutique(false)
    setBulle(null)
    sonBatir()
    vibrer([15, 30])
    carte.current?.centrer()
    requestAnimationFrame(() => {
      modulesEl.current.get(mo.id)?.classList.add('module-nait')
      const s = surLaPage({ x: mo.x, y: mo.y })
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
      const palier = mo.niveau % NIVEAU.palier === 0
      flotter(s.x, s.y - 10, palier ? `niveau ${mo.niveau} · ×2 !` : `niveau ${mo.niveau}`, 'flottant-or', palier ? 1.7 : 1.2)
    }
    if (!mouvementReduit()) modulesEl.current.get(mo.id)?.animate(ECRASER, { duration: 220, easing: 'ease-out' })
  }

  /** Ce que la vue normale cadre : l'arbre, et dessous la rangée où naissent les modules, au-dessus des commandes. */
  const cadrage = (): [number, number, number] => {
    const naissance = bas + PIECE.taille / 2 + 70
    const dessous = Math.max(0, naissance + DEMI + PIECE.encoche.profondeur + 30 - rayon) + DESSOUS_HUD
    return [rayon + 20, dessous, ZOOM_MIN]
  }

  useEffect(() => {
    const el = cadre.current
    const c = toile.current
    const mo = monde.current
    if (el === null || c === null || mo === null) return
    const [r, b, z] = cadrage()
    const k = monterCarte(el, c, mo, zoomVu.current, { rayon: r, bas: b, zoomMin: z }, {
      onClic: (cible, sx, sy) => {
        if (cible === baseEl.current) taperIci(sx, sy)
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

  // L'arbre grandit : le zoom normal suit.
  useEffect(() => {
    const [r, b, z] = cadrage()
    carte.current?.cadrer(r, b, z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rayon, bas])

  const t = traine.current
  /** Pendant une saisie, la grappe se rend là où elle est sous le doigt, pas là où le moteur la sait. */
  const fantome = t === null ? null : disposerGrappe(j, t.grappe[0]!, t.prise !== null ? t.prise.place : { x: t.x, y: t.y, sens: t.sens })
  const poses = j.modules.filter((mo) => !reliees.has(mo.id)).length
  const indiceGlisser = poses > 0 && reliees.size === 0
  const indiceAmeliorer = reliees.size > 0 && j.modules.every((mo) => mo.niveau === 1) && bulle === null
  const venteVisible = !j.auto && (j.r >= 1 || j.or > 0 || !rien)
  const boutiqueVisible = j.or >= 1 || !rien || j.points > 0
  const choisi = bulle === null ? undefined : j.modules.find((mo) => mo.id === bulle)
  const placeChoisi = choisi === undefined ? undefined : dispo.get(choisi.id)
  // La bulle se pose au-dessus du module, ou dessous quand il est près du haut de l'écran (elle passerait sous l'en-tête).
  const ecranChoisi = placeChoisi === undefined ? undefined : carte.current?.versEcran(placeChoisi.x, placeChoisi.y)
  const bulleDessous = ecranChoisi !== undefined && ecranChoisi.y < 250
  const ecartBulle = DEMI + PIECE.encoche.profondeur + 14

  return (
    <div className="carte" ref={cadre}>
      <canvas className="carte-quadrillage" ref={toile} aria-hidden />
      <div className="carte-monde" ref={monde}>
        {/* LES CREUX où la grappe qu'on tient peut aller ; celui que vise l'aimant s'allume. */}
        {t !== null &&
          t.candidats.map((pr) => (
            <div
              key={cle(pr)}
              className={`prise${t.prise !== null && cle(t.prise) === cle(pr) ? ' prise-visee' : ''}`}
              style={{ left: pr.place.x - DEMI, top: pr.place.y - DEMI, width: PIECE.taille, height: PIECE.taille }}
              ref={(el) => {
                if (el === null) prisesEl.current.delete(cle(pr))
                else prisesEl.current.set(cle(pr), el)
              }}
            />
          ))}

        {/* LA BASE : le bouton de clic, creusé d'une forme sur chaque côté. Une tape (un doigt posé puis relevé sans glisser) produit. */}
        <div className="base" data-cliquable ref={baseEl} style={{ left: -BASE.largeur / 2, top: -BASE.hauteur / 2, width: BASE.largeur, height: BASE.hauteur }}>
          <svg
            className="base-forme"
            viewBox={`${BOITE_BASE.x} ${BOITE_BASE.y} ${BOITE_BASE.largeur} ${BOITE_BASE.hauteur}`}
            style={{ left: BOITE_BASE.x + BASE.largeur / 2, top: BOITE_BASE.y + BASE.hauteur / 2, width: BOITE_BASE.largeur, height: BOITE_BASE.hauteur }}
            aria-hidden
          >
            <defs>
              <linearGradient id="base-fond" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4a3360" />
                <stop offset="1" stopColor="#2a1a36" />
              </linearGradient>
            </defs>
            <path d={CHEMIN_BASE} />
          </svg>
          <div className="base-texte">
            <b>
              <Compteur valeur={j.r} format={abrege} duree={300} />
            </b>
            <span className="base-unite">{NOM_R}</span>
            <span className="base-colonne">
              {production > 0 && <small className="gain">{parSeconde(production)}</small>}
              <small className="sourd">+{abrege(valeurTape(j))} par tape</small>
            </span>
          </div>
        </div>

        {/* LES MODULES : reliés à la base, ils tapent vers ce qui les porte ; posés, ils attendent qu'on les glisse. */}
        {j.modules.map((mo) => {
          const p = fantome?.get(mo.id) ?? dispo.get(mo.id) ?? { x: mo.x, y: mo.y, sens: mo.sens }
          const enMain = t !== null && t.ids.has(mo.id)
          const relie = reliees.has(mo.id)
          const vers = DIRECTIONS[(p.sens + 2) % 4]!
          const periode = 1 / cadence(mo.type)
          const style: CSSProperties & Record<string, string | number> = {
            left: p.x - DEMI,
            top: p.y - DEMI,
            width: PIECE.taille,
            height: PIECE.taille,
            '--teinte': TEINTES[mo.type] ?? 0,
            '--sens': p.sens,
            '--dx': `${vers.x * 10}px`,
            '--dy': `${vers.y * 10}px`,
            '--cadence': `${periode.toFixed(2)}s`,
            animationDelay: `${(-((mo.id * 0.37) % periode)).toFixed(2)}s`,
          }
          const classes = ['module', relie ? 'module-relie' : 'module-pose']
          if (enMain) classes.push('module-saisi')
          if (enMain && t.prise !== null) classes.push('module-aimante')
          if (bulle === mo.id) classes.push('module-choisi')
          return (
            <div
              key={mo.id}
              className={classes.join(' ')}
              data-saisissable
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
                style={{ left: BOITE_MODULE.x + DEMI, top: BOITE_MODULE.y + DEMI, width: BOITE_MODULE.largeur, height: BOITE_MODULE.hauteur }}
                aria-hidden
              >
                <path d={CHEMINS_MODULES[mo.type] ?? ''} />
              </svg>
              <b>{LETTRE_MODULE[mo.type]}</b>
              <small>niv. {mo.niveau}</small>
            </div>
          )
        })}

        {/* LA BULLE d'un module tapé : son niveau, ce qu'il produit, et le bouton pour le monter. Elle garde sa taille à l'écran (`--zoom`). */}
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
              {parSeconde(debitModule(j, choisi))} → <span className="gain">{parSeconde(debitAuNiveau(j, choisi.type, choisi.niveau + 1))}</span> au niveau {choisi.niveau + 1}
              {(choisi.niveau + 1) % NIVEAU.palier === 0 && <span className="gain"> (×2 !)</span>}
            </span>
            {!reliees.has(choisi.id) && <span className="petit sourd">Posé : il ne produit pas tant qu'il n'est pas emboîté sur {NOM_BASE}.</span>}
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
        {indiceGlisser && <p className="carte-indice">Glissez le module sur le creux de sa forme, sur {NOM_BASE}.</p>}
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
                Modules
              </button>
            )}
            <button type="button" onClick={() => carte.current?.centrer()}>
              Centrer
            </button>
          </div>
        </div>
      </div>
      {boutique && <Modules partie={partie} agir={agir} onFermer={() => setBoutique(false)} onModule={naitre} />}
    </div>
  )
}
