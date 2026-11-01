/**
 * LE MARCHÉ COMMUN : un prix par sorte, les vingt-quatre en grille (une ligne
 * par couleur, une colonne par forme). Une case tapée ouvre sa feuille : la
 * courbe des dernières heures, et les boutons pour vendre son surplus ou
 * acheter. Le prix baisse avec ce que tous vendent et monte avec ce que tous
 * achètent : un gros lot vendu d'un coup rapporte moins que le même étalé, et
 * une sorte que personne ne produit s'envole dès qu'on l'achète (Keko : « le
 * marché échange tout, ainsi un joueur peut se spécialiser dans un type de
 * forme ou de couleur »).
 */
import { useState, type ReactElement } from 'react'
import { COULEURS, FORMES, MARCHE, formeDe, sorteDe } from '../../logic/clic/donnees.ts'
import { acheter, coutAchat, coutFabrication, gainVente, prixCourant, production, quantitePour, vendre, venteRaisonnable } from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import { vibrer } from '../../ui/haptique.ts'
import { NOM_COULEUR, NOM_MATIERE, NOM_OR, NOMS_FORMES, nomSorte, nomSortePluriel } from '../../ui/noms-clic.ts'
import { effetDepense, effetVente } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { SymboleSorte } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'

/** Le nombre d'heures de courbe montrées. */
const HEURES = 48
/** Sous cette part du prix plein, on brade. */
const PLANCHER = 0.5

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function MarcheClic({ partie, agir }: PagePropsClic): ReactElement {
  const [choisie, setChoisie] = useState<number | null>(null)

  return (
    <div className="page">
      <h1>Marché</h1>
      <p className="sourd">
        Tout le monde vend et achète au même marché, une sorte de {NOM_MATIERE} par case. Le prix baisse avec ce que tous en vendent et remonte avec le temps ; il monte avec ce que tous en achètent.
        Touchez une case pour vendre ou acheter.
      </p>
      <div className="marche-grille">
        <span className="marche-coin" />
        {Array.from({ length: FORMES }, (_, f) => (
          <span key={f} className="marche-tete petit sourd">
            {NOMS_FORMES[f]}
          </span>
        ))}
        {Array.from({ length: COULEURS }, (_, c) => (
          <Ligne key={c} c={c} partie={partie} onChoisir={setChoisie} />
        ))}
      </div>
      <p className="sourd petit">Les rondes sont la matière brute, les trois autres formes font des modules. Ce qui se vend beaucoup baisse ; ce que personne ne produit s’envole.</p>
      {choisie !== null && (
        <Feuille titre={majuscule(nomSorte(choisie))} onFermer={() => setChoisie(null)}>
          <Detail partie={partie} agir={agir} sorte={choisie} />
        </Feuille>
      )}
    </div>
  )
}

/** Une ligne de la grille : la couleur, puis une case par forme. */
function Ligne({ c, partie, onChoisir }: { c: number; partie: PagePropsClic['partie']; onChoisir: (s: number) => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  return (
    <>
      <span className="marche-tete petit sourd">{NOM_COULEUR[c]}</span>
      {Array.from({ length: FORMES }, (_, f) => {
        const s = sorteDe(c, f)
        const prix = prixCourant(m, s)
        const stock = j.matiere[s] ?? 0
        const produit = production(j, s) > 0
        return (
          <button key={f} type="button" className={`marche-case${stock >= 1 ? ' marche-case-stock' : ''}${produit ? ' marche-case-produite' : ''}`} onClick={() => onChoisir(s)} aria-label={nomSorte(s)}>
            <SymboleSorte sorte={s} classe="symbole-grand" />
            <b>{prix.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
            <small className={stock >= 1 ? 'creme' : 'sourd'}>{stock >= 1 ? abrege(stock) : '·'}</small>
          </button>
        )
      })}
    </>
  )
}

/** La feuille d'une sorte : sa courbe, son prix, son stock, vendre et acheter. */
function Detail({ partie, agir, sorte: s }: PagePropsClic & { sorte: number }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const prix = prixCourant(m, s)
  const ratio = prix / MARCHE.prix
  const stock = j.matiere[s] ?? 0
  const points = (m.marche.historique[s] ?? []).slice(-HEURES)
  const raisonnable = venteRaisonnable(m, s, PLANCHER)
  const prod = production(j, s) * 3600
  // Les quantités à acheter : de quoi fabriquer un module de cette sorte (une formée), dix et cent.
  const module = formeDe(s) === 0 ? null : coutFabrication(j, s, 0).quantite
  const achats = module === null ? [10, 100] : [module, 100]
  const quarts = [0.25, 0.5, 1].map((part) => Math.floor(stock * part))

  const vendreIci = (q: number, bouton: HTMLElement): void => {
    if (q <= 0) return
    const g = gainVente(m, s, q)
    effetVente(bouton.getBoundingClientRect(), g)
    vibrer([10, 20, 10])
    agir(() => {
      vendre(m, j, s, q)
    })
  }
  const acheterIci = (q: number, bouton: HTMLElement): void => {
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
    <>
      <div className="ligne ligne-sans-trait">
        <span className="unite-texte">
          <span>
            <SymboleSorte sorte={s} /> <b>{nomSortePluriel(s)}</b>
          </span>
          <span className="sourd petit">{prod > 0 ? `vous en produisez ${abrege(prod)} par heure` : 'vous n’en produisez pas'}</span>
        </span>
        <span className="marche-prix">
          <b className="prix-grand">{prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</b> <span className="sourd petit">{NOM_OR} l’unité</span>
        </span>
      </div>
      <Courbe points={points} />
      <p className="petit sourd">
        en stock : <b className="creme">{abrege(stock)}</b> · {Math.round(ratio * 100)} % du prix plein
        {stock > 0 && raisonnable < stock && ` · au-delà de ${abrege(raisonnable)} vendus d’un coup, le prix tombe sous la moitié`}
      </p>
      {stock >= 1 && (
        <div className="quantites quantites-petites">
          <span className="petit sourd">Vendre</span>
          {quarts.map((q, k) =>
            q >= 1 ? (
              <button key={k} type="button" className={k === 2 ? 'bouton-principal' : ''} onClick={(e) => vendreIci(q, e.currentTarget)}>
                {k === 0 ? '¼' : k === 1 ? '½' : 'tout'} · {abrege(q)} → {abrege(gainVente(m, s, q))} {NOM_OR}
              </button>
            ) : null,
          )}
        </div>
      )}
      <div className="quantites quantites-petites">
        <span className="petit sourd">Acheter</span>
        {achats.map((q, k) => {
          const c = coutAchat(m, s, q)
          const payable = j.or + 1e-9 >= c
          return (
            <button key={k} type="button" disabled={!payable} onClick={(e) => acheterIci(q, e.currentTarget)}>
              {module !== null && k === 0 ? 'un module' : abrege(q)} · {abrege(q)} pour {abrege(c)} {NOM_OR}
            </button>
          )
        })}
        {j.or >= 1 && (
          <button type="button" onClick={(e) => acheterIci(Math.floor(quantitePour(m, s, j.or / 2)), e.currentTarget)}>
            la moitié de l’{NOM_OR} · {abrege(Math.floor(quantitePour(m, s, j.or / 2)))}
          </button>
        )}
      </div>
      {j.or < 1 && <p className="sourd petit">Pas d’{NOM_OR} : vendez d’abord du surplus.</p>}
    </>
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
