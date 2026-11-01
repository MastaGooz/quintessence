/**
 * LE SYSTÈME ABSTRAIT (Keko, 30/10/2026 : « on va créer d'abord un système
 * abstrait, on lui donnera un thème habillage APRÈS »), tel que Keko l'a
 * redessiné le 01/11 : des GÉNÉRATEURS, des MODULES, un MARCHÉ.
 *
 * QUATRE SORTES DE MATIÈRE, une par forme de prise. Au départ, le joueur en
 * choisit une : il reçoit la source de cette sorte, la seule qu'il saura
 * jamais produire. Les SOURCES produisent la matière du joueur à chaque
 * déclenchement (une tape, ou le tic d'une horloge). Les ATELIERS consomment
 * une quantité de matière d'une sorte et rendent un MODULE de la forme de
 * cette sorte, de rareté tirée (Keko : « des générateurs transformateurs qui
 * changent les ressources en modules »). Les modules s'emboîtent sur les
 * générateurs et agissent sur eux. La matière des autres sortes s'achète au
 * MARCHÉ, commun à tous les joueurs, un prix par sorte ; on y vend son surplus.
 * L'or est la seule monnaie.
 *
 * LES PRODUCTEURS ET LEURS MODULES (Keko, 31/10) : « les producteurs génèrent
 * des ressources, comme celui où on tape, avec des prises femelles, et les
 * modules, de différentes formes de prises mâles » ; « les modules agissent sur
 * le producteur : en l'automatisant, en l'augmentant, en convertissant… ».
 * Quatre formes, quatre effets : l'horloge (rond) déclenche toute seule,
 * l'ajout (carré) grossit le lot, le multiplicateur (triangle) le multiplie,
 * le critique (trapèze) donne une chance qu'il soit décuplé. Sur un atelier,
 * le lot est le nombre de modules d'une fournée, et le critique monte la
 * rareté d'un cran. Le niveau se prend sur le module.
 *
 * Les chiffres de ce fichier sont des valeurs de départ réglées par
 * `simulation/clic.ts`, pas des décisions de Keko.
 */

export const SAISON_H = 168

/** Les quatre formes, qui sont aussi les quatre sortes de matière : 0 rond (horloge), 1 carré (ajout), 2 triangle (multiplicateur), 3 trapèze (critique). */
export const FORMES = 4
const R = 0
const C = 1
const T = 2
const Z = 3
const _ = null

/** UN TYPE DE GÉNÉRATEUR : ce qu'il fait à chaque déclenchement, et les creux qu'il offre. */
export interface TypeProducteur {
  id: string
  /** Source : produit de la matière. Atelier : transforme de la matière en modules. */
  genre: 'source' | 'atelier'
  /** Le coût du premier exemplaire, en or (la base est offerte). */
  cout: number
  /** Source : le lot de matière d'un déclenchement, avant les modules. Atelier : le nombre de modules d'une fournée (un). */
  lot: number
  /** Atelier : la matière qu'une fournée consomme au moins. */
  entree: number
  /** Atelier : une fournée consomme au moins ce temps de production du joueur (en heures, par ses horloges). */
  duree: number
  /** Atelier : les chances de chaque rareté d'un module qui en sort (elles se normalisent). */
  chances: readonly number[]
  /** La forme du creux de chaque emplacement (voir `EMPLACEMENTS`), ou null quand le bord est plein. */
  creux: readonly (number | null)[]
}

/**
 * LES SOURCES : la base, offerte, puis huit qui coûtent quinze fois plus que
 * la précédente pour un lot quatre fois plus gros — et des creux de plus en
 * plus nombreux. Mesuré (`node simulation/clic.ts`) : à dix fois le coût pour
 * cinq fois le lot, l'échelle entière était épuisée le deuxième jour ; à
 * quinze pour quatre, la semaine reste une montée. Les profils sont de moi :
 * chacun manque de quelque chose, pour que le choix du générateur compte.
 * Emplacements : haut (gauche, centre, droite), droite, bas (droite, centre,
 * gauche), gauche.
 */
