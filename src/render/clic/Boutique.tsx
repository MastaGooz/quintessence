/**
 * LA BOUTIQUE : ce qui se construit, en matière. Les raffineries, qui donnent
 * une forme aux rondes ; les mélangeurs, qui font les couleurs mélangées ; les
 * ateliers, qui transforment la matière formée en modules ; les sources, dans
 * la couleur qu'on veut, payées en rondes de cette couleur ; le départ (le
 * prestige). Les modules ne s'achètent pas : ils sortent des ateliers. Les
 * niveaux se prennent sur la carte, dans la bulle du module ou de la source.
 */
import { useState, type ReactElement } from 'react'
import { ATELIERS, FAMILLES, MELANGEURS, PRESTIGE, PRIMAIRES, RAFFINERIES, SOURCES, sorteDe, type Cout, type Genre } from '../../logic/clic/donnees.ts'
import {
  acheterProducteur, chancesDe, coutProducteur, manquePour, multiplicateurPrestige, peutPayer, pointsSi, prestiger, sortePourPayer, visibleProducteur, type Joueur, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import { NOM_COULEUR, NOM_COULEUR_F, NOM_MATIERE, NOM_OR, NOM_POINT, NOM_PRESTIGE, NOM_RARETE, NOM_TYPE, nomSortePluriel } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { Glyphe, GlypheForme, GlypheSorte } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'
import { abregeFin, heures, pourcent } from './texte.ts'

/** Un bouton qui paie un coût en matière : la quantité et la sorte qui paierait ; éteint tant qu'elle manque. */
export function BoutonCout({ j, cout, classe = '', onClick, texte }: { j: Joueur; cout: Cout; classe?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; texte?: string }): ReactElement {
  const s = sortePourPayer(j, cout)
  const payable = peutPayer(j, cout)
  const manque = manquePour(j, cout)
  return (
    <button type="button" className={`bouton-cout ${payable ? 'bouton-principal' : ''} ${classe}`} disabled={!payable} onClick={onClick} title={`${abrege(cout.quantite)} ${nomSortePluriel(s)}${manque > 0 ? ` · il en manque ${abrege(manque)}` : ''}`}>
      {texte !== undefined && <span>{texte} · </span>}
      {abrege(cout.quantite)} <GlypheSorte sorte={s} />
    </button>
  )
}

export function Boutique({ partie, agir, onFermer, onProducteur }: PagePropsClic & { onFermer: () => void; onProducteur: (p: Producteur) => void }): ReactElement {
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const prestige = multiplicateurPrestige(j)

  const acheterP = (i: number, couleur: number, bouton: HTMLElement): void => {
    const cout = coutProducteur(j, i, couleur)
    effetDepense(bouton.getBoundingClientRect(), cout.quantite)
    const achat: { p: Producteur | null } = { p: null }
    agir(() => {
      achat.p = acheterProducteur(j, i, couleur)
    })
    if (achat.p !== null) onProducteur(achat.p)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const visibles = (genre: Genre): boolean[] => FAMILLES[genre].types.map((_, k) => visibleProducteur(j, FAMILLES[genre].premier + k))
  const prochain = (v: boolean[]): number => v.findIndex((x, k) => k > 0 && !x && v[k - 1] === true)

  /** Une famille de la boutique : chaque modèle visible, son texte, et son bouton (ou ses trois boutons de couleur pour une source). */
  const famille = (genre: Genre, titre: string, intro: string, ligne: (k: number) => ReactElement): ReactElement | null => {
    const v = visibles(genre)
    if (!v.some((x) => x)) return null
    const premier = FAMILLES[genre].premier
    const suivant = prochain(v)
    return (
      <section>
        <h2>{titre}</h2>
        <p className="sourd petit">{intro}</p>
        {FAMILLES[genre].types.map((t, k) => {
          if (!v[k]) return null
          const i = premier + k
          const possedes = j.producteurs.filter((p) => p.type === i).length
          const creux = t.creux.filter((c): c is number => c !== null)
          return (
            <div key={t.id} className="unite">
              <div className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <b>{NOM_TYPE[i]}</b> {possedes > 0 && <span className="sourd">× {possedes}</span>}
                  </span>
                  {ligne(k)}
                  <span className="petit sourd">
                    {creux.length} creux :{' '}
                    {creux.map((f, n) => (
                      <GlypheForme key={n} forme={f} />
                    ))}
                  </span>
                </span>
                {genre === 'source' ? (
                  <span className="boutons-couleurs">
                    {Array.from({ length: PRIMAIRES }, (_, c) => (
                      <BoutonCout key={c} j={j} cout={coutProducteur(j, i, c)} classe="bouton-couleur" onClick={(e) => acheterP(i, c, e.currentTarget)} />
                    ))}
                  </span>
                ) : (
                  <BoutonCout j={j} cout={coutProducteur(j, i)} onClick={(e) => acheterP(i, 0, e.currentTarget)} />
                )}
              </div>
            </div>
          )
        })}
        {suivant > 0 && (
          <p className="sourd petit verrou">
            {NOM_TYPE[premier + suivant]} se dévoile avec {NOM_TYPE[premier + suivant - 1]?.toLowerCase()}
            {genre === 'source' ? '.' : ', ou dès que vous pouvez le payer.'}
          </p>
        )}
      </section>
    )
  }

  return (
    <Feuille titre="Boutique" onFermer={onFermer}>
      <p className="sourd petit">Tout se construit en {NOM_MATIERE} : le bouton dit la quantité et la sorte qui paierait, la plus abondante de celles qui conviennent.</p>
      {famille('raffinerie', 'Raffineries', `Une raffinerie donne une forme aux ronds d’une couleur : carré, triangle ou losange. Une tape convertit un lot ; une horloge convertit toute seule. Se paie en ronds, de la couleur que vous voulez.`, (k) => (
        <span className="petit sourd">{RAFFINERIES[k]!.lot} ronds → {RAFFINERIES[k]!.lot} formés par coup</span>
      ))}
      {famille('atelier', 'Ateliers', `Un atelier transforme de la ${NOM_MATIERE} formée en un module de sa couleur et de sa forme, de rareté tirée. Une fournée coûte un temps de ce que vous produisez de cette sorte ; une tape la lance, une horloge la lance toute seule. Se paie en ${NOM_MATIERE} formée.`, (k) => (
        <>
          <span className="petit sourd">une fournée toutes les {heures(ATELIERS[k]!.duree)} de production, au moins {ATELIERS[k]!.entree} formés</span>
          <span className="petit chances">
            {chancesDe({ type: FAMILLES.atelier.premier + k }).map((c, r) =>
              c > 0 ? (
                <span key={r} className={`rarete-${r}`}>
                  {NOM_RARETE[r]} {pourcent(c)}
                </span>
              ) : null,
            )}
          </span>
        </>
      ))}
      {famille('melangeur', 'Mélangeurs', `Un mélangeur fait d’un rond de chacune de deux couleurs de base un rond de leur mélange : ${NOM_COULEUR[0]} + ${NOM_COULEUR[1]} = ${NOM_COULEUR[3]}, ${NOM_COULEUR[1]} + ${NOM_COULEUR[2]} = ${NOM_COULEUR[4]}, ${NOM_COULEUR[0]} + ${NOM_COULEUR[2]} = ${NOM_COULEUR[5]}. Un module mélangé porte les deux effets de ses couleurs. Se paie en ${NOM_MATIERE} formée.`, (k) => (
        <span className="petit sourd">{MELANGEURS[k]!.lot} + {MELANGEURS[k]!.lot} ronds → {MELANGEURS[k]!.lot} ronds mélangés par coup</span>
      ))}
      {famille('source', 'Sources', `Une source produit des ronds de sa couleur à chaque coup, une tape ou le tic d’une horloge, et se monte de niveau sur la carte. Elle se paie en ronds de la couleur que vous choisissez : c’est là qu’on investit dans sa couleur (${NOM_COULEUR_F.slice(0, PRIMAIRES).join(', ')}).`, (k) => (
        <span className="petit sourd">
          {abregeFin(SOURCES[k]!.lot * prestige)} ronds par coup · <Glyphe couleur={0} forme={0} /> <Glyphe couleur={1} forme={0} /> <Glyphe couleur={2} forme={0} />
        </span>
      ))}

      {/* REPARTIR DE ZÉRO */}
      {prestigeVisible && (
        <section>
          <div className="ligne">
            <span className="unite-texte">
              <b>{NOM_PRESTIGE}</b>
              <span className="petit sourd">
                Tout laisser (générateurs, modules, {NOM_MATIERE}, {NOM_OR}) pour des {NOM_POINT}s permanents : chaque {NOM_POINT} ajoute ×1 à tous vos lots.
                {j.points > 0 && ` Vous avez ${j.points} ${NOM_POINT}${j.points > 1 ? 's' : ''} (×${abrege(prestige)}).`}
              </span>
              <span className="petit">
                {gain >= 1 ? (
                  <>
                    Maintenant : <b className="gain">+{gain} {NOM_POINT}{gain > 1 ? 's' : ''}</b>, ×{abrege(prestige)} → ×{abrege(prestige + gain)}
                  </>
                ) : (
                  <>Premier {NOM_POINT} à {abrege(PRESTIGE.base)} ronds produits dans cette partie ({abrege(j.produitRun)} pour l’instant).</>
                )}
              </span>
            </span>
            <button type="button" className={gain >= 1 ? 'bouton-danger' : ''} disabled={gain < 1} onClick={() => setConfirmer(true)}>
              Repartir
            </button>
          </div>
        </section>
      )}
      {confirmer && (
        <Feuille titre={NOM_PRESTIGE} onFermer={() => setConfirmer(false)}>
          <p>
            Vous laissez vos {j.producteurs.length - PRIMAIRES} générateur{j.producteurs.length - PRIMAIRES > 1 ? 's' : ''} et vos {j.modules.length} module{j.modules.length > 1 ? 's' : ''} avec leurs niveaux,
            votre {NOM_MATIERE} et {abrege(j.or)} {NOM_OR}. Il ne reste que vos trois sources, nues.
          </p>
          <p>
            Vous gagnez <b className="gain">+{gain} {NOM_POINT}{gain > 1 ? 's' : ''}</b> : tous vos lots passent de ×{abrege(prestige)} à ×{abrege(prestige + gain)}, pour toujours. Ce que vous
            connaissez reste connu.
          </p>
          <div className="boutons">
            <button type="button" onClick={() => setConfirmer(false)}>
              Pas maintenant
            </button>
            <button
              type="button"
              className="bouton-danger"
              onClick={() => {
                sonBatir()
                vibrer([30, 40, 60, 40, 30])
                agir(() => {
                  prestiger(j)
                })
                setConfirmer(false)
                onFermer()
                requestAnimationFrame(() => {
                  const r = document.querySelector('.carte')?.getBoundingClientRect()
                  if (r !== undefined) {
                    eclater(r.left + r.width / 2, r.top + r.height / 2, 30)
                    flotter(r.left + r.width / 2, r.top + r.height / 2 - 40, `+${gain} ${NOM_POINT}${gain > 1 ? 's' : ''}`, 'flottant-or', 1.8)
                  }
                })
              }}
            >
              Repartir
            </button>
          </div>
        </Feuille>
      )}
      <p className="sourd petit centre marge-haute">
        Total produit : {abrege(j.total)} ronds · {Array.from({ length: PRIMAIRES }, (_, c) => `${abrege(j.produit[c] ?? 0)} ${NOM_COULEUR[c]}`).join(', ')} dans cette partie
      </p>
      <p className="sourd petit centre">{abrege(j.matiere[sorteDe(0, 0)] ?? 0)} / {abrege(j.matiere[sorteDe(1, 0)] ?? 0)} / {abrege(j.matiere[sorteDe(2, 0)] ?? 0)} ronds en stock</p>
    </Feuille>
  )
}
