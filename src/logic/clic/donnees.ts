/**
 * LE SYSTÈME ABSTRAIT (Keko, 30/10/2026 : « on va créer d'abord un système
 * abstrait, on lui donnera un thème habillage APRÈS »), redessiné par Keko le
 * 01/11 : des COULEURS et des FORMES.
 *
 * TROIS COULEURS DE BASE, rouge, vert, bleu, SANS FORME (rondes) : ce sont les
 * matières brutes, et chaque joueur a ses trois sources dès le départ (Keko :
 * « au début on permet de poser les 3 générateurs de couleur ; la
 * spécialisation viendra dans l'amélioration : j'investis dans le rouge pour
 * augmenter sa prod »). Les RAFFINERIES donnent une forme à une matière ronde
 * (carré, triangle, losange) ; les MÉLANGEURS mélangent deux rondes en une
 * troisième couleur (rouge + bleu = violet : le système RGB). Les MODULES se
 * FABRIQUENT dans la boutique, comme le reste, avec la matière formée de leur
 * couleur et de leur forme, puis se placent (Keko : « les générateurs et les
 * transformateurs consomment ces ressources pour être fabriqués, les modules
 * aussi » ; « les générateurs/transformateurs ne peuvent pas produire de
 * modules, on doit les fabriquer comme le reste puis les placer ») ; leur
 * rareté est tirée à la fabrication. Les générateurs, les transformateurs et
 * les niveaux des modules se PAIENT EN MATIÈRE. Le MARCHÉ, commun à tous, cote
 * les vingt-quatre sortes (Keko : « le
 * marché échange tout, ainsi un joueur peut se spécialiser dans un type de
 * forme ou de couleur ») ; l'or ne sert qu'à y échanger.
 *
 * CHAQUE COULEUR DIT LA CIBLE, CHAQUE FORME DIT L'OPÉRATION (Keko : « chaque
 * couleur et chaque forme donne une combinaison d'effets uniques, ex. rouge =
 * crit + triangle = boost brut pourrait donner des chances de super
 * critique ») : le rouge touche la TAPE (ce qu'un coup de doigt rapporte), le
 * vert le LOT (ce que tout déclenchement rapporte), le bleu le TEMPS (les
 * déclenchements automatiques). Le carré AJOUTE, le triangle MULTIPLIE, le
 * losange DONNE UNE CHANCE. Le carré bleu est l'horloge ; le losange rouge, le
 * critique ; le triangle rouge multiplie la tape, critique comprise : le
 * super-critique. Un module d'une couleur mélangée porte les deux effets de ses
 * couleurs, chacun à une part de sa force.
 *
 * Les chiffres de ce fichier sont des valeurs de départ réglées par
 * `simulation/clic.ts`, pas des décisions de Keko.
 */

export const SAISON_H = 168

/** Les trois couleurs de base (0 rouge, 1 vert, 2 bleu), puis les trois mélanges (3 jaune, 4 cyan, 5 violet). */
export const PRIMAIRES = 3
export const COULEURS = 6
/** Les quatre formes : 0 rond (la matière brute, pas de module), 1 carré (ajoute), 2 triangle (multiplie), 3 losange (donne une chance). */
export const FORMES = 4
/** Une sorte de matière : une couleur et une forme. */
export const SORTES = COULEURS * FORMES

export const sorteDe = (couleur: number, forme: number): number => couleur * FORMES + forme
export const couleurDe = (sorte: number): number => Math.floor(sorte / FORMES)
export const formeDe = (sorte: number): number => sorte % FORMES

/**
 * LES MÉLANGES : la couleur 3 + k est faite de `composants[k]`. Un module d'une
 * couleur mélangée agit sur les deux cibles de ses couleurs, chacune à `part`
 * de sa force : deux effets pour une prise, un peu moins forts chacun.
 */
