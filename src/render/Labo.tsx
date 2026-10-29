/**
 * LE LABORATOIRE : d'abord un seul bouton (soigner un passant, +1 or), puis
 * l'argilière, puis la grille des emplacements. Une tape sur un bâtiment
 * l'ouvre (améliorer, démolir), une tape sur la place vide ouvre ce qu'on peut
 * bâtir — et cette liste grandit avec les étapes dévoilées.
 */
import { useState, type ReactElement } from 'react'
import { BATIMENTS, ELEMENTS, LABO, TOUTES, type NomBatiment, type Quantites, type Ressource } from '../logic/donnees.ts'
import {
  ameliorer, bilanHoraire, capacite, construire, coutAmelioration, coutConstruction, demolir, emplacements, entreeManquante,
  estimerVente, multiplicateur, occupes, peutConstruire, peutPayer, rang, tapoter, vendre, type Batiment,
} from '../logic/moteur.ts'
import { devoilee, joueur, PAS, type Etape } from '../logic/partie.ts'
import { AIDE } from '../ui/devoilement.ts'
import { EFFET_BATIMENT, NOM_BATIMENT, NOM_COULEUR, NOM_ELEMENT, NOM_RESSOURCE } from '../ui/noms.ts'
import { duree, nombre, nombreFin } from '../ui/format.ts'
import { Cout, Quantites as Quantite } from './Cout.tsx'
import { Feuille } from './Feuille.tsx'
import { IconeBatiment, PastilleRessource } from './Icone.tsx'
import type { PageProps } from './props.ts'

/** Les familles de la liste « Bâtir », chacune derrière son étape. */
const FAMILLES: { titre: string; noms: NomBatiment[]; etape: Etape | null; aide?: Etape }[] = [
  { titre: 'Agrandir', noms: ['extension', 'entrepot'], etape: 'agrandir', aide: 'agrandir' },
  { titre: 'Extraction', noms: ['argiliere', 'mineFer', 'mineCharbon', 'soufriere', 'jardin', 'saline', 'sabliere', 'geode'], etape: null, aide: 'elements' },
  { titre: 'Ateliers', noms: ['fourneau', 'forge', 'alambic', 'verrerie'], etape: 'transformation', aide: 'transformation' },
  { titre: 'Ateliers avancés', noms: ['autel', 'creuset', 'cornue', 'atelierRunes'], etape: 'avance', aide: 'avance' },
  { titre: 'Chefs-d’œuvre (maîtres seulement)', noms: ['athanor', 'grandCreuset', 'fontaine', 'observatoire'], etape: 'oeuvre' },
  { titre: 'Grand Œuvre', noms: ['four'], etape: 'oeuvre', aide: 'oeuvre' },
  { titre: 'Coups bas', noms: ['repaire', 'officine', 'cabinet', 'tour'], etape: 'coupsBas', aide: 'coupsBas' },
  { titre: 'Défense', noms: ['gardien', 'cercle'], etape: 'coupsBas' },
]

function fois(q: Quantites | undefined, k: number): Quantites {
  const r: Quantites = {}
  for (const [n, v] of Object.entries(q ?? {})) r[n as keyof Quantites] = Math.round((v ?? 0) * k * 10) / 10
  return r
}

