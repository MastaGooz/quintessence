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

/**
 * UN MODULE DE PLUS coûte ce multiple du précédent DU MÊME TYPE. Haut
 * exprès : la progression passe par les niveaux (Keko, 30/10 : « plutôt que
 * rajouter des modules, on pourrait cliquer sur les modules existants et les
 * améliorer individuellement »), et on ne veut pas des foules de pièces.
 */
export const ACHAT = { croissance: 2.5 }

/**
 * LES NIVEAUX d'un module : le niveau L multiplie son débit par L, et par 2
 * tous les `palier` niveaux ; passer du niveau L au suivant coûte
 * `premier` fois le coût de base du type, fois `croissance` par niveau déjà
 * pris. Chiffres réglés par `simulation/clic.ts`.
 */
export const NIVEAU = {
  premier: 0.6,
  croissance: 1.2,
  palier: 10,
}

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

/**
 * LE PUZZLE (Keko, 30/10 : « une forme rectangulaire, avec un slot sur chaque
 * côté, et chaque côté aurait une forme de puzzle qui pourrait matcher
 * certains types de pièce », puis « enchaînement tout de suite, deux types par
 * forme »). Le monde est un plan en pixels-monde. La base est un rectangle de
 * trois cases sur une, creusé d'une forme sur chaque côté. Un module est une
 * case carrée : sa bosse (la forme de son type, `type % FORMES` : A et E sont
 * ronds, B et F carrés, C et G triangles, D et H trapèzes) s'emboîte dans un
 * creux de la même forme, de la base ou d'un autre module ; ses trois autres
 * côtés sont des creux (`PROFILS`), où d'autres modules s'emboîtent à leur
 * tour. Les modules s'enchaînent donc en arbre depuis la base, et seuls ceux
 * qui lui sont reliés produisent. Tout est en cases d'une taille : les côtés
 * de la base sont des multiples impairs de la case, pour que tout s'aligne.
 */
export const FORMES = 4
export const PIECE = {
  taille: 150,
  /** La bosse et le creux : leur largeur le long du bord, et ce qu'ils dépassent ou s'enfoncent. */
  encoche: { largeur: 56, profondeur: 30 },
}
export const BASE = {
  largeur: 450,
  hauteur: 150,
  /** La forme creusée sur chaque côté : haut, droite, bas, gauche. */
  formes: [0, 1, 2, 3] as readonly number[],
}
/**
 * Les creux d'un module, par côté local quand sa bosse est en bas : [face,
 * droite, gauche]. Chaque module ouvre les trois autres formes que la sienne ;
 * les deux types d'une même forme les ouvrent en miroir, pour qu'échanger
 * l'un contre l'autre change la géométrie. De moi, à rejuger.
 */
export const PROFILS: readonly (readonly [number, number, number])[] = [
  [2, 3, 1], // A, rond : en face un triangle, à droite un trapèze, à gauche un carré
  [3, 0, 2], // B, carré
  [0, 1, 3], // C, triangle
  [1, 2, 0], // D, trapèze
  [2, 1, 3], // E, rond : le miroir de A
  [3, 2, 0], // F, carré
  [0, 3, 1], // G, triangle
  [1, 0, 2], // H, trapèze
]
