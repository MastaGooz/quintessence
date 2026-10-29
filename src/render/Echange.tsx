/**
 * ACHETER, VENDRE, OFFRIR une ressource : la feuille commune à l'entrepôt et
 * au marché. Le comptoir vend par tranches, le prix affiché est celui qu'on
 * paiera vraiment.
 */
import { useState, type ReactElement } from 'react'
import { RESSOURCES, type Ressource } from '../logic/donnees.ts'
import { acheter, acheterAuxJoueurs, capacite, estimerAchat, estimerVente, offrir, prixAchat, prixVente, retirerOffres, vendre } from '../logic/moteur.ts'
import { joueur } from '../logic/partie.ts'
import { NOM_RESSOURCE } from '../ui/noms.ts'
import { nombre } from '../ui/format.ts'
import { Feuille } from './Feuille.tsx'
import { PastilleRessource } from './Icone.tsx'
import type { PageProps } from './props.ts'

const QUANTITES = [1, 5, 10, 50]

export function Echange({ partie, agir, r, onFermer }: PageProps & { r: Ressource; onFermer: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [q, setQ] = useState(1)
  const [prixOffre, setPrixOffre] = useState(Math.round(prixVente(m, r)))
  const stock = Math.floor(j.stock[r])
  const cap = capacite(j)
  const maxAchat = Math.max(0, Math.floor(Math.min(cap - j.stock[r], j.or / prixAchat(m, r))))
  const aVendre = Math.min(q, stock)
  const vente = estimerVente(m, r, aVendre)
  const achat = estimerAchat(m, r, q)
  const offres = m.offres.filter((o) => o.ressource === r && o.vendeur !== j.id).sort((a, b) => a.prix - b.prix)
  const miennes = m.offres.filter((o) => o.ressource === r && o.vendeur === j.id)
  return (
    <Feuille titre={NOM_RESSOURCE[r]} onFermer={onFermer}>
      <p className="sourd">
        <PastilleRessource r={r} /> En stock : <b>{nombre(stock)}</b> / {nombre(cap)}. Le comptoir achète à <b>{nombre(prixVente(m, r))} or</b>, vend à <b>{nombre(prixAchat(m, r))} or</b>
        {RESSOURCES[r].prix !== Math.round(prixVente(m, r)) && <> (prix de base {RESSOURCES[r].prix})</>}.
      </p>
      <div className="quantites" role="group" aria-label="Quantité">
        {QUANTITES.map((n) => (
          <button key={n} type="button" className={q === n ? 'actif' : ''} onClick={() => setQ(n)}>
            {n}
          </button>
        ))}
        <button type="button" className={q === stock && stock > 0 ? 'actif' : ''} disabled={stock < 1} onClick={() => setQ(stock)}>
          Tout ({nombre(stock)})
        </button>
      </div>
      <div className="boutons">
        <button type="button" className="bouton-principal" disabled={aVendre < 1} onClick={() => agir(() => vendre(m, j, r, aVendre))}>
          Vendre {nombre(aVendre)} → +{nombre(vente)} or
        </button>
        <button type="button" className="bouton-principal" disabled={q > maxAchat} onClick={() => agir(() => acheter(m, j, r, q))}>
          Acheter {nombre(q)} → −{nombre(achat)} or
        </button>
      </div>
      {q > maxAchat && <p className="sourd petit">{cap - j.stock[r] < q ? "L'entrepôt est trop petit pour cet achat." : "Pas assez d'or pour cet achat."}</p>}
      {offres.length > 0 && (
        <section>
          <h3>Offres des autres alchimistes</h3>
          {offres.map((o, i) => (
            <div key={i} className="ligne">
              <span>
                {m.joueurs[o.vendeur]?.nom} · {nombre(o.quantite)} à <b>{nombre(o.prix)} or</b> l'unité
              </span>
              <button type="button" disabled={j.or < o.prix || j.stock[r] >= cap} onClick={() => agir(() => acheterAuxJoueurs(m, j, r, 1))}>
                Acheter 1
              </button>
            </div>
          ))}
        </section>
      )}
      {RESSOURCES[r].niveau >= 2 && (
        <section>
          <h3>Offrir aux autres alchimistes</h3>
          <p className="sourd petit">L'offre reste chez vous tant que personne ne l'achète ; le comptoir n'y touche pas.</p>
          <div className="ligne">
            <label>
              Prix l'unité{' '}
              <input type="number" min={1} value={prixOffre} onChange={(e) => setPrixOffre(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
            </label>
            <button type="button" disabled={aVendre < 1} onClick={() => agir(() => offrir(m, j, r, aVendre, prixOffre))}>
              Offrir {nombre(aVendre)}
            </button>
          </div>
          {miennes.length > 0 && (
            <div className="ligne">
              <span>
                Mes offres : {miennes.map((o) => `${nombre(o.quantite)} à ${nombre(o.prix)} or`).join(', ')}
              </span>
              <button type="button" onClick={() => agir(() => retirerOffres(m, j))}>
                Tout retirer
              </button>
            </div>
          )}
        </section>
      )}
    </Feuille>
  )
}
