/**
 * LE MARCHÉ COMMUN : un prix par sorte de matière, sa courbe des dernières
 * heures, et les boutons pour vendre son surplus ou acheter la matière des
 * autres sortes. Le prix baisse avec ce que tous vendent et monte avec ce que
 * tous achètent : un gros lot vendu d'un coup rapporte moins que le même
 * étalé, et une sorte que personne ne produit s'envole dès qu'on l'achète.
 */
import type { ReactElement } from 'react'
import { FORMES, MARCHE } from '../../logic/clic/donnees.ts'
import { acheter, coutAchat, entree, estAtelier, gainVente, prixCourant, quantitePour, vendre, venteRaisonnable } from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import { ADJECTIF_SORTE, NOM_MATIERE, NOM_MODULE, NOM_OR, NOM_SORTE } from '../../ui/noms-clic.ts'
import { effetDepense, effetVente } from '../effets.ts'
import { Glyphe } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'

/** Le nombre d'heures de courbe montrées. */
const HEURES = 48
/** Sous cette part du prix plein, on brade. */
const PLANCHER = 0.5

export function MarcheClic({ partie, agir }: PagePropsClic): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const sortes = Array.from({ length: FORMES }, (_, s) => s).sort((a, b) => (a === j.sorte ? -1 : b === j.sorte ? 1 : a - b))

  const vendreIci = (s: number, q: number, bouton: HTMLElement): void => {
    if (q <= 0) return
    const g = gainVente(m, s, q)
    effetVente(bouton.getBoundingClientRect(), g)
    vibrer([10, 20, 10])
    agir(() => {
      vendre(m, j, s, q)
    })
  }
  const acheterIci = (s: number, q: number, bouton: HTMLElement): void => {
    if (q <= 0) return
    const c = coutAchat(m, s, q)
    if (j.or + 1e-9 < c) return
    effetDepense(bouton.getBoundingClientRect(), c)
    vibrer([10, 20])
    agir(() => {
      acheter(m, j, s, q)
    })
  }

  return (
    <div className="page">
      <h1>Marché</h1>
      <p className="sourd">
        Tout le monde vend et achète au même marché. Le prix d’une sorte baisse avec ce que tous en vendent et remonte avec le temps ; il monte avec ce que tous en achètent. Vous ne produisez que la{' '}
        {NOM_SORTE[j.sorte ?? 0]} : les autres s’achètent ici.
      </p>
      {sortes.map((s) => {
        const prix = prixCourant(m, s)
        const ratio = prix / MARCHE.prix
        const stock = j.matiere[s] ?? 0
        const mienne = s === j.sorte
        const points = (m.marche.historique[s] ?? []).slice(-HEURES)
        const raisonnable = venteRaisonnable(m, s, PLANCHER)
        // Les quantités à acheter : une fournée du plus petit atelier réglé sur cette sorte (sinon du plus petit atelier), et trois.
        const ateliers = j.producteurs.filter(estAtelier)
        const cible = ateliers.filter((p) => p.forme === s).sort((a, b) => entree(j, a) - entree(j, b))[0] ?? ateliers.sort((a, b) => entree(j, a) - entree(j, b))[0]
        const fournee = cible === undefined ? 10 : entree(j, cible)
        const achats = [fournee, fournee * 3]
        const quarts = [0.25, 0.5, 1].map((part) => Math.floor(stock * part))
        return (
          <section key={s} className={`carte-aide marche-sorte${mienne ? ' marche-mienne' : ''}`}>
            <div className="ligne ligne-sans-trait">
              <span className="unite-texte">
                <span>
                  <Glyphe forme={s} /> <b>{NOM_SORTE[s]}</b>
                  {mienne && <span className="sourd petit"> · la vôtre</span>}
                </span>
                <span className="sourd petit">fait des modules {NOM_MODULE[s]?.toLowerCase()}</span>
              </span>
              <span className="marche-prix">
                <b className="prix-grand">{prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</b> <span className="sourd petit">{NOM_OR} l’unité</span>
              </span>
            </div>
            <Courbe points={points} />
            <div className="ligne ligne-sans-trait">
              <span className="petit sourd">
                en stock : <b className="creme">{abrege(stock)}</b> · {Math.round(ratio * 100)} % du prix plein
                {stock > 0 && raisonnable < stock && ` · au-delà de ${abrege(raisonnable)} vendus d’un coup, le prix tombe sous la moitié`}
              </span>
            </div>
            {stock >= 1 && (
              <div className="quantites quantites-petites">
                <span className="petit sourd">Vendre</span>
                {quarts.map((q, k) =>
                  q >= 1 ? (
                    <button key={k} type="button" className={k === 2 ? 'bouton-principal' : ''} onClick={(e) => vendreIci(s, q, e.currentTarget)}>
                      {k === 0 ? '¼' : k === 1 ? '½' : 'tout'} · {abrege(q)} → {abrege(gainVente(m, s, q))} {NOM_OR}
                    </button>
                  ) : null,
                )}
              </div>
            )}
            {!mienne && (
              <div className="quantites quantites-petites">
                <span className="petit sourd">Acheter</span>
                {achats.map((q, k) => {
                  const c = coutAchat(m, s, q)
                  const payable = j.or + 1e-9 >= c
                  return (
                    <button key={k} type="button" disabled={!payable} onClick={(e) => acheterIci(s, q, e.currentTarget)}>
                      {k === 0 ? '1 fournée' : '3 fournées'} · {abrege(q)} pour {abrege(c)} {NOM_OR}
                    </button>
                  )
                })}
                {j.or >= 1 && (
                  <button type="button" onClick={(e) => acheterIci(s, Math.floor(quantitePour(m, s, j.or / 2)), e.currentTarget)}>
                    la moitié de l’{NOM_OR} · {abrege(Math.floor(quantitePour(m, s, j.or / 2)))}
                  </button>
                )}
              </div>
            )}
          </section>
        )
      })}
      <p className="sourd petit">
        Chaque joueur produit une seule sorte de {NOM_MATIERE} ({ADJECTIF_SORTE.join(', ')}). Ce qui se vend beaucoup baisse ; ce que personne ne produit s’envole.
      </p>
    </div>
  )
}

/** La courbe du prix : une ligne, entre zéro et le double du prix plein. */
function Courbe({ points }: { points: number[] }): ReactElement {
  const L = 300
  const H = 44
  const haut = MARCHE.prix * 2
  if (points.length < 2) return <svg className="courbe courbe-basse" viewBox={`0 0 ${L} ${H}`} aria-hidden />
  const chemin = points.map((p, i) => `${((i / (points.length - 1)) * L).toFixed(1)},${(H - (Math.min(1, p / haut) * (H - 4) + 2)).toFixed(1)}`).join(' ')
  return (
    <svg className="courbe courbe-basse" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1={H - 2} x2={L} y2={H - 2} stroke="rgba(255,246,226,0.2)" strokeWidth="1" />
      <line x1="0" y1={H / 2} x2={L} y2={H / 2} stroke="rgba(255,246,226,0.25)" strokeWidth="1" strokeDasharray="4 4" />
      <polyline points={chemin} fill="none" stroke="var(--or)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
