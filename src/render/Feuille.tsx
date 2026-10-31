/**
 * UNE FEUILLE qui monte du bas, au doigt : une tape sur le voile la ferme.
 * `data-hud` : posée sur la carte, elle n'est pas la carte — sinon le
 * contrôleur capturait le pointeur sous elle et, à la souris, le clic
 * n'atteignait plus ses boutons (Keko, sur PC : « je peux ni acheter ni
 * fermer la boutique »).
 */
import type { ReactNode } from 'react'

export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }): React.ReactElement {
  return (
    <div className="voile" data-hud onClick={onFermer}>
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
