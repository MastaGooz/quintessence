/** LES RIVAUX : le classement par matière produite depuis le début, avec la sorte, la production et les points de chacun. */
import type { ReactElement } from 'react'
import { debit } from '../../logic/clic/moteur.ts'
import { classement, joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_MATIERE, NOM_POINT } from '../../ui/noms-clic.ts'
import { Glyphe } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'

export function RivauxClic({ partie }: PagePropsClic): ReactElement {
  const moi = joueur(partie)
  const rangs = classement(partie)
  return (
    <div className="page">
      <h1>Rivaux</h1>
      <p className="sourd">Sept autres joueurs, chacun sa sorte de {NOM_MATIERE}, tous au même marché. Le classement compte la {NOM_MATIERE} produite depuis le début de la saison.</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === moi ? ' ligne-moi' : ''}`}>
            <span className="unite-texte">
              <span>
                {i + 1}. <b>{r.nom}</b> {r.sorte !== null && <Glyphe forme={r.sorte} />}
                {r.points > 0 && (
                  <span className="sourd petit">
                    {' '}
                    · {r.points} {NOM_POINT}
                    {r.points > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <span className="petit sourd">
                {parSeconde(debit(r))} · {r.modules.length} module{r.modules.length > 1 ? 's' : ''}
                {r.prestiges > 0 ? ` · ${r.prestiges} départ${r.prestiges > 1 ? 's' : ''}` : ''}
              </span>
            </span>
            <span>
              <b>{abrege(r.total)}</b> <span className="sourd petit">{NOM_MATIERE}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
