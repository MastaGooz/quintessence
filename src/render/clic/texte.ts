/** L'effet d'un module en quelques signes : « 1/min », « +10 % », « ×1,1 », « 2 % » (deux valeurs pour un module mélangé) ; et un lot, avec ses décimales quand il est petit. */
import { effetsDe } from '../../logic/clic/moteur.ts'
import { abrege } from '../../ui/format.ts'

const fr = (v: number, decimales: number): string => v.toLocaleString('fr-FR', { maximumFractionDigits: decimales })

/** Un lot : « 1,32 », « 4,84 », « 58,1 », puis abrégé. Un lot est un taux, pas un avoir : il s'arrondit. */
export function abregeFin(n: number): string {
  if (n < 10) return fr(n, 2)
  if (n < 1000) return fr(n, 1)
  return abrege(n)
}

/** Une valeur d'effet d'une forme sur une cible : l'horloge en déclenchements, l'ajout en pour cent, le multiplicateur en ×, la chance en pour cent. */
function texteValeur(cible: number, forme: number, e: number): string {
  if (forme === 1 && cible === 2) return e >= 1 ? `${fr(e, 1)}/s` : `${fr(e * 60, e * 60 < 10 ? 1 : 0)}/min`
  if (forme === 1) return `+${fr(e * 100, 0)} %`
  if (forme === 2) return `×${fr(1 + e, e * 10 < 1 ? 2 : 1)}`
  return `${fr(e * 100, e < 0.1 ? 1 : 0)} %`
}

/** L'effet d'un module d'une couleur et d'une forme à une force donnée (le niveau d'un commun ; voir `force`) ; un mélangé en a deux. */
export function texteEffet(couleur: number, forme: number, f: number): string {
  return effetsDe({ couleur, forme }, f)
    .map(([cible, e]) => texteValeur(cible, forme, e))
    .join(' · ')
}

/** Un pourcentage de chance : « 78 % », « 0,5 % ». */
export function pourcent(p: number): string {
  return `${fr(p * 100, p * 100 < 10 ? 1 : 0)} %`
}

/** Une durée en heures, courte : « 30 min », « 2 h ». */
export function heures(h: number): string {
  return h < 1 ? `${Math.round(h * 60)} min` : `${fr(h, 1)} h`
}
