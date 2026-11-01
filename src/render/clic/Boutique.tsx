/**
 * LA BOUTIQUE : ce qui s'achète en or. Les sources, qui produisent la matière
 * du joueur ; les ateliers, qui transforment de la matière en modules ; le
 * départ (le prestige). Les modules ne s'achètent pas : ils sortent des
 * ateliers. Les niveaux se prennent sur la carte, dans la bulle du module
 * (Keko, 30/10 : « cliquer sur les modules existants et les améliorer
 * individuellement »).
 */
import { useState, type ReactElement } from 'react'
import { ATELIERS, PREMIER_ATELIER, PRESTIGE, SOURCES } from '../../logic/clic/donnees.ts'
import {
  acheterProducteur, chancesDe, coutProducteur, multiplicateurPrestige, peutAcheterProducteur, pointsSi, prestiger, visibleProducteur, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import { ADJECTIF_SORTE, NOM_ATELIER, NOM_MATIERE, NOM_OR, NOM_POINT, NOM_PRESTIGE, NOM_PRODUCTEUR, NOM_RARETE, NOM_SOURCE } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { Glyphe } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'
import { abregeFin, pourcent } from './texte.ts'

export function Boutique({ partie, agir, onFermer, onProducteur }: PagePropsClic & { onFermer: () => void; onProducteur: (p: Producteur) => void }): ReactElement {
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const prestige = multiplicateurPrestige(j)

  const acheterP = (i: number, bouton: HTMLElement): void => {
    const cout = coutProducteur(j, i)
    effetDepense(bouton.getBoundingClientRect(), cout)
    const achat: { p: Producteur | null } = { p: null }
    agir(() => {
      achat.p = acheterProducteur(j, i)
    })
    if (achat.p !== null) onProducteur(achat.p)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const sourcesVisibles = SOURCES.map((_, i) => i > 0 && visibleProducteur(j, i))
  const prochaineSource = sourcesVisibles.findIndex((v, i) => i > 0 && !v)
  const ateliersVisibles = ATELIERS.map((_, k) => visibleProducteur(j, PREMIER_ATELIER + k))
  const prochainAtelier = ateliersVisibles.findIndex((v) => !v)
  const sorte = j.sorte ?? 0

  return (
    <Feuille titre="Boutique" onFermer={onFermer}>
      {/* LES ATELIERS */}
      <section>
        <h2>Ateliers</h2>
        <p className="sourd petit">
          Un {NOM_ATELIER} transforme de la {NOM_MATIERE} en un module de la même forme, de rareté tirée. Une fournée coûte un temps de votre production, et une tape la lance ; une horloge la lance
          toute seule. Il travaille d’abord votre {NOM_MATIERE} ; réglez-le sur une autre sorte pour d’autres modules, avec la {NOM_MATIERE} achetée au marché.
        </p>
        {ATELIERS.map((t, k) => {
          const i = PREMIER_ATELIER + k
          if (!ateliersVisibles[k]) return null
          const possedes = j.producteurs.filter((p) => p.type === i).length
          const cout = coutProducteur(j, i)
          const payable = peutAcheterProducteur(j, i)
          const creux = t.creux.filter((c): c is number => c !== null)
          const chances = chancesDe({ id: 0, type: i, x: 0, y: 0, forme: sorte, progres: 0, fournees: 0 })
          return (
            <div key={t.id} className="unite">
              <div className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <b>{NOM_PRODUCTEUR[i]}</b> {possedes > 0 && <span className="sourd">× {possedes}</span>}
                  </span>
                  <span className="petit sourd">
                    une fournée toutes les {t.duree < 1 ? `${Math.round(t.duree * 60)} min` : `${t.duree} h`} de production · {creux.length} creux :{' '}
                    {creux.map((f, n) => (
                      <Glyphe key={n} forme={f} />
                    ))}
                  </span>
                  <span className="petit chances">
                    {chances.map((c, r) =>
                      c > 0 ? (
                        <span key={r} className={`rarete-${r}`}>
                          {NOM_RARETE[r]} {pourcent(c)}
                        </span>
                      ) : null,
                    )}
                  </span>
                </span>
                <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheterP(i, e.currentTarget)}>
                  {abrege(cout)} {NOM_OR}
                </button>
              </div>
            </div>
          )
        })}
        {prochainAtelier > 0 && (
          <p className="sourd petit verrou">
            {NOM_PRODUCTEUR[PREMIER_ATELIER + prochainAtelier]} se dévoile avec {NOM_PRODUCTEUR[PREMIER_ATELIER + prochainAtelier - 1]?.toLowerCase()}, ou dès que vous pouvez le payer.
          </p>
        )}
      </section>

      {/* LES SOURCES */}
      {(sourcesVisibles.some((v) => v) || j.modules.length >= 2) && (
        <section>
          <h2>Sources</h2>
          <p className="sourd petit">
            Une {NOM_SOURCE} produit votre {NOM_MATIERE} {ADJECTIF_SORTE[sorte]} à chaque coup, une tape ou le tic d’une horloge. Elle apparaît avec ses creux vides : vos modules peuvent y déménager.
          </p>
          {SOURCES.map((t, i) => {
            if (!sourcesVisibles[i]) return null
            const possedes = j.producteurs.filter((p) => p.type === i).length
            const cout = coutProducteur(j, i)
            const payable = peutAcheterProducteur(j, i)
            const creux = t.creux.filter((c): c is number => c !== null)
            return (
              <div key={t.id} className="unite">
                <div className="ligne ligne-sans-trait">
                  <span className="unite-texte">
                    <span>
                      <b>{NOM_PRODUCTEUR[i]}</b> {possedes > 0 && <span className="sourd">× {possedes}</span>}
                    </span>
                    <span className="petit sourd">
                      {abregeFin(t.lot * prestige)} {NOM_MATIERE} par coup · {creux.length} creux :{' '}
                      {creux.map((f, n) => (
                        <Glyphe key={n} forme={f} />
                      ))}
                    </span>
                  </span>
                  <button type="button" className={payable ? 'bouton-principal' : ''} disabled={!payable} onClick={(e) => acheterP(i, e.currentTarget)}>
                    {abrege(cout)} {NOM_OR}
                  </button>
                </div>
              </div>
            )
          })}
          {prochaineSource === 1 && <p className="sourd petit verrou">La première {NOM_SOURCE} se dévoile avec votre second module.</p>}
          {prochaineSource > 1 && (
            <p className="sourd petit verrou">
              {NOM_PRODUCTEUR[prochaineSource]} se dévoile avec {NOM_PRODUCTEUR[prochaineSource - 1]?.toLowerCase()}, ou dès que vous pouvez la payer.
            </p>
          )}
        </section>
      )}

      {/* REPARTIR DE ZÉRO */}
      {prestigeVisible && (
        <section>
          <div className="ligne">
            <span className="unite-texte">
              <b>{NOM_PRESTIGE}</b>
              <span className="petit sourd">
                Tout laisser (générateurs, modules, {NOM_MATIERE}, {NOM_OR}) et rechoisir votre {NOM_MATIERE}, avec des {NOM_POINT}s permanents : chaque {NOM_POINT} ajoute ×1 à tous vos lots.
                {j.points > 0 && ` Vous avez ${j.points} ${NOM_POINT}${j.points > 1 ? 's' : ''} (×${abrege(prestige)}).`}
              </span>
              <span className="petit">
                {gain >= 1 ? (
                  <>
                    Maintenant : <b className="gain">+{gain} {NOM_POINT}{gain > 1 ? 's' : ''}</b>, ×{abrege(prestige)} → ×{abrege(prestige + gain)}
                  </>
                ) : (
                  <>Premier {NOM_POINT} à {abrege(PRESTIGE.base)} {NOM_MATIERE} produite dans cette partie ({abrege(j.produitRun)} pour l’instant).</>
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
            Vous laissez vos {j.producteurs.length - 1} générateur{j.producteurs.length > 2 ? 's' : ''} et vos {j.modules.length} module{j.modules.length > 1 ? 's' : ''} avec leurs niveaux, votre{' '}
            {NOM_MATIERE} et {abrege(j.or)} {NOM_OR}. Il ne reste que la base, nue, et vous rechoisissez votre {NOM_MATIERE}.
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
                  const r = document.querySelector('.choix-sorte h1')?.getBoundingClientRect()
                  if (r !== undefined) {
                    eclater(r.left + r.width / 2, r.top + r.height / 2, 30)
                    flotter(r.left + r.width / 2, r.top, `+${gain} ${NOM_POINT}${gain > 1 ? 's' : ''}`, 'flottant-or', 1.8)
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
        Total produit : {abrege(j.total)} {NOM_MATIERE}
      </p>
    </Feuille>
  )
}
