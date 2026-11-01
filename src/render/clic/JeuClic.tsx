/**
 * LE JEU du système abstrait : une partie contre sept bots, au rythme de
 * l'horloge réelle (`?vitesse=60` : une minute réelle vaut une heure de jeu).
 * Sauvée à chaque action et à chaque seconde ; au retour, le monde rattrape le
 * temps écoulé. Le jeu commence par le choix de sa sorte de matière, puis la
 * base seule : les pages n'apparaissent qu'avec la première matière à vendre.
 */
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { FORMES, SAISON_H } from '../../logic/clic/donnees.ts'
import { choisirSorte, debit } from '../../logic/clic/moteur.ts'
import { classement, finie, joueur, nouvellePartie, rattraper, type Partie } from '../../logic/clic/partie.ts'
import { ecrireSauvegardeClic, effacerSauvegardeClic, lireSauvegardeClic } from '../../ui/stockage-clic.ts'
import { abrege, duree, horloge, parSeconde } from '../../ui/format.ts'
import { EXPLICATION_MODULE, NOM_MATIERE, NOM_MODULE, NOM_OR, NOM_SORTE } from '../../ui/noms-clic.ts'
import { vibrer } from '../../ui/haptique.ts'
import { basculerSon, sonActif, sonBatir, sonClic } from '../../ui/sons.ts'
import { Compteur } from '../Compteur.tsx'
import { declarerCibleOr, monterCouche } from '../effets.ts'
import { IconeSon } from '../Jeu.tsx'
import { Base } from './Base.tsx'
import { Glyphe } from './Glyphe.tsx'
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
      <p className="sourd petit">Prototype, habillé par les mots seulement.</p>
      <p>
        Vous produisez une seule sorte de {NOM_MATIERE}, que vous choisissez. Des ateliers la transforment en modules, de rareté tirée, qui s’emboîtent sur vos générateurs et les font produire plus.
        Les trois autres sortes s’achètent au marché, commun à tous : vendez votre surplus, achetez ce qui vous manque.
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

/** LE CHOIX DE SA SORTE : au départ, et à chaque départ (prestige). La forme choisie est celle des modules qu'on saura fabriquer seul. */
function ChoixSorte({ points, onChoisir }: { points: number; onChoisir: (sorte: number) => void }): ReactElement {
  return (
    <div className="accueil choix-sorte">
      <h1>{points > 0 ? 'Vous repartez' : 'Votre matière'}</h1>
      <p>
        Choisissez la sorte de {NOM_MATIERE} que vous produirez. Votre atelier en fera des modules de la même forme ; pour les trois autres formes, il faudra acheter leur {NOM_MATIERE} au marché.
        {points > 0 && ` Vos ${points} point${points > 1 ? 's' : ''} multiplient tous vos lots par ${abrege(1 + points)}.`}
      </p>
      <div className="choix-sorte-liste">
        {Array.from({ length: FORMES }, (_, s) => (
          <button key={s} type="button" className="choix-sorte-bouton" onClick={() => onChoisir(s)}>
            <Glyphe forme={s} classe="glyphe-grand" />
            <span className="unite-texte">
              <b>{NOM_SORTE[s]}</b>
              <span className="petit sourd">
                → {NOM_MODULE[s]} : {EXPLICATION_MODULE[s]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Table({ partie, reelAuDepart, onRecommencer }: { partie: Partie; reelAuDepart: number; onRecommencer: () => void }): ReactElement {
  const [page, setPage] = useState<Page>('base')
  const [, repeindre] = useReducer((x: number) => x + 1, 0)
  const reel = useRef(reelAuDepart)
  const vitesse = useRef(vitesseDemandee())

  /** Fait rattraper au monde le temps réel écoulé, puis sauve. */
  const synchroniser = (): void => {
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
  if (j.sorte === null && !finie(partie)) {
    return (
      <div className="jeu">
        <div className="effets" ref={monterCouche} aria-hidden />
        <ChoixSorte
          points={j.points}
          onChoisir={(s) => {
            sonBatir()
            vibrer([15, 30])
            agir(() => {
              choisirSorte(j, s)
            })
            setPage('base')
          }}
        />
      </div>
    )
  }
  // Le jeu s'ouvre une chose à la fois : la barre et l'heure arrivent avec la première matière à vendre.
  const ouvert = (j.matiere[j.sorte ?? 0] ?? 0) >= 10 || j.or > 0 || j.modules.length > 0 || j.points > 0 || j.producteurs.length > 1
  const pageVue = ouvert ? page : 'base'
  // La carte remplit le corps : la page ne défile pas, c'est le plan qui glisse.
  const surLaCarte = !finie(partie) && pageVue === 'base'
  return (
    <div className={`jeu${surLaCarte ? ' jeu-carte' : ''}`}>
      <div className="effets" ref={monterCouche} aria-hidden />
      <header className="entete">
        <span className="entete-or">
          <b ref={declarerCibleOr}>
            <Compteur valeur={j.or} cle="or" format={abrege} />
          </b>{' '}
          {NOM_OR}
        </span>
        <span className="entete-heure">
          {ouvert && horloge(m.t)}
          {ouvert && <span className="sourd petit"> · fin dans {duree(SAISON_H - m.t)}</span>}
        </span>
        <span className="entete-titre">{j.points > 0 && <span className="sourd">×{abrege(1 + j.points)}</span>}</span>
        {ouvert && (
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
      <p>{rangs[0] === moi ? 'Vous avez produit plus que tous les autres.' : `${rangs[0]?.nom} a produit le plus : ${abrege(rangs[0]?.total ?? 0)} ${NOM_MATIERE}.`}</p>
      <section>
        {rangs.map((r, i) => (
          <div key={r.id} className={`ligne${r === moi ? ' ligne-moi' : ''}`}>
            <span>
              {i + 1}. <b>{r.nom}</b> <span className="sourd petit">· {parSeconde(debit(r))}</span>
            </span>
            <span>{abrege(r.total)} {NOM_MATIERE}</span>
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
