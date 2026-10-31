/** LA PLANÈTE : ce qu'on en connaît (les veines, ce qu'elles donnent, ce qu'il leur reste), ce qu'on en a consumé, et ce que coûte d'aller plus loin. */
import type { ReactElement } from 'react'
import { PLANETE } from '../../logic/clic/donnees.ts'
import { bilanPlanete, coutProspection, frontiere, gisementsConnus, multiplicateurPrestige, planeteDe } from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_ENERGIE, NOM_EXTRACTEUR, NOM_R, NOM_VEINE } from '../../ui/noms-clic.ts'
import type { PagePropsClic } from './props.ts'

export function PlaneteClic({ partie }: PagePropsClic): ReactElement {
  const j = joueur(partie)
  const planete = planeteDe(j)
  const bilan = bilanPlanete(j)
  const consume = bilan.quantite > 0 ? 1 - bilan.restant / bilan.quantite : 0
  const veines = gisementsConnus(j).sort((a, b) => b.gisement.debit - a.gisement.debit || b.restant - a.restant)
  const prestige = multiplicateurPrestige(j)
  // Le prix de la prospection par anneau, pour les anneaux qui touchent le connu.
  const anneaux = [...new Set(frontiere(j).map((z) => z.anneau))].sort((a, b) => a - b)
  return (
    <div className="page">
      <h1>Planète</h1>
      <p className="sourd">
        Une planète finie, en zones. Une zone révélée montre sa {NOM_VEINE} : ce qu’elle donne par heure, ce qu’il lui reste. Un {NOM_EXTRACTEUR} ne produit que posé sur une {NOM_VEINE}, et jamais plus
        qu’elle ne donne. Loin du robot, les {NOM_VEINE}s sont plus riches, et la prospection plus chère.
      </p>
      <section className="carte-aide">
        <div className="ligne">
          <span>
            <b className="prix-grand">{Math.round(consume * 100)} %</b> <span className="sourd">consumé</span>
          </span>
          <span className="sourd petit">
            {j.planete.revelees.length} zone{j.planete.revelees.length > 1 ? 's' : ''} révélée{j.planete.revelees.length > 1 ? 's' : ''} sur {planete.zones.length} · {veines.length} {NOM_VEINE}
            {veines.length > 1 ? 's' : ''}
          </span>
        </div>
        <p className="sourd petit">
          {abrege(bilan.restant)} {NOM_R} encore dans le sol, sur {abrege(bilan.quantite)}. {PLANETE.anneaux} anneaux de zones autour du robot.
        </p>
      </section>
      <section>
        <h2>Vos {NOM_VEINE}s</h2>
        {veines.length === 0 && <p className="sourd">Aucune {NOM_VEINE} connue : prospectez une zone « ? » sur la carte.</p>}
        {veines.map(({ gisement, zone, restant, extracteurs }) => {
          const part = gisement.quantite > 0 ? restant / gisement.quantite : 0
          return (
            <div key={gisement.id} className={`ligne${restant <= 0 ? ' ligne-eteinte' : ''}`}>
              <span className="unite-texte">
                <span>
                  <b>{zone.anneau === 0 ? 'Sous le robot' : `Anneau ${zone.anneau}`}</b>{' '}
                  <span className="sourd petit">
                    · {parSeconde((gisement.debit / 3600) * prestige)} au plus
                    {extracteurs.length > 0 && ` · ${extracteurs.length} ${NOM_EXTRACTEUR}${extracteurs.length > 1 ? 's' : ''}`}
                  </span>
                </span>
                <span className="jauge-veine" aria-hidden>
                  <span style={{ width: `${Math.round(part * 100)}%` }} />
                </span>
              </span>
              <span className={restant <= 0 ? 'manque' : ''}>
                {restant <= 0 ? 'épuisée' : abrege(restant)} <span className="sourd petit">{restant > 0 && `/ ${abrege(gisement.quantite)}`}</span>
              </span>
            </div>
          )
        })}
      </section>
      {anneaux.length > 0 && (
        <section>
          <h2>Prospecter</h2>
          <p className="sourd petit">Tapez une zone « ? » sur la carte. Le prix dépend de l’anneau :</p>
          {anneaux.map((a) => {
            const z = frontiere(j).find((f) => f.anneau === a)
            return (
              <div key={a} className="ligne ligne-sans-trait">
                <span>Anneau {a}</span>
                <span>
                  {z === undefined ? '' : abrege(coutProspection(z))} {NOM_ENERGIE}
                </span>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
