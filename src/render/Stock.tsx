/** L'ENTREPÔT : ce qu'on a, par élément, et ce que les ateliers en font par heure. */
import { useState, type ReactElement } from 'react'
import { ELEMENTS, RESSOURCES, TOUTES, type Ressource } from '../logic/donnees.ts'
import { bilanHoraire, capacite, prixVente } from '../logic/moteur.ts'
import { joueur } from '../logic/partie.ts'
import { NOM_ELEMENT, NOM_RESSOURCE } from '../ui/noms.ts'
import { debitVisible, nombre, nombreFin, possede } from '../ui/format.ts'
import { Echange } from './Echange.tsx'
import { PastilleRessource } from './Icone.tsx'
import type { PageProps } from './props.ts'

export function Stock({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [ouvert, setOuvert] = useState<Ressource | null>(null)
  const net = bilanHoraire(j)
  const cap = capacite(j)
  return (
    <div className="page">
      <h1>Entrepôt</h1>
      <p className="sourd">
        {nombre(cap)} de place par ressource. Une tape sur une ligne pour acheter, vendre ou offrir.
      </p>
      {ELEMENTS.map((e) => (
        <section key={e}>
          <h2 style={{ color: `var(--${e})` }}>{NOM_ELEMENT[e]}</h2>
          {TOUTES.filter((r) => RESSOURCES[r].element === e).map((r) => {
            const plein = j.stock[r] >= cap - 1e-9
            const debit = debitVisible(net[r])
            return (
              <button key={r} type="button" className="ligne ligne-bouton" onClick={() => setOuvert(r)}>
                <span className="ligne-nom">
                  <PastilleRessource r={r} /> {NOM_RESSOURCE[r]}
                </span>
                <span className={`ligne-net ${plein ? 'manque' : debit < 0 ? 'manque' : debit > 0 ? 'gain' : 'sourd'}`}>
                  {plein ? 'plein' : debit !== 0 ? `${debit > 0 ? '+' : ''}${nombreFin(debit)}/h` : ''}
                </span>
                <span className={`ligne-stock${plein ? ' manque' : ''}`}>{possede(j.stock[r])}</span>
                <span className="ligne-prix sourd">{nombre(prixVente(m, r))} or</span>
              </button>
            )
          })}
        </section>
      ))}
      {ouvert !== null && <Echange partie={partie} agir={agir} r={ouvert} onFermer={() => setOuvert(null)} />}
    </div>
  )
}
