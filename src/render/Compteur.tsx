/**
 * UN NOMBRE QUI VIT : il glisse vers sa valeur plutôt que de sauter (sauf pour
 * un ou deux points, où l'immédiat vaut mieux), et sursaute quand elle change —
 * vers le haut en blanc, vers le bas en rouge. Avec une `cle`, il peut
 * attendre que les pièces soient arrivées avant de bouger.
 *
 * CHAQUE GAIN RETARDÉ ARRIVE AVEC SA PROPRE PIÈCE (Keko, 02/11 : « quand je
 * spam, le chiffre ne bouge pas et se met à jour quand j'arrête uniquement ») :
 * un changement ne défait plus l'attente du précédent. Le compteur garde la
 * somme des gains encore en vol et montre la valeur moins cette somme ; chaque
 * pièce qui arrive retire la sienne. Un changement sans retard (une dépense)
 * s'applique tout de suite, sans faire oublier les pièces en vol.
 *
 * IL NE SURSAUTE QUE SI CE QU'IL MONTRE CHANGE (Keko, 02/11 : « fais pulser le
 * chiffre de la réserve uniquement quand il augmente ») : la réserve gagne un
 * centième de pièce par seconde, et son « 12 » battait chaque seconde sans
 * bouger. `sursautEnBaisse={false}` le fait aussi se taire quand il baisse.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { possede } from '../ui/format.ts'
import { mouvementReduit, prendreLeRetard } from './effets.ts'

const HAUT: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', color: '#ffffff', offset: 0.3 }, { transform: 'scale(1)' }]
const BAS: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(0.82)', color: 'var(--rouge)', offset: 0.3 }, { transform: 'scale(1)' }]

export function Compteur({
  valeur,
  duree = 420,
  cle,
  format = possede,
  sursautEnBaisse = true,
}: {
  valeur: number
  duree?: number
  cle?: string
  format?: (n: number) => string
  sursautEnBaisse?: boolean
}): ReactElement {
  const ref = useRef<HTMLSpanElement>(null)
  const [montre, setMontre] = useState(valeur)
  const affiche = useRef(valeur)
  /** La dernière valeur reçue. */
  const cible = useRef(valeur)
  /** Les gains encore en vol : reçus, pas encore montrés. */
  const enVol = useRef(0)
  /** L'animation en cours, et les arrivées attendues (défaites seulement au démontage). */
  const image = useRef(0)
  const minuteurs = useRef(new Set<number>())
  const dureeRef = useRef(duree)
  dureeRef.current = duree
  const formatRef = useRef(format)
  formatRef.current = format
  const enBaisseRef = useRef(sursautEnBaisse)
  enBaisseRef.current = sursautEnBaisse

  /** Glisse de ce qui est montré vers la valeur reçue moins ce qui vole encore. */
  const allerVers = (): void => {
    const depuis = affiche.current
    const vers = cible.current - enVol.current
    if (vers === depuis) return
    cancelAnimationFrame(image.current)
    const t0 = performance.now()
    const d = mouvementReduit() || Math.abs(vers - depuis) <= 2 ? 0 : dureeRef.current
    if (formatRef.current(vers) !== formatRef.current(depuis) && (vers > depuis || enBaisseRef.current)) {
      ref.current?.animate(vers > depuis ? HAUT : BAS, { duration: 340, easing: 'cubic-bezier(.2,1.4,.4,1)' })
    }
    const pas = (t: number): void => {
      const u = d === 0 ? 1 : Math.min(1, (t - t0) / d)
      const e = 1 - Math.pow(1 - u, 3)
      affiche.current = depuis + (vers - depuis) * e
      setMontre(affiche.current)
      if (u < 1) image.current = requestAnimationFrame(pas)
    }
    image.current = requestAnimationFrame(pas)
  }

  useEffect(() => {
    if (valeur === cible.current) return
    const ecart = valeur - cible.current
    cible.current = valeur
    const retard = prendreLeRetard(cle)
    if (retard <= 0) {
      allerVers()
      return
    }
    // Ce gain vole : il n'apparaîtra qu'à l'arrivée de sa pièce.
    enVol.current += ecart
    const id = window.setTimeout(() => {
      minuteurs.current.delete(id)
      enVol.current -= ecart
      allerVers()
    }, retard)
    minuteurs.current.add(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, cle])

  useEffect(() => {
    const ids = minuteurs.current
    return () => {
      cancelAnimationFrame(image.current)
      for (const id of ids) window.clearTimeout(id)
    }
  }, [])

  return (
    <span ref={ref} className="compteur">
      {format(montre)}
    </span>
  )
}
