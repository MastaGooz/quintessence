/**
 * LE JEU : une partie contre sept bots, qui vit au rythme de l'horloge réelle
 * (`?vitesse=60` : une minute réelle vaut une heure de jeu). La partie est
 * sauvée à chaque action et à chaque seconde qui passe ; au retour, le monde
 * rattrape le temps écoulé. **Le jeu se dévoile** : les pages, l'heure, le
 * titre n'apparaissent que lorsque le joueur en a l'usage.
 */
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { SAISON_H } from '../logic/donnees.ts'
import { fortune } from '../logic/moteur.ts'
import { classement, devoilee, devoiler, finie, joueur, nouvellePartie, rattraper, titre, type Etape, type Partie } from '../logic/partie.ts'
import { AIDE, TITRE_ETAPE } from '../ui/devoilement.ts'
import { ecrireSauvegarde, effacerSauvegarde, lireSauvegarde } from '../ui/stockage.ts'
import { duree, horloge, nombre } from '../ui/format.ts'
import { Labo } from './Labo.tsx'
import { Marche } from './Marche.tsx'
import { Oeuvre } from './Oeuvre.tsx'
import { Fiole, Rivaux } from './Rivaux.tsx'
import { Stock } from './Stock.tsx'

type Page = 'labo' | 'stock' | 'marche' | 'rivaux' | 'oeuvre'

/** Les pages, et l'étape qui les ouvre. */
const PAGES: { id: Page; nom: string; etape: Etape | null }[] = [
  { id: 'labo', nom: 'Labo', etape: null },
  { id: 'stock', nom: 'Entrepôt', etape: 'entrepot' },
  { id: 'marche', nom: 'Comptoir', etape: 'comptoir' },
  { id: 'rivaux', nom: 'Rivaux', etape: 'rivaux' },
  { id: 'oeuvre', nom: 'Œuvre', etape: 'oeuvre' },
]

/** La page où une étape nouvelle s'apprécie : la pastille « nouveau » s'y pose. */
const PAGE_DE: Partial<Record<Etape, Page>> = { entrepot: 'stock', comptoir: 'marche', rivaux: 'rivaux', coupsBas: 'rivaux', oeuvre: 'oeuvre' }

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
      <button type="button" className="bouton-principal" onClick={() => onCommencer(nom.trim() === '' ? 'Vous' : nom.trim())}>
        Commencer
      </button>
      <p className="sourd petit">Build {__DATE_DU_BUILD__}</p>
    </div>
  )
}

function Table({ partie, reelAuDepart, onRecommencer }: { partie: Partie; reelAuDepart: number; onRecommencer: () => void }): ReactElement {
  const [page, setPage] = useState<Page>('labo')
  const [nouveautes, setNouveautes] = useState<Etape[]>([])
  const [, repeindre] = useReducer((x: number) => x + 1, 0)
  const reel = useRef(reelAuDepart)
  const vitesse = useRef(vitesseDemandee())

  /** Fait rattraper au monde le temps réel écoulé, dévoile ce qui doit l'être, puis sauve. */
  const synchroniser = (): void => {
    const maintenant = Date.now()
    const h = ((maintenant - reel.current) / 3600000) * vitesse.current
    if (h > 0) rattraper(partie, partie.monde.t + h)
    reel.current = maintenant
    // LA PREMIÈRE ÉTAPE SE PASSE DE BANNIÈRE : la carte de l'argilière dit tout.
    const nouvelles = devoiler(partie).filter((e) => e !== 'batir')
    if (nouvelles.length > 0) setNouveautes((avant) => [...avant, ...nouvelles])
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
  const pages = PAGES.filter((p) => p.etape === null || devoilee(partie, p.etape))
  const nouveaute = nouveautes[0]
  return (
    <div className="jeu">
      <header className="entete">
        <span className="entete-or">
          <b>{nombre(j.or)}</b> or
        </span>
        <span className="entete-heure">
          {devoilee(partie, 'batir') && horloge(m.t)}
          {devoilee(partie, 'rivaux') && <span className="sourd petit"> · fin dans {duree(SAISON_H - m.t)}</span>}
        </span>
        <span className="entete-titre">{devoilee(partie, 'maitrise') && <><Fiole j={j} /> {titre(j)}</>}</span>
        {devoilee(partie, 'batir') && (
          <button type="button" className="entete-saut" onClick={() => sauter(4)} title="Faire passer quatre heures (test)">
            +4 h
          </button>
        )}
      </header>
      {nouveaute !== undefined && (
        <div className="nouveaute" role="status">
          <span>
            <b>Nouveau : {TITRE_ETAPE[nouveaute]}.</b> {AIDE[nouveaute]}
          </span>
          <button
            type="button"
            onClick={() => {
              const cible = PAGE_DE[nouveaute]
              if (cible !== undefined) setPage(cible)
              setNouveautes((l) => l.slice(1))
            }}
          >
            {PAGE_DE[nouveaute] !== undefined ? 'Voir' : 'Compris'}
          </button>
        </div>
      )}
      <main className="corps">
        {finie(partie) ? (
          <Fin partie={partie} onRecommencer={onRecommencer} />
        ) : page === 'stock' && devoilee(partie, 'entrepot') ? (
          <Stock {...props} />
        ) : page === 'marche' && devoilee(partie, 'comptoir') ? (
          <Marche {...props} />
        ) : page === 'rivaux' && devoilee(partie, 'rivaux') ? (
          <Rivaux {...props} />
        ) : page === 'oeuvre' && devoilee(partie, 'oeuvre') ? (
          <Oeuvre {...props} />
        ) : (
          <Labo {...props} />
        )}
      </main>
      {pages.length > 1 && (
        <nav className="barre">
          {pages.map((p) => (
            <button key={p.id} type="button" className={page === p.id ? 'actif' : ''} onClick={() => setPage(p.id)}>
              {p.nom}
            </button>
          ))}
        </nav>
      )}
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
