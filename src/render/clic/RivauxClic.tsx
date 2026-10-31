/** LES RIVAUX : le classement par minerai extrait depuis le début, avec la production et les plans de chacun. */
import type { ReactElement } from 'react'
import { debit } from '../../logic/clic/moteur.ts'
import { classement, joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_AUTO, NOM_PLAN, NOM_R } from '../../ui/noms-clic.ts'
import type { PagePropsClic } from './props.ts'

export function RivauxClic({ partie }: PagePropsClic): ReactElement {
  const moi = joueur(partie)
  const rangs = classement(partie)
  return (
    <div className="page">
      <h1>Rivaux</h1>
      <p className="sourd">Sept autres robots consument chacun leur planète, la même que la vôtre. Le classement compte la {NOM_R} extraite depuis le début de la saison.</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === moi ? ' ligne-moi' : ''}`}>
            <span className="unite-texte">
              <span>
                {i + 1}. <b>{r.nom}</b>
                {r.points > 0 && (
                  <span className="sourd petit">
                    {' '}
                    · {r.points} {NOM_PLAN}
                    {r.points > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <span className="petit sourd">
                {parSeconde(debit(r))}
                {r.auto ? ` · ${NOM_AUTO.toLowerCase()}` : ''}
                {r.prestiges > 0 ? ` · ${r.prestiges} planète${r.prestiges > 1 ? 's' : ''} quittée${r.prestiges > 1 ? 's' : ''}` : ''}
              </span>
            </span>
            <span>
              <b>{abrege(r.total)}</b> <span className="sourd petit">{NOM_R}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
