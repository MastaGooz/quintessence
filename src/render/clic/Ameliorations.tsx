/**
 * LES AMÉLIORATIONS DE LA MINE à l'écran (Keko, 02/11 : « X or pour obtenir
 * une amélioration au choix ») : ce que chacune fait, du niveau qu'on a au
 * suivant, LE CHOIX qu'ouvre une quête — trois cartes tirées, on en prend
 * une —, et LE MENU de ce qui s'achète.
 */
import type { ReactElement, ReactNode } from 'react'
import { EFFETS_MINE, type IdAmelioration } from '../../logic/clic/donnees.ts'
import { avanceTape, bilanMine, capaciteReserve, chancePepite, estMine, gainNiveauMine, partTropPlein, prixNiveauMine, valeurPepite, type Joueur } from '../../logic/clic/moteur.ts'
import { NOM_AMELIORATION, NOM_MINE } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece } from './Glyphe.tsx'
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

/**
 * LE MENU DES AMÉLIORATIONS de la mine (Keko, 02/11 : « le bouton amélioration ouvre le menu ; il permet d'augmenter de 1 le niveau
 * de la mine ») : une carte, le niveau suivant, son prix en face, ce qu'il donne — l'automatique d'abord, puis une amélioration au
 * choix parmi trois ; une tape le prend. Éteinte quand l'or manque ; quand une amélioration attend son choix, la carte y mène.
 */
export function MenuAmeliorations({ j, onMonter, onChoisir, onFermer }: { j: Joueur; onMonter: () => void; onChoisir: () => void; onFermer: () => void }): ReactElement | null {
  const mine = j.producteurs.find(estMine)
  if (mine === undefined) return null
  const prix = prixNiveauMine(mine)
  const payable = j.or + 1e-9 >= prix
  // Ce que l'automatique rapportera, une fois là.
  const parHeure = bilanMine({ ...j, automatisation: 1 }, mine).debit * 3600
  return (
    <Feuille titre={`${NOM_MINE} · niveau ${mine.niveau}`} onFermer={onFermer}>
      <div className="choix-ameliorations">
        {j.offre !== null ? (
          <button type="button" className="amelioration-carte" style={{ animationDelay: '120ms' }} onClick={onChoisir}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">Une amélioration vous attend</b>
            </span>
            <span className="amelioration-effet">Choisissez-la avant de monter au niveau suivant.</span>
          </button>
        ) : (
          <button type="button" className="amelioration-carte" style={{ animationDelay: '120ms' }} disabled={!payable} onClick={onMonter}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">Niveau {mine.niveau + 1}</b>
              <span className="amelioration-prix">
                {prix} <SymbolePiece />
              </span>
            </span>
            <span className="amelioration-effet">
              {gainNiveauMine(j) === 'automatique' ? (
                <>
                  L’automatique : la barre de la banque se remplit seule, même sans vous — <b className="gain">{abregeFin(parHeure)}</b> <SymbolePiece /> par heure, dans la réserve
                </>
              ) : (
                <>Une amélioration au choix, parmi trois</>
              )}
            </span>
            {!payable && (
              <span className="amelioration-manque">
                Il manque {Math.ceil(prix - j.or - 1e-9)} <SymbolePiece />
              </span>
            )}
          </button>
        )}
      </div>
    </Feuille>
  )
}

/** LE CHOIX d'un niveau de la mine — son effet : les cartes de l'offre, qui arrivent l'une après l'autre ; une tape en prend une. */
export function ChoixAmelioration({ j, onChoisir, onFermer }: { j: Joueur; onChoisir: (id: IdAmelioration, carte: HTMLElement) => void; onFermer: () => void }): ReactElement | null {
  if (j.offre === null) return null
  const niveau = j.producteurs.find(estMine)?.niveau ?? 1
  return (
    <Feuille titre={`Niveau ${niveau} : une amélioration au choix`} onFermer={onFermer}>
      <div className="choix-ameliorations">
        {j.offre.map((id, k) => (
          <button key={id} type="button" className="amelioration-carte" style={{ animationDelay: `${120 + k * 110}ms` }} onClick={(e) => onChoisir(id, e.currentTarget)}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">{NOM_AMELIORATION[id]}</b>
              <span className="amelioration-niveau">{j.ameliorations[id] === 0 ? 'nouveau' : `niveau ${j.ameliorations[id] + 1}`}</span>
            </span>
            <span className="amelioration-effet">{effetAmelioration(j, id)}</span>
          </button>
        ))}
      </div>
    </Feuille>
  )
}
