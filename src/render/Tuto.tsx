/**
 * LA CARTE DU TUTORIEL : l'étape en cours, sa consigne, et « Compris » pour une
 * étape de savoir. Une étape accomplie se coche en vert, sa jauge avance, puis
 * la suivante entre à sa place.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { comprendre, etapePresentee, TUTO } from '../logic/partie.ts'
import { TUTO_TEXTES } from '../ui/devoilement.ts'
import { vibrer } from '../ui/haptique.ts'
import { sonClic, sonEtape } from '../ui/sons.ts'
import { eclater, mouvementReduit } from './effets.ts'
import type { PageProps } from './props.ts'

/** Le temps pendant lequel l'étape cochée reste à l'écran. */
const COCHE_MS = 950

const ENTREE: Keyframe[] = [{ transform: 'translateY(14px) scale(0.96)', opacity: 0 }, { transform: 'none', opacity: 1 }]

export function Tuto({ partie, agir }: PageProps): ReactElement {
  const index = partie.tuto
  const vu = useRef(index)
  const [cochee, setCochee] = useState<number | null>(null)
  const entrer = useRef(false)
  const ref = useRef<HTMLElement>(null)

  // L'étape a avancé : on coche la précédente un instant, avec son carillon.
  useEffect(() => {
    if (index === vu.current) return
    const avance = index > vu.current && vu.current < TUTO.length
    vu.current = index
    if (!avance) return
    setCochee(index - 1)
    sonEtape()
    vibrer([15, 40, 30])
    const r = ref.current?.getBoundingClientRect()
    if (r !== undefined) eclater(r.left + r.width / 2, r.top + 12, 12, 'var(--vert)')
    const t = window.setTimeout(() => {
      entrer.current = true
      setCochee(null)
    }, COCHE_MS)
    return () => window.clearTimeout(t)
  }, [index])

  // La nouvelle étape entre par le bas.
  useEffect(() => {
    if (cochee !== null || !entrer.current) return
    entrer.current = false
    if (!mouvementReduit()) ref.current?.animate(ENTREE, { duration: 380, easing: 'cubic-bezier(.2,1.2,.4,1)' })
  }, [cochee])

  if (cochee !== null) {
    const t = TUTO_TEXTES[TUTO[cochee]?.id ?? '']
    return (
      <section ref={ref} className="tuto tuto-cochee" role="status">
        <p className="tuto-numero">Étape {cochee + 1} / {TUTO.length} · faite</p>
        <p className="tuto-titre">
          <span className="tuto-coche">✓</span> {t?.titre}
        </p>
        <Jauge n={cochee + 1} />
      </section>
    )
  }
  const e = etapePresentee(partie)
  if (e === null) return <></>
  const t = TUTO_TEXTES[e.id]
  if (t === undefined) return <></>
  return (
    <section ref={ref} className="tuto" role="status">
      <p className="tuto-numero">
        Étape {index + 1} / {TUTO.length}
      </p>
      <p className="tuto-titre">{t.titre}</p>
      <p className="tuto-texte">{t.texte}</p>
      {e.concept && (
        <button
          type="button"
          className="bouton-principal"
          onClick={() => {
            sonClic()
            agir(() => comprendre(partie))
          }}
        >
          Compris
        </button>
      )}
      <Jauge n={index} />
    </section>
  )
}

function Jauge({ n }: { n: number }): ReactElement {
  return (
    <span className="tuto-jauge" aria-hidden>
      <span style={{ width: `${(n / TUTO.length) * 100}%` }} />
    </span>
  )
}