export const MELANGE = {
  composants: [
    [0, 1],
    [1, 2],
    [0, 2],
  ] as readonly (readonly [number, number])[],
  part: 0.7,
}

/** Les cibles de chaque couleur de base, et leur part : [cible, part]. */
export function partsDe(couleur: number): readonly (readonly [number, number])[] {
  if (couleur < PRIMAIRES) return [[couleur, 1]]
  const c = MELANGE.composants[couleur - PRIMAIRES] ?? [0, 1]
  return [
    [c[0], MELANGE.part],
    [c[1], MELANGE.part],
  ]
}

/** Un module « a du bleu » quand une de ses cibles est le temps : le trait « rapide » n'agit que sur lui. */
export function aDuBleu(couleur: number): boolean {
  return partsDe(couleur).some(([c]) => c === 2)
}

const C = 1
const T = 2
const L = 3
const _ = null

/** Ce que coûte quelque chose : tant de matière d'une forme (null : n'importe quelle forme sauf ronde) et d'une couleur (null : celle qu'on veut, la plus abondante). */
export interface Cout {
  forme: number | null
  couleur: number | null
  quantite: number
}

export const GENRES = ['source', 'raffinerie', 'melangeur'] as const
export type Genre = (typeof GENRES)[number]

/** UN TYPE DE GÉNÉRATEUR : ce qu'il fait à chaque déclenchement, ce qu'il coûte, et les creux qu'il offre. */
export interface TypeProducteur {
  id: string
  /** Source : produit une matière ronde. Raffinerie : donne une forme à une ronde. Mélangeur : deux rondes de base font une ronde mélangée. */
  genre: Genre
  /** Le coût du premier exemplaire (les trois sources de départ sont offertes). Pour une source, la couleur est celle qu'on achète. */
  cout: Cout
  /** Source : la matière d'un déclenchement, avant les modules. Raffinerie, mélangeur : la matière convertie par déclenchement. */
  lot: number
  /** La forme du creux de chaque emplacement (voir `EMPLACEMENTS`), ou null quand le bord est plein. Un creux prend n'importe quelle couleur de sa forme. */
  creux: readonly (number | null)[]
}

/**
 * LES SOURCES : la première, offerte en trois couleurs, puis des modèles qui
 * coûtent quinze fois plus que le précédent pour un lot quatre fois plus gros
 * (mesuré au proto précédent : à dix fois pour cinq, l'échelle était épuisée
 * le deuxième jour). Une source s'achète dans une couleur de base et se paie
 * en rondes de cette couleur : c'est là qu'on investit dans sa couleur. Elle
 * se monte aussi de niveau (voir `NIVEAU_SOURCE`). Emplacements : haut
 * (gauche, centre, droite), droite, bas (droite, centre, gauche), gauche.
 */
export const SOURCES: readonly TypeProducteur[] = [
  { id: 's0', genre: 'source', cout: { forme: 0, couleur: null, quantite: 0 }, lot: 1, creux: [_, C, _, T, _, C, _, L] },
  { id: 's1', genre: 'source', cout: { forme: 0, couleur: null, quantite: 40 }, lot: 4, creux: [C, _, C, _, T, _, _, _] },
  { id: 's2', genre: 'source', cout: { forme: 0, couleur: null, quantite: 600 }, lot: 16, creux: [C, _, C, T, _, T, _, _] },
  { id: 's3', genre: 'source', cout: { forme: 0, couleur: null, quantite: 9000 }, lot: 64, creux: [_, C, _, T, C, _, T, L] },
  { id: 's4', genre: 'source', cout: { forme: 0, couleur: null, quantite: 135000 }, lot: 256, creux: [C, _, L, T, _, L, _, T] },
  { id: 's5', genre: 'source', cout: { forme: 0, couleur: null, quantite: 2.025e6 }, lot: 1024, creux: [C, C, C, T, _, L, _, T] },
  { id: 's6', genre: 'source', cout: { forme: 0, couleur: null, quantite: 3.0375e7 }, lot: 4096, creux: [C, _, C, C, T, _, L, C] },
  { id: 's7', genre: 'source', cout: { forme: 0, couleur: null, quantite: 4.55625e8 }, lot: 16384, creux: [C, C, L, T, C, _, L, T] },
  { id: 's8', genre: 'source', cout: { forme: 0, couleur: null, quantite: 6.834375e9 }, lot: 65536, creux: [C, C, C, T, L, T, L, C] },
]