export const SOURCES: readonly TypeProducteur[] = [
  { id: 'base', genre: 'source', cout: 0, lot: 1, entree: 0, duree: 0, chances: [], creux: [_, R, _, C, _, T, _, Z] },
  { id: 'a', genre: 'source', cout: 100, lot: 4, entree: 0, duree: 0, chances: [], creux: [R, _, C, _, T, _, _, _] },
  { id: 'b', genre: 'source', cout: 1500, lot: 16, entree: 0, duree: 0, chances: [], creux: [R, _, R, C, _, T, _, _] },
  { id: 'c', genre: 'source', cout: 22500, lot: 64, entree: 0, duree: 0, chances: [], creux: [_, R, _, C, T, _, T, Z] },
  { id: 'd', genre: 'source', cout: 337500, lot: 256, entree: 0, duree: 0, chances: [], creux: [R, _, Z, T, _, Z, _, T] },
  { id: 'e', genre: 'source', cout: 5.0625e6, lot: 1024, entree: 0, duree: 0, chances: [], creux: [R, C, R, T, _, Z, _, T] },
  { id: 'f', genre: 'source', cout: 7.59375e7, lot: 4096, entree: 0, duree: 0, chances: [], creux: [R, _, C, C, T, _, Z, C] },
  { id: 'g', genre: 'source', cout: 1.1390625e9, lot: 16384, entree: 0, duree: 0, chances: [], creux: [R, R, Z, T, C, _, Z, T] },
  { id: 'h', genre: 'source', cout: 1.70859375e10, lot: 65536, entree: 0, duree: 0, chances: [], creux: [R, C, R, T, Z, T, Z, C] },
]

/**
 * LES ATELIERS : quatre modèles. Le plus petit est bon marché et sort des
 * communs sans faute : personne n'est bloqué. Les plus gros tirent mieux, et
 * chaque fournée leur demande plus de temps de production. UNE FOURNÉE COÛTE
 * UN TEMPS DE PRODUCTION (`duree`, en heures de ce que les horloges du joueur
 * produisent), au moins `entree` : le flux de modules reste de quelques-uns par
 * heure et par atelier quelle que soit l'échelle, et taper paie des fournées
 * de plus. Mesuré : à quantité fixe, un atelier à horloges sortait des milliers
 * de modules par jour ; à prix qui montait à chaque fournée, les bots gardaient
 * toute leur matière en réserve et la saison restait à zéro. Les chances sont
 * par rareté : commune, peu commune, rare, épique, légendaire.
 */
export const ATELIERS: readonly TypeProducteur[] = [
  { id: 't1', genre: 'atelier', cout: 40, lot: 1, entree: 10, duree: 0.5, chances: [78, 18, 4, 0, 0], creux: [_, R, _, _, _, C, _, _] },
  { id: 't2', genre: 'atelier', cout: 3000, lot: 1, entree: 300, duree: 1, chances: [55, 30, 12, 3, 0], creux: [R, _, R, C, _, T, _, _] },
  { id: 't3', genre: 'atelier', cout: 150000, lot: 1, entree: 3000, duree: 2, chances: [35, 35, 20, 8, 2], creux: [R, C, R, T, _, Z, _, T] },
  { id: 't4', genre: 'atelier', cout: 7.5e6, lot: 1, entree: 30000, duree: 4, chances: [20, 32, 28, 15, 5], creux: [R, C, R, T, Z, T, Z, C] },
]

/** Tous les types de générateurs : les sources d'abord (la base en 0), les ateliers ensuite. `type` d'un producteur est un indice ici. */
export const PRODUCTEURS: readonly TypeProducteur[] = [...SOURCES, ...ATELIERS]
/** L'indice du premier atelier dans `PRODUCTEURS`. */
export const PREMIER_ATELIER = SOURCES.length

/** UN TYPE DE MODULE : sa forme est son indice (0 rond … 3 trapèze). `valeur` : ce que vaut un commun, dont les niveaux découlent. */
export interface TypeModule {
  id: string
  valeur: number
}

export const MODULES: readonly TypeModule[] = [
  { id: 'horloge', valeur: 10 },
  { id: 'ajout', valeur: 25 },
  { id: 'multiplicateur', valeur: 50 },
  { id: 'critique', valeur: 40 },
]

/**
 * LES RARETÉS d'un module : l'effet d'un module de rareté r vaut `effet[r]`
 * fois celui d'un commun du même niveau ; sa valeur (dont ses niveaux
 * découlent) `valeur[r]` fois. Garantie : au plus `sansRare` fournées sans un
 * rare, `sansEpique` sans un épique (le légendaire ne se force jamais).
 */
export const RARETES = {
  noms: ['commune', 'peu commune', 'rare', 'épique', 'légendaire'],
  effet: [1, 1.5, 2.5, 4, 7],
  valeur: [1, 2, 4, 8, 16],
  sansRare: 8,
  sansEpique: 40,
}

/**
 * LES TRAITS : à partir de peu commune, un module en a un, tiré. `voisin` :
 * les modules voisins (les emplacements d'à côté) ont leur effet multiplié par
 * `voisin`. `solide` : son effet est multiplié par `solide`. `econome` : ses
 * niveaux coûtent `econome` fois le prix. `rapide` (horloge seule) : sa
 * fréquence est multipliée par `rapide`.
 */
