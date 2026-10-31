/** L'effet d'un module en quelques signes : « 1/min », « +10 % », « ×1,1 », « 2 % » ; et un lot, avec ses décimales quand il est petit. */
import { effet } from '../../logic/clic/moteur.ts'
import { abrege } from '../../ui/format.ts'

const fr = (v: number, decimales: number): string => v.toLocaleString('fr-FR', { maximumFractionDigits: decimales })

/** Un lot : « 1,32 », « 4,84 », « 58,1 », puis abrégé. Un lot est un taux, pas un avoir : il s'arrondit. */
export function abregeFin(n: number): string {
  if (n < 10) return fr(n, 2)
  if (n < 1000) return fr(n, 1)
  return abrege(n)
}

export function texteEffet(type: number, niveau: number): string {
  const e = effet(type, niveau)
  switch (type) {
    case 0:
      return e >= 1 ? `${fr(e, 1)}/s` : `${fr(e * 60, e * 60 < 10 ? 1 : 0)}/min`
    case 1:
      return `+${fr(e * 100, 0)} %`
    case 2:
      return `×${fr(1 + e, e * 10 < 1 ? 2 : 1)}`
    default:
      return `${fr(e * 100, e < 0.1 ? 1 : 0)} %`
  }
}
