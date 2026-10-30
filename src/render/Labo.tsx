/**
 * LE LABORATOIRE : la tape (+1 or), la carte du tutoriel, puis la grille des
 * emplacements et les réserves. Une tape sur un bâtiment l'ouvre (améliorer,
 * démolir), une tape sur la place vide ouvre ce qu'on peut bâtir — et cette
 * liste grandit d'un bâtiment par étape du tutoriel.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BATIMENTS, ELEMENTS, LABO, TOUTES, type NomBatiment, type Quantites, type Ressource } from '../logic/donnees.ts'
import {
  ameliorer, bilanHoraire, capacite, construire, coutAmelioration, coutConstruction, demolir, emplacements, entreeManquante,
  estimerVente, multiplicateur, occupes, peutConstruire, peutPayer, rang, sortiePleine, tapoter, vendre, type Batiment,
} from '../logic/moteur.ts'
import { atteint, batimentOuvert, joueur } from '../logic/partie.ts'
import { EFFET_BATIMENT, NOM_BATIMENT, NOM_COULEUR, NOM_ELEMENT, NOM_RESSOURCE } from '../ui/noms.ts'
import { duree, nombre, nombreFin } from '../ui/format.ts'
import { vibrer } from '../ui/haptique.ts'
import { sonBatir, sonTape } from '../ui/sons.ts'
import { Compteur } from './Compteur.tsx'
import { Cout, Quantites as Quantite } from './Cout.tsx'
import { eclater, effetDebit, effetDepense, effetVente, flotter, mouvementReduit } from './effets.ts'
import { Feuille } from './Feuille.tsx'
import { IconeBatiment, PastilleRessource } from './Icone.tsx'
import { Tuto } from './Tuto.tsx'
import type { PageProps } from './props.ts'

/** La tape s'écrase puis rebondit, à chaque doigt posé. */
const ECRASER: Keyframe[] = [{ transform: 'scale(0.93)' }, { transform: 'scale(1.03)', offset: 0.6 }, { transform: 'scale(1)' }]

/** Deux tapes à moins de ce délai forment une série : le son monte, le « +1 » grossit. */
const SERIE_MS = 450

/** Les familles de la liste « Bâtir » ; une famille sans bâtiment ouvert ne se montre pas. */
const FAMILLES: { titre: string; noms: NomBatiment[] }[] = [
  { titre: 'Agrandir', noms: ['extension', 'entrepot'] },
  { titre: 'Extraction', noms: ['argiliere', 'mineFer', 'mineCharbon', 'sabliere', 'jardin', 'saline', 'soufriere', 'geode'] },
  { titre: 'Ateliers', noms: ['fourneau', 'forge', 'verrerie', 'alambic'] },
  { titre: 'Ateliers avancés', noms: ['autel', 'creuset', 'cornue', 'atelierRunes'] },
  { titre: 'Chefs-d’œuvre (maîtres seulement)', noms: ['athanor', 'grandCreuset', 'fontaine', 'observatoire'] },
  { titre: 'Grand Œuvre', noms: ['four'] },
  { titre: 'Coups bas', noms: ['repaire', 'officine', 'cabinet', 'tour'] },
  { titre: 'Défense', noms: ['gardien', 'cercle'] },
]

function fois(q: Quantites | undefined, k: number): Quantites {
  const r: Quantites = {}
  for (const [n, v] of Object.entries(q ?? {})) r[n as keyof Quantites] = Math.round((v ?? 0) * k * 10) / 10
  return r
}

