/**
 * LA FEUILLE DES MODULES : ce qui s'achète. Un module par achat, qui apparaît
 * sous la base et se glisse sur une prise ; les améliorations ; l'anneau de
 * prises suivant ; le comptoir automatique ; le prestige. C'est l'atelier
 * d'avant sans les quantités : chaque module est une pièce qu'on pose.
 */
import { useState, type ReactElement } from 'react'
import { ANNEAUX, AUTO_COUT, PRESTIGE, UNITES } from '../../logic/clic/donnees.ts'
import {
  acheterAmelioration, acheterAnneau, acheterAuto, acheterModule, coutAmelioration, coutAnneau, coutUnite, debit, debitModule,
  multiplicateurPrestige, multiplicateurUnite, nombreDePrises, peutAcheterModule, pointsSi, prestiger, prisesLibres, prochainPalier,
  visible, type Module,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_ANNEAU, NOM_AUTO, NOM_BASE, NOM_MODULE, NOM_PRESTIGE, NOM_R } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import type { PagePropsClic } from './props.ts'

export function Modules({ partie, agir, onFermer, onModule }: PagePropsClic & { onFermer: () => void; onModule: (mo: Module) => void }): ReactElement {
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const production = debit(j)
  const libres = prisesLibres(j).length
  const prises = nombreDePrises(j)
  const anneau = coutAnneau(j)
  const prochain = ANNEAUX[j.anneaux]

  const acheter = (i: number, bouton: HTMLElement): void => {
    const cout = coutUnite(j, i, 1)
    effetDepense(bouton.getBoundingClientRect(), cout)
    const achat: { mo: Module | null } = { mo: null }
    agir(() => {
      achat.mo = acheterModule(j, i)
    })
    if (achat.mo !== null) onModule(achat.mo)
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
  const anneauVisible = anneau !== null && prochain !== undefined && (libres <= 2 || j.or >= anneau / 4)

  return (
    <Feuille titre="Modules" onFermer={onFermer}>
      <p className="sourd petit">
        {libres} prise{libres > 1 ? 's' : ''} libre{libres > 1 ? 's' : ''} sur {prises}. Un module acheté apparaît sous {NOM_BASE} : glissez-le sur une prise, il tape pour vous.
      </p>

      {/* LES MODULES */}
      <section>
        {UNITES.map((u, i) => {
          if (!visible(j, i)) return null
          const n = j.unites[i] ?? 0
          const poses = j.modules.filter((mo) => mo.type === i && mo.prise === null).length
          const cout = coutUnite(j, i, 1)
          const payable = peutAcheterModule(j, i)
          const palier = prochainPalier(n)
          const mult = multiplicateurUnite(j, i) / multiplicateurPrestige(j)
          const amelioration = coutAmelioration(j, i)
          return (
            <div key={u.id} className="unite">
              <div className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <b>{NOM_MODULE[i]}</b> {n > 0 && <span className="sourd">× {n}</span>}{' '}
                    {poses > 0 && <span className="sourd petit">(+{poses} à brancher)</span>} {mult > 1 && <span className="gain petit">×{abrege(mult)}</span>}
                  </span>
                  <span className="petit sourd">
                    {parSeconde(debitModule(j, i))} chacun
                    {palier !== null && n > 0 && ` · ×2 à ${palier} branchés`}
                  </span>
                </span>
                <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheter(i, e.currentTarget)}>
                  {abrege(cout)} or
                </button>
              </div>
              {amelioration !== null && (
                <div className="ligne ligne-sans-trait unite-amelioration">
                  <span className="petit">
                    Doubler {NOM_MODULE[i]} <span className="sourd">(niveau {(j.niveaux[i] ?? 0) + 1})</span>
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
            {NOM_MODULE[j.connues]} se dévoile avec votre premier {NOM_MODULE[j.connues - 1]}.
          </p>
        )}
      </section>

      {/* L'ANNEAU SUIVANT : des prises de plus, plus loin de la base. */}
      {anneauVisible && anneau !== null && prochain !== undefined && (
        <section>
          <div className="ligne">
            <span className="unite-texte">
              <b>{NOM_ANNEAU}</b>
              <span className="petit sourd">
                Un anneau de {prochain.prises} prises de plus autour de {NOM_BASE} ({prises} → {prises + prochain.prises}).
              </span>
            </span>
            <button
              type="button"
              className={j.or >= anneau ? 'bouton-principal' : ''}
              disabled={j.or < anneau}
              onClick={(e) => {
                effetDepense(e.currentTarget.getBoundingClientRect(), anneau)
                sonBatir()
                vibrer([20, 30, 40])
                agir(() => {
                  acheterAnneau(j)
                })
              }}
            >
              {abrege(anneau)} or
            </button>
          </div>
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
                Tout remettre à zéro (modules, anneaux, améliorations, {NOM_R}, or) contre des points permanents : chaque point ajoute ×1 à toute la production, tape comprise.
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
            Vous perdez vos {j.modules.length} module{j.modules.length > 1 ? 's' : ''}, vos anneaux, vos améliorations, {abrege(j.r)} {NOM_R} et {abrege(j.or)} or.
          </p>
          <p>
            Vous gagnez <b className="gain">+{gain} point{gain > 1 ? 's' : ''}</b> : toute votre production passe de ×{abrege(multiplicateurPrestige(j))} à ×{abrege(multiplicateurPrestige(j) + gain)}, pour toujours. Les modules que vous connaissez restent connus.
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
                onFermer()
                requestAnimationFrame(() => {
                  const r = document.querySelector('.base')?.getBoundingClientRect()
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
      <p className="sourd petit centre marge-haute">
        Total produit : {abrege(j.total)} {NOM_R}
      </p>
    </Feuille>
  )
}
