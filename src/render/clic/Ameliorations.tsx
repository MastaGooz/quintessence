/**
 * LES AMÉLIORATIONS DE LA MINE à l'écran (Keko, 02/11 : « X or pour obtenir
 * une amélioration au choix ») : ce que chacune fait, du niveau qu'on a au
 * suivant, LE CHOIX qu'ouvre une quête — trois cartes tirées, on en prend
 * une —, et LE MENU de ce qui s'achète.
 */
import type { ReactElement, ReactNode } from 'react'
import { EFFETS_MINE, EFFETS_PRODUCTEUR, RESSOURCES, type IdAmelioration, type IdAmeliorationProducteur } from '../../logic/clic/donnees.ts'
import {
  avanceTape, avanceTapeProducteur, bilanMine, capaciteReserve, chanceCoupDouble, chancePepite, estMine, gainNiveauMine, gainNiveauProducteur, lotProducteur, niveauAP, partTropPlein,
  partTropPleinProducteur, peutPayerPrix, prixNiveauMine, prixNiveauProducteur, ressourceDe, stockRessource, valeurPepite, vitesseAutoProducteur, type Joueur, type Prix, type Producteur,
} from '../../logic/clic/moteur.ts'
import { NOM_AMELIORATION, NOM_AMELIORATION_PRODUCTEUR, nomProducteur } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'
import { abregeFin, pourcent } from './texte.ts'

/** Le joueur tel qu'il serait avec un niveau de plus dans cette amélioration. */
function avecUnNiveau(j: Joueur, id: IdAmelioration): Joueur {
  return { ...j, ameliorations: { ...j.ameliorations, [id]: j.ameliorations[id] + 1 } }
}

/** « avant → après », l'après en vert. */
function Fleche({ avant, apres }: { avant: ReactNode; apres: ReactNode }): ReactElement {
  return (
    <>
      {avant} → <b className="gain">{apres}</b>
    </>
  )
}

/** Ce que fait un niveau de plus de cette amélioration, en une ligne : la valeur d'aujourd'hui, celle d'après. */
export function effetAmelioration(j: Joueur, id: IdAmelioration): ReactNode {
  const mine = j.producteurs.find(estMine)
  if (mine === undefined) return null
  const j2 = avecUnNiveau(j, id)
  const b1 = bilanMine(j, mine)
  const b2 = bilanMine(j2, mine)
  const n2 = j2.ameliorations[id]
  switch (id) {
    case 'pioche':
    case 'puissance':
      return (
        <>
          Une tape remplit <Fleche avant={pourcent(avanceTape(j))} apres={pourcent(avanceTape(j2))} /> de la barre
        </>
      )
    case 'critique':
      return (
        <>
          Critique : <Fleche avant={pourcent(b1.chanceCritique)} apres={pourcent(b2.chanceCritique)} /> de chance, la tape ×{b2.multCritique}
        </>
      )
    case 'forceCritique':
      return (
        <>
          Critique : <Fleche avant={`×${b1.multCritique}`} apres={`×${b2.multCritique}`} />
        </>
      )
    case 'elan':
      return (
        <>
          Chaque tape d’une série : +{pourcent(EFFETS_MINE.elanPas * n2)}, jusqu’à <b className="gain">+{pourcent(EFFETS_MINE.elanPlafond * n2)}</b>
        </>
      )
    case 'pepite':
      return (
        <>
          Une pépite à <Fleche avant={pourcent(chancePepite(j))} apres={pourcent(chancePepite(j2))} /> par tape ; tapez-la vite : {abregeFin(valeurPepite(j))} <SymbolePiece />
        </>
      )
    case 'auto':
      return (
        <>
          L’automatique : <Fleche avant={abregeFin(b1.debit * 3600)} apres={abregeFin(b2.debit * 3600)} /> <SymbolePiece /> par heure
        </>
      )
    case 'reserve':
      return (
        <>
          Réserve : <Fleche avant={capaciteReserve(j, mine)} apres={capaciteReserve(j2, mine)} /> <SymbolePiece />
        </>
      )
    case 'prime':
      return (
        <>
          Réserve pleine récoltée : <Fleche avant={`+${pourcent(EFFETS_MINE.prime * j.ameliorations.prime)}`} apres={`+${pourcent(EFFETS_MINE.prime * n2)}`} />
        </>
      )
    case 'tropPlein':
      return (
        <>
          Réserve pleine : <Fleche avant={pourcent(partTropPlein(j))} apres={pourcent(partTropPlein(j2))} /> de l’or coule quand même
        </>
      )
  }
}

