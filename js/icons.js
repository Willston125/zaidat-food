/* =========================================================
   ZAIDAT FOOD — Jeu d'icônes vectorielles
   ---------------------------------------------------------
   Icônes dessinées sur mesure (style ligne fine, 24×24),
   affichées via un sprite SVG unique injecté dans la page.

   • Aucune dépendance externe, aucune police d'icônes.
   • Rendu net à toutes les tailles et sur tous les appareils
     (contrairement aux emoji, qui changent selon le téléphone).
   • La couleur suit automatiquement le texte (currentColor).

   Utilisation dans le HTML :
     <svg class="icon" aria-hidden="true"><use href="#i-basket"></use></svg>
   Utilisation dans le JavaScript :
     ZF.icon("basket")            → taille normale
     ZF.icon("cake", "icon--lg")  → taille agrandie
   ========================================================= */

window.ZF = window.ZF || {};

var ZF_ICON_SPRITE = [
  '<svg xmlns="http://www.w3.org/2000/svg">',

  /* --- Navigation & interface --------------------------- */
  '<symbol id="i-search" viewBox="0 0 24 24">',
  '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/>',
  "</symbol>",

  '<symbol id="i-basket" viewBox="0 0 24 24">',
  '<path d="M3 9.5h18l-1.7 8.9a2.2 2.2 0 0 1-2.2 1.8H6.9a2.2 2.2 0 0 1-2.2-1.8L3 9.5Z"/>',
  '<path d="M8.5 9.5 10.8 4M15.5 9.5 13.2 4"/>',
  '<path d="M9.6 13.2v3.3M14.4 13.2v3.3"/>',
  "</symbol>",

  '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>',
  '<symbol id="i-close" viewBox="0 0 24 24"><path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/></symbol>',
  '<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></symbol>',
  '<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5.5 12h13"/></symbol>',
  '<symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19.5 12h-15"/><path d="m10.5 18-6-6 6-6"/></symbol>',
  '<symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>',

  '<symbol id="i-grid" viewBox="0 0 24 24">',
  '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/>',
  '<rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
  "</symbol>",

  '<symbol id="i-trash" viewBox="0 0 24 24">',
  '<path d="M4 6.5h16"/><path d="M9.5 6.5V5.1A1.6 1.6 0 0 1 11.1 3.5h1.8A1.6 1.6 0 0 1 14.5 5.1v1.4"/>',
  '<path d="M6.6 6.5 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8A1.6 1.6 0 0 0 16.5 19l.9-12.5"/>',
  '<path d="M10.4 10.4v6M13.6 10.4v6"/>',
  "</symbol>",

  '<symbol id="i-copy" viewBox="0 0 24 24">',
  '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/>',
  '<path d="M5.6 15.5h-.6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.6"/>',
  "</symbol>",

  '<symbol id="i-eye" viewBox="0 0 24 24">',
  '<path d="M2.5 12S6.3 5.6 12 5.6 21.5 12 21.5 12 17.7 18.4 12 18.4 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  "</symbol>",

  /* --- États -------------------------------------------- */
  '<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.6 4.6 4.6L19 7.8"/></symbol>',
  '<symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/></symbol>',
  '<symbol id="i-unavailable" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></symbol>',
  '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.3 1.9"/></symbol>',

  '<symbol id="i-star" viewBox="0 0 24 24">',
  '<path fill="currentColor" stroke="none" d="m12 3.4 2.72 5.51 6.08.89-4.4 4.29 1.04 6.06L12 17.29l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.89Z"/>',
  "</symbol>",

  '<symbol id="i-sparkle" viewBox="0 0 24 24">',
  '<path fill="currentColor" stroke="none" d="M12 3.8c.75 4.05 2.4 5.7 6.45 6.45-4.05.75-5.7 2.4-6.45 6.45-.75-4.05-2.4-5.7-6.45-6.45C9.6 9.5 11.25 7.85 12 3.8Z"/>',
  "</symbol>",

  /* --- Catégories & métier ------------------------------ */
  '<symbol id="i-bowl" viewBox="0 0 24 24">',
  '<path d="M3.4 11.4h17.2"/><path d="M3.4 11.4a8.6 8.6 0 0 0 17.2 0"/>',
  '<path d="M9.2 8.1c0-1.1.9-1.5.9-2.6s-.9-2.3-.9-2.3"/>',
  '<path d="M13.9 8.1c0-1.1.9-1.5.9-2.6s-.9-2.3-.9-2.3"/>',
  "</symbol>",

  '<symbol id="i-samosa" viewBox="0 0 24 24">',
  '<path d="M12 4.2 20.7 19a1.1 1.1 0 0 1-1 1.6H4.3a1.1 1.1 0 0 1-1-1.6L12 4.2Z"/><path d="M12 4.6v16"/>',
  "</symbol>",

  '<symbol id="i-flan" viewBox="0 0 24 24">',
  '<path d="M4.5 19.4h15"/><path d="M6.4 16.8 7.9 9.5a4.3 4.3 0 0 1 8.2 0l1.5 7.3Z"/>',
  '<path d="M8.6 8.4c1.3.8 2.1.3 3.4.3s2.1.5 3.4-.3"/>',
  "</symbol>",

  '<symbol id="i-cake" viewBox="0 0 24 24">',
  '<path d="M3.5 20.5h17"/><path d="M5.2 20.5v-5.2a2 2 0 0 1 2-2h9.6a2 2 0 0 1 2 2v5.2"/>',
  '<path d="M8.6 13.3v-2.2M12 13.3v-2.6M15.4 13.3v-2.2"/>',
  '<circle cx="8.6" cy="9.7" r=".95" fill="currentColor" stroke="none"/>',
  '<circle cx="12" cy="9.3" r=".95" fill="currentColor" stroke="none"/>',
  '<circle cx="15.4" cy="9.7" r=".95" fill="currentColor" stroke="none"/>',
  "</symbol>",

  '<symbol id="i-pancakes" viewBox="0 0 24 24">',
  '<ellipse cx="12" cy="8" rx="7.6" ry="3.1"/>',
  '<path d="M4.4 11.8c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1"/>',
  '<path d="M4.4 15.5c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1"/>',
  "</symbol>",

  '<symbol id="i-cloche" viewBox="0 0 24 24">',
  '<path d="M3.2 18.4h17.6"/><path d="M5 15.5a7 7 0 0 1 14 0"/><path d="M5 15.5h14"/>',
  '<path d="M12 8.5V7.3"/><circle cx="12" cy="6" r="1.15"/>',
  "</symbol>",

  '<symbol id="i-tray" viewBox="0 0 24 24">',
  '<ellipse cx="12" cy="13.2" rx="8.4" ry="4.9"/><ellipse cx="12" cy="13.2" rx="5" ry="2.7"/>',
  "</symbol>",

  '<symbol id="i-chef-hat" viewBox="0 0 24 24">',
  '<path d="M6.9 16.6h10.2v-2.7a4.2 4.2 0 1 0-1.9-7.8 4.3 4.3 0 0 0-6.4 0 4.2 4.2 0 1 0-1.9 7.8v2.7Z"/>',
  '<path d="M6.9 19.6h10.2"/>',
  "</symbol>",

  '<symbol id="i-leaf" viewBox="0 0 24 24">',
  '<path d="M11.2 20.2A7.2 7.2 0 0 1 4 13c0-5.6 5.1-9.2 16.2-9.2 0 11.1-3.6 16.4-9 16.4Z"/>',
  '<path d="M4.6 19.6c3.4-3.4 5.9-6.4 10.2-8.4"/>',
  "</symbol>",

  '<symbol id="i-heart" viewBox="0 0 24 24">',
  '<path d="M20.3 5.9a5 5 0 0 0-7.1 0L12 7.1l-1.2-1.2a5 5 0 0 0-7.1 7.1l1.2 1.2L12 21l7.1-6.8 1.2-1.2a5 5 0 0 0 0-7.1Z"/>',
  "</symbol>",

  '<symbol id="i-house" viewBox="0 0 24 24">',
  '<path d="M3.8 10.6 12 4.2l8.2 6.4"/>',
  '<path d="M5.7 9.4V19a1.5 1.5 0 0 0 1.5 1.5h9.6A1.5 1.5 0 0 0 18.3 19V9.4"/>',
  '<path d="M9.8 20.5v-4.7h4.4v4.7"/>',
  "</symbol>",

  '<symbol id="i-bag" viewBox="0 0 24 24">',
  '<path d="M5.6 8h12.8l1 11.3a1.5 1.5 0 0 1-1.5 1.6H6.1a1.5 1.5 0 0 1-1.5-1.6L5.6 8Z"/>',
  '<path d="M8.9 8V6.3a3.1 3.1 0 0 1 6.2 0V8"/>',
  "</symbol>",

  '<symbol id="i-scooter" viewBox="0 0 24 24">',
  '<circle cx="6" cy="17.4" r="2.8"/><circle cx="18.4" cy="17.4" r="2.8"/>',
  '<path d="M8.8 17.4h6.8"/><path d="M15.6 17.4 13.1 7.2h-2.4"/>',
  '<path d="M13.1 7.2h4.1l1.4 7.4"/><path d="M3.6 13.4h4.6"/>',
  "</symbol>",

  '<symbol id="i-users" viewBox="0 0 24 24">',
  '<path d="M15.4 20.4v-1.7a3.4 3.4 0 0 0-3.4-3.4H6.7a3.4 3.4 0 0 0-3.4 3.4v1.7"/>',
  '<circle cx="9.35" cy="7.7" r="3.4"/>',
  '<path d="M20.7 20.4v-1.7a3.4 3.4 0 0 0-2.6-3.3"/><path d="M15.8 4.5a3.4 3.4 0 0 1 0 6.5"/>',
  "</symbol>",

  '<symbol id="i-wallet" viewBox="0 0 24 24">',
  '<path d="M19.4 8.6V6.9a1.9 1.9 0 0 0-1.9-1.9H5.4a1.9 1.9 0 0 0-1.9 1.9v10.2A1.9 1.9 0 0 0 5.4 19h12.1a1.9 1.9 0 0 0 1.9-1.9v-1.7"/>',
  '<path d="M20.6 11.4h-4.2a2.1 2.1 0 0 0 0 4.2h4.2a.6.6 0 0 0 .6-.6V12a.6.6 0 0 0-.6-.6Z"/>',
  "</symbol>",

  '<symbol id="i-map-pin" viewBox="0 0 24 24">',
  '<path d="M19 10.4c0 5.2-7 11.1-7 11.1s-7-5.9-7-11.1a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10.2" r="2.6"/>',
  "</symbol>",

  '<symbol id="i-calendar" viewBox="0 0 24 24">',
  '<rect x="3.5" y="5.4" width="17" height="15.1" rx="2.2"/><path d="M3.5 10.1h17M8.4 3.5v3.8M15.6 3.5v3.8"/>',
  "</symbol>",

  /* --- Contact & réseaux -------------------------------- */
  '<symbol id="i-phone" viewBox="0 0 24 24">',
  '<path d="M20.3 16.6v2.6a1.7 1.7 0 0 1-1.9 1.7 17 17 0 0 1-7.4-2.6 16.7 16.7 0 0 1-5.1-5.1A17 17 0 0 1 3.3 5.7 1.7 1.7 0 0 1 5 3.8h2.6a1.7 1.7 0 0 1 1.7 1.5c.1.8.3 1.6.6 2.4a1.7 1.7 0 0 1-.4 1.8L8.4 10.6a13.7 13.7 0 0 0 5.1 5.1l1.1-1.1a1.7 1.7 0 0 1 1.8-.4c.8.3 1.6.5 2.4.6a1.7 1.7 0 0 1 1.5 1.8Z"/>',
  "</symbol>",

  '<symbol id="i-chat" viewBox="0 0 24 24">',
  '<path d="M20.6 11.6a7.8 7.8 0 0 1-8.4 7.8 8.7 8.7 0 0 1-2.4-.4l-5.4 1.5 1.6-4.4a7.7 7.7 0 0 1-1.1-4.1 7.8 7.8 0 0 1 8.4-7.8 7.8 7.8 0 0 1 7.3 7.4Z"/>',
  "</symbol>",

  '<symbol id="i-whatsapp" viewBox="0 0 24 24">',
  '<path fill="currentColor" stroke="none" d="M12.04 2.2c-5.42 0-9.82 4.4-9.82 9.82a9.75 9.75 0 0 0 1.4 5.04L2.2 21.8l4.88-1.37a9.79 9.79 0 0 0 4.96 1.35h.01c5.41 0 9.81-4.4 9.81-9.82 0-2.62-1.02-5.09-2.87-6.94a9.75 9.75 0 0 0-6.95-2.87Zm0 17.92h-.01a8.15 8.15 0 0 1-4.15-1.14l-.3-.18-3.09.81.83-3.01-.2-.31a8.13 8.13 0 0 1-1.25-4.35 8.16 8.16 0 0 1 14.32-5.34 8.1 8.1 0 0 1 2.39 5.77c0 4.5-3.66 8.15-8.16 8.15Z"/>',
  '<path fill="currentColor" stroke="none" d="M16.51 14.13c-.24-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.77.97-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.97-1.22-.73-.65-1.22-1.45-1.36-1.7-.14-.24-.02-.37.11-.5.11-.11.24-.28.36-.43.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.85.84-.85 2.04s.87 2.37 1 2.53c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z"/>',
  "</symbol>",

  '<symbol id="i-instagram" viewBox="0 0 24 24">',
  '<rect x="3.5" y="3.5" width="17" height="17" rx="4.6"/><circle cx="12" cy="12" r="4.1"/>',
  '<circle cx="17.1" cy="6.9" r="1.15" fill="currentColor" stroke="none"/>',
  "</symbol>",

  '<symbol id="i-facebook" viewBox="0 0 24 24">',
  '<path fill="currentColor" stroke="none" d="M13.4 21v-8h2.7l.41-3.13H13.4V7.87c0-.9.25-1.52 1.55-1.52h1.65V3.55A22 22 0 0 0 14.2 3.44c-2.39 0-4.02 1.46-4.02 4.13v2.3H7.47V13h2.71v8Z"/>',
  "</symbol>",

  '<symbol id="i-tiktok" viewBox="0 0 24 24">',
  '<path fill="currentColor" stroke="none" d="M16.02 3.5c.34 2.06 1.5 3.3 3.5 3.43v2.32a5.83 5.83 0 0 1-3.26-.96v4.79c0 4.6-4.98 6.03-6.99 2.75-1.3-2.13-.5-5.87 3.66-6.02v2.45c-.32.05-.66.13-.97.25-1.7.63-1.46 3.3.58 3.2a2.1 2.1 0 0 0 2.15-2.1V3.5Z"/>',
  "</symbol>",

  "</svg>",
].join("");

/* Génère le balisage d'une icône. name = identifiant sans le préfixe « i- ». */
ZF.icon = function (name, extraClass) {
  return (
    '<svg class="icon' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true" focusable="false">' +
    '<use href="#i-' + name + '"></use></svg>'
  );
};

/* Injection du sprite au plus tôt, pour éviter toute icône vide au chargement */
(function injectSprite() {
  function inject() {
    if (document.getElementById("zf-icon-sprite")) return;
    var holder = document.createElement("div");
    holder.id = "zf-icon-sprite";
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    holder.innerHTML = ZF_ICON_SPRITE;
    document.body.insertBefore(holder, document.body.firstChild);
  }
  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
