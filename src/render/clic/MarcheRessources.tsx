/**
 * LE MARCHÉ DES RESSOURCES, en salle de trading (Keko, 02/11 : « une interface
 * plus fidèle à un truc de trade, avec une chart autre qu'une ligne, comme si
 * le marché était vraiment vivant ; quand on vend ou achète, on renseigne le
 * nombre nous-même et le prix — le prix du marché actuel, et un bouton prix du
 * marché ou prix perso, auquel cas l'ordre se lance quand le prix demandé
 * trouve un acheteur ») : d'abord LA LISTE des ressources — leur prix, leur
 * tendance —, puis L'ÉCRAN DE TRADE de celle qu'on a touchée (Keko : « un
 * écran de sélection de la ressource à trader avant l'écran de trade ; on
 * garde la sélection en haut de l'écran de trade pour acheter/vendre ») :
 * acheter ou vendre ; son prix qui bouge, ses bougies ; la quantité ; au prix
 * du marché ou à son prix ; les ordres en attente (annulables) et les derniers
 * exécutés.
 */
import { useState, type ReactElement } from 'react'
import { MARCHE_RESSOURCES, RESSOURCES, type Ressource } from '../../logic/clic/donnees.ts'
import {
  bougiesRessource, coutAchatRessource, gainVenteRessource, prixPleinRessource, prixRessource, quantiteAchetableRessource, stockRessource, type Bougie, type Joueur, type Monde, type Ordre,
} from '../../logic/clic/moteur.ts'
import { possede } from '../../ui/format.ts'
import { LE_RESSOURCE, NOM_RESSOURCE } from '../../ui/noms-clic.ts'
import { Feuille } from '../Feuille.tsx'
import { SymbolePiece, SymboleRessource } from './Glyphe.tsx'
import { cotationsDeTest, ressourcesDeTest } from './MarcheTest.tsx'

type Sens = 'achat' | 'vente'

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const deuxDecimales = (n: number): string => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** Un nombre tapé à la française (« 2,15 ») ou non. */
const lu = (texte: string): number => Number(texte.replace(',', '.').replace(/\s/g, ''))
/** Combien de bougies le graphique montre, et l'écart d'une heure en bougies. */
const VUES = 40
const UNE_HEURE = Math.round(1 / MARCHE_RESSOURCES.bougie)

/** Ce que l'écran du marché sait d'une ressource : la vraie, lue au moteur ; une fictive (le mode test, `MarcheTest.tsx`), simulée. */
export interface Cotation {
  cle: string
  nom: string
  symbole: ReactElement
  prix: number
  plein: number
  bougies: Bougie[]
  stock: number
  coutAchat: (q: number) => number
  gainVente: (q: number) => number
  achetable: (or: number) => number
  /** La vraie ressource, qu'on échange ; null pour une fictive : rien ne s'y échange. */
  ressource: Ressource | null
}

function cotationReelle(m: Monde, j: Joueur, r: Ressource): Cotation {
  return {
    cle: r,
    nom: majuscule(NOM_RESSOURCE[r]),
    symbole: <SymboleRessource ressource={r} />,
    prix: prixRessource(m, r),
    plein: prixPleinRessource(r),
    bougies: bougiesRessource(m, r),
    stock: Math.floor(stockRessource(j, r) + 1e-9),
    coutAchat: (q) => coutAchatRessource(m, r, q),
    gainVente: (q) => gainVenteRessource(m, r, q),
    achetable: (or) => quantiteAchetableRessource(m, r, or),
    ressource: r,
  }
}

interface Echanges {
  onAcheter: (r: Ressource, q: number, bouton: HTMLElement) => void
  onVendre: (r: Ressource, q: number, bouton: HTMLElement) => void
  onPlacer: (sens: Sens, r: Ressource, q: number, prix: number, bouton: HTMLElement) => void
  onAnnuler: (id: number) => void
}

export function MenuMarche({ m, j, onFermer, ...echanges }: { m: Monde; j: Joueur; onFermer: () => void } & Echanges): ReactElement {
  const [choisie, setChoisie] = useState<string | null>(null)
  const cotations = [...RESSOURCES.map((r) => cotationReelle(m, j, r)), ...cotationsDeTest(m.t, ressourcesDeTest())]
  const c = cotations.find((x) => x.cle === choisie)
  return (
    <Feuille titre={c === undefined ? 'Marché' : `Marché · ${c.nom}`} onFermer={onFermer}>
      {c === undefined ? (
        <ListeDuMarche j={j} cotations={cotations} onChoisir={setChoisie} />
      ) : (
        <EcranDeTrade key={c.cle} j={j} c={c} onRetour={() => setChoisie(null)} {...echanges} />
      )}
    </Feuille>
  )
}