export const TRAITS = {
  noms: ['voisin', 'solide', 'econome', 'rapide'] as const,
  voisin: 1.25,
  solide: 1.4,
  econome: 0.5,
  rapide: 1.5,
}
export type Trait = (typeof TRAITS.noms)[number]

/**
 * LES EFFETS, au niveau 1 ; le niveau L les multiplie par L. L'horloge
 * déclenche le producteur toutes les `periode` secondes. L'ajout ajoute
 * `ajout` fois le lot de base du producteur. Le multiplicateur multiplie le lot
 * par 1 + `multiplicateur`. Le critique donne une chance `critique` (composée
 * niveau par niveau : 1 − (1 − c)^L) que le lot soit multiplié par `coup`
 * (sur un atelier : que la rareté monte d'un cran). Mesuré : à 0,25 par
 * niveau, quatre modules sur la base donnaient ×16 pour cent or et la semaine
 * finissait en 10²⁵ ; à 0,1, ×1,4, et la montée tient sept jours.
 */
export const EFFETS = {
  periode: 60,
  ajout: 0.1,
  multiplicateur: 0.1,
  critique: 0.02,
  coup: 10,
}

/**
 * UN GÉNÉRATEUR DE PLUS coûte ce multiple du précédent DU MÊME TYPE. Haut
 * exprès : la progression passe par les niveaux (Keko, 30/10 : « plutôt que
 * rajouter des modules, cliquer sur les modules existants et les améliorer
 * individuellement »), et on ne veut pas des foules de pièces.
 */
export const ACHAT = { croissance: 2.5 }

/**
 * LES NIVEAUX d'un module : le niveau L multiplie son effet par L ; passer du
 * niveau L au suivant coûte `premier` fois la valeur du module, fois
 * `croissance` par niveau déjà pris. Mesuré : à moins de ×2,5 par niveau, les
 * niveaux restaient la meilleure dépense jusqu'à la fin.
 */
export const NIVEAU = {
  premier: 10,
  croissance: 2.5,
}

/** LA FUSION : tant de modules de même forme et même rareté font un module de la rareté au-dessus. */
export const FUSION = 3

/** Au-delà de ce rythme, les tapes ne comptent plus (auto-clic). */
export const TAPES_MAX_PAR_S = 10

/**
 * LE MARCHÉ, commun à tous les joueurs, un prix par sorte. Le prix d'une sorte
 * vaut `prix × exp(−V / D)` : V le volume NET vendu récemment par tous (les
 * ventes l'augmentent, les achats le baissent ; il fond de moitié toutes les
 * `demiVie` heures) et D la demande : ce que tous les joueurs produisent de
 * cette sorte en `tampon` heures, au moins `demandeMin`, suivi avec une
 * inertie de `inertie` heures. Vendre q d'un coup rapporte l'intégrale du prix
 * de V à V + q : un gros lot se vend moins cher que le même étalé ; acheter q
 * coûte l'intégrale de V − q à V. Une sorte que personne ne produit a une
 * demande minuscule : son prix s'envole dès qu'on l'achète. V est borné à
 * ±`bornes` fois D.
 */
export const MARCHE = {
  prix: 1,
  demandeMin: 200,
  tampon: 12,
  demiVie: 2,
  inertie: 6,
  bornes: 3,
}

/**
 * LE PRESTIGE : remettre à zéro générateurs, modules, matière et or contre des
 * points. Les points gagnés valent la racine de (matière produite pendant la
 * partie / `base`) ; chaque point ajoute `parPoint` au multiplicateur des
 * lots. On rechoisit sa sorte en repartant. Mesuré : cette économie monte de
 * ×3 par jour (médiane 2 M la semaine, le meilleur 100 M) ; à 10⁸ personne ne
 * repartait, à 10⁶ le médian repart une ou deux fois.
 */
export const PRESTIGE = {
  base: 1e6,
  parPoint: 1,
}

/**
 * LA GÉOMÉTRIE. Le monde est un plan en pixels-monde, en cases d'une taille ;
 * la case (0, 0) est centrée sur l'origine. Un producteur est un rectangle de
 * trois cases sur une, posé sur des cases entières ; un module, une pièce
 * d'une case de large qui s'emboîte sur son bord, sa bosse vers lui. La bosse
 * et le creux : leur largeur le long du bord, et ce qu'ils dépassent ou
 * s'enfoncent.
 */
export const PIECE = {
  taille: 150,
  encoche: { largeur: 56, profondeur: 30 },
}
export const CASE = PIECE.taille
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
