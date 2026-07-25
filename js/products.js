/* =========================================================
   ZAIDAT FOOD — Source unique des produits
   ---------------------------------------------------------
   TABLE DE CORRESPONDANCE IMAGES (originaux -> web) :

   Produit (fichier original)            -> slug web
   ------------------------------------------------
   sambosse.png                          -> samoussas
   mini pizza.png                        -> mini-pizza
   pilowo.png                            -> pilaou
   plat fruit a pain au viande.png       -> fruit-a-pain-viande
   crepes chocolat.png                   -> crepes-chocolat
   crepes salée.png                      -> pancakes
   petit crepe.png                       -> biscuits-maison
   desert.png                            -> flan-caramel
   desert au fruit.png                   -> salade-fruits
   gateau grand format.png               -> gateau-grand-format
   gateau petit format.png               -> gateaux-coeur
   gateau au chocolat.png                -> gateau-chocolat
   glaces.png                            -> glaces
   madelene.png                          -> madeleines

   Lifestyle (fichier original)                     -> slug web
   ------------------------------------------------------------
   samnossa lifestyle.png                           -> samoussas
   mini pizza life style.png                        -> mini-pizza
   pilawo life style.png                            -> pilaou
   fruit a pain life styrle.png                     -> fruit-a-pain-viande
   crepes au chocolat life style.png                -> crepes-chocolat
   ChatGPT Image 25 juil. 2026, 00_08_15 (7).png    -> pancakes
   petit crepe lifestyle.png                        -> biscuits-maison
   desert lifestyle.png                             -> flan-caramel
   desert au fruit life style.png                   -> salade-fruits
   gateau grand format lifestyle.png                -> gateau-grand-format
   peti gateau life style.png                       -> gateaux-coeur
   grace lifestyle.png                              -> glaces
   madelene lifestyle.png                           -> madeleines
   (gateau-chocolat : AUCUNE image lifestyle — voir ASSETS_A_VERIFIER.md)

   ---------------------------------------------------------
   PRIX : aucun prix n'a été fourni pour le moment.
   Remplacer  price: null  par exemple par  price: 1500
   (montant en KMF, sans espaces). Le site affichera alors
   automatiquement "1 500 KMF" et calculera les totaux.
   ========================================================= */

/* `icon` = nom d'une icône de js/icons.js (sans le préfixe « i- ») */
const CATEGORIES = [
  { id: "plats",    name: "Plats",             icon: "bowl" },
  { id: "snacks",   name: "Snacks salés",      icon: "samosa" },
  { id: "desserts", name: "Desserts",          icon: "flan" },
  { id: "gateaux",  name: "Gâteaux",           icon: "cake" },
  { id: "douceurs", name: "Crêpes & douceurs", icon: "pancakes" },
];

/* Option réutilisable : personnalisation libre pour les gâteaux */
const OPTION_PERSONNALISATION = {
  id: "personnalisation",
  name: "Personnalisation (message, couleur souhaitée…)",
  type: "text",
  required: false,
  placeholder: "Ex. « Joyeux anniversaire Anli », couleur rose…",
};

