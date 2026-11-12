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

  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 140) : "";
  return { product, qty, unit: round2(unit), chosen, note };
}

/** Price the whole bag plus delivery. */
export function priceOrder(catalog, items, shipKey) {
  if (!Array.isArray(items) || !items.length) return { error: "Your bag is empty." };
  if (items.length > 40) return { error: "Your bag has too many lines. Please contact us for large orders." };

  const lines = [];
  for (const raw of items) {
    const line = priceLine(catalog, raw);
    if (line.error) return { error: line.error };
    lines.push(line);
  }

  const ship = catalog.shipping[shipKey];
  if (!ship) return { error: "Please choose a delivery option." };

  const subtotal = round2(lines.reduce((t, l) => t + l.unit * l.qty, 0));
  const fee = ship.freeOver && subtotal >= catalog.freeShippingFrom ? 0 : ship.fee;
  return { lines, ship, shipKey, subtotal, fee, total: round2(subtotal + fee) };
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

export async function loadCatalog(env, origin) {
  const res = await env.ASSETS.fetch(new URL("/data/catalog.json", origin));
  if (!res.ok) throw new Error("catalog unavailable");
  return res.json();
}
