/**
 * LE MARCHÉ DES RESSOURCES (Keko, 02/11 : « dès qu'on a construit la scierie
 * ou la mine, on ouvre le marché pour que le joueur achète la ressource
 * manquante ») : une carte par ressource, son stock, son prix ; trois achats,
 * éteints quand l'or manque.
 */
import type { ReactElement } from 'react'
import { MARCHE_RESSOURCES, RESSOURCES, type Ressource } from '../../logic/clic/donnees.ts'
import { prixAchatRessource, stockRessource, type Joueur } from '../../logic/clic/moteur.ts'
import { possede } from '../../ui/format.ts'
import { NOM_RESSOURCE } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'

export function MenuMarche({ j, onAcheter, onFermer }: { j: Joueur; onAcheter: (r: Ressource, q: number, bouton: HTMLElement) => void; onFermer: () => void }): ReactElement {
  return (
    <Feuille titre="Marché" onFermer={onFermer}>
      <div className="choix-ameliorations">
        {RESSOURCES.map((r) => (
          <div key={r} className="marche-ressource">
            <span className="marche-tete">
              <b className="amelioration-nom">
                <SymboleRessource ressource={r} /> {NOM_RESSOURCE[r][0]?.toUpperCase()}
                {NOM_RESSOURCE[r].slice(1)}
              </b>
              <span className="sourd">
                en stock : {possede(stockRessource(j, r))} · {MARCHE_RESSOURCES.prix[r]} <SymbolePiece /> l’unité
              </span>
            </span>
            <span className="marche-achats">
              {MARCHE_RESSOURCES.lots.map((q) => {
                const prix = prixAchatRessource(r, q)
                const payable = j.or + 1e-9 >= prix
                return (
                  <button key={q} type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => onAcheter(r, q, e.currentTarget)}>
                    +{q} <SymboleRessource ressource={r} /> · <span className={payable ? '' : 'prix-manque'}>{prix}</span> <SymbolePiece />
                  </button>
                )
              })}
            </span>
          </div>
        ))}
      </div>
    </Feuille>
  )
}
