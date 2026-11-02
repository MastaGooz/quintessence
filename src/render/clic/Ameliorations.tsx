/**
 * LES AMÉLIORATIONS DE LA MINE à l'écran (Keko, 02/11 : « X or pour obtenir
 * une amélioration au choix ») : ce que chacune fait, du niveau qu'on a au
 * suivant, LE CHOIX qu'ouvre une quête — trois cartes tirées, on en prend
 * une —, et LE MENU de ce qui s'achète.
 */
import type { ReactElement, ReactNode } from 'react'
import { EFFETS_MINE, PRIX_AUTOMATIQUE, type IdAmelioration } from '../../logic/clic/donnees.ts'
import { automatiqueEnVente, avanceTape, bilanMine, capaciteReserve, chancePepite, estMine, partTropPlein, valeurPepite, type Joueur } from '../../logic/clic/moteur.ts'
import { NOM_AMELIORATION } from '../../ui/noms-clic.ts'
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
 * LE MENU DES AMÉLIORATIONS (Keko, 02/11 : « un bouton générique d'upgrade en haut à droite, qui ouvre le menu upgrade qu'on a déjà ;
 * on l'utilisera ensuite à la place des quêtes ») : ce qui s'achète, une carte chacun, comme celles du choix ; une tape achète. Pour
 * l'instant, l'automatique.
 */
export function MenuAmeliorations({ j, onAcheterAutomatique, onFermer }: { j: Joueur; onAcheterAutomatique: () => void; onFermer: () => void }): ReactElement {
  const mine = j.producteurs.find(estMine)
  const payable = j.or + 1e-9 >= PRIX_AUTOMATIQUE
  // Ce que l'automatique rapportera, une fois acheté.
  const parHeure = mine === undefined ? 0 : bilanMine({ ...j, automatisation: 1 }, mine).debit * 3600
  return (
    <Feuille titre="Améliorations" onFermer={onFermer}>
      <div className="choix-ameliorations">
        {automatiqueEnVente(j) ? (
          <button type="button" className="amelioration-carte" style={{ animationDelay: '120ms' }} disabled={!payable} onClick={onAcheterAutomatique}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">Automatique</b>
              <span className="amelioration-prix">
                {PRIX_AUTOMATIQUE} <SymbolePiece />
              </span>
            </span>
            <span className="amelioration-effet">
              La barre de la mine se remplit seule, même sans vous : <b className="gain">{abregeFin(parHeure)}</b> <SymbolePiece /> par heure, dans la réserve
            </span>
            {!payable && (
              <span className="amelioration-manque">
                Il manque {Math.ceil(PRIX_AUTOMATIQUE - j.or - 1e-9)} <SymbolePiece />
              </span>
            )}
          </button>
        ) : (
          <p className="sourd">Rien à acheter pour l’instant.</p>
        )}
      </div>
    </Feuille>
  )
}

/** LE CHOIX d'une quête : les cartes de l'offre, qui arrivent l'une après l'autre ; une tape en prend une. */
export function ChoixAmelioration({ j, onChoisir, onFermer }: { j: Joueur; onChoisir: (id: IdAmelioration, carte: HTMLElement) => void; onFermer: () => void }): ReactElement | null {
  if (j.offre === null) return null
  return (
    <Feuille titre="Une amélioration au choix" onFermer={onFermer}>
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
