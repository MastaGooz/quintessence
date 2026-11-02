/**
 * UNE FEUILLE qui monte du bas, au doigt : une tape sur le voile la ferme.
 * `data-hud` : posée sur la carte, elle n'est pas la carte — sinon le
 * contrôleur capturait le pointeur sous elle et, à la souris, le clic
 * n'atteignait plus ses boutons (Keko, sur PC : « je peux ni acheter ni
 * fermer la boutique »).
 *
 * LE VOILE NE FERME QUE CE QUI A COMMENCÉ SUR LUI : une feuille ouverte par
 * une tape sur la carte (le bouton des améliorations de la mine) naît au
 * lâcher du doigt, et le clic que le navigateur fabrique ensuite pour cette
 * même tape tombait sur le voile tout neuf — la feuille se refermait aussitôt,
 * au doigt seulement (Keko, 02/11 : « le bouton amélioration doit ouvrir le
 * menu quand on clique dessus »).
 */
import { useRef, type ReactNode } from 'react'

export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }): React.ReactElement {
  const appuiSurLeVoile = useRef(false)
  return (
    <div
      className="voile"
      data-hud
      onPointerDown={(e) => {
        appuiSurLeVoile.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && appuiSurLeVoile.current) onFermer()
        appuiSurLeVoile.current = false
      }}
    >
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <div className="feuille-tete">
          <h2>{titre}</h2>
          <button type="button" className="bouton-fermer" onClick={onFermer} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="feuille-corps">{children}</div>
      </div>
    </div>
  )
}
