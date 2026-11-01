/** Les boutons d'un réglage : pour chaque valeur possible, un signe et le stock de la sorte qui compte ; la valeur choisie est allumée. */
import type { ReactElement } from 'react'
import { abrege } from '../../ui/format.ts'

export function Choix({
  valeurs,
  choisie,
  signe,
  nom,
  stockDe,
  onChoisir,
}: {
  valeurs: number[]
  choisie: number
  signe: (v: number) => ReactElement
  nom: (v: number) => string
  stockDe: (v: number) => number
  onChoisir: (v: number) => void
}): ReactElement {
  return (
    <div className={`choix-forme${valeurs.length > 4 ? ' choix-couleur' : ''}`}>
      {valeurs.map((v) => (
        <button key={v} type="button" className={v === choisie ? 'actif' : ''} aria-label={nom(v)} onClick={() => onChoisir(v)}>
          {signe(v)}
          <small>{abrege(stockDe(v))}</small>
        </button>
      ))}
    </div>
  )
}
