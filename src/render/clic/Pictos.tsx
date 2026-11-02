/**
 * LES IMAGES DES PRODUCTEURS CARRÉS — la banque, la scierie, la mine : celle
 * de Keko (`public/<fichier>`, servie avec la date du build) quand elle est
 * là ; sinon, un pictogramme d'attente dessiné en code.
 */
import { useState, type ReactElement } from 'react'
import { PRODUCTEURS } from '../../logic/clic/donnees.ts'

export function ImageProducteur({ fichier, picto }: { fichier: string; picto: ReactElement }): ReactElement {
  const [absente, setAbsente] = useState(false)
  if (absente) return picto
  return <img className="mine-image" src={`${import.meta.env.BASE_URL}${fichier}?v=${encodeURIComponent(__DATE_DU_BUILD__)}`} alt="" draggable={false} onError={() => setAbsente(true)} />
}

/** La banque (Keko, 02/11 : « on va changer la mine d'or pour banque ») : un fronton, quatre colonnes, une pièce d'or au fronton. */
export function PictoBanque(): ReactElement {
  return (
    <svg className="mine-picto" viewBox="0 0 100 100" aria-hidden>
      <path d="M10 36 L50 13 L90 36 Z" fill="#d9cdb2" />
      <path d="M20 33 L50 17 L80 33 Z" fill="#b9aa8b" />
      <circle cx="50" cy="27" r="5" fill="#ffc61f" />
      <rect x="10" y="36" width="80" height="8" rx="1" fill="#c4b597" />
      <rect x="25" y="44" width="50" height="36" fill="#2a1d38" />
      {[16, 32, 60, 76].map((x) => (
        <rect key={x} x={x} y="44" width="8" height="36" fill="#e6dcc5" />
      ))}
      <rect x="8" y="80" width="84" height="6" rx="1" fill="#b3a487" />
      <rect x="4" y="86" width="92" height="7" rx="1.5" fill="#9c8f74" />
    </svg>
  )
}

/** La scierie : une lame qui tourne au-dessus d'une pile de rondins. */
export function PictoScierie(): ReactElement {
  return (
    <svg className="mine-picto" viewBox="0 0 100 100" aria-hidden>
      <circle cx="60" cy="38" r="25" fill="none" stroke="#c9ced8" strokeWidth="7" strokeDasharray="5 3.5" />
      <circle cx="60" cy="38" r="21" fill="#aeb4c0" />
      <circle cx="60" cy="38" r="6" fill="#5a6070" />
      <rect x="8" y="62" width="58" height="14" rx="7" fill="#8a5a2b" />
      <rect x="20" y="76" width="64" height="14" rx="7" fill="#7a4e24" />
      {[
        [66, 69],
        [84, 83],
        [13, 83],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="8" fill="#d9a066" />
          <circle cx={x} cy={y} r="4.5" fill="none" stroke="#a8733d" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
}

/** La mine : l'entrée d'une galerie étayée de bois, deux rails, des pierres. */
export function PictoMinePierre(): ReactElement {
  return (
    <svg className="mine-picto" viewBox="0 0 100 100" aria-hidden>
      <path d="M25 90 V58 Q25 46 37 46 H63 Q75 46 75 58 V90 Z" fill="#160d20" />
      <path d="M40 90 L45 62 M60 90 L55 62" stroke="#4a3560" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="16" y="48" width="9" height="42" rx="2" fill="#8a5a2b" />
      <rect x="75" y="48" width="9" height="42" rx="2" fill="#8a5a2b" />
      <rect x="12" y="40" width="76" height="9" rx="2" fill="#a06a33" />
      <rect x="8" y="88" width="84" height="6" rx="2" fill="#5a3d22" />
      <path d="M38 87 L41 80 L48 79 L50 86 Z" fill="#b8bac4" />
      <path d="M51 88 L53 82 L59 81 L61 87 Z" fill="#9a9ca6" />
      <path d="M57 85 L60 77 L66 78 L66 85 Z" fill="#c9cbd3" />
    </svg>
  )
}

/** L'image d'un producteur carré, selon son type : le fichier de Keko qu'on attend, le pictogramme en attendant. */
export function ImageDuType({ type }: { type: number }): ReactElement {
  const t = PRODUCTEURS[type]
  if (t?.genre === 'ressource' && t.ressource === 'bois') return <ImageProducteur fichier="scierie.webp" picto={<PictoScierie />} />
  if (t?.genre === 'ressource') return <ImageProducteur fichier="mine.webp" picto={<PictoMinePierre />} />
  return <ImageProducteur fichier="banque.webp" picto={<PictoBanque />} />
}