export function Labo({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [ouvert, setOuvert] = useState<Batiment | 'construire' | 'four' | null>(null)
  const places = emplacements(j)
  const libres = places - occupes(j)
  const rienBati = j.batiments.length === 0 && !j.four

  // LA SÉRIE DE TAPES : combien d'affilée, et quand la dernière.
  const serie = useRef({ n: 0, t: 0 })
  const taper = (x: number, y: number, bouton: HTMLElement): void => {
    const maintenant = performance.now()
    serie.current = { n: maintenant - serie.current.t < SERIE_MS ? serie.current.n + 1 : 0, t: maintenant }
    const n = serie.current.n
    agir(() => tapoter(j))
    sonTape(n)
    vibrer(8)
    if (!mouvementReduit()) bouton.animate(ECRASER, { duration: 170, easing: 'ease-out' })
    flotter(x, y, '+1', 'flottant-or', Math.min(1.7, 1 + n * 0.05))
    if (n > 0 && n % 10 === 9) eclater(x, y, 14)
    else if (Math.random() < 0.3) eclater(x, y, 3)
  }

  // LE BÂTIMENT NEUF : le dernier de la grille apparaît en grand quand il vient d'être bâti.
  const compte = useRef(j.batiments.length)
  const [neuve, setNeuve] = useState<number | null>(null)
  useEffect(() => {
    const avant = compte.current
    compte.current = j.batiments.length
    if (j.batiments.length <= avant) return
    setNeuve(j.batiments.length - 1)
    const image = requestAnimationFrame(() => {
      const r = document.querySelector('.case-neuve')?.getBoundingClientRect()
      if (r !== undefined) eclater(r.left + r.width / 2, r.top + r.height / 2, 14)
    })
    const t = window.setTimeout(() => setNeuve(null), 900)
    return () => {
      cancelAnimationFrame(image)
      window.clearTimeout(t)
    }
  }, [j.batiments.length])

  return (
    <div className={`page${rienBati ? ' page-debut' : ''}`}>
      {/* LA TAPE : le premier geste du jeu, et il reste possible. Elle agit au doigt posé, pas au relâchement. */}
      <button
        type="button"
        className={`tape${rienBati ? ' tape-grande' : ''}`}
        onPointerDown={(e) => {
          if (e.button === 0) taper(e.clientX, e.clientY, e.currentTarget)
        }}
        onClick={(e) => {
          // Le clavier n'a pas de doigt : il arrive par `click` seul (detail 0), au centre du bouton.
          if (e.detail === 0) {
            const r = e.currentTarget.getBoundingClientRect()
            taper(r.left + r.width / 2, r.top + r.height / 2, e.currentTarget)
          }
        }}
      >
        Soigner un passant
        <small>+1 or</small>
      </button>
      <Tuto partie={partie} agir={agir} />
      {rienBati && atteint(partie, 'argiliere') && (
        <div className="grille">
          <button type="button" className="case case-vide" onClick={() => setOuvert('construire')}>
            <span className="case-plus">+</span>
            <span className="case-nom">Bâtir</span>
          </button>
        </div>
      )}
      {!rienBati && (
        <>
          <h1>Laboratoire</h1>
          {j.batiments.length >= 4 && (
            <p className="sourd">
              {occupes(j)} / {places} emplacements
              {atteint(partie, 'entrepot') && <> · entrepôt {nombre(capacite(j))} par ressource</>}
              {atteint(partie, 'maitrise') && <> · {ELEMENTS.map((e) => `${NOM_ELEMENT[e]} ${j.points[e]}`).join(' · ')}</>}
            </p>
          )}
          <div className="grille">
            {j.batiments.map((b, i) => {
              const f = BATIMENTS[b.nom]
              const manque = entreeManquante(m, j, b)
              const pleine = sortiePleine(j, b)
              const sabote = m.t < b.arretJusqua
              return (
                <button key={i} type="button" className={`case${manque !== null || pleine !== null || sabote ? ' case-arret' : ''}${i === neuve ? ' case-neuve' : ''}`} onClick={() => setOuvert(b)}>
                  <IconeBatiment nom={b.nom} />
                  <span className="case-nom">{NOM_BATIMENT[b.nom]}</span>
                  {atteint(partie, 'ameliorer') && <span className="case-niveau">niv. {b.niveau}</span>}
                  <span className="case-etat">
                    {sabote
                      ? `saboté ${duree(b.arretJusqua - m.t)}`
                      : manque !== null
                        ? `manque ${NOM_RESSOURCE[manque]}`
                        : pleine !== null
                          ? 'entrepôt plein'
                          : f.type === 'chef'
                          ? `cycle ${Math.round(b.progres * 100)} %`
                          : f.produit !== undefined
                            ? Object.entries(f.produit)
                                .map(([r, q]) => `+${nombreFin((q ?? 0) * multiplicateur(j, b))} ${NOM_RESSOURCE[r as Ressource]}/h`)
                                .join(', ')
                            : 'veille'}
                  </span>
                </button>
              )
            })}
            {j.four && (
              <button type="button" className="case case-four" onClick={() => setOuvert('four')}>
                <IconeBatiment nom="four" />
                <span className="case-nom">Four philosophal</span>
                <span className="case-niveau">{j.cuisson !== null ? `cuit ${duree(j.cuisson.fin - m.t)}` : j.couleur === 0 ? 'froid' : NOM_COULEUR[j.couleur - 1]}</span>
              </button>
            )}
            {libres > 0 && (
              <button type="button" className="case case-vide" onClick={() => setOuvert('construire')}>
                <span className="case-plus">+</span>
                <span className="case-nom">Bâtir</span>
              </button>
            )}
          </div>
          {libres === 0 && (
            <button type="button" className="bouton-principal" onClick={() => setOuvert('construire')}>
              {atteint(partie, 'extension') ? 'Agrandir ou améliorer' : 'Plus de place'}
            </button>
          )}
          <Reserves partie={partie} agir={agir} />
        </>
      )}
      {ouvert === 'construire' && <Construire partie={partie} agir={agir} onFermer={() => setOuvert(null)} />}
      {ouvert === 'four' && (
        <Feuille titre="Four philosophal" onFermer={() => setOuvert(null)}>
          <p>Les cuissons se lancent depuis la page Œuvre. Il prend un emplacement et ne se démolit pas.</p>
        </Feuille>
      )}
      {ouvert !== null && ouvert !== 'construire' && ouvert !== 'four' && (
        <DetailBatiment partie={partie} agir={agir} b={ouvert} onFermer={() => setOuvert(null)} />
      )}
    </div>
  )
}

/** CE QU'ON A : les ressources tenues, leur rythme, et « Vendre » dès qu'on sait vendre. */
function Reserves({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const net = bilanHoraire(j)
  const cap = capacite(j)
  const tenues = TOUTES.filter((r) => j.stock[r] >= 1 || Math.abs(net[r]) > 1e-9)
  if (tenues.length === 0) return <></>
  return (
    <section>
      <h2>Réserves</h2>
      {tenues.map((r) => {
        const stock = Math.floor(j.stock[r])
        const plein = j.stock[r] >= cap - 1e-9
        return (
          <div key={r} className="ligne">
            <span className="ligne-nom">
              <PastilleRessource r={r} /> {NOM_RESSOURCE[r]}
            </span>
            <span className={`ligne-net ${plein ? 'manque' : net[r] < -1e-9 ? 'manque' : net[r] > 1e-9 ? 'gain' : 'sourd'}`}>
              {plein ? 'plein' : Math.abs(net[r]) > 1e-9 ? `${net[r] > 0 ? '+' : ''}${nombreFin(net[r])}/h` : ''}
            </span>
            <span className={`ligne-stock${plein ? ' manque' : ''}`} title={plein ? 'Entrepôt plein' : undefined}>
              <Compteur valeur={stock} />
            </span>
            {atteint(partie, 'vendre') && (
              <button
                type="button"
                className="bouton-vendre"
                disabled={stock < 1}
                onClick={(e) => {
                  const gain = estimerVente(m, r, stock)
                  effetVente(e.currentTarget.getBoundingClientRect(), gain)
                  vibrer(12)
                  agir(() => vendre(m, j, r, stock))
                }}
              >
                Vendre → {nombre(estimerVente(m, r, stock))} or
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}

function DetailBatiment({ partie, agir, b, onFermer }: PageProps & { b: Batiment; onFermer: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [confirme, setConfirme] = useState(false)
  if (!j.batiments.includes(b)) return <></>
  const f = BATIMENTS[b.nom]
  const mult = multiplicateur(j, b)
  const parH = f.type === 'chef' ? 1 / (f.cycleH ?? 4) : 1
  const amelioration = b.niveau < 3 && atteint(partie, 'ameliorer') ? coutAmelioration(j, b) : null
  return (
    <Feuille titre={atteint(partie, 'ameliorer') ? `${NOM_BATIMENT[b.nom]} · niveau ${b.niveau}` : NOM_BATIMENT[b.nom]} onFermer={onFermer}>
      {f.element !== undefined && atteint(partie, 'maitrise') && (
        <p className="sourd petit">
          {NOM_ELEMENT[f.element]} · vous êtes {rang(j, f.element)} ({j.points[f.element]} points), rendement ×{nombreFin(mult)}
        </p>
      )}
      {f.consomme !== undefined && (
        <p>
          Consomme <Quantite q={fois(f.consomme, mult * parH)} /> par heure
        </p>
      )}
      {f.produit !== undefined && (
        <p>
          Produit <Quantite q={fois(f.produit, mult * parH)} /> par heure{f.type === 'chef' ? ` (un cycle dure ${duree((f.cycleH ?? 4) / mult)})` : ''}
        </p>
      )}
      {EFFET_BATIMENT[b.nom] !== undefined && <p>{EFFET_BATIMENT[b.nom]}</p>}
      {amelioration !== null && (
        <div className="ligne">
          <span>
            Niveau {b.niveau + 1} (×{(LABO.niveaux as readonly number[])[b.niveau] ?? 2}) : <Cout or={amelioration.or} cout={amelioration.cout} j={j} />
          </span>
          <button
            type="button"
            className="bouton-principal"
            disabled={!peutPayer(j, amelioration.or, amelioration.cout)}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              effetDepense(r, amelioration.or)
              eclater(r.left + r.width / 2, r.top + r.height / 2, 10)
              sonBatir()
              vibrer([20, 30, 40])
              agir(() => {
                ameliorer(m, j, b)
              })
            }}
          >
            Améliorer
          </button>
        </div>
      )}
      <div className="ligne">
        <span className="sourd petit">Démolir rend l'emplacement, pas les matériaux.</span>
        {confirme ? (
          <button
            type="button"
            className="bouton-danger"
            onClick={() =>
              agir(() => {
                demolir(j, b)
                onFermer()
              })
            }
          >
            Oui, démolir
          </button>
        ) : (
          <button type="button" onClick={() => setConfirme(true)}>
            Démolir
          </button>
        )}
      </div>
    </Feuille>
  )
}

function Construire({ partie, agir, onFermer }: PageProps & { onFermer: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const ligne = (nom: NomBatiment): ReactElement => {
    const f = BATIMENTS[nom]
    const { or, cout } = coutConstruction(j, nom)
    const possible = peutConstruire(j, nom)
    const payable = peutPayer(j, or, cout)
    const pourquoi = !possible
      ? f.reserveMaitre
        ? `réservé aux maîtres du ${NOM_ELEMENT[f.element!]}`
        : f.unique && j.four
          ? 'déjà bâti'
          : nom === 'extension'
            ? 'le laboratoire est à sa taille maximale'
            : 'plus d’emplacement libre'
      : null
    return (
      <div key={nom} className={`ligne ligne-batir${!possible ? ' sourd' : ''}`}>
        <IconeBatiment nom={nom} taille={24} />
        <span className="ligne-batir-texte">
          <b>{NOM_BATIMENT[nom]}</b>
          <span className="petit">
            {f.consomme !== undefined && (
              <>
                <Quantite q={f.consomme} /> →{' '}
              </>
            )}
            {f.produit !== undefined && <Quantite q={f.produit} />}
            {f.type === 'chef' && ` par cycle de ${f.cycleH} h`}
            {f.type === 'transformation' || f.type === 'extraction' ? ' par heure' : ''}
            {EFFET_BATIMENT[nom]}
          </span>
          <span className="petit">{pourquoi ?? <Cout or={or} cout={cout} j={j} />}</span>
        </span>
        <button
          type="button"
          disabled={!possible || !payable}
          onClick={() => {
            // On bâtit, la feuille se ferme, et le bâtiment neuf apparaît dans la grille.
            effetDebit(or)
            sonBatir()
            vibrer([20, 30, 40])
            agir(() => {
              construire(m, j, nom)
            })
            onFermer()
          }}
        >
          Bâtir
        </button>
      </div>
    )
  }
  const familles = FAMILLES.map((fam) => ({ ...fam, noms: fam.noms.filter((nom) => batimentOuvert(partie, nom)) })).filter((fam) => fam.noms.length > 0)
  return (
    <Feuille titre="Bâtir" onFermer={onFermer}>
      {familles.map((fam) => (
        <section key={fam.titre}>
          {familles.length > 1 && <h3>{fam.titre}</h3>}
          {fam.noms.map(ligne)}
        </section>
      ))}
    </Feuille>
  )
}
