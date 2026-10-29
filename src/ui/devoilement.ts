/** Ce qu'on dit au joueur quand une notion apparaît : une phrase, pas un tutoriel. */
import type { Etape } from '../logic/partie.ts'

export const AIDE: Record<Etape, string> = {
  batir: 'Soixante pièces : de quoi bâtir une argilière. Elle creuse même quand vous n’êtes pas là.',
  elements: 'Quatre éléments : Feu, Terre, Eau, Air. Chaque mine sort la matière de l’un d’eux.',
  vendre: 'Le comptoir achète tout ce que vous ne gardez pas.',
  transformation: 'Un atelier change des matières en composants : ils valent plus, et servent à bâtir.',
  entrepot: 'Vos réserves se remplissent : l’entrepôt les montre toutes, et plafonne chacune.',
  ameliorer: 'Un bâtiment monte jusqu’au niveau 3 : il produit et consomme davantage.',
  agrandir: 'Plus de place : agrandissez le laboratoire, ou l’entrepôt s’il déborde.',
  maitrise: 'Bâtir dans une branche y fait monter votre maîtrise : compagnon à 4 points, maître à 8. Deux maîtrises au plus.',
  avance: 'Compagnon : les ateliers avancés s’ouvrent. Leurs composants servent aux chefs-d’œuvre.',
  comptoir: 'Les prix bougent : ce que tout le monde vend baisse, ce que tout le monde achète monte.',
  rivaux: 'Vous n’êtes pas seul : sept alchimistes courent vers la même pierre.',
  coupsBas: 'On peut piller, saboter, espionner. On peut aussi se défendre.',
  oeuvre: 'Maître : votre chef-d’œuvre est à portée. La pierre philosophale demande ceux des quatre éléments.',
}

export const TITRE_ETAPE: Record<Etape, string> = {
  batir: 'Bâtir',
  elements: 'Les quatre éléments',
  vendre: 'Vendre',
  transformation: 'Les ateliers',
  entrepot: 'L’entrepôt',
  ameliorer: 'Améliorer',
  agrandir: 'Agrandir',
  maitrise: 'La maîtrise',
  avance: 'Les ateliers avancés',
  comptoir: 'Le comptoir',
  rivaux: 'Les rivaux',
  coupsBas: 'Les coups bas',
  oeuvre: 'Le Grand Œuvre',
}
