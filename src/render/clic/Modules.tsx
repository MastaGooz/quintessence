/**
 * LA FEUILLE DES MODULES : ce qui s'achète. Un module par achat, qui apparaît
 * sous l'arbre et se glisse sur un creux de sa forme ; le comptoir
 * automatique ; le prestige. Les niveaux se prennent sur la carte, dans la
 * bulle du module (Keko, 30/10 : « plutôt que rajouter des modules, cliquer
 * sur les modules existants et les améliorer individuellement »).
 */
import { useState, type ReactElement } from 'react'
import { AUTO_COUT, PRESTIGE, UNITES } from '../../logic/clic/donnees.ts'
import {
  acheterAuto, acheterModule, coutModule, debit, debitAuNiveau, formeDuType, multiplicateurPrestige, peutAcheterModule, pointsSi, prestiger,
  prisesLibres, relies, visible, type Module,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_AUTO, NOM_BASE, NOM_MODULE, NOM_PRESTIGE, NOM_R, NOMS_FORMES } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { boite, cheminDecoupe } from './pieces.ts'
import type { PagePropsClic } from './props.ts'

const ENCOCHE_GLYPHE = { largeur: 10, profondeur: 6 }
const BOITE_GLYPHE = boite(14, 14, ENCOCHE_GLYPHE)

/** Une petite pièce avec la bosse d'une forme : la forme se reconnaît avant d'acheter. */
export function Glyphe({ forme }: { forme: number }): ReactElement {
  return (
    <svg className="glyphe-forme" viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`} aria-hidden>
      <path d={cheminDecoupe(14, 14, [null, null, { genre: 'bosse', forme }, null], ENCOCHE_GLYPHE)} />
    </svg>
  )
}

export function Modules({ partie, agir, onFermer, onModule }: PagePropsClic & { onFermer: () => void; onModule: (mo: Module) => void }): ReactElement {
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const production = debit(j)
  const reliees = relies(j)
  const prises = prisesLibres(j)

  const acheter = (i: number, bouton: HTMLElement): void => {
    const cout = coutModule(j, i)
    effetDepense(bouton.getBoundingClientRect(), cout)
    const achat: { mo: Module | null } = { mo: null }
    agir(() => {
      achat.mo = acheterModule(j, i)
    })
    if (achat.mo !== null) onModule(achat.mo)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const autoVisible = !j.auto && (j.or >= AUTO_COUT / 4 || production >= 0.2)

  return (
    <Feuille titre="Modules" onFermer={onFermer}>
      <p className="sourd petit">
        Un module acheté apparaît sous {NOM_BASE} : glissez-le sur un creux de sa forme, sur {NOM_BASE} ou sur un autre module. Tapez un module pour l’améliorer.
      </p>

      {/* LES MODULES */}
      <section>
        {UNITES.map((u, i) => {
          if (!visible(j, i)) return null
          const forme = formeDuType(i)
          const relies_ = j.modules.filter((mo) => mo.type === i && reliees.has(mo.id)).length
          const poses = j.modules.filter((mo) => mo.type === i && !reliees.has(mo.id)).length
          const creux = prises.filter((p) => p.forme === forme).length
          const cout = coutModule(j, i)
          const payable = peutAcheterModule(j, i)
          return (
            <div key={u.id} className="unite">
              <div className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <Glyphe forme={forme} /> <b>{NOM_MODULE[i]}</b> {relies_ > 0 && <span className="sourd">× {relies_}</span>}{' '}
                    {poses > 0 && (
                      <span className="sourd petit">
                        (+{poses} posé{poses > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                  <span className="petit sourd">
                    {parSeconde(debitAuNiveau(j, i, 1))} au niveau 1 · {NOMS_FORMES[forme]}, {creux === 0 ? 'aucun creux libre' : `${creux} creux libre${creux > 1 ? 's' : ''}`}
                  </span>
                </span>
                <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheter(i, e.currentTarget)}>
                  {abrege(cout)} or
                </button>
              </div>
            </div>
          )
        })}
        {j.connues < UNITES.length && (
          <p className="sourd petit verrou">
            {NOM_MODULE[j.connues]} se dévoile avec votre premier {NOM_MODULE[j.connues - 1]}.
          </p>
        )}
      </section>

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
                Tout remettre à zéro (modules et niveaux, {NOM_R}, or) contre des points permanents : chaque point ajoute ×1 à toute la production, tape comprise.
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
            Vous perdez vos {j.modules.length} module{j.modules.length > 1 ? 's' : ''} et leurs niveaux, {abrege(j.r)} {NOM_R} et {abrege(j.or)} or.
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
