/**
 * Shared pricing rules for House of Qi.
 * The browser shows prices, but the server always recalculates them from
 * data/catalog.json, so a shopper can never change what they pay.
 */

const round2 = (n) => Math.round(n * 100 + 1e-9) / 100;

/** Validate one bag line against the catalogue. Returns { error } or a priced line. */
export function priceLine(catalog, raw) {
  const product = catalog.products.find((p) => p.id === raw?.id);
  if (!product) return { error: "One of the pieces in your bag is no longer available. Please remove it and try again." };
  if (product.soldOut) return { error: `${product.name} has just sold out. Please remove it from your bag.` };

  const qty = Math.floor(Number(raw.qty));
  if (!(qty >= 1 && qty <= 20)) return { error: `Please check the quantity for ${product.name}.` };
  if (typeof product.stock === "number" && qty > product.stock) {
    return { error: product.stock === 1 ? `${product.name} is one of a kind, so only 1 can be ordered.` : `Only ${product.stock} of ${product.name} left. Please lower the quantity.` };
  }

  const sel = raw.sel && typeof raw.sel === "object" ? raw.sel : {};
  let unit = product.price;
  const chosen = []; // labels shown on the Stripe receipt

  for (const group of product.groups || []) {
    if (group.type === "many") {
      const picked = Array.isArray(sel[group.id]) ? sel[group.id] : [];
      for (const opt of group.opts) {
        if (picked.includes(opt.id)) { unit += opt.price; chosen.push(opt.label); }
      }
    } else {
      const wanted = sel[group.id] ?? group.default ?? group.opts[0].id;
      const opt = group.opts.find((o) => o.id === wanted);
      if (!opt) return { error: `Please choose a ${group.label.toLowerCase()} for ${product.name}.` };
      unit += opt.price;
      chosen.push(opt.short || opt.label);
    }
  }

  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "";
  return { product, qty, unit: round2(unit), chosen, note };
}

/** Price the whole bag plus delivery. */
export function priceOrder(catalog, items, shipKey) {
  if (!Array.isArray(items) || !items.length) return { error: "Your bag is empty." };
  if (items.length > 20) return { error: "Your bag has more than 20 different pieces. Please contact us for large orders." };

  const lines = [];
  for (const raw of items) {
    const line = priceLine(catalog, raw);
    if (line.error) return { error: line.error };
    lines.push(line);
  }
  // the same piece can appear on several lines (e.g. with and without a gift box)
  const perItem = {};
  for (const l of lines) perItem[l.product.id] = (perItem[l.product.id] || 0) + l.qty;
  for (const l of lines) {
    if (typeof l.product.stock === "number" && perItem[l.product.id] > l.product.stock) {
      if (l.product.stock <= 0) return { error: `${l.product.name} has just sold out. Please remove it from your bag.` };
      return { error: `Only ${l.product.stock} of ${l.product.name} left. Please lower the quantity.` };
    }
  }

  const ship = catalog.shipping[shipKey];
  if (!ship) return { error: "Please choose a delivery option." };
  // international orders are arranged with customer service, not paid online
  if (ship.contact) return { error: "For delivery to other countries, please contact our customer service on WhatsApp before ordering." };


  const subtotal = round2(lines.reduce((t, l) => t + l.unit * l.qty, 0));
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const fee = shipFee(ship, count);
  return { lines, ship, shipKey, subtotal, fee, count, weightNote: weightNote(ship, count), total: round2(subtotal + fee) };
}

/** Short, readable order number, e.g. HQ-241112-7K3P */
export function orderNumber(now = new Date()) {
  const myt = new Date(now.getTime() + 8 * 3600 * 1000); // Malaysia time
  const ymd = myt.toISOString().slice(2, 10).replace(/-/g, "");
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = crypto.getRandomValues(new Uint8Array(4));
  return `HQ-${ymd}-${[...rnd].map((b) => abc[b % abc.length]).join("")}`;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export { buildCatalog as loadCatalog } from "./catalog.js";

/**
 * Delivery fee by number of pieces: 1–3 pieces (estimated up to 500 g) pay the base rate;
 * every further block of 3 pieces adds ship.extra (e.g. Peninsular RM10, 4–6 pieces RM12, 7–9 pieces RM14).
 */
export function shipFee(ship, count) {
  if (!ship || ship.pickup || ship.contact) return 0;
  const per = ship.perItems || 3, blocks = Math.max(1, Math.ceil((count || 1) / per));
  return round2(ship.fee + (blocks - 1) * (ship.extra || 0));
}
export const weightNote = (ship, count) => (ship && !ship.pickup && !ship.contact ? ((count || 1) > (ship.perItems || 3) ? "estimated over 500 g" : "up to 500 g") : "");
