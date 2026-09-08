/* =========================================================
   ZAIDAT FOOD — Configuration centrale du site
   Tout ce que la cuisinière peut modifier se trouve ici :
   numéro WhatsApp, textes, horaires, liens, livraison.
   ========================================================= */

const SITE_CONFIG = {
  brand: {
    name: "ZAIDAT FOOD",
    tagline: "Cuisine artisanale comorienne",
    logo: "assets/img/logo-256.png",
  },

  /* --- COMMANDE WHATSAPP -----------------------------------
     Format international SANS le signe + ni espaces.
     Exemple pour les Comores : "2693XXXXXX"
     Tant que ce champ est vide, le site affiche un message
     clair et propose de copier la commande à la place.       */
  WHATSAPP_ORDER_NUMBER: "2694880343",

  /* Téléphone affiché dans le site (laisser vide si inconnu) */
  phoneDisplay: "+269 488 03 43",

  /* Message pré-rempli quand un visiteur clique sur le bouton
     WhatsApp flottant (simple prise de contact, hors commande). */
  whatsappGreeting: "Bonjour ZAIDAT FOOD, j'aimerais avoir des informations sur vos plats.",

  /* Devise : les produits sont vendus aux Comores en KMF.
     IMPORTANT : aucun prix n'a encore été fourni — les prix
     se remplissent dans js/products.js (price: 1500 etc.).   */
  currency: "KMF",

  /* --- Barre d'information (haut de page) ------------------ */
  infoBar: [
    "Cuisine maison préparée sur commande",
    "Commande simple via WhatsApp",
    "Livraison selon disponibilité",
  ],

  /* --- Hero ------------------------------------------------ */
  hero: {
    title: "Des saveurs préparées avec amour",
    subtitle:
      "Découvrez des plats, douceurs et créations maison préparés avec soin pour vos repas, vos envies et vos moments de partage.",
    ctaPrimary: "Commander maintenant",
    ctaSecondary: "Découvrir le menu",
    reassurance: "Cuisine maison • Commande simple • Livraison disponible",
  },

  /* --- Section signature ----------------------------------- */
  about: {
    title: "La cuisine de Zaidat",
    text:
      "Derrière ZAIDAT FOOD, il y a une cuisinière passionnée qui prépare chaque plat comme à la maison : des produits choisis avec soin, des recettes généreuses inspirées des Comores, et l'envie de régaler petites faims comme grandes occasions.",
    points: [
      "Préparé avec soin, en petites quantités",
      "Produits frais travaillés maison",
      "Commande simple, service humain",
    ],
  },

  /* --- « Comment commander ? » -----------------------------
     Modifiable depuis le dashboard, onglet « Textes du site ».
     Ces étapes décrivent le parcours RÉEL : aucun formulaire
     n'est obligatoire, tout se règle dans la conversation.   */
  steps: {
    eyebrow: "C'est simple",
    title: "Comment commander ?",
    items: [
      {
        title: "Choisissez vos produits",
        text: "Parcourez le menu et laissez-vous tenter par nos plats et douceurs maison.",
      },
      {
        title: "Ajoutez-les au panier",
        text: "Sélectionnez la quantité et vos éventuelles personnalisations.",
      },
      {
        title: "Envoyez sur WhatsApp",
        text: "Un seul clic : votre message part pré-rempli. Aucun formulaire obligatoire.",
      },
      {
        title: "On confirme ensemble",
        text: "ZAIDAT FOOD vous répond, confirme le prix, la date et la livraison.",
      },
    ],
  },

  /* --- « Nos engagements » ---------------------------------
     `icon` = nom d'une icône de js/icons.js, sans le préfixe « i- ». */
  promises: {
    eyebrow: "Nos engagements",
    title: "Ce que ZAIDAT FOOD vous promet",
    items: [
      { icon: "heart", title: "Préparé avec soin", text: "Chaque commande est cuisinée avec attention" },
      { icon: "leaf", title: "Produits frais", text: "Des ingrédients choisis et travaillés maison" },
      { icon: "bag", title: "Commande simple", text: "Un panier, un message WhatsApp, c'est parti" },
      { icon: "scooter", title: "Livraison selon disponibilité", text: "Ou retrait directement auprès de la cuisinière" },
      { icon: "users", title: "Service humain", text: "Une vraie personne vous répond et vous conseille" },
    ],
  },

  /* --- Appel final, en bas de la page d'accueil ------------ */
  ctaFinal: {
    title: "Une envie particulière ?",
    text: "Préparons votre commande ensemble — dites-nous ce qui vous ferait plaisir.",
    button: "Composer ma commande",
  },

  /* --- Horaires (laisser vide tant que non confirmés) ------ */
  hours: [],

  /* --- Zone de livraison / retrait ------------------------- */
  delivery: {
    note: "Livraison selon disponibilité — précisez votre zone lors de la commande.",
    modes: ["Livraison", "Retrait sur place"],
  },

  /* --- Moyens de paiement ----------------------------------
     Le paiement en ligne n'est pas encore intégré : le choix
     est transmis avec la commande et confirmé par WhatsApp.  */
  paymentMethods: ["À confirmer ensemble (paiement à la commande)"],

  /* --- Témoignages -----------------------------------------
     Ajouter ici de VRAIS témoignages clients :
     { name: "Prénom", text: "…" }
     La section reste masquée tant que la liste est vide.     */
  testimonials: [],

  /* --- Galerie -------------------------------------------
     Photos d'ambiance, gérées depuis le dashboard.
     Tant que la liste est vide, le site affiche à la place les
     photos en situation des produits.                        */
  galerie: [],

  /* --- Réseaux sociaux (laisser vide si inexistants) ------- */
  socials: {
    instagram: "",
    facebook: "",
    tiktok: "",
  },
};

/* Format d'un prix en KMF : 1500 -> "1 500 KMF" (espace insécable).
   Retourne null si le prix n'est pas renseigné. */
function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return null;
  return amount.toLocaleString("fr-FR").replace(/\s/g, "\u00A0") + "\u00A0" + SITE_CONFIG.currency;
}

/* Libellé affiché quand le prix n'est pas encore renseigné */
const PRICE_TBC_LABEL = "Prix sur demande";
