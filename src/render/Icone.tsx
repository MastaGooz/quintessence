/**
 * LES ICÔNES, en attendant les images de Keko : une forme par famille de
 * bâtiment, la couleur de l'élément. Trait en `currentColor`.
 */
import { BATIMENTS, RESSOURCES, type Element, type NomBatiment, type Ressource } from '../logic/donnees.ts'

export function couleurDe(e: Element | undefined): string {
  return e === undefined ? 'var(--creme)' : `var(--${e})`
}

function Forme({ type }: { type: string }): React.ReactElement {
  switch (type) {
    case 'extraction':
      // une pioche
      return (
        <>
          <path d="M5 19 15 9" />
          <path d="M12 6c3-1 6 0 8 3-2-3-5-4-8-3Z" />
        </>
      )
    case 'transformation':
      // une fiole
      return (
        <>
          <path d="M10 3h4M11 3v5l-5 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-9V3" />
          <path d="M8 15h8" />
        </>
      )
    case 'chef':
      // une étoile
      return <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
    case 'four':
      // une flamme
      return <path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8Z" />
    case 'attaque':
      // une dague
      return (
        <>
          <path d="M14 4l6 6-9 9-6-6Z" />
          <path d="M5 13l-2 6 6-2M9 9l6 6" />
        </>
      )
    case 'defense':
      // un écu
      return <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6Z" />
    default:
      // une caisse
      return (
        <>
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M4 11h16M12 7v13" />
        </>
      )
  }
}

export function IconeBatiment({ nom, taille = 28 }: { nom: NomBatiment; taille?: number }): React.ReactElement {
  const f = BATIMENTS[nom]
  const type = f.type === 'transformation' && f.avance ? 'transformation' : f.type
  return (
    <svg className="icone" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: couleurDe(f.element) }} aria-hidden>
      <Forme type={type} />
      {f.type === 'transformation' && f.avance && <circle cx="12" cy="12" r="1.2" fill="currentColor" />}
    </svg>
  )
}

/** Une pastille de la couleur de l'élément de la ressource ; les chefs-d'œuvre ont un trait d'or. */
export function PastilleRessource({ r, taille = 12 }: { r: Ressource; taille?: number }): React.ReactElement {
  const f = RESSOURCES[r]
  return (
    <span
      className="pastille"
      style={{
        width: taille,
        height: taille,
        background: couleurDe(f.element),
        boxShadow: f.niveau === 3 ? '0 0 0 2px var(--or)' : f.avance ? '0 0 0 2px rgba(255,246,226,0.5)' : undefined,
      }}
      aria-hidden
    />
  )
}
