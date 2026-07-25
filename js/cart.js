/* =========================================================
   ZAIDAT FOOD — Panier (localStorage)
   Deux produits identiques avec des options différentes
   forment deux lignes distinctes (clé = slug + options).
   ========================================================= */

var Cart = (function () {
  var STORAGE_KEY = "zaidat_cart_v1";
  var listeners = [];

  function safeParse(json) {
    try { return JSON.parse(json); } catch (e) { return null; }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* stockage indisponible */ }
    var data = safeParse(raw);
    if (!Array.isArray(data)) return [];
    /* On ne garde que les lignes valides pointant vers un produit existant */
    return data.filter(function (line) {
      return line && typeof line.slug === "string" && getProductBySlug(line.slug) &&
        typeof line.qty === "number" && line.qty > 0;
    });
  }

  function save(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* mode privé, quota… */ }
    notify();
  }

  function notify() {
    var snapshot = getState();
    listeners.forEach(function (fn) { fn(snapshot); });
  }

  function lineKey(slug, options) {
    var opts = options || {};
    var keys = Object.keys(opts).sort();
    var parts = keys.map(function (k) { return k + "=" + String(opts[k]); });
    return slug + "|" + parts.join("&");
  }

  function getItems() { return load(); }

  function count() {
    return load().reduce(function (n, line) { return n + line.qty; }, 0);
  }

  /* Sous-total : { amount, complete } — complete=false si au moins
     une ligne n'a pas de prix renseigné (prix à confirmer). */
  function subtotal() {
    var items = load();
    var amount = 0;
    var complete = true;
    items.forEach(function (line) {
      var p = getProductBySlug(line.slug);
      if (p && typeof p.price === "number") {
        amount += p.price * line.qty;
      } else {
        complete = false;
      }
    });
    return { amount: amount, complete: complete, empty: items.length === 0 };
  }

  function add(slug, qty, options) {
    var product = getProductBySlug(slug);
    if (!product) return { ok: false, reason: "introuvable" };
    if (!product.available) return { ok: false, reason: "indisponible" };
    var q = Math.max(1, Math.min(99, qty || 1));
    var items = load();
    var key = lineKey(slug, options);
    var existing = items.find(function (l) { return lineKey(l.slug, l.options) === key; });
    if (existing) {
      existing.qty = Math.min(99, existing.qty + q);
    } else {
      items.push({ slug: slug, qty: q, options: options || {} });
    }
    save(items);
    return { ok: true, product: product };
  }

  function setQty(key, qty) {
    var items = load();
    var line = items.find(function (l) { return lineKey(l.slug, l.options) === key; });
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) {
      items = items.filter(function (l) { return lineKey(l.slug, l.options) !== key; });
    } else {
      line.qty = Math.min(99, line.qty);
    }
    save(items);
  }

  function removeLine(key) {
    var items = load().filter(function (l) { return lineKey(l.slug, l.options) !== key; });
    save(items);
  }

  function clear() { save([]); }

  function onChange(fn) {
    listeners.push(fn);
  }

  function getState() {
    return { items: getItems(), count: count(), subtotal: subtotal() };
  }

  return {
    add: add,
    setQty: setQty,
    removeLine: removeLine,
    clear: clear,
    getItems: getItems,
    count: count,
    subtotal: subtotal,
    lineKey: lineKey,
    onChange: onChange,
    getState: getState,
  };
})();