/** La variation du prix d'une ressource sur l'heure écoulée (de −1 à …). */
function variationSurUneHeure(c: Cotation): number {
  const ilYAUneHeure = c.bougies[c.bougies.length - 1 - UNE_HEURE]?.c ?? c.bougies[0]?.o ?? c.plein
  return c.prix / ilYAUneHeure - 1
}

/** « ▲ 3,1 % », en vert ou en rouge. */
function Variation({ v }: { v: number }): ReactElement {
  return (
    <span className={v >= 0 ? 'trade-hausse' : 'trade-baisse'}>
      {v >= 0 ? '▲' : '▼'} {Math.abs(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
    </span>
  )
}

/** LA LISTE DES RESSOURCES À TRADER : une carte chacune — son prix, sa variation sur l'heure, sa tendance, ce qu'on en a, ses ordres en attente ; une tape ouvre son écran de trade. */
function ListeDuMarche({ j, cotations, onChoisir }: { j: Joueur; cotations: Cotation[]; onChoisir: (cle: string) => void }): ReactElement {
  return (
    <div className="choix-ameliorations">
      {cotations.map((c, k) => {
        const v = variationSurUneHeure(c)
        const enAttente = (j.ordres ?? []).filter((o) => o.ressource === c.ressource).length
        return (
          <button key={c.cle} type="button" className="amelioration-carte marche-choix" style={{ animationDelay: `${120 + k * 60}ms` }} onClick={() => onChoisir(c.cle)}>
            <span className="amelioration-tete">
              <b className="amelioration-nom">
                {c.symbole} {c.nom}
              </b>
              <span>
                <b className="prix-grand">{deuxDecimales(c.prix)}</b> <SymbolePiece />
              </span>
            </span>
            <Tendance bougies={c.bougies} hausse={v >= 0} />
            <span className="amelioration-tete">
              <span className="sourd petit">
                vous en avez {possede(c.stock)}
                {enAttente > 0 ? ` · ${enAttente} ordre${enAttente > 1 ? 's' : ''} en attente` : ''}
              </span>
              <span className="petit">
                <Variation v={v} /> <span className="sourd">sur 1 h</span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** La tendance en petit : les clôtures des dernières bougies, en vert si le prix a monté sur l'heure, en rouge sinon. */
function Tendance({ bougies, hausse }: { bougies: Bougie[]; hausse: boolean }): ReactElement {
  const L = 300
  const H = 36
  const points = bougies.slice(-VUES).map((b) => b.c)
  if (points.length < 2) return <svg className="marche-tendance" viewBox={`0 0 ${L} ${H}`} aria-hidden />
  const bas = Math.min(...points)
  const haut = Math.max(...points)
  const ecart = Math.max(1e-6, haut - bas)
  const chemin = points.map((p, i) => `${((i / (points.length - 1)) * L).toFixed(1)},${(H - 3 - ((p - bas) / ecart) * (H - 6)).toFixed(1)}`).join(' ')
  return (
    <svg className="marche-tendance" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={chemin} fill="none" stroke={hausse ? '#5fd38d' : '#ff6b7a'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** L'ÉCRAN DE TRADE d'une ressource : acheter ou vendre en haut, puis son prix, ses bougies, l'ordre, les ordres. */
function EcranDeTrade({ j, c, onRetour, onAcheter, onVendre, onPlacer, onAnnuler }: { j: Joueur; c: Cotation; onRetour: () => void } & Echanges): ReactElement {
  const [sens, setSens] = useState<Sens>('achat')
  const [quantiteTexte, setQuantiteTexte] = useState('5')
  const [perso, setPerso] = useState(false)
  const [prixTexte, setPrixTexte] = useState(() => deuxDecimales(c.prix))

  const r = c.ressource
  const prix = c.prix
  const bougies = c.bougies
  const variation = variationSurUneHeure(c)
  const stock = c.stock
  const q = Math.max(0, Math.floor(lu(quantiteTexte) || 0))
  const limite = Math.max(0.01, Math.round((lu(prixTexte) || 0) * 100) / 100)
  const total = perso ? (sens === 'achat' ? Math.ceil(limite * q - 1e-9) : Math.round(limite * q)) : sens === 'achat' ? c.coutAchat(q) : c.gainVente(q)
  // Une ressource fictive (le mode test) ne s'échange pas.
  const possible = r !== null && q > 0 && (sens === 'achat' ? j.or + 1e-9 >= total : stock >= q)
  const max = sens === 'achat' ? (perso ? Math.floor(j.or / limite + 1e-9) : c.achetable(j.or)) : stock
  const ordres = r === null ? [] : (j.ordres ?? []).filter((o) => o.ressource === r)
  const executes = r === null ? [] : [...(j.executes ?? [])].reverse().slice(0, 5)
  const symbole = c.symbole

  const passerEnPerso = (oui: boolean): void => {
    setPerso(oui)
    if (oui) setPrixTexte(deuxDecimales(prix))
  }
  const quantite = (n: number): void => setQuantiteTexte(String(Math.max(0, Math.floor(n))))
  const prixDe = (n: number): void => setPrixTexte(deuxDecimales(Math.max(0.01, Math.round(n * 100) / 100)))

  return (
    <div className="trade">
      <button type="button" className="trade-retour" onClick={onRetour}>
        ‹ Toutes les ressources
      </button>

      {/* Acheter ou vendre, en haut. */}
      <div className="trade-onglets trade-sens">
        <button type="button" className={sens === 'achat' ? 'onglet-actif sens-achat' : ''} onClick={() => setSens('achat')}>
          Acheter
        </button>
        <button type="button" className={sens === 'vente' ? 'onglet-actif sens-vente' : ''} onClick={() => setSens('vente')}>
          Vendre
        </button>
      </div>

      {/* Son prix, qui bouge, et sa variation sur l'heure. */}
      <div className="trade-prix">
        <span>
          {symbole} <b className="trade-prix-valeur">{deuxDecimales(prix)}</b> <SymbolePiece /> <span className="sourd petit">l’unité</span>
        </span>
        <span>
          <Variation v={variation} /> <span className="sourd petit">sur 1 h</span>
        </span>
      </div>
      <Graphique bougies={bougies} prix={prix} ordres={ordres} />

      {/* La quantité. */}
      <div className="trade-ligne">
        <span className="trade-etiquette">Quantité</span>
        <span className="trade-champ">
          <button type="button" className="trade-pas" onClick={() => quantite(q - 1)} aria-label="Un de moins">
            −
          </button>
          <input inputMode="numeric" value={quantiteTexte} onChange={(e) => setQuantiteTexte(e.target.value)} aria-label="Quantité" />
          <button type="button" className="trade-pas" onClick={() => quantite(q + 1)} aria-label="Un de plus">
            +
          </button>
        </span>
      </div>
      <div className="trade-puces">
        {MARCHE_RESSOURCES.lots.map((n) => (
          <button key={n} type="button" onClick={() => quantite(n)}>
            {n}
          </button>
        ))}
        <button type="button" onClick={() => quantite(max)}>
          Max · {possede(max)}
        </button>
      </div>

      {/* Le prix : celui du marché, ou le sien. */}
      <div className="trade-ligne">
        <span className="trade-etiquette">Prix</span>
        <span className="trade-onglets trade-mode">
          <button type="button" className={perso ? '' : 'onglet-actif'} onClick={() => passerEnPerso(false)}>
            Prix du marché
          </button>
          <button type="button" className={perso ? 'onglet-actif' : ''} onClick={() => passerEnPerso(true)}>
            Prix perso
          </button>
        </span>
      </div>
      {perso && (
        <div className="trade-ligne">
          <span className="trade-etiquette sourd petit">{sens === 'achat' ? 'au plus' : 'au moins'}</span>
          <span className="trade-champ">
            <button type="button" className="trade-pas" onClick={() => prixDe(limite - 0.05)} aria-label="Moins cher">
              −
            </button>
            <input inputMode="decimal" value={prixTexte} onChange={(e) => setPrixTexte(e.target.value)} aria-label="Prix perso" />
            <button type="button" className="trade-pas" onClick={() => prixDe(limite + 0.05)} aria-label="Plus cher">
              +
            </button>
          </span>
        </div>
      )}

      {/* Le total, ce qu'on a, et l'ordre. */}
      <div className="trade-total">
        <span>
          Total : <b className={possible || q === 0 ? '' : 'prix-manque'}>{possede(total)}</b> <SymbolePiece />
        </span>
        <span className="sourd petit">
          vous avez {possede(j.or)} <SymbolePiece /> · {possede(stock)} {symbole}
        </span>
      </div>
      {perso && (
        <p className="sourd petit trade-explication">
          L’ordre attend que le prix {sens === 'achat' ? 'descende' : 'monte'} à {deuxDecimales(limite)} <SymbolePiece /> ; {sens === 'achat' ? 'l’or' : r === null ? 'la ressource' : LE_RESSOURCE[r]} est mis de côté en attendant.
        </p>
      )}
      <button
        type="button"
        className={`trade-valider ${sens === 'achat' ? 'sens-achat' : 'sens-vente'}`}
        disabled={!possible}
        onClick={(e) => {
          if (r === null) return
          if (perso) onPlacer(sens, r, q, limite, e.currentTarget)
          else if (sens === 'achat') onAcheter(r, q, e.currentTarget)
          else onVendre(r, q, e.currentTarget)
        }}
      >
        {perso ? 'Poser l’ordre : ' : ''}
        {sens === 'achat' ? (perso ? 'acheter' : 'Acheter') : perso ? 'vendre' : 'Vendre'} {q} {symbole}
        {perso ? ` à ${deuxDecimales(limite)}` : ' au prix du marché'}
      </button>
      {r === null && <p className="sourd petit trade-explication">Ressource de test : elle ne s’échange pas.</p>}

      {/* Les ordres en attente, les derniers exécutés. */}
      {ordres.length > 0 && (
        <div className="trade-liste">
          <span className="trade-etiquette">Vos ordres en attente</span>
          {ordres.map((o) => (
            <span key={o.id} className="trade-ordre">
              <span className={o.sens === 'achat' ? 'trade-hausse' : 'trade-baisse'}>{o.sens === 'achat' ? 'Achat' : 'Vente'}</span> {o.quantite} {symbole} à {deuxDecimales(o.prix)} <SymbolePiece />
              <button type="button" onClick={() => onAnnuler(o.id)}>
                Annuler
              </button>
            </span>
          ))}
        </div>
      )}
      {executes.length > 0 && (
        <div className="trade-liste">
          <span className="trade-etiquette">Derniers ordres exécutés</span>
          {executes.map((e) => (
            <span key={e.id} className="trade-ordre sourd">
              ✓ {e.sens === 'achat' ? 'Achat' : 'Vente'} {e.quantite} <SymboleRessource ressource={e.ressource} /> à {deuxDecimales(e.prix)} → {possede(e.montant)} <SymbolePiece />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** LES BOUGIES : vertes quand le prix a monté sur la période, rouges quand il a baissé ; le prix courant en pointillé d'or, les ordres en attente en pointillé de leur sens. */
function Graphique({ bougies, prix, ordres }: { bougies: Bougie[]; prix: number; ordres: Ordre[] }): ReactElement {
  const L = 320
  const H = 150
  const AXE = 40
  const vues = bougies.slice(-VUES)
  const valeurs = [prix, ...vues.flatMap((b) => [b.h, b.l]), ...ordres.map((o) => o.prix)]
  let bas = Math.min(...valeurs)
  let haut = Math.max(...valeurs)
  const marge = Math.max(0.02, (haut - bas) * 0.12)
  bas -= marge
  haut += marge
  const y = (v: number): number => 6 + (1 - (v - bas) / (haut - bas)) * (H - 12)
  const pas = (L - AXE) / VUES
  const x0 = L - AXE - vues.length * pas
  const graduations = [haut - marge, (haut + bas) / 2, bas + marge]
  return (
    <svg className="trade-graphique" viewBox={`0 0 ${L} ${H}`} aria-hidden>
      {graduations.map((v, k) => (
        <g key={k}>
          <line x1="0" y1={y(v)} x2={L - AXE} y2={y(v)} stroke="rgba(255,246,226,0.08)" strokeWidth="1" />
          <text x={L - AXE + 4} y={y(v) + 3} className="trade-graduation">
            {deuxDecimales(v)}
          </text>
        </g>
      ))}
      {vues.map((b, i) => {
        const x = x0 + i * pas + pas / 2
        const monte = b.c >= b.o
        const couleur = monte ? '#5fd38d' : '#ff6b7a'
        const haut1 = y(Math.max(b.o, b.c))
        const bas1 = y(Math.min(b.o, b.c))
        return (
          <g key={b.t}>
            <line x1={x} y1={y(b.h)} x2={x} y2={y(b.l)} stroke={couleur} strokeWidth="1" />
            <rect x={x - pas * 0.35} y={haut1} width={pas * 0.7} height={Math.max(1, bas1 - haut1)} fill={couleur} rx="0.5" />
          </g>
        )
      })}
      {ordres.map((o) => (
        <line key={o.id} x1="0" y1={y(o.prix)} x2={L - AXE} y2={y(o.prix)} stroke={o.sens === 'achat' ? '#5fd38d' : '#ff6b7a'} strokeWidth="1" strokeDasharray="2 3" />
      ))}
      <line x1="0" y1={y(prix)} x2={L - AXE} y2={y(prix)} stroke="var(--or)" strokeWidth="1" strokeDasharray="4 3" />
      <rect x={L - AXE + 1} y={y(prix) - 7} width={AXE - 2} height="14" rx="3" fill="var(--or)" />
      <text x={L - AXE + 4} y={y(prix) + 3.5} className="trade-graduation trade-graduation-prix">
        {deuxDecimales(prix)}
      </text>
    </svg>
  )
}
