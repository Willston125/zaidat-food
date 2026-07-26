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
  /* Projet « Willston125's Project » de l'organisation CINETCOM */
  url: "https://dhhhdlthsxvscantcyir.supabase.co",

  /* Clé publique « anon public » — Supabase → Project Settings → API.
     À coller ici en entier. Tant qu'elle est vide, le site affiche
     les produits de js/products.js et le dashboard reste en lecture. */
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoaGhkbHRoc3h2c2NhbnRjeWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzc0ODYsImV4cCI6MjA3OTY1MzQ4Nn0.-LtfMs24xhUCCtDuGLJOU-IKlo-u-FDeebY73r1-W3w",

  /* Nom du dossier de photos créé dans Supabase Storage */
  bucket: "photos",
};
