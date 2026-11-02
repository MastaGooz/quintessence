/**
 * LE JEU du système abstrait : une partie contre sept bots, au rythme de
 * l'horloge réelle (`?vitesse=60` : une minute réelle vaut une heure de jeu).
 * Sauvée à chaque action et à chaque seconde ; au retour, le monde rattrape le
 * temps écoulé. Le jeu commence par la mine d'or seule (Keko, 02/11) : les
 * pages n'apparaissent qu'avec autre chose qu'elle.
 */
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { RESSOURCES, SAISON_H } from '../../logic/clic/donnees.ts'
import { debitOr, estConstruit, estMine, ressourceDe, stockRessource } from '../../logic/clic/moteur.ts'
import { classement, finie, joueur, nouvellePartie, rattraper, type Partie } from '../../logic/clic/partie.ts'
import { ecrireSauvegardeClic, effacerSauvegardeClic, lireSauvegardeClic } from '../../ui/stockage-clic.ts'
import { abrege, duree, horloge, parSeconde, possede } from '../../ui/format.ts'
import { NOM_OR } from '../../ui/noms-clic.ts'
import { basculerSon, sonActif, sonClic } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { declarerCibleOr, declarerCibleRessource, monterCouche } from '../effets.ts'
import { IconeSon } from '../Jeu.tsx'
import { Base } from './Base.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'
import { MarcheClic } from './MarcheClic.tsx'
import { RivauxClic } from './RivauxClic.tsx'

type Page = 'base' | 'marche' | 'rivaux'

const PAGES: { id: Page; nom: string }[] = [
  { id: 'base', nom: 'Carte' },
  { id: 'marche', nom: 'Marché' },
  { id: 'rivaux', nom: 'Rivaux' },
]

function vitesseDemandee(): number {
  const v = Number(new URLSearchParams(location.search).get('vitesse') ?? '1')
  return Number.isFinite(v) && v > 0 ? v : 1
}

export function JeuClic(): ReactElement {
  const [sauvegarde, setSauvegarde] = useState(() => lireSauvegardeClic())
  if (sauvegarde === null) return <Accueil onCommencer={(nom) => setSauvegarde({ partie: nouvellePartie(Date.now() % 1000000, nom), reel: Date.now() })} />
  return <Table partie={sauvegarde.partie} reelAuDepart={sauvegarde.reel} onRecommencer={() => setSauvegarde(null)} />
}

function Accueil({ onCommencer }: { onCommencer: (nom: string) => void }): ReactElement {
  const [nom, setNom] = useState('')
  return (
    <div className="accueil">
      <h1>Quintessence</h1>
      <p className="sourd petit">Prototype : le jeu se pose brique par brique.</p>
      <p>
        Vous commencez avec une banque. Tapez-la : chaque tape rapporte 1 <SymbolePiece />.
      </p>
      <label>
        Votre nom
        <input type="text" value={nom} maxLength={16} placeholder="Nicolas" onChange={(e) => setNom(e.target.value)} />
      </label>
      <button
        type="button"
        className="bouton-principal respire"
        onClick={() => {
          sonClic()
          onCommencer(nom.trim() === '' ? 'Vous' : nom.trim())
        }}
      >
        Commencer
      </button>
      <p className="sourd petit">
        Build {__DATE_DU_BUILD__} · <a href="?alchimie">le prototype alchimie</a>
      </p>
    </div>
  )
}

