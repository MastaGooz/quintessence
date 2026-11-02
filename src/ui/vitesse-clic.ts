/** Le rythme du monde : `?vitesse=60`, une minute réelle vaut une heure de jeu. La table s'en sert pour avancer le monde, la réserve pour dire en temps réel quand tombe la pièce suivante. */
export function vitesseDemandee(): number {
  const v = Number(new URLSearchParams(location.search).get('vitesse') ?? '1')
  return Number.isFinite(v) && v > 0 ? v : 1
}
