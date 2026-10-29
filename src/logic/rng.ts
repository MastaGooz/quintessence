/** mulberry32 : tout l'aléatoire du jeu passe par là, seedé, rejouable. */
export function rngDe(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Une graine dérivée de plusieurs entiers, pour tirer la même chose au même endroit. */
export function graineDe(...parts: number[]): number {
  let h = 2166136261
  for (const p of parts) {
    h ^= p >>> 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
