/** LE MARCHÉ COMMUN : le prix de R maintenant, sa courbe des dernières heures, et les grosses ventes des autres. */
import type { ReactElement } from 'react'
import { MARCHE } from '../../logic/clic/donnees.ts'
import { demande, prixCourant } from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege, duree } from '../../ui/format.ts'
import { NOM_R } from '../../ui/noms-clic.ts'
import type { PagePropsClic } from './props.ts'

/** Le nombre d'heures de courbe montrées. */
const HEURES = 48

export function MarcheClic({ partie }: PagePropsClic): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const prix = prixCourant(m)
  const ratio = prix / MARCHE.prix
  const points = m.historique.slice(-HEURES)
  const ventes = [...m.gazette].reverse().slice(0, 12)
  return (
    <div className="page">
      <h1>Marché</h1>
      <p className="sourd">
        Tout le monde vend au même marché. Le prix baisse avec ce que tous ont vendu ces dernières heures, et remonte avec le temps. Un gros lot vendu d’un coup rapporte moins que le même étalé.
      </p>
      <section className="carte-aide">
        <div className="ligne">
          <span>
            <b className="prix-grand">{prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} or</b> <span className="sourd">par {NOM_R}</span>
          </span>
          <span className={`ligne-ratio ${ratio > 0.6 ? 'gain' : ratio < 0.35 ? 'manque' : 'sourd'}`}>{Math.round(ratio * 100)} % du prix plein</span>
        </div>
        <Courbe points={points} />
        <p className="sourd petit">
          Les {Math.min(HEURES, points.length)} dernières heures · vendu récemment {abrege(m.volume)} {NOM_R} · demande {abrege(demande(m))} {NOM_R}
        </p>
      </section>
      <section>
        <h2>Grosses ventes</h2>
        {ventes.length === 0 && <p className="sourd">Aucune vente assez grosse pour peser sur le prix, pour le moment.</p>}
        {ventes.map((v, i) => {
          const vendeur = m.joueurs[v.joueur]
          return (
            <div key={i} className={`ligne${vendeur === j ? ' ligne-moi' : ''}`}>
              <span>
                <b>{vendeur?.nom}</b> a vendu {abrege(v.quantite)} {NOM_R} pour {abrege(v.or)} or
              </span>
              <span className="sourd petit">il y a {duree(m.t - v.t)}</span>
            </div>
          )
        })}
      </section>
    </div>
  )
}

/** La courbe du prix : une ligne, entre zéro et le prix plein. */
function Courbe({ points }: { points: number[] }): ReactElement {
  const L = 300
  const H = 60
  if (points.length < 2) return <svg className="courbe" viewBox={`0 0 ${L} ${H}`} aria-hidden />
  const chemin = points.map((p, i) => `${((i / (points.length - 1)) * L).toFixed(1)},${(H - (Math.min(1, p / MARCHE.prix) * (H - 4) + 2)).toFixed(1)}`).join(' ')
  return (
    <svg className="courbe" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1={H - 2} x2={L} y2={H - 2} stroke="rgba(255,246,226,0.2)" strokeWidth="1" />
      <line x1="0" y1="2" x2={L} y2="2" stroke="rgba(255,246,226,0.2)" strokeWidth="1" strokeDasharray="4 4" />
      <polyline points={chemin} fill="none" stroke="var(--or)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
