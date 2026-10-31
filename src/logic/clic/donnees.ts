/**
 * LE SYSTÈME ABSTRAIT (Keko, 30/10/2026 : « on va créer d'abord un système
 * abstrait, on lui donnera un thème habillage APRÈS ») : une seule ressource R,
 * une seule monnaie (l'or), un marché commun dont le prix baisse avec ce que
 * tous ont vendu, un prestige qui remet à zéro contre un multiplicateur
 * permanent. Les noms (A, B, C…) sont dans `ui/noms-clic`.
 *
 * LES PRODUCTEURS ET LEURS MODULES (Keko, 31/10) : « les producteurs génèrent
 * des ressources, comme celui où on tape, avec des prises femelles, et les
 * modules, de différentes formes de prises mâles » ; « les modules agissent sur
 * le producteur : en l'automatisant, en l'augmentant, en convertissant… ». Un
 * producteur produit un LOT de R à chaque déclenchement ; une tape le
 * déclenche. Un module est une pièce à une seule bosse, qui s'emboîte dans un
 * creux de sa forme sur un producteur, et agit sur lui. Quatre formes, quatre
 * effets : l'horloge (rond) le déclenche toute seule, l'ajout (carré) grossit
 * le lot, le multiplicateur (triangle) le multiplie, le critique (trapèze)
 * donne une chance qu'il soit décuplé. Le niveau se prend sur le module.
 *
 * Les chiffres de ce fichier sont des valeurs de départ réglées par
 * `simulation/clic.ts`, pas des décisions de Keko.
 */

export const SAISON_H = 168

/** UN TYPE DE PRODUCTEUR : ce qu'il produit à chaque déclenchement, et les creux qu'il offre. */
export interface TypeProducteur {
  id: string
  /** Le coût du premier exemplaire, en or (la base est offerte). */
  cout: number
  /** Le lot : ce que produit un déclenchement, en R, avant les modules. */
  lot: number
  /** La forme du creux de chaque emplacement (voir `EMPLACEMENTS`), ou null quand le bord est plein. */
  creux: readonly (number | null)[]
}

/** Les quatre formes : 0 rond (horloge), 1 carré (ajout), 2 triangle (multiplicateur), 3 trapèze (critique). */
export const FORMES = 4
const R = 0
const C = 1
const T = 2
const Z = 3
const _ = null

/**
 * Neuf producteurs : la base, offerte, puis huit qui coûtent quinze fois plus
 * que le précédent pour un lot quatre fois plus gros — et des creux de plus
 * en plus nombreux. Mesuré (`node simulation/clic.ts`) : à dix fois le coût
 * pour cinq fois le lot, l'échelle entière était épuisée le deuxième jour et
 * tous les bots finissaient au même point ; à quinze pour quatre, la semaine
 * reste une montée (×70, ×30, ×7, ×4 par jour) et les assidus finissent dix à
 * cinquante fois devant les occasionnels. Les profils sont de moi : chacun
 * manque de quelque chose, pour que le choix du producteur compte.
 * Emplacements : haut (gauche, centre, droite), droite, bas (droite, centre,
 * gauche), gauche.
 */
export const PRODUCTEURS: readonly TypeProducteur[] = [
  { id: 'base', cout: 0, lot: 1, creux: [_, R, _, C, _, T, _, Z] },
  { id: 'a', cout: 100, lot: 4, creux: [R, _, C, _, T, _, _, _] },
  { id: 'b', cout: 1500, lot: 16, creux: [R, _, R, C, _, T, _, _] },
  { id: 'c', cout: 22500, lot: 64, creux: [_, R, _, C, T, _, T, Z] },
  { id: 'd', cout: 337500, lot: 256, creux: [R, _, Z, T, _, Z, _, T] },
  { id: 'e', cout: 5.0625e6, lot: 1024, creux: [R, C, R, T, _, Z, _, T] },
  { id: 'f', cout: 7.59375e7, lot: 4096, creux: [R, _, C, C, T, _, Z, C] },
  { id: 'g', cout: 1.1390625e9, lot: 16384, creux: [R, R, Z, T, C, _, Z, T] },
  { id: 'h', cout: 1.70859375e10, lot: 65536, creux: [R, C, R, T, Z, T, Z, C] },
]

