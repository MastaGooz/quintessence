/**
 * LE MENU DE CONSTRUCTION (Keko, 02/11 : « l'étape deux : l'onglet
 * construction ; un bouton sur l'UI qui ouvre le menu de construction ;
 * dedans, le choix entre plusieurs producteurs : scierie, mine… ») : une carte
 * par producteur, son prix en face (le même pour tous, il monte à chaque
 * construction), ce qu'il fait ; une tape le construit. Éteintes quand l'or
 * manque.
 */
import type { ReactElement } from 'react'
import { PRODUCTEURS, TYPES_CONSTRUCTION } from '../../logic/clic/donnees.ts'
import { prixConstruction, type Joueur } from '../../logic/clic/moteur.ts'
import { DU_RESSOURCE, NOM_TYPE } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'
import { ImageDuType } from './Pictos.tsx'

export function MenuConstruction({ j, onConstruire, onFermer }: { j: Joueur; onConstruire: (type: number) => void; onFermer: () => void }): ReactElement {
  const prix = prixConstruction(j)
  const payable = j.or + 1e-9 >= prix
  return (
    <Feuille titre="Construire" onFermer={onFermer}>
      <div className="choix-ameliorations">
        {TYPES_CONSTRUCTION.map((type, k) => {
          const r = PRODUCTEURS[type]?.ressource ?? 'bois'
          return (
            <button key={type} type="button" className="amelioration-carte construction-carte" style={{ animationDelay: `${120 + k * 110}ms` }} disabled={!payable} onClick={() => onConstruire(type)}>
              <span className="construction-picto">
                <ImageDuType type={type} />
              </span>
              <span className="construction-texte">
                <span className="amelioration-tete">
                  <b className="amelioration-nom">{NOM_TYPE[type]}</b>
                  <span className="amelioration-prix">
                    {prix} <SymbolePiece />
                  </span>
                </span>
                <span className="amelioration-effet">
                  {DU_RESSOURCE[r]} : une tape remplit sa barre, pleine elle donne 1 <SymboleRessource ressource={r} />
                </span>
                {!payable && (
                  <span className="amelioration-manque">
                    Il manque {Math.ceil(prix - j.or - 1e-9)} <SymbolePiece />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </Feuille>
  )
}
