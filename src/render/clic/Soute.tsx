/**
 * LA SOUTE : les modules qui ne sont branchés nulle part. Groupés par sorte,
 * rareté et trait ; chacun se branche là où il rapporte le plus, et trois de
 * même sorte et même rareté se fondent en un de la rareté au-dessus (Keko,
 * 01/11 : « stocker les modules »).
 */
import type { ReactElement } from 'react'
import { FUSION, RARETES, sorteDe } from '../../logic/clic/donnees.ts'
import { brancherAuMieux, fondre, force, fusibles, meilleurePrise, producteurDe, soute, type Module } from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { EXPLICATION_TRAIT, NOM_RARETE, NOM_SOUTE, NOM_TRAIT, explicationModule, nomProducteur, nomSorte, nomSortePluriel } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { Feuille } from '../Feuille.tsx'
import { Glyphe } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'
import { texteEffet } from './texte.ts'

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function Soute({ partie, agir, onFermer, onBranche, onFondu }: PagePropsClic & { onFermer: () => void; onBranche: (mo: Module) => void; onFondu: (mo: Module) => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const modules = [...soute(j)].sort((a, b) => b.rarete - a.rarete || a.couleur - b.couleur || a.forme - b.forme || force(b) - force(a))
  const groupes = fusibles(j)

  const brancher = (mo: Module): void => {
    const fait: { ok: boolean } = { ok: false }
    agir(() => {
      fait.ok = brancherAuMieux(m, j, mo) !== null
    })
    if (!fait.ok) return
    sonBatir()
    vibrer([15, 30])
    onBranche(mo)
  }
  const fondreIci = (couleur: number, forme: number, rarete: number): void => {
    const fait: { mo: Module | null } = { mo: null }
    agir(() => {
      fait.mo = fondre(m, j, couleur, forme, rarete)
    })
    if (fait.mo === null) return
    sonBatir()
    vibrer([20, 30, 50])
    onFondu(fait.mo)
  }
  const toutFondre = (): void => {
    let dernier: Module | null = null
    agir(() => {
      for (let n = 0; n < 200; n++) {
        const g = fusibles(j)[0]
        if (g === undefined) break
        const mo = fondre(m, j, g.couleur, g.forme, g.rarete)
        if (mo === null) break
        dernier = mo
      }
    })
    if (dernier === null) return
    sonBatir()
    vibrer([20, 30, 50, 30, 70])
    onFondu(dernier)
  }

  return (
    <Feuille titre={`${NOM_SOUTE} · ${modules.length}`} onFermer={onFermer}>
      <p className="sourd petit">
        Les modules fabriqués attendent ici. « Brancher » pose un module sur un creux de sa forme où il rapporte le plus, à la place d’un plus faible s’il faut. {FUSION} modules de même
        sorte et même rareté se fondent en un de la rareté au-dessus, au meilleur de leurs niveaux.
      </p>
      {modules.length === 0 && <p className="sourd">Rien en soute : fabriquez un module dans la boutique.</p>}
      {groupes.length > 1 && (
        <button type="button" className="bouton-principal" onClick={toutFondre}>
          Tout fondre
        </button>
      )}
      {groupes.map((g) => (
        <div key={`${g.couleur}:${g.forme}:${g.rarete}`} className="ligne ligne-sans-trait">
          <span className="unite-texte">
            <span>
              <Glyphe couleur={g.couleur} forme={g.forme} /> {g.modules.length} {nomSortePluriel(sorteDe(g.couleur, g.forme))} <span className={`rarete-${g.rarete}`}>{NOM_RARETE[g.rarete]}s</span>
            </span>
            <span className="petit sourd">
              {FUSION} → 1 <span className={`rarete-${g.rarete + 1}`}>{NOM_RARETE[g.rarete + 1]}</span> (effet ×{RARETES.effet[g.rarete + 1]}, le trait est retiré)
            </span>
          </span>
          <button type="button" onClick={() => fondreIci(g.couleur, g.forme, g.rarete)}>
            Fondre {FUSION}
          </button>
        </div>
      ))}
      <section>
        {modules.map((mo) => {
          const prise = meilleurePrise(m, j, mo)
          const porteur = prise === null ? undefined : producteurDe(j, prise.parent)
          return (
            <div key={mo.id} className={`ligne module-ligne rarete-${mo.rarete}`}>
              <span className="unite-texte">
                <span>
                  <Glyphe couleur={mo.couleur} forme={mo.forme} /> <b>{majuscule(nomSorte(sorteDe(mo.couleur, mo.forme)))}</b> <span className="rarete-nom">{NOM_RARETE[mo.rarete]}</span>
                  {mo.trait !== null && <span className="trait"> · {NOM_TRAIT[mo.trait]}</span>}
                </span>
                <span className="petit sourd">
                  {texteEffet(mo.couleur, mo.forme, force(mo))} · niveau {mo.niveau} · {explicationModule(mo.couleur, mo.forme)}
                  {mo.trait !== null && ` · ${EXPLICATION_TRAIT[mo.trait]}`}
                </span>
                <span className="petit sourd">{prise === null ? 'aucun creux où il ferait mieux' : `→ ${porteur === undefined ? '' : nomProducteur(porteur)}${prise.occupant !== null ? ', à la place d’un plus faible' : ''}`}</span>
              </span>
              <button type="button" className={prise !== null ? 'bouton-principal' : ''} disabled={prise === null} onClick={() => brancher(mo)}>
                Brancher
              </button>
            </div>
          )
        })}
      </section>
    </Feuille>
  )
}
