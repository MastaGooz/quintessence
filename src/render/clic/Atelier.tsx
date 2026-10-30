/**
 * L'ATELIER : le grand nombre (R en main, et la production par seconde), la
 * tape, la vente, puis les unités à acheter, leurs améliorations, le comptoir
 * automatique et le prestige. Tout se dévoile dans cet ordre, une chose à la
 * fois : au début, il n'y a que la tape.
 */
import { useRef, useState, type ReactElement } from 'react'
import { AUTO_COUT, PRESTIGE, TAPES_MAX_PAR_S, UNITES } from '../../logic/clic/donnees.ts'
import {
  acheterAmelioration, acheterAuto, acheterUnite, combienPayables, coutAmelioration, coutUnite, debit, debitUnite, gainVente,
  multiplicateurPrestige, multiplicateurUnite, paliersFranchis, peutAcheterUnite, pointsSi, prestiger, prixCourant, prochainPalier,
  taper, valeurTape, vendre, visible,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_AUTO, NOM_PRESTIGE, NOM_R, NOM_UNITE } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir, sonTape } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { eclater, effetDepense, effetVente, flotter, mouvementReduit } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import type { PagePropsClic } from './props.ts'

/** La tape s'écrase puis rebondit, à chaque doigt posé. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.93)' }, { transform: 'scale(1.03)', offset: 0.6 }, { transform: 'scale(1)' }]
/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450

type Quantite = 1 | 10 | 'max'

export function Atelier({ partie, agir }: PagePropsClic): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [quantite, setQuantite] = useState<Quantite>(1)
  const [confirmer, setConfirmer] = useState(false)
  const rien = j.unites.every((n) => n === 0)
  const debut = rien && j.points === 0 && j.or < 10
  const prix = prixCourant(m)
  const production = debit(j)

  // LA SÉRIE DE TAPES, et le plafond par seconde (contre les auto-clics).
  const serie = useRef({ n: 0, t: 0 })
  const recentes = useRef<number[]>([])
  const taperIci = (x: number, y: number, bouton: HTMLElement): void => {
    const maintenant = performance.now()
    recentes.current = recentes.current.filter((t) => maintenant - t < 1000)
    if (recentes.current.length >= TAPES_MAX_PAR_S) return
    recentes.current.push(maintenant)
    serie.current = { n: maintenant - serie.current.t < SERIE_MS ? serie.current.n + 1 : 0, t: maintenant }
    const n = serie.current.n
    let gagne = 0
    agir(() => {
      gagne = taper(j)
    })
    sonTape(n)
    vibrer(8)
    if (!mouvementReduit()) bouton.animate(ECRASER, { duration: 170, easing: 'ease-out' })
    flotter(x, y, `+${abrege(gagne)}`, 'flottant-or', Math.min(1.7, 1 + n * 0.05))
    if (n > 0 && n % 10 === 9) eclater(x, y, 14)
    else if (Math.random() < 0.3) eclater(x, y, 3)
  }

  const nombreAchete = (i: number): number => (quantite === 'max' ? Math.max(1, combienPayables(j, i)) : quantite)

  const acheter = (i: number, bouton: HTMLElement): void => {
    const n = nombreAchete(i)
    const cout = coutUnite(j, i, n)
    const paliersAvant = paliersFranchis(j.unites[i] ?? 0)
    const premiere = (j.unites[i] ?? 0) === 0
    effetDepense(bouton.getBoundingClientRect(), cout)
    agir(() => {
      acheterUnite(j, i, n)
    })
    const r = bouton.getBoundingClientRect()
    if (paliersFranchis(j.unites[i] ?? 0) > paliersAvant) {
      // UN PALIER FRANCHI : l'unité double, et ça se voit.
      sonBatir()
      vibrer([20, 30, 40])
      flotter(r.left + r.width / 2, r.top - 28, '×2 !', 'flottant-or', 1.6)
      eclater(r.left + r.width / 2, r.top, 16)
    } else if (premiere) {
      sonBatir()
      vibrer([15, 30])
      eclater(r.left + r.width / 2, r.top + r.height / 2, 10)
    } else vibrer(12)
  }

  const ameliorer = (i: number, bouton: HTMLElement): void => {
    const cout = coutAmelioration(j, i)
    if (cout === null) return
    effetDepense(bouton.getBoundingClientRect(), cout)
    agir(() => {
      acheterAmelioration(j, i)
    })
    const r = bouton.getBoundingClientRect()
    sonBatir()
    vibrer([20, 30, 40])
    flotter(r.left + r.width / 2, r.top - 28, '×2 !', 'flottant-or', 1.6)
    eclater(r.left + r.width / 2, r.top, 16)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const autoVisible = !j.auto && (j.or >= AUTO_COUT / 4 || production >= 0.2)

  return (
    <div className={`page${debut ? ' page-debut' : ''}`}>
      {/* LE GRAND NOMBRE : ce qu'on a en main, et ce qui tombe chaque seconde. */}
      <div className="grand-nombre">
        <span className="grand-nombre-valeur">
          <Compteur valeur={j.r} format={abrege} duree={300} />
        </span>{' '}
        <span className="grand-nombre-unite">{NOM_R}</span>
        {production > 0 && <span className="grand-nombre-debit gain">{parSeconde(production)}</span>}
      </div>

      {/* LA TAPE : le premier geste du jeu, et il reste possible. Elle agit au doigt posé. */}
      <button
        type="button"
        className={`tape${debut ? ' tape-grande' : ''}`}
        onPointerDown={(e) => {
          if (e.button === 0) taperIci(e.clientX, e.clientY, e.currentTarget)
        }}
        onClick={(e) => {
          // Le clavier n'a pas de doigt : il arrive par `click` seul (detail 0), au centre du bouton.
          if (e.detail === 0) {
            const r = e.currentTarget.getBoundingClientRect()
            taperIci(r.left + r.width / 2, r.top + r.height / 2, e.currentTarget)
          }
        }}
      >
        Produire
        <small>+{abrege(valeurTape(j))} {NOM_R}</small>
      </button>

      {/* LA VENTE : ce qu'on a en main contre de l'or, au prix du marché commun. */}
      {!j.auto && (j.r >= 1 || j.or > 0 || !rien) && (
        <div className="carte-aide">
          <div className="ligne">
            <span>
              <b>{prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} or</b> <span className="sourd petit">par {NOM_R} au marché</span>
            </span>
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
          </div>
          {debut && j.r >= 1 && <p className="sourd petit">Vendez pour gagner de l’or : l’or achète des unités qui produisent toutes seules.</p>}
        </div>
      )}
      {j.auto && (
        <p className="sourd petit centre">
          {NOM_AUTO} : votre production se vend au fil de l’eau, {prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} or par {NOM_R}.
        </p>
      )}

      {/* LES UNITÉS */}
      {(j.or >= 1 || !rien) && (
        <section>
          <div className="ligne ligne-sans-trait">
            <h2>Unités</h2>
            {j.unites.some((n) => n >= 10) && (
              <span className="quantites quantites-petites">
                {([1, 10, 'max'] as Quantite[]).map((q) => (
                  <button key={q} type="button" className={quantite === q ? 'actif' : ''} onClick={() => setQuantite(q)}>
                    {q === 'max' ? 'max' : `×${q}`}
                  </button>
                ))}
              </span>
            )}
          </div>
          {UNITES.map((u, i) => {
            if (!visible(j, i)) return null
            const n = j.unites[i] ?? 0
            const q = nombreAchete(i)
            const cout = coutUnite(j, i, q)
            const payable = peutAcheterUnite(j, i, q)
            const palier = prochainPalier(n)
            const mult = multiplicateurUnite(j, i) / multiplicateurPrestige(j)
            const amelioration = coutAmelioration(j, i)
            return (
              <div key={u.id} className="unite">
                <div className="ligne ligne-sans-trait">
                  <span className="unite-texte">
                    <span>
                      <b>{NOM_UNITE[i]}</b> {n > 0 && <span className="sourd">× {n}</span>} {mult > 1 && <span className="gain petit">×{abrege(mult)}</span>}
                    </span>
                    <span className="petit sourd">
                      {n > 0 ? `${parSeconde(debitUnite(j, i))} · ` : ''}
                      {parSeconde(u.debit * multiplicateurUnite(j, i))} chacune
                      {palier !== null && n > 0 && ` · ×2 à ${palier}`}
                    </span>
                  </span>
                  <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheter(i, e.currentTarget)}>
                    {q > 1 ? `×${q} · ` : ''}
                    {abrege(cout)} or
                  </button>
                </div>
                {amelioration !== null && (
                  <div className="ligne ligne-sans-trait unite-amelioration">
                    <span className="petit">
                      Doubler {NOM_UNITE[i]} <span className="sourd">(niveau {(j.niveaux[i] ?? 0) + 1})</span>
                    </span>
                    <button type="button" className={j.or >= amelioration ? 'bouton-principal' : ''} disabled={j.or < amelioration} onClick={(e) => ameliorer(i, e.currentTarget)}>
                      {abrege(amelioration)} or
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {j.connues < UNITES.length && (
            <p className="sourd petit verrou">
              {NOM_UNITE[j.connues]} se dévoile avec votre première {NOM_UNITE[j.connues - 1]}.
            </p>
          )}
        </section>
      )}

      {/* LE COMPTOIR AUTOMATIQUE */}
      {autoVisible && (
        <section>
          <div className="ligne">
            <span className="unite-texte">
              <b>{NOM_AUTO}</b>
              <span className="petit sourd">Vend votre production au fil de l’eau, même absent. Un gros lot vendu d’un coup rapporte moins que le même étalé.</span>
            </span>
            <button
              type="button"
              className={j.or >= AUTO_COUT ? 'bouton-principal' : ''}
              disabled={j.or < AUTO_COUT}
              onClick={(e) => {
                effetDepense(e.currentTarget.getBoundingClientRect(), AUTO_COUT)
                sonBatir()
                vibrer([20, 30, 40])
                agir(() => {
                  acheterAuto(j)
                })
              }}
            >
              {abrege(AUTO_COUT)} or
            </button>
          </div>
        </section>
      )}

      {/* LE PRESTIGE */}
      {prestigeVisible && (
        <section>
          <div className="ligne">
            <span className="unite-texte">
              <b>{NOM_PRESTIGE}</b>
              <span className="petit sourd">
                Tout remettre à zéro (unités, améliorations, {NOM_R}, or) contre des points permanents : chaque point ajoute ×1 à toute la production, tape comprise.
                {j.points > 0 && ` Vous avez ${j.points} point${j.points > 1 ? 's' : ''} (production ×${abrege(multiplicateurPrestige(j))}).`}
              </span>
              <span className="petit">
                {gain >= 1 ? (
                  <>
                    Maintenant : <b className="gain">+{gain} point{gain > 1 ? 's' : ''}</b>, production ×{abrege(multiplicateurPrestige(j))} → ×{abrege(multiplicateurPrestige(j) + gain)}
                  </>
                ) : (
                  <>Premier point à {abrege(PRESTIGE.base)} {NOM_R} produits depuis le dernier prestige ({abrege(j.produitRun)} pour l’instant).</>
                )}
              </span>
            </span>
            <button type="button" className={gain >= 1 ? 'bouton-danger' : ''} disabled={gain < 1} onClick={() => setConfirmer(true)}>
              Prestiger
            </button>
          </div>
        </section>
      )}
      {confirmer && (
        <Feuille titre={NOM_PRESTIGE} onFermer={() => setConfirmer(false)}>
          <p>
            Vous perdez vos {abrege(j.unites.reduce((s, n) => s + n, 0))} unités, vos améliorations, {abrege(j.r)} {NOM_R} et {abrege(j.or)} or.
          </p>
          <p>
            Vous gagnez <b className="gain">+{gain} point{gain > 1 ? 's' : ''}</b> : toute votre production passe de ×{abrege(multiplicateurPrestige(j))} à ×{abrege(multiplicateurPrestige(j) + gain)}, pour toujours. Les unités que vous connaissez restent connues.
          </p>
          <div className="boutons">
            <button type="button" onClick={() => setConfirmer(false)}>
              Pas maintenant
            </button>
            <button
              type="button"
              className="bouton-danger"
              onClick={() => {
                sonBatir()
                vibrer([30, 40, 60, 40, 30])
                agir(() => {
                  prestiger(j)
                })
                setConfirmer(false)
                requestAnimationFrame(() => {
                  const r = document.querySelector('.grand-nombre')?.getBoundingClientRect()
                  if (r !== undefined) {
                    eclater(r.left + r.width / 2, r.top + r.height / 2, 30)
                    flotter(r.left + r.width / 2, r.top, `+${gain} point${gain > 1 ? 's' : ''}`, 'flottant-or', 1.8)
                  }
                })
              }}
            >
              Prestiger
            </button>
          </div>
        </Feuille>
      )}
      {debut && j.r < 1 && (
        <p className="sourd petit centre">
          Tapez pour produire du {NOM_R}.
        </p>
      )}
      {!debut && (
        <p className="sourd petit centre marge-haute">
          Total produit : {abrege(j.total)} {NOM_R}
        </p>
      )}
    </div>
  )
}
