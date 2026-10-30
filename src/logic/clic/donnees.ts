/**
 * LE SYSTÈME ABSTRAIT (Keko, 30/10/2026 : « on va créer d'abord un système
 * abstrait, on lui donnera un thème habillage APRÈS ») : une seule ressource R,
 * une seule monnaie (l'or), des unités sans aucune entrée qui produisent R par
 * seconde, un marché commun dont le prix baisse avec ce que tous ont vendu,
 * des paliers et des améliorations qui doublent, un prestige qui remet à zéro
 * contre un multiplicateur permanent. Les noms (A, B, C…) sont dans `ui/noms`.
 *
 * Les chiffres de ce fichier sont des valeurs de départ réglées par
 * `simulation/clic.ts`, pas des décisions de Keko.
 */

export const SAISON_H = 168

export interface Unite {
  id: string
  /** Le coût du premier exemplaire, en or. */
  cout: number
  /** Ce qu'un exemplaire produit, en R par seconde. */
  debit: number
}

/**
 * Huit unités : chacune coûte dix fois plus que la précédente et produit six à
 * huit fois plus. Les débits sont ceux de Cookie Clicker divisés par vingt :
 * mesuré sur une saison simulée (`node simulation/clic.ts`), c'est l'échelle
 * qui donne un ordre de grandeur par jour sur sept jours ; vingt fois plus
 * vite, tout l'arbre est épuisé le premier jour.
 */
export const UNITES: readonly Unite[] = [
  { id: 'a', cout: 10, debit: 0.005 },
  { id: 'b', cout: 100, debit: 0.05 },
  { id: 'c', cout: 1100, debit: 0.4 },
  { id: 'd', cout: 12000, debit: 2.35 },
  { id: 'e', cout: 130000, debit: 13 },
  { id: 'f', cout: 1.4e6, debit: 70 },
  { id: 'g', cout: 2e7, debit: 390 },
  { id: 'h', cout: 3.3e8, debit: 2200 },
]

/** Chaque exemplaire d'une unité coûte ce multiple du précédent. */
export const CROISSANCE = 1.15

/** À chacun de ces nombres d'exemplaires, l'unité double sa production. */
export const PALIERS: readonly number[] = [10, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

/**
 * LES AMÉLIORATIONS d'une unité : trois niveaux, chacun double l'unité ;
 * le niveau se débloque à `des` exemplaires et coûte `fois` le coût de base.
 */
export const AMELIORATIONS: readonly { des: number; fois: number }[] = [
  { des: 1, fois: 10 },
  { des: 10, fois: 100 },
  { des: 50, fois: 1000 },
]

/** La tape vaut cette part de la production par seconde, et au moins 1 R. */
export const TAPE_PART = 0.01
/** Au-delà de ce rythme, les tapes ne comptent plus (auto-clic). */
export const TAPES_MAX_PAR_S = 10

/**
 * LE MARCHÉ COMMUN : le prix d'un R vaut `prix × D / (D + V)`, où V est le
 * volume vendu récemment par tous (il fond de moitié toutes les `demiVie`
 * heures) et D la demande : ce que tous les joueurs produisent en `tampon`
 * heures, au moins `demandeMin`, suivi avec une inertie de `inertie` heures
 * (demi-écart). Vendre q d'un coup rapporte l'intégrale du prix de V à V + q :
 * un gros lot se vend moins cher que le même étalé.
 */
export const MARCHE = {
  prix: 1,
  demandeMin: 100,
  tampon: 3,
  demiVie: 2,
  inertie: 6,
}

/** Le comptoir automatique : il vend la production au fil de l'eau. */
export const AUTO_COUT = 2000

/**
 * LE PRESTIGE : remettre à zéro unités, améliorations, R et or contre des
 * points. Les points gagnés valent la racine de (R produit pendant le run /
 * `base`) ; chaque point ajoute `parPoint` au multiplicateur de production,
 * et la tape vaut ce multiplicateur. Mesuré : à 0,1 par point le prestige
 * coûtait plus qu'il ne rendait (deux jours de reconstruction pour ×2) ; à
 * 1 par point, le joueur médian prestige trois ou quatre fois dans la
 * semaine et garde son ordre de grandeur par jour. Base 10⁵ : les assidus
 * finissent dix mille fois devant les occasionnels ; 10⁶ : mille fois.
 */
export const PRESTIGE = {
  base: 1e6,
  parPoint: 1,
}
