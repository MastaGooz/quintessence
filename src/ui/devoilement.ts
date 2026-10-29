/** Ce qu'on dit au joueur à chaque étape du tutoriel : un titre, une consigne. Vouvoiement, jamais de « tu ». */

export const TUTO_TEXTES: Record<string, { titre: string; texte: string }> = {
  tape: {
    titre: 'Soignez des passants',
    texte: 'Chaque passant soigné vous donne une pièce. Il vous en faut soixante pour votre première mine.',
  },
  argiliere: {
    titre: 'Bâtissez une argilière',
    texte: 'Soixante pièces : de quoi bâtir une argilière. Elle creuse 15 argile par heure, même quand vous n’êtes pas là. Touchez la place « Bâtir ».',
  },
  vendre: {
    titre: 'Vendez de l’argile',
    texte: 'L’argilière remplit vos réserves. Le comptoir achète tout ce que vous ne gardez pas : vendez un peu d’argile.',
  },
  mineFer: {
    titre: 'Bâtissez une mine de fer',
    texte: 'La Terre a deux matières : l’argile, et le minerai. Une mine de fer coûte 60 or et 10 argile.',
  },
  mineCharbon: {
    titre: 'Bâtissez une mine de charbon',
    texte: 'Le Feu : le charbon chauffe tous les ateliers. Sans lui, rien ne se transforme.',
  },
  fourneau: {
    titre: 'Bâtissez un fourneau',
    texte: 'Votre premier atelier : il brûle 10 charbon par heure et donne 12 braises, la chaleur de tous les autres ateliers.',
  },
  forge: {
    titre: 'Bâtissez une forge',
    texte: 'La forge change 8 minerai et 4 braises en 6 fer par heure. Le fer vaut plus que le minerai, et il sert à bâtir.',
  },
  maitrise: {
    titre: 'La maîtrise',
    texte: 'Bâtir dans une branche y fait monter votre maîtrise : vous avez des points de Terre et de Feu. Compagnon à 4 points, maître à 8. On ne peut être maître que de deux éléments : c’est votre carrière qui se choisit.',
  },
  comptoir: {
    titre: 'Achetez 10 verre au comptoir',
    texte: 'Le comptoir vend aussi. Il vous faudra du verre pour agrandir le laboratoire, et vous n’en faites pas encore : achetez-en 10 (page Comptoir, touchez « verre »).',
  },
  extension: {
    titre: 'Agrandissez le laboratoire',
    texte: 'Six emplacements, c’est peu. L’extension en ajoute un ; chacune coûte plus cher que la précédente.',
  },
  verrerie: {
    titre: 'Bâtissez une verrerie',
    texte: 'L’Air : la verrerie fond 8 sable et 4 braises en 6 verre par heure. Du sable, vous en achetez au comptoir, ou vous l’extrayez : c’est la suite.',
  },
  sabliere: {
    titre: 'Bâtissez une sablière',
    texte: 'Une sablière nourrit la verrerie : 15 sable par heure. Agrandissez d’abord s’il manque une place.',
  },
  entrepot: {
    titre: 'L’entrepôt',
    texte: 'Vos réserves se remplissent : la page Entrepôt les montre toutes. Chacune plafonne à 120 ; un entrepôt plus grand (un bâtiment sans emplacement) relève ce plafond.',
  },
  jardin: {
    titre: 'Bâtissez un jardin d’herbes',
    texte: 'L’Eau : les herbes. Agrandissez s’il manque une place.',
  },
  saline: {
    titre: 'Bâtissez une saline',
    texte: 'Le sel, seconde matière de l’Eau.',
  },
  alambic: {
    titre: 'Bâtissez un alambic',
    texte: 'L’alambic distille 8 herbes, 2 sel et 3 braises en 6 essence par heure. Vous faites maintenant les quatre composants simples : braises, fer, verre, essence.',
  },
  ameliorer: {
    titre: 'Améliorez un bâtiment',
    texte: 'Touchez un bâtiment : le niveau 2 le fait produire et consommer 1,5 fois plus, le niveau 3 deux fois. Monter coûte le prix de construction multiplié par le niveau visé, plus 10 verre et 10 essence.',
  },
  soufriere: {
    titre: 'Bâtissez une soufrière',
    texte: 'Le soufre, seconde matière du Feu : il fera la flamme éternelle.',
  },
  geode: {
    titre: 'Ouvrez une géode',
    texte: 'Le cristal, seconde matière de l’Air : il fera le mercure et les runes. Vous connaissez les huit matières.',
  },
  avance: {
    titre: 'Les ateliers avancés',
    texte: 'Quatre ateliers de plus, un par élément : l’autel de soufre (flamme éternelle), le creuset (alliage), la cornue (mercure), l’atelier des runes (runes). Leurs composants valent 80 or et sont la matière des chefs-d’œuvre. Bâtissez ceux des éléments que vous voulez maîtriser.',
  },
  maitre: {
    titre: 'Le chef-d’œuvre',
    texte: 'Maître d’un élément, vous pourrez bâtir son atelier de chef-d’œuvre ; chaque cycle de 4 h demande des composants avancés des quatre éléments. Le Four philosophal cuit ensuite les quatre couleurs de l’œuvre avec ces chefs-d’œuvre : la rouge est la pierre philosophale.',
  },
  rivaux: {
    titre: 'Les rivaux',
    texte: 'Vous n’êtes pas seul : sept alchimistes courent vers la même pierre, et achètent et vendent au même comptoir. La page Rivaux montre le classement et la gazette.',
  },
  coupsBas: {
    titre: 'Les coups bas',
    texte: 'Piller, saboter, espionner, lancer une rumeur : chacun demande un bâtiment. Le gardien de pierre et le cercle de protection vous défendent. Toute attaque est anonyme, mais découverte une fois sur trois.',
  },
  fin: {
    titre: 'Vous savez tout',
    texte: 'La pierre philosophale demande les chefs-d’œuvre des quatre éléments : les deux vôtres, et ceux des autres, au comptoir ou aux rivaux. Bonne saison.',
  },
}
