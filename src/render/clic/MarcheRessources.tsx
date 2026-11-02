/**
 * LE MARCHÉ DES RESSOURCES (Keko, 02/11 : « un véritable marché avec un onglet
 * acheter, vendre, avec un prix qui dépend de l'offre et de la demande ») :
 * deux onglets ; une carte par ressource — son prix maintenant, sa courbe des
 * dernières heures, le stock — et trois lots. Acheter fait monter le prix,
 * vendre le fait baisser (voir `MARCHE_RESSOURCES`).
 */
import { useState, type ReactElement } from 'react'
import { MARCHE_RESSOURCES, RESSOURCES, type Ressource } from '../../logic/clic/donnees.ts'
import { coutAchatRessource, gainVenteRessource, historiqueRessource, prixPleinRessource, prixRessource, stockRessource, type Joueur, type Monde } from '../../logic/clic/moteur.ts'
import { possede } from '../../ui/format.ts'
import { NOM_RESSOURCE } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'
import { Courbe } from './MarcheClic.tsx'

/** Le nombre d'heures de courbe montrées. */
const HEURES = 48

type Onglet = 'acheter' | 'vendre'

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const prixLu = (n: number): string => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function MenuMarche({
  m,
  j,
  onAcheter,
  onVendre,
  onFermer,
}: {
  m: Monde
  j: Joueur
  onAcheter: (r: Ressource, q: number, bouton: HTMLElement) => void
  onVendre: (r: Ressource, q: number, bouton: HTMLElement) => void
  onFermer: () => void
}): ReactElement {
  const [onglet, setOnglet] = useState<Onglet>('acheter')
  return (
    <Feuille titre="Marché" onFermer={onFermer}>
      <div className="onglets-marche" role="tablist">
        {(['acheter', 'vendre'] as const).map((o) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} className={onglet === o ? 'onglet-actif' : ''} onClick={() => setOnglet(o)}>
            {o === 'acheter' ? 'Acheter' : 'Vendre'}
          </button>
        ))}
      </div>
      <div className="choix-ameliorations">
        {RESSOURCES.map((r) => {
          const prix = prixRessource(m, r)
          const plein = prixPleinRessource(r)
          const stock = Math.floor(stockRessource(j, r) + 1e-9)
          const points = [...historiqueRessource(m, r).slice(-(HEURES - 1)), prix]
          return (
            <div key={r} className="marche-ressource">
              <span className="marche-tete">
                <b className="amelioration-nom">
                  <SymboleRessource ressource={r} /> {majuscule(NOM_RESSOURCE[r])}
                </b>
                <span>
                  <b className="prix-grand">{prixLu(prix)}</b> <SymbolePiece /> <span className="sourd petit">l’unité</span>
                </span>
              </span>
              <Courbe points={points} plein={plein} />
              <span className="sourd petit">
                en stock : <b className="creme">{possede(stock)}</b> · {Math.round((prix / plein) * 100)} % du prix plein
              </span>
              <span className="marche-achats">
                {MARCHE_RESSOURCES.lots.map((q) => {
                  if (onglet === 'acheter') {
                    const cout = coutAchatRessource(m, r, q)
                    const payable = j.or + 1e-9 >= cout
                    return (
                      <button key={q} type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => onAcheter(r, q, e.currentTarget)}>
                        +{q} <SymboleRessource ressource={r} /> · <span className={payable ? '' : 'prix-manque'}>{cout}</span> <SymbolePiece />
                      </button>
                    )
                  }
                  const vendable = stock >= q
                  return (
                    <button key={q} type="button" className={vendable ? 'bouton-principal' : ''} disabled={!vendable} onClick={(e) => onVendre(r, q, e.currentTarget)}>
                      <span className={vendable ? '' : 'prix-manque'}>−{q}</span> <SymboleRessource ressource={r} /> · {gainVenteRessource(m, r, q)} <SymbolePiece />
                    </button>
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>
    </Feuille>
  )
}
