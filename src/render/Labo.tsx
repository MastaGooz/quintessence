/**
 * LE LABORATOIRE : la grille des emplacements. Une tape sur un bâtiment
 * l'ouvre (améliorer, démolir), une tape sur une place vide ouvre la liste de
 * ce qu'on peut bâtir, avec ce qui manque en rouge.
 */
import { useState, type ReactElement } from 'react'
import { BATIMENTS, COULEURS, ELEMENTS, LABO, type NomBatiment, type Quantites } from '../logic/donnees.ts'
import {
  ameliorer, capacite, construire, coutAmelioration, coutConstruction, demolir, emplacements, entreeManquante, multiplicateur,
  occupes, peutConstruire, peutPayer, rang, type Batiment,
} from '../logic/moteur.ts'
import { joueur, PAS } from '../logic/partie.ts'
import { EFFET_BATIMENT, NOM_BATIMENT, NOM_COULEUR, NOM_ELEMENT, NOM_RESSOURCE } from '../ui/noms.ts'
import { duree, nombre, nombreFin } from '../ui/format.ts'
import { Cout, Quantites as Quantite } from './Cout.tsx'
import { Feuille } from './Feuille.tsx'
import { IconeBatiment } from './Icone.tsx'
import type { PageProps } from './props.ts'

const FAMILLES: { titre: string; noms: NomBatiment[] }[] = [
  { titre: 'Extraction', noms: ['mineCharbon', 'soufriere', 'mineFer', 'argiliere', 'jardin', 'saline', 'sabliere', 'geode'] },
  { titre: 'Transformation', noms: ['fourneau', 'forge', 'alambic', 'verrerie'] },
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
  return (
    <div className="page">
      <h1>Laboratoire</h1>
      <p className="sourd">
        {occupes(j)} / {places} emplacements · entrepôt {nombre(capacite(j))} par ressource ·{' '}
        {ELEMENTS.map((e) => `${NOM_ELEMENT[e]} ${j.points[e]}`).join(' · ')}
      </p>
      <div className="grille">
        {j.batiments.map((b, i) => {
          const f = BATIMENTS[b.nom]
          const manque = entreeManquante(m, j, b, PAS)
          const sabote = m.t < b.arretJusqua
          return (
            <button key={i} type="button" className={`case${manque !== null || sabote ? ' case-arret' : ''}`} onClick={() => setOuvert(b)}>
              <IconeBatiment nom={b.nom} />
              <span className="case-nom">{NOM_BATIMENT[b.nom]}</span>
              <span className="case-niveau">niv. {b.niveau}</span>
              <span className="case-etat">
                {sabote ? `saboté ${duree(b.arretJusqua - m.t)}` : manque !== null ? `manque ${NOM_RESSOURCE[manque]}` : f.type === 'chef' ? `cycle ${Math.round(b.progres * 100)} %` : f.produit !== undefined ? 'tourne' : 'veille'}
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
        {Array.from({ length: Math.max(0, libres) }, (_, i) => (
          <button key={`libre-${i}`} type="button" className="case case-vide" onClick={() => setOuvert('construire')}>
            <span className="case-plus">+</span>
            <span className="case-nom">Bâtir</span>
          </button>
        ))}
      </div>
      {libres === 0 && (
        <button type="button" className="bouton-principal" onClick={() => setOuvert('construire')}>
          Agrandir ou améliorer
        </button>
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

function DetailBatiment({ partie, agir, b, onFermer }: PageProps & { b: Batiment; onFermer: () => void }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const [confirme, setConfirme] = useState(false)
  if (!j.batiments.includes(b)) return <></>
  const f = BATIMENTS[b.nom]
  const mult = multiplicateur(j, b)
  const parH = f.type === 'chef' ? 1 / (f.cycleH ?? 4) : 1
  const amelioration = b.niveau < 3 ? coutAmelioration(j, b) : null
  return (
    <Feuille titre={`${NOM_BATIMENT[b.nom]} · niveau ${b.niveau}`} onFermer={onFermer}>
      {f.element !== undefined && (
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
  const utilitaires: NomBatiment[] = ['extension', 'entrepot']
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
          <span className="petit">
            {pourquoi ?? <Cout or={or} cout={cout} j={j} />}
          </span>
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
      <section>
        <h3>Agrandir</h3>
        {utilitaires.map(ligne)}
      </section>
      {FAMILLES.map((fam) => (
        <section key={fam.titre}>
          <h3>{fam.titre}</h3>
          {fam.noms.map(ligne)}
        </section>
      ))}
      <p className="sourd petit">
        Les couleurs du Grand Œuvre : {COULEURS.map((c) => `${c.nom} (${c.parElement} de chaque, ${c.dureeH} h)`).join(', ')}.
      </p>
    </Feuille>
  )
}
