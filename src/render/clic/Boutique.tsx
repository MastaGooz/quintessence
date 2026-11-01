/**
 * LA BOUTIQUE : ce qui se construit, en matière. Les raffineries, qui donnent
 * une forme aux rondes ; LES MODULES, fabriqués avec la matière formée de leur
 * sorte, de rareté tirée (Keko, 01/11 : « on doit les fabriquer comme le reste
 * puis les placer ») ; les mélangeurs, qui font les couleurs mélangées ; les
 * sources, dans la couleur qu'on veut, payées en rondes de cette couleur ; le
 * départ (le prestige). Les niveaux se prennent sur la carte, dans la bulle du
 * module ou la feuille de la source.
 */
import { useState, type ReactElement } from 'react'
import { COULEURS, FABRICATION, FAMILLES, FORMES, MELANGEURS, PRESTIGE, PRIMAIRES, RAFFINERIES, SOURCES, couleurDe, formeDe, sorteDe, type Cout, type Genre } from '../../logic/clic/donnees.ts'
import {
  acheterProducteur, chancesDe, coutFabrication, coutProducteur, fabriquerModule, genreDe, manquePour, multiplicateurPrestige, peutPayer, pointsSi, prestiger, sortePourPayer, sortesFormees,
  visibleProducteur, visibleQualite, type Joueur, type Module, type Producteur,
} from '../../logic/clic/moteur.ts'
import { joueur } from '../../logic/clic/partie.ts'
import { abrege } from '../../ui/format.ts'
import {
  NOM_COULEUR, NOM_COULEUR_F, NOM_FABRICATION, NOM_MATIERE, NOM_OR, NOM_POINT, NOM_PRESTIGE, NOM_QUALITE, NOM_RARETE, NOM_SOUTE, NOM_TRAIT, NOM_TYPE, NOMS_FORMES, explicationModule, nomSorte,
  nomSortePluriel,
} from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { sonBatir, sonEtape } from '../../ui/sons.ts'
import { eclater, effetDepense, flotter } from '../effets.ts'
import { Feuille } from '../Feuille.tsx'
import { Choix } from './Choix.tsx'
import { Glyphe, Symbole, SymboleSorte } from './Glyphe.tsx'
import type { PagePropsClic } from './props.ts'
import { abregeFin, pourcent } from './texte.ts'

/** La couleur de chaque rareté, pour les éclats. */
export const COULEURS_RARETE: readonly string[] = ['#d9d2e6', '#7fe0a0', '#4fb3e8', '#c77dff', '#ffc61f']

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Un bouton qui paie un coût en matière : la quantité et la sorte qui paierait ; éteint tant qu'elle manque. */
export function BoutonCout({ j, cout, classe = '', onClick, texte }: { j: Joueur; cout: Cout; classe?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; texte?: string }): ReactElement {
  const s = sortePourPayer(j, cout)
  const payable = peutPayer(j, cout)
  const manque = manquePour(j, cout)
  return (
    <button type="button" className={`bouton-cout ${payable ? 'bouton-principal' : ''} ${classe}`} disabled={!payable} onClick={onClick} title={`${abrege(cout.quantite)} ${nomSortePluriel(s)}${manque > 0 ? ` · il en manque ${abrege(manque)}` : ''}`}>
      {texte !== undefined && <span>{texte} · </span>}
      {abrege(cout.quantite)} <SymboleSorte sorte={s} />
    </button>
  )
}

/** La sorte formée la plus abondante du joueur : ce que la fabrication propose d'abord. */
function sorteFormeeDominante(j: Joueur): number {
  let meilleure = sorteDe(0, 1)
  for (const s of sortesFormees()) if ((j.matiere[s] ?? 0) > (j.matiere[meilleure] ?? 0)) meilleure = s
  return meilleure
}