/** Ce que fait un niveau de plus d'une amélioration d'un producteur construit (Keko, 02/11), en une ligne : la valeur d'aujourd'hui, celle d'après. */
export function effetAmeliorationProducteur(j: Joueur, p: Producteur, id: IdAmeliorationProducteur): ReactNode {
  const p2: Producteur = { ...p, ameliorations: { ...p.ameliorations, [id]: niveauAP(p, id) + 1 } }
  const n2 = niveauAP(p2, id)
  const s = <SymboleRessource ressource={ressourceDe(p)} />
  const parHeure = (q: Producteur): string => abregeFin(vitesseAutoProducteur(q) * lotProducteur(q) * 3600)
  switch (id) {
    case 'outils':
      return (
        <>
          Une tape remplit <Fleche avant={pourcent(avanceTapeProducteur(p))} apres={pourcent(avanceTapeProducteur(p2))} /> de la barre
        </>
      )
    case 'rendement':
      return (
        <>
          Une barre pleine donne <Fleche avant={lotProducteur(p)} apres={lotProducteur(p2)} /> {s}
        </>
      )
    case 'cadence':
      return (
        <>
          L’automatique : <Fleche avant={parHeure(p)} apres={parHeure(p2)} /> {s} par heure
        </>
      )
    case 'entrepot':
      return (
        <>
          Réserve : <Fleche avant={capaciteReserve(j, p)} apres={capaciteReserve(j, p2)} /> {s}
        </>
      )
    case 'coupDouble':
      return (
        <>
          Une tape compte double : <Fleche avant={pourcent(chanceCoupDouble(p))} apres={pourcent(chanceCoupDouble(p2))} /> de chance
        </>
      )
    case 'prime':
      return (
        <>
          Réserve pleine récoltée : <Fleche avant={`+${pourcent(EFFETS_PRODUCTEUR.prime * niveauAP(p, 'prime'))}`} apres={`+${pourcent(EFFETS_PRODUCTEUR.prime * n2)}`} />
        </>
      )
    case 'tropPlein':
      return (
        <>
          Réserve pleine : <Fleche avant={pourcent(partTropPleinProducteur(p))} apres={pourcent(partTropPleinProducteur(p2))} /> de la production arrive quand même
        </>
      )
    case 'elan':
      return (
        <>
          Chaque tape d’une série : +{pourcent(EFFETS_PRODUCTEUR.elanPas * n2)}, jusqu’à <b className="gain">+{pourcent(EFFETS_PRODUCTEUR.elanPlafond * n2)}</b>
        </>
      )
  }
}

/** Un prix en or et en ressources : chaque part non nulle, son nombre et son symbole ; celle que le joueur n'a pas, rougeâtre (Keko, 02/11). */
export function PrixVu({ j, prix }: { j: Joueur; prix: Prix }): ReactElement {
  const classe = (manque: boolean): string => (manque ? 'prix-manque' : '')
  return (
    <span className="prix-vu">
      {prix.or > 0 && (
        <span className={classe(j.or + 1e-9 < prix.or)}>
          {prix.or} <SymbolePiece />
        </span>
      )}
      {RESSOURCES.map(
        (r) =>
          prix[r] > 0 && (
            <span key={r} className={classe(stockRessource(j, r) + 1e-9 < prix[r])}>
              {prix[r]} <SymboleRessource ressource={r} />
            </span>
          ),
      )}
    </span>
  )
}

/** Ce qui manque pour payer un prix, part par part ; rien quand il est payable. */
export function Manque({ j, prix }: { j: Joueur; prix: Prix }): ReactElement | null {
  const parts = [
    { cle: 'or', n: Math.ceil(prix.or - j.or - 1e-9), symbole: <SymbolePiece /> },
    ...RESSOURCES.map((r) => ({ cle: r, n: Math.ceil(prix[r] - stockRessource(j, r) - 1e-9), symbole: <SymboleRessource ressource={r} /> })),
  ].filter((x) => x.n > 0)
  if (parts.length === 0) return null
  return (
    <span className="amelioration-manque">
      Il manque{' '}
      {parts.map((x, k) => (
        <span key={x.cle}>
          {k > 0 ? ', ' : ''}
          {x.n} {x.symbole}
        </span>
      ))}
    </span>
  )
}

