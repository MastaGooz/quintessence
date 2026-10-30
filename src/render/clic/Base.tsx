/**
 * LA BASE : la page principale du proto. Le bouton de clic au centre d'un plan
 * qu'on fait glisser et qu'on zoome ; autour, les prises en anneaux ; dessus,
 * les modules branchés, qui tapent la base à leur cadence. Un module acheté
 * apparaît sous la base : on le glisse vers une prise, un aimant l'y pose
 * (Keko, 30/10 : « on fait apparaître le module créé et on le drag and drop
 * vers la base avec un petit effet magnet »). Un module se débranche en le
 * tirant hors de sa prise : posé sur le plan, il ne produit plus.
 *
 * Le glisser est impératif (le module suit le doigt sans rendu React) ; le
 * moteur n'est touché qu'au lâcher. Entre les deux, un rendu peut survenir
 * (la seconde qui passe) : il lit `traine` pour laisser le module sous le doigt.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { BASE, MODULE, TAPES_MAX_PAR_S } from '../../logic/clic/donnees.ts'
import {
  brancher, debit, debrancher, gainVente, nombreDePrises, positionPrise, rayonDeLaBase, taper, valeurTape, vendre, type Module,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import { LETTRE_MODULE, NOM_AUTO, NOM_BASE, NOM_R } from '../../ui/noms-clic.ts'
import { sonBatir, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { monterCarte, type Carte, type Point } from '../carte/carte.ts'
import { eclater, effetVente, flotter, mouvementReduit } from '../effets.ts'
import { Modules } from './Modules.tsx'
import type { PagePropsClic } from './props.ts'

/** La portée de l'aimant : à moins de ça d'une prise libre (en pixels-monde), le module s'y pose. */
const AIMANT = 110
/** Ce que la vue normale garde visible sous la base, en pixels-monde : la rangée où apparaissent les modules achetés, au-dessus des commandes. */
const DESSOUS = 520
/** Une teinte par unité, en attendant l'habillage. */
const TEINTES: readonly number[] = [205, 160, 95, 45, 22, 345, 285, 0]
/** La cadence visible d'un module branché (coups par seconde) : elle monte avec l'unité, elle ne mesure rien. */
function cadence(type: number): number {
  return 0.4 + 0.3 * type
}
/** La base s'écrase puis rebondit, à chaque tape. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.95)' }, { transform: 'scale(1.02)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450

interface Traine {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  prise: number | null
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
  const prisesEl = useRef(new Map<number, HTMLElement>())
  const traine = useRef<Traine | null>(null)
  const agirRef = useRef(agir)
  agirRef.current = agir
  const [boutique, setBoutique] = useState(false)
  const production = debit(j)
  const rien = j.achetes.every((n) => n === 0)
  const debut = rien && j.points === 0 && j.or < 10

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

  // LA SAISIE D'UN MODULE : il suit le doigt ; près d'une prise libre, l'aimant l'y pose ; au lâcher, le moteur l'apprend.
  const positionDe = (mo: Module): Point => (mo.prise !== null ? positionPrise(mo.prise) : { x: mo.x, y: mo.y })
  const saisir = (cible: HTMLElement, p: Point): boolean => {
    const id = Number(cible.dataset['id'])
    const mo = j.modules.find((x) => x.id === id)
    if (mo === undefined) return false
    const pos = positionDe(mo)
    traine.current = { id, x: pos.x, y: pos.y, dx: p.x - pos.x, dy: p.y - pos.y, prise: mo.prise }
    cible.classList.add('module-saisi')
    if (mo.prise !== null) prisesEl.current.get(mo.prise)?.classList.add('prise-visee')
    vibrer(8)
    return true
  }
  const trainer = (p: Point): void => {
    const t = traine.current
    if (t === null) return
    t.x = p.x - t.dx
    t.y = p.y - t.dy
    // L'AIMANT : la prise libre la plus proche, à portée.
    const occupees = new Set<number>()
    for (const mo of j.modules) if (mo.prise !== null && mo.id !== t.id) occupees.add(mo.prise)
    let visee: number | null = null
    let dmin = AIMANT
    for (let k = 0; k < nombreDePrises(j); k++) {
      if (occupees.has(k)) continue
      const q = positionPrise(k)
      const d = Math.hypot(q.x - t.x, q.y - t.y)
      if (d < dmin) {
        dmin = d
        visee = k
      }
    }
    if (visee !== t.prise) {
      if (t.prise !== null) prisesEl.current.get(t.prise)?.classList.remove('prise-visee')
      if (visee !== null) {
        prisesEl.current.get(visee)?.classList.add('prise-visee')
        vibrer(6)
      }
      t.prise = visee
    }
    const el = modulesEl.current.get(t.id)
    if (el === undefined) return
    const pos = visee !== null ? positionPrise(visee) : t
    el.classList.toggle('module-aimante', visee !== null)
    el.style.left = `${pos.x - MODULE.taille / 2}px`
    el.style.top = `${pos.y - MODULE.taille / 2}px`
  }
  /** La saisie s'annule (un second doigt) : le module revient là où le moteur le sait. */
  const annuler = (): void => {
    const t = traine.current
    if (t === null) return
    traine.current = null
    const el = modulesEl.current.get(t.id)
    el?.classList.remove('module-saisi', 'module-aimante')
    if (t.prise !== null) prisesEl.current.get(t.prise)?.classList.remove('prise-visee')
    const mo = j.modules.find((x) => x.id === t.id)
    if (mo === undefined || el === undefined) return
    const pos = positionDe(mo)
    el.style.left = `${pos.x - MODULE.taille / 2}px`
    el.style.top = `${pos.y - MODULE.taille / 2}px`
  }
  const lacher = (): void => {
    const t = traine.current
    if (t === null) return
    traine.current = null
    modulesEl.current.get(t.id)?.classList.remove('module-saisi', 'module-aimante')
    if (t.prise !== null) prisesEl.current.get(t.prise)?.classList.remove('prise-visee')
    const mo = j.modules.find((x) => x.id === t.id)
    if (mo === undefined) return
    const avant = mo.prise
    agirRef.current(() => {
      if (t.prise !== null) brancher(j, mo, t.prise)
      else debrancher(j, mo, t.x, t.y)
    })
    if (t.prise !== null && t.prise !== avant) {
      // BRANCHÉ : ça se voit et ça s'entend.
      sonBatir()
      vibrer([15, 30])
      const s = surLaPage(positionPrise(t.prise))
      if (s !== null) eclater(s.x, s.y, 12)
    } else if (t.prise === null && avant !== null) vibrer(12)
  }

  /** Un module vient d'être acheté : il apparaît sous la base, et la vue revient au normal pour qu'on le voie. */
  const naitre = (mo: Module): void => {
    setBoutique(false)
    sonBatir()
    vibrer([15, 30])
    carte.current?.centrer()
    requestAnimationFrame(() => {
      modulesEl.current.get(mo.id)?.classList.add('module-nait')
      const s = surLaPage({ x: mo.x, y: mo.y })
      if (s !== null) eclater(s.x, s.y, 10)
    })
  }

  const cadrage = (): [number, number] => [rayonDeLaBase(j) + MODULE.taille / 2 + 20, DESSOUS]

  useEffect(() => {
    const el = cadre.current
    const c = toile.current
    const mo = monde.current
    if (el === null || c === null || mo === null) return
    const [rayon, bas] = cadrage()
    const k = monterCarte(el, c, mo, zoomVu.current, { rayon, bas }, {
      onClic: (cible, sx, sy) => {
        if (cible === baseEl.current) taperIci(sx, sy)
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

  // La base grandit avec ses anneaux : le zoom normal suit.
  useEffect(() => {
    const [rayon, bas] = cadrage()
    carte.current?.cadrer(rayon, bas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j.anneaux])

  const t = traine.current
  const prises: number[] = []
  for (let k = 0; k < nombreDePrises(j); k++) prises.push(k)
  const demi = MODULE.taille / 2
  const indice = j.modules.some((mo) => mo.prise === null) && j.unites.every((n) => n === 0)
  const venteVisible = !j.auto && (j.r >= 1 || j.or > 0 || !rien)
  const boutiqueVisible = j.or >= 1 || !rien || j.points > 0

  return (
    <div className="carte" ref={cadre}>
      <canvas className="carte-quadrillage" ref={toile} aria-hidden />
      <div className="carte-monde" ref={monde}>
        {/* LES PRISES : en anneaux autour de la base ; celle que vise l'aimant s'allume. */}
        {prises.map((k) => {
          const q = positionPrise(k)
          return (
            <div
              key={k}
              className={`prise${t !== null && t.prise === k ? ' prise-visee' : ''}`}
              style={{ left: q.x - demi, top: q.y - demi }}
              ref={(el) => {
                if (el === null) prisesEl.current.delete(k)
                else prisesEl.current.set(k, el)
              }}
            />
          )
        })}

        {/* LA BASE : le bouton de clic. Une tape (un doigt posé puis relevé sans glisser) produit. */}
        <div className="base" data-cliquable ref={baseEl} style={{ left: -BASE.rayon, top: -BASE.rayon, width: 2 * BASE.rayon, height: 2 * BASE.rayon }}>
          <b>
            <Compteur valeur={j.r} format={abrege} duree={300} />
          </b>
          <span className="base-unite">{NOM_R}</span>
          {production > 0 && <small className="gain">{parSeconde(production)}</small>}
          <small className="sourd">
            +{abrege(valeurTape(j))} par tape
          </small>
        </div>

        {/* LES MODULES : branchés, ils tapent la base ; posés, ils attendent qu'on les glisse. */}
        {j.modules.map((mo) => {
          const enMain = t !== null && t.id === mo.id
          const pos = enMain ? (t.prise !== null ? positionPrise(t.prise) : t) : positionDe(mo)
          const angle = mo.prise !== null ? positionPrise(mo.prise).angle : 0
          const periode = 1 / cadence(mo.type)
          const style: CSSProperties & Record<string, string | number> = {
            left: pos.x - demi,
            top: pos.y - demi,
            '--teinte': TEINTES[mo.type] ?? 0,
            '--angle': `${angle}rad`,
            '--dx': `${(-Math.cos(angle) * 12).toFixed(1)}px`,
            '--dy': `${(-Math.sin(angle) * 12).toFixed(1)}px`,
            '--cadence': `${periode.toFixed(2)}s`,
            animationDelay: `${(-((mo.id * 0.37) % periode)).toFixed(2)}s`,
          }
          return (
            <div
              key={mo.id}
              className={`module${mo.prise !== null ? ' module-branche' : ''}${enMain ? ' module-saisi' : ''}${enMain && t.prise !== null ? ' module-aimante' : ''}`}
              data-saisissable
              data-id={mo.id}
              style={style}
              ref={(el) => {
                if (el === null) modulesEl.current.delete(mo.id)
                else modulesEl.current.set(mo.id, el)
              }}
            >
              <b>{LETTRE_MODULE[mo.type]}</b>
            </div>
          )
        })}
      </div>

      {/* LES COMMANDES par-dessus la carte : elles ne glissent pas avec elle. */}
      <div className="carte-hud">
        <span className="carte-zoom" ref={zoomVu}>
          ×1,0
        </span>
        {debut && j.r < 1 && <p className="carte-indice">Tapez {NOM_BASE} pour produire du {NOM_R}.</p>}
        {indice && <p className="carte-indice">Glissez le module sur une prise de {NOM_BASE}.</p>}
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
              <button type="button" className={rien ? 'respire' : ''} onClick={() => setBoutique(true)}>
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
