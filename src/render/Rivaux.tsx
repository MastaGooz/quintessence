/** LES RIVAUX : le classement, ce qu'on voit d'eux, les coups bas, et la gazette. */
import { type ReactElement } from 'react'
import { COUPS, ELEMENTS } from '../logic/donnees.ts'
import { aLe, CHEF, espionner, fortune, peutEspionner, peutPiller, peutSaboter, piller, saboter, voit, type Joueur } from '../logic/moteur.ts'
import { classement, devoilee, joueur, titre } from '../logic/partie.ts'
import { AIDE } from '../ui/devoilement.ts'
import { NOM_ELEMENT } from '../ui/noms.ts'
import { duree, nombre } from '../ui/format.ts'
import type { PageProps } from './props.ts'

const COULEURS_FIOLE = ['transparent', '#15090f', '#fff6e2', '#f2c744', '#d92b2b']

export function Fiole({ j }: { j: Joueur }): ReactElement {
  const c = COULEURS_FIOLE[j.couleur] ?? 'transparent'
  return (
    <span className={`fiole${j.cuisson !== null ? ' fiole-cuit' : ''}`} style={{ background: c }} title={`${j.couleur} couleur(s)`} aria-hidden />
  )
}

export function Rivaux({ partie, agir }: PageProps): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const rangs = classement(partie, (x) => fortune(m, x))
  return (
    <div className="page">
      <h1>Rivaux</h1>
      <section>
        <h2>Classement</h2>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === j ? ' ligne-moi' : ''}`}>
            <span>
              {i + 1}. <Fiole j={r} /> <b>{r.nom}</b> <span className="sourd">· {titre(r)}</span>
            </span>
            <span className="sourd petit">{r.cuisson !== null ? `cuit ${duree(r.cuisson.fin - m.t)}` : r.couleur === 0 ? 'aucune couleur' : `${r.couleur} couleur${r.couleur > 1 ? 's' : ''}`}</span>
          </div>
        ))}
      </section>
      {devoilee(partie, 'coupsBas') && (
        <section>
          <h2>Coups bas</h2>
          <p className="sourd petit">{AIDE.coupsBas}</p>
          {!aLe(j, 'repaire') && !aLe(j, 'officine') && !aLe(j, 'tour') && (
            <p className="sourd">Bâtissez un Repaire, une Officine ou une Tour (dans « Bâtir ») pour agir sur les autres.</p>
          )}
          {m.joueurs
            .filter((r) => r !== j)
            .map((r) => (
              <Rival key={r.id} partie={partie} agir={agir} r={r} />
            ))}
        </section>
      )}
      <section>
        <h2>Gazette des Alambics</h2>
        {m.gazette.length === 0 && <p className="sourd">Rien à signaler pour le moment.</p>}
        {[...m.gazette]
          .reverse()
          .slice(0, 15)
          .map((l, i) => (
            <p key={i} className="petit">
              {l}
            </p>
          ))}
      </section>
    </div>
  )
}

function Rival({ partie, agir, r }: PageProps & { r: Joueur }): ReactElement {
  const m = partie.monde
  const j = joueur(partie)
  const protege = m.t < r.protegeJusqua
  const vu = voit(m, j, r)
  const rechargeP = Math.max(0, (j.recharges.pillage ?? 0) - m.t)
  const rechargeS = Math.max(0, (j.recharges.sabotage ?? 0) - m.t)
  const rechargeE = Math.max(0, (j.recharges.espion ?? 0) - m.t)
  return (
    <div className="rival">
      <div className="ligne">
        <span>
          <Fiole j={r} /> <b>{r.nom}</b> <span className="sourd">· {titre(r)}</span>
        </span>
        <span className="sourd petit">{protege ? `protégé ${duree(r.protegeJusqua - m.t)}` : ''}</span>
      </div>
      {vu ? (
        <p className="petit">
          {nombre(r.or)} or · {r.batiments.length} bâtiments · fortune {nombre(fortune(m, r))} ·{' '}
          {ELEMENTS.map((e) => `${NOM_ELEMENT[e]} ${r.points[e]}`).join(', ')} · chefs-d’œuvre : {ELEMENTS.map((e) => nombre(r.stock[CHEF[e]])).join(' / ')}
          {aLe(r, 'gardien') && ' · gardien'}
          {aLe(r, 'cercle') && ' · cercle'}
        </p>
      ) : (
        <p className="sourd petit">Son laboratoire est caché : il faut l'espionner.</p>
      )}
      <div className="boutons">
        {aLe(j, 'tour') && (
          <button type="button" disabled={!peutEspionner(m, j, r)} onClick={() => agir(() => espionner(m, j, r))}>
            {rechargeE > 0 ? `Espion ${duree(rechargeE)}` : `Espionner (${COUPS.espion.cristal} cristal)`}
          </button>
        )}
        {aLe(j, 'repaire') && (
          <button type="button" disabled={!peutPiller(m, j, r)} onClick={() => agir(() => piller(m, j, r))}>
            {rechargeP > 0 ? `Pillage ${duree(rechargeP)}` : `Piller (${COUPS.pillage.braises} braises)`}
          </button>
        )}
        {aLe(j, 'officine') && (
          <button type="button" disabled={!peutSaboter(m, j, r)} onClick={() => agir(() => saboter(m, j, r))}>
            {rechargeS > 0 ? `Sabotage ${duree(rechargeS)}` : `Saboter (${COUPS.sabotage.mercure} mercure)`}
          </button>
        )}
      </div>
    </div>
  )
}