const PRODUCTS = [
  {
    id: "p-pilaou",
    slug: "pilaou",
    name: "Pilaou de viande",
    shortDescription: "Riz parfumé aux épices, viande fondante et sa sauce tomate.",
    description:
      "Le grand classique convivial : un dôme de riz pilaou parfumé aux épices, garni de morceaux de viande mijotée, de carottes et de légumes, servi avec sa petite sauce tomate aux oignons et poivrons. Un plat complet, généreux et réconfortant.",
    price: null,
    currency: "KMF",
    category: "plats",
    productImage: "assets/img/products/pilaou-900.jpg",
    productThumb: "assets/img/products/pilaou-450.jpg",
    lifestyleImage: "assets/img/lifestyle/pilaou-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/pilaou-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: true,
    options: [],
  },
  {
    id: "p-fruit-a-pain",
    slug: "fruit-a-pain-viande",
    name: "Fruit à pain à la viande",
    shortDescription: "Fruit à pain fondant, viande mijotée aux oignons et rougail.",
    description:
      "Une spécialité authentique des Comores : de beaux quartiers de fruit à pain fondants, accompagnés d'une viande longuement mijotée aux oignons et d'une sauce rougail relevée. Le goût de la cuisine familiale, servi bien chaud.",
    price: null,
    currency: "KMF",
    category: "plats",
    productImage: "assets/img/products/fruit-a-pain-viande-900.jpg",
    productThumb: "assets/img/products/fruit-a-pain-viande-450.jpg",
    lifestyleImage: "assets/img/lifestyle/fruit-a-pain-viande-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/fruit-a-pain-viande-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: false,
    options: [],
  },
  {
    id: "p-samoussas",
    slug: "samoussas",
    name: "Samoussas croustillants",
    shortDescription: "Triangles dorés, farcis et frits maison, à partager.",
    description:
      "Des samoussas pliés et frits à la maison : une pâte fine et croustillante, une farce savoureuse, parfaits à l'apéritif, au goûter salé ou en accompagnement. Servis en portion à partager.",
    price: null,
    currency: "KMF",
    category: "snacks",
    productImage: "assets/img/products/samoussas-900.jpg",
    productThumb: "assets/img/products/samoussas-450.jpg",
    lifestyleImage: "assets/img/lifestyle/samoussas-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/samoussas-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: true,
    options: [],
  },
  {
    id: "p-mini-pizza",
    slug: "mini-pizza",
    name: "Mini pizza",
    shortDescription: "Pâte moelleuse, sauce tomate maison et fromage gratiné.",
    description:
      "Une pizza gourmande à la pâte moelleuse et au bord doré, garnie de sauce tomate maison et de fromage bien gratiné. Découpée en parts, idéale pour les petites faims et les goûters salés.",
    price: null,
    currency: "KMF",
    category: "snacks",
    productImage: "assets/img/products/mini-pizza-900.jpg",
    productThumb: "assets/img/products/mini-pizza-450.jpg",
    lifestyleImage: "assets/img/lifestyle/mini-pizza-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/mini-pizza-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: false,
    options: [],
  },
  {
    id: "p-flan-caramel",
    slug: "flan-caramel",
    name: "Flan au caramel",
    shortDescription: "Flan onctueux nappé de caramel, en pot individuel.",
    description:
      "Un flan maison à la texture onctueuse, couronné d'un caramel doré, présenté en pot individuel avec couvercle : pratique à emporter, à offrir ou à garder au frais pour le dessert.",
    price: null,
    currency: "KMF",
    category: "desserts",
    productImage: "assets/img/products/flan-caramel-900.jpg",
    productThumb: "assets/img/products/flan-caramel-450.jpg",
    lifestyleImage: "assets/img/lifestyle/flan-caramel-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/flan-caramel-450.jpg",
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
  {
    id: "p-salade-fruits",
    slug: "salade-fruits",
    name: "Salade de fruits frais",
    shortDescription: "Fruits frais coupés minute, servis en pot individuel.",
    description:
      "Un pot débordant de fruits frais coupés à la main : pastèque, mangue, kiwi, agrumes, raisin, pomme… selon le marché du jour. Fraîcheur garantie, sans chichi, pour une pause légère et colorée.",
    price: null,
    currency: "KMF",
    category: "desserts",
    productImage: "assets/img/products/salade-fruits-900.jpg",
    productThumb: "assets/img/products/salade-fruits-450.jpg",
    lifestyleImage: "assets/img/lifestyle/salade-fruits-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/salade-fruits-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: false,
    options: [],
  },
  {
    id: "p-glaces",
    slug: "glaces",
    name: "Glace maison",
    shortDescription: "Glace crémeuse maison aux éclats de fruits.",
    description:
      "Une glace crémeuse préparée maison, parsemée d'éclats de fruits, servie en belles boules généreuses. La douceur parfaite des après-midi ensoleillés.",
    price: null,
    currency: "KMF",
    category: "desserts",
    productImage: "assets/img/products/glaces-900.jpg",
    productThumb: "assets/img/products/glaces-450.jpg",
    lifestyleImage: "assets/img/lifestyle/glaces-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/glaces-450.jpg",
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
  {
    id: "p-gateau-grand",
    slug: "gateau-grand-format",
    name: "Gâteau grand format",
    shortDescription: "Grand gâteau de fête décoré à la crème, pour vos occasions.",
    description:
      "Un grand gâteau de célébration décoré à la crème, avec ses finitions en volutes, ses perles et ses papillons : le centre de table idéal pour un anniversaire, des fiançailles ou toute grande occasion. Personnalisation possible sur demande.",
    price: null,
    currency: "KMF",
    category: "gateaux",
    productImage: "assets/img/products/gateau-grand-format-900.jpg",
    productThumb: "assets/img/products/gateau-grand-format-450.jpg",
    lifestyleImage: "assets/img/lifestyle/gateau-grand-format-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/gateau-grand-format-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: true,
    preparationTime: "Sur commande — prévoir un délai, à confirmer ensemble",
    options: [OPTION_PERSONNALISATION],
  },
  {
    id: "p-gateaux-coeur",
    slug: "gateaux-coeur",
    name: "Gâteau petit format (cœur)",
    shortDescription: "Petit gâteau cœur décoré à la crème, à deux ou en cadeau.",
    description:
      "Un petit gâteau en forme de cœur, décoré à la crème avec ses jolies volutes — disponible dans des teintes douces (crème, rose, framboise selon demande). Parfait pour un duo, une attention ou une petite célébration.",
    price: null,
    currency: "KMF",
    category: "gateaux",
    productImage: "assets/img/products/gateaux-coeur-900.jpg",
    productThumb: "assets/img/products/gateaux-coeur-450.jpg",
    lifestyleImage: "assets/img/lifestyle/gateaux-coeur-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/gateaux-coeur-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: false,
    preparationTime: "Sur commande — prévoir un délai, à confirmer ensemble",
    options: [OPTION_PERSONNALISATION],
  },
  {
    id: "p-gateau-chocolat",
    slug: "gateau-chocolat",
    name: "Gâteau au chocolat",
    shortDescription: "Petits moelleux dorés, généreusement fourrés au chocolat.",
    description:
      "De petits moelleux dorés à la poêle, garnis d'un cœur de chocolat fondant qui s'étire à la découpe. Une gourmandise qui plaît autant aux enfants qu'aux grands.",
    price: null,
    currency: "KMF",
    category: "gateaux",
    productImage: "assets/img/products/gateau-chocolat-900.jpg",
    productThumb: "assets/img/products/gateau-chocolat-450.jpg",
    lifestyleImage: null, /* Pas d'image lifestyle fournie — voir ASSETS_A_VERIFIER.md */
    lifestyleThumb: null,
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
  {
    id: "p-crepes-chocolat",
    slug: "crepes-chocolat",
    name: "Crêpes roulées au chocolat",
    shortDescription: "Crêpes fines roulées, cœur chocolat fondant et nappage.",
    description:
      "Des crêpes fines roulées autour d'un cœur de chocolat fondant, joliment nappées de filets chocolatés. Une douceur irrésistible pour le goûter ou le dessert.",
    price: null,
    currency: "KMF",
    category: "douceurs",
    productImage: "assets/img/products/crepes-chocolat-900.jpg",
    productThumb: "assets/img/products/crepes-chocolat-450.jpg",
    lifestyleImage: "assets/img/lifestyle/crepes-chocolat-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/crepes-chocolat-450.jpg",
    gallery: [],
    available: true,
    featured: true,
    bestseller: true,
    options: [],
  },
  {
    id: "p-pancakes",
    slug: "pancakes",
    name: "Pancakes moelleux",
    shortDescription: "Pancakes épais et dorés, moelleux à souhait.",
    description:
      "Une pile de pancakes épais, dorés à la poêle et incroyablement moelleux. À déguster nature ou avec votre accompagnement préféré, au petit-déjeuner comme au goûter.",
    price: null,
    currency: "KMF",
    category: "douceurs",
    productImage: "assets/img/products/pancakes-900.jpg",
    productThumb: "assets/img/products/pancakes-450.jpg",
    lifestyleImage: "assets/img/lifestyle/pancakes-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/pancakes-450.jpg",
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
  {
    id: "p-biscuits",
    slug: "biscuits-maison",
    name: "Biscuits maison",
    shortDescription: "Sablés dorés en formes cœur, étoile et fleur.",
    description:
      "Un assortiment de biscuits sablés faits maison, découpés en cœurs, étoiles et fleurs, dorés au four. Croquants dehors, tendres dedans — parfaits avec le thé ou le café.",
    price: null,
    currency: "KMF",
    category: "douceurs",
    productImage: "assets/img/products/biscuits-maison-900.jpg",
    productThumb: "assets/img/products/biscuits-maison-450.jpg",
    lifestyleImage: "assets/img/lifestyle/biscuits-maison-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/biscuits-maison-450.jpg",
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
  {
    id: "p-madeleines",
    slug: "madeleines",
    name: "Madeleines",
    shortDescription: "Madeleines dorées à la texture aérienne, en caissettes.",
    description:
      "Des madeleines dorées cuites en caissettes, à la mie aérienne et parfumée. La petite douceur toute simple qui accompagne merveilleusement une pause thé ou café.",
    price: null,
    currency: "KMF",
    category: "douceurs",
    productImage: "assets/img/products/madeleines-900.jpg",
    productThumb: "assets/img/products/madeleines-450.jpg",
    lifestyleImage: "assets/img/lifestyle/madeleines-900.jpg",
    lifestyleThumb: "assets/img/lifestyle/madeleines-450.jpg",
    gallery: [],
    available: true,
    featured: false,
    bestseller: false,
    options: [],
  },
];

/* --------- Aides d'accès aux données --------- */
function getProductBySlug(slug) {
  return PRODUCTS.find(function (p) { return p.slug === slug; }) || null;
}
function getProductsByCategory(catId) {
  return PRODUCTS.filter(function (p) { return p.category === catId; });
}
function getCategoryById(catId) {
  return CATEGORIES.find(function (c) { return c.id === catId; }) || null;
}
/* Catégories réellement non vides, dans l'ordre défini */
function getNonEmptyCategories() {
  return CATEGORIES.filter(function (c) { return getProductsByCategory(c.id).length > 0; });
}
