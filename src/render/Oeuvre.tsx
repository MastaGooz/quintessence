/** LE GRAND ŒUVRE : le Four, les quatre couleurs, ce qui manque pour la suivante. */
import { type ReactElement } from 'react'
import { COULEURS, ELEMENTS } from '../logic/donnees.ts'
import { besoinCouleur, CHEF, construire, coutConstruction, lancerCouleur, peutConstruire, peutPayer } from '../logic/moteur.ts'
import { joueur } from '../logic/partie.ts'
import { NOM_COULEUR, NOM_RESSOURCE } from '../ui/noms.ts'
import { duree, nombre } from '../ui/format.ts'
import { Cout } from './Cout.tsx'
import { PastilleRessource } from './Icone.tsx'
import type { PageProps } from './props.ts'

const TEINTES = ['#15090f', '#fff6e2', '#f2c744', '#d92b2b']

export function Oeuvre({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const four = coutConstruction(j, 'four')
  const besoin = besoinCouleur(j)
  return (
    <div className="page">
      <h1>Grand Œuvre</h1>
      {!j.four ? (
        <section>
          <p>
            Le Four philosophal cuit les quatre couleurs de l'œuvre, chacune avec des chefs-d'œuvre des quatre éléments. Il prend un emplacement.
          </p>
          <div className="ligne">
            <Cout or={four.or} cout={four.cout} j={j} />
            <button
              type="button"
              className="bouton-principal"
              disabled={!peutConstruire(j, 'four') || !peutPayer(j, four.or, four.cout)}
              onClick={() =>
                agir(() => {
                  construire(m, j, 'four')
                })
              }
            >
              Bâtir le Four
            </button>
          </div>
          {!peutConstruire(j, 'four') && <p className="sourd petit">Il faut un emplacement libre.</p>}
        </section>
      ) : (
        <section>
          {COULEURS.map((c, i) => {
            const faite = j.couleur > i
            const enCours = j.cuisson !== null && j.couleur === i
            const suivante = j.cuisson === null && j.couleur === i
            return (
              <div key={c.nom} className={`couleur${faite ? ' couleur-faite' : ''}${suivante ? ' couleur-suivante' : ''}`}>
                <span className="couleur-rond" style={{ background: TEINTES[i] }} aria-hidden />
                <div className="couleur-corps">
                  <b>{NOM_COULEUR[i]}</b>
                  <span className="petit sourd">
                    {' '}
                    · {c.parElement} chef{c.parElement > 1 ? 's' : ''}-d’œuvre de chaque élément · cuisson {c.dureeH} h
                  </span>
                  {faite && <p className="petit gain">achevée</p>}
                  {enCours && j.cuisson !== null && (
                    <p className="petit">
                      en cuisson, encore {duree(j.cuisson.fin - m.t)}
                      <span className="jauge">
                        <span className="jauge-plein" style={{ width: `${Math.max(2, 100 * (1 - (j.cuisson.fin - m.t) / c.dureeH))}%` }} />
                      </span>
                    </p>
                  )}
                  {suivante && besoin !== null && (
                    <>
                      <p className="petit">
                        {ELEMENTS.map((e) => {
                          const r = CHEF[e]
                          const a = Math.floor(j.stock[r])
                          const n = besoin[r] ?? 0
                          return (
                            <span key={e} className={`chef-compte${a < n ? ' manque' : ' gain'}`}>
                              <PastilleRessource r={r} taille={9} /> {NOM_RESSOURCE[r]} {a}/{n}
                            </span>
                          )
                        })}
                      </p>
                      <button
                        type="button"
                        className="bouton-principal"
                        disabled={!ELEMENTS.every((e) => j.stock[CHEF[e]] >= (besoin[CHEF[e]] ?? 0))}
                        onClick={() =>
                          agir(() => {
                            lancerCouleur(m, j)
                          })
                        }
                      >
                        Cuire l'{(NOM_COULEUR[i] ?? '').slice(6)}
                      </button>
                      <p className="sourd petit">Les chefs-d'œuvre qui manquent s'achètent au comptoir ou aux autres alchimistes (page Comptoir).</p>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {j.couleur >= COULEURS.length && (
            <p className="alerte">
              Vous tenez la pierre philosophale. {nombre(j.or)} or en poche, et une saison gagnée.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
