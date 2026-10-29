/**
 * LE JEU : une partie contre sept bots, qui vit au rythme de l'horloge réelle
 * (`?vitesse=60` : une minute réelle vaut une heure de jeu). La partie est
 * sauvée à chaque action et à chaque seconde qui passe ; au retour, le monde
 * rattrape le temps écoulé. **Le tutoriel ouvre le jeu une chose à la fois** :
 * les pages, l'heure, le titre n'apparaissent qu'à leur étape.
 */
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { SAISON_H } from '../logic/donnees.ts'
import { fortune } from '../logic/moteur.ts'
import { atteint, avancerTuto, classement, finie, joueur, nouvellePartie, pageOuverte, rattraper, titre, type Page, type Partie } from '../logic/partie.ts'
import { ecrireSauvegarde, effacerSauvegarde, lireSauvegarde } from '../ui/stockage.ts'
import { duree, horloge, nombre } from '../ui/format.ts'
import { basculerSon, sonActif, sonClic } from '../ui/sons.ts'
import { Compteur } from './Compteur.tsx'
import { declarerCibleOr, monterCouche } from './effets.ts'
import { Labo } from './Labo.tsx'
import { Marche } from './Marche.tsx'
import { Oeuvre } from './Oeuvre.tsx'
import { Fiole, Rivaux } from './Rivaux.tsx'
import { Stock } from './Stock.tsx'

const PAGES: { id: Page; nom: string }[] = [
  { id: 'labo', nom: 'Labo' },
  { id: 'stock', nom: 'Entrepôt' },
  { id: 'marche', nom: 'Comptoir' },
  { id: 'rivaux', nom: 'Rivaux' },
  { id: 'oeuvre', nom: 'Œuvre' },
]

function vitesseDemandee(): number {
  const v = Number(new URLSearchParams(location.search).get('vitesse') ?? '1')
  return Number.isFinite(v) && v > 0 ? v : 1
}

export function Jeu(): ReactElement {
  const [sauvegarde, setSauvegarde] = useState(() => lireSauvegarde())
  if (sauvegarde === null) return <Accueil onCommencer={(nom) => setSauvegarde({ partie: nouvellePartie(Date.now() % 1000000, nom), reel: Date.now() })} />
  return <Table partie={sauvegarde.partie} reelAuDepart={sauvegarde.reel} onRecommencer={() => setSauvegarde(null)} />
}

function Accueil({ onCommencer }: { onCommencer: (nom: string) => void }): ReactElement {
  const [nom, setNom] = useState('')
  return (
    <div className="accueil">
      <h1>Quintessence</h1>
      <p>Vous êtes un apprenti alchimiste. Tout commence par une pièce.</p>
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
      <p className="sourd petit">Build {__DATE_DU_BUILD__}</p>
    </div>
  )
}

function Table({ partie, reelAuDepart, onRecommencer }: { partie: Partie; reelAuDepart: number; onRecommencer: () => void }): ReactElement {
  const [page, setPage] = useState<Page>('labo')
  const [, repeindre] = useReducer((x: number) => x + 1, 0)
  const reel = useRef(reelAuDepart)
  const vitesse = useRef(vitesseDemandee())

  /** Fait rattraper au monde le temps réel écoulé, avance le tutoriel, puis sauve. */
  const synchroniser = (): void => {
    const maintenant = Date.now()
    const h = ((maintenant - reel.current) / 3600000) * vitesse.current
    if (h > 0) rattraper(partie, partie.monde.t + h)
    reel.current = maintenant
    avancerTuto(partie)
    ecrireSauvegarde({ partie, reel: maintenant })
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

  /** Pour tester : fait passer quatre heures d'un coup, comme si on revenait plus tard. */
  const sauter = (h: number): void => {
    rattraper(partie, partie.monde.t + h)
    synchroniser()
    repeindre()
  }

  const m = partie.monde
  const j = joueur(partie)
  const props = { partie, agir }
  const pages = PAGES.filter((p) => pageOuverte(partie, p.id))
  const pageVue = pageOuverte(partie, page) ? page : 'labo'
  return (
    <div className="jeu">
      <div className="effets" ref={monterCouche} aria-hidden />
      <header className="entete">
        <span className="entete-or">
          <b ref={declarerCibleOr}>
            <Compteur valeur={j.or} cle="or" />
          </b>{' '}
          or
        </span>
        <span className="entete-heure">
          {atteint(partie, 'argiliere') && horloge(m.t)}
          {atteint(partie, 'rivaux') && <span className="sourd petit"> · fin dans {duree(SAISON_H - m.t)}</span>}
        </span>
        <span className="entete-titre">
          {atteint(partie, 'maitrise') && (
            <>
              <Fiole j={j} /> {titre(j)}
            </>
          )}
        </span>
        {atteint(partie, 'argiliere') && (
          <button type="button" className="entete-saut" onClick={() => sauter(4)} title="Faire passer quatre heures (test)">
            +4 h
          </button>
        )}
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
      <main className="corps">
        {finie(partie) ? (
          <Fin partie={partie} onRecommencer={onRecommencer} />
        ) : pageVue === 'stock' ? (
          <Stock {...props} />
        ) : pageVue === 'marche' ? (
          <Marche {...props} />
        ) : pageVue === 'rivaux' ? (
          <Rivaux {...props} />
        ) : pageVue === 'oeuvre' ? (
          <Oeuvre {...props} />
        ) : (
          <Labo {...props} />
        )}
      </main>
      {pages.length > 1 && (
        <nav className="barre">
          {pages.map((p) => (
            <button key={p.id} type="button" className={pageVue === p.id ? 'actif' : ''} onClick={() => setPage(p.id)}>
              {p.nom}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

/** Un haut-parleur, barré quand le son est coupé. */
function IconeSon({ actif }: { actif: boolean }): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h3l5 4V5L7 9Z" />
      {actif ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9l5 6M21 9l-5 6" />}
    </svg>
  )
}

function Fin({ partie, onRecommencer }: { partie: Partie; onRecommencer: () => void }): ReactElement {
  const m = partie.monde
  const rangs = classement(partie, (x) => fortune(m, x))
  return (
    <div className="page">
      <h1>La saison est finie</h1>
      <p>{rangs[0]?.couleur === 4 ? `${rangs[0].nom} tient la pierre philosophale.` : 'Personne n’a atteint le rouge : la couleur la plus avancée, puis la fortune, départagent.'}</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className="ligne">
            <span>
              {i + 1}. <Fiole j={r} /> <b>{r.nom}</b> <span className="sourd">· {titre(r)}</span>
            </span>
            <span className="sourd">{nombre(fortune(m, r))} or</span>
          </div>
        ))}
      </section>
      <button
        type="button"
        className="bouton-principal"
        onClick={() => {
          effacerSauvegarde()
          onRecommencer()
        }}
      >
        Nouvelle saison
      </button>
    </div>
  )
}
