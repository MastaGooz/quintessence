/** UN COÛT en ligne : l'or puis les ressources, en rouge ce qui manque. */
import type { Quantites, Ressource } from '../logic/donnees.ts'
import type { Joueur } from '../logic/moteur.ts'
import { NOM_RESSOURCE } from '../ui/noms.ts'
import { nombre } from '../ui/format.ts'
import { PastilleRessource } from './Icone.tsx'

export function Cout({ or, cout, j }: { or: number; cout: Quantites; j: Joueur }): React.ReactElement {
  return (
    <span className="cout">
      {or > 0 && <span className={j.or < or ? 'manque' : ''}>{nombre(or)} or</span>}
      {Object.entries(cout).map(([r, q]) => (
        <span key={r} className={j.stock[r as Ressource] < (q ?? 0) ? 'manque' : ''}>
          <PastilleRessource r={r as Ressource} taille={9} /> {nombre(q ?? 0)} {NOM_RESSOURCE[r as Ressource]}
        </span>
      ))}
    </span>
  )
}

/** Des quantités sans jugement : « 8 minerai, 4 braises ». */
export function Quantites({ q }: { q: Quantites }): React.ReactElement {
  const parts = Object.entries(q).map(([r, n]) => `${nombre(n ?? 0)} ${NOM_RESSOURCE[r as Ressource]}`)
  return <span>{parts.join(', ')}</span>
}
