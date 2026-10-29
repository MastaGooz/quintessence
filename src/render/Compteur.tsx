/**
 * UN NOMBRE QUI VIT : il glisse vers sa valeur plutôt que de sauter (sauf pour
 * un ou deux points, où l'immédiat vaut mieux), et sursaute quand elle change —
 * vers le haut en blanc, vers le bas en rouge. Avec une `cle`, il peut
 * attendre que les pièces soient arrivées avant de bouger.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { nombre } from '../ui/format.ts'
import { mouvementReduit, prendreLeRetard } from './effets.ts'

const HAUT: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', color: '#ffffff', offset: 0.3 }, { transform: 'scale(1)' }]
const BAS: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(0.82)', color: 'var(--rouge)', offset: 0.3 }, { transform: 'scale(1)' }]

export function Compteur({ valeur, duree = 420, cle }: { valeur: number; duree?: number; cle?: string }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null)
  const [montre, setMontre] = useState(valeur)
  const affiche = useRef(valeur)
  const cible = useRef(valeur)
  useEffect(() => {
    if (valeur === cible.current) return
    const depuis = affiche.current
    const vers = valeur
    cible.current = vers
    const hausse = vers > depuis
    const retard = prendreLeRetard(cle)
    let image = 0
    let minuteur = 0
    const demarrer = (): void => {
      const t0 = performance.now()
      const d = mouvementReduit() || Math.abs(vers - depuis) <= 2 ? 0 : duree
      ref.current?.animate(hausse ? HAUT : BAS, { duration: 340, easing: 'cubic-bezier(.2,1.4,.4,1)' })
      const pas = (t: number): void => {
        const u = d === 0 ? 1 : Math.min(1, (t - t0) / d)
        const e = 1 - Math.pow(1 - u, 3)
        affiche.current = depuis + (vers - depuis) * e
        setMontre(affiche.current)
        if (u < 1) image = requestAnimationFrame(pas)
      }
      image = requestAnimationFrame(pas)
    }
    if (retard > 0) minuteur = window.setTimeout(demarrer, retard)
    else demarrer()
    return () => {
      cancelAnimationFrame(image)
      window.clearTimeout(minuteur)
    }
  }, [valeur, duree, cle])
  return (
    <span ref={ref} className="compteur">
      {nombre(montre)}
    </span>
  )
}