export function Labo({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const a = (e: Etape): boolean => devoilee(partie, e)
  const [ouvert, setOuvert] = useState<Batiment | 'construire' | 'four' | null>(null)
  const places = emplacements(j)
  const libres = places - occupes(j)
  const rienBati = j.batiments.length === 0 && !j.four
  const argiliere = coutConstruction(j, 'argiliere')
  return (
    <div className={`page${rienBati ? ' page-debut' : ''}`}>
      {/* LA TAPE : le premier geste du jeu, et il reste possible. */}
      <button type="button" className={`tape${rienBati ? ' tape-grande' : ''}`} onClick={() => agir(() => tapoter(j))}>
        Soigner un passant
        <small>+1 or</small>
      </button>
      {rienBati && !a('batir') && <p className="sourd centre">Un apprenti alchimiste gagne sa première pièce comme il peut.</p>}
      {rienBati && a('batir') && (
        <section className="carte-aide">
          <p>{AIDE.batir}</p>
          <div className="ligne">
            <span className="ligne-nom">
              <IconeBatiment nom="argiliere" taille={24} />
              <span>
                <b>Argilière</b> · 15 argile par heure
                <br />
                <Cout or={argiliere.or} cout={argiliere.cout} j={j} />
              </span>
            </span>
            <button
              type="button"
              className="bouton-principal"
              disabled={!peutPayer(j, argiliere.or, argiliere.cout)}
              onClick={() =>
                agir(() => {
                  construire(m, j, 'argiliere')
                })
              }
            >
              Bâtir
            </button>
          </div>
        </section>
      )}
      {!rienBati && (
        <>
          <h1>Laboratoire</h1>
          {j.batiments.length >= 4 && (
            <p className="sourd">
              {occupes(j)} / {places} emplacements
              {a('entrepot') && <> · entrepôt {nombre(capacite(j))} par ressource</>}
              {a('maitrise') && <> · {ELEMENTS.map((e) => `${NOM_ELEMENT[e]} ${j.points[e]}`).join(' · ')}</>}
            </p>
          )}
          <div className="grille">
            {j.batiments.map((b, i) => {
              const f = BATIMENTS[b.nom]
              const manque = entreeManquante(m, j, b, PAS)
              const sabote = m.t < b.arretJusqua
              return (
                <button key={i} type="button" className={`case${manque !== null || sabote ? ' case-arret' : ''}`} onClick={() => setOuvert(b)}>
                  <IconeBatiment nom={b.nom} />
                  <span className="case-nom">{NOM_BATIMENT[b.nom]}</span>
                  {a('ameliorer') && <span className="case-niveau">niv. {b.niveau}</span>}
                  <span className="case-etat">
                    {sabote
                      ? `saboté ${duree(b.arretJusqua - m.t)}`
                      : manque !== null
                        ? `manque ${NOM_RESSOURCE[manque]}`
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
              {a('agrandir') ? 'Agrandir ou améliorer' : 'Plus de place'}
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
      {devoilee(partie, 'vendre') && !devoilee(partie, 'comptoir') && <p className="sourd petit">{AIDE.vendre}</p>}
      {tenues.map((r) => {
        const stock = Math.floor(j.stock[r])
        const plein = j.stock[r] >= cap - 1e-9
        return (
          <div key={r} className="ligne">
            <span className="ligne-nom">
              <PastilleRessource r={r} /> {NOM_RESSOURCE[r]}
            </span>
            <span className={`ligne-net ${net[r] < -1e-9 ? 'manque' : net[r] > 1e-9 ? 'gain' : 'sourd'}`}>
              {Math.abs(net[r]) > 1e-9 ? `${net[r] > 0 ? '+' : ''}${nombreFin(net[r])}/h` : ''}
            </span>
            <span className={`ligne-stock${plein ? ' manque' : ''}`}>{nombre(stock)}</span>
            {devoilee(partie, 'vendre') && (
              <button type="button" className="bouton-vendre" disabled={stock < 1} onClick={() => agir(() => vendre(m, j, r, stock))}>
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
  const amelioration = b.niveau < 3 && devoilee(partie, 'ameliorer') ? coutAmelioration(j, b) : null
  return (
    <Feuille titre={devoilee(partie, 'ameliorer') ? `${NOM_BATIMENT[b.nom]} · niveau ${b.niveau}` : NOM_BATIMENT[b.nom]} onFermer={onFermer}>
      {f.element !== undefined && devoilee(partie, 'maitrise') && (
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
            onClick={() =>
              agir(() => {
                ameliorer(m, j, b)
              })
            }
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
  const a = (e: Etape | null): boolean => e === null || devoilee(partie, e)
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
          onClick={() =>
            agir(() => {
              construire(m, j, nom)
            })
          }
        >
          Bâtir
        </button>
      </div>
    )
  }
  return (
    <Feuille titre="Bâtir" onFermer={onFermer}>
      {FAMILLES.filter((fam) => a(fam.etape)).map((fam) => (
        <section key={fam.titre}>
          <h3>{fam.titre}</h3>
          {fam.aide !== undefined && <p className="sourd petit">{AIDE[fam.aide]}</p>}
          {(fam.titre === 'Extraction' && !a('elements') ? fam.noms.slice(0, 1) : fam.noms).map(ligne)}
        </section>
      ))}
    </Feuille>
  )
}