function Table({ partie, reelAuDepart, onRecommencer }: { partie: Partie; reelAuDepart: number; onRecommencer: () => void }): ReactElement {
  const [page, setPage] = useState<Page>('base')
  const [, repeindre] = useReducer((x: number) => x + 1, 0)
  const reel = useRef(reelAuDepart)
  const vitesse = useRef(vitesseDemandee())

  /** Fait rattraper au monde le temps réel écoulé, puis sauve. */
  /** Une fois la partie remise à zéro, plus rien ne l'écrit (la seconde qui passe la réécrirait). */
  const arretee = useRef(false)
  /** Le bouton « Reset » armé : une seconde tape dans les trois secondes efface la partie. */
  const [resetArme, setResetArme] = useState(false)
  const minuteurReset = useRef(0)

  const synchroniser = (): void => {
    if (arretee.current) return
    const maintenant = Date.now()
    const h = ((maintenant - reel.current) / 3600000) * vitesse.current
    if (h > 0) rattraper(partie, partie.monde.t + h)
    reel.current = maintenant
    ecrireSauvegardeClic({ partie, reel: maintenant })
  }

  useEffect(() => {
    synchroniser()
    repeindre()
    const id = window.setInterval(() => {
      synchroniser()
      repeindre()
    }, 1000)
    const visible = (): void => {
      if (document.visibilityState === 'visible') {
        synchroniser()
        repeindre()
      }
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', visible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partie])

  const agir = (f: () => void): void => {
    synchroniser()
    f()
    synchroniser()
    repeindre()
  }

  /** Pour tester : fait passer des heures d'un coup, comme si on revenait plus tard. */
  const sauter = (h: number): void => {
    rattraper(partie, partie.monde.t + h)
    synchroniser()
    repeindre()
  }

  const m = partie.monde
  const j = joueur(partie)
  const props = { partie, agir }
  // Le jeu s'ouvre une chose à la fois : la barre et l'heure arrivent avec autre chose que la mine (l'or seul n'ouvre rien).
  const stock = j.matiere.reduce((s, q) => s + q, 0)
  // La banque et les producteurs construits n'ouvrent rien : seul le système des couleurs, quand il reviendra.
  const ouvert = stock >= 10 || j.modules.length > 0 || j.points > 0 || j.producteurs.some((p) => !estMine(p) && !estConstruit(p))
  // LES RESSOURCES, à côté de l'or, dès qu'un producteur en fait.
  const ressourcesVues = RESSOURCES.filter((r) => j.producteurs.some((p) => estConstruit(p) && ressourceDe(p) === r) || stockRessource(j, r) > 0)
  const pageVue = ouvert ? page : 'base'
  // La carte remplit le corps : la page ne défile pas, c'est le plan qui glisse.
  const surLaCarte = !finie(partie) && pageVue === 'base'
  return (
    <div className={`jeu${surLaCarte ? ' jeu-carte' : ''}`}>
      <div className="effets" ref={monterCouche} aria-hidden />
      <header className="entete">
        <span className="entete-or">
          <b ref={declarerCibleOr}>
            {/* L'OR EN ENTIER (Keko, 02/11 : « à 1,34 k on ne voit plus le chiffre monter ») : chaque pièce se voit arriver. */}
            <Compteur valeur={j.or} cle="or" format={possede} />
          </b>{' '}
          <SymbolePiece />
          {ressourcesVues.map((r) => (
            <span key={r} className="entete-ressource">
              <b ref={declarerCibleRessource(r)}>
                <Compteur valeur={stockRessource(j, r)} cle={r} format={possede} />
              </b>{' '}
              <SymboleRessource ressource={r} />
            </span>
          ))}
        </span>
        <span className="entete-heure">
          {ouvert && horloge(m.t)}
          {ouvert && <span className="sourd petit"> · fin dans {duree(SAISON_H - m.t)}</span>}
        </span>
        <span className="entete-titre">{j.points > 0 && <span className="sourd">×{abrege(1 + j.points)}</span>}</span>
        {/* POUR TESTER (Keko, 02/11 : « un bouton reset en haut et un +1h ») : une heure qui passe d'un coup ; la partie effacée, en deux tapes. */}
        <button type="button" className="entete-saut" onClick={() => sauter(1)} title="Faire passer une heure (test)">
          +1 h
        </button>
        <button
          type="button"
          className={`entete-saut${resetArme ? ' entete-reset-arme' : ''}`}
          title="Effacer la partie et recommencer (test)"
          onClick={() => {
            window.clearTimeout(minuteurReset.current)
            if (!resetArme) {
              setResetArme(true)
              minuteurReset.current = window.setTimeout(() => setResetArme(false), 3000)
              return
            }
            arretee.current = true
            effacerSauvegardeClic()
            onRecommencer()
          }}
        >
          {resetArme ? 'Sûr ?' : 'Reset'}
        </button>
        <button
          type="button"
          className="entete-son"
          aria-label={sonActif() ? 'Couper le son' : 'Rendre le son'}
          onClick={() => {
            if (basculerSon()) sonClic()
            repeindre()
          }}
        >
          <IconeSon actif={sonActif()} />
        </button>
      </header>
      <main className={`corps${surLaCarte ? ' corps-carte' : ''}`}>
        {finie(partie) ? (
          <Fin partie={partie} onRecommencer={onRecommencer} />
        ) : pageVue === 'marche' ? (
          <MarcheClic {...props} />
        ) : pageVue === 'rivaux' ? (
          <RivauxClic {...props} />
        ) : (
          <Base {...props} avecBarre={ouvert} versMarche={() => setPage('marche')} />
        )}
      </main>
      {ouvert && (
        <nav className="barre">
          {PAGES.map((p) => (
            <button key={p.id} type="button" className={pageVue === p.id ? 'actif' : ''} onClick={() => setPage(p.id)}>
              {p.nom}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function Fin({ partie, onRecommencer }: { partie: Partie; onRecommencer: () => void }): ReactElement {
  const rangs = classement(partie)
  const moi = joueur(partie)
  return (
    <div className="page">
      <h1>La saison est finie</h1>
      <p>{rangs[0] === moi ? `Vous avez extrait plus d’${NOM_OR} que tous les autres.` : `${rangs[0]?.nom} a extrait le plus d’${NOM_OR} : ${abrege(rangs[0]?.orProduit ?? 0)}.`}</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === moi ? ' ligne-moi' : ''}`}>
            <span>
              {i + 1}. <b>{r.nom}</b> <span className="sourd petit">· {parSeconde(debitOr(r))}</span>
            </span>
            <span>
              {abrege(r.orProduit)} {NOM_OR}
            </span>
          </div>
        ))}
      </section>
      <button
        type="button"
        className="bouton-principal"
        onClick={() => {
          effacerSauvegardeClic()
          onRecommencer()
        }}
      >
        Nouvelle saison
      </button>
    </div>
  )
}
