/** LA CARTE DU TUTORIEL : l'étape en cours, sa consigne, et « Compris » pour une étape de savoir. */
import { type ReactElement } from 'react'
import { comprendre, etapePresentee, TUTO } from '../logic/partie.ts'
import { TUTO_TEXTES } from '../ui/devoilement.ts'
import type { PageProps } from './props.ts'

export function Tuto({ partie, agir }: PageProps): ReactElement {
  const e = etapePresentee(partie)
  if (e === null) return <></>
  const t = TUTO_TEXTES[e.id]
  if (t === undefined) return <></>
  return (
    <section className="tuto" role="status">
      <p className="tuto-numero">
        Étape {partie.tuto + 1} / {TUTO.length}
      </p>
      <p className="tuto-titre">{t.titre}</p>
      <p className="tuto-texte">{t.texte}</p>
      {e.concept && (
        <button type="button" className="bouton-principal" onClick={() => agir(() => comprendre(partie))}>
          Compris
        </button>
      )}
    </section>
  )
}
