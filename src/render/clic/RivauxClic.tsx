/** LES RIVAUX : le classement par matière produite depuis le début, avec la couleur dominante, la production et les points de chacun. */
import type { ReactElement } from 'react'
import { couleurDominanteDe, debitTotal } from '../../logic/clic/moteur.ts'
import { classement, joueur } from '../../logic/clic/partie.ts'
import { abrege, parSeconde } from '../../ui/format.ts'
import { NOM_POINT } from '../../ui/noms-clic.ts'
import { Glyphe } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'

export function RivauxClic({ partie }: PagePropsClic): ReactElement {
  const moi = joueur(partie)
  const rangs = classement(partie)
  return (
    <div className="page">
      <h1>Rivaux</h1>
      <p className="sourd">Sept autres joueurs, tous au même marché ; la pastille dit la couleur que chacun produit le plus. Le classement compte les ronds produits depuis le début de la saison.</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === moi ? ' ligne-moi' : ''}`}>
            <span className="unite-texte">
              <span>
                {i + 1}. <b>{r.nom}</b> {r.total > 0 && <Glyphe couleur={couleurDominanteDe(r)} forme={0} />}
                {r.points > 0 && (
                  <span className="sourd petit">
                    {' '}
                    · {r.points} {NOM_POINT}
                    {r.points > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <span className="petit sourd">
                {parSeconde(debitTotal(r))} · {r.modules.length} module{r.modules.length > 1 ? 's' : ''}
                {r.prestiges > 0 ? ` · ${r.prestiges} départ${r.prestiges > 1 ? 's' : ''}` : ''}
              </span>
            </span>
            <span>
              <b>{abrege(r.total)}</b> <span className="sourd petit">ronds</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
