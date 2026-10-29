/**
 * LE JEU : une partie contre sept bots, qui vit au rythme de l'horloge réelle
 * (`?vitesse=60` : une minute réelle vaut une heure de jeu). La partie est
 * sauvée à chaque action et à chaque seconde qui passe ; au retour, le monde
 * rattrape le temps écoulé.
 */
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { SAISON_H } from '../logic/donnees.ts'
import { fortune } from '../logic/moteur.ts'
import { classement, finie, joueur, nouvellePartie, rattraper, titre, type Partie } from '../logic/partie.ts'
import { ecrireSauvegarde, effacerSauvegarde, lireSauvegarde } from '../ui/stockage.ts'
import { duree, horloge, nombre } from '../ui/format.ts'
import { Labo } from './Labo.tsx'
import { Marche } from './Marche.tsx'
import { Oeuvre } from './Oeuvre.tsx'
import { Fiole, Rivaux } from './Rivaux.tsx'
import { Stock } from './Stock.tsx'

type Page = 'labo' | 'stock' | 'marche' | 'rivaux' | 'oeuvre'

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
      <p>Sept alchimistes rivaux, un marché commun, sept jours pour créer la pierre philosophale. Passez quelques minutes, plusieurs fois par jour.</p>
      <label>
        Votre nom d'alchimiste
        <input type="text" value={nom} maxLength={16} placeholder="Nicolas" onChange={(e) => setNom(e.target.value)} />
      </label>
      <button type="button" className="bouton-principal" onClick={() => onCommencer(nom.trim() === '' ? 'Vous' : nom.trim())}>
        Commencer la saison
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

  /** Fait rattraper au monde le temps réel écoulé, puis sauve. */
  const rattraperLeReel = (): void => {
    const maintenant = Date.now()
    const h = ((maintenant - reel.current) / 3600000) * vitesse.current
    if (h > 0) rattraper(partie, partie.monde.t + h)
    reel.current = maintenant
    ecrireSauvegarde({ partie, reel: maintenant })
  }

  useEffect(() => {
    rattraperLeReel()
    repeindre()
    const id = window.setInterval(() => {
      rattraperLeReel()
      repeindre()
    }, 1000)
    const visible = (): void => {
      if (document.visibilityState === 'visible') {
        rattraperLeReel()
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
    rattraperLeReel()
    f()
    ecrireSauvegarde({ partie, reel: reel.current })
    repeindre()
  }

  /** Pour tester : fait passer quatre heures d'un coup, comme si on revenait plus tard. */
  const sauter = (h: number): void => {
    rattraper(partie, partie.monde.t + h)
    ecrireSauvegarde({ partie, reel: reel.current })
    repeindre()
  }

  const m = partie.monde
  const j = joueur(partie)
  const props = { partie, agir }
  return (
    <div className="jeu">
      <header className="entete">
        <span className="entete-or">
          <b>{nombre(j.or)}</b> or
        </span>
        <span className="entete-heure">
          {horloge(m.t)} <span className="sourd petit">· fin dans {duree(SAISON_H - m.t)}</span>
        </span>
        <span className="entete-titre">
          <Fiole j={j} /> {titre(j)}
        </span>
        <button type="button" className="entete-saut" onClick={() => sauter(4)} title="Faire passer quatre heures (test)">
          +4 h
        </button>
      </header>
      <main className="corps">
        {finie(partie) ? (
          <Fin partie={partie} onRecommencer={onRecommencer} />
        ) : page === 'labo' ? (
          <Labo {...props} />
        ) : page === 'stock' ? (
          <Stock {...props} />
        ) : page === 'marche' ? (
          <Marche {...props} />
        ) : page === 'rivaux' ? (
          <Rivaux {...props} />
        ) : (
          <Oeuvre {...props} />
        )}
      </main>
      <nav className="barre">
        {PAGES.map((p) => (
          <button key={p.id} type="button" className={page === p.id ? 'actif' : ''} onClick={() => setPage(p.id)}>
            {p.nom}
          </button>
        ))}
      </nav>
    </div>
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
