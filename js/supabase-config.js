/* =========================================================
   ZAIDAT FOOD — Connexion à Supabase
   ---------------------------------------------------------
   Supabase héberge la base de données (produits, textes) et
   les photos. C'est ce qui permet à la cuisinière de modifier
   le site depuis le dashboard, sans passer par un développeur.

   COMMENT REMPLIR CE FICHIER : voir admin/GUIDE_DASHBOARD.md
   (compte gratuit, 5 minutes, aucune carte bancaire).

   Tant que ces deux valeurs sont vides, le site fonctionne
   normalement avec les produits inscrits dans js/products.js.
   Rien ne casse : Supabase vient simplement les remplacer.

   La clé « anon » est PUBLIQUE par conception : elle est faite
   pour être lue par les navigateurs. Ce qui protège les données,
   ce sont les règles de sécurité posées dans Supabase (RLS) :
   tout le monde peut lire, seule la personne connectée peut
   modifier. Ne jamais mettre ici la clé « service_role ».
   ========================================================= */

const SUPABASE_CONFIG = {
  /* Exemple : "https://abcdefghijk.supabase.co" */
  url: "",

  /* Clé publique « anon public » */
  anonKey: "",

  /* Nom du dossier de photos créé dans Supabase Storage */
  bucket: "photos",
};
