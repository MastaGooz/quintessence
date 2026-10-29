/** LE COMPTOIR : les cours de tout, en multiple du prix de base ; les offres des joueurs ; la rumeur. */
import { useState, type ReactElement } from 'react'
import { COUPS, RESSOURCES, TOUTES, type Ressource } from '../logic/donnees.ts'
import { acheterAuxJoueurs, aLe, capacite, lancerRumeur, prixVente } from '../logic/moteur.ts'
import { joueur } from '../logic/partie.ts'
import { NOM_RESSOURCE } from '../ui/noms.ts'
import { duree, nombre } from '../ui/format.ts'
import { Echange } from './Echange.tsx'
import { PastilleRessource } from './Icone.tsx'
import type { PageProps } from './props.ts'

export function Marche({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [ouvert, setOuvert] = useState<Ressource | null>(null)
  const [rumeurSur, setRumeurSur] = useState<Ressource>('fer')
  const offres = [...m.offres].filter((o) => o.vendeur !== j.id).sort((a, b) => a.ressource.localeCompare(b.ressource) || a.prix - b.prix)
  const rumeur = m.comptoir.rumeur !== null && m.t < m.comptoir.rumeur.fin ? m.comptoir.rumeur : null
  const rechargeRumeur = Math.max(0, (j.recharges.rumeur ?? 0) - m.t)
  return (
    <div className="page">
      <h1>Comptoir</h1>
      <p className="sourd">Le reste du monde achète et vend tout ; ce sont les alchimistes qui font bouger les prix. La barre montre l'écart au prix de base.</p>
      {rumeur !== null && (
        <p className="alerte">
          Une rumeur fait chuter {NOM_RESSOURCE[rumeur.ressource]} encore {duree(rumeur.fin - m.t)}.
        </p>
      )}
      <section>
        {TOUTES.map((r) => {
          const ratio = prixVente(m, r) / RESSOURCES[r].prix
          const part = Math.min(1, Math.log(Math.max(0.2, ratio)) / Math.log(5) / 2 + 0.5)
          return (
            <button key={r} type="button" className="ligne ligne-bouton" onClick={() => setOuvert(r)}>
              <span className="ligne-nom">
                <PastilleRessource r={r} /> {NOM_RESSOURCE[r]}
              </span>
              <span className="barre-prix" aria-hidden>
                <span className="barre-prix-zero" />
                <span className={`barre-prix-plein ${ratio >= 1 ? 'gain' : 'manque'}`} style={ratio >= 1 ? { left: '50%', width: `${(part - 0.5) * 100}%` } : { left: `${part * 100}%`, width: `${(0.5 - part) * 100}%` }} />
              </span>
              <span className={`ligne-ratio ${ratio > 1.15 ? 'gain' : ratio < 0.85 ? 'manque' : 'sourd'}`}>×{ratio.toFixed(2)}</span>
              <span className="ligne-prix">{nombre(prixVente(m, r))} or</span>
            </button>
          )
        })}
      </section>
      <section>
        <h2>Offres des alchimistes</h2>
        {offres.length === 0 && <p className="sourd">Personne ne vend rien hors du comptoir pour le moment.</p>}
        {offres.map((o, i) => (
          <div key={i} className="ligne">
            <span>
              <PastilleRessource r={o.ressource} /> {NOM_RESSOURCE[o.ressource]} · {m.joueurs[o.vendeur]?.nom} · {nombre(o.quantite)} à <b>{nombre(o.prix)} or</b>
            </span>
            <button type="button" disabled={j.or < o.prix || j.stock[o.ressource] >= capacite(j)} onClick={() => agir(() => acheterAuxJoueurs(m, j, o.ressource, 1))}>
              Acheter 1
            </button>
          </div>
        ))}
      </section>
      {aLe(j, 'cabinet') && (
        <section>
          <h2>Cabinet des rumeurs</h2>
          <p className="sourd petit">
            Une rumeur fait chuter le prix d'une ressource de 30 % pendant 1 h, pour {COUPS.rumeur.or} or. Vendez avant, achetez pendant.
          </p>
          <div className="ligne">
            <select value={rumeurSur} onChange={(e) => setRumeurSur(e.target.value as Ressource)}>
              {TOUTES.map((r) => (
                <option key={r} value={r}>
                  {NOM_RESSOURCE[r]}
                </option>
              ))}
            </select>
            <button type="button" disabled={rechargeRumeur > 0 || j.or < COUPS.rumeur.or} onClick={() => agir(() => lancerRumeur(m, j, rumeurSur))}>
              {rechargeRumeur > 0 ? `Dans ${duree(rechargeRumeur)}` : 'Lancer la rumeur'}
            </button>
          </div>
        </section>
      )}
      {ouvert !== null && <Echange partie={partie} agir={agir} r={ouvert} onFermer={() => setOuvert(null)} />}
    </div>
  )
}