/** UN TYPE DE MODULE : sa forme est son indice (0 rond … 3 trapèze). */
export interface TypeModule {
  id: string
  /** Le coût du premier exemplaire, en or. */
  cout: number
}

export const MODULES: readonly TypeModule[] = [
  { id: 'horloge', cout: 10 },
  { id: 'ajout', cout: 25 },
  { id: 'multiplicateur', cout: 50 },
  { id: 'critique', cout: 40 },
]

/**
 * LES EFFETS, au niveau 1 ; le niveau L les multiplie par L. L'horloge
 * déclenche le producteur toutes les `periode` secondes. L'ajout ajoute
 * `ajout` fois le lot de base du producteur. Le multiplicateur multiplie le lot
 * par 1 + `multiplicateur`. Le critique donne une chance `critique` (composée
 * niveau par niveau : 1 − (1 − c)^L) que le lot soit multiplié par `coup`.
 * Mesuré : à 0,25 par niveau, quatre modules sur la base donnaient ×16 pour
 * cent or et la semaine finissait en 10²⁵ ; à 0,1, ×1,4, et la montée tient
 * sept jours.
 */
export const EFFETS = {
  periode: 60,
  ajout: 0.1,
  multiplicateur: 0.1,
  critique: 0.02,
  coup: 10,
}

/**
 * UNE PIÈCE DE PLUS (producteur ou module) coûte ce multiple du précédent DU
 * MÊME TYPE. Haut exprès : la progression passe par les niveaux (Keko, 30/10 :
 * « plutôt que rajouter des modules, cliquer sur les modules existants et les
 * améliorer individuellement »), et on ne veut pas des foules de pièces.
 */
export const ACHAT = { croissance: 2.5 }

/**
 * LES NIVEAUX d'un module : le niveau L multiplie son effet par L ; passer du
 * niveau L au suivant coûte `premier` fois le prix payé pour le module, fois
 * `croissance` par niveau déjà pris. Mesuré : le doublement tous les dix
 * niveaux de la version d'avant, multiplié sur les huit modules d'un
 * producteur, battait n'importe quelle croissance du coût (niveaux 70 et
 * totaux en 10²⁵ en une semaine) — il est parti ; et à moins de ×2,5 par
 * niveau, les niveaux restaient la meilleure dépense jusqu'à la fin.
 */
export const NIVEAU = {
  premier: 10,
  croissance: 2.5,
}

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
 * LE PRESTIGE : remettre à zéro producteurs, modules, R et or contre des
 * points. Les points gagnés valent la racine de (R produit pendant le run /
 * `base`) ; chaque point ajoute `parPoint` au multiplicateur des lots. Mesuré
 * à 10⁸ : le joueur médian prestige deux ou trois fois dans la semaine pour
 * trois à dix points ; à 10⁶, l'assidu finissait avec deux cents points et
 * mille fois devant tout le monde.
 */
export const PRESTIGE = {
  base: 1e8,
  parPoint: 1,
}

/**
 * LA GÉOMÉTRIE. Le monde est un plan en pixels-monde, en cases d'une taille.
 * Un producteur est un rectangle de trois cases sur une ; un module, une
 * pièce d'une case de large qui s'emboîte sur son bord, sa bosse vers lui. La
 * bosse et le creux : leur largeur le long du bord, et ce qu'ils dépassent ou
 * s'enfoncent.
 */
export const PIECE = {
  taille: 150,
  encoche: { largeur: 56, profondeur: 30 },
}
export const PRODUCTEUR = { largeur: 450, hauteur: 150 }
export const MODULE = { largeur: 150, profondeur: 100 }

/**
 * Les huit emplacements d'un producteur, dans le sens des aiguilles : le côté
 * (0 haut, 1 droite, 2 bas, 3 gauche) et le décalage le long du côté, en
 * cases, depuis son milieu (vers la droite ou vers le bas).
 */
export const EMPLACEMENTS: readonly { cote: number; decalage: number }[] = [
  { cote: 0, decalage: -1 },
  { cote: 0, decalage: 0 },
  { cote: 0, decalage: 1 },
  { cote: 1, decalage: 0 },
  { cote: 2, decalage: 1 },
  { cote: 2, decalage: 0 },
  { cote: 2, decalage: -1 },
  { cote: 3, decalage: 0 },
]