export function Boutique({ partie, agir, onFermer, onProducteur, onModule }: PagePropsClic & { onFermer: () => void; onProducteur: (p: Producteur) => void; onModule: (mo: Module) => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [confirmer, setConfirmer] = useState(false)
  const [sorteFab, setSorteFab] = useState(() => sorteFormeeDominante(j))
  const [dernier, setDernier] = useState<Module | null>(null)
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

  /** LA FABRICATION d'un module : la matière sort, la rareté se révèle au bouton même, le module file vers la soute. */
  const fabriquerIci = (q: number, bouton: HTMLElement): void => {
    const cout = coutFabrication(j, sorteFab, q)
    const r = bouton.getBoundingClientRect()
    effetDepense(r, cout.quantite)
    const fait: { mo: Module | null } = { mo: null }
    agir(() => {
      fait.mo = fabriquerModule(m, j, sorteFab, q)
    })
    const mo = fait.mo
    if (mo === null) return
    setDernier(mo)
    if (mo.rarete >= 2) sonEtape()
    else sonBatir()
    vibrer(mo.rarete >= 3 ? [20, 30, 60, 30, 90] : mo.rarete >= 1 ? [15, 30, 40] : [15, 30])
    const x = r.left + r.width / 2
    const y = r.top
    eclater(x, y, 8 + mo.rarete * 8, COULEURS_RARETE[mo.rarete] ?? 'var(--or)')
    flotter(x, y - 10, `${majuscule(nomSorte(sorteDe(mo.couleur, mo.forme)))} ${NOM_RARETE[mo.rarete]}${mo.trait !== null ? ` · ${NOM_TRAIT[mo.trait]}` : ''}`, `flottant-rarete flottant-rarete-${mo.rarete}`, 1 + mo.rarete * 0.25)
    onModule(mo)
  }

  const gain = pointsSi(j)
  const prestigeVisible = gain >= 1 || j.points > 0 || j.produitRun >= PRESTIGE.base / 4
  const visibles = (genre: Genre): boolean[] => FAMILLES[genre].types.map((_, k) => visibleProducteur(j, FAMILLES[genre].premier + k))
  const prochain = (v: boolean[]): number => v.findIndex((x, k) => k > 0 && !x && v[k - 1] === true)
  const aRaffinerie = j.producteurs.some((p) => genreDe(p) === 'raffinerie')
  const formes = j.matiere.reduce((s, q, k) => (k % FORMES === 0 ? s : s + q), 0)
  const fabricationVisible = aRaffinerie || formes >= 1 || j.modules.length > 0
  const couleurFab = couleurDe(sorteFab)
  const formeFab = formeDe(sorteFab)
  const qualitesVisibles = FABRICATION.qualites.map((_, k) => visibleQualite(j, sorteFab, k))
  const prochaineQualite = qualitesVisibles.findIndex((v) => !v)

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
                    {creux.length} creux pour des modules :{' '}
                    {creux.map((f, n) => (
                      <Symbole key={n} couleur={null} forme={f} />
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
        <span className="petit sourd">
          {RAFFINERIES[k]!.lot} ronds → {RAFFINERIES[k]!.lot} formés par coup
        </span>
      ))}

      {/* LES MODULES : la sorte à choisir, puis une fabrication par qualité visible. */}
      {fabricationVisible && (
        <section>
          <h2>Modules</h2>
          <p className="sourd petit">
            Un module se fabrique avec la {NOM_MATIERE} formée de sa couleur et de sa forme, puis se place sur un creux de sa forme. Sa rareté se tire : la qualité de la fabrication dit les chances.
            Chaque module d’une sorte coûte plus que le précédent, et au moins une demi-heure de ce que vous en produisez.
          </p>
          <span className="petit sourd">La couleur (le stock de cette forme dessous) :</span>
          <Choix
            valeurs={Array.from({ length: COULEURS }, (_, c) => c)}
            choisie={couleurFab}
            signe={(c) => <Symbole couleur={c} forme={formeFab} />}
            nom={(c) => NOM_COULEUR[c] ?? ''}
            stockDe={(c) => j.matiere[sorteDe(c, formeFab)] ?? 0}
            onChoisir={(c) => setSorteFab(sorteDe(c, formeFab))}
          />
          <span className="petit sourd">La forme :</span>
          <Choix
            valeurs={Array.from({ length: FORMES - 1 }, (_, k) => k + 1)}
            choisie={formeFab}
            signe={(f) => <Symbole couleur={couleurFab} forme={f} />}
            nom={(f) => NOMS_FORMES[f] ?? ''}
            stockDe={(f) => j.matiere[sorteDe(couleurFab, f)] ?? 0}
            onChoisir={(f) => setSorteFab(sorteDe(couleurFab, f))}
          />
          <p className="petit">
            <Glyphe couleur={couleurFab} forme={formeFab} /> <b>{majuscule(nomSorte(sorteFab))}</b> : {explicationModule(couleurFab, formeFab)}. En stock : {abrege(j.matiere[sorteFab] ?? 0)}{' '}
            {nomSortePluriel(sorteFab)}
            {(j.fabriques[sorteFab] ?? 0) > 0 && ` · ${j.fabriques[sorteFab]} déjà fabriqué${(j.fabriques[sorteFab] ?? 0) > 1 ? 's' : ''}`}.
          </p>
          {FABRICATION.qualites.map((q, k) =>
            qualitesVisibles[k] ? (
              <div key={q.id} className="ligne ligne-sans-trait">
                <span className="unite-texte">
                  <span>
                    <b>Fabrication {NOM_QUALITE[k]}</b>
                  </span>
                  <span className="petit chances">
                    {chancesDe(k).map((c, r) =>
                      c > 0 ? (
                        <span key={r} className={`rarete-${r}`}>
                          {NOM_RARETE[r]} {pourcent(c)}
                        </span>
                      ) : null,
                    )}
                  </span>
                </span>
                <BoutonCout j={j} cout={coutFabrication(j, sorteFab, k)} texte={NOM_FABRICATION} onClick={(e) => fabriquerIci(k, e.currentTarget)} />
              </div>
            ) : null,
          )}
          {prochaineQualite > 0 && <p className="sourd petit verrou">La fabrication {NOM_QUALITE[prochaineQualite]} se dévoile avec la {NOM_QUALITE[prochaineQualite - 1]}, ou dès que vous pouvez la payer.</p>}
          {dernier !== null && (
            <p className={`petit fabrication-sortie rarete-${dernier.rarete}`}>
              Sorti : <Glyphe couleur={dernier.couleur} forme={dernier.forme} /> <b>{majuscule(nomSorte(sorteDe(dernier.couleur, dernier.forme)))}</b> <span className="rarete-nom">{NOM_RARETE[dernier.rarete]}</span>
              {dernier.trait !== null && <span className="trait"> · {NOM_TRAIT[dernier.trait]}</span>} <span className="sourd">→ dans la {NOM_SOUTE.toLowerCase()}</span>
            </p>
          )}
        </section>
      )}

      {famille('melangeur', 'Mélangeurs', `Un mélangeur fait d’un rond de chacune de deux couleurs de base un rond de leur mélange : ${NOM_COULEUR[0]} + ${NOM_COULEUR[1]} = ${NOM_COULEUR[3]}, ${NOM_COULEUR[1]} + ${NOM_COULEUR[2]} = ${NOM_COULEUR[4]}, ${NOM_COULEUR[0]} + ${NOM_COULEUR[2]} = ${NOM_COULEUR[5]}. Un module mélangé porte les deux effets de ses couleurs. Se paie en ${NOM_MATIERE} formée.`, (k) => (
        <span className="petit sourd">
          {MELANGEURS[k]!.lot} + {MELANGEURS[k]!.lot} ronds → {MELANGEURS[k]!.lot} ronds mélangés par coup
        </span>
      ))}
      {famille('source', 'Sources', `Une source produit des ronds de sa couleur à chaque coup, une tape ou le tic d’une horloge, et se monte de niveau sur la carte. Elle se paie en ronds de la couleur que vous choisissez : c’est là qu’on investit dans sa couleur (${NOM_COULEUR_F.slice(0, PRIMAIRES).join(', ')}).`, (k) => (
        <span className="petit sourd">
          {abregeFin(SOURCES[k]!.lot * prestige)} ronds par coup · <Symbole couleur={0} forme={0} /> <Symbole couleur={1} forme={0} /> <Symbole couleur={2} forme={0} />
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
    </Feuille>
  )
}