/**
 * LES RAFFINERIES : un déclenchement donne une forme à `lot` rondes de la
 * couleur réglée, sans perte. Elles se paient en rondes, de la couleur qu'on
 * veut.
 */
export const RAFFINERIES: readonly TypeProducteur[] = [
  { id: 'f1', genre: 'raffinerie', cout: { forme: 0, couleur: null, quantite: 20 }, lot: 5, creux: [_, C, _, _, _, T, _, _] },
  { id: 'f2', genre: 'raffinerie', cout: { forme: 0, couleur: null, quantite: 1500 }, lot: 50, creux: [C, _, C, T, _, T, _, _] },
  { id: 'f3', genre: 'raffinerie', cout: { forme: 0, couleur: null, quantite: 100000 }, lot: 500, creux: [C, C, C, T, _, L, _, T] },
]

/**
 * LES MÉLANGEURS : un déclenchement consomme `lot` rondes de CHACUNE des deux
 * couleurs de base du mélange réglé et rend `lot` rondes de la couleur
 * mélangée : le mélange coûte deux fois sa quantité, et un module mélangé
 * porte deux effets. Ils se paient en matière formée, de la sorte qu'on veut.
 */
export const MELANGEURS: readonly TypeProducteur[] = [
  { id: 'm1', genre: 'melangeur', cout: { forme: null, couleur: null, quantite: 80 }, lot: 5, creux: [_, C, _, _, _, T, _, _] },
  { id: 'm2', genre: 'melangeur', cout: { forme: null, couleur: null, quantite: 8000 }, lot: 50, creux: [C, _, C, T, _, T, _, _] },
]

/**
 * LA FABRICATION DES MODULES, dans la boutique : un module d'une sorte coûte
 * `part` fois la valeur de sa forme en matière de cette sorte, fois
 * `croissance` par module de cette sorte déjà fabriqué (comme les
 * générateurs : chacun coûte plus que le précédent), fois le multiplicateur de
 * la QUALITÉ choisie. Les qualités remplacent les anciens ateliers : la simple
 * est bon marché et sort des communs sans faute, les suivantes tirent mieux et
 * coûtent beaucoup plus. Les chances sont par rareté : commune, peu commune,
 * rare, épique, légendaire. La qualité suivante se dévoile en ayant usé de la
 * précédente, ou dès qu'on peut la payer.
 */
export interface Qualite {
  id: string
  mult: number
  chances: readonly number[]
}
export const FABRICATION = {
  part: 0.4,
  croissance: 1.15,
  /** Chaque module fabriqué, de quelque sorte, renchérit tous les suivants d'autant : le thermostat du nombre de modules d'une partie (mesuré : par sorte seule, les bots en fabriquaient 700 chacun dans la semaine et la saison finissait en 10¹³). */
  croissanceTotale: 1.1,
  /** Un module coûte au moins ce temps de ce que le joueur produit de sa sorte (en heures, par ses horloges) : le thermostat, mesuré au proto précédent (sans lui, les modules pleuvent et la semaine finit en 10¹³). */
  duree: 0.5,
  qualites: [
    { id: 'simple', mult: 1, chances: [78, 18, 4, 0, 0] },
    { id: 'soignee', mult: 5, chances: [55, 30, 12, 3, 0] },
    { id: 'fine', mult: 25, chances: [35, 35, 20, 8, 2] },
    { id: 'maitresse', mult: 125, chances: [20, 32, 28, 15, 5] },
  ] as readonly Qualite[],
}

