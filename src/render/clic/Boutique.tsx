/**
 * LA BOUTIQUE : ce qui s'achète. Les producteurs, qui apparaissent sous
 * l'installation avec leurs creux vides ; les modules, qui apparaissent posés,
 * à glisser sur un creux de leur forme ; le comptoir automatique ; le prestige.
 * Les niveaux se prennent sur la carte, dans la bulle du module (Keko, 30/10 :
 * « cliquer sur les modules existants et les améliorer individuellement »).
 */
import { useState, type ReactElement } from 'react'
import { AUTO_COUT, MODULES, PRESTIGE, PRODUCTEURS } from '../../logic/clic/donnees.ts'
import {
  acheterAuto, acheterModule, acheterProducteur, branches, coutModule, coutProducteur, multiplicateurPrestige, peutAcheterModule, peutAcheterProducteur,
  pointsSi, prestiger, prisesLibres, visibleModule, visibleProducteur, type Module, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import { EXPLICATION_MODULE, NOM_AUTO, NOM_MODULE, NOM_PRESTIGE, NOM_PRODUCTEUR, NOM_R, NOMS_FORMES } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { boite, cheminDecoupe, cotesDuModule } from './pieces.ts'
import type { PagePropsClic } from './props.ts'
import { abregeFin, texteEffet } from './texte.ts'

const ENCOCHE_GLYPHE = { largeur: 11, profondeur: 7 }
const BOITE_GLYPHE = boite(14, 10, ENCOCHE_GLYPHE)

/** Une petite pièce avec la bosse d'une forme : la forme se reconnaît avant d'acheter, et dit quel creux va avec. */
export function Glyphe({ forme }: { forme: number }): ReactElement {
  return (
    <svg className="glyphe-forme" viewBox={`${BOITE_GLYPHE.x} ${BOITE_GLYPHE.y} ${BOITE_GLYPHE.largeur} ${BOITE_GLYPHE.hauteur}`} aria-label={NOMS_FORMES[forme]}>
      <path d={cheminDecoupe(14, 10, cotesDuModule(forme), ENCOCHE_GLYPHE)} />
    </svg>
  )
}

export function Boutique({
  partie,
  agir,
  onFermer,
  onProducteur,
  onModule,
}: PagePropsClic & { onFermer: () => void; onProducteur: (p: Producteur) => void; onModule: (mo: Module) => void }): ReactElement {
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const branchees = branches(j)
  const prises = prisesLibres(j)
  const prestige = multiplicateurPrestige(j)

  const acheterP = (i: number, bouton: HTMLElement): void => {
    const cout = coutProducteur(j, i)
    effetDepense(bouton.getBoundingClientRect(), cout)
    const achat: { p: Producteur | null } = { p: null }
    agir(() => {
      achat.p = acheterProducteur(j, i)
    })
    if (achat.p !== null) onProducteur(achat.p)
  }
  const acheterM = (k: number, bouton: HTMLElement): void => {
    const cout = coutModule(j, k)
    effetDepense(bouton.getBoundingClientRect(), cout)
    const achat: { mo: Module | null } = { mo: null }
    agir(() => {
      achat.mo = acheterModule(j, k)
    })
    if (achat.mo !== null) onModule(achat.mo)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const autoVisible = !j.auto && (j.or >= AUTO_COUT / 4 || j.modules.length >= 3)
  const producteursVisibles = PRODUCTEURS.map((_, i) => i > 0 && visibleProducteur(j, i))
  const prochainProducteur = producteursVisibles.findIndex((v, i) => i > 0 && !v)

  return (
    <Feuille titre="Boutique" onFermer={onFermer}>
      {/* LES MODULES */}
      <section>
        <h2>Modules</h2>
        <p className="sourd petit">Un module acheté apparaît posé sous l’installation : glissez-le sur un creux de sa forme, sur un producteur. Tapez-le pour l’améliorer.</p>
        {MODULES.map((t, k) => {
          if (!visibleModule(j, k)) return null
          const branches_ = j.modules.filter((mo) => mo.type === k && branchees.has(mo.id)).length
          const poses = j.modules.filter((mo) => mo.type === k && !branchees.has(mo.id)).length
          const creux = prises.filter((p) => p.forme === k).length
          const cout = coutModule(j, k)
          const payable = peutAcheterModule(j, k)
          return (
            <div key={t.id} className="unite">
              <div className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <Glyphe forme={k} /> <b>{NOM_MODULE[k]}</b> {branches_ > 0 && <span className="sourd">× {branches_}</span>}{' '}
                    {poses > 0 && (
                      <span className="sourd petit">
                        (+{poses} posé{poses > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                  <span className="petit sourd">
                    {EXPLICATION_MODULE[k]} · {texteEffet(k, 1)} au niveau 1 · {creux === 0 ? 'aucun creux libre' : `${creux} creux libre${creux > 1 ? 's' : ''}`}
                  </span>
                </span>
                <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheterM(k, e.currentTarget)}>
                  {abrege(cout)} or
                </button>
              </div>
            </div>
          )
        })}
        {j.connusModules < MODULES.length && (
          <p className="sourd petit verrou">
            {NOM_MODULE[j.connusModules]} se dévoile avec votre premier module {NOM_MODULE[j.connusModules - 1]?.toLowerCase()}.
          </p>
        )}
      </section>

      {/* LES PRODUCTEURS */}
      {(producteursVisibles.some((v) => v) || j.connusModules >= 2) && (
        <section>
          <h2>Producteurs</h2>
          <p className="sourd petit">
            Un producteur produit son lot à chaque coup : une tape, ou le tic d’une horloge. Il apparaît sous l’installation, ses creux vides ; vos modules peuvent y déménager.
          </p>
          {PRODUCTEURS.map((t, i) => {
            if (!producteursVisibles[i]) return null
            const possedes = j.producteurs.filter((p) => p.type === i).length
            const cout = coutProducteur(j, i)
            const payable = peutAcheterProducteur(j, i)
            const creux = t.creux.filter((c): c is number => c !== null)
            return (
              <div key={t.id} className="unite">
                <div className="ligne ligne-sans-trait">
                  <span className="unite-texte">
                    <span>
                      <b>{NOM_PRODUCTEUR[i]}</b> {possedes > 0 && <span className="sourd">× {possedes}</span>}
                    </span>
                    <span className="petit sourd">
                      {abregeFin(t.lot * prestige)} {NOM_R} par coup · {creux.length} creux :{' '}
                      {creux.map((f, n) => (
                        <Glyphe key={n} forme={f} />
                      ))}
                    </span>
                  </span>
                  <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheterP(i, e.currentTarget)}>
                    {abrege(cout)} or
                  </button>
                </div>
              </div>
            )
          })}
          {prochainProducteur === 1 && <p className="sourd petit verrou">Le premier producteur se dévoile avec votre second module.</p>}
          {prochainProducteur > 1 && (
            <p className="sourd petit verrou">
              {NOM_PRODUCTEUR[prochainProducteur]} se dévoile avec {NOM_PRODUCTEUR[prochainProducteur - 1]?.toLowerCase()}, ou dès que vous pouvez le payer.
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
                Tout remettre à zéro (producteurs et modules, {NOM_R}, or) contre des points permanents : chaque point ajoute ×1 à tous les lots, tape comprise.
                {j.points > 0 && ` Vous avez ${j.points} point${j.points > 1 ? 's' : ''} (lots ×${abrege(prestige)}).`}
              </span>
              <span className="petit">
                {gain >= 1 ? (
                  <>
                    Maintenant : <b className="gain">+{gain} point{gain > 1 ? 's' : ''}</b>, lots ×{abrege(prestige)} → ×{abrege(prestige + gain)}
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
            Vous perdez vos {j.producteurs.length - 1} producteur{j.producteurs.length > 2 ? 's' : ''} et vos {j.modules.length} module{j.modules.length > 1 ? 's' : ''} avec leurs niveaux,{' '}
            {abrege(j.r)} {NOM_R} et {abrege(j.or)} or. Il ne reste que la base, nue.
          </p>
          <p>
            Vous gagnez <b className="gain">+{gain} point{gain > 1 ? 's' : ''}</b> : tous vos lots passent de ×{abrege(prestige)} à ×{abrege(prestige + gain)}, pour toujours. Ce que vous connaissez reste connu.
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
                  const r = document.querySelector('.producteur-base')?.getBoundingClientRect()
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
