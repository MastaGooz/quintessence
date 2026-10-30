/** Les nombres et les durées, à la française. */

export function nombre(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

/**
 * Ce qu'on POSSÈDE s'affiche TRONQUÉ, jamais arrondi au-dessus : l'or et les
 * stocks sont fractionnaires (une vente rapporte 219,6 or), et un « 100 »
 * affiché pour 99,6 faisait refuser un coût de 100 — Keko : « il faut toujours
 * 1 de plus que le coût indiqué, mais ce 1 n'est pas consommé ». Le compteur
 * ne promet que ce qu'on peut dépenser. (L'epsilon absorbe 99,999999…)
 */
export function possede(n: number): string {
  return Math.floor(n + 1e-9).toLocaleString('fr-FR')
}

/** Un nombre avec une décimale quand il est petit : « 0,5 », « 12 ». */
export function nombreFin(n: number): string {
  const v = Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n)
  // `Math.round(-0.5)` rend −0, qui s'écrirait « -0 » : −0,05 par heure s'affichait « −0/h ».
  return (v === 0 ? 0 : v).toLocaleString('fr-FR')
}

/** Un débit par heure : ce qui s'écrirait « 0 » est tenu pour nul, signe compris. */
export function debitVisible(n: number): number {
  return Math.abs(n) < 0.05 ? 0 : n
}

/** « 3 h 15 », « 45 min », « 2 j 4 h ». */
export function duree(h: number): string {
  if (h < 1 / 60) return 'maintenant'
  if (h < 1) return `${Math.ceil(h * 60)} min`
  if (h < 24) {
    const heures = Math.floor(h)
    const minutes = Math.round((h - heures) * 60)
    return minutes === 0 ? `${heures} h` : `${heures} h ${String(minutes).padStart(2, '0')}`
  }
  const heures = Math.round(h)
  const jours = Math.floor(heures / 24)
  const reste = heures - jours * 24
  return reste === 0 ? `${jours} j` : `${jours} j ${reste} h`
}

/** L'heure du jeu : « Jour 2 · 14 h 30 », la saison commençant un matin à 8 h. */
export function horloge(t: number): string {
  const jour = Math.floor((t + 8) / 24) + 1
  const h = (t % 24) + 8
  const heures = Math.floor(h) % 24
  const minutes = Math.floor((h - Math.floor(h)) * 60)
  return `Jour ${jour} · ${heures} h ${String(minutes).padStart(2, '0')}`
}