/** Tous les types de générateurs, par famille. `type` d'un producteur est un indice ici. */
export const PRODUCTEURS: readonly TypeProducteur[] = [...SOURCES, ...RAFFINERIES, ...MELANGEURS]
/** Les types d'une famille, dans l'ordre de `PRODUCTEURS`, et l'indice du premier. */
export const FAMILLES: Record<Genre, { types: readonly TypeProducteur[]; premier: number }> = {
  source: { types: SOURCES, premier: 0 },
  raffinerie: { types: RAFFINERIES, premier: SOURCES.length },
  melangeur: { types: MELANGEURS, premier: SOURCES.length + RAFFINERIES.length },
}

/** Ce que vaut, en or, un module commun de niveau 1 de chaque forme (le rond n'est pas un module) : la base de sa fabrication et de ses niveaux. */
export const VALEUR_MODULE: readonly number[] = [0, 25, 50, 40]

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
 * niveaux coûtent `econome` fois le prix. `rapide` (les modules qui ont du
 * bleu) : leur effet sur le temps est multiplié par `rapide`.
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
 * LES EFFETS, à la force 1 (un commun de niveau 1) ; la force f les multiplie.
 * Le carré ajoute `ajout` fois le lot de base à sa cible ; le carré bleu, lui,
 * déclenche le générateur toutes les `periode` secondes. Le triangle multiplie
 * sa cible par 1 + `multiplicateur`. Le losange donne une chance `chance`
 * (composée : 1 − (1 − c)^f) : le rouge que la tape soit un critique (×
 * `coup`), le vert que le lot soit gros (× `grosLot`), le bleu qu'un tic en
 * entraîne un second. Mesuré au proto précédent : à 0,25 par niveau, quatre
 * modules sur la base donnaient ×16 et la semaine finissait en 10²⁵ ; à 0,1,
 * la montée tient sept jours.
 */
export const EFFETS = {
  periode: 60,
  ajout: 0.1,
  multiplicateur: 0.1,
  chance: 0.02,
  coup: 10,
  grosLot: 3,
}

/** UN GÉNÉRATEUR DE PLUS coûte ce multiple du précédent DU MÊME TYPE : on ne veut pas des foules de pièces. */
export const ACHAT = { croissance: 2.5 }

/**
 * LES NIVEAUX d'un module : le niveau L multiplie son effet par L ; passer du
 * niveau L au suivant coûte `premier` fois la valeur du module, fois
 * `croissance` par niveau déjà pris — en matière de sa couleur et de sa forme.
 */
export const NIVEAU = {
  premier: 10,
  croissance: 2.5,
}

/**
 * LES NIVEAUX d'une source (Keko : « j'investis dans le rouge pour augmenter
 * sa prod ») : le niveau L multiplie son lot de base par L ; le suivant coûte
 * `premier` fois son lot de base, fois `croissance` par niveau pris, en rondes
 * de sa couleur. Mesuré : à ×2 comme à ×3, les bots prennent un millier de
 * niveaux dans la semaine ; c'est leur dépense de fond.
 */
export const NIVEAU_SOURCE = {
  premier: 10,
  croissance: 2.5,
}

/** LA FUSION : tant de modules de même sorte et même rareté font un module de la rareté au-dessus. */
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
 * points. Les points gagnés valent la racine de (matière ronde produite
 * pendant la partie / `base`) ; chaque point ajoute `parPoint` au
 * multiplicateur des lots. Mesuré : cette économie monte de ×3 à ×10 par jour
 * (médiane 4 à 7 G la semaine, le meilleur 100 à 500 G) ; à 10⁶ les bots
 * repartaient sept fois et la saison finissait en 10¹³ ; à 10⁸ ils repartent
 * une à trois fois.
 */
export const PRESTIGE = {
  base: 1e8,
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
