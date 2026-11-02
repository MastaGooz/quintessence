/**
 * LE MODE TEST DU MARCHÉ (`&ressources=10`, Keko, 02/11 : « tu peux faire un
 * test avec 10 ressources différentes ? juste pour voir l'UI ») : à côté du
 * bois et de la pierre, des ressources FICTIVES — jusqu'à huit —, dans la
 * liste du marché, leur écran de trade et l'en-tête. Leur cours est simulé
 * ici, hors du moteur : quelques sinusoïdes de phases tirées autour d'un prix
 * plein, de sorte qu'il bouge et dessine des bougies. Rien ne s'y échange, et
 * rien n'en va dans la sauvegarde.
 */
import type { ReactElement } from 'react'
import { MARCHE_RESSOURCES } from '../../logic/clic/donnees.ts'
import type { Bougie } from '../../logic/clic/moteur.ts'
import { graineDe, rngDe } from '../../logic/rng.ts'
import type { Cotation } from './MarcheRessources.tsx'

const FICTIVES: readonly { nom: string; plein: number }[] = [
  { nom: 'Blé', plein: 1.2 },
  { nom: 'Laine', plein: 3 },
  { nom: 'Fer', plein: 6 },
  { nom: 'Cuivre', plein: 4.5 },
  { nom: 'Charbon', plein: 2.5 },
  { nom: 'Argile', plein: 0.8 },
  { nom: 'Sel', plein: 1.6 },
  { nom: 'Cuir', plein: 5 },
]

/** Combien de ressources montrer en tout (`&ressources=N`), ou 0 hors du mode test. */
export function ressourcesDeTest(): number {
  const n = Number(new URLSearchParams(location.search).get('ressources'))
  return Number.isFinite(n) && n > 2 ? Math.min(2 + FICTIVES.length, Math.floor(n)) : 0
}

/** Les vagues de chaque fictive : amplitude, pulsation (par heure), phase — tirées une fois de la graine. */
const VAGUES = FICTIVES.map((_, k) => {
  const alea = rngDe(graineDe(777, k))
  return [0.07, 0.04, 0.025, 0.015].map((a, i) => ({ a: a * (0.6 + 0.8 * alea()), w: (0.4 + 2.5 * alea()) * (i + 1), phase: 2 * Math.PI * alea() }))
})

/** Le cours simulé de la fictive `k` à l'heure `t`. */
function cours(k: number, t: number): number {
  const plein = FICTIVES[k]?.plein ?? 1
  return plein * Math.exp((VAGUES[k] ?? []).reduce((s, v) => s + v.a * Math.sin(v.w * t + v.phase), 0))
}

/** Ses bougies jusqu'à l'heure `t` : ouverture, clôture, et le haut et le bas de quatre relevés entre. */
function bougies(k: number, t: number): Bougie[] {
  const b = MARCHE_RESSOURCES.bougie
  const fin = Math.floor(t / b)
  const out: Bougie[] = []
  for (let i = fin - MARCHE_RESSOURCES.bougies + 1; i <= fin; i++) {
    const debut = i * b
    const jusqua = i === fin ? t : (i + 1) * b
    const releves = [0, 0.25, 0.5, 0.75, 1].map((u) => cours(k, debut + (jusqua - debut) * u))
    out.push({ t: i, o: releves[0] ?? 0, c: releves[4] ?? 0, h: Math.max(...releves), l: Math.min(...releves) })
  }
  return out
}

/** Le symbole d'une fictive : un rond de sa couleur. */
function Symbole({ k, nom }: { k: number; nom: string }): ReactElement {
  return <span className={`symbole-ressource symbole-test symbole-test-${k}`} role="img" aria-label={nom} />
}

/** Les cotations fictives à l'heure `t` de la partie, pour `n` ressources en tout. */
export function cotationsDeTest(t: number, n: number): Cotation[] {
  return FICTIVES.slice(0, Math.max(0, n - 2)).map((f, k) => {
    const prix = cours(k, t)
    return {
      cle: `test-${k}`,
      nom: f.nom,
      symbole: <Symbole k={k} nom={f.nom} />,
      prix,
      plein: f.plein,
      bougies: bougies(k, t),
      stock: (k * 17 + 5) % 60,
      coutAchat: (q) => Math.max(1, Math.round(prix * q)),
      gainVente: (q) => Math.round(prix * q),
      achetable: (or) => Math.floor(or / prix),
      ressource: null,
    }
  })
}
