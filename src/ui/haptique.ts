/** La vibration du téléphone, quand il sait vibrer (Android) ; jamais une erreur ailleurs. */
export function vibrer(motif: number | number[]): void {
  try {
    navigator.vibrate?.(motif)
  } catch {
    // Pas de vibreur : rien.
  }
}