/**
 * LE MENU DES AMÉLIORATIONS d'un bâtiment — la banque, un producteur construit (Keko, 02/11 : « le bouton amélioration ouvre le menu ;
 * il permet d'augmenter de 1 le niveau », puis « un bouton level sur les producteurs, comme la banque ») : une carte, le niveau
 * suivant, son prix en face, ce qu'il donne — l'automatique d'abord, puis une amélioration au choix parmi trois ; une tape le prend.
 * Éteinte quand le prix manque ; quand une amélioration attend son choix, la carte y mène.
 */
export function MenuAmeliorations({ j, p, onMonter, onChoisir, onFermer }: { j: Joueur; p: Producteur; onMonter: () => void; onChoisir: () => void; onFermer: () => void }): ReactElement {
  const banque = estMine(p)
  const prix: Prix = banque ? { or: prixNiveauMine(p), bois: 0, pierre: 0 } : prixNiveauProducteur(p)
  const payable = peutPayerPrix(j, prix)
  const offre = banque ? j.offre : (p.offre ?? null)
  const gain = banque ? gainNiveauMine(j) : gainNiveauProducteur(p)
  // Ce que l'automatique rapportera, une fois là.
  const parHeure = banque ? bilanMine({ ...j, automatisation: 1 }, p).debit * 3600 : vitesseAutoProducteur({ ...p, niveau: 2 }) * lotProducteur(p) * 3600
  const symbole = banque ? <SymbolePiece /> : <SymboleRessource ressource={ressourceDe(p)} />
  return (
    <Feuille titre={`${nomProducteur(p)} · niveau ${p.niveau}`} onFermer={onFermer}>
      <div className="choix-ameliorations">
        {offre !== null ? (
          <button type="button" className="amelioration-carte" style={{ animationDelay: '120ms' }} onClick={onChoisir}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">Une amélioration vous attend</b>
            </span>
            <span className="amelioration-effet">Choisissez-la avant de monter au niveau suivant.</span>
          </button>
        ) : (
          <button type="button" className="amelioration-carte" style={{ animationDelay: '120ms' }} disabled={!payable} onClick={onMonter}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">Niveau {p.niveau + 1}</b>
              <span className="amelioration-prix">
                <PrixVu j={j} prix={prix} />
              </span>
            </span>
            <span className="amelioration-effet">
              {gain === 'automatique' ? (
                <>
                  L’automatique : {banque ? 'la barre de la banque' : 'sa barre'} se remplit seule, même sans vous — <b className="gain">{abregeFin(parHeure)}</b> {symbole} par heure,{' '}
                  {banque ? 'dans la réserve' : 'dans sa réserve'}
                </>
              ) : (
                <>Une amélioration au choix, parmi trois</>
              )}
            </span>
            <Manque j={j} prix={prix} />
          </button>
        )}
      </div>
    </Feuille>
  )
}

/** LE CHOIX d'un niveau d'un bâtiment — son effet : les cartes de l'offre, qui arrivent l'une après l'autre ; une tape en prend une. */
export function ChoixAmelioration({ j, p, onChoisir, onFermer }: { j: Joueur; p: Producteur; onChoisir: (id: string, carte: HTMLElement) => void; onFermer: () => void }): ReactElement | null {
  const cartes = estMine(p)
    ? (j.offre ?? []).map((id: IdAmelioration) => ({ id: id as string, nom: NOM_AMELIORATION[id], niveau: j.ameliorations[id], effet: effetAmelioration(j, id) }))
    : (p.offre ?? []).map((id: IdAmeliorationProducteur) => ({ id: id as string, nom: NOM_AMELIORATION_PRODUCTEUR[id], niveau: niveauAP(p, id), effet: effetAmeliorationProducteur(j, p, id) }))
  if (cartes.length === 0) return null
  return (
    <Feuille titre={`${nomProducteur(p)}, niveau ${p.niveau} : une amélioration au choix`} onFermer={onFermer}>
      <div className="choix-ameliorations">
        {cartes.map((c, k) => (
          <button key={c.id} type="button" className="amelioration-carte" style={{ animationDelay: `${120 + k * 110}ms` }} onClick={(e) => onChoisir(c.id, e.currentTarget)}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">{c.nom}</b>
              <span className="amelioration-niveau">{c.niveau === 0 ? 'nouveau' : `niveau ${c.niveau + 1}`}</span>
            </span>
            <span className="amelioration-effet">{c.effet}</span>
          </button>
        ))}
      </div>
    </Feuille>
  )
}
